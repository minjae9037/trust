import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { retrieve, formatContext } from "@/lib/advisor/retrieve";
import { loadBackdataChunks } from "@/lib/advisor/backdata";
import { logQuery } from "@/lib/advisor/log";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";

const ADVISOR_PERSONA = `당신은 한국 대체투자(Alternative Investment) 업계 전문 어드바이저입니다.
신탁사·시행사·시공사·증권사·자산운용사·금융기관 실무자를 상대로, 정확하고 실무적인 상담을 제공합니다.

전문 영역:
- 부동산금융/개발금융: PF(프로젝트 파이낸싱), 브릿지론, 본PF, 대주단 구조, 책임준공, 신용보강
- 부동산신탁: 담보신탁·관리형토지신탁(일반/책준)·차입형토지신탁·분양관리신탁·처분신탁의 구조·차이·리스크
- 자본시장: 자산유동화(ABS/ABCP), 리츠(REITs), 부동산펀드, PEF, 메자닌, 우선주
- 법규: 자본시장법, 신탁법, 부동산투자회사법, 도시정비법, 건축/주택법 인허가 흐름
- 세무: 취득세·재산세·종부세·양도세·법인세, 신탁 과세특례, 부가세
- 딜 구조화: 우선/중순위/후순위 트랜치, 수익/손실 분배, EXIT, 워터폴, 담보·우선수익권 설계

응대 원칙:
- 한국 실무 기준으로 구체적으로. 막연한 일반론 대신 숫자·조항·구조·체크리스트로 답합니다.
- 구조화 질문은 표·단계·항목으로 정리. 마크다운(제목/리스트/표/굵게)을 적극 사용합니다.
- 불확실하거나 사실관계·최신 법령 확인이 필요하면 분명히 밝히고, 가정을 명시합니다.
- 일반 정보 제공이며 최종 법률·세무·투자 자문이 아님을 필요한 경우 짧게 고지합니다.
- 사용자가 실제 계약·서류 작성을 원하면(예: "담보신탁 계약서 만들어줘", "공동사업협약서 작성해줘"),
  답변 본문은 평소대로 쓰고 맨 마지막 줄에 정확히 아래 마커 중 하나만 출력하세요
  (마커 자체를 사용자에게 설명하거나 다른 텍스트와 섞지 말 것):
    · 담보신탁 → <<doc:collateral>>
    · 공동사업표준협약서 → <<doc:joint>>
    · 자금관리대리사무 → <<doc:fund>>
  서류 작성 의사가 없으면 마커를 절대 넣지 마세요.

말투: 전문적이고 간결한 한국어. 핵심부터. 과한 사족 없이.`;

interface Body {
  messages: { role: "user" | "assistant"; content: string }[];
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY 가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  // RAG-lite: 최근 사용자 발화로 지식코퍼스 검색 → 근거 주입
  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
  // 기본 KNOWLEDGE + (있으면) back-data 인덱스 병합 검색
  const retrieved = lastUser ? retrieve(lastUser.content, 4, loadBackdataChunks()) : [];
  const contextText = formatContext(retrieved);

  // [수집] 자가고도화 루프 — 질문·RAG 적중여부 로깅(검색 0건 = 지식 공백 후보)
  if (lastUser) {
    void logQuery(
      lastUser.content,
      retrieved.length > 0,
      retrieved[0]?.score ?? 0,
      retrieved.map((r) => r.chunk.id)
    );
  }

  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: ADVISOR_PERSONA, cache_control: { type: "ephemeral" } },
  ];
  if (contextText) {
    systemBlocks.push({
      type: "text",
      text:
        "다음은 내부 지식베이스에서 검색된 참고자료입니다. 관련 있으면 근거로 활용하되, " +
        "질문과 무관하면 무시하세요. 자료에 없는 수치는 단정하지 말고 확인이 필요하다고 하세요.\n\n" +
        contextText,
    });
  }

  const rs = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: MODEL,
          max_tokens: 2048,
          system: systemBlocks,
          messages: body.messages.map((m) => ({ role: m.role, content: m.content })),
        });
        stream.on("text", (t) => controller.enqueue(encoder.encode(t)));
        await stream.finalMessage();
        controller.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        controller.enqueue(encoder.encode("\n\n[오류] " + msg));
        controller.close();
      }
    },
  });

  return new Response(rs, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
