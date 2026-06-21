/* ================================================================
   자동 계산 + 숫자/금액 포맷 헬퍼 — 참조 HTML 이식
   우선수익한도금액 = 대출금액 × 비율(%) / 100
   신탁보수율 = 신탁보수 ÷ 우선수익한도금액 × 100
   ================================================================ */
import type { ContractForm, Party, PartyType } from "./model";

/** 문자열 금액에서 숫자만 추출 */
export function parseAmount(v: string | number | null | undefined): number {
  const n = Number(String(v == null ? "" : v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * 유효한 "양(+)의 금액"인지 — 가격·원본가액·대출금액 등 신탁 서류에 들어가는
 * 모든 금액의 단일 유효성 출처. parseAmount 와 정합(쉼표·공백 허용, 비숫자·0·음수는 무효).
 * 신탁 서류는 법적 효력 문서 — "미정"·"0"·"-5000" 같은 값이 가격칸에 산출물로
 * 박히지 않도록(빌더가 0/음수를 빈칸·잘못된 금액으로 렌더) 게이트가 한 번 더 검사한다.
 */
export function isPositiveAmount(v: string | number | null | undefined): boolean {
  return parseAmount(v) > 0;
}

/**
 * 우선수익한도 비율(%)이 표준 업무 범위(100~150%)의 유효한 값인지 — 비율은 우선수익한도금액
 * (= 대출금액 × 비율)을 좌우하는 법적 서류상 핵심 수치(별첨2/3·appform 한도표·valReport)다.
 * 빌더가 실제 사용하는 값(`parseFloat(ratio) || 120`)과 정합하도록 `parseAmount(v) || 120`를
 * 검사한다 → 0·빈 값·비숫자는 기본 120%로 처리되어 통과(무회귀), 음수·범위 밖(예: -50·200·1200)
 * 만 무효. 입력 위젯(min/max는 타이핑을 막지 못함)을 우회한 import·구버전·AI 머지 값까지 차단한다.
 */
export function isValidRatio(v: string | number | null | undefined): boolean {
  const eff = parseAmount(v) || 120;
  return eff >= 100 && eff <= 150;
}

/**
 * 유효한 사업자등록번호(10자리)인지 — 국세청 표준 체크섬 알고리즘.
 * ⚠️ 추정 형식이 아니라 국가 표준 검증식이다(날짜의 윤년 규칙과 동일 성격). 신탁 서류의 관계사
 * 표(신청서 partyTable·별첨)에 각 당사자의 사업자등록번호가 그대로 박히므로(builders.js),
 * 오타로 체크섬이 깨진 번호가 법적 서류에 들어가지 않도록 게이트가 한 번 더 검사한다.
 * 숫자만 추출해 **정확히 10자리 + 체크섬 일치**해야 true. 빈 값·자릿수 불일치·체크섬 불일치는
 * false(게이트가 "입력됐는지(빈 값 제외)"를 별도 판단 → 빈 값은 검사 대상에서 제외해 무회귀).
 */
export function isValidBizNo(v: string | number | null | undefined): boolean {
  const d = String(v == null ? "" : v).replace(/\D/g, "");
  if (d.length !== 10) return false;
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * w[i];
  sum += Math.floor((Number(d[8]) * 5) / 10);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(d[9]);
}

/**
 * 유효한 법인등록번호(13자리)인지 — 대한민국 표준 검증 알고리즘.
 * ⚠️ 추정 형식이 아니라 국가 표준 검증식이다(사업자번호 국세청 체크섬·날짜 윤년 규칙과 동일 성격).
 * 신탁 서류의 관계사 표(신청서 partyTable·계약서 본문·별첨)에 각 "법인" 당사자의 법인등록번호가
 * 그대로 박히므로(builders.js), 오타로 체크섬이 깨진 번호가 법적 서류에 들어가지 않도록 게이트가
 * 한 번 더 검사한다. 숫자만 추출해 **정확히 13자리 + 체크섬 일치**해야 true.
 * 검증식: 앞 12자리에 가중치 [1,2,1,2,…] 를 곱해 합산, 검증값 = (10 − 합%10) % 10 이 13번째 자리와 일치.
 * (앱 내 실재 상수 `110111-7125720` 로 검증 — 합 40, 검증값 0 = 13번째 자리 0 일치.)
 * 빈 값·자릿수 불일치·체크섬 불일치는 false(게이트가 "입력됐는지(빈 값 제외)"·"법인 여부"를 별도 판단).
 * ※ 개인 당사자는 이 칸이 생년월일로 렌더되므로(builders.js: type==="개인"→"생년월일") 호출 측에서
 *    법인(type) 일 때만 검사한다 — 개인 생년월일에 13자리 체크섬을 적용하지 않는다.
 */
export function isValidCorpRegNo(v: string | number | null | undefined): boolean {
  const d = String(v == null ? "" : v).replace(/\D/g, "");
  if (d.length !== 13) return false;
  const w = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * w[i];
  const check = (10 - (sum % 10)) % 10;
  return check === Number(d[12]);
}

/**
 * 유효한 부동산 등기 고유번호(14자리) "형식"인지 — 신탁부동산 표(신청서 partyTable·계약서 별지)에
 * 각 부동산의 등기 고유번호가 그대로 박히므로(builders.js: tc(p.regNo)), 자릿수가 맞지 않는
 * (오타·부분 입력) 번호가 법적 서류에 들어가지 않도록 게이트가 한 번 더 검사한다.
 * 부동산 등기 고유번호는 4-4-6 = 정확히 14자리 형식이다(앱 OCR `parsePropertyRegistry`·
 * `extractIdentifiers` 정규식 `\d{4}-\d{4}-\d{6}` 와 동일 출처). 숫자만 추출해 정확히 14자리면 true.
 * ⚠️ 사업자번호·법인번호와 달리 **공개 표준 체크섬 알고리즘이 존재하지 않으므로** 체크섬을 임의로
 *    만들지 않는다(추정 금지 — 유효한 실제 번호를 오탐 차단할 위험). 따라서 "형식 완결성"(14자리)만
 *    검사한다. 빈 값·자릿수 불일치는 false(게이트가 "입력됐는지(빈 값 제외)"를 별도 판단 → 빈 값은
 *    검사 대상에서 제외해 무회귀).
 */
export function isValidRegNo(v: string | number | null | undefined): boolean {
  return String(v == null ? "" : v).replace(/\D/g, "").length === 14;
}

/**
 * 개인 당사자 식별번호 칸은 산출물에 "생년월일"로 렌더된다(builders.js: type==="개인"→"생년월일").
 * 그 값은 주민등록번호 구조(앞 6자리=생년월일 YYMMDD, 뒤 7자리: 첫 자리=성별·세기 코드)이므로,
 * 게이트가 법인=법인등록번호 체크섬만 검사하고 개인 식별번호는 전혀 검사하지 않아 "991332"·"000000"
 * 같은 실재하지 않는 생년월일이 법적 서류에 그대로 박힐 수 있었다(법인=체크섬과 대칭되는 마지막 갭).
 *
 * ⚠️ 주민등록번호 체크섬은 2020.10 이후 임의 부여로 폐지돼 공개 검증식이 존재하지 않으므로,
 *    등기 고유번호(isValidRegNo)와 동일하게 **추정 체크섬을 만들지 않는다**(유효한 실제 번호 오탐 차단
 *    방지). 대신 앞 6자리가 **실재하는 달력상 생년월일(YYMMDD)인지**만 검사한다 — 계약 체결일과 동일한
 *    daysInMonth/isRealDate 단일 출처를 재사용한다(추정 형식 아닌 달력 규칙·전송 없는 로컬 검증).
 *    윤년 2월 29일을 정확히 판정하기 위해 세기는 뒤 7자리 첫 자리(국가 표준 세기·성별 코드:
 *    1·2·5·6→1900s, 3·4·7·8→2000s, 9·0→1800s)로 해석하되, 뒤 7자리가 아직 없으면 윤년 가능
 *    연도(2000)로 처리해 정상 입력(예: 000229)을 오탐하지 않는다.
 *
 * 앞 6자리가 정확히 채워졌고(=6자리) 그 6자리가 실재하는 날짜일 때만 true. 빈 값·자릿수 불일치·
 * 실재하지 않는 날짜는 false(게이트가 "입력됐는지(빈 값 제외)"·"개인 여부"를 별도 판단).
 */
export function isValidBirthDate(
  front: string | number | null | undefined,
  back?: string | number | null,
): boolean {
  const f = String(front == null ? "" : front).replace(/\D/g, "");
  if (f.length !== 6) return false;
  const yy = Number(f.slice(0, 2));
  const month = Number(f.slice(2, 4));
  const day = Number(f.slice(4, 6));
  const b = String(back == null ? "" : back).replace(/\D/g, "");
  const c = b[0];
  let fullYear: number;
  if (c === "9" || c === "0") fullYear = 1800 + yy;
  else if (c === "3" || c === "4" || c === "7" || c === "8") fullYear = 2000 + yy;
  else if (c === "1" || c === "2" || c === "5" || c === "6") fullYear = 1900 + yy;
  else fullYear = 2000; // 세기 코드 미입력/불명 → 윤년 가능 연도(2월 29일 정상 입력 오탐 방지)
  return isRealDate(fullYear, month, day);
}

/**
 * 당사자 식별번호 칸의 라벨 — 빌더(builders.js)가 `type==="개인" ? "생년월일" : "법인등록번호"`로
 * 렌더하는 분기와 **동일한 단일 출처**다(계약서 본문·별첨 표: builders.js 962·976·1075·2095).
 * 입력 UI(PartyCard)가 이 라벨을 사용해 "입력 시 보는 이름(법인등록번호) ≠ 산출물에 박히는
 * 이름(개인=생년월일)" 불일치를 없앤다(법적 서류 도구의 입력↔출력 정합성). 표 키 라벨일 뿐
 * 조문(verbatim 특약/조문)은 무접촉이며, 데이터 형식·저장 구조는 그대로다(라벨 표시만).
 */
export function partyIdLabel(type: PartyType | undefined): string {
  return type === "개인" ? "생년월일" : "법인등록번호";
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

/* ---------------- 날짜 유효성 ---------------- */

/**
 * 해당 연·월의 마지막 날(28~31). 윤년(4의 배수, 단 100의 배수는 제외하되 400의 배수는 포함)
 * 규칙으로 2월을 28/29로 산정한다. 계약 체결일 입력(일 드롭다운)·검증의 단일 출처.
 */
export function daysInMonth(year: number, month: number): number {
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return 31;
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * 실재하는 달력상 날짜인지(예: 2026-02-31·2026-04-31 은 false).
 * 신탁계약서는 법적 효력 문서 — 존재하지 않는 체결일이 산출물에 들어가지 않도록 검사한다.
 */
export function isRealDate(
  year: number,
  month: number,
  day: number | "",
): boolean {
  if (typeof day !== "number" || !Number.isFinite(year) || !Number.isFinite(month)) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

/** HTML 이스케이프 (print 빌더에서 사용) */
export function escHTML(s: string | number | null | undefined): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
