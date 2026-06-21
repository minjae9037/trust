"use client";

import { useRef, useState } from "react";
import { useContractStore } from "@/lib/store/contractStore";
import { summarizeForm, toolInputToPatch, normalizePatchIds } from "@/lib/chat/formSchema";
import { isSubmitEnter } from "@/lib/ui/keys";
import {
  tokenizePII,
  restorePII,
  restorePIIDeep,
  type PiiMap,
} from "@/lib/privacy/tokenize";

interface Msg {
  role: "user" | "assistant";
  display: string; // 화면용(원문 복원)
  api: string; // 전송용(토큰화)
}

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const { form, mergeFormPatch } = useContractStore();
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      display:
        "안녕하세요. 담보신탁 계약 정보를 대화로 정리해 드릴게요. 위탁자(시행사) 상호부터 알려주시겠어요?",
      api: "",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const piiMap = useRef<PiiMap>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send() {
    const raw = input.trim();
    if (!raw || busy) return;
    setErr("");
    setInput("");

    const { text: tokenized } = tokenizePII(raw, piiMap.current);
    const userMsg: Msg = { role: "user", display: raw, api: tokenized };
    const nextMsgs = [...msgs, userMsg];
    setMsgs(nextMsgs);
    setBusy(true);
    setTimeout(() => scrollRef.current?.scrollTo(0, 1e9), 50);

    try {
      const apiMessages = nextMsgs
        .filter((m) => m.role === "assistant" || m.api) // 첫 인사(api="")는 제외
        .map((m) => ({ role: m.role, content: m.role === "user" ? m.api : m.display }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, formSummary: summarizeForm(form) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "요청 실패");

      const replyDisplay = restorePII(data.reply || "", piiMap.current);
      setMsgs((m) => [
        ...m,
        { role: "assistant", display: replyDisplay || "(응답 없음)", api: data.reply || "" },
      ]);

      if (data.patch) {
        const restored = restorePIIDeep(data.patch, piiMap.current);
        const patch = normalizePatchIds(toolInputToPatch(restored as Record<string, unknown>));
        mergeFormPatch(patch);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollTo(0, 1e9), 50);
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-head">
        <div>
          <strong>AI 어시스턴트</strong>
          <div className="field-hint">대화로 계약 조건을 채웁니다 · 민감정보는 토큰화 후 전송</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="chat-body" ref={scrollRef}>
        {msgs.map((m, i) => (
          <div key={i} className={"chat-msg " + m.role}>
            {m.display}
          </div>
        ))}
        {busy && <div className="chat-msg assistant">…작성 중</div>}
        {err && (
          <div className="chat-msg assistant" style={{ color: "var(--c-danger)" }}>
            오류: {err}
          </div>
        )}
      </div>

      <div className="chat-input-row">
        <textarea
          className="input"
          rows={2}
          placeholder="예) 위탁자는 ABC개발 주식회사, 우선수익자는 ○○은행 대출 50억, 비율 120%…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (isSubmitEnter(e)) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="btn btn-primary" onClick={send} disabled={busy}>
          전송
        </button>
      </div>
    </div>
  );
}
