/* ============================================================
   회귀 가드 — localStorage 저장 실패(용량 초과·비활성) 가드

   배경: 앱은 로컬 우선(localStorage)이라 저장 실패는 곧 데이터 유실이다.
   localStorage 는 보통 5~10MB로 한정돼 계약이 쌓이면 setItem 이
   QuotaExceededError 를 던지고, 사생활/시크릿 모드에선 접근이 막혀
   SecurityError 를 던질 수 있다. 가드 없던 writeAll 은 브라우저별 영문
   DOMException 을 그대로 노출해 사용자가 무엇을 해야 할지 알 수 없었다.
   이제 친화적 한글 안내(백업 후 정리)로 surface 하고, 실패 시에도 기존
   저장본을 손상시키지 않는다(부분 기록 없음).

   핵심 불변식(데이터 안전):
     - 용량 초과는 모든 브라우저 변종(name/code)에서 식별된다.
     - 저장 실패는 StorageWriteError(친화적 한글 메시지)로 던진다.
     - 저장 실패 시 기존 저장본은 무손상(새 변경만 미반영).
     - 정상 경로(여유 공간)는 회귀 없이 그대로 저장된다.

   단언:
     (A) isQuotaExceeded: 브라우저 변종 전부 식별 + 무관 오류 음성
     (B) storageWriteErrorMessage: quota 여부로 분기·단일 출처
     (C) StorageWriteError: Error 상속 + quota 플래그 보존
     (D) 용량 초과 저장 → StorageWriteError(quota=true), 기존 데이터 무손상
     (E) 저장소 비활성(SecurityError) → StorageWriteError(quota=false)
     (F) 정상 경로 무회귀: 여유 공간 시 저장·조회 정상

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-storage-write-guard.mjs
   ============================================================ */
import {
  isQuotaExceeded,
  storageWriteErrorMessage,
  StorageWriteError,
  saveContract,
  listContracts,
} from "../src/lib/contractRepo.ts";
import { blankContractForm } from "../src/lib/engine/model.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

/* --- 테스트용 localStorage 모킹(toggle 로 setItem 실패 주입) --- */
function makeStore() {
  const map = new Map();
  return {
    mode: "ok", // "ok" | "quota" | "security"
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    removeItem(k) { map.delete(k); },
    clear() { map.clear(); },
    setItem(k, v) {
      if (this.mode === "quota") {
        const e = new Error("exceeded the quota");
        e.name = "QuotaExceededError";
        e.code = 22;
        throw e;
      }
      if (this.mode === "security") {
        const e = new Error("access denied");
        e.name = "SecurityError";
        throw e;
      }
      map.set(k, String(v));
    },
  };
}

console.log("\n[A] isQuotaExceeded — 브라우저 변종 전부 식별 + 무관 오류 음성");
{
  const chrome = Object.assign(new Error("x"), { name: "QuotaExceededError" });
  const chromeCode = Object.assign(new Error("x"), { code: 22 });
  const firefoxName = Object.assign(new Error("x"), { name: "NS_ERROR_DOM_QUOTA_REACHED" });
  const firefoxCode = Object.assign(new Error("x"), { code: 1014 });
  const legacy = Object.assign(new Error("x"), { name: "QUOTA_EXCEEDED_ERR" });
  ok(isQuotaExceeded(chrome), "Chrome/Safari name QuotaExceededError → true");
  ok(isQuotaExceeded(chromeCode), "code 22 → true");
  ok(isQuotaExceeded(firefoxName), "Firefox name NS_ERROR_DOM_QUOTA_REACHED → true");
  ok(isQuotaExceeded(firefoxCode), "Firefox code 1014 → true");
  ok(isQuotaExceeded(legacy), "legacy name QUOTA_EXCEEDED_ERR → true");
  ok(!isQuotaExceeded(Object.assign(new Error("x"), { name: "SecurityError" })), "SecurityError → false(용량 아님)");
  ok(!isQuotaExceeded(new Error("plain")), "일반 Error → false");
  ok(!isQuotaExceeded(null) && !isQuotaExceeded(undefined) && !isQuotaExceeded("str"), "null/undefined/원시값 → false(무크래시)");
}

console.log("\n[B] storageWriteErrorMessage — quota 여부로 분기(단일 출처)");
{
  const q = storageWriteErrorMessage(true);
  const s = storageWriteErrorMessage(false);
  ok(q.includes("가득") && q.includes("내보내기"), "quota 메시지=용량 초과+백업 안내");
  ok(s.includes("시크릿") || s.includes("사생활"), "비-quota 메시지=사생활 모드 안내");
  ok(q !== s, "두 분기 메시지 상이");
  ok(typeof q === "string" && q.length > 0 && typeof s === "string" && s.length > 0, "둘 다 비어있지 않은 한글 안내");
}

console.log("\n[C] StorageWriteError — Error 상속 + quota 플래그 보존");
{
  const eq = new StorageWriteError("msg", true);
  const en = new StorageWriteError("msg2", false);
  ok(eq instanceof Error, "Error 상속(instanceof Error=true → 기존 catch 와 호환)");
  ok(eq.name === "StorageWriteError", "name=StorageWriteError");
  ok(eq.quota === true && en.quota === false, "quota 플래그 보존");
  ok(eq.message === "msg", "message 보존");
}

console.log("\n[D] 용량 초과 저장 → StorageWriteError(quota=true) + 기존 데이터 무손상");
{
  const store = makeStore();
  globalThis.window = {};
  globalThis.localStorage = store;
  // 먼저 정상 저장(기존 계약 1건 마련)
  store.mode = "ok";
  await saveContract({ id: undefined, docType: "collateral", category: "new", title: "판교 담보신탁", formData: blankContractForm() });
  const before = await listContracts();
  const beforeSnapshot = JSON.stringify(before);
  ok(before.length === 1, "사전 정상 저장 1건");

  // 용량 초과 주입 후 새 저장 시도
  store.mode = "quota";
  let caught = null;
  try {
    await saveContract({ id: undefined, docType: "collateral", category: "new", title: "역삼 담보신탁", formData: blankContractForm() });
  } catch (e) { caught = e; }
  ok(caught instanceof StorageWriteError, "용량 초과 시 StorageWriteError throw");
  ok(caught && caught.quota === true, "quota=true 분기");
  ok(caught && caught.message.includes("가득"), "친화적 한글 안내(영문 DOMException 아님)");

  // 기존 저장본 무손상(부분 기록·손상 없음)
  store.mode = "ok";
  const after = await listContracts();
  ok(JSON.stringify(after) === beforeSnapshot, "저장 실패 후 기존 데이터 그대로(무손상·부분기록 없음)");
  ok(after.length === 1 && !after.some((r) => r.title === "역삼 담보신탁"), "실패한 새 계약은 미반영");
}

console.log("\n[E] 저장소 비활성(SecurityError) → StorageWriteError(quota=false)");
{
  const store = makeStore();
  globalThis.window = {};
  globalThis.localStorage = store;
  store.mode = "security";
  let caught = null;
  try {
    await saveContract({ id: undefined, docType: "collateral", category: "new", title: "분당 담보신탁", formData: blankContractForm() });
  } catch (e) { caught = e; }
  ok(caught instanceof StorageWriteError, "비활성 시 StorageWriteError throw");
  ok(caught && caught.quota === false, "quota=false(용량 아님) 분기");
  ok(caught && (caught.message.includes("시크릿") || caught.message.includes("사생활")), "사생활 모드 안내 메시지");
}

console.log("\n[F] 정상 경로 무회귀 — 여유 공간 시 저장·조회 정상");
{
  const store = makeStore();
  globalThis.window = {};
  globalThis.localStorage = store;
  store.mode = "ok";
  const id = await saveContract({ id: undefined, docType: "collateral", category: "new", title: "정상 계약", formData: blankContractForm() });
  ok(typeof id === "string" && id.length > 0, "저장 성공 시 id 반환");
  const rows = await listContracts();
  ok(rows.length === 1 && rows[0].title === "정상 계약", "정상 저장·조회(회귀 없음)");
}

// 전역 정리(다른 가드 오염 방지)
delete globalThis.window;
delete globalThis.localStorage;

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
