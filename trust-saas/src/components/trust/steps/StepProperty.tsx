"use client";

import { useState } from "react";
import { useContractStore } from "@/lib/store/contractStore";
import { OCR } from "@/lib/engine/ocr";
import { isValidRegNo } from "@/lib/engine/calc";

export function StepProperty() {
  const { form, addProperty, removeProperty, updateProperty } = useContractStore();
  const [ocrMsg, setOcrMsg] = useState("");

  async function onPdf(file: File, idx: number) {
    setOcrMsg("부동산 등기부 분석 중…");
    try {
      const { text, source } = await OCR.recognizePDF(file, (p) =>
        setOcrMsg(`처리 중: ${p.status}${p.page ? ` ${p.page}/${p.total}` : ""}`)
      );
      const r = OCR.parsePropertyRegistry(text);
      updateProperty(idx, r);
      setOcrMsg(`자동 추출 완료(${source === "embedded" ? "텍스트" : "OCR"}). 검수하세요.`);
    } catch (e) {
      setOcrMsg("추출 실패: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <div>
      {ocrMsg && (
        <div className="field-hint" style={{ marginBottom: 10, color: "var(--c-blue-deep)" }}>
          {ocrMsg}
        </div>
      )}
      {form.properties.map((p, i) => (
        <div className="party-card" key={i} style={{ marginBottom: 14 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <strong style={{ fontSize: 13 }}>부동산 {i + 1}</strong>
            <div style={{ display: "flex", gap: 8 }}>
              <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer", margin: 0 }}>
                등기부 PDF
                <input
                  type="file"
                  accept="application/pdf"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files?.[0] && onPdf(e.target.files[0], i)}
                />
              </label>
              {form.properties.length > 1 && (
                <button className="btn btn-ghost btn-sm" onClick={() => removeProperty(i)}>
                  ✕
                </button>
              )}
            </div>
          </div>
          <div className="field-grid">
            <div className="field full">
              <label className="field-label" htmlFor={`prop-${i}-address`}>소재지</label>
              <input id={`prop-${i}-address`} className="input" value={p.address}
                onChange={(e) => updateProperty(i, { address: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`prop-${i}-category`}>지목</label>
              <input id={`prop-${i}-category`} className="input" value={p.category}
                onChange={(e) => updateProperty(i, { category: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`prop-${i}-area`}>면적 (㎡)</label>
              <input id={`prop-${i}-area`} className="input" value={p.area}
                onChange={(e) => updateProperty(i, { area: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`prop-${i}-regNo`}>등기 고유번호</label>
              <input id={`prop-${i}-regNo`} className="input" value={p.regNo}
                aria-invalid={(p.regNo.trim().length > 0 && !isValidRegNo(p.regNo)) || undefined}
                aria-describedby={p.regNo.trim().length > 0 && !isValidRegNo(p.regNo) ? `prop-${i}-regNo-err` : undefined}
                onChange={(e) => updateProperty(i, { regNo: e.target.value })} />
              {p.regNo.trim().length > 0 && !isValidRegNo(p.regNo) && (
                <div id={`prop-${i}-regNo-err`} className="field-hint" role="alert" style={{ marginTop: 4, color: "var(--c-danger)" }}>
                  등기 고유번호는 숫자 14자리입니다 (현재 {p.regNo.replace(/\D/g, "").length}자리)
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" onClick={addProperty}>
        + 부동산 추가
      </button>
    </div>
  );
}
