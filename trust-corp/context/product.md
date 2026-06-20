# 제품 현황 (Product / Portfolio)

> 기술·제품 상태 기준 문서. 변동 시 개발팀·기획팀이 갱신한다.

## A. trust-saas (핵심 제품) — `d:\Claude_Cowork\trust\trust-saas`
- **스택**: Next.js 16.2.7 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase(SSR) · `@anthropic-ai/sdk` · `docx` 9 · zustand
- **랜딩 포지셔닝**: "대체투자 실무를 위한 AI 서류 자동화·상담 플랫폼" (신탁사·시행사·시공사·증권사)

### Pillar 1 · 서류/계약서 자동화  ★최우선
- 엔진: `src/lib/engine/*`
  - `model.ts` `schema.ts` — 계약 폼 데이터 모델/스키마 (ContractForm, JointForm, DocId)
  - `clauses/body.ts`(33KB) `clauses/annex4.ts`(45KB) — **verbatim 조문/별지** (담보신탁 등)
  - `calc.ts` — 대출/한도 등 계산, `annex.ts` — 별지 조립
  - `docx/builders.js`(211KB, verbatim 포트) + `docx/index.ts` — DOCX/PDF 생성·미리보기 파사드
  - `ocr.ts` — 등기부 OCR 추출
- 현재 산출 서류: **담보신탁 7종 + 공동사업표준협약서**. `.docx` 다운로드 / PDF(인쇄) / HTML 미리보기.
- 입력 UI: `components/trust/*` — `Wizard`(단계형), `steps/*`(기본·당사자·물건·대출계산·서류), `JointForm`, `ContractsView`, `ChatPanel`(대화형 입력)
- 대화형 자동입력: `src/app/api/chat` + `src/lib/chat/formSchema.ts` + `src/lib/privacy/tokenize.ts`(PII 토큰화)

### Pillar 2 · 자연어 상담
- `src/app/api/advisor/route.ts` + `components/advisor/*` + `src/lib/advisor/{knowledge,retrieve}.ts` (대체투자 전문 코파일럿)

### 계정 / 저장 (멀티테넌트)
- Supabase: `organizations / profiles / contracts / conversations` + RLS (`supabase/migrations/0001_init.sql`)
- `src/lib/contracts.ts` (org 단위 계약 CRUD), `src/lib/supabase/*`, `middleware.ts`(인증 가드)
- 라우트: `/`(랜딩) `/app`(서류) `/advisor`(상담) `/login`

### 운영 방침 (2026-06-20 대표님 결정)
- **로컬 우선(local-first) 개발** — Supabase·이메일 로그인 **없이** 계약서 자동화 완성.
  - `middleware.ts`: 키 없으면 통과(로그인 게이트 없음). 앱 저장소 = `contractRepo.ts`(localStorage, 무계정).
  - 입력→미리보기→DOCX→"내 계약" 전 기능 브라우저만으로 완결. `contracts.ts`(Supabase)는 출시 단계 전까지 미사용.
  - 로컬 구동: `cd trust-saas && npx next dev --webpack` (Turbopack은 이 머신 OOM → webpack 사용)
- **1차 범위 = 담보신탁 단일**(CEO 추천 채택). 타사·타서류는 verbatim 양식 확보 후 확장.

### 상태 / 미완 (개발팀 확인 필요)
- (선택) ANTHROPIC_API_KEY — 상담/대화형 입력(Pillar 2)에만 필요. 결정론적 계약서 작성은 불필요.
- ⚠️ 미배포(호스팅 미연결, 대표님 보류). 로컬 검증에 집중.
- 서류 종류 확장은 출시 후. 1차는 담보신탁 단일 완성에 집중.

## B. trust-automatic (레거시 프로토타입) — `d:\Claude_Cowork\trust\trust-automatic`
- `한국투자부동산신탁_서류자동화.html` (349KB 단일 HTML) — 초기 PoC. trust-saas 엔진의 원천(verbatim 조문 출처).
- 신규 개발은 trust-saas에서. 이 폴더는 **조문 원본·참조용**으로만 사용.

## 로드맵 (기획팀 관할, 갱신 대상)
1. **계약서 자동화 서비스 1차 완성** — 핵심 계약서 종류 정의 → 엔진/UI 정비 → 미리보기·DOCX 검증
2. 배포 환경 확정 + `.env` 셋업 + 멀티테넌트 온보딩 플로우
3. 디자인 정비(랜딩·앱) → 마케팅 론칭
