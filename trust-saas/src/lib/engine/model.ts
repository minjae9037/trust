/* ================================================================
   데이터 모델 — 참조 HTML state/blankParty/blankProperty 이식
   (trust-automatic/한국투자부동산신탁_서류자동화.html 1540~1606)
   ================================================================ */

export type PartyType = "법인" | "개인";
export type InputMethod = "manual" | "ocr";

/** 위탁자·채무자·수익자·우선수익자 공통 관계사 */
export interface Party {
  type: PartyType;
  name: string;
  corpRegFront: string; // 법인등록번호 앞 6자리
  corpRegBack: string; //  법인등록번호 뒤 7자리
  bizP1: string; // 사업자번호 3
  bizP2: string; // 사업자번호 2
  bizP3: string; // 사업자번호 5
  representativeDirector: string; // 대표이사
  insideDirector: string; // 사내이사
  address: string;
  contact: string;
  loanAmount: string; // 대출금액 (우선수익자에서만 사용)
  claimDebtor: string; // 피담보채권의 채무자 (우선수익자 전용)
  securedClaim: string; // 피담보채권 문구 (우선수익자 전용, 별첨2 표 기재)
  _inputMethod: InputMethod;
}

/** 신탁 부동산 1건 */
export interface Property {
  address: string;
  category: string; // 지목
  area: string; // 면적
  regNo: string; // 등기 고유번호
}

/** 계약 공통 조건 */
export interface CommonFields {
  year: number;
  month: number;
  day: number | "";
  trustFee: string; // 신탁보수(원)
  priorityLimit: string; // 우선수익한도금액(원) — STEP 02-1 자동 산정
  priorityRatio: number; // 우선수익한도 비율 (대출금액 대비 %, 100~150)
  trustFeeRate: string; // 신탁보수율(우선수익한도금액 대비 %)
  trustPeriod: string;
}

/** 서류별 고유 입력값 */
export interface DocContents {
  appform: {
    researchReport: "omit" | "include";
    valuationMethod: string;
    valuationPrice: string;
    leaseStatus: string;
    priorityChangeNote: string;
    extraNotes: string;
  };
  contract: {
    // 별첨4 특약 가변 4요소 (annex.ts getAnnex4Options 가 읽는 키)
    majorityCriteria: "half" | "twothird" | "fourfifth" | "unanimous"; // 제3조3항 기준
    agentBank: string; // 제20조 대리금융기관명
    includeArt21: boolean; // 제21조 인허가 조항 포함 여부 (기본 true)
    builderName: "truster" | "trustee"; // 제21조 건축주 명의
    notes: string;
  };
  poa: { scope?: string; delegatee?: string; notes: string };
  valReport: { principalValue?: string; valuationDate?: string; valuationMethod?: string; notes: string };
  boardMin: { meetingType?: string; meetingDate?: string; agenda?: string; resolution?: string; notes: string };
  cdd: { txPurpose?: string; fundSource?: string; pep?: string; notes: string };
  ubo: { uboName?: string; uboShare?: string; sameAsTrustor?: string; notes: string };
}

export type DocId = keyof DocContents;

/** 담보신탁 등 표준 계약 폼 전체 */
export interface ContractForm {
  trustors: Party[];
  debtorSameAsTrustor: boolean;
  debtors: Party[];
  beneficiarySameAsTrustor: boolean;
  beneficiaries: Party[];
  priorities: Party[];
  properties: Property[];
  common: CommonFields;
  docContents: DocContents;
}

/** 공동사업표준협약서(joint) 전용 입력값 */
export interface JointForm {
  gap: {
    name: string;
    repDir: string;
    address: string;
    corpRegFront: string;
    corpRegBack: string;
    _inputMethod: InputMethod;
  };
  project: {
    name: string;
    site: string;
    scaleUse: string;
    agreementYear: string;
    agreementMonth: string;
    agreementDay: string;
  };
  representative: "developer" | "trust"; // 대표를 시행사("갑") / 신탁사("을")
}

export type Category = "new" | "inProgress" | "settlement";

export function blankParty(): Party {
  return {
    type: "법인",
    name: "",
    corpRegFront: "",
    corpRegBack: "",
    bizP1: "",
    bizP2: "",
    bizP3: "",
    representativeDirector: "",
    insideDirector: "",
    address: "",
    contact: "",
    loanAmount: "",
    claimDebtor: "",
    securedClaim: "",
    _inputMethod: "manual",
  };
}

export function blankProperty(): Property {
  return { address: "", category: "", area: "", regNo: "" };
}

export function blankContractForm(): ContractForm {
  return {
    trustors: [blankParty()],
    debtorSameAsTrustor: true,
    debtors: [blankParty()],
    beneficiarySameAsTrustor: true,
    beneficiaries: [blankParty()],
    priorities: [blankParty()],
    properties: [blankProperty()],
    common: {
      year: 2026,
      month: 3,
      day: 1,
      trustFee: "",
      priorityLimit: "",
      priorityRatio: 120,
      trustFeeRate: "",
      trustPeriod: "담보신탁 등기일로부터 우선수익자 채권 변제시까지",
    },
    docContents: {
      appform: {
        researchReport: "omit",
        valuationMethod: "",
        valuationPrice: "",
        leaseStatus: "해당사항 없음",
        priorityChangeNote: "",
        extraNotes: "",
      },
      contract: {
        majorityCriteria: "twothird",
        agentBank: "",
        includeArt21: true,
        builderName: "truster",
        notes: "",
      },
      poa: { notes: "" },
      valReport: { notes: "" },
      boardMin: { notes: "" },
      cdd: { notes: "" },
      ubo: { notes: "" },
    },
  };
}

export function blankJointForm(): JointForm {
  return {
    gap: { name: "", repDir: "", address: "", corpRegFront: "", corpRegBack: "", _inputMethod: "manual" },
    project: { name: "", site: "", scaleUse: "", agreementYear: "2025", agreementMonth: "", agreementDay: "" },
    representative: "developer",
  };
}
