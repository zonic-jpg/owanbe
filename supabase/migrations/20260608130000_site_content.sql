-- Content Studio store: a single JSON document of editable page content.
create table if not exists public.site_content (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;

-- Public can read published content; only super admins can write.
do $$ begin
  if not exists (select 1 from pg_policies where tablename='site_content' and policyname='site_content_read') then
    create policy site_content_read on public.site_content for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='site_content' and policyname='site_content_write') then
    create policy site_content_write on public.site_content for all
      using (public.has_role(auth.uid(), 'super_admin'))
      with check (public.has_role(auth.uid(), 'super_admin'));
  end if;
end $$;

insert into public.site_content (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;
