import { NextResponse } from "next/server";
import { logFeedback } from "@/lib/advisor/log";

export const runtime = "nodejs";

interface Body {
  q: string;
  rating: "up" | "down";
  note?: string;
}

/** 상담 답변 피드백 수집 — 자가고도화 루프의 [수집] 단계(👍/👎) */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  if (!body.q || (body.rating !== "up" && body.rating !== "down")) {
    return NextResponse.json({ error: "q, rating 필요" }, { status: 400 });
  }
  await logFeedback(body.q, body.rating, body.note);
  return NextResponse.json({ ok: true });
}
