/* ============================================================
   상태 메시지 글리프 분리 — 동적 role=status 메시지의 장식 글리프 단일 출처.

   배경(a11y·WCAG 1.3.1, 비-산출물·표시 전용): 위저드 stepper·sub-step pill
   (cabf4d9)·ContractsView 카드 칩·헤더 doc-progress 요약(359a2a8)의 ✓/⚠
   글리프는 이미 `<span aria-hidden="true">` 장식 처리됐다. 그러나 그 외의
   **동적 상태 메시지**(role="status"·aria-live="polite" 라이브 영역에 들어가는
   런타임 문자열)는 여전히 글리프가 문자열 맨 앞에 박혀 있다:
     · Wizard 일괄 생성 결과   `✓ 준비된 N종 … 생성 완료 …`
     · ContractsView 백업/가져오기/일괄·협약서 생성 결과  `✓ …`
   라이브 영역이 갱신되면 SR 은 내용 전체를 낭독하므로, 의미 텍스트 앞에
   모호한 "check mark" 가 매 성공 고지마다 먼저 읽히던 잔여 갭.

   해결: 동적 문자열은 JSX 리터럴처럼 글리프 span 을 직접 못 감싸므로, 맨 앞
   장식 글리프를 본문과 분리하는 순수 함수를 단일 출처로 둔다. 렌더 측은
   `{glyph && <span aria-hidden="true">{glyph} </span>}{text}` 로 글리프만
   장식 처리하고 본문은 그대로 낭독되게 한다(시각 표시는 글리프+공백 재구성으로
   완전 동일·CSS 신규 0). 의미는 뒤따르는 텍스트가 이미 전달하므로 별도
   `.sr-only` 불요(글리프=순수 시각 중복, 칩 글리프와 동일 판단).

   조문·엔진·검증 게이트·생성 로직·산출물 무접촉(표시/접근성 경계만).
   ============================================================ */

/**
 * 상태 메시지 맨 앞의 장식 글리프 집합 — 색·뒤따르는 텍스트가 의미를 전달하는
 * 순수 시각 강조 기호. 여기 없는 선두 문자는 본문으로 취급한다(과분리 방지).
 */
export const STATUS_GLYPHS = ["✓", "●", "⚠", "🗑"] as const;

/**
 * 상태 메시지를 맨 앞 장식 글리프와 본문으로 분리한다.
 * 알려진 장식 글리프로 시작하면 `{ glyph, text }`(글리프 직후 공백 1개 흡수),
 * 아니면 `{ glyph: "", text: msg }`(원문 그대로). 순수 함수·입력 무변형.
 */
export function splitStatusGlyph(msg: string): { glyph: string; text: string } {
  for (const g of STATUS_GLYPHS) {
    if (msg.startsWith(g)) {
      return { glyph: g, text: msg.slice(g.length).replace(/^[ \t]/, "") };
    }
  }
  return { glyph: "", text: msg };
}
