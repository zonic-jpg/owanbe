-- ═══════════════════════════════════════════════════════════════════════════
-- SERVER-BACKED ADMINTESTER APPROVAL QUEUE
-- ---------------------------------------------------------------------------
-- Ported from MyYangaX migration 026 (commit 25e700d) because OwanbeX shipped
-- the identical defect:
--
--   src/lib/adminTesterApproval.ts kept the whole queue in `localStorage`.
--   queuePendingApproval() wrote the pending row to the REQUESTER's browser,
--   and AdminTesterQueue read `listPendingQueue()` from the OWNER's browser.
--   Nothing was ever written server-side, so the owner's queue was
--   structurally always empty and no tester could ever be approved.
--
-- The queue now lives here. Every path goes through a security-definer RPC so
-- the table itself never needs to be writable by anon.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.admin_access_requests (
  id bigserial primary key,
  email text not null,
  identity text,
  app text not null default 'owanbe',
  status text not null default 'pending' check (status in ('pending','approved','revoked')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  note text
);

create unique index if not exists admin_access_requests_email_app
  on public.admin_access_requests (lower(email), app);

alter table public.admin_access_requests enable row level security;

-- Admins read the queue directly; everyone else only ever sees their own
-- status, and only through admin_access_status().
drop policy if exists admin_access_requests_admin_read on public.admin_access_requests;
create policy admin_access_requests_admin_read on public.admin_access_requests
  for select using (public.is_admin(auth.uid()));

comment on table public.admin_access_requests is
  'Cross-device ADMINTESTER approval queue. Written via request_admin_access(), decided via decide_admin_access().';

-- ── Owner identity ─────────────────────────────────────────────────────────
create or replace function public.founding_owner_email()
returns text language sql stable set search_path = public as $$
  select 'oadeagbo@gmail.com'::text;
$$;

-- ── Ask for access ─────────────────────────────────────────────────────────
-- Callable by anon: a tester using a shared orbit password has no session yet,
-- which is precisely why the old localStorage-only queue never reached the
-- owner. Asking never reveals anything about the platform.
create or replace function public.request_admin_access(
  _email text,
  _identity text default null,
  _app text default 'owanbe'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(_email, '')));
  v_app   text := coalesce(nullif(trim(coalesce(_app, '')), ''), 'owanbe');
  v_row   public.admin_access_requests%rowtype;
begin
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid email address is required to request access';
  end if;
  if v_email = public.founding_owner_email() then
    return jsonb_build_object('status', 'owner', 'email', v_email);
  end if;

  select * into v_row from public.admin_access_requests
   where lower(email) = v_email and app = v_app;

  if v_row.id is null then
    insert into public.admin_access_requests (email, identity, app)
    values (v_email, nullif(trim(coalesce(_identity, '')), ''), v_app)
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'status', v_row.status,
    'email', v_row.email,
    'requested_at', v_row.requested_at
  );
end $$;

-- ── Check your own status ──────────────────────────────────────────────────
-- Lets a tester find out they have been approved without exposing the table.
create or replace function public.admin_access_status(
  _email text,
  _app text default 'owanbe'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(_email, '')));
  v_app   text := coalesce(nullif(trim(coalesce(_app, '')), ''), 'owanbe');
  v_row   public.admin_access_requests%rowtype;
begin
  if v_email = '' then
    return jsonb_build_object('status', 'none');
  end if;
  if v_email = public.founding_owner_email() then
    return jsonb_build_object('status', 'owner', 'email', v_email);
  end if;

  select * into v_row from public.admin_access_requests
   where lower(email) = v_email and app = v_app;

  if v_row.id is null then
    return jsonb_build_object('status', 'none', 'email', v_email);
  end if;
  return jsonb_build_object(
    'status', v_row.status,
    'email', v_row.email,
    'requested_at', v_row.requested_at,
    'decided_at', v_row.decided_at
  );
end $$;

-- ── Read the queue (admins) ────────────────────────────────────────────────
create or replace function public.list_admin_access_requests(_app text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Admin sign-in required to read the approval queue';
  end if;
  return jsonb_build_object(
    'pending', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.requested_at desc), '[]'::jsonb)
      from public.admin_access_requests r
      where r.status = 'pending' and (_app is null or r.app = _app)
    ),
    'approved', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.decided_at desc nulls last), '[]'::jsonb)
      from public.admin_access_requests r
      where r.status = 'approved' and (_app is null or r.app = _app)
    ),
    'revoked', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.decided_at desc nulls last), '[]'::jsonb)
      from public.admin_access_requests r
      where r.status = 'revoked' and (_app is null or r.app = _app)
    )
  );
end $$;

-- ── Approve / reject (owner only) ──────────────────────────────────────────
-- Approving also grants the real Supabase account for that email the admin
-- role and permission set, so "approved" means the tester can actually work
-- rather than just clearing a client-side flag.
create or replace function public.decide_admin_access(
  _email text,
  _decision text,
  _app text default 'owanbe'
) returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_email  text := lower(trim(coalesce(_email, '')));
  v_app    text := coalesce(nullif(trim(coalesce(_app, '')), ''), 'owanbe');
  v_status text;
  v_row    public.admin_access_requests%rowtype;
  v_uid    uuid;
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Only the super admin can approve or reject admin access';
  end if;
  if v_email = '' then
    raise exception 'A valid email address is required';
  end if;
  if v_email = public.founding_owner_email() then
    raise exception 'The founding super admin never needs approval';
  end if;

  v_status := case lower(trim(coalesce(_decision, '')))
    when 'approve'  then 'approved'
    when 'approved' then 'approved'
    when 'reject'   then 'revoked'
    when 'revoke'   then 'revoked'
    when 'revoked'  then 'revoked'
    else null
  end;
  if v_status is null then
    raise exception 'Decision must be approve or reject';
  end if;

  insert into public.admin_access_requests (email, app, status, decided_at, decided_by)
  values (v_email, v_app, v_status, now(), auth.uid())
  on conflict (lower(email), app) do update
    set status     = excluded.status,
        decided_at = excluded.decided_at,
        decided_by = excluded.decided_by
  returning * into v_row;

  -- Mirror the decision onto the real account when one exists.
  select id into v_uid from auth.users where lower(email) = v_email;
  if v_uid is not null then
    if v_status = 'approved' then
      perform public.grant_reviewer_admin(v_uid, auth.uid());
    else
      delete from public.admin_permissions where user_id = v_uid;
      delete from public.user_roles where user_id = v_uid and role in ('admin', 'super_admin');
    end if;
    insert into public.role_audit_log (actor_id, target_user_id, action, role)
    values (auth.uid(), v_uid, 'admin_access_' || v_status, 'admin');
  end if;

  return jsonb_build_object('ok', true, 'email', v_row.email, 'status', v_row.status);
end $$;

grant execute on function public.founding_owner_email() to anon, authenticated;
grant execute on function public.request_admin_access(text, text, text) to anon, authenticated;
grant execute on function public.admin_access_status(text, text) to anon, authenticated;
grant execute on function public.list_admin_access_requests(text) to authenticated;
grant execute on function public.decide_admin_access(text, text, text) to authenticated;
