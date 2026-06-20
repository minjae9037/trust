# 개발 일일 — 2026-06-20-c2

## 빌드/플로우 상태 (정상/이슈)
- **타입체크 green**: `npx tsc --noEmit` → exit 0 (변경 전·후 동일).
- **프로덕션 빌드 green**: `npx next build` → exit 0, 8개 페이지 정상 생성 (`/`, `/app`, `/advisor`, `/login`, api 2종).
- **dev 구동 green**: `npx next dev --webpack -p 3100` 정상 서빙 (http 200, webpack 모드 — 머신 OOM 회피).
- **lint green**: 변경 파일 eslint exit 0.
- **핵심 플로우 end-to-end 라이브 검증 완료** (Playwright, localhost:3100):
  신탁사 선택 → 담보신탁 → 신규 → 마법사 입력 → **2분할 미리보기** → **검증 게이트** → DOCX 버튼 활성 → 저장 → 내 계약 목록 표시. JS 런타임 에러 0건.
- 잔여 콘솔 이슈: `favicon.ico` 404 1건(비기능, 정적자산 누락) — 우선순위 낮음.
- 빌드 경고: Next 16 `middleware` → `proxy` 컨벤션 deprecated 경고(동작 정상, 추정 출시 전 정리 필요).

## 오늘 처리/진행 (팀장·차장·과장·대리 분담별)
- **팀장(통합·리뷰)**: 미션 3건 분해·영역 분리(엔진=validate, UI=DocStep+CSS, QA=Playwright e2e). 변경 후 tsc/build/lint 게이트 통과 확인, 임의 배포 보류(로컬 검증까지만).
- **차장(엔진/백엔드)**: 신규 검증 모듈 `src/lib/engine/validate.ts` 작성 — `validateDoc(form, docId)`가 공통 필수(위탁자·우선수익자·대출금액·물건·체결일) + 서류별 필수(appform 신탁부동산가격, valReport 원본가액) 누락을 순수함수로 산정. **verbatim 조문은 미변경**(입력값 완결성만 검사). 기존 facade의 `previewBodyHTML`/`previewAnnexHTML`이 이미 노출돼 있어 재활용.
- **과장(프론트)**: `src/components/trust/steps/DocStep.tsx`를 **좌(입력)/우(실시간 미리보기) 2분할**로 재구성. `useMemo`로 form 변경 시 본문·별지 미리보기 즉시 렌더(`dangerouslySetInnerHTML`). 검증 미충족 시 누락 안내 박스 + DOCX/PDF 버튼 `disabled`. `globals.css`에 `.doc-split`/`.doc-split-preview`/`.preview-*`/`.validate-*` 추가(반응형: ≤1080px 1열, 미리보기 상단 배치).
- **대리(QA/통합)**: Playwright로 게이트 3상태 검증 — (1)빈상태=게이트표시·버튼disabled·누락4건, (2)부분입력=누락 1건으로 정확히 축소, (3)완전입력=게이트 숨김·버튼활성. 미리보기에 위탁자명 자동 치환 확인. 저장→localStorage 1행 기록(`✓ 저장됨`)→내 계약 목록·열기 버튼 노출 확인.

## 계약서 자동화 진척
- **M2-1 미리보기 UI 연결**: 완료. DocStep 2분할, `previewBodyHTML`+`previewAnnexHTML` 렌더 연결. 담보신탁 1건 입력 시 본문(제1~31조)+별지 미리보기 화면 표시, 입력값 실시간 반영(위탁자명 치환 확인).
- **M2-2 검증 게이트**: 완료. 필수 누락 시 DOCX/PDF 버튼 차단 + 누락 필드·해당 STEP 안내, 충족 시 활성화. 라이브 3상태 검증 통과.
- **M2-3 전체 플로우 + 그린 빌드**: 완료. 입력→미리보기→DOCX→저장/목록(localStorage) end-to-end 정리, `next dev --webpack -p 3100` 정상 + tsc/build/lint green.
- 변경 파일(검증 후 보고, 배포 보류):
  - 신규 `src/lib/engine/validate.ts`
  - 수정 `src/components/trust/steps/DocStep.tsx`
  - 수정 `src/app/globals.css` (말미 2분할·게이트 스타일 추가)

## 미완·기술부채 우선순위
1. **[P1] verbatim 조문 정확성 마감** — 대표성 샘플 1건(위탁자2·우선수익자2·인허가 위탁자명의·3분의2) 원본 대조 검수는 본 회차 미실행. 사업(신탁)팀 검수 의존 — 개발은 별첨4 옵션 분기(`getAnnex4Options`) 매핑만 점검 가능, 실제 조문 문구 일치 판정은 신탁 전문가 대조 필요.
2. **[P2] Next 16 `middleware`→`proxy` 마이그레이션** — deprecated 경고. 출시 전 정리(추정 소작업).
3. **[P3] favicon.ico** 정적자산 추가(콘솔 404 제거).
4. **[P3] 미리보기 범위** — 현재 미리보기는 본문·별지(담보신탁계약서 기준)만. Doc 04/06/07 등 서류별 고유 미리보기는 builders가 본문/별지 함수만 제공 → 추후 서류별 미리보기 확장 검토(출시 후).
5. **[관찰]** 의존성 핀 정상(Next 16.2.7, React 19.2.4, docx 9.6, zustand 5). 변동 없음.

## alerts
- 없음 (빌드/배포 실패·조문 정확성 결함·보안 취약점·핵심 플로우 장애 해당 없음). favicon 404·deprecated 경고는 비기능 경미 항목으로 alert 미해당.
