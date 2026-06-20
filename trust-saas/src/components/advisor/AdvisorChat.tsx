"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const DOC_LABEL: Record<string, string> = {
  collateral: "담보신탁",
  joint: "공동사업표준협약서",
  fund: "자금관리대리사무",
};

/** 답변에서 <<doc:ID>> 액션 마커 추출 (표시용 본문에서는 제거) */
function parseAction(content: string): { body: string; docId: string | null } {
  const m = content.match(/<<doc:(collateral|joint|fund)>>/);
  const body = content.replace(/<<doc:(?:collateral|joint|fund)>>/g, "").trimEnd();
  return { body, docId: m ? m[1] : null };
}

const SUGGESTIONS = [
  "담보신탁과 관리형토지신탁의 핵심 차이와 우선수익권 구조를 비교해줘",
  "PF 본대출 전환 시 책임준공 미이행 신탁의 신용보강 구조를 설명해줘",
  "시행사가 부족한 자기자본으로 사업할 때 가능한 자금조달 구조 옵션은?",
  "담보신탁 우선수익한도금액을 대출원금의 120~130%로 잡는 이유는?",
];

export function AdvisorChat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<Record<number, "up" | "down">>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // [수집] 답변 피드백 — 자가고도화 루프 입력
  async function sendFeedback(i: number, rating: "up" | "down") {
    if (feedbackSent[i]) return;
    const q = msgs[i - 1]?.role === "user" ? msgs[i - 1].content : "";
    setFeedbackSent((s) => ({ ...s, [i]: rating }));
    try {
      await fetch("/api/advisor/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, rating }),
      });
    } catch {
      /* 피드백 실패는 무시 */
    }
  }

  function scrollDown() {
    setTimeout(() => scrollRef.current?.scrollTo(0, 1e9), 30);
  }

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    const base = [...msgs, { role: "user" as const, content: q }];
    setMsgs([...base, { role: "assistant", content: "" }]);
    setBusy(true);
    scrollDown();

    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: base }),
      });
      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => "");
        throw new Error(t || "요청 실패");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMsgs((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
        scrollDown();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMsgs((m) => {
        const copy = m.slice();
        copy[copy.length - 1] = { role: "assistant", content: "오류: " + msg };
        return copy;
      });
    } finally {
      setBusy(false);
      scrollDown();
    }
  }

  return (
    <div className="advisor-wrap">
      {msgs.length === 0 ? (
        <div className="advisor-empty">
          <div className="advisor-empty-glyph">信託</div>
          <h2>무엇을 도와드릴까요?</h2>
          <p>PF·신탁·자산유동화·딜 구조화·세무 — 대체투자 실무를 물어보세요.</p>
          <div className="advisor-suggest">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="suggest-chip" onClick={() => ask(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="advisor-msgs" ref={scrollRef}>
          {msgs.map((m, i) => {
            if (m.role !== "assistant") {
              return (
                <div key={i} className="advisor-msg user">
                  {m.content}
                </div>
              );
            }
            const { body, docId } = parseAction(m.content);
            return (
              <div key={i} className="advisor-msg assistant">
                <div className="md">
                  {body ? <ReactMarkdown>{body}</ReactMarkdown> : <span className="blink">▍</span>}
                </div>
                {docId && (
                  <Link href={`/app?doc=${docId}`} className="doc-action-btn">
                    📄 {DOC_LABEL[docId]} 서류 작성하기 →
                  </Link>
                )}
                {body && !busy && (
                  <div className="advisor-feedback">
                    {feedbackSent[i] ? (
                      <span className="advisor-feedback-done">
                        {feedbackSent[i] === "up" ? "👍 의견 감사합니다" : "👎 더 개선하겠습니다"}
                      </span>
                    ) : (
                      <>
                        <span className="advisor-feedback-label">이 답변이 도움이 됐나요?</span>
                        <button className="fb-btn" onClick={() => sendFeedback(i, "up")} title="도움됨">👍</button>
                        <button className="fb-btn" onClick={() => sendFeedback(i, "down")} title="개선 필요">👎</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="advisor-input-row">
        <textarea
          className="input"
          rows={2}
          placeholder="대체투자 실무 질문을 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
        />
        <button className="btn btn-primary" onClick={() => ask(input)} disabled={busy}>
          전송
        </button>
      </div>
      <div className="advisor-disclaimer">
        일반 정보 제공이며 최종 법률·세무·투자 자문이 아닙니다. 실제 의사결정 전 전문가 검토를
        권장합니다.
      </div>
    </div>
  );
}
