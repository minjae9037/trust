/* ================================================================
   계약 저장소 — localStorage 백엔드 (무계정 동작)
   ⚠️ 출시 시 lib/contracts.ts(Supabase)로 교체하면 동일 인터페이스로 스왑 가능.
   ================================================================ */
import type { ContractForm } from "@/lib/engine/model";

const KEY = "trust_contracts";

export interface ContractRow {
  id: string;
  doc_type: string;
  category: string | null;
  status: string;
  title: string;
  form_data: ContractForm;
  updated_at: string;
  created_at: string;
}

export interface SaveInput {
  id?: string;
  docType: string;
  category: string | null;
  title: string;
  formData: ContractForm;
  status?: string;
}

function readAll(): ContractRow[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as ContractRow[];
  } catch {
    return [];
  }
}
function writeAll(rows: ContractRow[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}
function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "c-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** 저장 (id 있으면 갱신, 없으면 신규). 저장된 id 반환 */
export async function saveContract(input: SaveInput): Promise<string> {
  const rows = readAll();
  const now = new Date().toISOString();
  if (input.id) {
    const i = rows.findIndex((r) => r.id === input.id);
    if (i >= 0) {
      rows[i] = {
        ...rows[i],
        doc_type: input.docType,
        category: input.category,
        title: input.title || "제목 없음",
        form_data: input.formData,
        status: input.status ?? rows[i].status,
        updated_at: now,
      };
      writeAll(rows);
      return input.id;
    }
  }
  const id = uuid();
  rows.unshift({
    id,
    doc_type: input.docType,
    category: input.category,
    status: input.status ?? "draft",
    title: input.title || "제목 없음",
    form_data: input.formData,
    created_at: now,
    updated_at: now,
  });
  writeAll(rows);
  return id;
}

export async function listContracts(): Promise<ContractRow[]> {
  return readAll().sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

export async function getContract(id: string): Promise<ContractRow | null> {
  return readAll().find((r) => r.id === id) ?? null;
}

export async function deleteContract(id: string): Promise<void> {
  writeAll(readAll().filter((r) => r.id !== id));
}
