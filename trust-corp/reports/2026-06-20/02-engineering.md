# 개발 일일 — 2026-06-20

## 빌드/플로우 상태 (정상/이슈)
- **빌드: 정상** `npm run build` 성공 (Next.js 16.2.7, Turbopack). 컴파일 7.2s, TypeScript 6.2s, 정적 8/8 생성. 타입/린트 에러 없음.
  - 라우트 정상: `/`, `/advisor`, `/app`, `/login`, `/api/advisor`(ƒ), `/api/chat`(ƒ).
- **핵심 플로우(입력→미리보기→DOCX): 정상** — Node QA 하네스로 브라우저 없이 11/11 PASS (아래 상세).
- **경고 2건(비차단, 추정 영향 없음)**:
  1. `middleware` 파일 컨벤션 deprecated → `proxy`로 변경 권고 (Next 16). 동작엔 영향 없음, 추후 리네임 권장.
  2. `package.json`에 `"type":"module"` 미지정 → builders.js를 ESM 재파싱 경고(런타임은 정상, Next 빌드엔 무관).

## 오늘 처리/진행 (팀장·차장·과장·대리 분담별)
- **대리(QA/통합)** — ★P0 end-to-end 검증. 브라우저 의존(window/document/Blob/URL) 엔진을 Node에서 검증하는 재사용 하네스 작성:
  - `scripts/e2e-engine-test.mjs` (샘플 입력 1세트 + 미리보기/DOCX 캡처)
  - `scripts/ts-ext-loader.mjs` (확장자 없는 .ts import 해석 로더)
  - 실행: `node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/e2e-engine-test.mjs`
- **차장(엔진/백엔드)** — 엔진 경로 점검: `docx/index.ts`(파사드) → `docx/builders.js`(211KB verbatim 포트) → `clauses/body.ts`·`annex4.ts`·`schema.ts` 연결 정상 확인. 담보신탁계약서 DOCX에서 제2~26조+별첨2/3 및 입력 당사자(샘플시행/○○신용협동조합) 반영 검증.
- **과장(프론트)** — 위저드 구조 확인: `STEPS`(탭1 관계사·탭2 조건·탭3 서류 7종) + `DOC_FIELDS` 서류별 필드 정의 정상. 입력 모델 `blankContractForm`/`blankJointForm`과 스키마 정합. (UI 런타임 클릭 검증은 P0에선 엔진 산출로 대체, 브라우저 e2e는 백로그.)
- **팀장(통합)** — 빌드+엔진 통합 게이트 통과 확인. 운영 기반(.env) 점검 및 본 보고 작성.

### P0 검증 결과 (11/11 PASS) — 최소 1개 서류군 입력→DOCX 성공 (완료기준 충족)
| 항목 | 결과 | 비고 |
|---|---|---|
| 미리보기 previewBody/Annex/Annex4 HTML | PASS×3 | len 7809/7502/6641 |
| 담보신탁 7종 DOCX (appform·contract·poa·valReport·boardMin·cdd·ubo) | PASS×7 | 전부 유효 OOXML(PK + word/document.xml), 11~28KB |
| 공동사업표준협약서 DOCX | PASS | 13.7KB, 유효 OOXML |

- 담보신탁계약서(contract) = 28.7KB로 최대(표지+31조 본문+서명란+별첨1~4 통합). verbatim 조문 조립·입력 주입 정상.

## 운영 기반 점검 (P1)
- **빌드**: 성공 (위 참조).
- **.env.local 키 현황** (값 마스킹):
  - `ANTHROPIC_API_KEY` = **SET** (상담/추출용, 서버 전용)
  - `NEXT_PUBLIC_SUPABASE_URL` = **EMPTY**
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = **EMPTY**
  - `SUPABASE_SECRET_KEY` = **EMPTY**
  - → Supabase 3종 미설정. 계약서 자동화(Pillar 1) 코어 산출은 Supabase 불필요(엔진 클라이언트사이드)라 P0 검증엔 무영향. **계정/저장(멀티테넌트)·"내 계약" 저장 기능은 Supabase 키 없이는 미동작** → 온보딩 전 셋업 필요(SETUP.md 절차 有, 대표님/사업팀 Supabase 프로젝트 생성 대기).
  - `.env*.local`은 `.gitignore`에 포함 → 키 유출 위험 없음.
- **임의 배포 없음** (가드레일 준수). 배포환경·브랜드명 대표님 결정 대기.

## 계약서 자동화 진척
- **Pillar 1 코어 = end-to-end 동작 검증 완료.** 담보신탁 7종 + 공동사업협약서 입력→미리보기→DOCX 산출 전 경로 정상. 막힌 지점(빌드/런타임 에러) **없음**.
- 출력 가능 서류 종류는 P2(사업팀 정의서)에서 확장 범위 확정 후 엔진/UI 작업 착수 예정.

## 미완·기술부채 우선순위
1. **(중) Supabase 키 미설정** — 멀티테넌트 계정/저장/온보딩 미동작. 대표님 Supabase 프로젝트 생성 + SETUP.md 3단계 → 키 주입 필요. *코어 검증엔 무영향이나 출시 전제.*
2. **(저) 브라우저 e2e 부재** — 현재 검증은 Node 엔진 산출 기준. 실제 위저드 클릭→다운로드 UI 경로는 Playwright e2e로 보강 권장(백로그). 단 DOCX 다운로드는 `window/document` a[download] 표준 방식이라 동작 신뢰도 높음(추정).
3. **(저) Next 16 deprecation** — `middleware`→`proxy` 리네임, `package.json type:module` 정리. 비차단.
4. **(저) 산출물 워터마크** — DOCX 하단 "표준양식 적용 전 시스템 자동 생성 임시 출력물" 문구 존재. 정식 출시 시 제거/대체 정책 필요(사업팀 협의).

## 다음 액션
- [개발팀] P2 정의서 확정 시 서류 종류 확장 착수 (전제: 사업팀 산출).
- [대표님/사업팀] Supabase 전용 프로젝트 생성 → SETUP.md대로 키 주입 (저장/온보딩 활성화).
- [개발팀] (선택) `middleware→proxy` 리네임 + e2e 하네스 CI화 — 검증 후 보고로 제안(임의 배포 금지).

## alerts
- 없음. (빌드 성공, 핵심 플로우 정상, 조문 정확성 결함·보안 취약점 미발견)
