/* laylatul-code: the owner's project admin (admin.html).
   Signs in with Supabase Auth; the database only lets in emails listed in public.admins. */
(() => {
const C = window.LC_CONFIG || {};
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const STAGES = ['Planning', 'Design', 'Build', 'Review', 'Launching', 'Live', 'On hold'];
const KIND = { message: 'Message', ticket: 'Ticket', comment: 'Comment' };
const fmtTime = d => new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
let sb, current = null, projects = [];

function fail(t) { $('#a-err').textContent = t || ''; }
if (!C.supabaseUrl || !C.supabaseKey || !window.supabase) { $('#a-login').hidden = false; $('#login-form').hidden = true; $('#login-err').textContent = 'Fill in assets/config.js with your Supabase details first.'; return; }
sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey);

async function start() {
  const { data } = await sb.auth.getSession();
  if (!data.session) { $('#a-login').hidden = false; $('#a-app').hidden = true; return; }
  $('#a-login').hidden = true; $('#a-app').hidden = false;
  $('#a-who').textContent = data.session.user.email;
  await loadList();
}

$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const { error } = await sb.auth.signInWithPassword({ email: $('#a-email').value.trim(), password: $('#a-pass').value });
  $('#login-err').textContent = error ? 'Sign-in failed: ' + error.message : '';
  if (!error) { $('#a-pass').value = ''; start(); }
});
$('#a-out').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });

async function loadList() {
  const { data, error } = await sb.from('projects').select('id, slug, client_name, title, status, progress, updated_at, project_messages(kind, status, author, created_at)').order('updated_at', { ascending: false });
  if (error) { fail('Could not load projects: ' + error.message + '. Is your email in the admins table?'); return; }
  fail(''); projects = data;
  const list = $('#a-list'); list.textContent = '';
  if (!data.length) list.append(el('li', { className: 'a-hint', textContent: 'No projects yet.' }));
  data.forEach(p => {
    const open = p.project_messages.filter(m => m.kind === 'ticket' && m.status === 'open').length;
    const last = p.project_messages.sort((a, b) => a.created_at < b.created_at ? 1 : -1)[0];
    const waiting = last && last.author === 'client';
    const b = el('button', { type: 'button', className: 'a-item' + (current === p.id ? ' on' : '') },
      el('b', { textContent: p.title }),
      el('span', { textContent: p.client_name + ' · ' + p.status + ' · ' + p.progress + '%' }),
      el('span', { className: 'a-flags mono', textContent: [open ? open + ' open ticket' + (open > 1 ? 's' : '') : '', waiting ? 'client waiting' : ''].filter(Boolean).join(' · ') }));
    b.addEventListener('click', () => openProject(p.id));
    list.append(el('li', {}, b));
  });
}

$('#new-form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  if (!f.get('client').trim() || !f.get('title').trim()) { $('#new-err').textContent = 'Client name and title are needed.'; return; }
  const { data, error } = await sb.rpc('admin_create_project', { p_client: f.get('client').trim(), p_title: f.get('title').trim(), p_preview: f.get('preview').trim(), p_due: f.get('due') || null });
  if (error) { $('#new-err').textContent = error.message; return; }
  $('#new-err').textContent = ''; e.target.reset(); e.target.closest('details').open = false;
  showCreated(data.slug, data.code);
  await loadList(); openProject(data.id);
});
function linkFor(slug) { return location.origin + location.pathname.replace(/admin\.html$/, '') + 'track.html#p=' + slug; }
function showCreated(slug, code) {
  $('#a-created').hidden = false; $('#c-link').value = linkFor(slug); $('#c-code').value = code;
}
$('#c-copy').addEventListener('click', async () => {
  const t = 'Track your website here: ' + $('#c-link').value + '\nYour access code: ' + $('#c-code').value;
  try { await navigator.clipboard.writeText(t); $('#c-copy').textContent = 'Copied'; } catch (x) { $('#c-copy').textContent = 'Copy failed, select and copy by hand'; }
  setTimeout(() => { $('#c-copy').textContent = 'Copy both'; }, 2500);
});

async function openProject(id) {
  current = id;
  const [p, steps, msgs] = await Promise.all([
    sb.from('projects').select('*').eq('id', id).single(),
    sb.from('project_steps').select('*').eq('project_id', id).order('position'),
    sb.from('project_messages').select('*').eq('project_id', id).order('created_at')
  ]);
  if (p.error) { fail(p.error.message); return; }
  renderDetail(p.data, steps.data || [], msgs.data || []);
  document.querySelectorAll('.a-item').forEach((b, i) => b.classList.toggle('on', projects[i] && projects[i].id === id));
}

function renderDetail(p, steps, msgs) {
  const d = $('#a-detail'); d.textContent = '';
  // project settings
  const stage = el('select', { name: 'status' }, ...STAGES.map(s => el('option', { value: s, textContent: s, selected: s === p.status })));
  const prog = el('input', { name: 'progress', type: 'range', min: 0, max: 100, step: 5, value: p.progress });
  const progOut = el('output', { textContent: p.progress + '%' });
  prog.addEventListener('input', () => { progOut.textContent = prog.value + '%'; });
  const form = el('form', { className: 'p-card a-form' },
    el('h2', { textContent: 'Project' }),
    el('div', { className: 'two' },
      el('label', { className: 'field' }, el('span', { textContent: 'Title' }), el('input', { name: 'title', value: p.title, required: true })),
      el('label', { className: 'field' }, el('span', { textContent: 'Client' }), el('input', { name: 'client_name', value: p.client_name, required: true })),
      el('label', { className: 'field' }, el('span', { textContent: 'Stage' }), stage),
      el('label', { className: 'field' }, el('span', { textContent: 'Launch date' }), el('input', { name: 'due_date', type: 'date', value: p.due_date || '' }))),
    el('label', { className: 'field' }, el('span', {}, 'Progress ', progOut), prog),
    el('label', { className: 'field' }, el('span', { textContent: 'Preview link' }), el('input', { name: 'preview_url', type: 'url', value: p.preview_url || '', placeholder: 'https://' })),
    el('div', { className: 'a-row' },
      el('button', { className: 'btn', type: 'submit', textContent: 'Save' }),
      el('a', { className: 'btn btn-ghost btn-sm', href: linkFor(p.slug), target: '_blank', rel: 'noopener', textContent: 'Open client page' }),
      el('button', { className: 'btn btn-ghost btn-sm', type: 'button', textContent: 'New access code', onclick: async () => {
        if (!confirm('Make a new code? The old code stops working.')) return;
        const { data, error } = await sb.rpc('admin_new_code', { p_id: p.id });
        if (error) fail(error.message); else showCreated(p.slug, data);
      } }),
      el('span', { className: 'mono small a-saved' })));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(form);
    const { error } = await sb.from('projects').update({ title: f.get('title'), client_name: f.get('client_name'), status: f.get('status'), progress: +f.get('progress'), preview_url: f.get('preview_url') || null, due_date: f.get('due_date') || null }).eq('id', p.id);
    $('.a-saved', form).textContent = error ? error.message : 'Saved';
    if (!error) loadList();
  });

  // steps
  const stepList = el('ul', { className: 'a-steps' });
  steps.forEach(s => {
    const cb = el('input', { type: 'checkbox', checked: s.done });
    cb.addEventListener('change', async () => { await sb.from('project_steps').update({ done: cb.checked }).eq('id', s.id); });
    const del = el('button', { type: 'button', className: 'a-x', textContent: '×', title: 'Remove step', onclick: async () => { await sb.from('project_steps').delete().eq('id', s.id); openProject(p.id); } });
    stepList.append(el('li', {}, el('label', {}, cb, ' ', s.title), del));
  });
  const addStep = el('form', { className: 'a-add' }, el('input', { name: 'title', placeholder: 'Add a step' }), el('button', { className: 'btn btn-sm', type: 'submit', textContent: 'Add' }));
  addStep.addEventListener('submit', async e => {
    e.preventDefault(); const t = addStep.title.value.trim(); if (!t) return;
    await sb.from('project_steps').insert({ project_id: p.id, title: t, position: steps.length + 1 }); openProject(p.id);
  });

  // conversation
  const thread = el('ol', { className: 'p-thread' });
  if (!msgs.length) thread.append(el('li', { className: 'p-empty', textContent: 'No messages yet.' }));
  msgs.forEach(m => {
    const head = el('div', { className: 'p-msg-head mono' }, el('b', { textContent: m.author === 'team' ? 'You (team)' : p.client_name }),
      el('span', { className: 'p-tag ' + m.kind, textContent: KIND[m.kind] + (m.kind === 'ticket' ? ' · ' + (m.status === 'closed' ? 'solved' : 'open') : '') }),
      el('time', { textContent: fmtTime(m.created_at) }));
    const li = el('li', { className: 'p-msg ' + m.author }, head, el('p', { textContent: m.body }));
    if (m.kind === 'ticket') li.append(el('button', { type: 'button', className: 'btn btn-ghost btn-sm', textContent: m.status === 'closed' ? 'Reopen ticket' : 'Mark solved', onclick: async () => {
      await sb.from('project_messages').update({ status: m.status === 'closed' ? 'open' : 'closed' }).eq('id', m.id); openProject(p.id); loadList();
    } }));
    thread.append(li);
  });
  const reply = el('form', { className: 'p-form' }, el('label', { className: 'field' }, el('span', { textContent: 'Reply to ' + p.client_name }), el('textarea', { name: 'body', rows: 3, maxLength: 4000 })), el('button', { className: 'btn', type: 'submit', textContent: 'Send reply' }));
  reply.addEventListener('submit', async e => {
    e.preventDefault(); const t = reply.body.value.trim(); if (!t) return;
    const { error } = await sb.from('project_messages').insert({ project_id: p.id, author: 'team', kind: 'message', body: t });
    if (error) fail(error.message); else { openProject(p.id); loadList(); }
  });

  d.append(form,
    el('section', { className: 'p-card' }, el('h2', { textContent: 'Steps the client sees' }), stepList, addStep),
    el('section', { className: 'p-card p-talk' }, el('h2', { textContent: 'Messages, tickets and comments' }), thread, reply));
}

start();
})();
