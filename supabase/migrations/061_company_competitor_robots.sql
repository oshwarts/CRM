-- Which robot(s) of the list of robotic systems a company, or a competitor, works with.
create table public.company_robotic_systems (
  company_id uuid not null references public.companies(id) on delete cascade,
  system_id uuid not null references public.robotic_systems(id) on delete cascade,
  primary key (company_id, system_id)
);
create table public.competitor_robotic_systems (
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  system_id uuid not null references public.robotic_systems(id) on delete cascade,
  primary key (competitor_id, system_id)
);
create index company_robotic_systems_system_idx on public.company_robotic_systems (system_id);
create index competitor_robotic_systems_system_idx on public.competitor_robotic_systems (system_id);

alter table public.company_robotic_systems enable row level security;
alter table public.competitor_robotic_systems enable row level security;
create policy company_robots_read on public.company_robotic_systems for select to authenticated using (true);
create policy company_robots_admin_write on public.company_robotic_systems for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy competitor_robots_read on public.competitor_robotic_systems for select to authenticated using (true);
create policy competitor_robots_admin_write on public.competitor_robotic_systems for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy active_users_only on public.company_robotic_systems as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
create policy active_users_only on public.competitor_robotic_systems as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

-- the pairs that are certain; the managers complete the rest in Settings / the competitor card
insert into public.company_robotic_systems (company_id, system_id)
select c.id, r.id from public.companies c join public.robotic_systems r
  on (lower(c.name) like 'ami%' and lower(r.name) = 'mako')
  or (lower(c.name) = 'j&j' and lower(r.name) = 'velys')
  or (lower(c.name) like 'zimmer%' and lower(r.name) like 'rosa%')
on conflict do nothing;

insert into public.competitor_robotic_systems (competitor_id, system_id)
select c.id, r.id from public.competitors c join public.robotic_systems r
  on (lower(c.name) = 'j&j' and lower(r.name) = 'velys')
  or (lower(c.name) like 'zimmer%' and lower(r.name) like 'rosa%')
on conflict do nothing;
