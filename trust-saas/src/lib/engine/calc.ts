/* ================================================================
   자동 계산 + 숫자/금액 포맷 헬퍼 — 참조 HTML 이식
   우선수익한도금액 = 대출금액 × 비율(%) / 100
   신탁보수율 = 신탁보수 ÷ 우선수익한도금액 × 100
   ================================================================ */
import type { ContractForm, Party } from "./model";

/** 문자열 금액에서 숫자만 추출 */
export function parseAmount(v: string | number | null | undefined): number {
  const n = Number(String(v == null ? "" : v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** 우선수익자 1인의 한도금액 */
export function priorityLimitFor(p: Party, ratio: number): number {
  const loan = parseAmount(p.loanAmount);
  return Math.round((loan * (ratio || 120)) / 100);
}

/** 전체 대출금액 합계 */
export function totalLoan(form: ContractForm): number {
  return form.priorities.reduce((s, p) => s + parseAmount(p.loanAmount), 0);
}

/** 전체 우선수익한도금액 합계 (= common.priorityLimit 자동 산정값) */
export function totalPriorityLimit(form: ContractForm): number {
  const ratio = parseAmount(form.common.priorityRatio) || 120;
  return Math.round((totalLoan(form) * ratio) / 100);
}

/** 신탁보수율(%) 문자열. 산정 불가 시 "" */
export function trustFeeRate(form: ContractForm): string {
  const fee = parseAmount(form.common.trustFee);
  const limit = parseAmount(form.common.priorityLimit);
  if (!(fee > 0 && limit > 0)) return "";
  const rate = (fee / limit) * 100;
  return rate.toFixed(4).replace(/\.?0+$/, "");
}

/**
 * 폼의 자동 산정 필드(priorityLimit, trustFeeRate)를 다시 계산해 반영.
 * 우선수익자 대출금액·비율·신탁보수 변경 시 호출.
 */
export function recalcDerived(form: ContractForm): ContractForm {
  const priorityLimit = totalPriorityLimit(form);
  const next: ContractForm = {
    ...form,
    common: {
      ...form.common,
      priorityLimit: priorityLimit ? String(priorityLimit) : "",
    },
  };
  next.common.trustFeeRate = trustFeeRate(next);
  return next;
}

/* ---------------- 포맷 헬퍼 ---------------- */

/** "1,234,567 원" (빈 값이면 "(미입력)") */
export function fmtKRW(v: string | number | null | undefined): string {
  const n = parseAmount(v);
  return n ? n.toLocaleString() + " 원" : "(미입력)";
}

/** "₩1,234,567.-" (빈 값이면 "") */
export function fmtAmountKRW(v: string | number | null | undefined): string {
  const n = parseAmount(v);
  if (!n) return "";
  return "₩" + n.toLocaleString() + ".-";
}

/** 숫자 → 한글 금액 ("일억이천삼백사십오만육천칠백팔십구원정") */
export function amountToHangul(amount: string | number | null | undefined): string {
  if (amount == null || amount === "") return "";
  let n = parseInt(String(amount).replace(/[^\d-]/g, ""), 10);
  if (!Number.isFinite(n) || n === 0) return "영원정";
  const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const positions4 = ["", "십", "백", "천"];
  const positions = ["", "만", "억", "조", "경"];
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 10000);
    n = Math.floor(n / 10000);
  }
  let out = "";
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;
    let s = "";
    const gs = String(g);
    for (let j = 0; j < gs.length; j++) {
      const d = parseInt(gs[j], 10);
      const pos = gs.length - 1 - j;
      if (d > 0) s += digits[d] + positions4[pos];
    }
    out += s + positions[i];
  }
  return out + "원정";
}

/** HTML 이스케이프 (print 빌더에서 사용) */
export function escHTML(s: string | number | null | undefined): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
