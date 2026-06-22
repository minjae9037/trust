"use client";

import { useContractStore } from "@/lib/store/contractStore";
import { fmtKRW, daysInMonth, isPositiveAmount, isValidRatio, parseAmount, amountToHangul } from "@/lib/engine/calc";

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
  // 표시 억제(cross-screen 정합) — 우선수익한도금액·신탁보수율은 STEP 02-1 의 비율(priorityRatio)·
  // 대출금액으로 recalcDerived 가 자동 산정해 이 화면(STEP 05)에 그대로 미러링한다. 그런데
  // recalcDerived 는 범위 밖(100~150%) 비율도 `parseAmount(ratio)||120` 로 곱해 한도를 산정하므로
  // (예: 200% → 대출금액×2), 무효 비율을 입력하면 StepLoanCalc 한도 셀은 "—"로 억제되는데 이 화면의
  // 한도금액 readonly·보수율·요약은 그 잘못된 큰 값을 자신 있게 표시하던 모순이 있었다(비율 인라인
  // 오류는 StepLoanCalc 에만 존재 → 이 화면엔 무효 신호가 전무). 게이트(validateDoc)와 같은 단일
  // 출처 isValidRatio 를 재사용해, 비율이 무효이거나 산정 한도가 양(+)이 아니면 한도금액·보수율·요약을
  // 억제한다(빌더·조문·게이트 판정·데이터 모델 무접촉 — 표시/접근성만, StepLoanCalc 무효 비율 표시
  // 억제와 동형 패리티).
  const ratioInvalid = !isValidRatio(c.priorityRatio);
  const limitShowable = !ratioInvalid && isPositiveAmount(c.priorityLimit);
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
        <input id="basic-priorityLimit" className="input" readOnly value={limitShowable ? Number(c.priorityLimit).toLocaleString() + " 원" : ""}
          placeholder={ratioInvalid ? "우선수익한도 비율 확인 필요 — 산정 보류" : "STEP 02-1 에서 자동 산정됨"}
          aria-describedby={ratioInvalid ? "basic-priorityLimit-note" : undefined}
          style={{ background: "var(--c-paper-soft)" }} />
        {ratioInvalid && (
          <div id="basic-priorityLimit-note" className="field-hint" role="note" style={{ color: "var(--c-danger)" }}>
            우선수익한도 비율이 유효 범위(100~150%)를 벗어나 한도금액·보수율 산정이 보류됩니다 — STEP 02-1 에서 비율을 고치면 다시 산정됩니다.
          </div>
        )}
      </div>

      <div className="field">
        <label className="field-label" htmlFor="basic-trustFee">신탁보수 (원) <span className="req">*</span></label>
        <div className="field-hint">협의된 신탁보수 금액(숫자만).</div>
        <input id="basic-trustFee" className="input" type="number" value={c.trustFee} placeholder="예) 50000000"
          onChange={(e) => updateCommon({ trustFee: e.target.value })}
          aria-invalid={feeInvalid || undefined}
          aria-describedby={feeInvalid ? "basic-trustFee-err" : undefined} />
        {/* 한글 금액 readback — 신탁보수는 별첨3 보수액·신탁보수율 자동산정에 쓰이는 법적 금액인데,
            대출금액(StepLoanCalc·PartyCard)·부동산 가격·원본가액(DocStep) 등 다른 모든 금액 입력은
            amountToHangul 로 한글 금액을 에코해 자릿수 오입력(0 하나 누락 등)을 입력 지점에서 짚어 주나
            신탁보수만 readback 이 없어 "오천만원정↔오백만원정"을 구별할 수 없던 마지막 금액 입력 갭.
            StepLoanCalc·PartyCard 와 동일한 단일 출처(parseAmount>0 일 때 amountToHangul)·동일 loan-hangul
            클래스 재사용(새 CSS 0). feeInvalid(0·음수·비숫자)와는 parseAmount 부호로 상호배타 — 무효면
            미노출. 빌더·조문·게이트 무접촉(표시/접근성만). */}
        {parseAmount(c.trustFee) > 0 && (
          <div className="loan-hangul" role="status" aria-live="polite">{amountToHangul(c.trustFee)}</div>
        )}
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
        <input id="basic-trustFeeRate" className="input" readOnly value={limitShowable && c.trustFeeRate ? c.trustFeeRate + " %" : ""}
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
          <strong>요약</strong> 우선수익한도금액 {limitShowable ? fmtKRW(c.priorityLimit) : "—"} ·{" "}
          신탁보수 {feeInvalid ? "—" : fmtKRW(c.trustFee)} ·
          보수율 {limitShowable && c.trustFeeRate ? c.trustFeeRate + " %" : "(대기)"}
        </div>
      </div>
    </div>
  );
}
