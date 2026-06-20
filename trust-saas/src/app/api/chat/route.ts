import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { UPDATE_FORM_TOOL } from "@/lib/chat/formSchema";

export const runtime = "nodejs";

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PERSONA = `당신은 한국 부동산신탁(담보신탁) 실무에 능숙한 계약 작성 어시스턴트입니다.
사용자(신탁사·시행사·금융기관 실무자)와 자연어로 대화하며, 담보신탁 계약 체결에 필요한
정보를 인터뷰하듯 수집합니다.

역할:
- 현재 폼 상태(아래 제공)를 보고, 비어 있는 핵심 항목을 한 번에 하나씩 자연스럽게 되묻습니다.
- 사용자가 값을 말하면 update_form 도구로 구조화하여 채웁니다.
- 추측하지 마세요. 사용자가 명시한 값만 채웁니다.
- 관계사·부동산 배열을 수정할 때는 해당 역할의 전체 목록을 완전한 객체 배열로 반환합니다.
- 민감 식별자(법인등록번호·사업자번호 등)는 [라벨_숫자] 형태 토큰으로 보일 수 있습니다.
  토큰은 절대 쪼개거나 수정하지 말고, corpRegNo/bizNo 필드에 받은 토큰을 통째로 그대로
  넣으세요(시스템이 실제 값으로 복원·분리합니다).
- 담보신탁계약서 특약 4요소(다수우선수익자 기준/대리금융기관/제21조 인허가/건축주 명의)는
  사용자가 사업 성격을 말하면 적절한 값을 제안하되, 확정은 사용자 동의 후 반영합니다.

수집 우선순위: ① 위탁자 ② 우선수익자·대출금액 ③ 신탁부동산 ④ 계약일·신탁보수 ⑤ 특약옵션.

말투: 간결하고 전문적인 한국어. 한 번에 1~2개 항목만 질문. 채운 내용은 짧게 확인해 줍니다.`;

interface ChatBody {
  messages: { role: "user" | "assistant"; content: string }[];
  formSummary: string;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY 가 설정되지 않았습니다. .env.local 을 확인하세요." },
      { status: 500 }
    );
  }

  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: [
        { type: "text", text: SYSTEM_PERSONA, cache_control: { type: "ephemeral" } },
        { type: "text", text: `[현재 폼 상태]\n${body.formSummary}` },
      ],
      tools: [
        {
          ...UPDATE_FORM_TOOL,
          cache_control: { type: "ephemeral" },
        } as Anthropic.Tool,
      ],
      tool_choice: { type: "auto" },
      messages: body.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    let reply = "";
    let patch: Record<string, unknown> | null = null;
    for (const block of resp.content) {
      if (block.type === "text") reply += block.text;
      else if (block.type === "tool_use" && block.name === "update_form") {
        patch = block.input as Record<string, unknown>;
      }
    }

    return NextResponse.json({ reply: reply.trim(), patch });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Claude 호출 실패: " + msg }, { status: 502 });
  }
}
