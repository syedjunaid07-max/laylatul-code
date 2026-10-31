/* laylatul-code: the client's project page (track.html#p=<link id>).
   The client enters their 6-digit code; everything else goes through two database functions
   (portal_get, portal_post) that check the code every time. */
(() => {
const C = window.LC_CONFIG || {};
const $ = s => document.querySelector(s);
const slug = new URLSearchParams(location.hash.slice(1) || location.search.slice(1)).get('p') || '';
const KEY = 'lc-code-' + slug;
let code = '', data = null, timer = 0;

function store(k, v) { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) {} }
function load(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }

async function rpc(fn, args) {
  const r = await fetch(C.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: C.supabaseKey, Authorization: 'Bearer ' + C.supabaseKey },
    body: JSON.stringify(args)
  });
  if (!r.ok) throw new Error('network');
  return r.json();
}

const ERR = {
  wrong_code: "That code doesn't match this project. Check the message we sent you with the link.",
  too_many_attempts: 'Too many wrong codes. Please wait 15 minutes, then try again.',
  too_many_messages: "You've sent a lot of messages in the last hour. Please wait a little, or message us on WhatsApp.",
  bad_body: 'Please write something first (up to 4,000 characters).',
  network: "We couldn't reach the server. Check your connection and try again."
};
function gateError(t) { $('#gate-err').textContent = t; }

if (!C.supabaseUrl || !C.supabaseKey) { $('#gate-form').hidden = true; gateError("Project tracking isn't switched on yet. Please message us on WhatsApp or email for an update."); return; }
if (!slug) { $('#gate-form').hidden = true; gateError('This link is missing its project ID. Please use the full link we sent you.'); return; }

async function open(c, quiet) {
  try {
    const res = await rpc('portal_get', { p_slug: slug, p_code: c });
    if (res.error) {
      if (quiet) { store(KEY, null); return false; }
      gateError(ERR[res.error] || ERR.network); return false;
    }
    code = c; store(KEY, c); data = res; render();
    $('#gate').hidden = true; $('#proj').hidden = false;
    if (!timer) timer = setTimeout(refresh, 30000);   // start checking for replies (once)
    return true;
  } catch (e) { if (!quiet) gateError(ERR.network); return false; }
}
async function refresh() {   // new replies show up on their own every 30 seconds while the page is open
  if (!document.hidden) await open(code, true);
  timer = setTimeout(refresh, 30000);
}

const fmtDate = d => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = d => new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const KIND = { message: 'Message', ticket: 'Ticket', comment: 'Comment' };

function render() {
  const p = data.project;
  document.title = p.title + ' | laylatul-code';
  $('#p-title').textContent = p.title;
  $('#p-sub').textContent = 'For ' + p.client_name + '. Everything about your website, in one place.';
  $('#p-fill').style.width = p.progress + '%';
  $('.p-bar').setAttribute('aria-valuenow', p.progress);
  $('#p-stage').textContent = p.status;
  $('#p-pct').textContent = p.progress + '% done';
  $('#p-due').textContent = p.due_date ? 'Launch date: ' + fmtDate(p.due_date) : '';
  $('#p-updated').textContent = 'Last updated ' + fmtTime(p.updated_at);
  const prev = $('#p-prev');
  if (p.preview_url) { prev.href = p.preview_url; prev.hidden = false; $('#p-prev-text').textContent = 'See the latest version of your website. Leave a comment below on anything you want changed.'; }
  else prev.hidden = true;

  const steps = $('#p-steps'); steps.textContent = '';
  data.steps.forEach(s => {
    const li = document.createElement('li'); li.className = s.done ? 'is-done' : '';
    li.textContent = s.title; steps.appendChild(li);
  });
  const firstOpen = steps.querySelector('li:not(.is-done)'); if (firstOpen) firstOpen.classList.add('is-now');
  renderThread();
}

function renderThread() {
  const show = document.querySelector('input[name="show"]:checked').value;
  const list = $('#p-thread'); list.textContent = '';
  const items = data.messages.filter(m => show === 'all' || m.kind === show);
  if (!items.length) {
    const li = document.createElement('li'); li.className = 'p-empty';
    li.textContent = show === 'all' ? 'No messages yet. Say hello, ask a question, or raise a ticket below.' : 'Nothing here yet.';
    list.appendChild(li); return;
  }
  items.forEach(m => {
    const li = document.createElement('li'); li.className = 'p-msg ' + m.author;
    const head = document.createElement('div'); head.className = 'p-msg-head mono';
    const who = document.createElement('b'); who.textContent = m.author === 'team' ? 'laylatul-code' : 'You';
    const tag = document.createElement('span'); tag.className = 'p-tag ' + m.kind; tag.textContent = KIND[m.kind] + (m.kind === 'ticket' ? (m.status === 'closed' ? ' · solved' : ' · open') : '');
    const when = document.createElement('time'); when.dateTime = m.created_at; when.textContent = fmtTime(m.created_at);
    head.append(who, tag, when);
    const body = document.createElement('p'); body.textContent = m.body;   // plain text only
    li.append(head, body); list.appendChild(li);
  });
  list.lastElementChild.scrollIntoView({ block: 'nearest' });
}

$('#gate-form').addEventListener('submit', async e => {
  e.preventDefault();
  const c = $('#code').value.replace(/\D/g, '');
  if (c.length !== 6) { gateError('The code has 6 digits.'); return; }
  gateError(''); const b = e.submitter || $('#gate-form .btn'); b.disabled = true;
  await open(c); b.disabled = false;
});
document.querySelectorAll('input[name="show"]').forEach(r => r.addEventListener('change', () => data && renderThread()));
$('#p-form').addEventListener('submit', async e => {
  e.preventDefault();
  const body = $('#p-body').value.trim(), kind = document.querySelector('input[name="kind"]:checked').value, err = $('#p-err');
  if (!body) { err.textContent = ERR.bad_body; return; }
  err.textContent = ''; const b = $('#p-form .btn'); b.disabled = true; b.textContent = 'Sending';
  try {
    const res = await rpc('portal_post', { p_slug: slug, p_code: code, p_kind: kind, p_body: body });
    if (res.error) err.textContent = ERR[res.error] || ERR.network;
    else { $('#p-body').value = ''; await open(code, true); }
  } catch (x) { err.textContent = ERR.network; }
  b.disabled = false; b.textContent = 'Send';
});

const saved = load(KEY);   // the code is remembered only for this browser tab
if (saved) open(saved, true);
})();
