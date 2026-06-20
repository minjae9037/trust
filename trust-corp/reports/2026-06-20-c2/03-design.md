# 디자인 일일 — 2026-06-20-c2

> 미션 M3-1: 위저드·2분할 미리보기·계약목록 UX 정비(임시 토큰 유지).
> 의존성: M2-1(개발팀 2분할 미리보기) 구조에 맞춤 → **개발팀 적용 가이드** 형태로 제출.
> 원칙: B2B 금융 톤(차분·신뢰·고밀도 정돈), 임시 토큰 유지(브랜드명 확정 전이므로 새 토큰 도입 금지),
> 코드 직접 수정은 개발팀과 합의 후. 본 문서는 시안·토큰·간격·상태 스펙 제안.

## 현황 사실 확인 (코드 대조)
- 위저드 레이아웃: `wizard-layout` = `grid 230px(stepper) / 1fr(form-panel)`, gap 44px, 980px↓ stepper 숨김 1열 전환. (`globals.css:427-438`)
- **2분할 미리보기는 아직 미구현(사실).** 현재 `DocStep.tsx`는 좌측 form-panel 안에서 입력 폼 + Word/PDF 버튼만 렌더. 우측 실시간 미리보기 패널 없음. → M3-1 정비안은 "추가될 미리보기 패널"의 레이아웃·상태 스펙이 핵심.
- 계약목록: `ContractsView.tsx`가 **인라인 style 하드코딩**으로 카드 렌더(클래스 미사용). 빈/로딩/에러 상태는 `field-hint` 텍스트 한 줄로만 처리.
- 검증 게이트(M2-2): DocStep 버튼에 disabled 상태 클래스/누락 안내 UI 없음. 미리보기와 같은 화면이므로 디자인 함께 정의.
- 사용 가능 토큰: 색 `--c-brown(주)/--c-blue-deep(보조)/--c-success/--c-danger`, 라운드 `--r-lg:12px / --r-pill`, 그림자 `--shadow-sm`. 신규 토큰 없이 전부 구성 가능 확인.

---

## 오늘 디자인 작업 (시안/시스템/수정)

### 1. 위저드 단계형 흐름 정비
1. **stepper 진행 상태 3종 시각화 강화** — 현 `stepper-item active`만 사용 중이나 CSS에는 `.step.done`(완료=success색) 정의가 이미 존재. `Wizard.tsx`가 `stepper-item` 클래스를 쓰고 있어 정의된 `.step` 스타일과 불일치. → 클래스 통일 + done 상태(이미 채워진 단계) 부여로 "어디까지 했는지" 한눈 인지.
2. **탭(1신규/2진행/3정산) ↔ 서브스텝 pill ↔ stepper 3중 네비 중복 정리** — 셋 다 같은 step 이동 기능. 모바일(980px↓)에서 stepper가 숨겨지므로 탭+서브스텝만 남아 OK이나, 데스크톱에서는 정보 위계를 (탭=대분류 / stepper=전체 단계 / 서브스텝=현재 탭 내 이동)으로 역할 분리해 라벨/크기 차등.
3. **pagenav(이전/다음 원형 버튼) 위치 고정** — form-panel 하단. 2분할 도입 시 좌측 입력 패널 하단에 유지(미리보기 패널에는 넣지 않음).

### 2. 2분할 미리보기 레이아웃 (M2-1 적용 가이드 — 핵심)
DocStep 단계에 한해 위저드 내부를 **입력(좌) / 미리보기(우)** 2분할로 전환하는 안. 기존 `wizard-layout`(stepper+form) 바깥쪽 구조는 유지하고, **DocStep 컴포넌트 내부만** 2분할로 구성(스코프 최소화).

- 데스크톱: form-panel 내부를 `grid 1fr / 1fr` (입력 | 미리보기), gap 28px.
- 미리보기 패널 = "종이" 메타포: `--c-paper` 배경 + `--c-line` 테두리 + `--shadow-sm`, 본문/별지 2탭(본문 `previewBodyHTML` · 별지 `previewAnnexHTML`).
- 미리보기는 **sticky**(top 86px, topbar 높이 정렬 — stepper와 동일값)로 스크롤 시 따라옴.
- 1100px↓: 입력↑/미리보기↓ 1열 적층. 미리보기는 접이식(미리보기 보기 토글)으로 모바일 입력 방해 최소화.

### 3. 계약목록(내 계약) 가독성 정비
- 인라인 style → 클래스(`contract-card`)로 이관(유지보수·일관성). 토큰 동일 매핑이라 시각 변화 없음, 코드만 정리.
- 카드에 **상태 배지**(작성중=`badge.soon` 회색 / 완료=`badge.ready` 초록) 추가 — 현재는 본문 텍스트로만 표기.
- 빈 상태 = 텍스트 한 줄 → **빈 상태 카드**(아이콘 글리프 + 안내 + "새 서류 작성" CTA)로 격상.
- 정렬 기본 = `updated_at` 최신순(이미 그러하면 유지), 상단에 건수 표시.

---

## 핵심 플로우 UX 결정
1. **2분할은 DocStep(서류 출력) 단계 한정.** 당사자·물건·대출계산 등 입력 단계는 미리보기할 본문이 없으므로 기존 1열 유지. 일관성보다 "해당 단계에 의미 있는 화면"을 우선(B2B 실무자 효율).
2. **미리보기는 읽기 전용·실시간.** 입력 변경 → 우측 즉시 갱신(개발팀 M2-1 `previewBodyHTML`/`previewAnnexHTML` 연결). 디자인은 "신뢰감 있는 문서 외형"(흰 종이·본문 typography)에 집중, 편집은 좌측에서만.
3. **검증 게이트(M2-2)와 미리보기 통합.** 미리보기 패널 상단에 검증 요약 바(필수 N개 중 충족 M개 / 누락 항목 칩). 누락 시 DOCX 버튼 `disabled` + 누락 칩 클릭 → 해당 입력 필드로 스크롤. "왜 못 누르는지"를 미리보기 옆에서 즉시 인지.
4. **임시 토큰 유지 확정.** 브랜드명·새 컬러 도입은 다음 사이클(네이밍 확정 후). 이번 정비는 기존 토큰 재배치·상태 추가만.

---

## 개발 전달 스펙 (적용 가이드 — 복붙 가능 수준)

> 모두 기존 토큰만 사용. 신규 변수·라이브러리 불필요. 클래스명은 globals.css 컨벤션 따름.

### A. 2분할 미리보기 — `DocStep.tsx` 구조 + globals.css 추가
**DocStep return 최상위 래퍼를 `doc-split`로 감싸기:**
```tsx
<div className="doc-split">
  <div className="doc-input">{/* 기존 field-grid + 버튼 영역 */}</div>
  <aside className="doc-preview">
    <div className="preview-head">
      <div className="preview-tabs">
        <button className={"preview-tab"+(tab==="body"?" active":"")} ...>본문</button>
        <button className={"preview-tab"+(tab==="annex"?" active":"")} ...>별지</button>
      </div>
      {/* 검증 요약 바: 아래 B 참조 */}
    </div>
    <div className="preview-paper"
         dangerouslySetInnerHTML={{__html: tab==="body"? previewBodyHTML : previewAnnexHTML}} />
  </aside>
</div>
```
**globals.css 추가(제안):**
```css
.doc-split { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; align-items: start; }
@media (max-width: 1100px) { .doc-split { grid-template-columns: 1fr; gap: 20px; } }

.doc-preview {
  position: sticky; top: 86px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-lg);
  background: var(--c-paper-soft);
  overflow: hidden;
}
.preview-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 10px 14px;
  border-bottom: 1px solid var(--c-line-soft);
  background: var(--c-paper);
}
.preview-tabs { display: flex; gap: 4px; }
.preview-tab {
  border: none; background: none; font-family: inherit;
  font-size: 12.5px; font-weight: 600; color: var(--c-ink-mute);
  padding: 6px 12px; border-radius: var(--r-pill); cursor: pointer; transition: all .2s;
}
.preview-tab:hover { color: var(--c-ink); }
.preview-tab.active { background: var(--c-brown); color: var(--c-paper); }

.preview-paper {
  background: #fff; margin: 16px; padding: 28px 30px;
  border: 1px solid var(--c-line-soft); border-radius: 6px;
  box-shadow: var(--shadow-sm);
  font-size: 12.5px; line-height: 1.85; color: var(--c-ink);
  max-height: calc(100vh - 200px); overflow-y: auto;
  /* 문서 톤: 본문 가독성 우선, 장식 없음 */
}
.preview-paper h1, .preview-paper h2 { font-size: 14px; font-weight: 700; }
/* 모바일 접이식: 좁은 화면에서 sticky 해제 */
@media (max-width: 1100px) { .doc-preview { position: static; } }
```

### B. 검증 게이트 + 누락 안내 (M2-2 연계) — preview-head 안에 요약 바
```tsx
<div className={"validate-pill"+(missing.length? " warn":" ok")}>
  {missing.length ? `필수 ${total-missing.length}/${total} · 누락 ${missing.length}` : "✓ 작성 완료"}
</div>
```
```css
.validate-pill { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: var(--r-pill); }
.validate-pill.ok   { background: var(--c-success-soft); color: var(--c-success); }
.validate-pill.warn { background: var(--c-danger-soft);  color: var(--c-danger); }
/* 누락 칩(클릭→해당 필드 scrollIntoView) */
.miss-chips { display:flex; flex-wrap:wrap; gap:6px; margin: 10px 0 0; }
.miss-chip {
  font-size: 11px; padding: 4px 10px; border-radius: var(--r-pill);
  background: var(--c-danger-soft); color: var(--c-danger);
  border: 1px solid transparent; cursor: pointer;
}
.miss-chip:hover { border-color: var(--c-danger); }
```
- DOCX 버튼: `disabled={busy || missing.length>0}`. disabled 시 기존 `.btn:disabled`(opacity 처리) 활용, 추가로 버튼 옆 `field-hint`에 "필수 항목을 모두 입력하면 생성됩니다" 노출.

### C. 계약목록 — `ContractsView.tsx` 인라인 style → 클래스
인라인 style 객체 제거하고 클래스 매핑(시각 동일, 토큰화):
```css
.contract-card {
  display: flex; justify-content: space-between; align-items: center;
  gap: 14px; background: var(--c-paper);
  border: 1px solid var(--c-line); border-radius: var(--r-lg);
  padding: 16px 18px; transition: border-color .2s, box-shadow .2s;
}
.contract-card:hover { border-color: var(--c-brown-soft); box-shadow: var(--shadow-sm); }
.contract-title { font-weight: 700; font-size: 15px; }
.contract-meta  { margin-top: 4px; font-size: 12px; color: var(--c-ink-mute); }
/* 빈 상태 카드 */
.empty-state {
  text-align: center; padding: 48px 24px;
  border: 1px dashed var(--c-line); border-radius: var(--r-lg);
  background: var(--c-paper-soft); color: var(--c-ink-soft);
}
.empty-state .glyph { font-size: 32px; opacity: .5; margin-bottom: 10px; }
```
- 상태 배지: 메타 줄의 "완료/작성중" 텍스트를 `<span className={"badge "+(r.status==="completed"?"ready":"soon")}>`로 교체(기존 `.badge` 재사용).
- 빈 상태: 현 `field-hint` 한 줄 → `empty-state` 카드 + "새 서류 작성" 버튼(→ company/home view 이동).

### D. stepper 클래스 통일(저비용 개선)
- `Wizard.tsx`의 `stepper-item`/`stepper-num` → globals.css에 정의된 `step`/`step-num`로 변경(또는 그 반대로 별칭 추가). 그래야 정의돼 있는 `.step.active`/`.step.done` 색 상태가 실제 적용됨. **done 판정** = `s.idx < step`이면 `done` 클래스 부여(완료 단계 success색 표시).

### 적용 우선순위(개발팀 권고)
1. A(2분할) + B(검증 게이트) — M2-1/M2-2와 한 화면이라 함께. **P0 차단요인 아님이나 P0 화면 완성도 직결.**
2. C(계약목록 클래스화+배지+빈상태) — 독립 작업, 저위험.
3. D(stepper 클래스 통일) — 5분 작업, 즉시 효과.

### 반응형 브레이크포인트 정리(기존과 정합)
- 1100px↓: 2분할 → 1열(미리보기 하단·sticky 해제).
- 980px↓: 기존대로 stepper 숨김, 위저드 1열(탭+서브스텝으로 네비).
- 640px↓: 기존 `field-grid` 1열 유지.

---

## alerts
없음. (M3-1은 P1 병행 과제로 P0 차단요인 아님. 단, 본 가이드의 A/B는 개발팀 M2-1/M2-2와 같은 화면이므로 **개발팀과 한 화면으로 동시 적용 권고** — 개발 우선·디자인 가이드 적용 순서 지킬 것.)
