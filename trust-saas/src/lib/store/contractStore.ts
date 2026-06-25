/* ================================================================
   contractStore — 토글 UI와 Claude 대화 레이어가 공유하는 단일 상태
   (참조 HTML 의 전역 `state` 를 zustand 로 대체)
   ================================================================ */
import { create } from "zustand";
import {
  type ContractForm,
  type JointForm,
  type Party,
  type Property,
  type Category,
  type DocId,
  blankContractForm,
  blankJointForm,
  blankParty,
  blankProperty,
  moveInArray,
} from "@/lib/engine/model";
import { recalcDerived } from "@/lib/engine/calc";
import { firstIncompleteDocStep } from "@/lib/engine/validate";

export type PartyRole = "trustors" | "debtors" | "beneficiaries" | "priorities";

interface ContractState {
  docTypeId: string | null;
  category: Category | null;
  tab: number;
  step: number;
  form: ContractForm;
  jointForm: JointForm;
  currentContractId: string | null;
  title: string;
  /** 마지막 저장(또는 불러오기) 시점의 form 직렬화 스냅샷. 미저장 변경 감지용. null=아직 저장 안 됨 */
  savedHash: string | null;

  // 네비게이션
  setDocType: (id: string) => void;
  setCategory: (c: Category) => void;
  setTab: (t: number) => void;
  setStep: (s: number) => void;

  // 관계사
  addParty: (role: PartyRole) => void;
  removeParty: (role: PartyRole, idx: number) => void;
  /** 관계사 순서 변경 — dir(-1=위/선순위, +1=아래/후순위). 우선수익자는 순서=선·후순위. */
  moveParty: (role: PartyRole, idx: number, dir: number) => void;
  updateParty: (role: PartyRole, idx: number, patch: Partial<Party>) => void;
  setSameAsTrustor: (which: "debtor" | "beneficiary", same: boolean) => void;

  // 부동산
  addProperty: () => void;
  removeProperty: (idx: number) => void;
  updateProperty: (idx: number, patch: Partial<Property>) => void;
  setProperties: (props: Property[]) => void;

  // 공통 조건 / 서류별 입력
  updateCommon: (patch: Partial<ContractForm["common"]>) => void;
  updateDocContent: <K extends DocId>(
    docId: K,
    patch: Partial<ContractForm["docContents"][K]>
  ) => void;

  // joint
  updateJoint: (patch: Partial<JointForm>) => void;

  // Claude / 일괄 패치 (양방향 동기화)
  mergeFormPatch: (patch: DeepPartial<ContractForm>) => void;
  replaceForm: (form: ContractForm) => void;

  // 저장/재개
  setTitle: (t: string) => void;
  setCurrentContractId: (id: string | null) => void;
  /** 현재 form을 "저장됨" 기준선으로 기록 (저장 성공 직후 호출) */
  markSaved: () => void;
  loadContract: (row: {
    id: string;
    doc_type: string;
    category: string | null;
    title: string;
    form_data: ContractForm | JointForm;
  }) => void;

  /**
   * 저장 안 된 진행 중 초안(draftRepo)을 위저드 상태로 복원한다. loadContract 와 달리
   * **미저장(savedHash=null·currentContractId=null)** 으로 들어와 여전히 dirty 이고
   * beforeunload 가 계속 경고한다(초안=아직 저장 안 한 작업이므로 저장본으로 둔갑 금지).
   */
  restoreDraft: (draft: {
    docTypeId: string;
    category: Category | null;
    title: string;
    form: ContractForm;
    jointForm: JointForm;
    tab: number;
    step: number;
  }) => void;

  reset: () => void;
}

/* 얕은 재계산 래퍼 */
const withRecalc = (form: ContractForm) => recalcDerived(form);

export const useContractStore = create<ContractState>((set) => ({
  docTypeId: null,
  category: null,
  tab: 1,
  step: 1,
  form: blankContractForm(),
  jointForm: blankJointForm(),
  currentContractId: null,
  title: "",
  savedHash: null,

  setDocType: (id) => set({ docTypeId: id }),
  setCategory: (c) => set({ category: c }),
  setTab: (t) => set({ tab: t }),
  setStep: (s) => set({ step: s }),

  addParty: (role) =>
    set((st) => ({ form: { ...st.form, [role]: [...st.form[role], blankParty()] } })),

  removeParty: (role, idx) =>
    set((st) => {
      const arr = st.form[role].filter((_, i) => i !== idx);
      return { form: withRecalc({ ...st.form, [role]: arr.length ? arr : [blankParty()] }) };
    }),

  moveParty: (role, idx, dir) =>
    set((st) => {
      const arr = moveInArray(st.form[role], idx, dir);
      // 범위 밖 = 동일 참조 반환(no-op) → 상태 변경 없음(불필요 리렌더 방지)
      if (arr === st.form[role]) return {};
      const next: ContractForm = { ...st.form, [role]: arr };
      // 우선수익자 순서는 한도 표·정산 순위 표기를 좌우 → updateParty 와 동일하게 재계산
      return { form: role === "priorities" ? withRecalc(next) : next };
    }),

  updateParty: (role, idx, patch) =>
    set((st) => {
      const arr = st.form[role].map((p, i) => (i === idx ? { ...p, ...patch } : p));
      const next: ContractForm = { ...st.form, [role]: arr };
      // 우선수익자 대출금액이 바뀌면 한도 재계산
      return { form: role === "priorities" ? withRecalc(next) : next };
    }),

  setSameAsTrustor: (which, same) =>
    set((st) => {
      if (which === "debtor") return { form: { ...st.form, debtorSameAsTrustor: same } };
      return { form: { ...st.form, beneficiarySameAsTrustor: same } };
    }),

  addProperty: () =>
    set((st) => ({ form: { ...st.form, properties: [...st.form.properties, blankProperty()] } })),

  removeProperty: (idx) =>
    set((st) => {
      const arr = st.form.properties.filter((_, i) => i !== idx);
      return { form: { ...st.form, properties: arr.length ? arr : [blankProperty()] } };
    }),

  updateProperty: (idx, patch) =>
    set((st) => ({
      form: {
        ...st.form,
        properties: st.form.properties.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
      },
    })),

  setProperties: (props) =>
    set((st) => ({ form: { ...st.form, properties: props.length ? props : [blankProperty()] } })),

  updateCommon: (patch) =>
    set((st) => withRecalcState(st.form, { ...st.form.common, ...patch })),

  updateDocContent: (docId, patch) =>
    set((st) => ({
      form: {
        ...st.form,
        docContents: {
          ...st.form.docContents,
          [docId]: { ...st.form.docContents[docId], ...patch },
        },
      },
    })),

  updateJoint: (patch) => set((st) => ({ jointForm: { ...st.jointForm, ...patch } })),

  mergeFormPatch: (patch) =>
    set((st) => ({ form: withRecalc(deepMerge(st.form, patch) as ContractForm) })),

  replaceForm: (form) => set({ form: withRecalc(form) }),

  setTitle: (t) => set({ title: t }),
  setCurrentContractId: (id) => set({ currentContractId: id }),
  // 저장 기준선은 현재 열린 서류의 활성 폼(joint=jointForm, 그 외=form)을 스냅샷한다.
  markSaved: () =>
    set((st) => ({
      savedHash: JSON.stringify(st.docTypeId === "joint" ? st.jointForm : st.form),
    })),
  loadContract: (row) => {
    // 공동사업표준협약서(joint)는 별도 입력 모델(jointForm)이라 form 과 분리해 복원한다.
    // gap/project 는 한 단계 더 병합해 구버전·부분 저장본의 키 누락을 안전 격리한다.
    if (row.doc_type === "joint") {
      const jbase = blankJointForm();
      const jfd = (row.form_data ?? {}) as Partial<JointForm>;
      const jloaded: JointForm = {
        ...jbase,
        ...jfd,
        gap: { ...jbase.gap, ...(jfd.gap ?? {}) },
        project: { ...jbase.project, ...(jfd.project ?? {}) },
      };
      set({
        docTypeId: row.doc_type,
        category: (row.category as Category) || "new",
        title: row.title,
        currentContractId: row.id,
        jointForm: jloaded,
        // 다른 서류 폼은 초기화(잔존 입력이 새 계약에 섞이지 않도록)
        form: blankContractForm(),
        savedHash: JSON.stringify(jloaded),
        tab: 1,
        step: 1,
      });
      return;
    }
    // 얕은 스프레드는 구버전 저장본의 docContents가 일부 서류 키를 누락하면
    // 그대로 비게 된다(예: c.appform 미존재 → validate 등에서 크래시). docContents는
    // 한 단계 더 병합해 모든 서류 키의 기본 구조를 보장한다.
    const base = blankContractForm();
    const merged: ContractForm = { ...base, ...(row.form_data as ContractForm) };
    merged.docContents = { ...base.docContents, ...(merged.docContents ?? {}) };
    const loaded = withRecalc(merged);
    // 이어서 작성: 저장본을 다시 열 때 항상 STEP 01이 아니라, 아직 필수 입력이
    // 누락된 첫 서류 단계로 진입해 곧장 미완 지점으로 데려간다(없으면 처음부터 검토).
    const resume = firstIncompleteDocStep(loaded);
    set({
      docTypeId: row.doc_type,
      category: (row.category as Category) || "new",
      title: row.title,
      currentContractId: row.id,
      form: loaded,
      // 다른 서류 폼은 초기화(joint 잔존 입력이 섞이지 않도록)
      jointForm: blankJointForm(),
      // 불러온 직후 = 저장본과 동일 상태 → 기준선으로 기록(미저장 변경 false)
      savedHash: JSON.stringify(loaded),
      tab: resume ? resume.tab : 1,
      step: resume ? resume.idx : 1,
    });
  },

  restoreDraft: (draft) =>
    set(() => {
      // 두 폼 모두 blank 와 한 단계 더 병합해 구버전·부분 초안의 키 누락을 안전 격리
      // (loadContract 와 동일 패턴 — validate 등 크래시 방지). form 은 파생값 재계산.
      const base = blankContractForm();
      const mergedForm: ContractForm = { ...base, ...draft.form };
      mergedForm.docContents = { ...base.docContents, ...(mergedForm.docContents ?? {}) };
      const jbase = blankJointForm();
      const jfd = draft.jointForm ?? {};
      const mergedJoint: JointForm = {
        ...jbase,
        ...jfd,
        gap: { ...jbase.gap, ...(jfd.gap ?? {}) },
        project: { ...jbase.project, ...(jfd.project ?? {}) },
      };
      return {
        docTypeId: draft.docTypeId,
        category: draft.category,
        title: draft.title,
        form: withRecalc(mergedForm),
        jointForm: mergedJoint,
        tab: draft.tab,
        step: draft.step,
        // ★초안 = 아직 저장 안 한 작업 → 미저장(dirty)·신규(미연결)로 복원한다.
        currentContractId: null,
        savedHash: null,
      };
    }),

  reset: () =>
    set({
      docTypeId: null,
      category: null,
      tab: 1,
      step: 1,
      form: blankContractForm(),
      jointForm: blankJointForm(),
      currentContractId: null,
      title: "",
      savedHash: null,
    }),
}));

/* common 패치 후 파생값 재계산 */
function withRecalcState(form: ContractForm, common: ContractForm["common"]) {
  return { form: recalcDerived({ ...form, common }) };
}

/**
 * 미저장 변경 여부.
 * - savedHash 존재(저장/불러오기 1회 이상): 현재 form이 그 스냅샷과 다르면 dirty.
 * - savedHash null(아직 한 번도 저장 안 함): 빈 양식에서 입력이 시작됐으면 dirty,
 *   손대지 않은 빈 양식이면 false(불필요한 "저장 필요" 노이즈 방지).
 */
let _blankHash: string | null = null;
let _blankJointHash: string | null = null;
export function isFormDirty(
  form: ContractForm | JointForm,
  savedHash: string | null,
  isJoint = false,
): boolean {
  const cur = JSON.stringify(form);
  if (savedHash === null) {
    // 아직 한 번도 저장 안 함: 손대지 않은 빈 양식이면 false(불필요 경고 방지).
    // joint 는 입력 모델이 달라 빈 기준선도 blankJointForm 으로 비교한다.
    if (isJoint) {
      if (_blankJointHash === null) _blankJointHash = JSON.stringify(blankJointForm());
      return cur !== _blankJointHash;
    }
    if (_blankHash === null) _blankHash = JSON.stringify(blankContractForm());
    return cur !== _blankHash;
  }
  return cur !== savedHash;
}

/* ---------------- deep merge (Claude 부분 패치용) ---------------- */
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 배열은 통째로 교체, 객체는 재귀 머지 */
function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return (patch as unknown as T) ?? base;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v === undefined) continue;
    const cur = out[k];
    if (Array.isArray(v)) {
      out[k] = v;
    } else if (isPlainObject(v) && isPlainObject(cur)) {
      out[k] = deepMerge(cur, v as DeepPartial<typeof cur>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
