/* ================================================================
   검증 게이트 — DOCX 생성 전 필수항목 충족 여부 점검
   완료기준: 필수항목(당사자·물건·금액 등) 누락 시 DOCX 차단 + 누락 필드 안내.
   ⚠️ verbatim 조문 자체는 건드리지 않는다. "입력값 완결성"만 검사.
   ================================================================ */
import type { ContractForm, DocId, Party } from "./model";
import { parseAmount, isRealDate, isPositiveAmount, isValidRatio, isValidBizNo, isValidCorpRegNo, isValidRegNo, isValidBirthDate } from "./calc";
import { STEPS, type StepDef } from "./schema";

export interface Missing {
  /** 누락 항목 사용자 안내 라벨 */
  label: string;
  /** 어느 단계(STEP)에서 입력하는지 — 안내용 (STEPS에서 파생) */
  where: string;
  /** 입력 단계의 STEP.idx — 검증 게이트에서 해당 단계로 바로 이동(점프)하는 데 사용 */
  stepIdx: number;
}

const hasText = (v: unknown) => typeof v === "string" && v.trim().length > 0;

/**
 * 누락 항목 1건 생성. `where`(안내 문구)는 STEPS에서 파생해
 * 스텝 라벨/제목이 바뀌어도 검증 안내가 stale 되지 않게 한다(단일 출처).
 */
function miss(label: string, stepIdx: number): Missing {
  const s = STEPS.find((x) => x.idx === stepIdx);
  return { label, stepIdx, where: s ? `${s.label} ${s.title}` : "" };
}

/** 공통(모든 담보신탁 서류) 필수 입력 — 당사자·물건·금액 */
function commonMissing(form: ContractForm): Missing[] {
  const m: Missing[] = [];

  // 위탁자: 최소 1인 + 이름 (STEP 01)
  if (!form.trustors.some((p) => hasText(p.name))) {
    m.push(miss("위탁자 (성명/상호)", 1));
  }
  // 우선수익자: 최소 1인 + 이름 (STEP 02)
  if (!form.priorities.some((p) => hasText(p.name))) {
    m.push(miss("우선수익자 (성명/상호)", 2));
  }
  // 대출금액(우선수익한도 산정 근거): 합계 > 0 (STEP 02-1)
  if (!form.priorities.some((p) => parseAmount(p.loanAmount) > 0)) {
    m.push(miss("우선수익자 대출금액", 3));
  } else {
    // 합계가 양(+)이라도 개별 우선수익자의 대출금액이 "0·음수·비숫자"이면, 그 우선수익자의
    // 우선수익한도금액(= loanAmount × 비율)이 0/음수로 산출물 표에 박힌다(builders.js: 별첨2/3·
    // appform 한도표). 가격·원본가액과 동일한 정확성 결함이므로 "채웠지만 유효하지 않은" 개별
    // 금액을 차단한다(빈 값은 위 합계 검사로 충분 — 미입력 우선수익자는 0 한도로 의도될 수 있음).
    form.priorities.forEach((p, i) => {
      if (hasText(p.loanAmount) && !isPositiveAmount(p.loanAmount)) {
        m.push(miss(`우선수익자 ${i + 1} 대출금액 (유효하지 않은 금액)`, 3));
      }
    });
  }
  // 우선수익한도 비율 (STEP 02-1) — 비율 × 대출금액 = 우선수익한도금액(별첨2/3·appform 한도표·
  // valReport priorityLimit 의 핵심 법적 수치). UI(StepLoanCalc)에 100~150% 범위로 안내되나
  // number 입력의 min/max 는 타이핑을 막지 못해 범위 밖 값(음수·200·1200 등)이 저장될 수 있고,
  // import·구버전·AI 머지로도 들어올 수 있어 게이트가 한 번 더 검사한다. 0·빈 값은 빌더가 기본
  // 120%로 처리하므로(isValidRatio 가 동일하게 || 120 검사) 무회귀 위해 통과시키고 범위 밖만 차단.
  if (!isValidRatio(form.common.priorityRatio)) {
    m.push(miss("우선수익한도 비율 (100~150% 범위)", 3));
  }
  // 신탁 부동산: 최소 1건 + 주소 (STEP 03)
  if (!form.properties.some((p) => hasText(p.address))) {
    m.push(miss("신탁 부동산 (소재지)", 4));
  }
  // 부동산 등기 고유번호 (STEP 03) — 신탁부동산 표(신청서 partyTable·계약서 별지)에 각 부동산의
  // 등기 고유번호가 그대로 박히므로(builders.js: tc(p.regNo)), 자릿수가 맞지 않는 오타·부분 입력이
  // 법적 서류에 들어간다(소재지·금액·식별번호와 동일한 데이터 정합성 결함 유형의 마지막 정형 입력).
  // ⚠️ 빈 값은 차단하지 않는다(등기 고유번호는 선택 입력 — 미입력 계약 허용 = 무회귀).
  // "입력됐으나 정확히 14자리가 아닌" 경우만 차단한다(채웠지만 무효 = 금액·번호 패턴과 동일).
  // ⚠️ 사업자번호·법인번호와 달리 공개 표준 체크섬이 없어 형식(14자리)만 검사한다(추정 체크섬
  // 금지 — 유효한 실제 번호 오탐 차단 방지). import·구버전·AI 머지로 들어온 값까지 한 번 더 방어.
  form.properties.forEach((p, i) => {
    if (hasText(p.regNo) && !isValidRegNo(p.regNo)) {
      m.push(miss(`부동산 ${i + 1} 등기 고유번호 (형식 오류 — 14자리)`, 4));
    }
  });
  // 계약 체결일 (STEP 04) — 누락뿐 아니라 실재하지 않는 날짜(예: 2월 31일)도 차단.
  // 입력 드롭다운은 월별 유효일만 노출하지만, 구버전 저장본·가져오기(import)·AI 머지로
  // 들어온 데이터는 이 게이트를 통과하므로 달력 유효성을 한 번 더 검사한다(정확성 가드레일).
  const { year, month, day } = form.common;
  if (!year || !month || day === "" || day == null) {
    m.push(miss("계약 체결일 (연·월·일)", 5));
  } else if (!isRealDate(year, month, day)) {
    m.push(miss("계약 체결일 (실재하지 않는 날짜)", 5));
  }
  // 신탁보수 (STEP 04) — 가격·원본가액·개별 대출금액에 이은 데이터 정합성 계열 마감.
  // ⚠️ 빈 값은 차단하지 않는다: 빌더가 별첨3 보수액을 "[ ] — 신탁보수 미입력 (STEP 04)"로
  // 명시 렌더해(builders.js) 누락임을 분명히 알리므로, 빈 trustFee로 생성되던 기존 계약을
  // 새로 막지 않는다(영향 점검 결과 = 빈 값 게이트는 무회귀 위해 제외).
  // 단, "채웠지만 0·음수·비숫자"는 별첨3 보수액이 ₩-5,000.- 같은 잘못된 금액으로,
  // valReport kvRow가 "-5,000 원"으로 법적 서류에 박히므로(가격·원본가액과 동일 결함 유형) 차단한다.
  if (hasText(form.common.trustFee) && !isPositiveAmount(form.common.trustFee)) {
    m.push(miss("신탁보수 (유효하지 않은 금액)", 5));
  }
  // 신탁기간 (STEP 04) — UI에 `*` 필수이나 게이트에 누락돼 있던 마지막 필수 공통 항목.
  // 빈 값이면 valReport(원본가액신고서) kvRow가 신탁기간을 빈칸으로 렌더하고
  // (builders.js: `c.trustPeriod || ""`), appform은 사용자가 입력하지 않은 하드코딩
  // 기간 문구로 대체 렌더해 법적 서류에 "사용자가 선택하지 않은/빈" 신탁기간이 들어간다.
  // ⚠️ trustFee와 달리 빈 값을 명시 안내하는 placeholder가 없어(valReport는 무표시 공백)
  // 빈 값을 차단한다 — 모델 기본값이 비어있지 않아 정상 계약은 무회귀(빈 신탁기간은 애초에
  // "올바른" 적이 없음). 자유 텍스트이므로 형식이 아닌 "존재"만 검사한다(추정 형식 강제 금지).
  if (!hasText(form.common.trustPeriod)) {
    m.push(miss("신탁기간", 5));
  }
  // 사업자등록번호 (관계사) — 신청서 관계사 표·별첨에 각 당사자의 사업자등록번호가 그대로 박히므로
  // (builders.js partyTable: kvRow "사업자등록번호" = bizP1-bizP2-bizP3), 오타로 체크섬이 깨진
  // 번호는 법적 서류에 그대로 들어간다(금액·날짜·비율과 동일한 데이터 정합성 결함 유형).
  // ⚠️ 빈 값은 차단하지 않는다(사업자등록번호는 선택 입력 — 법인등록번호만 기재하는 경우 허용 =
  // 무회귀). "입력됐으나(숫자 하나라도) 유효한 10자리 체크섬이 아닌" 경우만 차단한다(채웠지만
  // 무효 = 금액 패턴과 동일). 검증식은 국세청 표준(추정 형식 아님). import·구버전·AI 머지로
  // 입력 위젯(숫자만 허용)을 우회한 값까지 isValidBizNo 단일 출처로 한 번 더 방어한다.
  const checkBiz = (arr: Party[], label: string, stepIdx: number) => {
    arr.forEach((p, i) => {
      const biz = [p.bizP1, p.bizP2, p.bizP3].map((x) => String(x ?? "")).join("").replace(/\D/g, "");
      if (biz.length > 0 && !isValidBizNo(biz)) {
        m.push(miss(`${label} ${i + 1} 사업자등록번호 (유효하지 않은 번호)`, stepIdx));
      }
    });
  };
  checkBiz(form.trustors, "위탁자", 1);
  checkBiz(form.priorities, "우선수익자", 2);
  // 채무자·수익자는 기본 위탁자와 동일(sameAsTrustor) — 그 경우 위탁자 검사로 충분(중복 방지).
  // 별도 입력(다름)일 때만 그 자체 배열을 검사한다(STEP 01 관계사).
  if (!form.debtorSameAsTrustor) checkBiz(form.debtors, "채무자", 1);
  if (!form.beneficiarySameAsTrustor) checkBiz(form.beneficiaries, "수익자", 1);

  // 법인등록번호 (관계사) — 계약서 본문·신청서 관계사 표·별첨에 각 "법인" 당사자의 법인등록번호가
  // 그대로 박힌다(builders.js: corpRegFront-corpRegBack). 사업자등록번호와 동일한 "정형 식별번호"
  // 정합성 결함 유형의 마지막 입력 — 오타로 체크섬이 깨진 13자리(또는 부분 입력)가 법적 서류에
  // 그대로 들어갈 수 있었다(import·구버전·AI 머지로도 입력 위젯(숫자만 허용)을 우회 가능).
  // ⚠️ 빈 값은 차단하지 않는다(법인등록번호는 선택 입력 — 사업자등록번호만 기재하는 경우 허용 =
  // 무회귀). "입력됐으나 유효한 13자리 체크섬이 아닌" 경우만 차단(사업자번호·금액 패턴과 동일).
  // ⚠️ 개인 당사자는 이 칸이 생년월일로 렌더되므로(builders.js: type==="개인"→"생년월일") 법인
  // (type==="법인")일 때만 검사한다 — 개인 생년월일에 13자리 체크섬을 적용해 오탐하지 않는다.
  const checkCorpReg = (arr: Party[], label: string, stepIdx: number) => {
    arr.forEach((p, i) => {
      if (p.type !== "법인") return; // 개인 = 생년월일 칸(법인등록번호 체크섬 비대상)
      const corp = [p.corpRegFront, p.corpRegBack].map((x) => String(x ?? "")).join("").replace(/\D/g, "");
      if (corp.length > 0 && !isValidCorpRegNo(corp)) {
        m.push(miss(`${label} ${i + 1} 법인등록번호 (유효하지 않은 번호)`, stepIdx));
      }
    });
  };
  checkCorpReg(form.trustors, "위탁자", 1);
  checkCorpReg(form.priorities, "우선수익자", 2);
  if (!form.debtorSameAsTrustor) checkCorpReg(form.debtors, "채무자", 1);
  if (!form.beneficiarySameAsTrustor) checkCorpReg(form.beneficiaries, "수익자", 1);

  // 생년월일 (개인 관계사) — 개인 당사자의 식별번호 칸은 산출물에 "생년월일"로 렌더된다
  // (builders.js: type==="개인"→"생년월일"). 법인은 위 checkCorpReg 가 13자리 체크섬을 검사하지만,
  // 개인은 그 어느 게이트도 검사하지 않아 앞 6자리(YYMMDD)에 "991332"·"000000" 같은 실재하지 않는
  // 날짜가 들어가도 법적 서류에 그대로 박혔다(법인=체크섬과 대칭되는 마지막 식별번호 정합성 갭).
  // ⚠️ 빈 값은 차단하지 않는다(생년월일은 선택 입력 — 미입력 계약 허용 = 무회귀). "입력됐으나 앞
  // 6자리가 실재하는 달력 날짜가 아닌" 경우만 차단한다(법인·금액·등기번호 패턴과 동일).
  // ⚠️ 법인은 이 칸이 법인등록번호이므로(checkCorpReg 담당) 개인(type==="개인")일 때만 검사한다.
  // 주민등록번호 체크섬은 폐지돼 적용하지 않고 앞 6자리의 달력 유효성만 본다(isValidBirthDate, 추정
  // 체크섬 금지 — regNo 와 동일 원칙). PII(주민번호)는 로컬 입력값에만 적용·전송 없음.
  const checkBirth = (arr: Party[], label: string, stepIdx: number) => {
    arr.forEach((p, i) => {
      if (p.type !== "개인") return; // 법인 = 법인등록번호 칸(checkCorpReg 담당)
      const front = String(p.corpRegFront ?? "").replace(/\D/g, "");
      if (front.length > 0 && !isValidBirthDate(p.corpRegFront, p.corpRegBack)) {
        m.push(miss(`${label} ${i + 1} 생년월일 (실재하지 않는 날짜)`, stepIdx));
      }
    });
  };
  checkBirth(form.trustors, "위탁자", 1);
  checkBirth(form.priorities, "우선수익자", 2);
  if (!form.debtorSameAsTrustor) checkBirth(form.debtors, "채무자", 1);
  if (!form.beneficiarySameAsTrustor) checkBirth(form.beneficiaries, "수익자", 1);
  return m;
}

/** 서류별 추가 필수 입력 — 누락 항목은 해당 서류(Doc) step에서 입력 */
function docMissing(form: ContractForm, docId: DocId): Missing[] {
  const m: Missing[] = [];
  // 구버전 저장본은 docContents 하위 키가 일부 없을 수 있다 → 옵셔널 체이닝으로 크래시 방지.
  const c = form.docContents ?? ({} as ContractForm["docContents"]);
  const stepIdxOf = (id: DocId) => STEPS.find((s) => s.docId === id)?.idx ?? 0;
  // 금액 필드는 "존재"만이 아니라 "유효한 양(+)의 금액"인지까지 검사한다(체결일 달력
  // 유효성과 동일 패턴). 누락(빈 값) → '누락', 채웠지만 0·음수·비숫자 → '유효하지 않은 금액'.
  // 후자는 빌더가 가격칸을 빈칸/잘못된 금액으로 렌더하므로 산출물 정확성을 해친다.
  if (docId === "appform") {
    const v = c.appform?.valuationPrice;
    if (!hasText(v)) {
      m.push(miss("신탁부동산 가격", stepIdxOf("appform")));
    } else if (!isPositiveAmount(v)) {
      m.push(miss("신탁부동산 가격 (유효하지 않은 금액)", stepIdxOf("appform")));
    }
  }
  if (docId === "valReport") {
    const v = c.valReport?.principalValue;
    if (!hasText(v)) {
      m.push(miss("신탁재산 원본가액", stepIdxOf("valReport")));
    } else if (!isPositiveAmount(v)) {
      m.push(miss("신탁재산 원본가액 (유효하지 않은 금액)", stepIdxOf("valReport")));
    }
  }
  return m;
}

/**
 * 특정 서류(docId) 생성 가능 여부 + 누락 항목.
 * ok=true 면 DOCX/PDF 생성 버튼 활성화.
 */
export function validateDoc(form: ContractForm, docId: DocId): { ok: boolean; missing: Missing[] } {
  const missing = [...commonMissing(form), ...docMissing(form, docId)];
  return { ok: missing.length === 0, missing };
}

/**
 * 저장된 계약을 다시 열 때(이어서 작성) 진입할 단계.
 * 아직 필수 입력이 누락돼 생성 불가한 **첫 서류(Doc) step**을 반환한다 →
 * 항상 STEP 01로 떨어지지 않고 곧장 미완 지점으로 데려간다(그 단계의 검증 박스가
 * 무엇을 채워야 하는지 안내·점프). 모든 서류가 생성 가능하면 null(처음부터 검토).
 *
 * ⚠️ 조문·엔진·검증 판정 무접촉 — 기존 validateDoc 결과로 진입 위치만 고른다.
 */
export function firstIncompleteDocStep(form: ContractForm): StepDef | null {
  for (const s of STEPS) {
    if (s.docId && !validateDoc(form, s.docId).ok) return s;
  }
  return null;
}
