# trust-saas 설정

## 1. 개발 실행
```
npm install
npm run dev   # http://localhost:3000
```
- `/` 랜딩 · `/app` 서류 자동화 · `/advisor` 상담 코파일럿

## 2. 환경변수 (`.env.local`)
```
ANTHROPIC_API_KEY=sk-ant-...        # 상담·추출 (서버 전용)
NEXT_PUBLIC_SUPABASE_URL=...        # 계정·저장 (Phase 3)
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SECRET_KEY=...             # service_role (신뢰 작업용)
```

## 3. Supabase 프로젝트 (Phase 3 — 계정/저장)
1. https://supabase.com → New project (trust-saas 전용)
2. **SQL Editor** → `supabase/migrations/0001_init.sql` 전체 붙여넣고 Run
   - 테이블(organizations/profiles/contracts/conversations) + RLS + 가입 트리거 생성
3. **Project Settings → API** 에서 키 복사 → `.env.local`
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role → `SUPABASE_SECRET_KEY`
4. (테스트 편의) **Authentication → Providers → Email** 에서
   "Confirm email" 끄면 가입 즉시 로그인 가능
5. `npm run dev` 재시작 → `/login` 가입 → `/app` 에서 작성 후 💾 저장 → "내 계약" 에서 재개

## 아키텍처
- **Pillar 1 서류 자동화**: `src/lib/engine/*` (verbatim 포트 엔진) + `src/components/trust/*`
- **Pillar 2 상담**: `src/app/api/advisor` (스트리밍) + `src/components/advisor/*`
- **Claude 추출**: `src/app/api/chat` + `src/lib/chat` + `src/lib/privacy` (PII 토큰화)
- **계정/저장**: `src/lib/supabase/*` + `src/lib/contracts.ts` + `supabase/migrations`
