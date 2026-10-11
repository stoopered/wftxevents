const API_BASE = ['localhost', '127.0.0.1'].includes(location.hostname)
  ? 'http://127.0.0.1:8787'
  : 'https://wftxevents-booking.michael-b-rehkemper.workers.dev';
const TIME_ZONE = 'America/Chicago';

const $ = (id) => document.getElementById(id);
const form = $('waiverForm');
const formMsg = $('formMsg');
const signBtn = $('signBtn');
const isMinor = $('isMinor');
let waiverVersion = null;

// ---------- signature pad ----------

class SignaturePad {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.points = 0;
    this.drawing = false;
    this.last = null;
    canvas.addEventListener('pointerdown', (e) => this.start(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) canvas.addEventListener(ev, () => (this.drawing = false));
  }

  // Sizes the backing store to the on-screen size; keeps any existing ink.
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (w === this.canvas.width && h === this.canvas.height) return;
    const prev = this.points ? this.canvas.toDataURL() : null;
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.lineWidth = 2.5;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = '#111';
    this.fillWhite();
    if (prev) {
      const img = new Image();
      img.onload = () => this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = prev;
    }
  }

  fillWhite() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  start(e) {
    e.preventDefault();
    // Capture is a nicety (keeps the stroke if the finger slides off the pad); never let it block drawing.
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {}
    this.drawing = true;
    this.last = this.pos(e);
    this.ctx.beginPath();
    this.ctx.arc(this.last.x, this.last.y, 1.2, 0, Math.PI * 2);
    this.ctx.fillStyle = '#111';
    this.ctx.fill();
    this.points++;
  }

  move(e) {
    if (!this.drawing) return;
    e.preventDefault();
    const p = this.pos(e);
    this.ctx.beginPath();
    this.ctx.moveTo(this.last.x, this.last.y);
    this.ctx.lineTo(p.x, p.y);
    this.ctx.stroke();
    this.last = p;
    this.points++;
  }

  clear() {
    this.points = 0;
    this.fillWhite();
  }

  isEmpty() {
    return this.points < 8; // a stray tap isn't a signature
  }

  // Downscaled PNG keeps the upload small without losing legibility.
  toPNG() {
    const maxW = 800;
    const w = Math.min(maxW, this.canvas.width);
    const h = Math.round((this.canvas.height * w) / this.canvas.width);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    out.getContext('2d').drawImage(this.canvas, 0, 0, w, h);
    return out.toDataURL('image/png');
  }
}

const pads = { participantPad: new SignaturePad($('participantPad')), guardianPad: new SignaturePad($('guardianPad')) };
const resizePads = () => Object.values(pads).forEach((p) => p.resize());
window.addEventListener('resize', resizePads);
document.querySelectorAll('[data-clear]').forEach((b) => b.addEventListener('click', () => pads[b.dataset.clear].clear()));

// ---------- waiver text ----------

function richText(el, text) {
  text.split('**').forEach((part, i) => {
    if (!part) return;
    if (i % 2) {
      const s = document.createElement('strong');
      s.textContent = part;
      el.appendChild(s);
    } else {
      el.appendChild(document.createTextNode(part));
    }
  });
}

function para(container, text) {
  const p = document.createElement('p');
  richText(p, text);
  container.appendChild(p);
}

function heading(container, text) {
  const h = document.createElement('h3');
  h.textContent = text;
  container.appendChild(h);
}

async function loadWaiver() {
  const box = $('waiverText');
  try {
    const res = await fetch(`${API_BASE}/api/waiver`);
    if (!res.ok) throw new Error();
    const { version, waiver } = await res.json();
    waiverVersion = version;
    $('wTitle').textContent = waiver.title;
    $('wSubtitle').textContent = waiver.subtitle;
    box.textContent = '';
    para(box, waiver.intro);
    for (const s of waiver.sections) {
      heading(box, s.heading);
      para(box, s.text);
    }
    heading(box, waiver.acknowledgment.heading);
    para(box, waiver.acknowledgment.text);
    $('consentText').textContent = `I have read and agree to this waiver. ${waiver.esignConsent}`;
    form.hidden = false;
    resizePads();
  } catch {
    box.textContent = '';
    para(box, "The waiver couldn't load. Check your connection and refresh, or ask staff for a paper copy.");
  }
}

$('todayLabel').textContent = new Date().toLocaleDateString('en-US', { timeZone: TIME_ZONE, dateStyle: 'long' });

// ---------- minors ----------

function syncMinor() {
  const minor = isMinor.checked;
  $('guardianFields').hidden = !minor;
  $('guardianSigWrap').hidden = !minor;
  form.elements.guardianName.required = minor;
  $('participantSigLabel').textContent = minor ? 'Participant signature (optional for under 18)' : 'Participant signature';
  resizePads();
}
isMinor.addEventListener('change', syncMinor);

// ---------- submit ----------

const copyDialog = $('copyDialog');
const copyEmail = $('copyEmail');
const copyMsg = $('copyMsg');

function setMsg(text) {
  formMsg.textContent = text;
  if (text) formMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function validate() {
  const f = form.elements;
  const minor = isMinor.checked;
  if (f.participantName.value.trim().length < 2) return "Please enter the participant's full name.";
  if (minor && f.guardianName.value.trim().length < 2) return "Please enter the parent or guardian's full name.";
  if (f.phone.value.replace(/[^\d]/g, '').length < 10) return 'Please enter a valid phone number.';
  if (f.email.value.trim() && !f.email.checkValidity()) return 'Please enter a valid email, or leave it blank.';
  if (f.emergencyContact.value.trim().length < 3) return 'Please enter an emergency contact.';
  if (minor && pads.guardianPad.isEmpty()) return 'A parent or legal guardian must sign for participants under 18.';
  if (!minor && pads.participantPad.isEmpty()) return 'Please sign in the signature box.';
  if (!f.consent.checked) return 'Please check the box to agree to the waiver.';
  return null;
}

// Resolves to { emailCopy, email } once the guest answers the "want a copy?" prompt.
function askForCopy(prefill) {
  return new Promise((resolve) => {
    copyEmail.value = prefill;
    copyMsg.textContent = '';
    const done = (result) => {
      copyDialog.close();
      $('copyYes').onclick = $('copyNo').onclick = null;
      resolve(result);
    };
    $('copyNo').onclick = () => done({ emailCopy: false, email: prefill });
    $('copyYes').onclick = () => {
      const email = copyEmail.value.trim();
      if (!email || !copyEmail.checkValidity()) {
        copyMsg.textContent = 'Enter a valid email address.';
        return;
      }
      done({ emailCopy: true, email });
    };
    copyDialog.oncancel = (e) => {
      e.preventDefault();
      done({ emailCopy: false, email: prefill });
    };
    copyDialog.showModal();
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setMsg('');
  const problem = validate();
  if (problem) return setMsg(problem);

  const f = form.elements;
  const { emailCopy, email } = await askForCopy(f.email.value.trim());
  const minor = isMinor.checked;
  const payload = {
    waiverVersion,
    participantName: f.participantName.value,
    isMinor: minor,
    guardianName: minor ? f.guardianName.value : '',
    phone: f.phone.value,
    email,
    emailCopy,
    emergencyContact: f.emergencyContact.value,
    participantSignature: pads.participantPad.isEmpty() ? null : pads.participantPad.toPNG(),
    guardianSignature: minor ? pads.guardianPad.toPNG() : null,
    consent: f.consent.checked,
    website: f.website.value,
  };

  signBtn.disabled = true;
  signBtn.textContent = 'Signing…';
  try {
    const res = await fetch(`${API_BASE}/api/waivers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Something went wrong (${res.status}). Please try again.`);

    $('doneRef').textContent = data.reference;
    $('doneDetails').textContent = `${payload.participantName.trim()}${minor ? ` (signed by ${payload.guardianName.trim()})` : ''}, signed ${data.signedLabel}.`;
    $('doneEmail').textContent = data.emailCopy ? `A copy is on its way to ${email}.` : '';
    form.hidden = true;
    $('done').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    setMsg(err.message);
  } finally {
    signBtn.disabled = false;
    signBtn.textContent = 'Sign Waiver';
  }
});

// Keeps the family's shared details so the next waiver is quick.
$('signAnother').addEventListener('click', () => {
  const f = form.elements;
  f.participantName.value = '';
  f.consent.checked = false;
  pads.participantPad.clear();
  pads.guardianPad.clear();
  setMsg('');
  $('done').hidden = true;
  form.hidden = false;
  resizePads();
  $('waiverText').scrollIntoView({ behavior: 'smooth' });
});

loadWaiver();
