/* ============================================================
   회귀 가드 — 서류 초안 영속·재개(draftRepo + contractStore.restoreDraft + TrustApp)

   배경: 명시 저장한 계약(contractRepo)·최근 상담 세션(sessionRepo)은 localStorage 로
   영속돼 재개 동선이 완비됐는데, 위저드에서 *작성 중이던(미저장) 서류 입력*은
   contractStore(zustand) 메모리에만 있어 새로고침·탭 닫기·실수 이탈 시 통째로 사라졌다
   (beforeunload 는 경고만·복구 불가). 서류 입력 = 사용자가 가장 많은 노력을 들이는 핵심
   자산이라 이 휘발이 재방문 흐름 묶음의 마지막 실질 갭. 진행 중(dirty) 초안을 자동
   영속하고 첫 화면(신탁사 선택)에 "이어서 작성하기" 복원 진입점을 노출한다.

   변경:
     ① src/lib/store/draftRepo.ts (신규) — KEY="trust_draft". isValidDraft(손상 격리) +
        loadDraft/saveDraft(best-effort)/clearDraft(비움 단일 경로). SSR 안전.
     ② src/lib/store/contractStore.ts — restoreDraft 액션(미저장=savedHash null·
        currentContractId null 로 복원, 두 폼 blank 병합·form 재계산).
     ③ src/components/trust/TrustApp.tsx — 마운트 초안 적재(restorableDraft)·자동 저장
        effect(dirty 면 save·저장됨이면 clear·서류 미선택이면 무동작)·resumeDraft 복원·
        goHome 이탈 확정 시 clearDraft·CompanyPage "이어서 작성하기" 진입점.

   핵심 불변식:
     - ★표시·재개 전용 — 검증(validate)·조문·산출물(docx) 무접촉.
     - 복원 초안 = **미저장(savedHash null)** 으로 들어와 여전히 dirty(저장본 둔갑 금지).
     - 자동 저장 best-effort(쓰기 실패 swallow). 서류 미선택(docTypeId null)엔 무동작
       (마운트 직후 빈 상태가 복원 대상 초안을 덮어쓰지 않게).
     - ★자동 비움은 **명시 저장된 경우에만**(not dirty AND savedHash !== null). docTypeId
       만 설정되고 form 은 손대지 않은 빈 양식(savedHash===null·상담 ?doc= 딥링크·새 서류
       선택 직후)에는 비우지 않는다 — 사용자가 아무 것도 입력하기 전에 저장된 초안을
       조용히 삭제하던 유실 결함 차단.
     - 비움은 명시 경로만(저장 완료·이탈 확정·복원). 새 CSS 0.

   단언:
     (A) draftRepo 계약 — KEY·API 4종·SSR 안전·save best-effort·clear 단일 경로
     (B) isValidDraft 런타임 — 정상 통과·docTypeId 빈/폼 부재/null 격리
     (C) store restoreDraft — 미저장(savedHash null·currentContractId null)·재계산·두 폼 병합
     (D) TrustApp 배선 — import·마운트 적재·자동 저장(dirty save·저장됨 clear·미선택 무동작)·
         resumeDraft·goHome clearDraft·진입점 prop 전달
     (E) CompanyPage 진입점 — 초안 있을 때만·role=region·문구·글리프 aria-hidden·btn-primary
     (F) 무접촉 — draftRepo 에 validate/docx import 없음·globals 새 클래스 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-trust-draft-persistence.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isValidDraft } from "../src/lib/store/draftRepo.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const repo = read("src", "lib", "store", "draftRepo.ts");
const store = read("src", "lib", "store", "contractStore.ts");
const app = read("src", "components", "trust", "TrustApp.tsx");
const globals = read("src", "app", "globals.css");

console.log("\n[A] draftRepo 계약 — KEY·API·SSR 안전·best-effort·비움 단일 경로");
{
  ok(/const KEY = "trust_draft";/.test(repo),
     "저장 KEY = trust_draft(서류 초안 전용 키)");
  ok(/export function isValidDraft\(/.test(repo) &&
     /export function loadDraft\(/.test(repo) &&
     /export function saveDraft\(/.test(repo) &&
     /export function clearDraft\(/.test(repo),
     "공개 API 4종(isValidDraft·loadDraft·saveDraft·clearDraft)");
  ok(/export interface ContractDraft \{/.test(repo) &&
     /docTypeId: string;/.test(repo) && /form: ContractForm;/.test(repo) && /jointForm: JointForm;/.test(repo),
     "ContractDraft 스냅샷 타입(docTypeId·form·jointForm 등 위저드 복원 필드)");
  const loadAt = repo.indexOf("export function loadDraft");
  const loadBlock = repo.slice(loadAt, loadAt + 360);
  ok(/if \(typeof window === "undefined"\) return null;/.test(loadBlock),
     "loadDraft SSR 안전(window 부재 시 null)");
  ok(/return isValidDraft\(obj\) \? obj : null;/.test(loadBlock),
     "loadDraft 가 isValidDraft 통과분만 반환(손상 격리)");
  const saveAt = repo.indexOf("export function saveDraft");
  const saveBlock = repo.slice(saveAt, saveAt + 360);
  ok(/localStorage\.setItem\(KEY, JSON\.stringify\(draft\)\)/.test(saveBlock) &&
     /catch \{[\s\S]*?\}/.test(saveBlock),
     "saveDraft best-effort(setItem + 실패 swallow — 용량/시크릿 모드 무영향)");
  const clearAt = repo.indexOf("export function clearDraft");
  ok(/localStorage\.removeItem\(KEY\)/.test(repo.slice(clearAt, clearAt + 220)),
     "clearDraft 가 KEY removeItem(저장본 삭제의 단일 경로)");
}

console.log("\n[B] isValidDraft 런타임 — 정상 통과·손상 격리");
{
  const valid = { docTypeId: "collateral", category: "new", title: "", form: {}, jointForm: {}, tab: 1, step: 1 };
  ok(isValidDraft(valid) === true, "isValidDraft: 정상 초안 통과");
  ok(isValidDraft({ ...valid, docTypeId: "" }) === false, "isValidDraft: docTypeId 빈 문자열 격리");
  ok(isValidDraft({ docTypeId: "collateral", jointForm: {} }) === false, "isValidDraft: form 부재 격리");
  ok(isValidDraft(null) === false && isValidDraft("x") === false && isValidDraft(undefined) === false,
     "isValidDraft: null·비객체·undefined 격리");
}

console.log("\n[C] store restoreDraft — 미저장 복원·재계산·두 폼 병합");
{
  ok(/restoreDraft: \(draft: \{/.test(store) || /restoreDraft: \(draft\) =>/.test(store),
     "restoreDraft 액션 존재");
  const rAt = store.indexOf("restoreDraft: (draft) =>");
  const rBlock = store.slice(rAt, rAt + 1100);
  ok(/currentContractId: null,/.test(rBlock) && /savedHash: null,/.test(rBlock),
     "★복원 초안 = 미저장(savedHash null) + 신규(currentContractId null) → 여전히 dirty");
  ok(/form: withRecalc\(mergedForm\),/.test(rBlock),
     "복원 form 은 파생값 재계산(withRecalc)");
  ok(/const base = blankContractForm\(\);/.test(rBlock) && /mergedForm\.docContents = \{ \.\.\.base\.docContents,/.test(rBlock),
     "form 은 blank + docContents 한 단계 병합(구버전·부분 초안 키 누락 격리)");
  ok(/const jbase = blankJointForm\(\);/.test(rBlock) && /gap: \{ \.\.\.jbase\.gap,/.test(rBlock) && /project: \{ \.\.\.jbase\.project,/.test(rBlock),
     "jointForm 은 blank + gap/project 한 단계 병합");
  ok(/tab: draft\.tab,/.test(rBlock) && /step: draft\.step,/.test(rBlock),
     "복원 시 작성하던 단계(tab·step) 그대로 복귀");
}

console.log("\n[D] TrustApp 배선 — 적재·자동 저장·복원·이탈 비움");
{
  ok(/import \{ loadDraft, saveDraft, clearDraft, type ContractDraft \} from "@\/lib\/store\/draftRepo";/.test(app),
     "TrustApp 가 draftRepo API + ContractDraft 타입 import");
  ok(/restoreDraft,\s*\n\s*\} = store;/.test(app),
     "store 에서 restoreDraft 디스트럭처");
  // 마운트 적재
  ok(/const \[restorableDraft, setRestorableDraft\] = useState<ContractDraft \| null>\(null\);/.test(app),
     "restorableDraft 상태(SSR 스냅샷 null — 하이드레이션 일치)");
  ok(/const d = loadDraft\(\);\s*\n\s*if \(d\) setRestorableDraft\(d\);/.test(app),
     "마운트 useEffect 가 loadDraft → 초안 있으면 restorableDraft 세팅");
  // dirty 파생
  ok(/const draftDirty = !!docTypeId && isFormDirty\(activeForm, store\.savedHash, isJointOpen\);/.test(app),
     "draftDirty = 서류 선택됨 + 미저장 변경(isFormDirty 단일 출처)");
  // 자동 저장 effect: 미선택 무동작 → dirty save → else clear
  ok(/if \(!docTypeId\) return; \/\/ 서류 미선택/.test(app),
     "★자동 저장 effect: 서류 미선택(docTypeId null)이면 무동작(복원 대상 초안 보호)");
  ok(/if \(draftDirty\) \{\s*\n\s*saveDraft\(\{/.test(app),
     "dirty 면 store 스냅샷 saveDraft");
  const effAt = app.indexOf("if (!docTypeId) return;");
  const effBlock = app.slice(effAt, effAt + 900);
  ok(/\} else if \(store\.savedHash !== null\) \{\s*\n[\s\S]*?clearDraft\(\);/.test(effBlock),
     "★자동 비움은 명시 저장된 경우만(not dirty AND savedHash !== null) → clearDraft");
  ok(!/\} else \{\s*\n\s*clearDraft\(\);/.test(effBlock),
     "★무조건 else→clearDraft 부재(빈 양식+docTypeId만 설정된 찰나에 초안 유실 차단)");
  ok(/draftDirty,\s*\n\s*store\.savedHash,/.test(effBlock),
     "자동 저장 effect deps 에 store.savedHash 포함(저장 기준선 변화 반영)");
  // 복원 핸들러
  const resAt = app.indexOf("function resumeDraft");
  const resBlock = app.slice(resAt, resAt + 420);
  ok(/if \(!d\) return;/.test(resBlock) && /restoreDraft\(d\);/.test(resBlock) && /setRestorableDraft\(null\);/.test(resBlock),
     "resumeDraft: restoreDraft 로 복원 + 진입점 숨김(setRestorableDraft null)");
  ok(/setView\(d\.category \? "wizard" : "category"\);/.test(resBlock),
     "복원 후 위저드 진입(단계 없으면 단계 선택으로 폴백)");
  // goHome 이탈 확정 시 초안 비움
  const ghAt = app.indexOf("function goHome");
  const ghBlock = app.slice(ghAt, ghAt + 700);
  ok(/reset\(\);\s*\n[\s\S]*?clearDraft\(\);\s*\n\s*setRestorableDraft\(null\);/.test(ghBlock),
     "goHome 이탈 확정(reset) 시 clearDraft + 진입점 숨김(버린 작업 재출현 방지)");
  // 진입점 prop 전달
  ok(/draft=\{restorableDraft\}/.test(app) && /onResumeDraft=\{resumeDraft\}/.test(app),
     "CompanyPage 에 draft·onResumeDraft prop 전달");
}

console.log("\n[E] CompanyPage 진입점 — 초안 있을 때만·접근성·기존 토큰");
{
  ok(/draft\?: ContractDraft \| null;/.test(app) && /onResumeDraft\?: \(\) => void;/.test(app),
     "CompanyPage 가 draft·onResumeDraft 옵셔널 prop 수용(후방호환)");
  ok(/\{onResumeDraft && draft && \(/.test(app),
     "진입점은 onResumeDraft + draft 있을 때만 렌더(첫 방문·초안 부재 시 미표출)");
  ok(/aria-label="작성 중이던 서류 이어서 작성하기"/.test(app) && /role="region"/.test(app),
     "복원 영역 role=region + aria-label(랜드마크)");
  ok(/작성 중이던 <strong>\{draftDocName\}<\/strong> 서류가 있습니다\./.test(app),
     "작성 중이던 서류 이름 문구(docTypeId → 서류명)");
  ok(/이어서 작성하기<span aria-hidden="true"> →<\/span>/.test(app),
     "행동 유도 문구 + 장식 글리프(→) aria-hidden");
  // 초안 진입점이 저장된 계약 재개 진입점보다 위(진행 중 미저장이 더 즉각적 신호)
  const draftRegionAt = app.indexOf('aria-label="작성 중이던 서류 이어서 작성하기"');
  const savedRegionAt = app.indexOf('aria-label="저장된 작업 이어서 하기"');
  ok(draftRegionAt >= 0 && savedRegionAt > draftRegionAt,
     "초안 진입점이 저장된 계약 재개 진입점보다 위(별개 신호·우선 노출)");
  ok(/className="btn btn-primary btn-sm" onClick=\{onResumeDraft\}/.test(app),
     "복원 버튼 onClick=onResumeDraft + 기존 btn-primary/btn-sm");
}

console.log("\n[F] 무접촉 — draftRepo 엔진/검증/산출물 무관·새 CSS 0");
{
  ok(!/from "@\/lib\/engine\/validate"/.test(repo) && !/from "@\/lib\/engine\/docx"/.test(repo),
     "draftRepo 에 검증(validate)·산출물(docx) import 없음(표시/재개 전용)");
  ok(/import type \{ ContractForm, JointForm, Category \} from "@\/lib\/engine\/model";/.test(repo),
     "draftRepo 는 모델 타입만 import(런타임 엔진 비의존)");
  ok(!/\.draft-resume\b/.test(globals) && !/trust_draft/.test(globals),
     "globals 에 초안 진입점 전용 클래스 미추가(새 CSS 0 — 기존 토큰 + 인라인 style)");
}

console.log(`\n${fail === 0 ? "OK" : "FAIL"} — ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
