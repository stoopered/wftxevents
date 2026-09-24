// Sunday appointment booking API for wftxevents.com.
// Storage: Cloudflare D1 (binding DB). Admin auth: ADMIN_TOKEN secret.

const CONFIG = {
  timeZone: 'America/Chicago',
  season: { start: '2026-10-01', end: '2026-10-31' },
  bookableWeekday: 0, // Sunday
  slots: ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'],
  capacityPerSlot: 2, // groups per slot
  maxParty: 10,
  maxBookingsPerIpPerHour: 5,
  allowedOrigins: [
    'https://wftxevents.com',
    'https://www.wftxevents.com',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
  ],
};

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request.headers.get('Origin') || '');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    let res;
    try {
      res = await route(request, env);
    } catch (err) {
      console.error(err);
      res = json({ error: 'Something went wrong on our end.' }, 500);
    }
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  },
};

async function route(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  if (method === 'GET' && pathname === '/') return json({ ok: true, service: 'wftxevents-booking' });
  if (method === 'GET' && pathname === '/api/dates') return listDates(env);
  if (method === 'GET' && pathname === '/api/slots') return listSlots(env, url.searchParams.get('date'));
  if (method === 'POST' && pathname === '/api/bookings') return createBooking(request, env);

  if (pathname.startsWith('/api/admin/')) {
    if (!(await isAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
    if (method === 'GET' && pathname === '/api/admin/bookings') return adminList(env, url.searchParams.get('date'));
    const m = pathname.match(/^\/api\/admin\/bookings\/([0-9a-f-]{36})$/);
    if (method === 'DELETE' && m) return adminCancel(env, m[1]);
  }

  return json({ error: 'Not found' }, 404);
}

// ---------- public ----------

async function listDates(env) {
  const dates = bookableDates();
  if (dates.length === 0) return json({ dates: [] });

  const counts = await env.DB.prepare(
    `SELECT date, COUNT(*) AS n FROM bookings WHERE status = 'confirmed' AND date IN (${dates.map(() => '?').join(',')}) GROUP BY date`,
  ).bind(...dates).all();
  const booked = Object.fromEntries(counts.results.map((r) => [r.date, r.n]));
  const total = CONFIG.slots.length * CONFIG.capacityPerSlot;

  return json({
    dates: dates.map((date) => ({ date, label: labelDate(date), remaining: Math.max(0, total - (booked[date] || 0)) })),
  });
}

async function listSlots(env, date) {
  if (!bookableDates().includes(date)) return json({ error: 'That date is not open for appointments.' }, 400);

  const counts = await env.DB.prepare(
    `SELECT time, COUNT(*) AS n FROM bookings WHERE status = 'confirmed' AND date = ? GROUP BY time`,
  ).bind(date).all();
  const booked = Object.fromEntries(counts.results.map((r) => [r.time, r.n]));

  return json({
    date,
    slots: CONFIG.slots.map((time) => ({ time, label: labelTime(time), remaining: Math.max(0, CONFIG.capacityPerSlot - (booked[time] || 0)) })),
  });
}

async function createBooking(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  if (body.website) return json({ error: 'Invalid request.' }, 400); // honeypot

  const name = str(body.name, 80);
  const phone = (str(body.phone, 30) || '').replace(/[^\d+]/g, '');
  const email = str(body.email, 120);
  const party = int(body.party);
  const kids = int(body.kids) ?? 0;
  const date = str(body.date, 10);
  const time = str(body.time, 5);
  const notes = str(body.notes, 300) || null;

  const errors = [];
  if (!name || name.length < 2) errors.push('Please enter your name.');
  if (!/^\+?\d{10,15}$/.test(phone)) errors.push('Please enter a valid phone number.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Please enter a valid email.');
  if (party === null || party < 1 || party > CONFIG.maxParty) errors.push(`Group size must be between 1 and ${CONFIG.maxParty}.`);
  if (kids === null || kids < 0 || (party !== null && kids > party)) errors.push('Kids count must be between 0 and your group size.');
  if (!bookableDates().includes(date)) errors.push('That date is not open for appointments.');
  if (!CONFIG.slots.includes(time)) errors.push('Please pick a time slot.');
  if (errors.length) return json({ error: errors.join(' ') }, 400);

  const ipHash = await sha256(request.headers.get('CF-Connecting-IP') || '');
  const now = Math.floor(Date.now() / 1000);

  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM bookings WHERE ip_hash = ? AND created_at > ?`,
  ).bind(ipHash, now - 3600).first('n');
  if (recent >= CONFIG.maxBookingsPerIpPerHour) return json({ error: 'Too many requests. Please try again later.' }, 429);

  const id = crypto.randomUUID();
  const code = confirmationCode();

  // Single statement so the capacity check and insert are atomic.
  const result = await env.DB.prepare(
    `INSERT INTO bookings (id, code, name, phone, email, party, kids, date, time, notes, ip_hash, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12
     WHERE (SELECT COUNT(*) FROM bookings WHERE date = ?8 AND time = ?9 AND status = 'confirmed') < ?13`,
  ).bind(id, code, name, phone, email, party, kids, date, time, notes, ipHash, now, CONFIG.capacityPerSlot).run();

  if (!result.meta.changes) return json({ error: 'That time slot just filled up. Please pick another.' }, 409);

  return json({ ok: true, code, date, dateLabel: labelDate(date), time, timeLabel: labelTime(time), party, kids }, 201);
}

// ---------- admin ----------

async function isAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !env.ADMIN_TOKEN) return false;
  const a = await sha256(token);
  const b = await sha256(env.ADMIN_TOKEN);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function adminList(env, date) {
  const stmt = date
    ? env.DB.prepare(`SELECT * FROM bookings WHERE date = ? ORDER BY time, created_at`).bind(date)
    : env.DB.prepare(`SELECT * FROM bookings ORDER BY date, time, created_at`);
  const { results } = await stmt.all();
  return json({
    bookings: results.map((r) => ({ ...r, ip_hash: undefined, dateLabel: labelDate(r.date), timeLabel: labelTime(r.time) })),
  });
}

async function adminCancel(env, id) {
  const result = await env.DB.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ? AND status = 'confirmed'`).bind(id).run();
  if (!result.meta.changes) return json({ error: 'Booking not found or already cancelled.' }, 404);
  return json({ ok: true });
}

// ---------- helpers ----------

function bookableDates() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: CONFIG.timeZone });
  const out = [];
  const [sy, sm, sd] = CONFIG.season.start.split('-').map(Number);
  const end = CONFIG.season.end;
  for (let d = new Date(Date.UTC(sy, sm - 1, sd)); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (iso > end) break;
    if (d.getUTCDay() === CONFIG.bookableWeekday && iso >= today) out.push(iso);
  }
  return out;
}

function labelDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function labelTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
}

function confirmationCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function str(v, max) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t.slice(0, max) : null;
}

function int(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function corsHeaders(origin) {
  const allowed = CONFIG.allowedOrigins.includes(origin) ? origin : CONFIG.allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
