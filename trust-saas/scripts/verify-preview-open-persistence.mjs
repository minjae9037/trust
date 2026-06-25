/* ============================================================
   회귀 가드 — 실시간 미리보기 접기/펼치기 선호 영속(previewPref + usePreviewOpen)

   배경: DocStep·JointForm 미리보기 접기/펼치기 토글(12:05·12:17 iteration)은
   선택이 컴포넌트 in-memory(useState)라, 문서를 바꾸거나(언마운트→재마운트)
   새로고침하면 매번 기본 펼침으로 돌아갔다. 좁은 화면에서 미리보기를 접어 입력에
   집중하던 사용자가 단계를 옮길 때마다 다시 접어야 했다.

   해결: 마지막 토글 선택을 localStorage(previewPref)에 보관하고, 두 위저드가
   공용 훅(usePreviewOpen)으로 읽어 문서 간·새로고침 후에도 유지한다.

   핵심 불변식:
     - ★표시 전용 — 조문·엔진·검증(validate)·산출물(docx) 무접촉. 저장 대상은
       불리언 선호 하나뿐(KEY=trust_preview_open).
     - SSR/하이드레이션 안전 — 초기 렌더는 항상 기본 펼침(useState(true))으로
       서버 마크업과 일치, 마운트 후 effect 에서 저장 선호 반영(localStorage 는
       서버에 없음). 미저장·손상·SSR 시 기본 펼침(후방호환).
     - 영속은 **사용자 토글에서만** — 마운트 적재 경로에선 저장하지 않아 저장된
       값을 자기 자신으로 덮어쓰지 않는다(effect 순서/클로버 문제 원천 차단).
     - best-effort — 용량 초과·시크릿 모드 쓰기 실패는 swallow(미리보기 동작 무영향).
     - DocStep·JointForm 단일 출처 — 두 컴포넌트가 동일 훅을 import·사용.

   단언:
     (A) previewPref 계약 — KEY·API 2종(load/save)·SSR 안전·기본 펼침·best-effort
     (B) previewPref 런타임 — 미저장→true·저장 0/1 왕복·손상→true·SSR→true·쓰기실패 swallow
     (C) usePreviewOpen 훅 — use client·useState(true)·마운트 load effect·토글 내 save·튜플 반환
     (D) DocStep/JointForm 배선 — import·usePreviewOpen() 사용·onClick=togglePreview
     (E) 무접촉 — previewPref·usePreviewOpen 가 validate/docx/engine 무import

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-preview-open-persistence.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const pref = read("src", "lib", "store", "previewPref.ts");
const hook = read("src", "lib", "store", "usePreviewOpen.ts");
const doc = read("src", "components", "trust", "steps", "DocStep.tsx");
const joint = read("src", "components", "trust", "JointForm.tsx");

console.log("\n[A] previewPref 계약 — KEY·API 2종·SSR 안전·기본 펼침·best-effort");
{
  ok(/const KEY = "trust_preview_open";/.test(pref),
     "저장 KEY = trust_preview_open(미리보기 선호 전용 키)");
  ok(/export function loadPreviewOpen\(\): boolean \{/.test(pref) &&
     /export function savePreviewOpen\(open: boolean\): void \{/.test(pref),
     "공개 API 2종(loadPreviewOpen·savePreviewOpen)");
  const loadAt = pref.indexOf("export function loadPreviewOpen");
  const loadBlock = pref.slice(loadAt, loadAt + 360);
  ok(/if \(typeof window === "undefined"\) return true;/.test(loadBlock),
     "loadPreviewOpen SSR 안전 — window 부재 시 기본 펼침(true)");
  ok(/if \(raw === null\) return true;/.test(loadBlock) && /return raw !== "0";/.test(loadBlock),
     "미저장(null)→펼침·\"0\"만 접힘·그 외(\"1\" 포함)→펼침(손상 내성·후방호환)");
  const saveAt = pref.indexOf("export function savePreviewOpen");
  const saveBlock = pref.slice(saveAt, saveAt + 320);
  ok(/if \(typeof window === "undefined"\) return;/.test(saveBlock),
     "savePreviewOpen SSR 안전 — window 부재 시 무동작");
  ok(/localStorage\.setItem\(KEY, open \? "1" : "0"\);/.test(saveBlock) &&
     /catch \{[\s\S]*?\}/.test(saveBlock),
     "savePreviewOpen best-effort — setItem(\"1\"/\"0\") + 실패 swallow(용량/시크릿 모드 무영향)");
}

console.log("\n[B] previewPref 런타임 — 미저장→true·저장 0/1 왕복·손상→true·SSR→true·쓰기실패 swallow");
{
  // window/localStorage 스텁으로 모듈을 실제 실행(정적 단언 보강)
  const storeMap = new Map();
  let throwOnSet = false;
  const origWindow = globalThis.window;
  const origLS = globalThis.localStorage;
  globalThis.window = {};
  globalThis.localStorage = {
    getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
    setItem: (k, v) => { if (throwOnSet) throw new Error("Quota"); storeMap.set(k, String(v)); },
    removeItem: (k) => storeMap.delete(k),
  };
  const m = await import("../src/lib/store/previewPref.ts");

  ok(m.loadPreviewOpen() === true, "미저장 상태 load → true(기본 펼침)");
  m.savePreviewOpen(false);
  ok(storeMap.get("trust_preview_open") === "0", "save(false) → 저장값 \"0\"(접힘)");
  ok(m.loadPreviewOpen() === false, "저장 후 load → false(접힘 유지=영속)");
  m.savePreviewOpen(true);
  ok(storeMap.get("trust_preview_open") === "1" && m.loadPreviewOpen() === true,
     "save(true) → \"1\" · load → true(펼침 왕복)");
  storeMap.set("trust_preview_open", "corrupt-x");
  ok(m.loadPreviewOpen() === true, "손상 값(\"corrupt-x\") load → true(기본 펼침 폴백)");
  // 쓰기 실패 swallow(throw 해도 예외 전파 안 함)
  throwOnSet = true;
  let threw = false;
  try { m.savePreviewOpen(false); } catch { threw = true; }
  ok(threw === false, "setItem 예외(용량 초과 모의) → savePreviewOpen 이 swallow(전파 안 함)");
  throwOnSet = false;
  // SSR — window 부재 시 안전 기본/무동작
  delete globalThis.window;
  ok(m.loadPreviewOpen() === true, "SSR(window 부재) load → true(안전 기본)");
  let ssrThrew = false;
  try { m.savePreviewOpen(false); } catch { ssrThrew = true; }
  ok(ssrThrew === false, "SSR(window 부재) save → 무동작(예외 없음)");

  // 스텁 원복(다른 가드 격리)
  if (origWindow === undefined) delete globalThis.window; else globalThis.window = origWindow;
  if (origLS === undefined) delete globalThis.localStorage; else globalThis.localStorage = origLS;
}

console.log("\n[C] usePreviewOpen 훅 — use client·useState(true)·마운트 load effect·토글 내 save·튜플 반환");
{
  ok(/^"use client";/m.test(hook),
     "use client(클라이언트 훅 — localStorage 접근)");
  ok(/const \[previewOpen, setPreviewOpen\] = useState\(true\);/.test(hook),
     "useState(true) — SSR 기본 펼침(하이드레이션 일치)");
  ok(/useEffect\(\(\) => \{[\s\S]*?setPreviewOpen\(loadPreviewOpen\(\)\);[\s\S]*?\}, \[\]\);/.test(hook),
     "마운트 1회 effect 가 loadPreviewOpen() 으로 저장 선호 반영(SSR 후 클라이언트 적재)");
  // save 는 토글 updater 안에서만(마운트 적재 경로엔 save 없음 → 클로버 차단)
  const toggleAt = hook.indexOf("const toggle = useCallback");
  const toggleBlock = hook.slice(toggleAt, toggleAt + 320);
  ok(/setPreviewOpen\(\(v\) => \{[\s\S]*const next = !v;[\s\S]*savePreviewOpen\(next\);[\s\S]*return next;/.test(toggleBlock),
     "토글은 setPreviewOpen 업데이터 안에서 savePreviewOpen(next) — 명시 토글에서만 영속");
  // 모듈 전체에서 savePreviewOpen 호출은 토글 경로 1곳뿐(마운트 load 경로엔 없음)
  const saveCalls = hook.split("savePreviewOpen(").length - 1;
  ok(saveCalls === 1, `savePreviewOpen 호출 = 토글 경로 1곳뿐(마운트 load 경로 무저장·클로버 차단) — 실제 ${saveCalls}`);
  ok(/return \[previewOpen, toggle\];/.test(hook),
     "[previewOpen, toggle] 튜플 반환(컴포넌트 배선 계약)");
}

console.log("\n[D] DocStep/JointForm 배선 — import·usePreviewOpen() 사용·onClick=togglePreview");
{
  for (const [name, src] of [["DocStep", doc], ["JointForm", joint]]) {
    ok(/import \{ usePreviewOpen \} from "@\/lib\/store\/usePreviewOpen";/.test(src),
       `${name}: usePreviewOpen 훅 import(영속 단일 출처)`);
    ok(/const \[previewOpen, togglePreview\] = usePreviewOpen\(\);/.test(src),
       `${name}: previewOpen = usePreviewOpen() — 로컬 useState(true) 제거(영속 위임)`);
    ok(/onClick=\{togglePreview\}/.test(src),
       `${name}: 토글 onClick = togglePreview(훅 제공 영속 토글)`);
    // 회귀: 옛 인라인 토글(setPreviewOpen) 잔재 없음
    ok(!/setPreviewOpen/.test(src),
       `${name}: 옛 인라인 setPreviewOpen 잔재 없음(전부 훅 위임)`);
  }
}

console.log("\n[E] 무접촉 — previewPref·usePreviewOpen 가 validate/docx/engine 무import(표시 전용)");
{
  for (const [name, src] of [["previewPref", pref], ["usePreviewOpen", hook]]) {
    ok(!/from "@\/lib\/engine\/(validate|docx|builders|model)"|engine\/clauses/.test(src) ||
       /from "@\/lib\/store\/previewPref"/.test(src),
       `${name}: 엔진/검증/산출물 무import(순수 표시 상태)`);
  }
  // previewPref 는 어떤 @ import 도 없어야(순수 localStorage 유틸)
  ok(!/^import /m.test(pref), "previewPref 는 import 0(순수 localStorage 유틸·의존성 표면 0)");
  // usePreviewOpen 은 react + previewPref 만 import
  ok(/from "react"/.test(hook) && /from "@\/lib\/store\/previewPref"/.test(hook) &&
     !/@\/lib\/engine/.test(hook),
     "usePreviewOpen 은 react + previewPref 만 import(엔진 무접촉)");
}

console.log(`\n${fail === 0 ? "OK" : "FAIL"} — ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
