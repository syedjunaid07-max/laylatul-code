/* laylatul-code: the "Ask us" assistant. A chat bubble that sends questions to the Supabase
   function "assistant", which answers with Google Gemini (the key stays on the server). */
(() => {
const C = window.LC_CONFIG || {};
if (!C.supabaseUrl || !C.supabaseKey || C.assistant === false) return;
const URL = C.supabaseUrl.replace(/\/$/, '') + '/functions/v1/assistant';
const history = [];
const SUGGEST = ['How much does a website cost?', 'How long does it take?', 'Who owns the website?', 'How do I pay?'];

const wrap = document.createElement('div');
wrap.className = 'ai';
wrap.innerHTML = `
  <button class="ai-btn" type="button" aria-expanded="false" aria-controls="ai-panel"><span class="ai-dot" aria-hidden="true"></span><span>Ask us</span></button>
  <section class="ai-panel" id="ai-panel" role="dialog" aria-label="Ask laylatul-code" hidden>
    <header class="ai-head"><div><b>Ask laylatul-code</b><span class="mono">AI assistant · answers can be wrong</span></div><button class="ai-x" type="button" aria-label="Close">&times;</button></header>
    <ol class="ai-log" aria-live="polite"></ol>
    <div class="ai-sugg"></div>
    <form class="ai-form"><label class="sr-only" for="ai-in">Your question</label><input id="ai-in" maxlength="1000" autocomplete="off" placeholder="Type your question"><button class="btn btn-sm" type="submit">Send</button></form>
  </section>`;
document.body.appendChild(wrap);
const btn = wrap.querySelector('.ai-btn'), panel = wrap.querySelector('.ai-panel'), log = wrap.querySelector('.ai-log'),
      form = wrap.querySelector('.ai-form'), input = wrap.querySelector('#ai-in'), sugg = wrap.querySelector('.ai-sugg');

function add(role, text) {
  const li = document.createElement('li'); li.className = 'ai-msg ' + role; li.textContent = text;
  log.appendChild(li); log.scrollTop = log.scrollHeight; return li;
}
function toggle(open) {
  panel.hidden = !open; btn.setAttribute('aria-expanded', open); wrap.classList.toggle('open', open);
  if (open) {
    if (!log.children.length) add('assistant', "Hi! Ask me anything about getting your website built: prices, timing, how it works. For an exact quote, use \"Start your request\".");
    input.focus();
  } else btn.focus();
}
btn.addEventListener('click', () => toggle(panel.hidden));
wrap.querySelector('.ai-x').addEventListener('click', () => toggle(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) toggle(false); });
SUGGEST.forEach(q => { const b = document.createElement('button'); b.type = 'button'; b.textContent = q; b.addEventListener('click', () => ask(q)); sugg.appendChild(b); });

let busy = false;
async function ask(q) {
  q = q.trim(); if (!q || busy) return;
  busy = true; sugg.hidden = true; input.value = '';
  add('user', q); history.push({ role: 'user', text: q });
  const wait = add('assistant typing', 'Thinking…');
  try {
    const r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.supabaseKey, Authorization: 'Bearer ' + C.supabaseKey }, body: JSON.stringify({ messages: history.slice(-12) }) });
    const d = await r.json().catch(() => ({}));
    const text = d.text || "Sorry, I couldn't answer that just now. Please try again, or send us a request and a person will reply within one working day.";
    wait.className = 'ai-msg assistant'; wait.textContent = text;
    if (r.ok) history.push({ role: 'assistant', text });
  } catch (e) {
    wait.className = 'ai-msg assistant'; wait.textContent = "I couldn't connect. Check your internet and try again.";
  }
  busy = false; log.scrollTop = log.scrollHeight;
}
form.addEventListener('submit', e => { e.preventDefault(); ask(input.value); });
})();
