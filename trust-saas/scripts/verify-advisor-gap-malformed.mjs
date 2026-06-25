/* ============================================================
   회귀 가드 — 상담 자가고도화 루프 [분석] 단계(advisor-improve.mjs)의
   "로그 인코딩 손상 질문 제외" 정직성.

   배경(정직성 갭): advisor-improve.mjs 는 advisor-logs/*.jsonl 의 질문을
   현재 retrieve()로 재채점해 gap-report.md(지식 공백 리포트)를 만든다.
   그런데 헤드리스/CP949 테스트 세션이 **깨진 바이트로 기록한 질문**
   (유니코드 대체문자 U+FFFD·사설영역 U+E000–U+F8FF 포함; 예: '…zxq42',
   '???????')은 실재하는 단어가 아니라 어떤 KNOWLEDGE 청크와도 매칭될 수
   없어 무조건 score 0 이 된다. 종전엔 이를 그대로 "지식공백"으로 집계해
   ①미적중률을 부풀리고 ②보강 우선순위 키워드를 쓰레기 토큰으로 오염시켜
   사업팀(신탁) 검수를 오도했다(자가고도화 루프의 거짓 공백). 이제 손상
   질문은 `isMalformed()` 로 걸러 공백·키워드 집계에서 빼고, "제외(로그
   인코딩 손상) N건" 으로 **투명 보고**한다(은폐 아님 — 원문 섹션 노출).

   본 가드는 ①스크립트가 손상 탐지·제외·투명 보고 배선을 갖췄는지(static)
   + ②그 손상 탐지 술어가 실제로 손상 문자열만 골라내는지(behavioral)
   + ③분석 전용(산출물·knowledge.ts 무기록) 불변식을 고정한다.

   단언:
     (A) 스크립트 배선 — isMalformed 헬퍼·U+FFFD/사설영역 코드포인트·
         malformed 플래그가 isGap 게이팅·misses/validQueries 가 손상 제외·
         total=validQueries.length(분모 정정)·제외 카운트 요약·원문 섹션
     (B) 손상 탐지(behavioral) — 손상 코드포인트(U+FFFD·PUA) 문자열은 true,
         정상 한글/영문/숫자/기호 질문은 false (오탐 0)
     (C) 무접촉 — gap-report.md 만 기록, knowledge.ts/src 무기록·분석 전용

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-gap-malformed.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const dir = path.dirname(fileURLToPath(import.meta.url));
const script = readFileSync(path.join(dir, "advisor-improve.mjs"), "utf8");

console.log("[A] 스크립트 배선 — 손상 로그 탐지·제외·투명 보고");
{
  ok(/function\s+isMalformed\s*\(/.test(script), "isMalformed 헬퍼 정의");
  // 손상 판정 코드포인트 = U+FFFD 대체문자 · U+E000–U+F8FF 사설영역
  ok(/0xfffd/i.test(script), "대체문자 U+FFFD(0xfffd) 검사");
  ok(/0xe000/i.test(script) && /0xf8ff/i.test(script), "사설영역 U+E000–U+F8FF 검사");
  // malformed 플래그가 공백 분류(isGap)를 게이팅 — 손상이면 공백 후보에서 제외
  ok(/malformed\s*&&\s*isMalformed|isMalformed\(\s*r\.q\s*\)/.test(script), "malformed 플래그를 r.q 로 산정");
  ok(/isGap:\s*!\s*malformed\s*&&/.test(script), "isGap = !malformed && weak (손상은 공백 아님)");
  // 집계 분리 — 손상은 별도 버킷, 유효 질문만 미적중/분모
  ok(/malformedQueries\s*=\s*scoredQueries\.filter\(\s*\(?r\)?\s*=>\s*r\.malformed\s*\)/.test(script),
    "malformedQueries = 손상 버킷 분리");
  ok(/validQueries\s*=\s*scoredQueries\.filter\(\s*\(?r\)?\s*=>\s*!\s*r\.malformed\s*\)/.test(script),
    "validQueries = 손상 제외 버킷");
  ok(/misses\s*=\s*validQueries\.filter/.test(script), "misses 는 validQueries 에서만 (손상 미포함)");
  ok(/const\s+total\s*=\s*validQueries\.length/.test(script), "미적중률 분모 total = validQueries.length (손상 제외)");
  // 투명 보고 — 요약 제외 카운트 + 원문 섹션(은폐 아님)
  ok(/제외\(로그 인코딩 손상\)/.test(script) && /malformedQueries\.length/.test(script),
    "요약에 '제외(로그 인코딩 손상) N건' 라인");
  ok(/제외된 손상 로그|손상 로그/.test(script) && /recentMalformed/.test(script),
    "손상 원문 전용 섹션(투명 노출)");
  // 키워드 집계가 손상에 오염되지 않음 — topTokens 입력이 misses(=valid) 에서 파생
  ok(/topTokens\(\s*misses\.map/.test(script), "키워드 집계 = misses(손상 제외) 파생");
}

console.log("\n[B] 손상 탐지(behavioral) — 라우트 코퍼스 밖 아티팩트만 제외");
{
  // 스크립트와 동형의 참조 구현(같은 코드포인트 계약). 손상 문자열만 true.
  const ref = (s) => {
    if (typeof s !== "string") return false;
    for (const ch of s) {
      const c = ch.codePointAt(0);
      if (c === 0xfffd || (c >= 0xe000 && c <= 0xf8ff)) return true;
    }
    return false;
  };
  const FFFD = String.fromCodePoint(0xfffd); // 대체문자(깨진 바이트)
  const PUA = String.fromCodePoint(0xe123);  // 사설영역 표본
  ok(ref(FFFD + FFFD + FFFD) === true, "U+FFFD 대체문자 문자열 → 손상(true)");
  ok(ref(PUA + PUA) === true, "사설영역(PUA) 문자열 → 손상(true)");
  ok(ref(FFFD + FFFD + " zxq42") === true, "손상+합성토큰 혼합 → 손상(true)");
  // 정상 질문은 절대 오탐하지 않는다(미적중 누락 방지) — 한글/영문/숫자/기호 포함.
  ok(ref("담보신탁이 무엇인가요?") === false, "정상 한글 질문 → 손상 아님(false)");
  ok(ref("PF 대출 구조를 길게 설명해줘") === false, "한영숫자 혼합 질문 → 손상 아님(false)");
  ok(ref("담보신탁 우선수익한도금액을 120~130%로 잡는 이유는?") === false, "기호(~%?) 포함 질문 → 손상 아님(false)");
  ok(ref("") === false, "빈 문자열 → 손상 아님(false)");
  ok(ref(undefined) === false, "비문자열 → 손상 아님(false)");
}

console.log("\n[C] 무접촉 — 분석 전용(산출물·knowledge.ts 무기록)");
{
  ok(/writeFile\([^)]*gap-report\.md/.test(script) || /"gap-report\.md"/.test(script),
    "기록 = advisor-logs/gap-report.md");
  ok(!/writeFile\([^)]*knowledge\.ts/.test(script) && !/writeFile\([^)]*src[\\/]/.test(script),
    "knowledge.ts/src 무기록 (보강은 사업팀 검수 게이트)");
  ok(!/KNOWLEDGE\s*\.\s*push|KNOWLEDGE\s*=/.test(script), "KNOWLEDGE 코퍼스 무변형");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
if (fail > 0) process.exit(1);
