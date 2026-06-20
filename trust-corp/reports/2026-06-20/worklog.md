# 24시간 연속 개발 워크로그 — 2026-06-20

> 형식: `- HH:MM [팀] 작업 / 검증결과 / 다음스텝`. 연속 워커가 iteration마다 append.

- 23:44 [개발] **열린 P0: 우선수익자 복수(2인) 본문 표/날인 전원 표기 — 검증 완료(코드 무결, 신규 회귀 가드 추가).**
  - 작업: `trust-saas/scripts/verify-multiparty.mjs` 신규. 시나리오=위탁자 2인+우선수익자 2인(인허가 위탁자명의·3분의2). 미리보기/계약서·신청서 HTML과 **실제 DOCX 바이트(jszip로 word/document.xml 추출)** 양쪽에서 당사자 고유 이름·1·2순위 라벨·우선수익권금액(₩6,000,000,000 / ₩3,600,000,000)·날인 페이지 전원 표기를 단언.
  - 검증결과: **26/26 PASS** (HTML 계약서 8, HTML 신청서 6, DOCX 계약서 6, DOCX 신청서 6). `npx tsc --noEmit` **EXIT 0**(green). 엔진은 `getAnnex2Data`·별첨2/신청서 날인 모두 `forEach` 전원 순회 → 복수 우선수익자/위탁자 누락 없음 확인.
  - 근거: builders.js 별첨2 DOCX(:933)·HTML(:2074), 신청서 날인 DOCX(:1709)·HTML(:1815), 계약서 서명란(:2025, 위탁자 전원·우선수익자는 담보신탁 비서명당사자라 별첨2 표기로 정확).
  - 다음스텝: (사업팀) 본 산출 DOCX로 verbatim 실물 대조 마감. (개발) 공동순위(동순위) 라벨은 `priorityRankLabel` 향후 확장 사항(현재 단순 N순위) — 별도 백로그.

- 23:52 [개발] **TrustForm 브랜드를 앱 셸 전체에 일관 적용 (C2 ceo-brief 대표님 결정 #1 미반영분 마감).**
  - 작업: 랜딩·메타데이터는 이미 TrustForm이나 **앱 헤더(topbar)들이 구브랜드 잔존**이라 통일. `TrustApp.tsx`("대체투자 서류·상담 플랫폼/신탁 서류 자동화 시스템"→ **TrustForm / 트러스트폼 · 신탁 서류 자동화**), `AdvisorApp.tsx`("대체투자 상담 코파일럿/PF·신탁…"→ **TrustForm / 트러스트폼 · 대체투자 상담 코파일럿**), `login/page.tsx` 서브타이틀(→ **TrustForm 트러스트폼 ·** 대체투자 서류·상담 플랫폼). 브랜드명을 1차 로고텍스트로 통일하고 맥락설명은 brand-sub로 이동. 信託(신탁 인장) 글리프는 의미 있는 로고마크로 유지.
  - 검증결과: `npx tsc --noEmit` **EXIT 0** / `npx next build` **EXIT 0**(전 라우트 컴파일·정적생성 정상). `next dev -p 3100` 구동 후 `/app` 헤더 스크린샷으로 "TrustForm · 트러스트폼 · 신탁 서류 자동화" 렌더 **가시 확인**(콘솔 에러는 favicon 404 기존 이슈뿐, 변경 무관).
  - 근거/범위: 텍스트 표기만 변경(기능·조문·엔진 무손상). 디자인 토큰(`--c-brown` 등)은 이미 공통 사용 중이라 별도 토큰화 불요.
  - 다음스텝: (마케팅) 상표(KIPRIS 35·42류)·도메인 trustform 정식 조회는 미결(추정 리스크). (개발 후보) `loadContract` 얕은머지로 구버전 저장본 로드 시 `validate.ts`의 `c.appform` 접근 잠재 크래시 — 방어적 옵셔널체이닝 별도 iteration 권장.

- 23:55 [개발] **구버전 저장본 로드 시 검증 크래시(잠재 P1 버그) 수정 — 직전 iteration 다음스텝 마감.**
  - 문제: `loadContract`가 `{ ...blankContractForm(), ...row.form_data }` **얕은 스프레드**라, 구버전/부분 저장본의 `docContents`가 일부 서류 키(`appform`·`valReport` 등)를 누락하면 그대로 비어 들어옴. `validate.ts`가 `c.appform.valuationPrice`처럼 직접 접근 → `c.appform` undefined 시 **TypeError로 DocStep 렌더 전체 크래시**(validateDoc는 DocStep useMemo에서 매 렌더 호출).
  - 작업(2파일): ①`engine/validate.ts` — `docContents ?? {}` + `c.appform?.valuationPrice`·`c.valReport?.principalValue` 옵셔널 체이닝(크래시 직접 가드). ②`store/contractStore.ts` `loadContract` — docContents를 한 단계 더 병합(`{ ...base.docContents, ...(loaded.docContents ?? {}) }`)해 **모든 서류 키 기본구조 복원**(근본원인). 저장본 값은 보존(병합 우선). +회귀 가드 `scripts/verify-loadcontract-merge.mjs` 신규.
  - 검증결과: 회귀 가드 **15/15 PASS**(키 누락 폼·docContents 자체 undefined에도 throw 없음, 누락필드 정상 보고, 병합 후 7개 서류 키 전부 복원·저장본 값 보존). `npx tsc --noEmit` **EXIT 0** / `npx next build` **EXIT 0**(전 8라우트 정상). 조문·엔진 무손상(입력값 검증/머지 로직만 변경).
  - 다음스텝: (개발 후보) `loadContract`의 trustors/priorities/properties 배열도 길이 0 저장본 방어 검토(현재 미발생). (사업) verbatim 실물 대조 마감 대기. (마케팅) 상표·도메인 조회 미결.

- 00:03 [개발] **미저장 변경(dirty) 추적 — end-to-end 데이터 유실 방지 (C2 "전체 플로우 손질" P0 마감분).**
  - 문제: localStorage 단일·무자동저장 구조라, 저장 후에도 SaveBar가 "✓ 저장됨"을 계속 유지 → 사용자가 추가 편집분을 저장된 것으로 오인. 처음으로 가기(`reset`)·탭 닫기·새로고침 시 입력이 **조용히 유실**되는 잠재 손실 경로(데이터 무결성 갭).
  - 작업(2파일): ①`store/contractStore.ts` — `savedHash`(저장/불러오기 시점 form 스냅샷) 상태 + `markSaved()` 추가, `loadContract`는 불러온 직후를 기준선으로 기록, `reset`은 null로 리셋. 순수 헬퍼 `isFormDirty(form, savedHash)` export(빈 양식 미저장은 노이즈 방지로 false). ②`TrustApp.tsx` — SaveBar에 dirty 표시(`● 저장되지 않은 변경` ↔ `✓ 저장됨`), 저장 성공 시 `markSaved()`, dirty일 때 `beforeunload` 이탈 경고, `goHome()`은 위저드에서 미저장이면 `confirm` 가드. (조문·엔진·DOCX 무손상 — 저장상태 UX만.)
  - 검증결과: 신규 회귀 가드 `scripts/verify-dirty-tracking.mjs` **7/7 PASS**(빈양식 false·입력 true·저장후 false·재편집 true·불러오기 기준선 false·reset false). `npx tsc --noEmit` **EXIT 0** / `npx next build` **EXIT 0**(전 8라우트). `next dev -p 3100`+Playwright로 **실동작 가시 확인**: 위저드 진입(무표시)→위탁자명 입력 시 `● 저장되지 않은 변경` 표출→💾 저장 클릭 시 `✓ 저장됨` 전환(스크린샷 `dirty-saved-state.png`). 콘솔 에러는 favicon 404 기존 이슈뿐(변경 무관).
  - 다음스텝: (개발 후보) 내 계약↔위저드 뷰 전환 시에도 dirty면 가드 적용 검토(현재 form은 뷰 전환에 보존되나, 다른 계약 열기 시 경고 부재). (사업) verbatim 실물 대조 마감 대기. (마케팅) 상표·도메인 조회 미결.
