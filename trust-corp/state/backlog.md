# 전사 백로그 (누적·우선순위)

> 기획팀이 관리. 완료 항목은 ~~취소선~~ 또는 하단 이동.

## P0 — 계약서 자동화 서비스 1차 (최우선)
- [ ] (사업팀) 1차 자동화 대상 계약서 종류·구조·필수조항·필드 정의서 작성
- [ ] (개발팀) 현행 엔진(담보신탁 7종 + 공동사업협약) 동작 검증 — 입력→미리보기→DOCX
- [ ] (개발팀) 1차 대상 계약서 모델/스키마/조문 엔진 반영
- [ ] (사업팀) 산출 DOCX 조문 정확성 검수(verbatim 대조)
- [x] (개발팀) **계약 목록(내 계약) UX 정비** — 담보신탁 계약마다 서류 준비도 칩(`✓ 7/7`/`⚠ N/7 생성 가능`, `validateDoc` 7종 집계 재사용·조문 무접촉) + 제목·서류명 검색 필터 + 카드 폴리시(`.contract-card`/상태 `.badge`). 구버전·손상 저장본 try/catch 격리. 회귀 가드 `verify-contracts-readiness.mjs` 12/12 PASS, tsc/build green, Playwright 가시 확인(✓7/7·⚠5/7·joint 칩無·검색 "1/3건"). 2026-06-21 완료. → (위저드·미리보기 UX는 직전 iteration들에서 마감, 목록까지 P0 UX 정비 3종 완료.)
- [ ] (디자인팀) 위저드·미리보기·계약목록 UX 정비 — (개발 산출 완료, 디자인팀 토큰·여백 최종 검수 대기)
- [x] (개발팀) **검증 게이트(필수 입력 누락 시 DOCX/PDF 차단+누락 안내) + 미리보기 2분할** — `DocStep.tsx`에 구현·연결 확인(M2-1/M2-2). 2026-06-21 확인.
- [x] (개발팀) **위저드 서류별 생성 가능 여부(✓/⚠) 마커** — 검증 게이트를 tab3 서류 pill에서 한눈에. 7종 중 막힌 서류 즉시 식별(`validateDoc` 재사용, 조문 무손상). 회귀 가드 `verify-doc-readiness.mjs` 13/13 PASS, tsc/build green, Playwright 가시 확인. 2026-06-21 완료.
- [x] (개발팀) **우선수익자 복수(2인) 본문 표/날인 전원 표기 검증** — 26/26 PASS (`scripts/verify-multiparty.mjs`, 위탁자2+우선수익자2, HTML+실제 DOCX 바이트). 2026-06-20 완료. → 사업팀 verbatim 실물 대조 대기.
- [x] (개발팀) **서류별 실시간 미리보기 WYSIWYG** — DocStep 미리보기가 docId 무관하게 항상 계약서 본문만 보이던 버그(7종 중 6종 미리보기≠생성물) 수정. `previewDocHTML(form,docId)`가 PDF 빌더 완성 HTML(contract/appform/generic)을 자동인쇄 `<script>`만 제거해 `<iframe srcDoc>`로 격리 렌더 → 실제 생성물과 동일. **조문 verbatim 무접촉(빌더 출력 재사용)**. 회귀 가드 `verify-doc-preview.mjs` 33/33 PASS, `verify-doc-readiness` 14/14 회귀無, tsc/build green, Playwright 가시 확인(위임장↔계약서 즉시 전환). 2026-06-21 완료.

### 검증 발견 (2026-06-21 02 verify)
- [x] (개발팀) **verify-doc-readiness 회귀가드 적색(12/13) 수정** — STEP 05 신설로 stale된 `nonDoc.length===5` 하드코딩을 STEPS **파생**(파티션 완전성 단언)으로 교체 → **14/14 PASS**. 향후 STEP 추가에도 stale 안 됨. tsc EXIT 0, 앱 소스 무변경(테스트 전용). 2026-06-21 06:58 완료.
- [ ] (개발팀) **StepConditions iteration worklog/백로그 사후 기록** — Wizard+98/model.ts+39/schema±/StepConditions.tsx 신규 변경이 06-21 worklog(마지막 00:24) 누락. 09 morning 보고 전 보강. (※ tsc/next build green, 정확성 가드레일 통과 — 정정 아닌 로깅 보완.)
- [ ] (사업팀) **conditions 신규 8키 조문 연동 시 verbatim 게이트** — `collateralType·licenseType·onbid·feePayer·collateralOrder` 등은 현재 "프로파일 기록(조문 미접촉)". 향후 조문 연동 착수 전 **표준양식(.docx) verbatim 수급 필수**(추정 조문 금지). verbatim 대조 체크리스트에 편입.

- [x] (개발팀) **TrustForm 브랜드 아이콘(favicon) + OG/Twitter 메타** — 대표님 확정 브랜딩("타이틀·메타·OG·아이콘") 중 미완이던 아이콘·OG 마감. `src/app/icon.svg` 신규(브라운 그라데이션+서류+모노그램 T) + `layout.tsx` icons/openGraph/twitter 선언 → 매 검증마다 반복되던 **콘솔 favicon 404 소멸**(Playwright 콘솔 0건, favicon.ico 요청 자체 제거). 회귀 가드 `verify-brand-icon.mjs` 9/9 PASS, tsc/build green(`○ /icon.svg` 라우트 생성). 조문·엔진 무접촉. 2026-06-21 완료. → (디자인) 본문 로고 텍스트·토큰 일관성·og:image는 호스팅 확정 후.

## P1 — 운영 기반
- [ ] (개발팀) `.env.local` 셋업(ANTHROPIC/SUPABASE) + 로컬 구동 확인
- [ ] (개발팀) Supabase 프로젝트 + 마이그레이션 적용(멀티테넌트)
- [ ] (개발팀) 배포 환경 확정 — ★대표님 결정 필요(Vercel 등)
- [ ] (기획팀) 브랜드명 확정 — ★대표님 결정 필요

## P2 — 론칭 준비
- [ ] (디자인팀) 랜딩/앱 디자인 시스템 정비
- [ ] (마케팅팀) 포지셔닝·세일즈 원페이저·리드 리서치
- [ ] (마케팅팀) 가격/패키지 방향 초안

## 기술부채 / 향후 확장
- [x] (개발팀) **미저장 변경(dirty) 추적 + 유실 방지** — localStorage 무자동저장 구조에서 저장 후 추가 편집/이탈 시 조용한 데이터 유실 가드. SaveBar dirty 표시(`● 저장되지 않은 변경`↔`✓ 저장됨`)+`beforeunload`+goHome confirm. 회귀 가드 `verify-dirty-tracking.mjs` 7/7 PASS, tsc/build green, Playwright 가시 확인. 2026-06-21 완료.
- [x] (개발팀) **dirty 가드 확장 — 위저드↔다른 계약 열기(loadContract) 시 미저장 경고** — `openContract`에 `isFormDirty` confirm 가드 추가(goHome과 동일 패턴). 회귀 가드 `verify-dirty-tracking.mjs` [G] 추가 9/9 PASS, tsc/build green, Playwright 가시 확인(취소 시 덮어쓰기 차단). 2026-06-21 완료. → goHome/beforeunload/loadContract 유실 경로 3종 마감.
- [x] (개발팀) **미리보기 입력 디바운스** — DocStep 우측 미리보기가 매 키 입력마다 완성 문서 HTML(37KB+) 재생성·iframe 재파싱하던 비용을 250ms 디바운스(`useDebounced`, 미리보기 한정)로 제거. 입력 필드·검증 게이트는 raw form 직결(즉시성·정확성 보존), 조문·빌더 무손상. 회귀 가드 `verify-preview-debounce.mjs` 8/8 PASS + `verify-doc-preview` 33/33 회귀無, tsc/build green, Playwright 가시 확인(입력 즉시·미리보기 250ms 후 반영). 2026-06-21 완료.
- [ ] (개발팀) `priorityRankLabel` 공동순위(동순위) 라벨 지원 — 현재 단순 N순위. 동순위 입력 UX 정의 후 착수.
- [x] (개발팀) **내 계약 목록 정렬·상태 필터(완료↔작성중) 토글** — 검색·준비도 칩 위에 상태 세그먼트(`전체`/`작성중`/`완료`, 실시간 건수)+정렬 셀렉트(`최근수정`/`제목 가나다`/`생성 준비도순`) 추가. `filtered`→`visible` 통합 파이프라인(`useMemo`), 산출정의 없는 종류는 준비도 정렬 시 맨 뒤. `.seg`/`.seg-btn`/`.seg-num` 신규(기존 브랜드 토큰). 회귀 가드 `verify-contracts-sort-filter.mjs` 17/17 PASS + readiness 12/12 회귀無, tsc/build green, Playwright 가시 확인(작성중 토글 "2/4건"·준비도순 5/7→0/7). 조문·엔진 무접촉. 2026-06-21 완료.
- [x] (개발팀) **좌측 `진행 단계`(stepper) 사이드바 무스타일 수정** — 죽은 `.step`/`.step-num`(미사용 CSS)을 실제 사용명 `.stepper-item`/`.stepper-num`으로 개명해 의도된 디자인(번호 원형 배지·활성 하이라이트) 적용 + sub-step과 동일 ✓/⚠ readiness 배지(`.stepper-flag`) 통일(`docReady` 재사용, 조문 무손상). 회귀 가드 `verify-stepper-styling.mjs` 15/15 PASS(클래스 drift 정적 차단), tsc/build green, Playwright 가시 확인. 2026-06-21 완료.
- [x] (개발팀) **구버전 저장본 로드 크래시 가드** — `loadContract` 얕은머지 시 `docContents` 키 누락 → `validate.ts` TypeError(DocStep 렌더 크래시). validate 옵셔널체이닝 + loadContract docContents 한 단계 병합으로 수정. 회귀 가드 `verify-loadcontract-merge.mjs` 15/15 PASS. 2026-06-20 완료.

## 신규 자동화 기회 (사업팀 발굴, 검토 대기)
- (대기)
