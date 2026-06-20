/* ================================================================
   계약 저장/조회 (Supabase) — 클라이언트
   ================================================================ */
import { createClient } from "@/lib/supabase/client";
import type { ContractForm } from "@/lib/engine/model";

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

/** 현재 로그인 사용자 (없으면 null) */
export async function getCurrentUser() {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

async function getOrgId(): Promise<string | null> {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase.from("profiles").select("org_id").eq("id", u.user.id).single();
  return data?.org_id ?? null;
}

/** 계약 저장 (id 있으면 update, 없으면 insert). 저장된 id 반환 */
export async function saveContract(input: SaveInput): Promise<string> {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("로그인이 필요합니다.");

  const payload = {
    doc_type: input.docType,
    category: input.category,
    title: input.title || "제목 없음",
    form_data: input.formData,
    status: input.status ?? "draft",
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase.from("contracts").update(payload).eq("id", input.id);
    if (error) throw new Error(error.message);
    return input.id;
  }

  const orgId = await getOrgId();
  if (!orgId) throw new Error("조직 정보를 찾을 수 없습니다.");
  const { data, error } = await supabase
    .from("contracts")
    .insert({ ...payload, org_id: orgId, owner_id: u.user.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** 내 조직 계약 목록 */
export async function listContracts(): Promise<ContractRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("id, doc_type, category, status, title, form_data, updated_at, created_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ContractRow[];
}

/** 계약 1건 */
export async function getContract(id: string): Promise<ContractRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("id, doc_type, category, status, title, form_data, updated_at, created_at")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as ContractRow;
}

/** 계약 삭제 */
export async function deleteContract(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("contracts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
