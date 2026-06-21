"use client";

import { useEffect, useMemo, useState } from "react";
import { useContractStore } from "@/lib/store/contractStore";
import { generateJointDoc, generateJointPDFDoc, previewJointHTML } from "@/lib/engine/docx";
import { openDocPreviewWindow } from "@/lib/ui/preview-window";
import { validateJoint, jointFieldIdForMissing } from "@/lib/engine/validate";
import { genFreshness } from "@/lib/engine/genStatus";
import { isValidCorpRegNo, isRealDate } from "@/lib/engine/calc";

// 입력 중에는 값 반영을 잠깐 미뤄(미리보기 한정) 매 키 입력마다 완성 협약서
// HTML 재생성·iframe srcDoc 재파싱을 막는다(담보신탁 DocStep 과 동일 패턴).
// 입력 필드는 store를 직접 읽어 즉시 반영(이 디바운스 영향 없음).
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function JointForm() {
  const { jointForm, updateJoint } = useContractStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // "크게 보기"(새 창) 팝업 차단 안내. 차단 외에는 비워 둔다.
  const [previewNote, setPreviewNote] = useState("");
  // 마지막 생성(Word/PDF) 시점의 입력 스냅샷. 이후 입력이 바뀌면 "✓ 완료"
  // 확인이 구버전을 최신으로 오인시키므로(법적 서류=정확성) "다시 생성하세요"로
  // 전환한다(담보신탁 DocStep onDocx/onPdf 신선도와 동일 단일 출처 판정).
  const [genSnap, setGenSnap] = useState<string | null>(null);
  const gap = jointForm.gap;
  const project = jointForm.project;

  // ── 우측 실시간 미리보기 (담보신탁 DocStep 과 동형) — 완성 협약서를 그대로
  //    iframe srcdoc 으로 격리 렌더(WYSIWYG, 실제 산출물과 동일). jointForm 은
  //    250ms 디바운스해 빠른 연속 입력 시 재생성 횟수를 줄인다.
  const debouncedForm = useDebounced(jointForm, 250);
  // store 는 매 수정마다 새 jointForm 참조를 만들므로(스프레드) 참조 불일치가
  // "갱신 대기" 신호 — 그 동안만 "갱신 중…" 인디케이터를 표시한다.
  const previewPending = jointForm !== debouncedForm;
  const previewHtml = useMemo(() => {
    try {
      return previewJointHTML(debouncedForm);
    } catch {
      return "";
    }
  }, [debouncedForm]);

  // ── 검증 게이트 (담보신탁 DocStep 과 동형) — 필수 입력 충족 시에만 생성 활성화.
  //    미리보기와 달리 라이브 jointForm 을 직접 읽어 즉시 반영(디바운스 영향 없음).
  const { ok, missing } = useMemo(() => validateJoint(jointForm), [jointForm]);

  // ── 인라인 검증 피드백 (담보신탁 PartyCard/StepBasic 패리티) — 게이트(validateJoint)는
  //    하단 .validate-box 에 누락을 모아 알려 주지만, "그 필드 옆"에서 입력 즉시 오류를
  //    짚어 주는 인라인 안내는 joint 에 없었다. 담보신탁 PartyCard 의 corpInvalid 와 동형으로
  //    게이트와 같은 단일 출처(isValidCorpRegNo·isRealDate)를 써 판정 불일치를 막는다.
  //    부분 입력 중에는 표시하지 않는다(나그 방지) — 완전 입력 + 무효일 때만 안내.
  const gapCorpDigits = [gap.corpRegFront, gap.corpRegBack].map((x) => x ?? "").join("").replace(/\D/g, "");
  const gapCorpInvalid = gapCorpDigits.length === 13 && !isValidCorpRegNo(gapCorpDigits);
  // 협약일은 자유 텍스트(담보신탁은 유효일만 노출하는 드롭다운이라 인라인 불요)라 2월 31일 등
  // 실재하지 않는 날짜를 타이핑할 수 있다 → 연·월·일 3칸이 모두 채워졌는데 달력상 없는 날짜일
  // 때만 안내(비숫자도 Number→NaN→isRealDate=false 로 동일 처리). 게이트와 동일 isRealDate.
  const agY = String(project.agreementYear ?? "").trim();
  const agM = String(project.agreementMonth ?? "").trim();
  const agD = String(project.agreementDay ?? "").trim();
  const agreementDateInvalid =
    agY !== "" && agM !== "" && agD !== "" && !isRealDate(Number(agY), Number(agM), Number(agD));

  // ── 생성 신선도 (담보신탁 DocStep 과 동형) — 값 기반 입력 스냅샷(참조 동일성
  //    대신 직렬화 비교, store dirty 추적과 동일 패턴). 생성 후 입력이 바뀌면
  //    none(미생성)·fresh(무변경)·stale(변경됨) 판정으로 재생성 안내한다.
  const formSnap = useMemo(() => JSON.stringify(jointForm), [jointForm]);
  const freshness = genFreshness(formSnap, genSnap);

  // 입력이 바뀌면 직전 생성 완료/오류 메시지는 더 이상 유효하지 않다 → 비운다
  // (생성 자체는 jointForm 을 바꾸지 않으므로 "✓ 완료" 직후엔 살아 있고,
  //  첫 편집에 사라져 stale 안내가 드러난다 — DocStep formSnap effect 와 동형).
  useEffect(() => {
    setMsg("");
  }, [formSnap]);

  const setGap = (patch: Partial<typeof gap>) => updateJoint({ gap: { ...gap, ...patch } });
  const setProject = (patch: Partial<typeof project>) =>
    updateJoint({ project: { ...project, ...patch } });

  async function onDocx() {
    if (!ok) return; // 버튼 disabled 와 더불어 방어적 차단(빈 칸 협약서 생성 방지)
    setBusy(true);
    setMsg("Word 생성 중…");
    try {
      await generateJointDoc(jointForm);
      setMsg("✓ Word(.docx) 생성 완료.");
      setGenSnap(formSnap); // 생성 시점 스냅샷 = 이후 편집을 stale 로 판정할 기준선
    } catch (e) {
      setMsg("오류: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }
  function onPdf() {
    if (!ok) return; // 버튼 disabled 와 더불어 방어적 차단
    try {
      // 인쇄창이 실제로 열렸을 때만 성공으로 표시한다. 팝업이 차단돼 창이 열리지
      // 않았는데(generateJointPDFDoc=false, 빌더가 alert 만 띄움) "열었습니다"로
      // 표시하면 만든 적 없는 PDF 를 성공으로 오인한다(담보신탁 DocStep onPdf 와
      // 동일 원칙 — 팝업 차단 거짓 성공 차단, 법적 서류=정확성).
      const opened = generateJointPDFDoc(jointForm);
      if (opened) {
        // 인쇄창이 실제로 열렸을 때만 성공 표시 + 생성 신선도 스냅샷 기록.
        setMsg("PDF 인쇄창을 열었습니다 — 인쇄 대화상자에서 'PDF로 저장'을 선택하세요.");
        setGenSnap(formSnap);
      } else {
        // 차단 시 genSnap 미기록 → freshness 가 거짓 fresh 로 남지 않는다(거짓 신선도 방지).
        setMsg("PDF 창을 열지 못했습니다 — 브라우저 팝업 차단을 해제한 뒤 다시 시도해 주세요.");
      }
    } catch (e) {
      setMsg("오류: " + (e instanceof Error ? e.message : String(e)));
    }
  }
  // 협약서 전체를 새 창에서 전체 크기로 정독 검수(생성 전 육안 확인). 완성
  // 미리보기(previewJointHTML)를 변형 없이 띄우는 읽기 전용 보기(자동 인쇄 없음·
  // 조문 무접촉). 팝업 차단 시 PDF 생성과 동일하게 성공으로 오인하지 않고 안내만.
  function onExpandPreview() {
    // 새 창은 항상 최신(라이브) jointForm 으로 — 디바운스 대기 중에도 정독은
    // 즉시 최신을 보여 준다. 차단 시 PDF 생성과 동일하게 성공 오인 없이 안내만.
    const r = openDocPreviewWindow(previewJointHTML(jointForm), () =>
      window.open("", "_blank", "width=980,height=1100"),
    );
    setPreviewNote(
      r === "blocked"
        ? "새 창을 열지 못했습니다 — 브라우저 팝업 차단을 해제한 뒤 다시 시도해 주세요."
        : "",
    );
  }

  // 검증 게이트 누락 항목 클릭 → 해당 입력 필드로 스크롤·포커스(담보신탁 DocStep
  // validate-jump 의 단일 폼 버전 — 스텝이 없으므로 필드 자체로 데려간다). 매핑은
  // validate.ts 단일 출처(jointFieldIdForMissing). 매칭 실패(미상 라벨)는 무동작.
  function focusMissing(label: string) {
    const id = jointFieldIdForMissing(label);
    if (!id) return;
    const el = typeof document !== "undefined" ? document.getElementById(id) : null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    (el as HTMLElement).focus({ preventScroll: true });
  }

  return (
    <main className="page active">
      <div className="page-header">
        <div className="page-eyebrow">공동사업표준협약서</div>
        <h1 className="page-title">공동사업표준협약서</h1>
        <p className="page-desc">
          &lsquo;을&rsquo; = 한국투자부동산신탁(고정), &lsquo;갑&rsquo; = 시행사(입력). 정보를 입력하면
          협약서를 Word·PDF로 생성합니다.
        </p>
      </div>

      <div className="doc-split">
        {/* ── 좌: 입력 ── */}
        <div className="doc-split-input">
      <section className="form-panel">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>갑 (시행사) 정보</h2>
        <div className="field-grid">
          <div className="field">
            <label className="field-label" htmlFor="joint-gapName">상호</label>
            <input id="joint-gapName" className="input" value={gap.name} onChange={(e) => setGap({ name: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="joint-gapRepDir">대표이사</label>
            <input id="joint-gapRepDir" className="input" value={gap.repDir} onChange={(e) => setGap({ repDir: e.target.value })} />
          </div>
          <div className="field full">
            <label className="field-label" htmlFor="joint-gapAddress">주소</label>
            <input id="joint-gapAddress" className="input" value={gap.address} onChange={(e) => setGap({ address: e.target.value })} />
          </div>
          <div className="field">
            {/* 법인등록번호는 앞/뒤 2칸 묶음이라 단일 htmlFor 부적합 → 그룹 라벨 id +
                role="group" aria-labelledby, 각 input 에 개별 aria-label(앞/뒷자리). */}
            <div className="field-label" id="joint-gapCorpReg">법인등록번호</div>
            <div role="group" aria-labelledby="joint-gapCorpReg" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input id="joint-gapCorpRegFront" className="input" maxLength={6} value={gap.corpRegFront} aria-label="법인등록번호 앞자리"
                aria-invalid={gapCorpInvalid || undefined}
                aria-describedby={gapCorpInvalid ? "joint-gapCorpReg-err" : undefined}
                onChange={(e) => setGap({ corpRegFront: e.target.value.replace(/\D/g, "") })} />
              <span>-</span>
              <input className="input" maxLength={7} value={gap.corpRegBack} aria-label="법인등록번호 뒷자리"
                aria-invalid={gapCorpInvalid || undefined}
                aria-describedby={gapCorpInvalid ? "joint-gapCorpReg-err" : undefined}
                onChange={(e) => setGap({ corpRegBack: e.target.value.replace(/\D/g, "") })} />
            </div>
            {gapCorpInvalid && (
              <div id="joint-gapCorpReg-err" className="field-hint" role="alert" style={{ marginTop: 4, color: "var(--c-danger)" }}>
                유효하지 않은 법인등록번호입니다 (체크섬 확인 필요)
              </div>
            )}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="joint-representative">대표사 지정</label>
            <select id="joint-representative" className="select" value={jointForm.representative}
              onChange={(e) => updateJoint({ representative: e.target.value as "developer" | "trust" })}>
              <option value="developer">대표 = 시행사(갑)</option>
              <option value="trust">대표 = 신탁사(을)</option>
            </select>
          </div>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "26px 0 14px" }}>사업 정보</h2>
        <div className="field-grid">
          <div className="field full">
            <label className="field-label" htmlFor="joint-projectName">사업명</label>
            <input id="joint-projectName" className="input" value={project.name} onChange={(e) => setProject({ name: e.target.value })} />
          </div>
          <div className="field full">
            <label className="field-label" htmlFor="joint-projectSite">사업부지</label>
            <input id="joint-projectSite" className="input" value={project.site} onChange={(e) => setProject({ site: e.target.value })} />
          </div>
          <div className="field full">
            <label className="field-label" htmlFor="joint-projectScaleUse">규모/용도</label>
            <input id="joint-projectScaleUse" className="input" value={project.scaleUse} onChange={(e) => setProject({ scaleUse: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="joint-agreementYear">협약 연도</label>
            <input id="joint-agreementYear" className="input" value={project.agreementYear}
              aria-invalid={agreementDateInvalid || undefined}
              aria-describedby={agreementDateInvalid ? "joint-agreement-err" : undefined}
              onChange={(e) => setProject({ agreementYear: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="joint-agreementMonth">월</label>
            <input id="joint-agreementMonth" className="input" value={project.agreementMonth}
              aria-invalid={agreementDateInvalid || undefined}
              aria-describedby={agreementDateInvalid ? "joint-agreement-err" : undefined}
              onChange={(e) => setProject({ agreementMonth: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="joint-agreementDay">일</label>
            <input id="joint-agreementDay" className="input" value={project.agreementDay}
              aria-invalid={agreementDateInvalid || undefined}
              aria-describedby={agreementDateInvalid ? "joint-agreement-err" : undefined}
              onChange={(e) => setProject({ agreementDay: e.target.value })} />
          </div>
          {agreementDateInvalid && (
            <div className="field full">
              <div id="joint-agreement-err" className="field-hint" role="alert" style={{ marginTop: 4, color: "var(--c-danger)" }}>
                실재하지 않는 협약일입니다 (연·월·일 확인)
              </div>
            </div>
          )}
        </div>

        {/* ── 검증 게이트 안내 (담보신탁 DocStep 과 동형, joint 적용) ── */}
        {!ok && (
          <div className="validate-box" role="alert" style={{ marginTop: 24 }}>
            <div className="validate-title">⚠ 생성 전 필수 입력이 누락되었습니다</div>
            <ul className="validate-list">
              {missing.map((label, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="validate-jump"
                    onClick={() => focusMissing(label)}
                    title="입력란으로 이동"
                  >
                    <strong>{label}</strong>
                    <span className="validate-where"> — 입력란으로 ›</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 24, flexWrap: "wrap" }}>
          <button
            className="btn btn-primary"
            onClick={onDocx}
            disabled={busy || !ok}
            title={ok ? "" : "필수 입력을 모두 채우면 활성화됩니다"}
          >
            📄 Word(.docx) 생성
          </button>
          <button
            className="btn btn-ghost"
            onClick={onPdf}
            disabled={busy || !ok}
            title={ok ? "" : "필수 입력을 모두 채우면 활성화됩니다"}
          >
            🖨 PDF 생성
          </button>
          {freshness === "stale" ? (
            <span className="field-hint" role="status" aria-live="polite" style={{ color: "var(--c-danger)" }}>
              ● 입력이 변경되었습니다 — 다시 생성하세요
            </span>
          ) : (
            msg && <span className="field-hint" role="status" aria-live="polite" style={{ color: "var(--c-blue-deep)" }}>{msg}</span>
          )}
        </div>
      </section>
        </div>

        {/* ── 우: 실시간 미리보기 (완성 협약서 그대로, 실제 산출물과 동일) ── */}
        <aside className="doc-split-preview">
          <div className="preview-head">
            <span className="preview-badge">실시간 미리보기</span>
            <span className="field-hint">입력값이 즉시 반영됩니다 (공동사업표준협약서)</span>
            {previewPending && (
              <span className="preview-updating" role="status" aria-live="polite">
                <span className="preview-updating-dot" aria-hidden="true" />
                갱신 중…
              </span>
            )}
            {previewHtml && (
              <button
                type="button"
                className="preview-expand"
                onClick={onExpandPreview}
                title="현재 미리보기를 새 창에서 전체 크기로 봅니다(읽기 전용 — 인쇄 대화상자 없음)"
              >
                🔍 크게 보기
              </button>
            )}
          </div>
          {previewNote && (
            <div className="preview-note" role="status" aria-live="polite">
              {previewNote}
            </div>
          )}
          {previewHtml ? (
            <iframe
              className="preview-frame"
              srcDoc={previewHtml}
              title="공동사업표준협약서 미리보기"
            />
          ) : (
            <div className="preview-scroll">
              <p className="field-hint" style={{ padding: 16 }}>
                정보를 입력하면 공동사업표준협약서 미리보기가 나타납니다.
              </p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
