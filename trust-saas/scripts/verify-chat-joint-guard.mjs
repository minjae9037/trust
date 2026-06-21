/* ============================================================
   회귀 가드 — 계약 대화(chat·Pillar 1) 공동사업표준협약서(joint) 교차오염 차단
   (ChatPanel.tsx 배선 정적 검증)

   배경(정확성 가드레일·교차오염 차단·비-산출물):
   AI 어시스턴트(ChatPanel)의 자동 채움(update_form)은 담보신탁 ContractForm 전용이다
   — 도구 스키마(UPDATE_FORM_TOOL)·summarizeForm·mergeFormPatch 모두 collateral `form`
   과 1:1. 그러나 채팅 FAB 는 TrustApp 전역에 떠 있어 **공동사업표준협약서(joint)
   작성 중에도 열린다**. joint 는 입력 모델이 `jointForm` 으로 분리돼 있는데, 가드 전
   ChatPanel 은 docTypeId 와 무관하게:
     ① `summarizeForm(form)` 로 **빈 collateral 컨텍스트**를 Claude 에 전송(엉뚱한 안내),
     ② AI 가 돌려준 패치를 `mergeFormPatch(patch)` 로 **숨은 collateral form 에 적용**
        → 사용자가 joint 를 작성하는 동안 다른(collateral) 계약 폼이 조용히 오염됨
        (교차오염 — 같은 세션에서 이후 담보신탁 계약을 열면 AI 가 주입한 값이 잔존),
     ③ 인사·placeholder 가 "담보신탁"으로 고정돼 joint 사용자에게 오해를 줌.
   PDF 팝업 차단 거짓 성공 차단·AI 반영 가시화와 동일한 "정확성 가드레일" 결함.

   수정(비-산출물·표시/배선 전용): ChatPanel 이 store 의 docTypeId 를 읽어
   `isJoint = docTypeId === "joint"` 를 파생하고,
     - joint 이면 인사·placeholder 를 "양식에서 직접 입력" 안내로,
     - formSummary 를 collateral 요약 대신 joint 맥락 문구로,
     - AI 패치를 **collateral form 에 적용하지 않고**(교차오염 차단) 미지원 안내만 표시.
   collateral 경로(docTypeId≠"joint")는 100% 무변경(회귀 0).
   조문·엔진·산출물·도구 스키마 무접촉 — 호출부 분기만.

   단언:
     (A) ChatPanel 이 store 에서 docTypeId 를 구독하고 is="joint" 로 isJoint 파생
     (B) ★교차오염 차단 — 패치 적용(mergeFormPatch)이 joint 경로에서 제외(!isJoint/else 분기)
     (C) joint 패치 시 적용 대신 미지원 안내(note) 표시
     (D) formSummary 가 isJoint 분기(joint 이면 collateral summarizeForm 미전송)
     (E) 인사·placeholder 가 isJoint 분기(joint 전용 안내 문구 존재)
     (F) collateral 무회귀 — 비-joint 경로에 mergeFormPatch·summarizeForm·기존 인사 보존

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-chat-joint-guard.mjs
     (또는 node scripts/verify-chat-joint-guard.mjs — 정적 텍스트 검증이라 로더 불요)
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(__dir, "..", rel), "utf8");
const chat = src("src/components/trust/ChatPanel.tsx");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] docTypeId 구독 + isJoint 파생");
{
  ok(/const\s*\{[^}]*\bdocTypeId\b[^}]*\}\s*=\s*useContractStore\(\)/.test(chat), "store 에서 docTypeId 구독");
  ok(/const\s+isJoint\s*=\s*docTypeId\s*===\s*["']joint["']/.test(chat), 'isJoint = docTypeId === "joint" 파생');
}

console.log("\n[B] ★교차오염 차단 — joint 경로에서 mergeFormPatch 미적용");
{
  // 패치 적용 분기가 joint 를 먼저 걸러낸다: `if (data.patch && isJoint) { …안내… } else if (data.patch) { …mergeFormPatch… }`
  ok(/data\.patch\s*&&\s*isJoint/.test(chat), "패치 분기가 isJoint 를 먼저 검사(joint 우선 차단)");
  // mergeFormPatch 호출이 joint 전용(if isJoint) 블록이 아닌 else if(data.patch) 블록에만 존재.
  const jointBlock = chat.slice(
    chat.indexOf("data.patch && isJoint"),
    chat.indexOf("else if (data.patch)") + 0 >= 0 ? chat.indexOf("else if (data.patch)") : chat.length,
  );
  ok(!/mergeFormPatch/.test(jointBlock), "joint 분기 안에서는 mergeFormPatch 미호출(교차오염 차단)");
  ok(/else if \(data\.patch\)[\s\S]{0,400}mergeFormPatch\(patch\)/.test(chat), "비-joint(else if) 경로에서만 mergeFormPatch(patch) 적용");
}

console.log("\n[C] joint 패치 시 적용 대신 미지원 안내(note)");
{
  const jointBlock = chat.slice(chat.indexOf("data.patch && isJoint"), chat.indexOf("else if (data.patch)"));
  ok(/kind:\s*"note"/.test(jointBlock), "joint 패치 분기가 note 메시지로 안내");
  ok(/왼쪽 양식에서 직접 입력|자동 채움은 담보신탁/.test(jointBlock), "미지원 안내 문구 존재(자동 채움=담보신탁 전용)");
}

console.log("\n[D] formSummary 가 isJoint 분기");
{
  // 전송 본문에서 formSummary 가 삼항으로 분기(joint 이면 collateral summarizeForm 미전송)
  ok(/formSummary:\s*isJoint\s*\?/.test(chat), "formSummary 가 isJoint 삼항 분기");
  ok(/isJoint\s*\?[\s\S]{0,200}공동사업표준협약서[\s\S]{0,200}:\s*summarizeForm\(form\)/.test(chat),
    "joint=맥락 문구 / 그 외=summarizeForm(form)");
}

console.log("\n[E] 인사·placeholder isJoint 분기");
{
  // 초기 인사(useState 초기화)가 isJoint 삼항
  ok(/display:\s*isJoint\s*\?/.test(chat), "초기 인사 메시지가 isJoint 분기");
  ok(/placeholder=\{[\s\S]{0,40}isJoint\s*\?/.test(chat), "입력 placeholder 가 isJoint 분기");
  // 기존 collateral 인사 문구는 보존(비-joint 경로)
  ok(/위탁자\(시행사\) 상호부터 알려주시겠어요/.test(chat), "collateral 인사 문구 보존(비-joint)");
}

console.log("\n[F] collateral 무회귀 — 핵심 호출 보존");
{
  ok(/summarizeForm\(form\)/.test(chat), "summarizeForm(form) 보존(collateral 컨텍스트)");
  ok(/mergeFormPatch\(patch\)/.test(chat), "mergeFormPatch(patch) 보존(collateral 적용)");
  ok(/summarizePatch\(patch\)/.test(chat), "summarizePatch(patch) 보존(반영 가시화)");
  // 패치 적용 경로가 단 하나(else if)뿐 — joint/비-joint 양쪽에서 collateral 폼을 동시 오염하지 않음
  const applies = chat.match(/mergeFormPatch\(/g) || [];
  ok(applies.length === 1, "mergeFormPatch 호출은 정확히 1곳(else if 경로) — 중복 적용 없음");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
