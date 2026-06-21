"use client";

import { useState } from "react";
import { useContractStore } from "@/lib/store/contractStore";
import { generateJointDoc, generateJointPDFDoc, previewJointHTML } from "@/lib/engine/docx";
import { openDocPreviewWindow } from "@/lib/ui/preview-window";

export function JointForm() {
  const { jointForm, updateJoint } = useContractStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const gap = jointForm.gap;
  const project = jointForm.project;

  const setGap = (patch: Partial<typeof gap>) => updateJoint({ gap: { ...gap, ...patch } });
  const setProject = (patch: Partial<typeof project>) =>
    updateJoint({ project: { ...project, ...patch } });

  async function onDocx() {
    setBusy(true);
    setMsg("Word 생성 중…");
    try {
      await generateJointDoc(jointForm);
      setMsg("✓ Word(.docx) 생성 완료.");
    } catch (e) {
      setMsg("오류: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }
  function onPdf() {
    try {
      generateJointPDFDoc(jointForm);
      setMsg("PDF 인쇄창을 열었습니다.");
    } catch (e) {
      setMsg("오류: " + (e instanceof Error ? e.message : String(e)));
    }
  }
  // 협약서 전체를 새 창에서 전체 크기로 정독 검수(생성 전 육안 확인). 완성
  // 미리보기(previewJointHTML)를 변형 없이 띄우는 읽기 전용 보기(자동 인쇄 없음·
  // 조문 무접촉). 팝업 차단 시 PDF 생성과 동일하게 성공으로 오인하지 않고 안내만.
  function onExpandPreview() {
    const r = openDocPreviewWindow(previewJointHTML(jointForm), () =>
      window.open("", "_blank", "width=980,height=1100"),
    );
    setMsg(
      r === "blocked"
        ? "새 창을 열지 못했습니다 — 브라우저 팝업 차단을 해제한 뒤 다시 시도해 주세요."
        : "협약서를 새 창에서 열었습니다.",
    );
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
              <input className="input" maxLength={6} value={gap.corpRegFront} aria-label="법인등록번호 앞자리"
                onChange={(e) => setGap({ corpRegFront: e.target.value.replace(/\D/g, "") })} />
              <span>-</span>
              <input className="input" maxLength={7} value={gap.corpRegBack} aria-label="법인등록번호 뒷자리"
                onChange={(e) => setGap({ corpRegBack: e.target.value.replace(/\D/g, "") })} />
            </div>
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
              onChange={(e) => setProject({ agreementYear: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="joint-agreementMonth">월</label>
            <input id="joint-agreementMonth" className="input" value={project.agreementMonth}
              onChange={(e) => setProject({ agreementMonth: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="joint-agreementDay">일</label>
            <input id="joint-agreementDay" className="input" value={project.agreementDay}
              onChange={(e) => setProject({ agreementDay: e.target.value })} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 24, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={onDocx} disabled={busy}>
            📄 Word(.docx) 생성
          </button>
          <button className="btn btn-ghost" onClick={onPdf} disabled={busy}>
            🖨 PDF 생성
          </button>
          <button className="btn btn-ghost" onClick={onExpandPreview} disabled={busy}
            title="협약서 전체를 새 창에서 크게 보기">
            🔍 크게 보기
          </button>
          {msg && <span className="field-hint" role="status" aria-live="polite" style={{ color: "var(--c-blue-deep)" }}>{msg}</span>}
        </div>
      </section>
    </main>
  );
}
