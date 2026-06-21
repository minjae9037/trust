-- ================================================================
-- 상담(Pillar 2) 시맨틱 캐시 런타임 적립 테이블
-- Supabase SQL Editor 에서 1회 실행. (없어도 정적 FAQ 캐시는 동작)
--
-- 동작: /api/advisor 가 캐시 미스로 새 답을 생성하면 여기에 적립하고,
--       이후 같은·유사 질문은 LLM 호출 없이 이 테이블에서 즉답한다.
-- 접근: 서버의 admin(서비스 키) 클라이언트만 사용 → RLS 활성+무정책으로
--       anon/공개 접근은 차단(서비스 키는 RLS 우회).
-- ================================================================

create table if not exists public.advisor_cache (
  id          uuid primary key default gen_random_uuid(),
  q           text not null,                 -- 원 질문(최대 1000자 저장)
  answer      text not null,                 -- 생성된 답변 전문
  sources     jsonb default '[]'::jsonb,     -- 일반화된 출처 칩
  hits        int  not null default 0,       -- (예약) 재사용 횟수
  created_at  timestamptz not null default now()
);

create index if not exists advisor_cache_created_idx
  on public.advisor_cache (created_at desc);

alter table public.advisor_cache enable row level security;
-- 정책을 두지 않음 → anon/authenticated 직접 접근 불가. 서버 서비스 키만 접근.
