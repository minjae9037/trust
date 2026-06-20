import { createClient } from "@supabase/supabase-js";

// 서버 전용 관리자 클라이언트 (RLS 우회 — 신뢰 작업 전용)
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } }
  );
}
