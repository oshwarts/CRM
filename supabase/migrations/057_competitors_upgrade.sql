-- Competitor activity, structured: a managed list of competitors (with a battlecard), and richer records — the outcome
-- (open / won / lost + reason), contract end, tender, the doctor's loyalty, prices and pictures of evidence.
create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  products text not null default '',
  description text not null default '',
  strengths text not null default '',
  weaknesses text not null default '',
  our_answer text not null default '',
  reps text not null default '',
  website text not null default '',
  learn_topic_id uuid references public.learn_topics (id) on delete set null,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists competitors_name_key on public.competitors (lower(btrim(name)));
create index if not exists competitors_learn_topic_idx on public.competitors (learn_topic_id) where learn_topic_id is not null;

alter table public.competitors enable row level security;
create policy active_users_only on public.competitors as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
create policy competitors_read on public.competitors for select to authenticated using (true);
create policy competitors_admin_write on public.competitors for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create trigger competitors_updated_at before update on public.competitors for each row execute function public.set_updated_at();
create trigger audit_competitors after insert or update or delete on public.competitors for each row execute function public.audit_row();

alter table public.competitor_intel
  add column if not exists competitor_id uuid references public.competitors (id) on delete set null,
  add column if not exists outcome text not null default 'open' check (outcome in ('open', 'won', 'lost')),
  add column if not exists loss_reason text not null default '',
  add column if not exists contract_end date,
  add column if not exists tender_name text not null default '',
  add column if not exists tender_due date,
  add column if not exists loyalty text not null default '' check (loyalty in ('', 'loyal', 'open', 'leaning')),
  add column if not exists price_per_case numeric,
  add column if not exists implant_price numeric,
  add column if not exists payment_terms text not null default '',
  add column if not exists image_paths text[] not null default '{}';
create index if not exists competitor_intel_competitor_idx on public.competitor_intel (competitor_id);
create index if not exists competitor_intel_hospital_idx on public.competitor_intel (hospital_id);
create index if not exists competitor_intel_doctor_idx on public.competitor_intel (doctor_id);
create index if not exists competitor_intel_contract_idx on public.competitor_intel (contract_end) where contract_end is not null;

-- the first list: the other companies of the system, the names already written in records, and the makers of the robots
insert into public.competitors (name, products, sort)
select distinct on (lower(btrim(n))) btrim(n), p, 0
from (
  select name as n, '' as p from public.companies where lower(name) not like 'ami%'
  union all select competitor, '' from public.competitor_intel where btrim(competitor) <> ''
  union all select 'Zimmer Biomet', 'ROSA'
) s
on conflict do nothing;
update public.competitors set products = 'VELYS' where name = 'J&J' and products = '';

update public.competitor_intel i set competitor_id = c.id
from public.competitors c
where i.competitor_id is null and lower(btrim(i.competitor)) = lower(btrim(c.name));
