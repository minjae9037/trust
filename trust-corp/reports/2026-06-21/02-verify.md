# 02 verify (내부 검증) — 2026-06-21 02:04

> 모드: verify(내부, 대표님 보고 대상 아님). 어제(06-20) + 오늘 새벽(06-21 ~00:24) 산출물의 실동작·정확성 검증.
> 원칙: 사실 기반(추정 금지), 조문 verbatim. 실제 작업은 06 prep / 09 morning.

## 한 줄
빌드·타입·회귀가드 대부분 green이나, **새 STEP 05(계약 조건·특약) 추가가 worklog에 미기록 + 자체 회귀가드(doc-readiness) 적색(12/13)** 1건 발견. 정확성(verbatim) 가드레일은 통과.

## 검증 실행 결과 (trust-saas)
| 항목 | 결과 | 비고 |
|---|---|---|
| `npx tsc --noEmit` | **EXIT 0** | green |
| `npx next build` | **EXIT 0** | 전 8라우트 정적/생성 정상 |
| verify-multiparty | **26/26 PASS** | 위탁자2+우선수익자2, HTML+실제 DOCX 바이트 |
| verify-loadcontract-merge | **15/15 PASS** | 구버전 저장본 로드 크래시 가드 |
| verify-dirty-tracking | **9/9 PASS** | 유실 경로 3종(goHome/beforeunload/openContract) |
| verify-stepper-styling | **15/15 PASS** | 클래스 drift 정적 차단 |
| **verify-doc-readiness** | **12/13 FAIL** ⚠ | L82 `nonDoc===5` 하드코딩, 실제 6 — 신규 step 미반영 |

> ⚠ 실행 주의: 회귀가드는 `node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/<name>.mjs` 로만 동작(엔진이 확장자 없는 import 사용). 단독 `node scripts/x.mjs`는 모듈 해석 실패 → 거짓 적색. (이번 초기 실행에서 한 번 헛짚었다가 헤더 명시 명령으로 정정.)

## 발견 이슈 / 리스크
1. **[P1·회귀가드 적색] verify-doc-readiness 12/13 FAIL** — `Wizard`에 신규 **STEP 05 "계약 조건·특약(경우의 수)"**(StepConditions.tsx) 추가로 비서류 step이 5→6이 됐는데, 테스트가 `nonDoc.length === 5`로 하드코딩(`scripts/verify-doc-readiness.mjs:82`). **테스트가 stale**(기능은 정상, 가드만 미갱신). 적색 방치 시 향후 서류-step 회귀를 가린다. → 6으로 갱신(이상적으로 STEPS에서 파생). (개발팀, 06 prep)
2. **[프로세스] StepConditions 기능이 06-21 worklog 미기록** — 변경량 Wizard +98 / model.ts +39 / schema.ts ± / StepConditions.tsx 신규. worklog 마지막 항목은 00:24(stepper)로, 그 이후 추가된 이 iteration이 로그·백로그에 누락. 연속 워커 iteration 로깅 규율 이탈. → 09 morning 보고 전 worklog 보강. (개발팀)
3. **[정확성·OK→감시] conditions의 조문 연동 경계** — "조문 자동반영" 뱃지 4필드(`majorityCriteria·agentBank·includeArt21·builderName`)는 **이미 `annex.ts getAnnex4Options`가 읽던 검증된 키 재사용**(annex.ts:46–61 확인), 신규 8키(`collateralType·licenseType·onbid·feePayer·collateralOrder` 등)는 전부 **"프로파일 기록(조문 연동 예정)"으로 조문 텍스트 미접촉** → **추정 조문 0, verbatim 가드레일 준수.** 단, 향후 신규 8키를 조문에 연동할 때는 **반드시 표준양식(.docx) verbatim 수급 후** 진행(추정 금지). (사업팀 verbatim 대조 항목에 편입)

## 무이상 확인
- 엔진 정합: `annex.ts`가 docContents.contract의 4키를 정확히 읽음(StepConditions write 경로 `updateDocContent("contract", …)`와 일치). 복수 당사자·날인 전원 표기 회귀 없음(26/26).
- 콘솔 에러: favicon 404 기존 이슈만(변경 무관, P3).

## 다음(06 prep / 09 morning 인계)
- (개발) doc-readiness 가드 5→6 갱신 → 5종 전 가드 green 복구.
- (개발) StepConditions iteration worklog/백로그 사후 기록.
- (사업) 신규 8키 조문 연동 시 verbatim 표준양식 확보 — 대조 체크리스트에 추가.
