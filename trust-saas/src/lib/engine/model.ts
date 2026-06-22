/* ================================================================
   데이터 모델 — 참조 HTML state/blankParty/blankProperty 이식
   (trust-automatic/한국투자부동산신탁_서류자동화.html 1540~1606)
   ================================================================ */

export type PartyType = "법인" | "개인";
export type InputMethod = "manual" | "ocr";

/** 담보물/사업 유형 — 별첨1 표기·인허가 특약 분기의 1차 축 */
export type CollateralType =
  | "land" // 토지담보
  | "apartment" // 공동주택
  | "mixed" // 주상복합
  | "officetel" // 오피스텔
  | "logistics" // 물류센터
  | "solar" // 태양광 발전
  | "etc"; // 기타

/** 인허가 유형 — 제21조 인허가 업무 조항의 명칭 분기 */
export type LicenseType =
  | "building" // 건축허가
  | "housing" // 주택건설사업계획승인
  | "urban" // 도시개발사업
  | "remodel" // 대수선
  | "none"; // 해당 없음(순수 담보)

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
    // 별첨4 특약 가변 4요소 (annex.ts getAnnex4Options 가 읽는 키) — 조문 자동 반영
    majorityCriteria: "half" | "twothird" | "fourfifth" | "unanimous"; // 제3조3항 기준
    agentBank: string; // 제20조 대리금융기관명 (빈 값 = 미지정)
    includeArt21: boolean; // 제21조 인허가 조항 포함 여부 (기본 true)
    builderName: "truster" | "trustee"; // 제21조 건축주 명의
    notes: string;
    // ── 경우의 수 (실제 계약서 차이 기반) — 계약 프로파일로 기록·요약, 일부는 조문 연동 예정 ──
    collateralType?: CollateralType; // 담보물/사업 유형 (토지담보·공동주택·주상복합·오피스텔·물류·태양광·기타)
    licenseType?: LicenseType; // 인허가 유형 (건축허가·주택건설사업계획승인·도시개발사업·대수선·해당없음)
    agentBankEnabled?: boolean; // 대리금융기관 지정 여부 (false=단독/미지정)
    onbid?: boolean; // 공매 시 온비드(한국자산관리공사) 이용
    privateSaleAppraisal6m?: boolean; // 수의계약 시 감정평가 6개월 이내 제한
    fundMgmtAccount?: boolean; // 자금관리계좌(자금집행) 특약 병행
    feePayer?: "truster" | "priority"; // 담보보수 납부 주체 (위탁자 / 우선수익자)
    collateralOrder?: "new" | "additional"; // 담보 차수 (신규 1차 / 추가 2·3차)
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

/**
 * 배열에서 idx 요소를 dir(-1=위/앞, +1=아래/뒤) 방향 **인접** 요소와 맞바꾼 새 배열을 반환한다.
 * 우선수익자(priorities)처럼 배열 순서 자체가 의미(선·후순위)를 갖는 목록의 순서 변경에 쓴다.
 *  - dir 은 ±1(한 칸 이동)만 유효 — 그 외(0·2 등)는 입력을 그대로 반환 = no-op.
 *  - 범위를 벗어나면(맨 위에서 위로·맨 아래에서 아래로) 입력 배열을 **그대로**(동일 참조) 반환 = no-op.
 *  - 입력 배열·요소를 변형하지 않는다(순수·불변) — slice 로 복제한 새 배열에서만 교환.
 */
export function moveInArray<T>(arr: T[], idx: number, dir: number): T[] {
  if (dir !== -1 && dir !== 1) return arr;
  const j = idx + dir;
  if (idx < 0 || idx >= arr.length || j < 0 || j >= arr.length) return arr;
  const out = arr.slice();
  out[idx] = arr[j];
  out[j] = arr[idx];
  return out;
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
      // 계약 체결일 기본 연도 = 시스템 현재 연도. 하드코딩(과거 연도)은 해가 바뀌면
      // 백데이팅된 법적 서류를 만든다(joint agreementYear "2025" 사례) → 신규 작성 시점의
      // 현재 연도로 둔다. month/day 는 placeholder(사용자가 드롭다운으로 선택).
      year: new Date().getFullYear(),
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
        collateralType: "land",
        licenseType: "building",
        agentBankEnabled: false,
        onbid: true,
        privateSaleAppraisal6m: true,
        fundMgmtAccount: false,
        feePayer: "truster",
        collateralOrder: "new",
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
    // 협약 연도 기본값 = 시스템 현재 연도(자유 텍스트). 종전 하드코딩 "2025"는 2026 기준
    // 과거 연도로, 신규 협약서가 입력 즉시 백데이팅되던 정확성 결함(담보신탁 year 와 동일 원칙).
    project: { name: "", site: "", scaleUse: "", agreementYear: String(new Date().getFullYear()), agreementMonth: "", agreementDay: "" },
    representative: "developer",
  };
}
