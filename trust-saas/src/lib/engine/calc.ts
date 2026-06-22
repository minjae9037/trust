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
 * 부동산 등기 고유번호 확인용 readback 문구 — 숫자만 추출해 정확히 14자리일 때, 등기사항증명서
 * 표기와 동일한 **4-4-6 하이픈 묶음**("NNNN-NNNN-NNNNNN")으로 되읽어 준다. 등기 고유번호는
 * 신탁부동산 표(신청서 partyTable·계약서 별지)에 그대로 박히는 14자리 법적 식별자라(builders.js
 * tc(p.regNo)) 한 자리 전치·누락이 치명적인데, 금액 한글·면적 평환산·생년월일·날짜 요일처럼
 * 입력 지점에서 묶음으로 되읽어 사용자가 등기부등본과 눈으로 대조하게 한다. 4-4-6 묶음은 OCR
 * `parsePropertyRegistry`/`extractIdentifiers` 정규식 `\d{4}-\d{4}-\d{6}`·isValidRegNo(14자리)와
 * **동일 출처**라 추정 형식이 아니다(각 묶음의 의미는 주장하지 않음 — 표기 형식만 재현).
 * ⚠️ 정확히 14자리일 때만 묶음 문자열을 돌려주고, 그 외(빈 값·자릿수 불일치)는 ""(미표시) —
 *    isValidRegNo 인라인 오류와 정확히 상호배타(readback ⟺ isValidRegNo true). 표시 전용·게이트·
 *    빌더·조문 무접촉. 입력에 하이픈이 섞여 있어도 숫자만 추출해 표준 묶음으로 정규화한다.
 */
export function formatRegNoReadback(v: string | number | null | undefined): string {
  const digits = String(v == null ? "" : v).replace(/\D/g, "");
  if (digits.length !== 14) return "";
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 14)}`;
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
  // 세기는 birthCentury(뒤 7자리 첫 자리) 단일 출처로 해석. 미입력/불명(null)이면 윤년 가능
  // 연도(2000)로 처리해 정상 입력(예: 000229)을 오탐하지 않는다(기존 동작 보존).
  const base = birthCentury(back);
  const fullYear = base == null ? 2000 : base + yy;
  return isRealDate(fullYear, month, day);
}

/**
 * 주민등록번호 뒤 7자리 첫 자리(국가 표준 세기·성별 코드)로 출생 세기를 해석한다.
 * 1·2·5·6→1900s, 3·4·7·8→2000s, 9·0→1800s. 미입력/불명이면 null(세기 미확정).
 * isValidBirthDate(윤년 판정)·interpretBirthDate(readback)의 세기 해석 단일 출처.
 */
function birthCentury(back?: string | number | null): number | null {
  const b = String(back == null ? "" : back).replace(/\D/g, "");
  const c = b[0];
  if (c === "9" || c === "0") return 1800;
  if (c === "3" || c === "4" || c === "7" || c === "8") return 2000;
  if (c === "1" || c === "2" || c === "5" || c === "6") return 1900;
  return null;
}

/**
 * 개인 당사자 생년월일(주민등록번호 앞 6자리 YYMMDD) 해석 readback 데이터.
 * 앞 6자리가 정확히 채워졌고 실재하는 날짜일 때만 {year, month, day} 반환(아니면 null).
 * 세기 코드(뒤 7자리 첫 자리)가 있으면 year=정수, 없으면 year=null(월·일만 확정).
 * isValidBirthDate 와 같은 birthCentury 단일 출처 — 표시 전용(산출물·게이트·조문 무접촉).
 * 두 valid 한 날짜 사이의 월·일 전치 오입력(예: 030915 vs 090315)을 입력 지점에서 확인시킨다.
 * PII(주민번호)는 사용자가 방금 입력한 로컬 값의 해석일 뿐 전송하지 않는다(기존 원칙 유지).
 */
export function interpretBirthDate(
  front: string | number | null | undefined,
  back?: string | number | null,
): { year: number | null; month: number; day: number } | null {
  const f = String(front == null ? "" : front).replace(/\D/g, "");
  if (f.length !== 6) return null;
  if (!isValidBirthDate(front, back)) return null;
  const yy = Number(f.slice(0, 2));
  const month = Number(f.slice(2, 4));
  const day = Number(f.slice(4, 6));
  const base = birthCentury(back);
  return { year: base == null ? null : base + yy, month, day };
}

/**
 * interpretBirthDate 를 사람이 읽는 문자열로 — 세기 확정 시 "YYYY년 M월 D일생",
 * 미확정(세기 코드 없음) 시 "M월 D일생"(월·일만). 해석 불가면 빈 문자열.
 */
export function formatBirthReadback(
  front: string | number | null | undefined,
  back?: string | number | null,
): string {
  const r = interpretBirthDate(front, back);
  if (!r) return "";
  return r.year == null ? `${r.month}월 ${r.day}일생` : `${r.year}년 ${r.month}월 ${r.day}일생`;
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

/**
 * 우선수익자 표시용 순위 라벨 — 배열 순서(idx)가 곧 법적 우선순위다.
 * 산출물에서 우선수익자 표·날인란이 배열 순서대로 "제N순위 우선수익자"로 박히고
 * (builders.js: 별첨2 표 rank·날인 라벨 `제${i+1}순위 우선수익자`), 본문 제22조 정산
 * 순위·제3조 의사결정(최선순위 우선수익자의 의사)도 이 순서를 따른다. 입력 화면(StepPriority)이
 * 이 라벨을 함께 보여줘 "카드 순서 = 선·후순위"임을 입력 지점에서 명확히 한다.
 * 표시 라벨일 뿐 조문·산출물 코드는 무접촉(빌더 출력 형식·의미와 일치).
 */
export function priorityRankLabel(idx: number): string {
  return `제${idx + 1}순위`;
}

/**
 * 위탁자 표시용 대표 라벨 — 배열 첫 위탁자(idx 0)가 곧 "대표위탁자"다.
 * 산출물에서 별첨4 신탁특약은 첫 위탁자를 "대표위탁자"로 선임해(builders.js
 * representativeTrustor = trustors[0]·annex.ts 동일) 위탁자 전원을 대리하여
 * 신탁해지를 포함한 권한을 행사하게 하고(별첨4 조문), 관계사 표·날인·파일명도
 * 배열 순서를 따른다. 즉 위탁자 배열 순서 = 대표위탁자 결정. 입력 화면(StepParties)이
 * 이 라벨을 함께 보여줘 "맨 위 위탁자 = 대표위탁자"임을 입력 지점에서 명확히 한다.
 * 표시 라벨일 뿐 조문·산출물 코드는 무접촉(빌더 trustors[0] 의미와 일치).
 */
export function trustorRankLabel(idx: number): string {
  return idx === 0 ? "대표위탁자" : "";
}

/**
 * 두 당사자가 같은 법적 주체로 보이는지 — 입력 지점 구조 정합 교차검증(표시 전용)용 순수 비교.
 * 담보신탁에서 위탁자(담보제공자)와 우선수익자(채권자)는 구조적으로 반대편 당사자라 동일 주체일 수
 * 없는데(같은 회사를 양쪽에 잘못 넣는 오입력 가능), 두 목록이 서로 다른 단계에서 입력돼 그 충돌을
 * 짚을 신호가 없었다. 이 헬퍼는 두 Party 의 **이미 입력된 식별자**만 비교한다(새 상태·모델·엔진·조문
 * 무접촉, 게이트 아님). 오탐(false positive)을 막기 위해 **공통으로 사용할 수 있는 가장 강한 식별자
 * 한 가지**만 본다:
 *   ① 두 당사자 모두 사업자번호(3+2+5)가 정확히 10자리로 채워졌으면 → 그 번호의 일치/불일치로 단정
 *      (서로 다르면 다른 주체로 확정 → 이름이 우연히 같아도 일치 아님).
 *   ② 아니고 두 당사자 모두 법인등록번호(6+7)가 정확히 13자리로 채워졌으면 → 그 번호로 단정.
 *   ③ 어느 식별자도 양쪽 모두 완비되지 않았으면 → 이름(trim·비어있지 않음) 일치로만 판단(약한 신호).
 * 반환: 일치 근거("사업자번호"|"법인등록번호"|"이름") 또는 null. 식별번호 형식 유효성(체크섬)은
 * 묻지 않는다 — 동일성(같은 자리 입력) 비교일 뿐이고, 형식 유효성은 각 입력의 인라인 검증이 담당한다.
 */
function bizDigits(p: Party): string {
  const d = (String(p.bizP1 ?? "") + String(p.bizP2 ?? "") + String(p.bizP3 ?? "")).replace(/\D/g, "");
  return d.length === 10 ? d : "";
}
function corpRegDigits(p: Party): string {
  const d = (String(p.corpRegFront ?? "") + String(p.corpRegBack ?? "")).replace(/\D/g, "");
  return d.length === 13 ? d : "";
}
export function samePartyReason(a: Party, b: Party): "사업자번호" | "법인등록번호" | "이름" | null {
  const aBiz = bizDigits(a);
  const bBiz = bizDigits(b);
  if (aBiz && bBiz) return aBiz === bBiz ? "사업자번호" : null;
  const aCorp = corpRegDigits(a);
  const bCorp = corpRegDigits(b);
  if (aCorp && bCorp) return aCorp === bCorp ? "법인등록번호" : null;
  const aName = String(a.name ?? "").trim();
  const bName = String(b.name ?? "").trim();
  if (aName && bName && aName === bName) return "이름";
  return null;
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

/** 한글 요일 표기(일~토) — getUTCDay() 인덱스(0=일) 단일 출처. */
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

/**
 * 실재하는 날짜의 한글 요일("월"~"일")을 돌려준다(실재하지 않으면 "").
 *
 * 평가기준일·회의 일자·협약일 같은 **사건(event) 날짜**는 산출물에 그대로 박히는데,
 * 월·일 전치(03-07↔07-03)는 둘 다 실재해 isRealDate 로는 잡히지 않고, "YYYY년 M월 D일"
 * 에코만으로는 사용자가 머릿속으로 요일을 재확인하기 어렵다. 신탁 실무에서 평가기준일·
 * 이사회 회의일자·협약 체결일이 주말(토·일)에 잡히는 것은 점검이 필요한 신호이므로,
 * 요일을 함께 되읽어 주면 입력 지점에서 그 타당성을 눈으로 교차검증할 수 있다.
 *
 * ⚠️ 표시 전용 — 빌더·조문·게이트 무접촉(생년월일 readback 은 요일이 무의미하므로 대상 아님).
 * TZ 영향이 없도록 UTC 기준으로 계산한다(자정 시각 성분 없음 = 달력 날짜의 요일만 산출).
 */
export function weekdayKo(year: number, month: number, day: number): string {
  if (!isRealDate(year, month, day)) return "";
  return WEEKDAY_KO[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

/**
 * 자유 텍스트 날짜 입력의 "달력 해석" — 평가기준일(valReport)·회의 일자(boardMin)처럼
 * 산출물에 raw 그대로 박히는 자유 텍스트 날짜 필드를 입력 지점에서 확인·교차검증하게 한다
 * (법적 효력 문서의 날짜 정확성).
 *
 * 계약 체결일(년·월·일 드롭다운)은 daysInMonth 클램프로 실재하지 않는 날짜를 애초에 못 만들지만,
 * 자유 텍스트 날짜는 "2025-02-30"(달력에 없음)·"07-03↔03-07"(월·일 전치) 같은 오입력을 짚을
 * 수단이 없었다. 이 함수는 입력이 **명확한 숫자 날짜꼴**일 때만 연·월·일을 해석하고
 * isRealDate 단일 출처로 실재 여부를 함께 돌려준다 — 자유 텍스트 형식을 강제하지 않는다
 * (날짜꼴이 아니면 null 로 무간섭 = 추정 형식 강제 금지 원칙).
 *
 * 인식 조건(보수적 — 오탐 차단): 문자열이 **숫자와 표준 날짜 구분자(. - / 년 월 일 공백)로만**
 * 이뤄지고 숫자 그룹이 **정확히 3개**이며 **첫 그룹이 4자리(연도)** 일 때만 해석한다. 따라서
 * "2025-07-03"·"2025.10.12."·"2025년 7월 1일" 은 해석하고, "해당사항 없음"·전화번호·금액
 * ("5,000,000,000") 같은 free-form 은 null(무간섭).
 *
 * @returns 날짜꼴이면 { year, month, day, real, weekday }(real=실재 달력 날짜 여부,
 *          weekday=실재 시 한글 요일 "월"~"일"·비실재면 ""), 아니면 null.
 */
export function interpretDate(
  raw: string | number | null | undefined,
): { year: number; month: number; day: number; real: boolean; weekday: string } | null {
  const s = String(raw == null ? "" : raw).trim();
  if (!s) return null;
  // 숫자 + 표준 날짜 구분자만 — free-form 텍스트(임의 메모·금액·전화 등)는 무간섭
  if (!/^[\d\s./\-년월일]+$/.test(s)) return null;
  const groups = s.match(/\d+/g);
  if (!groups || groups.length !== 3) return null;
  if (groups[0].length !== 4) return null; // 첫 그룹 = 4자리 연도만(전화·기타 숫자 배제)
  const year = Number(groups[0]);
  const month = Number(groups[1]);
  const day = Number(groups[2]);
  const real = isRealDate(year, month, day);
  return { year, month, day, real, weekday: weekdayKo(year, month, day) };
}

/* ---------------- 신탁기간(날짜 범위) 확인용 해석 ---------------- */

/**
 * 신탁기간 자유 텍스트의 "날짜 범위 해석" — 담보신탁계약서 본문 제3조(verbatim 정본)는
 * 신탁기간을 "…[년][월][일]부터 [년][월][일]까지 로 한다"는 **날짜 범위**로 정의하고,
 * 그 입력값(common.trustPeriod)은 계약서·신청서 표에 raw 그대로 박힌다. 자유 텍스트라
 * ① 종료일이 시작일보다 빠른 역전 ② 주말 시작/종료(점검 신호) ③ 월·일 전치(둘 다 실재라
 * isRealDate 로 안 걸림) ④ 비실재 날짜(2026-02-30)를 입력 지점에서 짚을 수단이 없었다
 * (금액 한글·면적 평환산·사건 날짜 요일 readback 과 같은 표시 전용·비차단 확인 계열의
 * 날짜 범위 확장).
 *
 * 입력이 **명확한 날짜 범위꼴**(숫자 그룹 정확히 6개·첫·넷째 그룹이 4자리 연도)일 때만
 * 시작·종료 두 날짜로 해석하고 isRealDate/weekdayKo 단일 출처로 실재·요일을 함께 돌려준다.
 * 날짜 범위꼴이 아니면 null(무간섭) — 조건부 기간 텍스트("…채권 변제시까지")처럼 한글이
 * 섞인 free-form 은 해석하지 않는다(interpretDate 와 동일한 보수적 인식 = 추정 형식 강제 금지).
 *
 * 인식 조건(오탐 차단): 문자열이 **숫자 + 날짜 구분자(. - / 년 월 일 공백) + 범위 연결어
 * (부터·까지·~)** 로만 이뤄지고 숫자 그룹이 **정확히 6개**이며 첫·넷째 그룹이 4자리일 때.
 * 따라서 "2026년 6월 20일부터 2028년 6월 19일까지"·"2026.6.20 ~ 2028.6.19" 는 해석하고,
 * "담보신탁 등기일로부터 우선수익자 채권 변제시까지" 는 null(무간섭).
 *
 * ⚠️ 표시 전용 — 빌더·조문·게이트 무접촉. 기간은 **총 일수**(시작<종료일 때만, UTC 기준
 * 정확값 = TZ 무영향)만 돌려준다(년·개월 분해는 월경계 클램프로 정의가 갈려 오산 위험 →
 * 정확성 최우선 원칙상 배제).
 *
 * @returns 날짜 범위꼴이면 { start, end, bothReal, endAfterStart, days }, 아니면 null.
 *   start/end = { year, month, day, real, weekday } (interpretDate 와 동형 단일 출처)
 *   bothReal  = 두 날짜 모두 실재 달력 날짜
 *   endAfterStart = 두 날짜 실재이며 종료가 시작보다 뒤(역전·동일 = false)
 *   days      = endAfterStart 일 때만 총 일수(정수), 아니면 null
 */
export function interpretPeriod(
  raw: string | number | null | undefined,
): {
  start: { year: number; month: number; day: number; real: boolean; weekday: string };
  end: { year: number; month: number; day: number; real: boolean; weekday: string };
  bothReal: boolean;
  endAfterStart: boolean;
  days: number | null;
} | null {
  const s = String(raw == null ? "" : raw).trim();
  if (!s) return null;
  // 숫자 + 날짜 구분자 + 범위 연결어(부터·까지·~)만 — 한글이 섞인 조건부 기간은 무간섭
  if (!/^[\d\s./\-년월일부터까지~]+$/.test(s)) return null;
  const groups = s.match(/\d+/g);
  if (!groups || groups.length !== 6) return null;
  if (groups[0].length !== 4 || groups[3].length !== 4) return null; // 첫·넷째 = 4자리 연도만
  const mk = (a: string, b: string, c: string) => {
    const year = Number(a);
    const month = Number(b);
    const day = Number(c);
    return { year, month, day, real: isRealDate(year, month, day), weekday: weekdayKo(year, month, day) };
  };
  const start = mk(groups[0], groups[1], groups[2]);
  const end = mk(groups[3], groups[4], groups[5]);
  const bothReal = start.real && end.real;
  // 두 날짜 모두 실재할 때만 순서·기간 산정(UTC 자정 기준 = TZ·자정 시각 성분 무영향)
  const t0 = bothReal ? Date.UTC(start.year, start.month - 1, start.day) : 0;
  const t1 = bothReal ? Date.UTC(end.year, end.month - 1, end.day) : 0;
  const endAfterStart = bothReal && t1 > t0;
  const days = endAfterStart ? Math.round((t1 - t0) / 86400000) : null;
  return { start, end, bothReal, endAfterStart, days };
}

/**
 * 신탁기간 날짜 범위 readback 문구 — 시작·종료 두 날짜를 한글 요일과 함께 되읽고,
 * 종료가 시작보다 뒤면 총 일수를, 역전/동일이면 점검 안내를, 비실재 날짜면 그 사실을
 * 덧붙인다. 날짜 범위꼴이 아니면 ""(미표시 = 조건부 기간 텍스트엔 무간섭). 표시 전용·
 * 산출물 무접촉. 선두 장식 글리프를 쓰지 않아 컨트롤 접근명/낭독 오염 0.
 * 예: "2026년 6월 20일 (토) → 2028년 6월 19일 (월) · 총 730일".
 */
export function formatPeriodReadback(raw: string | number | null | undefined): string {
  const p = interpretPeriod(raw);
  if (!p) return "";
  const one = (d: { year: number; month: number; day: number; real: boolean; weekday: string }) =>
    `${d.year}년 ${d.month}월 ${d.day}일` + (d.real ? ` (${d.weekday})` : " — 실재하지 않는 날짜");
  let out = `${one(p.start)} → ${one(p.end)}`;
  if (p.bothReal) {
    if (p.endAfterStart) out += ` · 총 ${p.days!.toLocaleString()}일`;
    else out += " · 종료일이 시작일보다 빠르거나 같습니다(확인 필요)";
  }
  return out;
}

/* ---------------- 면적(㎡) 확인용 해석 ---------------- */

/** 1평 = 400/121 ㎡ (척관법 6자×6자 = 36 평방자) — 대한민국 부동산 표준 환산 상수(추정 아님). */
export const SQM_PER_PYEONG = 400 / 121;

/**
 * 면적(㎡) 입력의 "확인용 해석" — 신탁부동산 표(별첨1·신청서·계약서 별지)에 `area + "㎡"`로
 * 그대로 박히는 정량 입력값을, 입력 지점에서 자릿수·규모를 눈으로 검증하게 한다(금액 한글
 * readback 과 같은 철학). ★산출물은 ㎡ 만 표기하고 평 환산은 **입력 확인 표시 전용**이다
 * (빌더·조문 무접촉). 양(+)의 숫자가 아니면 null — 빈 값·0·음수·비숫자는 인라인 무효 안내가
 * 담당하고 이 readback 은 무간섭(상호배타). parseAmount/isPositiveAmount 단일 출처로 콤마·
 * 공백·소수점을 금액 검증과 동일하게 허용한다.
 * @returns 양수면 { sqm, pyeong }, 아니면 null.
 */
export function interpretArea(
  raw: string | number | null | undefined,
): { sqm: number; pyeong: number } | null {
  if (!isPositiveAmount(raw)) return null;
  const sqm = parseAmount(raw);
  return { sqm, pyeong: sqm / SQM_PER_PYEONG };
}

/**
 * 면적 확인용 readback 문구 — "1,234.56㎡ · 약 373.4평"(천단위 콤마·평은 소수 첫째 자리
 * 반올림 근사). 입력이 양(+)의 숫자가 아니면 ""(미표시). 표시 전용·산출물 무접촉.
 */
export function formatAreaReadback(raw: string | number | null | undefined): string {
  const a = interpretArea(raw);
  if (!a) return "";
  const sqm = a.sqm.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const pyeong = a.pyeong.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return `${sqm}㎡ · 약 ${pyeong}평`;
}

/* ---------------- 지분율(%) 확인용 해석 ---------------- */

/**
 * 지분율(%) 입력의 "확인용 해석" — 실제소유자확인서(ubo)의 지분율(uboShare)은 특정금융정보법
 * (특금법)상 실제소유자(25% 이상 지분 보유 자연인)를 식별하는 법적 정량값으로, 산출물 고유정보
 * 표에 raw 그대로 박힌다(builders.js docRows: kvRow("지분율 (%)", raw)). 금액·면적 readback 과
 * 같은 철학으로, 입력이 숫자꼴이면 0~100 범위 여부·실제소유자 기준(25% 이상) 충족 여부를 함께
 * 돌려줘 입력 지점에서 자릿수·규모를 눈으로 확인하게 한다(예: "5"↔"50" 한 자리 오입력 구별).
 * ★표시 전용·비차단 — 게이트(validateDoc)·빌더·조문 무접촉. 숫자꼴이 아니면 null(무간섭 =
 * 자유 텍스트 형식 강제 금지, interpretDate 와 동일한 보수적 인식 = 임의 메모 오탐 차단).
 *
 * 인식 조건(오탐 차단): 문자열이 **숫자 + 소수점·콤마·`%`·공백** 으로만 이뤄질 때만 해석한다
 * (parseAmount 단일 출처로 콤마·공백 허용·`%` 제거). 따라서 "25"·"25%"·"33.3" 은 해석하고
 * "해당 없음"·"미정" 같은 free-form 은 null(무간섭).
 *
 * @returns 숫자꼴이면 { pct, inRange, meetsUbo }, 아니면 null.
 *   pct      = 해석한 백분율 값
 *   inRange  = 0 < pct ≤ 100 (유효 지분율 범위)
 *   meetsUbo = pct ≥ 25 (특금법 실제소유자 기준)
 */
export function interpretSharePct(
  raw: string | number | null | undefined,
): { pct: number; inRange: boolean; meetsUbo: boolean } | null {
  const s = String(raw == null ? "" : raw).trim();
  if (s === "") return null;
  // 숫자꼴(%·콤마·소수·공백)만 — free-form 텍스트(임의 메모 등)는 무간섭(추정 형식 강제 금지)
  if (!/^[\d.,%\s]+$/.test(s)) return null;
  const pct = parseAmount(s.replace(/%/g, ""));
  return { pct, inRange: pct > 0 && pct <= 100, meetsUbo: pct >= 25 };
}

/* ---------------- 내 계약 목록 "수정 시각" 상대 표기 ---------------- */

/**
 * 내 계약 목록 카드의 "수정 시각"을 사람이 빠르게 훑는 상대 시간으로 — 기본 정렬이 "최근
 * 수정순"이라, 절대 시각("2026. 6. 22. 오후 3:14:05")보다 "방금·N분 전·N시간 전·어제·N일 전"이
 * 어떤 계약을 가장 최근에 손댔는지 한눈에 식별하게 한다(목록 탐색성). 7일을 넘어가면 상대
 * 표기의 식별력이 떨어지므로 절대 날짜("YYYY. M. D.")로 떨어뜨린다. 호출부는 이 상대 문구를
 * 보여 주되 카드 title(hover)에 정확한 전체 시각을 함께 보존해 잃는 정밀도를 보강한다.
 * ★표시 전용 — 정렬 키(updated_at 원본 문자열)·조문·엔진·산출물 무접촉.
 *
 * 순수 함수: 기준 시각 nowMs 를 인자로 받아 Date.now() 부수효과를 분리한다(가드가 고정 now 로
 * 경계를 단언). 분/시 구간은 경과 시간으로, "어제"/"N일 전"은 로컬 자정 기준 캘린더 일수 차로
 * 판정한다 — 30시간 전이라도 달력상 어제면 "어제"로 자연스럽게 읽히게(경과-시간만 쓰면 자정을
 * 갓 넘긴 어제 작업이 "1일 전"으로 어색해지는 것을 방지). 시계 오차로 미래(updated_at > now)면
 * 빈칸 대신 "방금", 해석 불가 입력은 ""(호출부가 절대 시각으로 폴백).
 */
export function formatRelativeTime(
  iso: string | number | Date | null | undefined,
  nowMs: number,
): string {
  if (iso == null) return "";
  const t = iso instanceof Date ? iso.getTime() : new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  const diff = nowMs - t;
  if (diff < MIN) return "방금"; // 1분 미만 + 미래(음수) 시계오차 포함
  if (diff < HOUR) return `${Math.floor(diff / MIN)}분 전`;
  // 로컬 자정 기준 캘린더 일수 차 — "어제"/"N일 전"을 달력 기준으로 정확히 판정.
  const startOfDay = (ms: number) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const dayDiff = Math.round((startOfDay(nowMs) - startOfDay(t)) / DAY);
  if (dayDiff <= 0) return `${Math.floor(diff / HOUR)}시간 전`; // 같은 달력 날짜
  if (dayDiff === 1) return "어제";
  if (dayDiff < 7) return `${dayDiff}일 전`;
  const d = new Date(t);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

/** HTML 이스케이프 (print 빌더에서 사용) */
export function escHTML(s: string | number | null | undefined): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
