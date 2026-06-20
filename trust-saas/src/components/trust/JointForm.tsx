"use client";

import { useState } from "react";
import { useContractStore } from "@/lib/store/contractStore";
import { generateJointDoc, generateJointPDFDoc } from "@/lib/engine/docx";

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
            <div className="field-label">상호</div>
            <input className="input" value={gap.name} onChange={(e) => setGap({ name: e.target.value })} />
          </div>
          <div className="field">
            <div className="field-label">대표이사</div>
            <input className="input" value={gap.repDir} onChange={(e) => setGap({ repDir: e.target.value })} />
          </div>
          <div className="field full">
            <div className="field-label">주소</div>
            <input className="input" value={gap.address} onChange={(e) => setGap({ address: e.target.value })} />
          </div>
          <div className="field">
            <div className="field-label">법인등록번호</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input className="input" maxLength={6} value={gap.corpRegFront}
                onChange={(e) => setGap({ corpRegFront: e.target.value.replace(/\D/g, "") })} />
              <span>-</span>
              <input className="input" maxLength={7} value={gap.corpRegBack}
                onChange={(e) => setGap({ corpRegBack: e.target.value.replace(/\D/g, "") })} />
            </div>
          </div>
          <div className="field">
            <div className="field-label">대표사 지정</div>
            <select className="select" value={jointForm.representative}
              onChange={(e) => updateJoint({ representative: e.target.value as "developer" | "trust" })}>
              <option value="developer">대표 = 시행사(갑)</option>
              <option value="trust">대표 = 신탁사(을)</option>
            </select>
          </div>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "26px 0 14px" }}>사업 정보</h2>
        <div className="field-grid">
          <div className="field full">
            <div className="field-label">사업명</div>
            <input className="input" value={project.name} onChange={(e) => setProject({ name: e.target.value })} />
          </div>
          <div className="field full">
            <div className="field-label">사업부지</div>
            <input className="input" value={project.site} onChange={(e) => setProject({ site: e.target.value })} />
          </div>
          <div className="field full">
            <div className="field-label">규모/용도</div>
            <input className="input" value={project.scaleUse} onChange={(e) => setProject({ scaleUse: e.target.value })} />
          </div>
          <div className="field">
            <div className="field-label">협약 연도</div>
            <input className="input" value={project.agreementYear}
              onChange={(e) => setProject({ agreementYear: e.target.value })} />
          </div>
          <div className="field">
            <div className="field-label">월</div>
            <input className="input" value={project.agreementMonth}
              onChange={(e) => setProject({ agreementMonth: e.target.value })} />
          </div>
          <div className="field">
            <div className="field-label">일</div>
            <input className="input" value={project.agreementDay}
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
          {msg && <span className="field-hint" style={{ color: "var(--c-blue-deep)" }}>{msg}</span>}
        </div>
      </section>
    </main>
  );
}
