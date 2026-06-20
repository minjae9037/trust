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
} from "@/lib/engine/model";
import { recalcDerived } from "@/lib/engine/calc";

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

  // 네비게이션
  setDocType: (id: string) => void;
  setCategory: (c: Category) => void;
  setTab: (t: number) => void;
  setStep: (s: number) => void;

  // 관계사
  addParty: (role: PartyRole) => void;
  removeParty: (role: PartyRole, idx: number) => void;
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
  loadContract: (row: {
    id: string;
    doc_type: string;
    category: string | null;
    title: string;
    form_data: ContractForm;
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
  loadContract: (row) =>
    set({
      docTypeId: row.doc_type,
      category: (row.category as Category) || "new",
      title: row.title,
      currentContractId: row.id,
      form: withRecalc({ ...blankContractForm(), ...row.form_data }),
      tab: 1,
      step: 1,
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
    }),
}));

/* common 패치 후 파생값 재계산 */
function withRecalcState(form: ContractForm, common: ContractForm["common"]) {
  return { form: recalcDerived({ ...form, common }) };
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
