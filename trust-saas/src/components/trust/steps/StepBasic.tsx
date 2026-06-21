"use client";

import { useContractStore } from "@/lib/store/contractStore";
import { fmtKRW, daysInMonth } from "@/lib/engine/calc";

export function StepBasic() {
  const { form, updateCommon } = useContractStore();
  const c = form.common;
  const years: number[] = [];
  for (let y = 2020; y <= 2030; y++) years.push(y);

  // 일(日) 드롭다운은 선택한 연·월의 유효일만 노출(2월 28/29·소월 30) → 2월 31일 등
  // 실재하지 않는 체결일을 애초에 만들 수 없게 한다(법적 효력 문서의 정확성 보장).
  const maxDay = daysInMonth(c.year, c.month);
  // 연·월을 바꿔 현재 일이 그 달에 없으면(예: 1/31 → 2월) 일을 말일로 보정한다.
  const clampDay = (y: number, mo: number) =>
    typeof c.day === "number" && c.day > daysInMonth(y, mo) ? { day: daysInMonth(y, mo) } : {};
  const setYear = (y: number) => updateCommon({ year: y, ...clampDay(y, c.month) });
  const setMonth = (mo: number) => updateCommon({ month: mo, ...clampDay(c.year, mo) });

  return (
    <div className="field-grid">
      <div className="field full">
        <div className="field-label">
          계약 체결일자 <span className="req">*</span>
        </div>
        <div className="field-hint">5종 서류 전체에 자동 반영. 일(日)이 미정이면 비워둘 수 있습니다.</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
          <select className="select" value={c.year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span>년</span>
          <select className="select" value={c.month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <span>월</span>
          <select
            className="select"
            value={c.day === "" ? "" : c.day}
            onChange={(e) => updateCommon({ day: e.target.value === "" ? "" : Number(e.target.value) })}
          >
            <option value="">미정</option>
            {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <span>일</span>
        </div>
      </div>

      <div className="field">
        <div className="field-label">
          우선수익한도금액 (원) <span className="badge ready" style={{ marginLeft: 6 }}>🔒 자동</span>
        </div>
        <div className="field-hint">STEP 02-1 에서 자동 산정.</div>
        <input className="input" readOnly value={c.priorityLimit ? Number(c.priorityLimit).toLocaleString() + " 원" : ""}
          placeholder="STEP 02-1 에서 자동 산정됨" style={{ background: "var(--c-paper-soft)" }} />
      </div>

      <div className="field">
        <div className="field-label">신탁보수 (원) <span className="req">*</span></div>
        <div className="field-hint">협의된 신탁보수 금액(숫자만).</div>
        <input className="input" type="number" value={c.trustFee} placeholder="예) 50000000"
          onChange={(e) => updateCommon({ trustFee: e.target.value })} />
      </div>

      <div className="field full">
        <div className="field-label">
          신탁보수율 (우선수익한도금액 대비 %) <span className="badge ready" style={{ marginLeft: 6 }}>🔒 자동</span>
        </div>
        <div className="field-hint">신탁보수 ÷ 우선수익한도금액 × 100 자동 산정.</div>
        <input className="input" readOnly value={c.trustFeeRate ? c.trustFeeRate + " %" : ""}
          placeholder="신탁보수·한도금액 입력 시 자동 계산" style={{ background: "var(--c-paper-soft)" }} />
      </div>

      <div className="field full">
        <div className="field-label">신탁기간 <span className="req">*</span></div>
        <input className="input" value={c.trustPeriod} onChange={(e) => updateCommon({ trustPeriod: e.target.value })} />
      </div>

      <div className="field full">
        <div className="panel-footnote warn">
          <strong>요약</strong> 우선수익한도금액 {fmtKRW(c.priorityLimit)} · 신탁보수 {fmtKRW(c.trustFee)} ·
          보수율 {c.trustFeeRate ? c.trustFeeRate + " %" : "(대기)"}
        </div>
      </div>
    </div>
  );
}
