-- ================================================================
-- trust-saas 초기 스키마 (멀티테넌트 + 계약 저장)
-- Supabase SQL Editor 에 붙여넣어 실행하세요.
-- ================================================================

-- 1) 조직 (멀티테넌트 루트) ----------------------------------------
create table if not exists public.organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default '내 조직',
  company_type text not null default 'trust', -- trust/developer/contractor/securities/asset_mgmt/etc
  plan         text not null default 'free',  -- free/pro/team
  created_at   timestamptz not null default now()
);

-- 2) 프로필 (auth.users 1:1, 조직 소속) -----------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  org_id     uuid references public.organizations(id) on delete set null,
  email      text,
  role       text not null default 'owner', -- owner/member
  created_at timestamptz not null default now()
);

-- 3) 계약 (form_data = 클라이언트 contractStore 직렬화) --------------
create table if not exists public.contracts (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  doc_type   text not null,                 -- collateral/joint/fund...
  category   text,                          -- new/inProgress/settlement
  status     text not null default 'draft', -- draft/completed
  title      text not null default '제목 없음',
  form_data  jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contracts_org_idx on public.contracts(org_id);
create index if not exists contracts_owner_idx on public.contracts(owner_id);

-- 4) 상담/대화 이력 (선택) -----------------------------------------
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  kind        text not null default 'advisor', -- advisor/extract
  messages    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ================================================================
-- 신규 가입 시 조직+프로필 자동 생성
-- ================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_org uuid;
begin
  insert into public.organizations (name) values (coalesce(new.email, '내 조직'))
    returning id into new_org;
  insert into public.profiles (id, org_id, email, role)
    values (new.id, new_org, new.email, 'owner');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ================================================================
-- RLS — 조직 단위 격리
-- ================================================================
alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;
alter table public.contracts     enable row level security;
alter table public.conversations enable row level security;

-- 현재 사용자의 org_id 헬퍼
create or replace function public.current_org_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select org_id from public.profiles where id = auth.uid() $$;

-- profiles: 본인 행만
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- organizations: 내 조직만 조회
drop policy if exists orgs_member on public.organizations;
create policy orgs_member on public.organizations
  for select using (id = public.current_org_id());

-- contracts: 같은 조직 멤버가 CRUD
drop policy if exists contracts_org on public.contracts;
create policy contracts_org on public.contracts
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- conversations: 본인 것만
drop policy if exists conv_owner on public.conversations;
create policy conv_owner on public.conversations
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
