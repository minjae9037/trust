/* ============================================================
   회귀 가드 — 내 계약 목록: 위탁자·물건 소재지 식별/검색 보강

   배경: 계약 카드/검색은 제목·서류종만 다뤘다. 그러나 실무에선 계약을 **위탁자(truster)·
   물건 소재지**로 식별한다(제목은 자유 입력·미입력·"(사본)" 다수라 구분이 어렵다).
   contractIdentity(row)로 form_data에서 대표 위탁자명·첫 물건 소재지를 안전하게 뽑아
   카드 부제 표시 + 검색 대상에 포함했다.

   핵심 불변식:
     - contractIdentity 는 ContractsView(표시)와 검색의 **단일 출처**(같은 함수 import).
     - 구버전·손상 저장본(키 누락·null·이질 doc_type)에도 절대 throw 하지 않는다(목록 크래시 방지).

   단언:
     (A) collateral → trustors[0].name / properties[0].address 추출(+ trim)
     (B) joint → gap.name / project.site 추출
     (C) 손상/구버전(빈 객체·null·키 누락) → {"",""} (크래시 0)
     (D) 검색 매칭: 위탁자명·물건 소재지로 계약을 찾을 수 있고(신규), 제목 검색도 유지(회귀無)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-contracts-search.mjs
   ============================================================ */
import { contractIdentity } from "../src/lib/contractRepo.ts";
import { blankContractForm } from "../src/lib/engine/model.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] collateral → 위탁자명·물건 소재지 추출(+trim)");
{
  const form = blankContractForm();
  form.trustors[0].name = "  주식회사 갑개발  "; // 앞뒤 공백 → trim 확인
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";
  const id = contractIdentity({ doc_type: "collateral", form_data: form });
  ok(id.trustor === "주식회사 갑개발", `trustor 추출·trim (실제 "${id.trustor}")`);
  ok(id.property === "서울특별시 강남구 테헤란로 1", `property 추출 (실제 "${id.property}")`);
}

console.log("\n[B] joint → gap.name·project.site 추출");
{
  const jointForm = { gap: { name: "을시행사" }, project: { site: "판교 제2테크노밸리" } };
  const id = contractIdentity({ doc_type: "joint", form_data: jointForm });
  ok(id.trustor === "을시행사", `joint 대표(갑) 추출 (실제 "${id.trustor}")`);
  ok(id.property === "판교 제2테크노밸리", `joint 사업지 추출 (실제 "${id.property}")`);
}

console.log("\n[C] 손상/구버전 저장본 → {'',''} (크래시 0)");
{
  ok(JSON.stringify(contractIdentity({ doc_type: "collateral", form_data: {} })) === '{"trustor":"","property":""}', "빈 객체 form_data");
  ok(JSON.stringify(contractIdentity({ doc_type: "collateral", form_data: null })) === '{"trustor":"","property":""}', "null form_data");
  ok(JSON.stringify(contractIdentity({ doc_type: "collateral", form_data: { trustors: [] } })) === '{"trustor":"","property":""}', "trustors 빈 배열");
  ok(JSON.stringify(contractIdentity({ doc_type: "fund", form_data: { trustors: [{ name: "" }] } })) === '{"trustor":"","property":""}', "이질 doc_type·빈 이름");
}

console.log("\n[D] 검색 매칭 — 위탁자·물건으로 찾기(신규) + 제목 검색 유지(회귀無)");
{
  // ContractsView 의 검색 haystack 재현(제목·서류명·위탁자·물건)
  const rowOf = (title, form, doc_type = "collateral", docName = "부동산담보신탁") => ({ title, doc_type, form_data: form });
  const matches = (row, q, docName = "부동산담보신탁") => {
    const { trustor, property } = contractIdentity(row);
    const hay = `${row.title} ${docName} ${trustor} ${property}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  };
  const f1 = blankContractForm();
  f1.trustors[0].name = "한국투자부동산";
  f1.properties[0].address = "역삼동 123";
  const row = rowOf("2026 1차 담보", f1);

  ok(matches(row, "한국투자"), "위탁자명 부분일치로 검색됨(신규 기능)");
  ok(matches(row, "역삼"), "물건 소재지로 검색됨(신규 기능)");
  ok(matches(row, "1차 담보"), "제목 검색 유지(회귀無)");
  ok(matches(row, "담보신탁"), "서류명 검색 유지(회귀無)");
  ok(!matches(row, "존재하지않는키워드"), "무관 키워드는 매칭 안 됨");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
