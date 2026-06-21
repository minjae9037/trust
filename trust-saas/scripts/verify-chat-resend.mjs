/* ============================================================
   회귀 가드 — 계약 대화(chat·Pillar 1) 전송 실패 시 무손실 재전송("다시 시도")

   배경(유실 마찰, 비-산출물): ChatPanel.send 는 전송 직전 setInput("") 로 입력을
   비운 뒤, 오류 시 친화 메시지만 표시했다 → 사용자는 친 메시지를 다시 타이핑해야
   했다(유실 마찰). 입력란을 setInput(raw) 로 복원하는 방식은 "전송 진행 중 사용자가
   다음 메시지를 입력하면 그 입력을 덮어쓰는" 새 유실을 만든다. 그래서 입력란은
   건드리지 않고, 실패한 사용자 메시지가 이력에 버블로 보존된 점을 이용해 동일
   이력을 그대로 재전송하는 retry() 를 도입했다(딜리버리 코어 deliver(history) 를
   최초 전송·재전송이 공용).

   핵심 불변식:
     - 최초 전송과 재전송이 동일 이력에서 **동일 페이로드**를 만든다(무손실·무변형).
     - note(폼 반영 알림)·첫 인사(api="")는 전송에서 제외된다(기존 규약 보존).
     - user content 는 토큰화된 api 를 보낸다(원문 display 누출 금지 — PII 회귀가드).
     - ChatPanel 이 입력란을 복원하지 않는다(setInput(raw) 잔존 0 — 진행 중 타이핑 무손실).
     - ChatPanel 이 buildChatApiMessages 단일 출처를 쓴다(인라인 빌드 잔존 0).

   단언:
     (A) 전송 규약 — note·첫 인사 제외 / user→api / assistant→display
     (B) ★재전송 동일성 — 같은 이력 반복 호출이 동일 페이로드(멱등·무손실)
     (C) ★토큰 보존 — user content 는 api(토큰)이지 display(원문) 가 아니다
     (D) 안전 입력(비배열·null 원소·빈 배열) 무크래시
     (E) 배선 — deliver/send/retry 존재 · buildChatApiMessages 사용 · setInput(raw) 복원 0 · 인라인 빌드 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-chat-resend.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildChatApiMessages } from "../src/lib/chat/formSchema.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 대표 이력: 첫 인사(assistant·api="") + 사용자(토큰화) + assistant 답변 + note + 두 번째 사용자.
// ※기존 규약: assistant 는 api 가 비어도 전송에 포함(content=display) — 첫 인사도 모델 컨텍스트로
//   들어간다. note(kind:"note")와 api="" 인 user 만 제외된다. buildChatApiMessages 는 이를 그대로 보존.
const HISTORY = [
  { role: "assistant", display: "안녕하세요. 위탁자부터 알려주세요.", api: "" }, // 첫 인사
  { role: "user", display: "위탁자는 ABC개발 123-45-67890", api: "위탁자는 ABC개발 [사업자등록번호_1]" },
  { role: "assistant", display: "네, 확인했습니다.", api: "네, 확인했습니다." },
  { role: "assistant", display: "✓ 위탁자 1명 반영됨", api: "", kind: "note" },
  { role: "user", display: "우선수익자는 ○○은행 50억", api: "우선수익자는 ○○은행 50억" },
];

console.log("\n[A] 전송 규약 — note·빈 api 사용자 제외 / user→api / assistant→display");
{
  const out = buildChatApiMessages(HISTORY);
  ok(out.length === 4, "note 만 제외 후 4개(인사·user·assistant·user)");
  ok(out.every((m) => m.role === "user" || m.role === "assistant"), "역할은 user/assistant 만");
  ok(!out.some((m) => m.content === "✓ 위탁자 1명 반영됨"), "note 페이로드 미포함");
  ok(out[0].role === "assistant" && out[0].content === "안녕하세요. 위탁자부터 알려주세요.",
    "첫 인사(assistant) → display 로 전송(기존 규약 보존)");
  ok(out[1].role === "user" && out[1].content === "위탁자는 ABC개발 [사업자등록번호_1]",
    "user → 토큰화된 api 전송");
  ok(out[2].role === "assistant" && out[2].content === "네, 확인했습니다.",
    "assistant → 화면 원문 display 전송");
}

console.log("\n[B] ★재전송 동일성 — 같은 이력 반복 호출이 동일 페이로드(멱등·무손실)");
{
  // retry() 는 실패한 send() 와 같은 이력(msgs)으로 deliver 를 다시 호출한다.
  // 따라서 buildChatApiMessages(history) 가 호출마다 동일해야 "재타이핑 없는 무손실 재전송"이 성립.
  const first = buildChatApiMessages(HISTORY);
  const second = buildChatApiMessages(HISTORY);
  ok(eq(first, second), "동일 이력 2회 호출 → 동일 페이로드(멱등)");

  // 실패 후 retry 시나리오: 마지막이 미응답 사용자 메시지인 이력을 재전송해도
  // 마지막 사용자 메시지가 페이로드의 마지막에 손실·변형 없이 포함된다.
  const pending = HISTORY; // 마지막 = 두 번째 사용자(아직 미응답)
  const payload = buildChatApiMessages(pending);
  const last = payload[payload.length - 1];
  ok(last.role === "user" && last.content === "우선수익자는 ○○은행 50억",
    "미응답 사용자 메시지가 재전송 페이로드 말미에 그대로 보존");
  ok(payload.filter((m) => m.role === "user").length === 2, "사용자 메시지 중복 추가 없음(2개 그대로)");
}

console.log("\n[C] ★토큰 보존 — user content 는 api(토큰)이지 display(원문) 가 아니다");
{
  const out = buildChatApiMessages(HISTORY);
  const userMsgs = out.filter((m) => m.role === "user");
  ok(!userMsgs.some((m) => /123-45-67890/.test(m.content)),
    "원문 사업자등록번호(display) 가 전송 페이로드에 미등장(누출 0)");
  ok(userMsgs.some((m) => /\[사업자등록번호_1\]/.test(m.content)), "토큰화된 api 가 전송됨");
}

console.log("\n[D] 안전 입력 무크래시");
{
  ok(eq(buildChatApiMessages([]), []), "빈 이력 → 빈 배열");
  ok(eq(buildChatApiMessages(null), []), "null → 빈 배열(무크래시)");
  ok(eq(buildChatApiMessages(undefined), []), "undefined → 빈 배열(무크래시)");
  // null/비정상 원소 격리
  const dirty = [null, { role: "user", display: "x", api: "x" }, { role: "user", display: "y", api: "" }];
  const out = buildChatApiMessages(dirty);
  ok(out.length === 1 && out[0].content === "x", "null 원소·빈 api 사용자 제외, 유효 1개만");
}

console.log("\n[E] 배선 — ChatPanel deliver/send/retry · 단일 출처 · 입력 무복원");
{
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const panel = readFileSync(path.join(root, "src", "components", "trust", "ChatPanel.tsx"), "utf8");

  ok(/async function deliver\(/.test(panel), "deliver(history) 딜리버리 코어 존재");
  ok(/async function send\(\)/.test(panel), "send() 존재");
  ok(/function retry\(\)/.test(panel), "retry() 존재");
  ok(/await deliver\(nextMsgs\)/.test(panel), "send() 가 deliver(nextMsgs) 위임");
  ok(/deliver\(msgs\)/.test(panel), "retry() 가 보존된 이력(msgs) 재전송");
  ok(/buildChatApiMessages\(history\)/.test(panel), "deliver 가 buildChatApiMessages 단일 출처 사용");
  ok(/import\s*\{[\s\S]*?buildChatApiMessages[\s\S]*?\}\s*from\s*["']@\/lib\/chat\/formSchema["']/.test(panel),
    "ChatPanel 가 formSchema 에서 buildChatApiMessages import");

  // ★입력 무복원 — setInput(raw)/setInput(input) 복원 패턴 잔존 0(진행 중 타이핑 무손실)
  ok(!/setInput\(\s*raw\s*\)/.test(panel), "setInput(raw) 입력 복원 잔존 0");
  ok((panel.match(/setInput\(/g) || []).length === 2,
    "setInput 호출은 onChange·전송 시 비우기 2회뿐(복원 추가 없음)");

  // ★인라인 페이로드 빌드 잔존 0 — .filter(...).map(...) 인라인 변환이 deliver 밖/안에 없어야 단일 출처
  ok(!/\.filter\(\(m\)\s*=>\s*m\.kind\s*!==\s*"note"/.test(panel),
    "인라인 apiMessages .filter(kind!=='note') 빌드 잔존 0(단일 출처화)");

  // 재전송 버튼 — 실패 + 미응답 사용자 메시지일 때만 노출
  ok(/canRetry/.test(panel) && /다시 시도/.test(panel), "'다시 시도' 버튼 + canRetry 게이트 존재");
  ok(/msgs\[msgs\.length - 1\]\?\.role === "user"/.test(panel),
    "canRetry = 마지막이 미응답 사용자 메시지 조건");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
