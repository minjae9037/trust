/* ================================================================
   별첨4 특약 가변 4요소 토글 분기 — 참조 HTML 3478~3546 이식
   ① 제3조3항 다수우선수익자 기준 ② 대리금융기관명
   ③ 인허가 조항 포함·명의 ④ 위탁자수 기반 제8조의2·3
   ================================================================ */
import type { ContractForm } from "./model";
import type { AnnexArticle, ClauseLine } from "./clauses/types";
import {
  ANNEX4_BASE,
  ANNEX4_ART8_2,
  ANNEX4_ART8_3,
  ANNEX4_INHEOGA_TRUSTER,
  ANNEX4_INHEOGA_TRUSTEE,
  ANNEX4_GANIN,
} from "./clauses/annex4";

export type MajorityCriteria = "half" | "twothird" | "fourfifth" | "unanimous";

export const MAJORITY_LABEL: Record<MajorityCriteria, string> = {
  half: "과반수 초과",
  twothird: "3분의 2 초과",
  fourfifth: "5분의 4 초과",
  unanimous: "우선수익자 전원 동의",
};

/** 제3조 제3항 — 다수우선수익자 기준별 문구 */
export function getArt3Para3Text(criteria: MajorityCriteria): string {
  const base = (frac: string) =>
    "본 조 제1항 및 제2항에도 불구하고, 신탁본문 제18조 제1항의 처분 요청 권리는 각 우선수익자가 보유하는 것으로 하되, 개별 우선수익자의 공매 요청에 따른 공매실행(처분)은 요청일 기준 다수우선수익자[“다수우선수익자”는 단독 또는 다른 우선수익자와 합하여 모든 우선수익권의 피담보채권액의 " +
    frac +
    " 피담보채권을 보유한 우선수익자 및 그 적법한 승계인을 의미한다.]의 결정을 따르기로 한다. 이 경우 위 처분요청에 따라 수탁자는 신탁부동산 처분 절차에 나아갈 수 있다.";
  switch (criteria) {
    case "half":
      return base("과반을 초과하는");
    case "fourfifth":
      return base("오(5)분의 사(4)를 초과하는");
    case "unanimous":
      return "본 조 제1항 및 제2항에도 불구하고, 신탁본문 제18조 제1항의 처분 요청 권리는 각 우선수익자가 보유하는 것으로 하되, 개별 우선수익자의 공매 요청에 따른 공매실행(처분)은 우선수익자 전원이 동의한 결정을 따르기로 한다. 이 경우 위 처분요청에 따라 수탁자는 신탁부동산 처분 절차에 나아갈 수 있다.";
    case "twothird":
    default:
      return base("삼(3)분의 이(2)를 초과하는");
  }
}

export interface Annex4Options {
  majorityCriteria: MajorityCriteria;
  agentBank: string;
  includeArt21: boolean;
  builderName: "truster" | "trustee";
  trustorCount: number;
  representativeTrustor: string;
}

/** 별첨4 옵션 수집 (Doc 02 입력값 + 위탁자 수) */
export function getAnnex4Options(form: ContractForm): Annex4Options {
  const dc = form.docContents?.contract ?? ({} as ContractForm["docContents"]["contract"]);
  return {
    majorityCriteria: (dc.majorityCriteria || "twothird") as MajorityCriteria,
    agentBank: (dc.agentBank || "").trim(),
    includeArt21: !(dc.includeArt21 === false), // 기본 포함
    builderName: dc.builderName || "truster",
    trustorCount: form.trustors.length,
    representativeTrustor: form.trustors[0]?.name || "[대표위탁자]",
  };
}

export interface AssembledArticle {
  label: string;
  t: string;
  c: ClauseLine[];
}

/** 별첨4 조항 목록을 동적으로 조립 (번호 매기기 포함) */
export function assembleAnnex4Articles(opts: Annex4Options): AssembledArticle[] {
  const arts: AssembledArticle[] = [];
  let n = 0;
  const push = (art: AnnexArticle) => {
    n++;
    arts.push({ label: "제" + n + "조", t: art.t, c: art.c });
  };

  // 제1~8조
  for (let i = 0; i < 8; i++) push(ANNEX4_BASE[i]);
  // 위탁자 2명 이상 → 제8조의2, 제8조의3 자동 삽입 (메인 번호 증가 없음)
  if (opts.trustorCount >= 2) {
    arts.push({ label: ANNEX4_ART8_2.label!, t: ANNEX4_ART8_2.t, c: ANNEX4_ART8_2.c });
    arts.push({ label: ANNEX4_ART8_3.label!, t: ANNEX4_ART8_3.t, c: ANNEX4_ART8_3.c });
  }
  // 제9~20조
  for (let i = 8; i < 20; i++) push(ANNEX4_BASE[i]);
  // 인허가 (포함 시) → 다음 번호
  if (opts.includeArt21) {
    const inh = opts.builderName === "trustee" ? ANNEX4_INHEOGA_TRUSTEE : ANNEX4_INHEOGA_TRUSTER;
    push(inh);
  }
  // 간인대체 → 마지막 번호
  push(ANNEX4_GANIN);
  return arts;
}

/** 별첨4 동적 텍스트 치환 (dyn 키 / 플레이스홀더 처리) */
export function resolveAnnex4LineText(line: ClauseLine, opts: Annex4Options): string {
  if (line.dyn === "art3para3") return getArt3Para3Text(opts.majorityCriteria);
  let t = line.t || "";
  if (t.indexOf("{{AGENT_BANK}}") >= 0)
    t = t.replace("{{AGENT_BANK}}", opts.agentBank || "[              ]");
  if (t.indexOf("{{REPRESENTATIVE_TRUSTOR}}") >= 0)
    t = t.replace("{{REPRESENTATIVE_TRUSTOR}}", opts.representativeTrustor);
  return t;
}
