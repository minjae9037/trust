/* ============================================================
   회귀 가드 — 브레드크럼 "내 계약 N" 현재 위치 + 저장 건수 배지

   배경: 상단 브레드크럼은 신탁사 선택·신탁사·서류·단계 crumb 에는 현재 뷰일 때
   active 클래스 + aria-current="page" 를 붙여 "지금 어디인지"를 표시하지만, "내 계약"
   crumb 만 종전엔 active/aria-current 가 전무했다. 그 결과 contracts 뷰에 들어가면
   브레드크럼 어느 항목도 현재 위치로 표시되지 않아(company crumb 은 view!=="contracts"
   조건으로 숨겨짐) 사용자가 자기 위치를 브레드크럼에서 알 수 없었다(WCAG 2.4.8 Location
   일관성 갭). 또한 돌아온 사용자는 저장된 계약이 있어도 그 신호가 chrome 어디에도 없어,
   매번 "신탁사 선택"으로 진입하며 자기 작업이 기다리는지 알 수 없었다.

   변경: ① "내 계약" crumb 에 view==="contracts" 일 때 active + aria-current="page" 부여
   (다른 crumb 과 동일 패턴). ② 저장된 계약이 있으면 건수 배지(시각 "(N)" = aria-hidden,
   의미 = sr-only ", 저장 N건")를 덧붙여 돌아온 사용자가 작업이 있음을 한눈에 알게 한다.
   ③ 건수는 useSyncExternalStore + contractRepo.subscribeContracts 로 저장소 변경(저장·
   삭제·복원·가져오기 — 모두 writeAll 단일 경로)에 구독해 항상 최신을 유지하고, 다른 탭
   변경은 window "storage" 이벤트로 반영한다. SSR 스냅샷은 0(서버엔 localStorage 부재).

   핵심 불변식:
     - ★표시·내비게이션 전용 — 조문·엔진·검증(validate)·산출물(docx) 무접촉.
       건수는 readAll().length 순수 카운트일 뿐 어떤 폼/게이트/빌더에도 영향 0.
     - emitContractsChanged 는 writeAll 의 setItem 성공 후에만 통지(쓰기 실패=무손상이라
       미통지) → 배지가 저장소와 절대 어긋나지 않는다.
     - storage 이벤트는 우리 KEY(또는 전체 clear=key null) 일 때만 통지(무관 키 무시).
     - 시각 "(N)" 은 aria-hidden(장식), 의미는 sr-only(접근명 정확) — 기존 글리프 컨벤션.
     - 새 CSS 0 — 기존 .crumb / .sr-only 만 사용(배지 전용 클래스 미추가).

   단언:
     (A) contractRepo 구독 인프라 — contractCount/subscribeContracts export·writeAll
         성공 후 emit·storage 이벤트 KEY 한정·정리 함수 해제
     (B) TrustApp 배선 — useSyncExternalStore(subscribeContracts, contractCount, ()=>0)·
         내 계약 crumb active+aria-current(contracts 한정)·배지 aria-hidden "(N)"+sr-only
     (C) 무회귀 — 다른 crumb active/aria-current·상담 링크·onStart CTA 배선 보존
     (D) 무접촉 — writeAll StorageWriteError 보존·TrustApp 엔진/검증/산출물 무관·새 CSS 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-breadcrumb-contracts-count.mjs
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
const repo = read("src", "lib", "contractRepo.ts");
const app = read("src", "components", "trust", "TrustApp.tsx");
const globals = read("src", "app", "globals.css");

console.log("\n[A] contractRepo 구독 인프라 — contractCount/subscribeContracts·writeAll 성공 후 emit·storage KEY 한정");
{
  ok(/export function contractCount\(\): number \{\s*return readAll\(\)\.length;/.test(repo),
     "contractCount() = readAll().length 순수 카운트 export");
  ok(/export function subscribeContracts\(cb: \(\) => void\): \(\) => void \{/.test(repo),
     "subscribeContracts(cb) export — useSyncExternalStore subscribe 계약");
  ok(/const contractListeners = new Set<\(\) => void>\(\);/.test(repo),
     "모듈 레벨 리스너 Set 보유");
  // emitContractsChanged 는 writeAll 의 setItem 성공 후(catch 블록 밖)에 호출돼야 한다.
  const waAt = repo.indexOf("function writeAll(");
  ok(waAt >= 0, "writeAll 정의 존재");
  const waBlock = repo.slice(waAt, waAt + 700);
  ok(/emitContractsChanged\(\);/.test(waBlock),
     "writeAll 이 변경을 통지(emitContractsChanged 호출)");
  // setItem 보다 뒤·catch(throw) 보다 뒤 = 성공 경로에서만 통지(쓰기 실패=무손상이라 미통지)
  const setIdx = waBlock.indexOf("localStorage.setItem(KEY");
  const throwIdx = waBlock.indexOf("throw new StorageWriteError");
  const emitIdx = waBlock.indexOf("emitContractsChanged()");
  ok(setIdx >= 0 && throwIdx >= 0 && emitIdx > throwIdx,
     "emit 은 setItem·throw(catch) 뒤 = 쓰기 성공 후에만 통지(실패 시 미통지)");
  ok(/for \(const l of contractListeners\) l\(\);/.test(repo),
     "emitContractsChanged 가 전 리스너 호출");
  // 다른 탭 변경 = storage 이벤트, 우리 KEY(또는 전체 clear=null) 한정
  ok(/if \(e\.key === null \|\| e\.key === KEY\) cb\(\);/.test(repo),
     "storage 이벤트는 우리 KEY 또는 전체 clear(key null) 일 때만 통지(무관 키 무시)");
  ok(/window\.addEventListener\("storage", onStorage\)/.test(repo),
     "구독 시 storage 이벤트 등록(다른 탭 반영)");
  ok(/contractListeners\.delete\(cb\);[\s\S]*removeEventListener\("storage", onStorage\)/.test(repo),
     "정리 함수가 리스너·storage 이벤트 둘 다 해제(누수 방지)");
}

console.log("\n[B] TrustApp 배선 — useSyncExternalStore·내 계약 crumb active+aria-current·건수 배지");
{
  ok(/useSyncExternalStore/.test(app) && /from "react"/.test(app),
     "react useSyncExternalStore import");
  ok(/import \{[\s\S]*?subscribeContracts,[\s\S]*?contractCount,[\s\S]*?\} from "@\/lib\/contractRepo";/.test(app),
     "contractRepo 에서 subscribeContracts·contractCount import");
  ok(/const savedCount = useSyncExternalStore\(subscribeContracts, contractCount, \(\) => 0\);/.test(app),
     "savedCount = useSyncExternalStore(subscribeContracts, contractCount, ()=>0) — SSR 스냅샷 0");
  // 내 계약 crumb 블록 추출 — onClick={() => setView("contracts")} 기준
  const at = app.indexOf('onClick={() => setView("contracts")}');
  ok(at >= 0, "내 계약 crumb(onClick setView contracts) 존재");
  // 버튼 시작은 onClick 보다 앞 — 약간 넓게 떠서 className/aria-current 까지 포함
  const block = app.slice(at - 260, at + 320);
  ok(/className=\{"crumb" \+ \(view === "contracts" \? " active" : ""\)\}/.test(block),
     "내 계약 crumb 이 view==='contracts' 일 때 active 클래스(현재 위치 표시)");
  ok(/aria-current=\{view === "contracts" \? "page" : undefined\}/.test(block),
     "내 계약 crumb 이 view==='contracts' 일 때 aria-current='page'(SR 현재 위치 고지)");
  ok(/\{savedCount > 0 && \(/.test(block),
     "건수 배지는 저장된 계약이 있을 때만(savedCount>0) 렌더");
  ok(/<span aria-hidden="true"> \(\{savedCount\}\)<\/span>/.test(block),
     "시각 '(N)' 배지 = aria-hidden(장식 — 접근명 오염 0)");
  ok(/<span className="sr-only">, 저장 \{savedCount\}건<\/span>/.test(block),
     "의미는 sr-only ', 저장 N건'(SR 접근명 정확) — 기존 글리프/의미 분리 컨벤션");
}

console.log("\n[C] 무회귀 — 다른 crumb active/aria-current·상담 링크·onStart CTA 배선 보존");
{
  ok(/className=\{"crumb" \+ \(view === "company" \? " active" : ""\)\}/.test(app),
     "신탁사 선택 crumb active 패턴 보존(이번 변경의 기준 패턴)");
  ok(/aria-current=\{view === "company" \? "page" : undefined\}/.test(app),
     "신탁사 선택 crumb aria-current 보존");
  ok(/aria-current=\{view === "home" \? "page" : undefined\}/.test(app),
     "신탁사명 crumb aria-current 보존(home)");
  ok(/aria-current=\{view === "category" \? "page" : undefined\}/.test(app),
     "서류명 crumb aria-current 보존(category)");
  ok(/<Link href="\/advisor\?resume=1" className="crumb"/.test(app),
     "상담(/advisor?resume=1) 링크 crumb 보존(왕복 복귀 딥링크)");
  ok(/onStart=\{\(\) => setView\(company \? "home" : "company"\)\}/.test(app),
     "내 계약 0건 빈 화면 CTA(onStart) 배선 보존(직전 iteration 산출)");
  ok(/<ContractsView\s+onOpen=\{openContract\}/.test(app),
     "ContractsView onOpen=openContract 보존");
}

console.log("\n[D] 무접촉 — writeAll StorageWriteError 보존·TrustApp 엔진/검증/산출물 무관·새 CSS 0");
{
  ok(/throw new StorageWriteError\(storageWriteErrorMessage\(quota\), quota\);/.test(repo),
     "writeAll 의 용량 초과 가드(StorageWriteError) 보존 — 통지 추가가 쓰기 신뢰성 무손상");
  ok(/return JSON\.parse\(localStorage\.getItem\(KEY\) \|\| "\[\]"\)/.test(repo),
     "readAll 저장소 읽기 경로 보존(카운트는 동일 출처 readAll 재사용)");
  // TrustApp 은 표시/내비게이션 셸 — 엔진/검증/산출물 직접 import 가 없어야 한다(추가도 금지)
  ok(!/from "@\/lib\/engine\/validate"/.test(app),
     "TrustApp 에 검증(validate) import 없음(배지는 게이트 무접촉)");
  ok(!/from "@\/lib\/engine\/docx"/.test(app),
     "TrustApp 에 산출물(docx) 생성기 import 없음(배지는 빌더 무접촉)");
  // 새 CSS 0 — 배지 전용 클래스 미추가(기존 .crumb / .sr-only 만)
  ok(!/\.crumb-count\b/.test(globals) && !/\.breadcrumb-count\b/.test(globals),
     "globals 에 배지 전용 클래스(.crumb-count 등) 미추가 — 기존 .crumb/.sr-only 만");
  ok(/\.crumb(\.active)?\s*\{/.test(globals) || /\.crumb\b/.test(globals),
     "배지/active 가 쓰는 기존 .crumb 클래스 존재(재사용)");
  ok(/\.sr-only\s*\{/.test(globals),
     "sr-only 의미 텍스트가 쓰는 기존 .sr-only 클래스 존재(재사용)");
}

console.log(`\n${fail === 0 ? "OK" : "FAIL"} — ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
