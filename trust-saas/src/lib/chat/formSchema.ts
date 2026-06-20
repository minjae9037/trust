/* ================================================================
   Claude 구조화 추출 도구 정의 + 폼 요약(PII 마스킹)
   update_form 의 input_schema 는 ContractForm 부분 패치와 1:1.
   ================================================================ */
import type { ContractForm } from "@/lib/engine/model";

const partyProps = {
  type: { type: "string", enum: ["법인", "개인"] },
  name: { type: "string", description: "법인명 또는 성명" },
  corpRegNo: {
    type: "string",
    description:
      "법인등록번호 전체(######-####### 형식). 토큰([법인등록번호_N])으로 보이면 절대 쪼개지 말고 토큰 전체를 그대로 넣을 것.",
  },
  bizNo: {
    type: "string",
    description: "사업자등록번호 전체(###-##-##### 형식). 토큰이면 그대로 넣을 것.",
  },
  representativeDirector: { type: "string", description: "대표이사" },
  insideDirector: { type: "string", description: "사내이사" },
  address: { type: "string" },
  contact: { type: "string" },
  loanAmount: { type: "string", description: "대출금액(원, 숫자만). 우선수익자만" },
  claimDebtor: { type: "string", description: "피담보채권 채무자. 우선수익자만" },
  securedClaim: { type: "string", description: "피담보채권 문구. 우선수익자만" },
};
const partyArray = (role: string) => ({
  type: "array",
  description: `${role}. 수정 시 전체 목록을 완전한 객체 배열로 반환할 것(부분 항목만 보내면 기존 항목이 사라짐).`,
  items: { type: "object", properties: partyProps },
});

/** Anthropic tool 정의 */
export const UPDATE_FORM_TOOL = {
  name: "update_form",
  description:
    "대화에서 확정된 담보신탁 계약 정보를 구조화된 폼으로 채운다. 사용자가 명시적으로 말한 값만 채우고, 추측하지 말 것. 배열(관계사·부동산)은 수정 시 전체를 완전한 형태로 반환.",
  input_schema: {
    type: "object" as const,
    properties: {
      trustors: partyArray("위탁자"),
      debtorSameAsTrustor: { type: "boolean", description: "채무자가 위탁자와 동일" },
      debtors: partyArray("채무자"),
      beneficiarySameAsTrustor: { type: "boolean", description: "수익자가 위탁자와 동일" },
      beneficiaries: partyArray("수익자"),
      priorities: partyArray("우선수익자(금융기관 등)"),
      properties: {
        type: "array",
        description: "신탁 부동산 목록. 수정 시 전체 반환.",
        items: {
          type: "object",
          properties: {
            address: { type: "string", description: "소재지" },
            category: { type: "string", description: "지목" },
            area: { type: "string", description: "면적(㎡)" },
            regNo: { type: "string", description: "등기 고유번호" },
          },
        },
      },
      common: {
        type: "object",
        properties: {
          year: { type: "number" },
          month: { type: "number" },
          day: { type: ["number", "string"], description: "일(미정이면 빈 문자열)" },
          trustFee: { type: "string", description: "신탁보수(원, 숫자만)" },
          priorityRatio: { type: "number", description: "우선수익한도 비율 %(100~150)" },
          trustPeriod: { type: "string" },
        },
      },
      contractOptions: {
        type: "object",
        description: "담보신탁계약서 별첨4 특약 가변 4요소",
        properties: {
          majorityCriteria: {
            type: "string",
            enum: ["half", "twothird", "fourfifth", "unanimous"],
            description: "다수우선수익자 처분 의사결정 기준",
          },
          agentBank: { type: "string", description: "제20조 대리금융기관명" },
          includeArt21: { type: "boolean", description: "제21조 인허가 조항 포함 여부" },
          builderName: { type: "string", enum: ["truster", "trustee"], description: "건축주 명의" },
        },
      },
    },
  },
};

/** PII 마스킹된 현재 폼 요약 — Claude 컨텍스트용(빈/채움 위주, 식별자 값 숨김) */
export function summarizeForm(form: ContractForm): string {
  const mask = (v: string) => (v ? "입력됨" : "미입력");
  const partyLine = (p: ContractForm["trustors"][number]) =>
    `${p.name || "(이름 미입력)"} / 구분:${p.type} / 법인등록번호:${
      p.corpRegFront ? "입력됨" : "미입력"
    } / 대표이사:${p.representativeDirector || "미입력"}`;

  const lines: string[] = [];
  lines.push(`■ 위탁자 ${form.trustors.length}명`);
  form.trustors.forEach((p, i) => lines.push(`  - 위탁자${i + 1}: ${partyLine(p)}`));
  lines.push(`■ 채무자: ${form.debtorSameAsTrustor ? "위탁자와 동일" : `${form.debtors.length}명 별도`}`);
  lines.push(
    `■ 수익자: ${form.beneficiarySameAsTrustor ? "위탁자와 동일" : `${form.beneficiaries.length}명 별도`}`
  );
  lines.push(`■ 우선수익자 ${form.priorities.length}명`);
  form.priorities.forEach((p, i) =>
    lines.push(
      `  - 우선수익자${i + 1}: ${p.name || "(이름 미입력)"} / 대출금액:${
        p.loanAmount ? Number(p.loanAmount).toLocaleString() + "원" : "미입력"
      }`
    )
  );
  lines.push(`■ 신탁부동산 ${form.properties.filter((p) => p.address).length}건`);
  const c = form.common;
  lines.push(
    `■ 조건: 계약일 ${c.year}-${c.month}-${c.day || "미정"} / 비율 ${c.priorityRatio}% / 신탁보수 ${mask(
      c.trustFee
    )} / 우선수익한도 ${c.priorityLimit ? Number(c.priorityLimit).toLocaleString() + "원(자동)" : "미산정"}`
  );
  const dc = form.docContents.contract;
  lines.push(
    `■ 특약옵션: 기준 ${dc.majorityCriteria} / 대리금융기관 ${dc.agentBank || "미입력"} / 제21조 ${
      dc.includeArt21 ? "포함" : "제외"
    } / 건축주 ${dc.builderName}`
  );
  return lines.join("\n");
}

/** update_form tool 입력 → contractStore mergeFormPatch 용 패치로 변환 */
export function toolInputToPatch(input: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = { ...input };
  // contractOptions → docContents.contract 로 매핑
  if (input.contractOptions) {
    patch.docContents = { contract: input.contractOptions };
    delete patch.contractOptions;
  }
  return patch;
}

/** 관계사의 corpRegNo/bizNo(전체) → 저장 필드(앞/뒤, p1/p2/p3)로 분리.
 *  ⚠️ PII 복원(restorePIIDeep) 이후에 호출할 것. */
export function normalizePatchIds(
  patch: Record<string, unknown>
): Record<string, unknown> {
  const roles = ["trustors", "debtors", "beneficiaries", "priorities"];
  for (const r of roles) {
    const arr = patch[r];
    if (!Array.isArray(arr)) continue;
    patch[r] = arr.map((p) => {
      const out = { ...(p as Record<string, unknown>) };
      if (typeof out.corpRegNo === "string") {
        const m = out.corpRegNo.match(/(\d{6})-?(\d{7})/);
        if (m) {
          out.corpRegFront = m[1];
          out.corpRegBack = m[2];
        }
        delete out.corpRegNo;
      }
      if (typeof out.bizNo === "string") {
        const m = out.bizNo.match(/(\d{3})-?(\d{2})-?(\d{5})/);
        if (m) {
          out.bizP1 = m[1];
          out.bizP2 = m[2];
          out.bizP3 = m[3];
        }
        delete out.bizNo;
      }
      return out;
    });
  }
  return patch;
}
