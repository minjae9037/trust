"use client";

import { useState } from "react";
import { useContractStore } from "@/lib/store/contractStore";
import { OCR } from "@/lib/engine/ocr";
import { isValidRegNo, isPositiveAmount } from "@/lib/engine/calc";

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
              {/* 면적은 별첨1·신청서 부동산표 면적칸에 `area + "㎡"`로 박히는 정량 출력값.
                  게이트(validateDoc)와 같은 단일 출처(isPositiveAmount)·같은 채움 조건(trim>0)을
                  재사용해 "채웠지만 0·음수·비숫자"면 그 입력 옆에서 즉시 안내한다(판정 불일치 0,
                  등기번호·가격·원본가액 인라인 패리티). 빈 값·유효 면적은 미표시(나그 방지). */}
              <input id={`prop-${i}-area`} className="input" value={p.area}
                aria-invalid={(p.area.trim().length > 0 && !isPositiveAmount(p.area)) || undefined}
                aria-describedby={p.area.trim().length > 0 && !isPositiveAmount(p.area) ? `prop-${i}-area-err` : undefined}
                onChange={(e) => updateProperty(i, { area: e.target.value })} />
              {p.area.trim().length > 0 && !isPositiveAmount(p.area) && (
                <div id={`prop-${i}-area-err`} className="field-hint" role="alert" style={{ marginTop: 4, color: "var(--c-danger)" }}>
                  면적은 0보다 큰 숫자만 입력하세요 (㎡ 단위는 자동 표기 — 이 값으로는 서류를 생성할 수 없습니다).
                </div>
              )}
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
