"use client";

import { useRef, useState } from "react";
import { useContractStore } from "@/lib/store/contractStore";
import {
  summarizeForm,
  toolInputToPatch,
  normalizePatchIds,
  summarizePatch,
  buildChatApiMessages,
} from "@/lib/chat/formSchema";
import { isSubmitEnter } from "@/lib/ui/keys";
import { useDialog } from "@/lib/ui/use-dialog";
import { friendlyErrorMessage } from "@/lib/ui/error-message";
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
  kind?: "note"; // 폼 반영 알림(시스템 표시 전용·API 전송 제외)
}

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const { form, docTypeId, mergeFormPatch } = useContractStore();
  // ★대화 자동 채움(update_form)은 담보신탁 ContractForm 전용이다(도구 스키마·
  //   summarizeForm·mergeFormPatch 모두 collateral form 1:1). 공동사업표준협약서
  //   (joint)는 입력 모델이 jointForm 으로 분리돼 있어, 이 채팅이 그대로 동작하면
  //   ① 빈 collateral 컨텍스트를 보내 엉뚱한 안내를 하고 ② AI 패치를 **숨은
  //   collateral form 에 적용**해 다른 계약을 조용히 오염시킨다(교차오염·정확성 갭).
  //   joint 가 열려 있으면 자동 채움을 끄고 "양식에서 직접 입력" 안내로 전환한다
  //   (PDF 팝업 차단 거짓 성공 차단·AI 반영 가시화와 동일한 정확성 가드레일).
  const isJoint = docTypeId === "joint";
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    {
      role: "assistant",
      display: isJoint
        ? "공동사업표준협약서는 왼쪽 양식에서 직접 입력해 주세요. 대화 자동 채움은 현재 담보신탁 계약만 지원합니다. 협약 조건·절차가 궁금하시면 물어봐 주세요."
        : "안녕하세요. 담보신탁 계약 정보를 대화로 정리해 드릴게요. 위탁자(시행사) 상호부터 알려주시겠어요?",
      api: "",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // 스크린리더 전용 상태 고지(WCAG 4.1.3 Status Messages) — 시각 "…작성 중" 버블과 AI 폼
  // 자동채움 "✓ … 반영됨" 노트는 라이브 영역이 아니어서, SR 사용자는 ① 답변이 작성 중인지
  // ② AI 가 법적 폼 항목을 조용히 채웠는지를 전혀 듣지 못했다(시각 사용자만 인지하던 갭 —
  // AdvisorChat .advisor-live 패리티). 작성 시작·답변 도착·자동채움 결과를 polite 라이브
  // 영역으로 알린다(오류는 err 의 role=alert 가 전담 → 이중 낭독 회피). 표시/접근성 경계만:
  // 페르소나·검색·PII 토큰화·폼 패치 로직 무접촉.
  const [live, setLive] = useState("");
  const piiMap = useRef<PiiMap>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  // 드로어를 다이얼로그로: 마운트 시 입력란으로 포커스 이동(data-autofocus)·Tab
  // 포커스 트랩·Esc 닫기. 트리거(chat-fab)로의 포커스 복귀는 TrustApp 이 담당.
  const dialogRef = useDialog<HTMLDivElement>(onClose);

  // 주어진 화면 이력으로 /api/chat 을 호출하고 응답을 처리한다(최초 전송·재전송 공용).
  // ★실패해도 입력란·이력을 건드리지 않으므로, 마지막 사용자 메시지가 버블로 보존되어
  //   retry() 가 같은 이력을 원문 재타이핑 없이 그대로 재전송할 수 있다(유실 방지).
  async function deliver(history: Msg[]) {
    setErr("");
    setBusy(true);
    setLive("답변을 작성하고 있습니다."); // SR 고지: 작성 시작(시각 "…작성 중" 버블은 라이브 영역 아님)
    setTimeout(() => scrollRef.current?.scrollTo(0, 1e9), 50);

    try {
      // note(반영 알림)·첫 인사(api="")는 전송 제외 — 최초/재전송 동일 페이로드 단일 출처.
      const apiMessages = buildChatApiMessages(history);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // joint 가 열려 있으면 collateral 폼 요약(빈/무관) 대신 현재 서류 맥락만
        // 전달해 AI 가 collateral 값을 채우려 하지 않도록 한다(자동 채움 비활성).
        body: JSON.stringify({
          messages: apiMessages,
          formSummary: isJoint
            ? "현재 사용자는 '공동사업표준협약서'를 작성 중입니다. 이 서류는 폼 자동 채움(update_form)을 지원하지 않으니, 값을 채우려 하지 말고 질문에 답하거나 양식 직접 입력을 안내하세요."
            : summarizeForm(form),
        }),
      });
      // ★!res.ok 는 서버가 보낸 원시 JSON 본문({"error":"…"})을 그대로 throw 한다
      //   — catch 의 friendlyErrorMessage 가 passthrough 로 친화적 한국어를 추출
      //   (상담 AdvisorChat 와 동형, 이중 일반화 방지). 정상 경로만 res.json() 파싱.
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || "요청 실패");
      }
      const data = await res.json();

      const replyDisplay = restorePII(data.reply || "", piiMap.current);
      setMsgs((m) => [
        ...m,
        { role: "assistant", display: replyDisplay || "(응답 없음)", api: data.reply || "" },
      ]);

      // SR 고지 본문 — 기본은 "도착"이되, AI 가 법적 폼 항목을 채운 경우(아래 applied)
      // 무엇이 반영됐는지를 함께 알린다(시각 "✓ … 반영됨" 노트의 SR 패리티·값 미노출).
      let liveDone = "답변이 도착했습니다.";
      if (data.patch && isJoint) {
        // ★교차오염 차단: joint 작성 중에는 AI 패치를 collateral form 에 적용하지
        //   않는다(숨은 폼 오염 방지). 자동 채움 미지원을 사실대로 안내만 한다.
        setMsgs((m) => [
          ...m,
          {
            role: "assistant",
            display: "ℹ 공동사업표준협약서는 왼쪽 양식에서 직접 입력해 주세요 — 대화 자동 채움은 담보신탁 계약만 지원합니다.",
            api: "",
            kind: "note",
          },
        ]);
      } else if (data.patch) {
        const restored = restorePIIDeep(data.patch, piiMap.current);
        const patch = normalizePatchIds(toolInputToPatch(restored as Record<string, unknown>));
        mergeFormPatch(patch);
        // ★AI 가 채운 법적 폼 항목을 사용자가 검수·신뢰할 수 있게 가시화(값 미노출·표시 전용)
        const applied = summarizePatch(patch);
        if (applied.length > 0) {
          setMsgs((m) => [
            ...m,
            { role: "assistant", display: `✓ ${applied.join(" · ")} 반영됨`, api: "", kind: "note" },
          ]);
          liveDone = `답변 도착 · ${applied.join(" · ")} 반영됨`; // SR: AI 자동채움 결과 고지
        }
      }
      setLive(liveDone); // SR 고지: 정상 완료(작성 중↔도착 내용 변화로 재낭독)
    } catch (e) {
      // ★표시/정보누출 경계: 네트워크 영문 오류(Failed to fetch 등)·서버 원시 JSON
      //   본문을 raw 노출하지 않고 친화적 한국어로 치환(단일 출처 friendlyErrorMessage).
      setErr(friendlyErrorMessage(e));
      // SR 고지는 비움 — 실패는 err 의 role="alert" 가 실제 오류를 낭독하므로 여기서
      // liveMsg 를 또 알리면 이중 낭독이 된다(stale "작성 중" 제거만, AdvisorChat 동형).
      setLive("");
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollTo(0, 1e9), 50);
    }
  }

  // 입력란의 새 메시지를 토큰화해 이력에 추가하고 전송한다.
  async function send() {
    const raw = input.trim();
    if (!raw || busy) return;
    setInput("");

    const { text: tokenized } = tokenizePII(raw, piiMap.current);
    const userMsg: Msg = { role: "user", display: raw, api: tokenized };
    const nextMsgs = [...msgs, userMsg];
    setMsgs(nextMsgs);
    await deliver(nextMsgs);
  }

  // 전송 실패 시 마지막 사용자 메시지를 원문 재타이핑 없이 그대로 재전송한다(유실 방지).
  // 입력란은 건드리지 않으므로(실패 중 새로 타이핑한 내용 보존), 보존된 이력만 다시 보낸다.
  function retry() {
    if (busy) return;
    void deliver(msgs);
  }
  // 재전송 가능 = 직전 전송이 실패해 마지막 메시지가 미응답 사용자 버블로 남은 상태.
  const canRetry = !!err && msgs[msgs.length - 1]?.role === "user";

  return (
    <div
      className="chat-panel"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-panel-title"
      tabIndex={-1}
    >
      {/* SR 전용 상태 고지(WCAG 4.1.3) — 작성 중·답변 도착·AI 폼 자동채움 결과를 polite
          라이브 영역으로 알린다. 시각 "…작성 중" 버블·"✓ 반영됨" 노트는 낭독 책임 없음
          (role 미부착=중복 낭독 0). 항상 렌더(콘텐츠 변경 전 DOM 존재). 시각 무변경(.sr-only). */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {live}
      </div>
      <div className="chat-head">
        <div>
          <strong id="chat-panel-title">AI 어시스턴트</strong>
          <div className="field-hint">대화로 계약 조건을 채웁니다 · 민감정보는 토큰화 후 전송</div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onClose}
          aria-label="AI 어시스턴트 닫기"
          title="닫기"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <div className="chat-body" ref={scrollRef}>
        {msgs.map((m, i) => {
          // 대화 턴 발화자 라벨 — 스크린리더로 선형 읽기·탐색 시 발화자(나/AI)와 위치(몇
          // 번째 질문)를 고지한다. 시각 사용자는 좌/우 정렬·색으로 발화자를 구분하지만 SR
          // 사용자는 평문만 듣던 갭을 메운다(공개 상담 AdvisorChat 턴 랜드마크의 인앱 패리티).
          // turn = 이 메시지까지의 사용자 발화 수 — 질문과 그에 대한 답변·반영 알림이 같은
          // 번호를 갖는다. 첫 인사(api="")는 사용자 발화 전이라 turn 0 → 번호 없는 "AI 어시스턴트".
          const turn = msgs.slice(0, i + 1).filter((x) => x.role === "user").length;
          const speaker =
            m.role === "user"
              ? `내 질문 ${turn}`
              : m.kind === "note"
                ? "AI 어시스턴트 반영 알림"
                : turn > 0
                  ? `AI 어시스턴트 ${turn}`
                  : "AI 어시스턴트";
          return (
            // 턴 <article>=답변 단위 SR 탐색(NVDA/JAWS article quicknav). aria-label 은
            // className '앞'에 둬 변형 없이 탐색 이름만 부여한다. 상세: verify-chat-turn-landmarks.
            <article key={i} aria-label={speaker} className={"chat-msg " + (m.kind ?? m.role)}>
              <span className="sr-only">{speaker}. </span>
              {m.display}
            </article>
          );
        })}
        {busy && <div className="chat-msg assistant">…작성 중</div>}
        {err && (
          <div className="chat-msg assistant" role="alert">
            <span style={{ color: "var(--c-danger)" }}>오류: {err}</span>
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
          </div>
        )}
      </div>

      <div className="chat-input-row">
        <textarea
          className="input"
          aria-label="AI 어시스턴트 질문 입력"
          data-autofocus
          rows={2}
          placeholder={
            isJoint
              ? "공동사업표준협약서는 왼쪽 양식에서 입력하세요. 궁금한 점을 물어봐 주세요…"
              : "예) 위탁자는 ABC개발 주식회사, 우선수익자는 ○○은행 대출 50억, 비율 120%…"
          }
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
