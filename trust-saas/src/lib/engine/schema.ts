/* ================================================================
   스키마 — 문서 종류 / 카테고리 / 단계 / 서류별 필드 정의
   참조 HTML 1489~1630, 2625~2701 이식
   ================================================================ */
import type { Category, DocId } from "./model";

export interface TrustCompany {
  id: string;
  name: string;
  ready: boolean;
}

/** 부동산신탁사 14곳 (가나다 → abc 순). 현재 한국투자부동산신탁만 활성 */
export const TRUST_COMPANIES: TrustCompany[] = [
  { id: "daeshin", name: "대신자산신탁", ready: false },
  { id: "daehan", name: "대한토지신탁", ready: false },
  { id: "mugunghwa", name: "무궁화신탁", ready: false },
  { id: "shinyoung", name: "신영부동산신탁", ready: false },
  { id: "shinhan", name: "신한자산신탁", ready: false },
  { id: "asia", name: "아시아신탁", ready: false },
  { id: "woori", name: "우리자산신탁", ready: false },
  { id: "koramco", name: "코람코자산신탁", ready: false },
  { id: "korea", name: "코리아신탁", ready: false },
  { id: "hana", name: "하나자산신탁", ready: false },
  { id: "hankookasset", name: "한국자산신탁", ready: false },
  { id: "hankookland", name: "한국토지신탁", ready: false },
  { id: "kits", name: "한국투자부동산신탁", ready: true },
  { id: "kb", name: "KB부동산신탁", ready: false },
];

export interface DocumentType {
  id: string;
  name: string;
  ready: boolean;
}

export const DOCUMENT_TYPES: DocumentType[] = [
  { id: "joint", name: "공동사업표준협약서", ready: true },
  { id: "collateral", name: "담보신탁", ready: true },
  { id: "fund", name: "자금관리대리사무", ready: true },
  { id: "mgmt_normal", name: "(일반형)관리형토지신탁", ready: false },
  { id: "mgmt_resp", name: "(책준형)관리형토지신탁", ready: false },
  { id: "loan_a", name: "차입형토지신탁(A)", ready: false },
  { id: "loan_b", name: "차입형토지신탁(B)", ready: false },
  { id: "loan_c", name: "차입형토지신탁(C)", ready: false },
  { id: "loan_d", name: "차입형토지신탁(D)", ready: false },
  { id: "sale_mgmt", name: "분양관리신탁", ready: false },
  { id: "disposal", name: "처분신탁", ready: false },
];

export interface CategoryDef {
  id: Category;
  label: string;
  name: string;
  desc: string;
  ready: boolean;
}

export const CATEGORIES: CategoryDef[] = [
  {
    id: "new",
    label: "신규",
    name: "신규 계약",
    desc: "계약 체결을 위한 관계사 정보 입력, 계약 조건, 서류 생성",
    ready: true,
  },
  {
    id: "inProgress",
    label: "진행",
    name: "진행 (계약 체결 후)",
    desc: "계약 체결 후 정산 전까지의 인허가 관련 절차별 서류 (인허가 변경·통보·승인 등)",
    ready: false,
  },
  {
    id: "settlement",
    label: "정산",
    name: "정산 (계약 해지)",
    desc: "신탁 종료 및 정산을 위한 서류 일체",
    ready: false,
  },
];

export const CATEGORY_LABEL: Record<Category, string> = {
  new: "신규",
  inProgress: "진행",
  settlement: "정산",
};

export interface OutputDoc {
  id: DocId;
  name: string;
  desc: string;
}

/** 담보신탁 신규 → 생성되는 7종 서류 */
export const COLLATERAL_OUTPUT_DOCS: OutputDoc[] = [
  { id: "appform", name: "담보신탁 신청 및 우선수익권증서 발급의뢰서", desc: "위탁자가 신탁회사에 담보신탁을 신청하는 의뢰서" },
  { id: "contract", name: "담보신탁계약서", desc: "위탁자·수탁자·우선수익자 간 담보신탁 본 계약서" },
  { id: "poa", name: "위임장", desc: "신탁등기·신탁사무 처리를 위한 위임장" },
  { id: "valReport", name: "신탁재산 원본가액 신고서", desc: "신탁재산의 원본가액(평가액)을 신고하는 서식" },
  { id: "boardMin", name: "이사회 의사록(위탁자)", desc: "위탁자(법인) 이사회의 담보신탁 결의 의사록" },
  { id: "cdd", name: "고객거래확인서", desc: "특정금융정보법(특금법)상 고객확인 의무 서식" },
  { id: "ubo", name: "실제소유자확인서", desc: "실소유자(25% 이상 지분 보유) 확인 서식" },
];

export interface StepDef {
  idx: number;
  tab: number;
  key: string;
  label: string;
  title: string;
  desc: string;
  docId?: DocId;
}

/** 마법사 단계 (탭1 관계사 / 탭2 조건 / 탭3 서류) */
export const STEPS: StepDef[] = [
  { idx: 1, tab: 1, key: "parties", label: "STEP 01", title: "위탁자·채무자·수익자", desc: "다수의 위탁자·채무자·수익자를 등록할 수 있으며, 채무자/수익자가 위탁자와 동일한 경우 체크박스로 자동 복사됩니다." },
  { idx: 2, tab: 1, key: "priority", label: "STEP 02", title: "우선수익자", desc: "금융기관 등 우선수익자가 다수인 경우 모두 추가해 주세요." },
  { idx: 3, tab: 1, key: "loanCalc", label: "STEP 02-1", title: "우선수익한도금액 산정", desc: "각 우선수익자의 대출금액과 비율(100~150%)을 입력하면 우선수익한도금액이 자동 산정됩니다." },
  { idx: 4, tab: 1, key: "property", label: "STEP 03", title: "신탁 부동산 목록", desc: "토지·건물 등기부등본 PDF 업로드 또는 직접 입력으로 부동산 목록 작성." },
  { idx: 5, tab: 2, key: "basic", label: "STEP 04", title: "계약 기본 정보", desc: "계약 체결일, 신탁보수, 신탁보수율(우선수익한도금액 대비), 신탁기간 등 공통 항목." },
  { idx: 6, tab: 3, key: "doc1", label: "Doc 01", docId: "appform", title: "담보신탁 신청 및 우선수익권증서 발급의뢰서", desc: "신청서 고유 정보를 입력한 뒤 파일로 생성합니다." },
  { idx: 7, tab: 3, key: "doc2", label: "Doc 02", docId: "contract", title: "담보신탁계약서", desc: "본 계약서 고유 정보(특약사항 등)를 입력한 뒤 파일로 생성합니다." },
  { idx: 8, tab: 3, key: "doc3", label: "Doc 03", docId: "poa", title: "위임장", desc: "위임 범위·수임자 등 위임장 고유 정보를 입력한 뒤 파일로 생성합니다." },
  { idx: 9, tab: 3, key: "doc4", label: "Doc 04", docId: "valReport", title: "신탁재산 원본가액 신고서", desc: "신탁재산의 원본가액(평가액)·평가기준일 등을 입력한 뒤 파일로 생성합니다." },
  { idx: 10, tab: 3, key: "doc5", label: "Doc 05", docId: "boardMin", title: "이사회 의사록(위탁자)", desc: "위탁자(법인) 이사회의 담보신탁 결의 의사록 정보를 입력한 뒤 파일로 생성합니다." },
  { idx: 11, tab: 3, key: "doc6", label: "Doc 06", docId: "cdd", title: "고객거래확인서", desc: "특정금융정보법(특금법)상 거래 목적·자금 출처 등 정보를 입력한 뒤 파일로 생성합니다." },
  { idx: 12, tab: 3, key: "doc7", label: "Doc 07", docId: "ubo", title: "실제소유자확인서", desc: "실제 소유자(25% 이상 지분 보유자) 정보를 입력한 뒤 파일로 생성합니다." },
];

export const TAB_LABELS: Record<number, string> = {
  1: "관계사 정보",
  2: "계약 체결 조건",
  3: "계약 체결 서류",
};

/* ---------------- 서류별 고유 입력 필드 ---------------- */
export type FieldType = "text" | "amount" | "textarea" | "radio" | "select" | "toggle";

export interface DocFieldOption {
  v: string;
  l: string;
}
export interface DocField {
  key: string;
  type: FieldType;
  label: string;
  hint?: string;
  placeholder?: string;
  options?: DocFieldOption[];
  default?: string | boolean;
}

export const DOC_FIELDS: Record<DocId, DocField[]> = {
  appform: [
    { key: "researchReport", type: "radio", label: "조사분석서", hint: "Doc 01 표지 우측 체크박스에 ■ 표시됩니다.", options: [{ v: "include", l: "포함" }, { v: "omit", l: "생략" }] },
    { key: "valuationMethod", type: "text", label: "신탁부동산 담보가격 산정방법", placeholder: "예) 감정평가금액[기준시점 2025.10.12., (주)○○감정평가법인]" },
    { key: "valuationPrice", type: "amount", label: "신탁부동산 가격 (원)", hint: "Doc 01 「신탁부동산 가격」 칸에 한글 금액과 함께 자동 기재됩니다." },
    { key: "leaseStatus", type: "text", label: "임대차 등 선순위", placeholder: "예) 해당사항 없음 / 또는 보증금 등 선순위 내역" },
    { key: "priorityChangeNote", type: "text", label: "우선수익권 변경 메모 (선택)", hint: "표 하단에 「※ ...」 형태로 표시됩니다. 비워두면 출력하지 않습니다." },
    { key: "extraNotes", type: "textarea", label: "특이사항 (추가 기재)", hint: "표준 11개 문구 다음에 추가로 기재됩니다." },
  ],
  contract: [
    { key: "majorityCriteria", type: "select", label: "제3조 제3항 — 다수우선수익자 의사결정 기준", hint: "개별 우선수익자의 공매 요청에 따른 공매실행(처분) 결정 기준. 대출약정에서 정한 값을 선택하세요.", options: [{ v: "half", l: "과반수 초과" }, { v: "twothird", l: "3분의 2 초과 (표준)" }, { v: "fourfifth", l: "5분의 4 초과" }, { v: "unanimous", l: "우선수익자 전원 동의" }], default: "twothird" },
    { key: "agentBank", type: "text", label: "제20조 — 대리금융기관 (회사명)", hint: "우선수익자 전원이 선임하는 대리금융기관. 비워두면 조항에 빈칸으로 출력됩니다.", placeholder: "예) ○○신용협동조합" },
    { key: "includeArt21", type: "toggle", label: "제21조 — 인허가 업무 및 건축주의 권한 조항", hint: "인허가 진행 사업이면 포함. 인허가·대수선·기타 용처가 전혀 없는 순수 단순담보일 때만 제외합니다.", default: true },
    { key: "builderName", type: "select", label: "제21조 — 건축주(인허가) 명의", hint: "제21조 포함 시에만 적용. 건축허가(사업계획승인 등) 명의를 누구로 둘지 선택합니다.", options: [{ v: "truster", l: "위탁자(시행사) 명의 (표준)" }, { v: "trustee", l: "수탁자(신탁사) 명의" }], default: "truster" },
    { key: "notes", type: "textarea", label: "기타 특이사항 / 메모", placeholder: "위 4개 옵션 외에 별첨4에 반영할 사항을 기록 (예: 특정 조항 추가·삭제 요청)" },
  ],
  poa: [
    { key: "scope", type: "textarea", label: "위임 범위", placeholder: "예) 신탁등기 신청 및 부속 절차, 신탁사무 일체" },
    { key: "delegatee", type: "text", label: "수임자", placeholder: "기본: 한국투자부동산신탁 주식회사" },
    { key: "notes", type: "textarea", label: "특이사항 / 메모", placeholder: "" },
  ],
  valReport: [
    { key: "principalValue", type: "text", label: "신탁재산 원본가액 (원)", placeholder: "예) 5,000,000,000" },
    { key: "valuationDate", type: "text", label: "평가기준일", placeholder: "예) 2025-07-03" },
    { key: "valuationMethod", type: "radio", label: "평가방법", options: [{ v: "appraisal", l: "감정평가" }, { v: "book", l: "장부가액" }, { v: "other", l: "기타" }] },
    { key: "notes", type: "textarea", label: "특이사항 / 메모", placeholder: "감정평가기관·평가서 번호 등" },
  ],
  boardMin: [
    { key: "meetingType", type: "radio", label: "이사회 종류", options: [{ v: "regular", l: "정기" }, { v: "extraordinary", l: "임시" }] },
    { key: "meetingDate", type: "text", label: "회의 일자", placeholder: "예) 2025-07-01" },
    { key: "agenda", type: "textarea", label: "결의 안건", placeholder: "예) 당사 소유 부동산을 한국투자부동산신탁(주)에 담보신탁하기로 결의" },
    { key: "resolution", type: "radio", label: "의결 방법", options: [{ v: "unanimous", l: "참석이사 전원 찬성" }, { v: "majority", l: "과반수 찬성" }] },
    { key: "notes", type: "textarea", label: "특이사항 / 메모", placeholder: "참석 이사·감사 명단 등" },
  ],
  cdd: [
    { key: "txPurpose", type: "text", label: "거래 목적", placeholder: "예) 부동산 담보 신탁 계약 체결" },
    { key: "fundSource", type: "text", label: "자금 출처", placeholder: "예) 자기자본, 차입금" },
    { key: "pep", type: "radio", label: "정치적 주요 인물(PEP) 여부", options: [{ v: "no", l: "해당 없음" }, { v: "yes", l: "해당" }] },
    { key: "notes", type: "textarea", label: "특이사항 / 메모", placeholder: "" },
  ],
  ubo: [
    { key: "uboName", type: "text", label: "실제 소유자 성명", placeholder: "25% 이상 지분 보유 자연인" },
    { key: "uboShare", type: "text", label: "지분율 (%)", placeholder: "예) 100" },
    { key: "sameAsTrustor", type: "radio", label: "위탁자와 동일 여부", options: [{ v: "yes", l: "동일" }, { v: "no", l: "다름" }] },
    { key: "notes", type: "textarea", label: "특이사항 / 메모", placeholder: "" },
  ],
};
