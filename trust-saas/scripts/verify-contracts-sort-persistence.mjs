/* ============================================================
   회귀 가드 — 내 계약 목록 정렬 선호 영속(listPref)

   배경: 내 계약(ContractsView) 목록 정렬(최근 수정순·제목순·위탁자순·생성
   준비도순)이 컴포넌트 in-memory(useState)라, 목록을 떠났다 오거나 새로고침하면
   매번 기본 "최근 수정순"으로 돌아갔다(previewPref 의 미리보기 접힘 선호와 동형의
   표시 선호 휘발). 마지막 정렬 선택을 localStorage(listPref)에 보관해 재진입·
   새로고침 후에도 유지한다.

   핵심 불변식:
     - ★표시 전용 — 조문·엔진·검증(validate)·산출물(docx) 무접촉. 저장 대상은
       정렬 키 하나뿐(KEY=trust_contracts_sort). 검색어·상태 필터는 영속 안 함.
     - SortKey 단일 출처 — 영속 경계(listPref)가 저장 가능한 정렬 키 집합(SORT_KEYS)을
       정의하고 ContractsView 가 그 타입을 import(라벨/검증/영속이 같은 키 집합).
     - SSR/하이드레이션 안전 — 초기 렌더는 기본 "recent"(useState), 마운트 후 effect
       에서 저장 선호 반영(localStorage 는 서버에 없음). 미저장·손상(알 수 없는 키)·
       SSR 시 기본 "recent"(후방호환).
     - 영속은 **사용자 변경에서만**(select onChange) — 마운트 적재 경로엔 저장 없어
       저장된 값을 자기 자신으로 덮어쓰지 않는다(클로버 차단).
     - best-effort — 용량 초과·시크릿 모드 쓰기 실패는 swallow(목록 동작 무영향).

   단언:
     (A) listPref 계약 — KEY·SORT_KEYS·SortKey·API 2종·SSR 안전·기본 recent·best-effort·키 검증
     (B) listPref 런타임 — 미저장→recent·각 키 왕복·손상→recent·SSR→recent·쓰기실패 swallow
     (C) ContractsView 배선 — import·마운트 load effect·onChange saveSortKey·로컬 타입 제거·라벨 키 일치
     (D) 무접촉 — listPref import 0(순수 localStorage)·엔진/검증/산출물 무import

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-contracts-sort-persistence.mjs
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
const pref = read("src", "lib", "store", "listPref.ts");
const view = read("src", "components", "trust", "ContractsView.tsx");

console.log("\n[A] listPref 계약 — KEY·SORT_KEYS·SortKey·API 2종·SSR 안전·기본 recent·best-effort·키 검증");
{
  ok(/const KEY = "trust_contracts_sort";/.test(pref),
     "저장 KEY = trust_contracts_sort(정렬 선호 전용 키)");
  ok(/export const SORT_KEYS = \["recent", "title", "trustor", "readiness"\] as const;/.test(pref),
     "SORT_KEYS = 저장 가능한 정렬 키 단일 출처(4종)");
  ok(/export type SortKey = \(typeof SORT_KEYS\)\[number\];/.test(pref),
     "SortKey 타입 = SORT_KEYS 파생(라벨/검증/영속 동일 집합 보장)");
  ok(/export function loadSortKey\(\): SortKey \{/.test(pref) &&
     /export function saveSortKey\(key: SortKey\): void \{/.test(pref),
     "공개 API 2종(loadSortKey·saveSortKey)");
  ok(/const isSortKey = \(v: string \| null\): v is SortKey =>/.test(pref) &&
     /SORT_KEYS as readonly string\[\]\)\.includes\(v\)/.test(pref),
     "isSortKey 타입가드 — SORT_KEYS 포함 여부로 알 수 없는 값 차단(손상/구버전 내성)");
  const loadAt = pref.indexOf("export function loadSortKey");
  const loadBlock = pref.slice(loadAt, loadAt + 360);
  ok(/if \(typeof window === "undefined"\) return DEFAULT_SORT;/.test(loadBlock),
     "loadSortKey SSR 안전 — window 부재 시 기본 recent");
  ok(/return isSortKey\(raw\) \? raw : DEFAULT_SORT;/.test(loadBlock),
     "알 수 없는 값(구버전·손상)→기본 recent 폴백");
  const saveAt = pref.indexOf("export function saveSortKey");
  const saveBlock = pref.slice(saveAt, saveAt + 300);
  ok(/if \(typeof window === "undefined"\) return;/.test(saveBlock),
     "saveSortKey SSR 안전 — window 부재 시 무동작");
  ok(/localStorage\.setItem\(KEY, key\);/.test(saveBlock) && /catch \{[\s\S]*?\}/.test(saveBlock),
     "saveSortKey best-effort — setItem(key) + 실패 swallow(용량/시크릿 모드 무영향)");
  ok(/const DEFAULT_SORT: SortKey = "recent";/.test(pref),
     "기본 정렬 = recent(최근 수정순·종전 useState 기본과 동일)");
}

console.log("\n[B] listPref 런타임 — 미저장→recent·각 키 왕복·손상→recent·SSR→recent·쓰기실패 swallow");
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
  const m = await import("../src/lib/store/listPref.ts");

  ok(m.loadSortKey() === "recent", "미저장 상태 load → recent(기본)");
  // 모든 SORT_KEYS 저장/load 왕복(영속 입증)
  let roundtrip = true;
  for (const k of m.SORT_KEYS) {
    m.saveSortKey(k);
    if (storeMap.get("trust_contracts_sort") !== k || m.loadSortKey() !== k) roundtrip = false;
  }
  ok(roundtrip, `전 정렬 키(${m.SORT_KEYS.join("·")}) save→load 왕복 일치(영속)`);
  storeMap.set("trust_contracts_sort", "bogus-key");
  ok(m.loadSortKey() === "recent", "손상/알 수 없는 값(\"bogus-key\") load → recent(폴백)");
  // 쓰기 실패 swallow
  throwOnSet = true;
  let threw = false;
  try { m.saveSortKey("title"); } catch { threw = true; }
  ok(threw === false, "setItem 예외(용량 초과 모의) → saveSortKey 가 swallow(전파 안 함)");
  throwOnSet = false;
  // SSR — window 부재
  delete globalThis.window;
  ok(m.loadSortKey() === "recent", "SSR(window 부재) load → recent(안전 기본)");
  let ssrThrew = false;
  try { m.saveSortKey("trustor"); } catch { ssrThrew = true; }
  ok(ssrThrew === false, "SSR(window 부재) save → 무동작(예외 없음)");

  // 스텁 원복(다른 가드 격리)
  if (origWindow === undefined) delete globalThis.window; else globalThis.window = origWindow;
  if (origLS === undefined) delete globalThis.localStorage; else globalThis.localStorage = origLS;
}

console.log("\n[C] ContractsView 배선 — import·마운트 load effect·onChange saveSortKey·로컬 타입 제거·라벨 키 일치");
{
  ok(/import \{ loadSortKey, saveSortKey, type SortKey \} from "@\/lib\/store\/listPref";/.test(view),
     "listPref import(loadSortKey·saveSortKey·SortKey 타입 — 영속 단일 출처)");
  // 로컬 SortKey 타입 정의 제거(영속 경계로 이관)
  ok(!/^type SortKey =/m.test(view),
     "로컬 type SortKey 정의 제거(listPref 가 단일 출처)");
  ok(/const \[sort, setSort\] = useState<SortKey>\("recent"\);/.test(view),
     "초기값 useState(\"recent\") — SSR 기본(하이드레이션 일치)");
  ok(/useEffect\(\(\) => \{\s*setSort\(loadSortKey\(\)\);\s*\}, \[\]\);/.test(view),
     "마운트 1회 effect 가 loadSortKey() 로 저장 선호 반영(SSR 후 적재)");
  // onChange 가 setSort + saveSortKey(명시 변경에서만 영속)
  ok(/onChange=\{\(e\) => \{[\s\S]*?const k = e\.target\.value as SortKey;[\s\S]*?setSort\(k\);[\s\S]*?saveSortKey\(k\);[\s\S]*?\}\}/.test(view),
     "정렬 select onChange = setSort(k) + saveSortKey(k)(사용자 명시 변경 영속)");
  // saveSortKey 호출은 onChange 1곳뿐(마운트 load 경로엔 없음 → 클로버 차단)
  const saveCalls = view.split("saveSortKey(").length - 1;
  ok(saveCalls === 1, `saveSortKey 호출 = onChange 1곳뿐(마운트 load 무저장·클로버 차단) — 실제 ${saveCalls}`);
  // SORT_LABEL 키가 SORT_KEYS 와 동일 집합(라벨↔영속 키 일치)
  const m2 = await import("../src/lib/store/listPref.ts");
  const labelAt = view.indexOf("const SORT_LABEL");
  const labelBlock = view.slice(labelAt, view.indexOf("};", labelAt));
  const labelKeysPresent = m2.SORT_KEYS.every((k) => new RegExp("\\b" + k + ":").test(labelBlock));
  ok(labelKeysPresent, "SORT_LABEL 이 SORT_KEYS 전 키의 라벨 보유(영속 키↔표기 일치)");
  // 회귀: 종전 인라인 캐스트 onChange 잔재 없음
  ok(!/onChange=\{\(e\) => setSort\(e\.target\.value as SortKey\)\}/.test(view),
     "옛 인라인 onChange(setSort 단독) 잔재 없음(영속 배선으로 교체)");
}

console.log("\n[D] 무접촉 — listPref import 0(순수 localStorage)·엔진/검증/산출물 무import");
{
  ok(!/^import /m.test(pref),
     "listPref 는 import 0(순수 localStorage 유틸·의존성 표면 0)");
  ok(!/@\/lib\/engine\/(validate|docx|builders)|engine\/clauses/.test(pref),
     "listPref 는 엔진/검증/산출물 무접촉(순수 표시 상태)");
}

console.log(`\n${fail === 0 ? "OK" : "FAIL"} — ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
