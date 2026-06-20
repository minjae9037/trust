"use client";

import { useContractStore } from "@/lib/store/contractStore";
import { parseAmount, priorityLimitFor, totalLoan, totalPriorityLimit } from "@/lib/engine/calc";

export function StepLoanCalc() {
  const { form, updateParty, updateCommon } = useContractStore();
  const ratio = parseAmount(form.common.priorityRatio) || 120;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 14,
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        <div style={{ fontSize: 12.5, color: "var(--c-ink-soft)", maxWidth: 540 }}>
          STEP 02 의 우선수익자 <strong>대출금액</strong>에 비율(%)을 곱해{" "}
          <strong>우선수익한도금액</strong>이 자동 산정됩니다.
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--c-paper-soft)",
            border: "1px solid var(--c-line-soft)",
            borderRadius: "var(--r-pill)",
            padding: "8px 14px",
          }}
        >
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--c-ink-soft)" }}>
            우선수익한도 비율
          </label>
          <input
            className="input"
            type="number"
            min={100}
            max={150}
            value={form.common.priorityRatio}
            onChange={(e) => updateCommon({ priorityRatio: Number(e.target.value) || 120 })}
            style={{ width: 74, textAlign: "center", fontWeight: 700 }}
          />
          <span style={{ fontWeight: 700 }}>%</span>
        </div>
      </div>

      <div
        style={{
          border: "1px solid var(--c-line)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
          background: "var(--c-paper)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: "var(--c-paper-soft)" }}>
              <th style={th}>NO</th>
              <th style={{ ...th, textAlign: "left" }}>회사명</th>
              <th style={{ ...th, textAlign: "right" }}>대출금액 (원)</th>
              <th style={{ ...th, textAlign: "right", color: "var(--c-brown)" }}>
                우선수익한도금액 (원)
              </th>
            </tr>
          </thead>
          <tbody>
            {form.priorities.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 36, textAlign: "center", color: "var(--c-ink-mute)" }}>
                  STEP 02 에서 우선수익자를 먼저 등록해 주세요.
                </td>
              </tr>
            ) : (
              form.priorities.map((p, i) => {
                const limit = priorityLimitFor(p, ratio);
                return (
                  <tr key={i}>
                    <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{i + 1}</td>
                    <td style={td}>{p.name || "(STEP 02 에서 이름 입력)"}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <input
                        className="input"
                        type="number"
                        value={p.loanAmount}
                        placeholder="0"
                        onChange={(e) => updateParty("priorities", i, { loanAmount: e.target.value })}
                        style={{ textAlign: "right" }}
                      />
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "var(--c-brown)" }}>
                      {parseAmount(p.loanAmount) ? limit.toLocaleString() + " 원" : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {form.priorities.length > 0 && (
            <tfoot>
              <tr style={{ background: "var(--c-paper-soft)" }}>
                <td colSpan={2} style={{ ...td, textAlign: "right", fontWeight: 700 }}>
                  합계
                </td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>
                  {totalLoan(form).toLocaleString()} 원
                </td>
                <td style={{ ...td, textAlign: "right", fontWeight: 800, color: "var(--c-brown)" }}>
                  {totalPriorityLimit(form).toLocaleString()} 원
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="panel-footnote" style={{ marginTop: 18 }}>
        <strong>📊 산식</strong> 우선수익한도금액 = 대출금액 × {form.common.priorityRatio}% · 산정된
        합계는 STEP 04 의 우선수익한도금액에 자동 반영됩니다.
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "13px 14px",
  textAlign: "center",
  borderBottom: "1px solid var(--c-line)",
  fontSize: 12,
  color: "var(--c-ink-soft)",
  fontWeight: 700,
};
const td: React.CSSProperties = {
  padding: "10px 14px",
  borderBottom: "1px solid var(--c-line-faint)",
};
