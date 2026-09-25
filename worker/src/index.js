// Sunday appointment booking API for wftxevents.com.
// Storage: Cloudflare D1 (binding DB). Admin auth: ADMIN_TOKEN secret.

const CONFIG = {
  timeZone: 'America/Chicago',
  season: { start: '2026-10-01', end: '2026-10-31' },
  bookableWeekday: 0, // Sunday
  // Sunday 7:30 PM - midnight; last entry 11:30 PM (runs take 20-30 min).
  slots: ['19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'],
  capacityPerSlot: 2, // groups per slot
  maxParty: 10,
  maxBookingsPerIpPerHour: 5,
  contactPhone: '940-353-0500',
  adminUrl: 'https://wftxevents.com/admin.html',
  allowedOrigins: [
    'https://wftxevents.com',
    'https://www.wftxevents.com',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
  ],
};

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request.headers.get('Origin') || '');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    let res;
    try {
      res = await route(request, env, ctx);
    } catch (err) {
      console.error(err);
      res = json({ error: 'Something went wrong on our end.' }, 500);
    }
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  },
};

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  if (method === 'GET' && pathname === '/') return json({ ok: true, service: 'wftxevents-booking' });
  if (method === 'GET' && pathname === '/api/dates') return listDates(env);
  if (method === 'GET' && pathname === '/api/slots') return listSlots(env, url.searchParams.get('date'));
  if (method === 'POST' && pathname === '/api/bookings') return createBooking(request, env, ctx);

  if (pathname.startsWith('/api/admin/')) {
    if (!(await isAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
    if (method === 'GET' && pathname === '/api/admin/bookings') return adminList(env, url.searchParams.get('date'));
    const m = pathname.match(/^\/api\/admin\/bookings\/([0-9a-f-]{36})(?:\/(approve|decline))?$/);
    if (m && method === 'POST' && m[2] === 'approve') return adminApprove(env, ctx, m[1]);
    if (m && method === 'POST' && m[2] === 'decline') return adminDecide(env, ctx, m[1], ['pending'], 'declined');
    if (m && method === 'DELETE' && !m[2]) return adminDecide(env, ctx, m[1], ['pending', 'confirmed'], 'cancelled');
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

async function createBooking(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  if (body.website) return json({ error: 'Invalid request.' }, 400); // honeypot

  // Line breaks stripped: the name ends up in an email subject line.
  const name = (str(body.name, 80) || '').replace(/[\r\n\t]+/g, ' ').trim() || null;
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

  // Requests start as 'pending' and don't hold the slot until an admin approves.
  // Still refuse a slot that's already fully confirmed.
  const result = await env.DB.prepare(
    `INSERT INTO bookings (id, code, name, phone, email, party, kids, date, time, notes, status, ip_hash, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'pending', ?11, ?12
     WHERE (SELECT COUNT(*) FROM bookings WHERE date = ?8 AND time = ?9 AND status = 'confirmed') < ?13`,
  ).bind(id, code, name, phone, email, party, kids, date, time, notes, ipHash, now, CONFIG.capacityPerSlot).run();

  if (!result.meta.changes) return json({ error: 'That time slot is full. Please pick another.' }, 409);

  const booking = { id, code, name, phone, email, party, kids, notes, dateLabel: labelDate(date), timeLabel: labelTime(time) };
  ctx.waitUntil(notifyNewRequest(env, booking));

  return json({ ok: true, status: 'pending', code, date, dateLabel: booking.dateLabel, time, timeLabel: booking.timeLabel, party, kids }, 201);
}

// ---------- notifications (Resend email + ntfy push) ----------
// All run via ctx.waitUntil after the response; a failure never affects the booking.

const FROM = 'WFTX Zombie Maze <bookings@wftxevents.com>';
const WHERE = [
  `Where:  8001 Jacksboro Hwy, Wichita Falls, TX 76310`,
  `Park alongside the shipping container or in front of the blue building.`,
];

const owners = (env) => (env.NOTIFY_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean);
const when = (b) => `${b.dateLabel} at ${b.timeLabel}`;
const groupText = (b) => `${b.party} ${b.party === 1 ? 'person' : 'people'}${b.kids ? `, ${b.kids} ${b.kids === 1 ? 'kid' : 'kids'} (glow bands)` : ''}`;

async function settle(label, promises) {
  const results = await Promise.allSettled(promises);
  for (const r of results) if (r.status === 'rejected') console.error(`${label} failed:`, r.reason?.message || r.reason);
}

async function notifyNewRequest(env, b) {
  const sends = [
    ntfy(env, {
      title: `Booking request: ${b.name}`,
      message: `${when(b)}\n${groupText(b)}\nTap to approve or decline.`,
      priority: 4,
      tags: ['zombie'],
      click: CONFIG.adminUrl,
      actions: [{ action: 'view', label: 'Review', url: CONFIG.adminUrl, clear: true }],
    }),
  ];

  if (owners(env).length) {
    sends.push(sendEmail(env, `owner-request-${b.id}`, {
      to: owners(env),
      reply_to: b.email,
      subject: `Needs approval: ${b.name}, ${when(b)}`,
      text: [
        `New Sunday booking request -- not confirmed until you approve it.`,
        ``,
        `When:   ${when(b)}`,
        `Name:   ${b.name}`,
        `Group:  ${groupText(b)}`,
        `Phone:  ${b.phone}`,
        `Email:  ${b.email}`,
        `Code:   ${b.code}`,
        b.notes ? `Notes:  ${b.notes}` : null,
        ``,
        `Approve or decline: ${CONFIG.adminUrl}`,
      ].filter((l) => l !== null).join('\n'),
    }));
  }

  sends.push(sendEmail(env, `guest-request-${b.id}`, {
    to: [b.email],
    subject: `Request received: Zombie Maze, ${when(b)}`,
    text: [
      `${b.name}, we got your request. It's not confirmed yet.`,
      ``,
      `When:   ${when(b)}`,
      `Group:  ${groupText(b)}`,
      `Code:   ${b.code}`,
      ``,
      `We'll email you as soon as it's confirmed. Questions? Call ${CONFIG.contactPhone}.`,
      ``,
      `WFTX Events - https://wftxevents.com`,
    ].join('\n'),
  }));

  await settle('new-request notifications', sends);
}

async function notifyGuestDecision(env, b, status) {
  const templates = {
    confirmed: {
      subject: `You're confirmed: Zombie Maze, ${when(b)}`,
      lines: [
        `${b.name}, you're in. The infected are expecting you.`,
        ``,
        `When:   ${when(b)}`,
        `Group:  ${groupText(b)}`,
        `Code:   ${b.code}`,
        ``,
        ...WHERE,
        ``,
        `Closed-toe shoes. The paint washes out. The memories don't.`,
        ``,
        `Need to change or cancel? Reply to this email or call ${CONFIG.contactPhone}.`,
      ],
    },
    declined: {
      subject: `We couldn't confirm your Zombie Maze request`,
      lines: [
        `${b.name}, we couldn't fit your group in on ${when(b)}.`,
        ``,
        `Pick another Sunday slot at https://wftxevents.com/#book, or call ${CONFIG.contactPhone}`,
        `and we'll find something. Thursday-Saturday 8 PM to midnight is walk-up, no reservation needed.`,
      ],
    },
    cancelled: {
      subject: `Your Zombie Maze booking was cancelled`,
      lines: [
        `${b.name}, your booking for ${when(b)} (code ${b.code}) has been cancelled.`,
        ``,
        `If that's a surprise, call ${CONFIG.contactPhone}.`,
      ],
    },
  };
  const t = templates[status];
  if (!t) return;
  await settle(`${status} email`, [
    sendEmail(env, `guest-${status}-${b.id}`, {
      to: [b.email],
      subject: t.subject,
      text: [...t.lines, ``, `WFTX Events - https://wftxevents.com`].join('\n'),
    }),
  ]);
}

async function sendEmail(env, idempotencyKey, { to, subject, text, reply_to }) {
  if (!env.RESEND_API_KEY) return console.warn('RESEND_API_KEY not set; skipping email');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ from: FROM, to, subject, text, reply_to: reply_to || (owners(env).length ? owners(env) : undefined) }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

// JSON publish so names with accents etc. survive (headers must be ASCII).
async function ntfy(env, msg) {
  if (!env.NTFY_TOPIC) return console.warn('NTFY_TOPIC not set; skipping push');
  const res = await fetch('https://ntfy.sh/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: env.NTFY_TOPIC, ...msg }),
  });
  if (!res.ok) throw new Error(`ntfy ${res.status}: ${(await res.text()).slice(0, 300)}`);
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

async function getBooking(env, id) {
  const r = await env.DB.prepare(`SELECT * FROM bookings WHERE id = ?`).bind(id).first();
  return r && { ...r, dateLabel: labelDate(r.date), timeLabel: labelTime(r.time) };
}

// Atomic: only confirms if the slot still has room among confirmed bookings.
async function adminApprove(env, ctx, id) {
  const now = Math.floor(Date.now() / 1000);
  const result = await env.DB.prepare(
    `UPDATE bookings SET status = 'confirmed', decided_at = ?2
     WHERE id = ?1 AND status = 'pending'
       AND (SELECT COUNT(*) FROM bookings o
            WHERE o.status = 'confirmed'
              AND o.date = (SELECT date FROM bookings WHERE id = ?1)
              AND o.time = (SELECT time FROM bookings WHERE id = ?1)) < ?3`,
  ).bind(id, now, CONFIG.capacityPerSlot).run();

  const b = await getBooking(env, id);
  if (!b) return json({ error: 'Booking not found.' }, 404);
  if (!result.meta.changes) {
    if (b.status !== 'pending') return json({ error: `Already ${b.status}.` }, 409);
    return json({ error: 'That slot is already full. Decline this one or cancel another booking first.' }, 409);
  }
  ctx.waitUntil(notifyGuestDecision(env, b, 'confirmed'));
  return json({ ok: true, status: 'confirmed' });
}

async function adminDecide(env, ctx, id, fromStatuses, toStatus) {
  const now = Math.floor(Date.now() / 1000);
  const result = await env.DB.prepare(
    `UPDATE bookings SET status = ?2, decided_at = ?3 WHERE id = ?1 AND status IN (${fromStatuses.map((s) => `'${s}'`).join(',')})`,
  ).bind(id, toStatus, now).run();
  const b = await getBooking(env, id);
  if (!b) return json({ error: 'Booking not found.' }, 404);
  if (!result.meta.changes) return json({ error: `Can't change a ${b.status} booking.` }, 409);
  ctx.waitUntil(notifyGuestDecision(env, b, toStatus));
  return json({ ok: true, status: toStatus });
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
