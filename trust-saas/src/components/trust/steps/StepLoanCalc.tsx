"use client";

import { useContractStore } from "@/lib/store/contractStore";
import { amountToHangul, isPositiveAmount, isValidRatio, parseAmount, priorityLimitFor, totalLoan, totalPriorityLimit } from "@/lib/engine/calc";

export function StepLoanCalc() {
  const { form, updateParty, updateCommon } = useContractStore();
  const ratio = parseAmount(form.common.priorityRatio) || 120;
  // 인라인 검증 — 범위 밖(100~150%) 비율은 게이트(validateDoc)가 생성을 차단하지만, 그 사실을
  // 입력 지점에서 즉시 알리지 않으면 아래 한도표가 `대출금액 × 비율`로 산출한 잘못된 금액을
  // 굵게 표시해 사용자가 신뢰할 위험이 있다. 게이트와 같은 단일 출처(isValidRatio)를 재사용해
  // 판정 불일치 없이 그 입력 옆에서 즉시 짚어 준다(PartyCard·JointForm 인라인 패리티, 표시/접근성만).
  // ★ ratioInvalid 일 때는 인라인 오류만 띄우는 데 그치지 않고, 한도표의 개별·합계 우선수익한도금액과
  //   산식 footnote 도 "—"/보류로 억제한다 — 무효 비율로 산출된 굵은(brown) 큰 금액을 그대로 보여 주면
  //   인라인 오류와 모순되는 "확신 있어 보이는 잘못된 값"이 남기 때문(개별 대출금액 무효 시 한도 셀을
  //   "—" 로 억제하는 것과 동형의 정확성 패리티). 게이트는 무접촉(표시 전용).
  const ratioInvalid = !isValidRatio(form.common.priorityRatio);

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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
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
            <label htmlFor="loan-priorityRatio" style={{ fontSize: 12, fontWeight: 600, color: "var(--c-ink-soft)" }}>
              우선수익한도 비율
            </label>
            <input
              id="loan-priorityRatio"
              className="input"
              type="number"
              min={100}
              max={150}
              value={form.common.priorityRatio}
              onChange={(e) => updateCommon({ priorityRatio: Number(e.target.value) || 120 })}
              aria-invalid={ratioInvalid || undefined}
              aria-describedby={ratioInvalid ? "loan-priorityRatio-err" : undefined}
              style={{ width: 74, textAlign: "center", fontWeight: 700 }}
            />
            <span style={{ fontWeight: 700 }}>%</span>
          </div>
          {ratioInvalid && (
            <div
              id="loan-priorityRatio-err"
              className="field-hint"
              role="alert"
              style={{ color: "var(--c-danger)", maxWidth: 280, textAlign: "right" }}
            >
              100~150% 범위를 벗어난 비율입니다 — 이 값으로는 서류를 생성할 수 없습니다.
            </div>
          )}
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
            {/* 한도표는 우선수익한도금액(법적 금액)을 회사·열별로 보여주는 데이터 표다.
                scope 속성이 없으면 스크린리더가 임의 셀(예: 한도금액 12,000,000,000 원)을
                읽을 때 그것이 어느 열(대출금액↔한도금액)·어느 회사(행)에 속하는지 안정적으로
                고지하지 못한다(WCAG 1.3.1). 열 헤더엔 scope="col", 행 식별자(회사명)·합계
                라벨은 <th scope="row"> 로 두어 각 금액 셀을 열·행 헤더에 명시 연결한다.
                값·산식·게이트·산출물 무접촉 — 표 의미구조(시각 무변경)만. */}
            <tr style={{ background: "var(--c-paper-soft)" }}>
              <th scope="col" style={th}>NO</th>
              <th scope="col" style={{ ...th, textAlign: "left" }}>회사명</th>
              <th scope="col" style={{ ...th, textAlign: "right" }}>대출금액 (원)</th>
              <th scope="col" style={{ ...th, textAlign: "right", color: "var(--c-brown)" }}>
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
                // 인라인 검증 — 게이트(validateDoc)는 "채웠지만 0·음수·비숫자"인 개별 대출금액을
                // 이미 차단하나(우선수익자 N 대출금액 유효하지 않은 금액), 그 사실을 이 입력 옆에서
                // 즉시 알리지 않으면 같은 행의 우선수익한도금액(= 대출금액 × 비율)이 음수/잘못된
                // 금액으로 굵게 표시돼 사용자가 신뢰할 위험이 있다. 게이트와 같은 단일 출처
                // (hasText && !isPositiveAmount)를 재사용해 판정 불일치 없이 즉시 짚어 준다
                // (priorityRatio·PartyCard·JointForm 인라인 패리티, 표시/접근성만). 빈 값은 합계
                // 검사가 커버하므로 미표시(나그 방지) — 게이트와 동일.
                const loanFilled = String(p.loanAmount ?? "").trim().length > 0;
                const loanInvalid = loanFilled && !isPositiveAmount(p.loanAmount);
                return (
                  <tr key={i}>
                    <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{i + 1}</td>
                    {/* 회사명 = 행 식별자 → th scope="row"(같은 행의 대출금액·한도금액 셀이
                        어느 회사 것인지 SR 에 연결). th 기본(가운데·굵게) 대신 기존 td 외형
                        (좌측·보통 굵기)을 명시해 시각 무변경. */}
                    <th scope="row" style={{ ...td, textAlign: "left", fontWeight: 400 }}>
                      {p.name || "(STEP 02 에서 이름 입력)"}
                    </th>
                    <td style={{ ...td, textAlign: "right" }}>
                      <input
                        className="input"
                        type="number"
                        value={p.loanAmount}
                        placeholder="0"
                        aria-label={`${p.name || `우선수익자 ${i + 1}`} 대출금액`}
                        aria-invalid={loanInvalid || undefined}
                        aria-describedby={loanInvalid ? `loan-amount-err-${i}` : undefined}
                        onChange={(e) => updateParty("priorities", i, { loanAmount: e.target.value })}
                        style={{ textAlign: "right" }}
                      />
                      {parseAmount(p.loanAmount) > 0 && (
                        <div className="loan-hangul" role="status" aria-live="polite">{amountToHangul(p.loanAmount)}</div>
                      )}
                      {loanInvalid && (
                        <div
                          id={`loan-amount-err-${i}`}
                          className="field-hint"
                          role="alert"
                          style={{ color: "var(--c-danger)", textAlign: "right" }}
                        >
                          유효하지 않은 금액입니다 — 이 값으로는 서류를 생성할 수 없습니다.
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "var(--c-brown)" }}>
                      {isPositiveAmount(p.loanAmount) && !ratioInvalid ? (
                        <>
                          {limit.toLocaleString() + " 원"}
                          <div className="loan-hangul">{amountToHangul(limit)}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {form.priorities.length > 0 && (
            <tfoot>
              <tr style={{ background: "var(--c-paper-soft)" }}>
                <th scope="row" colSpan={2} style={{ ...td, textAlign: "right", fontWeight: 700 }}>
                  합계
                </th>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>
                  {totalLoan(form).toLocaleString()} 원
                  {totalLoan(form) > 0 && (
                    <div className="loan-hangul">{amountToHangul(totalLoan(form))}</div>
                  )}
                </td>
                <td style={{ ...td, textAlign: "right", fontWeight: 800, color: "var(--c-brown)" }}>
                  {ratioInvalid ? (
                    "—"
                  ) : (
                    <>
                      {totalPriorityLimit(form).toLocaleString()} 원
                      {totalPriorityLimit(form) > 0 && (
                        <div className="loan-hangul">{amountToHangul(totalPriorityLimit(form))}</div>
                      )}
                    </>
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="panel-footnote" style={{ marginTop: 18 }}>
        <strong>📊 산식</strong> 우선수익한도금액 = 대출금액 × {ratioInvalid ? "비율" : `${form.common.priorityRatio}%`} ·{" "}
        {ratioInvalid
          ? "비율이 유효 범위(100~150%)를 벗어나 한도금액 산정이 보류됩니다 — 비율을 고치면 다시 산정됩니다."
          : "산정된 합계는 STEP 04 의 우선수익한도금액에 자동 반영됩니다."}
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
