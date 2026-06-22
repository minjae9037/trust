"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { DOC_LABEL, parseAction, sanitizeHistory } from "@/lib/advisor/action-marker";
import { advisorErrorMessage } from "@/lib/advisor/error-message";
import { demotedHeadingTag } from "@/lib/advisor/markdown";
import { isSubmitEnter } from "@/lib/ui/keys";

// 답변 본문 마크다운 헤딩을 강등 렌더 — 상담 답변은 대화 안의 콘텐츠이지 문서 최상위
// 섹션이 아니므로(WCAG 1.3.1/2.4.6/2.4.10), LLM 이 적극 출력하는 #/##/### 를 그대로
// h1/h2/h3 로 두지 않고 h3 이하로 강등해 페이지 헤딩 아웃라인 오염을 막는다. 시각
// 크기/색은 원본 레벨 클래스(.md-h-N)로 유지(표시 무변경). 모듈 레벨 상수=안정 참조.
function makeHeading(level: number) {
  const Tag = demotedHeadingTag(level); // "h3".."h6"
  const cls = "md-h md-h-" + level;
  function MdHeading({ children }: { children?: React.ReactNode }) {
    return <Tag className={cls}>{children}</Tag>;
  }
  return MdHeading;
}
const MD_COMPONENTS: Components = {
  h1: makeHeading(1),
  h2: makeHeading(2),
  h3: makeHeading(3),
  h4: makeHeading(4),
  h5: makeHeading(5),
  h6: makeHeading(6),
};

interface Source {
  topic: string;
  kind: "backdata" | "core";
}
interface Msg {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  error?: boolean; // 생성 실패 자리표시자(재시도 버튼 노출·피드백/복사 비노출)
}

/** 응답 헤더 X-Advisor-Sources(base64 JSON) → 근거 목록 디코드 */
function decodeSources(header: string | null): Source[] {
  if (!header) return [];
  try {
    const json = decodeURIComponent(escape(atob(header)));
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
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
  const [copied, setCopied] = useState<number | null>(null);
  // 스크린리더 전용 상태 고지(WCAG 4.1.3) — 스트리밍 본문 대신 "생성 중/도착/중지" 같은
  // 간결한 상태 변화만 폴라이트로 알린다. 시작↔도착이 교대로 바뀌어 매 답변마다 재낭독된다.
  const [liveMsg, setLiveMsg] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  // 답변 생성 중지(Stop) — 진행 중 스트리밍을 사용자가 끊을 수 있게 한다.
  const abortRef = useRef<AbortController | null>(null);
  // 답변별 렌더된 마크다운 DOM 노드(인덱스→노드) — 복사 시 서식(표·리스트·헤딩)을
  // 보존한 text/html 을 함께 클립보드에 넣기 위해 참조를 보관한다(언마운트 시 정리).
  const mdRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  // 방금 피드백(👍/👎)을 보낸 답변 인덱스 — 버튼이 언마운트되며 포커스를 잃지 않게
  // 교체된 "의견 감사합니다" 텍스트로 포커스를 옮기기 위한 1회성 표식(WCAG 2.4.3).
  const justFedRef = useRef<number | null>(null);

  // 생성 중지: 진행 중인 fetch/스트림을 abort 한다(부분 답변은 보존, error 미표시).
  function stopGenerating() {
    abortRef.current?.abort();
  }

  // 새 대화 시작 — 현재 대화 이력·피드백·복사 상태를 비워 빈 상태(제안 칩)로 되돌린다.
  // ★정확성 가치: 시맨틱 Q&A 캐시는 fresh single-turn 에만 적용되고(멀티턴 미적용),
  //   누적된 이전 턴은 무관한 새 질문의 맥락을 오염시킬 수 있다 → "새 대화"로 컨텍스트를
  //   리셋하면 캐시 적격이 회복되고 직전 주제 오염이 사라진다(주제 전환 동선).
  //   ★입력란(초안)은 건드리지 않는다 — 실패 재시도 무손실(retry) 원칙과 동일(setInput 무호출)이라
  //   "새 대화"를 눌러도 막 타이핑하던 새 질문은 보존돼 그대로 첫 질문으로 보낼 수 있다.
  //   생성 중에는 무동작(버튼도 disabled) — 진행 중 스트림과의 race 를 피한다(먼저 '중지').
  function newConversation() {
    if (busy) return;
    abortRef.current?.abort(); // 방어적(비-busy 라 보통 null)
    setMsgs([]);
    setFeedbackSent({});
    setCopied(null);
    setLiveMsg(""); // SR 상태도 비움(빈 문자열은 재낭독되지 않음)
  }

  // ★사용자 동작 결과 스크린리더 고지 공용 헬퍼(WCAG 4.1.3 Status Messages) — 복사·피드백
  //   같은 동작의 성공/실패를 폴라이트 라이브 영역(.advisor-live)으로 알린다. 이들 UI 는
  //   모두 !busy 일 때만 노출되므로 스트리밍 상태 고지와 시점이 겹치지 않는다(채널 충돌 없음).
  //   ★빈 문자열로 비웠다가 50ms 뒤 세팅 = 같은 문구를 연속 고지해도(aria-live polite 는
  //   동일 내용엔 무반응) 내용 변화로 재낭독 보장(라이브 영역 재고지 표준 기법).
  const announce = (text: string) => {
    setLiveMsg("");
    setTimeout(() => setLiveMsg(text), 50);
  };

  // 답변 복사 — 구조화 답변(표·체크리스트·비교)을 실무 문서/메일로 옮기는 표준 동선.
  // ★서식 보존: 렌더된 HTML(표·리스트·헤딩)을 text/html 로 함께 복사해 Word·메일·
  //   Notion 에 붙이면 표가 표 그대로 붙는다(원시 마크다운 `| a | b |` 파이프가 평문으로
  //   깨지던 것을 해소 — 이 기능의 본래 목적인 "실무 문서로 옮겨 쓰기"에 직결).
  // ★text/plain 폴백 = 내부 액션 마커(<<doc:…>>)가 제거된 마크다운 본문(body) —
  //   리치 클립보드(ClipboardItem) 미지원/거부 시에도 평문은 항상 복사된다(graceful degradation,
  //   원시 m.content·마커 비노출 계약 유지).
  // ★복사 결과 SR 고지(공용 announce 사용) — 복사 버튼의 시각 토글("✓ 복사됨")은 정적
  //   aria-label("답변 복사")에 가려 SR 접근명으로 안 읽히므로 성공/실패를 라이브 영역으로 알린다.
  async function copyAnswer(i: number, body: string) {
    const html = mdRefs.current.get(i)?.innerHTML ?? "";
    const flash = () => {
      setCopied(i);
      setTimeout(() => setCopied((c) => (c === i ? null : c)), 1500);
      announce("답변을 복사했습니다."); // 성공 고지(리치·평문 폴백 공통 경로)
    };
    try {
      if (html && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([body], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(body);
      }
      flash();
    } catch {
      // 리치 복사 실패(미지원·권한 거부) → 평문(body)으로 폴백, 그래도 실패하면 SR 로 실패 고지
      // (시각 토글은 성공 시에만 바뀌므로 전면 실패는 라이브 영역으로만 알 수 있다 — 전송·답변 경로 무영향).
      try {
        await navigator.clipboard.writeText(body);
        flash();
      } catch {
        announce("답변을 복사하지 못했습니다."); // 전면 미지원·권한 거부 — SR 고지
      }
    }
  }

  // [수집] 답변 피드백 — 자가고도화 루프 입력
  async function sendFeedback(i: number, rating: "up" | "down") {
    if (feedbackSent[i]) return;
    const q = msgs[i - 1]?.role === "user" ? msgs[i - 1].content : "";
    justFedRef.current = i; // 교체될 done 텍스트로 포커스를 옮길 1회성 표식(포커스 상실 방지)
    setFeedbackSent((s) => ({ ...s, [i]: rating }));
    // ★피드백 결과 SR 고지(WCAG 4.1.3) — 👍/👎 버튼은 클릭 즉시 언마운트되며 정적
    //   텍스트("의견 감사합니다")로 교체될 뿐 라이브 영역이 아니어서, SR 사용자는
    //   ① 의견이 접수됐는지 알 수 없고 ② 포커스도 잃는다. 시각 swap 과 동일하게
    //   낙관적으로(전송 성공 여부와 무관, fetch 실패는 무시) 결과를 고지한다.
    announce(rating === "up" ? "도움이 됐다는 의견을 보냈습니다." : "개선이 필요하다는 의견을 보냈습니다.");
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

  // 주어진 이력(마지막 = 사용자 질문)으로 /api/advisor 를 호출하고 답변을 스트리밍한다
  // (최초 질문·재시도 공용 딜리버리 코어). ★실패해도 입력란·이전 이력을 건드리지 않고
  //   진행 중 자리표시자만 오류 자리표시자로 바꾸므로, 마지막 사용자 질문이 버블로 보존돼
  //   retry() 가 같은 이력을 원문 재타이핑 없이 그대로 재전송할 수 있다(ChatPanel 무손실
  //   재전송 패리티, 표시/전송 경계만 — 페르소나·검색·로깅 무접촉).
  async function deliver(base: Msg[]) {
    setMsgs([...base, { role: "assistant", content: "" }]);
    setBusy(true);
    setLiveMsg("답변을 생성하고 있습니다."); // SR 고지: 생성 시작(전송이 등록됐음을 알림)
    scrollDown();

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // ★요청 경계: 대화 이력의 assistant content 에 남은 내부 액션 마커
      //   (<<doc:…>>)를 제거해 전송한다(사용자가 본 본문만 모델 컨텍스트로 —
      //   표시·복사의 마커 비노출 계약을 송신측에서도 보장). 마커뿐인 빈 턴은 제외.
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: sanitizeHistory(base) }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => "");
        throw new Error(t || "요청 실패");
      }
      const srcs = decodeSources(res.headers.get("X-Advisor-Sources"));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMsgs((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = { role: "assistant", content: acc, sources: srcs };
          return copy;
        });
        scrollDown();
      }
      setLiveMsg("답변이 도착했습니다."); // SR 고지: 정상 완료(시작↔도착 교대라 매번 재낭독)
    } catch (e) {
      // ★중지 경계: 사용자가 stopGenerating()로 abort 한 경우는 오류가 아니다.
      //   지금까지 받은 부분 답변은 그대로 보존하고, 받은 내용이 없으면 빈
      //   assistant 자리표시자를 제거(멈춘 커서 ▍ 잔류 방지). 오류 메시지 미표시.
      if (controller.signal.aborted) {
        setLiveMsg("답변 생성을 중지했습니다."); // SR 고지: 사용자 중지(오류 아님)
        setMsgs((m) => {
          const copy = m.slice();
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant" && !last.content) copy.pop();
          return copy;
        });
      } else {
        // ★표시 경계: !res.ok 경로의 원시 JSON 본문(`{"error":"…"}`)·네트워크
        //   영문 오류를 친화적 한국어로 치환(서버가 보낸 한국어 {error}는 통과).
        const msg = advisorErrorMessage(e);
        // SR 고지는 비움 — 실패 자리표시자(role="alert")가 실제 오류를 낭독하므로
        // 여기서 liveMsg 를 또 알리면 이중 낭독이 된다(stale "생성 중"만 제거).
        setLiveMsg("");
        // ★error:true 로 표시 — 이 자리표시자는 답변이 아니라 실패 신호이므로
        //   피드백/복사 대신 "다시 시도" 버튼을 보여 주고, 이력 말미가 사용자
        //   질문으로 보존돼(이 오류 자리표시자만 떼면 됨) retry 가 재전송한다.
        setMsgs((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = { role: "assistant", content: "오류: " + msg, error: true };
          return copy;
        });
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      scrollDown();
    }
  }

  // 입력란의 새 질문을 이력에 추가하고 전송한다(딜리버리 코어 위임).
  function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    void deliver([...msgs, { role: "user" as const, content: q }]);
  }

  // 생성 실패 시 마지막 사용자 질문을 원문 재타이핑 없이 그대로 재전송한다(유실 방지).
  // 실패하면 이력 말미가 [사용자 질문, 오류 자리표시자]이므로, 오류 자리표시자 한 개만
  // 떼어낸 이력(= 사용자 질문으로 끝남)을 그대로 다시 보낸다. 입력란은 건드리지 않아
  // 실패 중 새로 타이핑한 내용이 보존된다(ChatPanel retry 패리티).
  function retry() {
    if (busy) return;
    void deliver(msgs.slice(0, -1));
  }
  // 재시도 가능 = 비-busy 이고 마지막 메시지가 오류 자리표시자(error:true)인 상태.
  const lastMsg = msgs[msgs.length - 1];
  const canRetry = !busy && lastMsg?.role === "assistant" && !!lastMsg.error;

  return (
    <div className="advisor-wrap">
      {/* SR 전용 상태 고지 — 스트리밍 본문은 토큰마다 갱신돼 aria-live 를 직접 걸면
          과다 낭독되므로, 본문 대신 "생성 중/도착/중지" 간결 상태만 폴라이트로 알린다. */}
      <div className="advisor-live" role="status" aria-live="polite" aria-atomic="true">
        {liveMsg}
      </div>
      {/* 대화가 시작된 뒤에만 노출 — 빈 상태(제안 칩)에서는 리셋할 것이 없어 숨긴다.
          생성 중에는 disabled(먼저 '중지') — 진행 중 스트림과의 race 방지. */}
      {msgs.length > 0 && (
        <div className="advisor-bar">
          <button
            type="button"
            className="advisor-newchat"
            onClick={newConversation}
            disabled={busy}
            title="현재 대화를 지우고 새 대화를 시작합니다 (입력 중인 질문은 보존됩니다)"
          >
            ＋ 새 대화
          </button>
        </div>
      )}
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
        <div className="advisor-msgs" ref={scrollRef} aria-busy={busy}>
          {msgs.map((m, i) => {
            if (m.role !== "assistant") {
              return (
                <article key={i} aria-label="내 질문" className="advisor-msg user">
                  {/* 턴 <article>=답변 단위 SR 탐색. 상세: verify-advisor-turn-landmarks. */}
                  <span className="sr-only">내 질문. </span>
                  {m.content}
                </article>
              );
            }
            if (m.error) {
              // 생성 실패 — 답변이 아니므로 피드백/복사/출처 대신 "다시 시도"만 노출.
              return (
                <article key={i} aria-label="상담 답변" className="advisor-msg assistant" role="alert">
                  <span className="sr-only">상담 답변. </span>
                  <span style={{ color: "var(--c-danger)" }}>{m.content}</span>
                  {canRetry && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={retry}
                      disabled={busy}
                      style={{ marginLeft: 8 }}
                    >
                      다시 시도
                    </button>
                  )}
                </article>
              );
            }
            const { body, docId } = parseAction(m.content);
            return (
              <article key={i} aria-label="상담 답변" className="advisor-msg assistant">
                <span className="sr-only">상담 답변. </span>
                <div
                  className="md"
                  ref={(el) => {
                    if (el) mdRefs.current.set(i, el);
                    else mdRefs.current.delete(i);
                  }}
                >
                  {body ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{body}</ReactMarkdown> : <span className="blink">▍</span>}
                </div>
                {body && !busy && m.sources && m.sources.length > 0 && (
                  <div className="advisor-sources">
                    <span className="advisor-sources-label">📚 참고한 자료</span>
                    {m.sources.map((s, k) => (
                      <span key={k} className={"src-chip " + s.kind} title={s.kind === "backdata" ? "내부 지식베이스(back-data)" : "기본 지식"}>
                        {s.topic}
                      </span>
                    ))}
                  </div>
                )}
                {docId && (
                  <Link href={`/app?doc=${docId}`} className="doc-action-btn">
                    📄 {DOC_LABEL[docId]} 서류 작성하기 →
                  </Link>
                )}
                {body && !busy && (
                  <div className="advisor-feedback">
                    {feedbackSent[i] ? (
                      <span
                        className="advisor-feedback-done"
                        tabIndex={-1}
                        ref={(el) => {
                          // 방금 이 답변에 피드백을 보냈다면, 언마운트된 버튼 대신
                          // 이 텍스트로 포커스를 옮긴다(1회만 — 표식을 비워 재렌더 시 재포커스 방지).
                          if (el && justFedRef.current === i) {
                            el.focus();
                            justFedRef.current = null;
                          }
                        }}
                      >
                        {feedbackSent[i] === "up" ? "👍 의견 감사합니다" : "👎 더 개선하겠습니다"}
                      </span>
                    ) : (
                      <>
                        <span className="advisor-feedback-label">이 답변이 도움이 됐나요?</span>
                        <button className="fb-btn" onClick={() => sendFeedback(i, "up")} title="도움됨">👍</button>
                        <button className="fb-btn" onClick={() => sendFeedback(i, "down")} title="개선 필요">👎</button>
                      </>
                    )}
                    <button
                      className="copy-btn"
                      onClick={() => copyAnswer(i, body)}
                      title="답변 복사"
                      aria-label="답변 복사"
                    >
                      {copied === i ? "✓ 복사됨" : "⧉ 복사"}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="advisor-input-row">
        <textarea
          className="input"
          aria-label="대체투자 실무 질문 입력"
          rows={2}
          placeholder="대체투자 실무 질문을 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (isSubmitEnter(e)) {
              e.preventDefault();
              ask(input);
            }
          }}
        />
        {busy ? (
          <button
            className="btn btn-stop"
            onClick={stopGenerating}
            title="답변 생성 중지"
            aria-label="답변 생성 중지"
          >
            ■ 중지
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => ask(input)}>
            전송
          </button>
        )}
      </div>
      <div className="advisor-disclaimer">
        일반 정보 제공이며 최종 법률·세무·투자 자문이 아닙니다. 실제 의사결정 전 전문가 검토를
        권장합니다.
      </div>
    </div>
  );
}
