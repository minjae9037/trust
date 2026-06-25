import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { retrieve, formatContext, buildRetrievalQuery } from "@/lib/advisor/retrieve";
import { buildAdvisorSystem, groundingStrength } from "@/lib/advisor/system";
import { loadBackdataChunks } from "@/lib/advisor/backdata";
import { buildSources } from "@/lib/advisor/sources";
import { logQuery } from "@/lib/advisor/log";
import { parseAdvisorBody } from "@/lib/advisor/request";
import { advisorErrorMessage } from "@/lib/advisor/error-message";
import { findCacheHit } from "@/lib/advisor/cache";
import { loadCacheCandidates, saveCacheEntry } from "@/lib/advisor/cache-store";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";

// 캐시 비활성 플래그(긴급 차단용) — ADVISOR_CACHE_OFF=1 이면 항상 LLM 호출.
const CACHE_OFF = process.env.ADVISOR_CACHE_OFF === "1";
// 적중 임계 — 운영 중 코드 재배포 없이 env 로 보정 가능(미설정 시 0.4).
const CACHE_THRESHOLD = Number(process.env.ADVISOR_CACHE_THRESHOLD) || 0.4;

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
- 참고자료에 특정 회사·기관의 내부 규정·실명·개별 딜이 포함돼 있더라도, 그 출처명·회사명·사업장명을
  답변에 그대로 드러내지 마세요. 일반적인 신탁·부동산금융 실무 지식으로 재구성해 설명합니다
  (특정사 내부자료를 인용한 것처럼 보이지 않도록). 특정 딜의 수치·고유 조건은 단정하지 않습니다.
- 사용자가 실제 계약·서류 작성을 원하면(예: "담보신탁 계약서 만들어줘", "공동사업협약서 작성해줘"),
  답변 본문은 평소대로 쓰고 맨 마지막 줄에 정확히 아래 마커 중 하나만 출력하세요
  (마커 자체를 사용자에게 설명하거나 다른 텍스트와 섞지 말 것):
    · 담보신탁 → <<doc:collateral>>
    · 공동사업표준협약서 → <<doc:joint>>
    · 자금관리대리사무 → <<doc:fund>>
  서류 작성 의사가 없으면 마커를 절대 넣지 마세요.

말투: 전문적이고 간결한 한국어. 핵심부터. 과한 사족 없이.`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY 가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  // ★입력 경계 검증 — messages 가 어긋난 본문(빈 배열·비배열·잘못된 원소)이
  //   try/catch 밖에서 TypeError 로 라우트를 죽이지 않도록 단일 지점에서 차단.
  const parsed = parseAdvisorBody(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const messages = parsed.messages;

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  // RAG-lite: 최근 사용자 발화로 지식코퍼스 검색 → 근거 주입
  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  // ── 시맨틱 캐시 우선(무 API) ───────────────────────────────────────────
  //   신규 단일 질문(문맥 의존 없는 첫 턴)에 한해, 의미 유사한 과거 Q&A 가
  //   임계 이상으로 적중하면 저장된 답을 즉시 스트리밍하고 LLM 호출을 생략한다.
  //   멀티턴(후속 질문)은 직전 대화 문맥에 답이 달라지므로 캐시를 쓰지 않는다.
  const isFreshSingleTurn = messages.length === 1 && messages[0].role === "user";
  if (!CACHE_OFF && lastUser && isFreshSingleTurn) {
    const candidates = await loadCacheCandidates();
    const hit = findCacheHit(lastUser.content, candidates, { threshold: CACHE_THRESHOLD });
    if (hit) {
      void logQuery(lastUser.content, true, hit.score, [hit.entry.id]);
      const cachedSources = Array.isArray(hit.entry.sources) ? hit.entry.sources : [];
      const cHeader = Buffer.from(JSON.stringify(cachedSources), "utf8").toString("base64");
      const text = hit.entry.answer;
      const enc = new TextEncoder();
      const cstream = new ReadableStream<Uint8Array>({
        start(controller) {
          // 스트리밍 UX 유지를 위해 저장본을 청크 단위로 흘려보낸다.
          const CHUNK = 60;
          for (let i = 0; i < text.length; i += CHUNK) {
            controller.enqueue(enc.encode(text.slice(i, i + CHUNK)));
          }
          controller.close();
        },
      });
      return new Response(cstream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Advisor-Sources": cHeader,
          "X-Advisor-Cache": "hit",
          "Access-Control-Expose-Headers": "X-Advisor-Sources, X-Advisor-Cache",
        },
      });
    }
  }
  // 기본 KNOWLEDGE + (있으면) back-data 인덱스 병합 검색.
  // ★멀티턴 후속 질문("그럼 절차는?")은 마지막 발화만으론 회수 0건이 되므로, 직전 사용자
  //   발화(최근 N턴)를 합친 맥락 질의로 검색한다(buildRetrievalQuery — 단발은 종전과 동일).
  const retrievalQuery = buildRetrievalQuery(messages);
  const retrieved = retrievalQuery ? retrieve(retrievalQuery, 4, loadBackdataChunks()) : [];
  const contextText = formatContext(retrieved);

  // 근거 출처 → 응답 헤더로 클라이언트에 전달.
  // ★출처 식별성 차단: back-data(내부 수집 자료)의 원본 문서명은 내보내지 않고
  //   일반 라벨로 치환한다(buildSources). 페르소나가 LLM 답변에서 막는 출처명
  //   노출을, 헤더/칩 경로가 우회하지 않도록 전송 경계에서 일반화. core 개념어는 보존.
  const sources = buildSources(retrieved);
  const sourcesHeader = Buffer.from(JSON.stringify(sources), "utf8").toString("base64");

  // [수집] 자가고도화 루프 — 질문·RAG 적중여부 로깅(검색 0건 = 지식 공백 후보)
  // ★retrievalQuery(=실제 회수에 쓴 맥락 질의)도 함께 남긴다 — gap-report 재채점이 라우트와
  //   동일 질의로 채점해 맥락 의존 후속질문을 거짓 공백으로 오집계하지 않게(단발이면 q 와 같아 미기록).
  if (lastUser) {
    void logQuery(
      lastUser.content,
      retrieved.length > 0,
      retrieved[0]?.score ?? 0,
      retrieved.map((r) => r.chunk.id),
      retrievalQuery
    );
  }

  // 시스템 프롬프트 조립(순수 buildAdvisorSystem) — grounding 있으면 참고자료 블록,
  // 회수 0건이면 범위 주의 지침(OUT_OF_SCOPE_NOTE)을 주입해 코퍼스 밖 질문에 단정적
  // 수치·조항을 지어내지 않게 가드레일을 건다(추정 금지·전문가 확인 권고).
  // ★회수는 됐으나 최고점수가 약하면(겨우 임계만 넘긴 tangential grounding) 강한 매칭과
  //   동일한 "근거로 활용" 프레이밍 대신 약한 grounding 주의(WEAK_GROUNDING_NOTE)를 덧대
  //   LLM 이 빈약한 자료에 과의존하지 않게 한다(strength 는 회수 최고점수 + 정체성 매칭으로 결정).
  //   ★정체성 매칭(retrieved[0].identity): 질의가 1위 청크의 고유 복합 도메인어("담보신탁" 등)를
  //   정확히 포함하면 점수가 임계 미만이어도 strong — 핵심 정의 질문("담보신탁이 무엇인가요?")이
  //   정확한 청크를 받고도 "관련도 낮음"으로 오분류되던 갭을 메운다(gap-report 미적중 최다).
  const strength = groundingStrength(retrieved[0]?.score ?? 0, retrieved[0]?.identity ?? false);
  const systemBlocks = buildAdvisorSystem(ADVISOR_PERSONA, contextText, strength);

  const rs = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: MODEL,
          max_tokens: 2048,
          system: systemBlocks,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });
        // 캐시 적립용으로 전체 답을 누적하면서 동시에 스트리밍한다.
        let full = "";
        stream.on("text", (t) => {
          full += t;
          controller.enqueue(encoder.encode(t));
        });
        await stream.finalMessage();
        controller.close();
        // 신규 단일 질문의 답만 캐시에 적립(다음 동일·유사 질문은 무 API 즉답).
        if (lastUser && isFreshSingleTurn) {
          void saveCacheEntry(lastUser.content, full, sources);
        }
      } catch (e) {
        // ★표시 경계: 영문 SDK 메시지(overloaded·rate limit·연결 오류 등)를
        //   100% 한국어 제품 본문에 그대로 흘리지 않도록 친화적 한국어로 치환.
        const msg = advisorErrorMessage(e);
        controller.enqueue(encoder.encode("\n\n[오류] " + msg));
        controller.close();
      }
    },
  });

  return new Response(rs, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Advisor-Sources": sourcesHeader,
      "X-Advisor-Cache": "miss",
      // ★grounding 강도 투명 신호: LLM 프롬프트(WEAK_GROUNDING_NOTE)뿐 아니라 사용자에게도
      //   답변이 약하게 매칭된 참고자료에 기댔는지 알린다(클라이언트가 "관련도 낮음" 표시).
      //   회수 0건(strength 무의미·참고자료 패널 자체 미노출)에도 strength="weak"이나, 칩은
      //   sources 존재 시에만 렌더되므로 0건엔 안 뜬다. ★캐시 적중 경로는 strength 미계산이라
      //   이 헤더를 의도적으로 미부착(없는 신호를 날조하지 않음 — CLAUDE.md #1 사실 기반).
      "X-Advisor-Grounding": strength,
      "Access-Control-Expose-Headers": "X-Advisor-Sources, X-Advisor-Cache, X-Advisor-Grounding",
    },
  });
}
