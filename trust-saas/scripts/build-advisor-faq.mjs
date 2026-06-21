/* ================================================================
   상담 시맨틱 캐시 — 정적 FAQ 시드 생성기
   자주 묻는 신탁/PF/세무/구조화 질문을 라이브 상담 엔드포인트(/api/advisor)에
   POST 해 같은 RAG+페르소나로 답을 받아 _advisor-faq.json 으로 번들한다.
   → 배포 후 동일·유사 질문은 LLM 호출 없이(무 API) 즉답된다.

   실행:
     node scripts/build-advisor-faq.mjs
     ADVISOR_BASE=http://localhost:3000 node scripts/build-advisor-faq.mjs
   (기본 BASE = 운영 URL. 엔드포인트가 떠 있어야 함.)

   안전: 실패한 질문은 건너뛰고 기존 답이 있으면 보존(부분 갱신).
   ================================================================ */
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "src", "lib", "advisor", "_advisor-faq.json");
const BASE = (process.env.ADVISOR_BASE || "https://trust-olive.vercel.app").replace(/\/$/, "");

/** 자주 묻는 질문(일반 지식형 — 특정 딜·계약서작성 의도 제외). */
const QUESTIONS = [
  // 신탁 상품 기본/비교
  "담보신탁이 뭐야?",
  "담보신탁과 근저당의 차이가 뭔가요?",
  "관리형토지신탁은 어떤 구조인가요?",
  "관리형토지신탁 일반형과 책임준공형의 차이는?",
  "차입형토지신탁이 담보신탁·관리형과 어떻게 다른가요?",
  "분양관리신탁은 언제 쓰는 신탁인가요?",
  "처분신탁의 구조와 목적은 무엇인가요?",
  "자금관리대리사무란 무엇이고 신탁과 어떻게 다른가요?",
  "토지신탁의 종류와 각각의 차이를 정리해줘.",
  "신탁사가 사업시행자가 되는 신탁은 어떤 것들이 있나요?",
  // 우선수익권/구조
  "우선수익권이란 무엇인가요?",
  "우선수익권 한도는 보통 대출원금의 몇 퍼센트로 설정하나요?",
  "수익권과 수익증권의 차이는?",
  "신탁의 도산절연 효과란 무엇인가요?",
  "위탁자·수탁자·수익자의 역할은 각각 무엇인가요?",
  // PF/개발금융
  "부동산 PF 구조를 단계별로 설명해줘.",
  "브릿지론과 본PF의 차이는 무엇인가요?",
  "책임준공확약이란 무엇이고 왜 중요한가요?",
  "PF 대주단 구조와 트랜치(선/중/후순위)는 어떻게 나뉘나요?",
  "신용보강 수단에는 어떤 것들이 있나요?",
  "에쿼티·메자닌·시니어의 차이는 무엇인가요?",
  // 분양/사업
  "분양관리신탁과 대리사무의 관계는 어떻게 되나요?",
  "선분양과 후분양의 차이와 장단점은?",
  "분양대금은 어떤 계좌로 어떻게 관리되나요?",
  // 세무
  "신탁재산의 취득세는 누가 부담하나요?",
  "신탁 부동산의 재산세 납세의무자는 누구인가요?",
  "신탁 과세특례란 무엇인가요?",
  "종합부동산세에서 신탁재산은 어떻게 과세되나요?",
  // 자본시장/구조화
  "리츠(REITs)와 부동산펀드의 차이는?",
  "ABS와 ABCP의 차이는 무엇인가요?",
  "워터폴(자금배분 순서) 구조란 무엇인가요?",
  // 실무 절차
  "담보신탁 설정 절차는 어떻게 되나요?",
  "신탁계약이 종료되는 사유에는 어떤 것들이 있나요?",
  "신탁부동산을 공매로 처분하는 절차는?",
  "수익권증서는 무엇이고 어떻게 발행되나요?",
];

/** 본문 끝의 서류작성 마커(<<doc:...>>)는 FAQ 답에선 제거. */
function stripDocMarker(s) {
  return s.replace(/\s*<<doc:[a-z_]+>>\s*$/i, "").trim();
}

async function ask(q) {
  const res = await fetch(`${BASE}/api/advisor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: q }] }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const cacheHdr = res.headers.get("x-advisor-cache") || "?";
  const srcHdr = res.headers.get("x-advisor-sources");
  let sources = [];
  if (srcHdr) {
    try {
      sources = JSON.parse(Buffer.from(srcHdr, "base64").toString("utf8"));
    } catch {}
  }
  const answer = stripDocMarker(await res.text());
  return { answer, sources, cacheHdr };
}

function loadExisting() {
  if (!existsSync(OUT)) return new Map();
  try {
    const arr = JSON.parse(readFileSync(OUT, "utf8"));
    return new Map(arr.map((e) => [e.q, e]));
  } catch {
    return new Map();
  }
}

async function main() {
  console.log(`[FAQ] BASE=${BASE}  질문 ${QUESTIONS.length}개`);
  const prev = loadExisting();
  const out = [];
  let ok = 0,
    kept = 0,
    failed = 0;
  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    try {
      const { answer, sources, cacheHdr } = await ask(q);
      if (!answer || answer.length < 40 || answer.includes("[오류]")) {
        throw new Error(`빈/오류 응답(len=${answer?.length || 0})`);
      }
      out.push({ id: `faq-${i}`, q, answer, sources });
      ok++;
      console.log(`  ✓ ${i + 1}/${QUESTIONS.length} [${cacheHdr}] ${q}  (${answer.length}자)`);
    } catch (e) {
      const old = prev.get(q);
      if (old) {
        out.push({ ...old, id: `faq-${i}` });
        kept++;
        console.log(`  · ${i + 1}/${QUESTIONS.length} 실패→기존유지 ${q}  (${e.message})`);
      } else {
        failed++;
        console.log(`  ✗ ${i + 1}/${QUESTIONS.length} 실패 ${q}  (${e.message})`);
      }
    }
    await new Promise((r) => setTimeout(r, 800)); // 레이트리밋 여유
  }
  writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
  console.log(`\n[FAQ] 저장 ${OUT}`);
  console.log(`[FAQ] 신규 ${ok} · 기존유지 ${kept} · 실패 ${failed} · 총 ${out.length}`);
}

main().catch((e) => {
  console.error("[FAQ] 치명적 오류:", e);
  process.exit(1);
});
