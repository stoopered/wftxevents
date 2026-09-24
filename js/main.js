const API_BASE = ['localhost', '127.0.0.1'].includes(location.hostname)
  ? 'http://127.0.0.1:8787'
  : 'https://wftxevents-booking.michael-b-rehkemper.workers.dev';

document.getElementById('year').textContent = new Date().getFullYear();

// Mobile nav
const navToggle = document.getElementById('navToggle');
const siteNav = document.getElementById('siteNav');
navToggle.addEventListener('click', () => {
  const open = siteNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
});
siteNav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    siteNav.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// Booking
const form = document.getElementById('bookingForm');
const dateSelect = document.getElementById('dateSelect');
const timeSelect = document.getElementById('timeSelect');
const formMsg = document.getElementById('formMsg');
const bookBtn = document.getElementById('bookBtn');
const confirmation = document.getElementById('confirmation');

function setMsg(text, ok = false) {
  formMsg.textContent = text;
  formMsg.classList.toggle('ok', ok);
}

function fillSelect(select, options, placeholder) {
  select.innerHTML = '';
  const first = document.createElement('option');
  first.value = '';
  first.textContent = placeholder;
  select.appendChild(first);
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    opt.disabled = !!o.disabled;
    select.appendChild(opt);
  }
}

async function api(path, init) {
  const res = await fetch(API_BASE + path, { ...init, headers: { 'Content-Type': 'application/json', ...(init && init.headers) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function loadDates() {
  try {
    const { dates } = await api('/api/dates');
    if (!dates.length) {
      fillSelect(dateSelect, [], 'No Sunday appointments open right now');
      dateSelect.disabled = true;
      bookBtn.disabled = true;
      return;
    }
    fillSelect(
      dateSelect,
      dates.map((d) => ({ value: d.date, label: d.remaining ? d.label : `${d.label} (full)`, disabled: !d.remaining })),
      'Choose a Sunday',
    );
  } catch (err) {
    fillSelect(dateSelect, [], 'Booking is temporarily unavailable');
    dateSelect.disabled = true;
    bookBtn.disabled = true;
    setMsg(err.message);
  }
}

async function loadSlots(date) {
  timeSelect.disabled = true;
  fillSelect(timeSelect, [], 'Loading times…');
  if (!date) {
    fillSelect(timeSelect, [], 'Pick a date first');
    return;
  }
  try {
    const { slots } = await api(`/api/slots?date=${encodeURIComponent(date)}`);
    fillSelect(
      timeSelect,
      slots.map((s) => ({ value: s.time, label: s.remaining ? s.label : `${s.label} (full)`, disabled: !s.remaining })),
      'Choose a time',
    );
    timeSelect.disabled = false;
  } catch (err) {
    fillSelect(timeSelect, [], 'Could not load times');
    setMsg(err.message);
  }
}

dateSelect.addEventListener('change', () => {
  setMsg('');
  loadSlots(dateSelect.value);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setMsg('');
  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());
  payload.party = Number(payload.party);
  payload.kids = Number(payload.kids);

  if (!payload.date || !payload.time) return setMsg('Pick a date and a time.');
  if (!form.reportValidity()) return;

  bookBtn.disabled = true;
  bookBtn.textContent = 'Holding…';
  try {
    const c = await api('/api/bookings', { method: 'POST', body: JSON.stringify(payload) });
    document.getElementById('confCode').textContent = c.code;
    document.getElementById('confDetails').textContent =
      `${c.dateLabel} at ${c.timeLabel} for ${c.party} ${c.party === 1 ? 'person' : 'people'}` +
      (c.kids ? ` (${c.kids} glow ${c.kids === 1 ? 'band' : 'bands'})` : '') + '.';
    form.hidden = true;
    confirmation.hidden = false;
    confirmation.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    setMsg(err.message);
    if (/filled up/i.test(err.message)) loadSlots(dateSelect.value);
  } finally {
    bookBtn.disabled = false;
    bookBtn.textContent = 'Hold My Slot';
  }
});

document.getElementById('bookAnother').addEventListener('click', () => {
  confirmation.hidden = true;
  form.hidden = false;
  form.reset();
  fillSelect(timeSelect, [], 'Pick a date first');
  timeSelect.disabled = true;
  loadDates();
});

loadDates();
