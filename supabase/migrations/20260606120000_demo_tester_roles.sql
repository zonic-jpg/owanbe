-- One-tap tester logins: attach user / brand / admin role to the demo accounts.
-- Apply once (Supabase SQL editor or `supabase db push`).
-- NOTE: enum literals below ('approved','monthly','active') assume your enums use
-- those values — adjust if your brand_status / subscription_plan / subscription_status differ.

create or replace function public.ensure_demo_role(_role public.app_role)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  uemail text;
  bid uuid;
begin
  if uid is null then
    return false;
  end if;

  select email into uemail from auth.users where id = uid;

  -- Only the demo accounts may self-assign a role.
  if uemail not in ('user@demo.local','brand@demo.local','admin@demo.local','test@demo.local') then
    return false;
  end if;

  -- Base role for everyone.
  if not exists (select 1 from public.user_roles where user_id = uid and role = 'user') then
    insert into public.user_roles (user_id, role) values (uid, 'user');
  end if;

  if _role = 'admin' then
    if not exists (select 1 from public.user_roles where user_id = uid and role = 'admin') then
      insert into public.user_roles (user_id, role) values (uid, 'admin');
    end if;

  elsif _role = 'brand' then
    if not exists (select 1 from public.user_roles where user_id = uid and role = 'brand') then
      insert into public.user_roles (user_id, role) values (uid, 'brand');
    end if;

    select id into bid from public.brands where owner_id = uid limit 1;
    if bid is null then
      insert into public.brands (owner_id, name, contact_email, status, approved_at)
      values (uid, 'Demo Brand', uemail, 'approved', now())
      returning id into bid;
    else
      update public.brands set status = 'approved', approved_at = coalesce(approved_at, now())
      where id = bid;
    end if;

    -- Active (waived) subscription so the brand dashboard is fully usable.
    if not exists (
      select 1 from public.brand_subscriptions
      where brand_id = bid and status = 'active' and period_end > now()
    ) then
      insert into public.brand_subscriptions (brand_id, plan, amount, status, period_end, is_waived)
      values (bid, 'monthly', 100000, 'active', now() + interval '365 days', true);
    end if;
  end if;

  return true;
end;
$$;

grant execute on function public.ensure_demo_role(public.app_role) to authenticated;
