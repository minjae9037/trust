"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSubmitEnter } from "@/lib/ui/keys";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg("");
    const supabase = createClient();
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password: pw });
        if (error) throw error;
        setMsg("가입 완료. 이메일 인증이 필요할 수 있습니다. 로그인 해주세요.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        router.push("/app");
      }
    } catch (e) {
      setMsg("오류: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 400, margin: "0 auto", padding: "80px 24px" }}>
      <Link href="/" style={{ textDecoration: "none", color: "var(--c-ink-mute)", fontSize: 13 }}>
        ← 홈
      </Link>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "16px 0 6px" }}>
        {mode === "signin" ? "로그인" : "회원가입"}
      </h1>
      <p className="field-hint" style={{ marginBottom: 24 }}>
        TrustForm 트러스트폼 · 대체투자 서류·상담 플랫폼
      </p>

      <div className="field" style={{ marginBottom: 12 }}>
        <div className="field-label">이메일</div>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field" style={{ marginBottom: 20 }}>
        <div className="field-label">비밀번호</div>
        <input
          className="input"
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => isSubmitEnter(e, { allowShift: true }) && submit()}
        />
      </div>

      <button className="btn btn-primary" style={{ width: "100%" }} onClick={submit} disabled={busy}>
        {mode === "signin" ? "로그인" : "가입하기"}
      </button>

      {msg && (
        <div className="field-hint" style={{ marginTop: 14, color: "var(--c-danger)" }}>
          {msg}
        </div>
      )}

      <div style={{ marginTop: 20, fontSize: 13, textAlign: "center", color: "var(--c-ink-soft)" }}>
        {mode === "signin" ? "계정이 없으신가요? " : "이미 계정이 있으신가요? "}
        <button
          className="link-btn"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setMsg("");
          }}
        >
          {mode === "signin" ? "회원가입" : "로그인"}
        </button>
      </div>
    </main>
  );
}
