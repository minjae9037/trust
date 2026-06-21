"use client";

import { useContractStore } from "@/lib/store/contractStore";
import { fmtKRW, daysInMonth, isPositiveAmount } from "@/lib/engine/calc";

export function StepBasic() {
  const { form, updateCommon } = useContractStore();
  const c = form.common;
  // 인라인 검증 — 신탁보수는 "채웠지만 0·음수·비숫자"면 게이트(validateDoc)가 생성을 차단하나
  // (별첨3 보수액이 ₩-5,000.- 같은 잘못된 금액으로 박히는 것을 막음, verify-trustfee-validity),
  // 그 사실을 입력 지점에서 즉시 알리지 않으면 같은 화면의 요약·보수율이 잘못된 값으로 보이고
  // 무엇이 왜 막혔는지는 Doc 단계까지 가야 알 수 있다. 게이트와 같은 단일 출처(isPositiveAmount)와
  // 같은 "채움" 조건(hasText)을 재사용해 판정 불일치 없이 그 입력 옆에서 즉시 짚어 준다
  // (StepLoanCalc 비율·PartyCard·JointForm 인라인 패리티, 표시/접근성만 — 빌더·조문·게이트 무접촉).
  const feeFilled = typeof c.trustFee === "string" && c.trustFee.trim().length > 0;
  const feeInvalid = feeFilled && !isPositiveAmount(c.trustFee);
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
        {/* 체결일자는 년·월·일 3개 select 의 묶음이라 단일 htmlFor 가 부적합 →
            라벨 div 에 id 를 주고 select 묶음을 role="group" aria-labelledby 로 연결,
            각 select 에는 년/월/일 aria-label 부여(스크린리더 개별 접근명). */}
        <div className="field-label" id="basic-contractDate">
          계약 체결일자 <span className="req">*</span>
        </div>
        <div className="field-hint">5종 서류 전체에 자동 반영. 일(日)이 미정이면 비워둘 수 있습니다.</div>
        <div role="group" aria-labelledby="basic-contractDate" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
          <select className="select" aria-label="년" value={c.year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span>년</span>
          <select className="select" aria-label="월" value={c.month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <span>월</span>
          <select
            className="select"
            aria-label="일"
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
        <label className="field-label" htmlFor="basic-priorityLimit">
          우선수익한도금액 (원) <span className="badge ready" style={{ marginLeft: 6 }}>🔒 자동</span>
        </label>
        <div className="field-hint">STEP 02-1 에서 자동 산정.</div>
        <input id="basic-priorityLimit" className="input" readOnly value={c.priorityLimit ? Number(c.priorityLimit).toLocaleString() + " 원" : ""}
          placeholder="STEP 02-1 에서 자동 산정됨" style={{ background: "var(--c-paper-soft)" }} />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="basic-trustFee">신탁보수 (원) <span className="req">*</span></label>
        <div className="field-hint">협의된 신탁보수 금액(숫자만).</div>
        <input id="basic-trustFee" className="input" type="number" value={c.trustFee} placeholder="예) 50000000"
          onChange={(e) => updateCommon({ trustFee: e.target.value })}
          aria-invalid={feeInvalid || undefined}
          aria-describedby={feeInvalid ? "basic-trustFee-err" : undefined} />
        {feeInvalid && (
          <div id="basic-trustFee-err" className="field-hint" role="alert" style={{ color: "var(--c-danger)" }}>
            유효하지 않은 신탁보수입니다 — 0보다 큰 숫자만 입력할 수 있습니다 (이 값으로는 서류를 생성할 수 없습니다).
          </div>
        )}
      </div>

      <div className="field full">
        <label className="field-label" htmlFor="basic-trustFeeRate">
          신탁보수율 (우선수익한도금액 대비 %) <span className="badge ready" style={{ marginLeft: 6 }}>🔒 자동</span>
        </label>
        <div className="field-hint">신탁보수 ÷ 우선수익한도금액 × 100 자동 산정.</div>
        <input id="basic-trustFeeRate" className="input" readOnly value={c.trustFeeRate ? c.trustFeeRate + " %" : ""}
          placeholder="신탁보수·한도금액 입력 시 자동 계산" style={{ background: "var(--c-paper-soft)" }} />
      </div>

      <div className="field full">
        <label className="field-label" htmlFor="basic-trustPeriod">신탁기간 <span className="req">*</span></label>
        <input id="basic-trustPeriod" className="input" value={c.trustPeriod} onChange={(e) => updateCommon({ trustPeriod: e.target.value })} />
      </div>

      <div className="field full">
        <div className="panel-footnote warn">
          {/* ★ feeInvalid(채웠지만 0·음수·비숫자)이면 요약의 신탁보수를 "—"로 억제한다 —
              fmtKRW 은 음수를 "-5,000,000 원"으로 그대로 렌더하므로, 위 인라인이 "이 값으로는
              서류를 생성할 수 없습니다"라고 경고하는데 같은 화면 요약이 그 음수 금액을 자신 있게
              표시하면 모순된 "확신 있어 보이는 잘못된 값"이 된다(StepLoanCalc 의 무효 비율 시
              한도금액 표시 억제와 동형의 정확성 패리티). 게이트·산출물 무접촉, 표시 전용. */}
          <strong>요약</strong> 우선수익한도금액 {fmtKRW(c.priorityLimit)} ·{" "}
          신탁보수 {feeInvalid ? "—" : fmtKRW(c.trustFee)} ·
          보수율 {c.trustFeeRate ? c.trustFeeRate + " %" : "(대기)"}
        </div>
      </div>
    </div>
  );
}
