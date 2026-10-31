-- laylatul-code client portal: run this once in Supabase > SQL Editor > New query.
-- Tables are locked (row level security on, no public policies). Clients only get in through the
-- portal_get / portal_post functions, which check the project's access code. The owner gets full access by
-- signing in on admin.html with an email listed in public.admins.

create extension if not exists pgcrypto;

-- ---------- tables ----------
create table if not exists public.admins (
  email text primary key
);

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,                  -- the private part of the client's link
  code_hash   text not null,                         -- the 6-digit access code, hashed
  client_name text not null,
  title       text not null,
  status      text not null default 'Planning',      -- shown to the client as the current stage
  progress    int  not null default 0 check (progress between 0 and 100),
  preview_url text,
  due_date    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.project_steps (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title      text not null,
  done       boolean not null default false,
  position   int not null default 0
);

create table if not exists public.project_messages (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author     text not null check (author in ('client', 'team')),
  kind       text not null check (kind in ('message', 'ticket', 'comment')),
  body       text not null check (char_length(body) between 1 and 4000),
  status     text check (status in ('open', 'closed')),   -- tickets only
  created_at timestamptz not null default now()
);
create index if not exists project_messages_project on public.project_messages(project_id, created_at);

-- failed code attempts, so nobody can guess a code by trying all of them
create table if not exists public.portal_attempts (
  slug       text not null,
  at         timestamptz not null default now()
);
create index if not exists portal_attempts_slug on public.portal_attempts(slug, at);

alter table public.admins           enable row level security;
alter table public.projects         enable row level security;
alter table public.project_steps    enable row level security;
alter table public.project_messages enable row level security;
alter table public.portal_attempts  enable row level security;

-- ---------- who is an admin ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

drop policy if exists admin_all on public.projects;
create policy admin_all on public.projects for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.project_steps;
create policy admin_all on public.project_steps for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.project_messages;
create policy admin_all on public.project_messages for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_read on public.admins;
create policy admin_read on public.admins for select to authenticated using (public.is_admin());

-- ---------- client access ----------
-- checks a client's code and answers 'ok:<project id>', 'wrong' or 'locked'. It never raises an error, so each
-- failed try is kept: after 8 wrong codes in 15 minutes the link pauses for 15 minutes.
create or replace function public.portal_auth(p_slug text, p_code text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare p public.projects;
begin
  if (select count(*) from public.portal_attempts where slug = p_slug and at > now() - interval '15 minutes') >= 8 then
    return 'locked';
  end if;
  select * into p from public.projects where slug = p_slug;
  if p.id is null or p.code_hash <> crypt(coalesce(p_code, ''), p.code_hash) then
    insert into public.portal_attempts(slug) values (p_slug);
    return 'wrong';
  end if;
  delete from public.portal_attempts where slug = p_slug;
  return 'ok:' || p.id;
end $$;
revoke all on function public.portal_auth(text, text) from public, anon, authenticated;

create or replace function public.portal_get(p_slug text, p_code text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare r text; p public.projects;
begin
  r := public.portal_auth(p_slug, p_code);
  if r = 'locked' then return json_build_object('error', 'too_many_attempts'); end if;
  if r = 'wrong'  then return json_build_object('error', 'wrong_code'); end if;
  select * into p from public.projects where id = substring(r from 4)::uuid;
  return json_build_object(
    'project', json_build_object('client_name', p.client_name, 'title', p.title, 'status', p.status, 'progress', p.progress,
                                 'preview_url', p.preview_url, 'due_date', p.due_date, 'updated_at', p.updated_at),
    'steps', coalesce((select json_agg(json_build_object('title', s.title, 'done', s.done) order by s.position)
                       from public.project_steps s where s.project_id = p.id), '[]'::json),
    'messages', coalesce((select json_agg(json_build_object('author', m.author, 'kind', m.kind, 'body', m.body, 'status', m.status, 'created_at', m.created_at) order by m.created_at)
                          from public.project_messages m where m.project_id = p.id), '[]'::json)
  );
end $$;

create or replace function public.portal_post(p_slug text, p_code text, p_kind text, p_body text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare r text; v_id uuid;
begin
  r := public.portal_auth(p_slug, p_code);
  if r = 'locked' then return json_build_object('error', 'too_many_attempts'); end if;
  if r = 'wrong'  then return json_build_object('error', 'wrong_code'); end if;
  v_id := substring(r from 4)::uuid;
  if p_kind not in ('message', 'ticket', 'comment') then return json_build_object('error', 'bad_kind'); end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 or char_length(p_body) > 4000 then return json_build_object('error', 'bad_body'); end if;
  if (select count(*) from public.project_messages where project_id = v_id and author = 'client' and created_at > now() - interval '1 hour') >= 30 then
    return json_build_object('error', 'too_many_messages');
  end if;
  insert into public.project_messages(project_id, author, kind, body, status)
  values (v_id, 'client', p_kind, trim(p_body), case when p_kind = 'ticket' then 'open' end);
  return json_build_object('ok', true);
end $$;

grant execute on function public.portal_get(text, text)              to anon, authenticated;
grant execute on function public.portal_post(text, text, text, text) to anon, authenticated;

-- ---------- owner tools ----------
-- creates a project and returns its link part and access code (the code is only shown this once)
create or replace function public.admin_create_project(p_client text, p_title text, p_preview text, p_due date) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_slug text; v_code text; v_id uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  v_slug := translate(encode(gen_random_bytes(9), 'base64'), '+/=', 'xyz');
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  insert into public.projects(slug, code_hash, client_name, title, preview_url, due_date)
  values (v_slug, crypt(v_code, gen_salt('bf')), p_client, p_title, nullif(p_preview, ''), p_due)
  returning id into v_id;
  insert into public.project_steps(project_id, title, position) values
    (v_id, 'Brief and price agreed', 1), (v_id, 'Design', 2), (v_id, 'Build', 3), (v_id, 'Your review and changes', 4), (v_id, 'Launch', 5);
  return json_build_object('id', v_id, 'slug', v_slug, 'code', v_code);
end $$;

-- gives a project a fresh access code (if a client loses theirs); returns it once
create or replace function public.admin_new_code(p_id uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_code text;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  update public.projects set code_hash = crypt(v_code, gen_salt('bf')), updated_at = now() where id = p_id;
  return v_code;
end $$;

grant execute on function public.admin_create_project(text, text, text, date) to authenticated;
grant execute on function public.admin_new_code(uuid) to authenticated;

-- keep updated_at fresh
create or replace function public.touch_project() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects for each row execute function public.touch_project();

-- ---------- last step: make yourself the admin (use the email you signed up with in Authentication > Users) ----------
-- insert into public.admins(email) values ('you@example.com');
