// 상담(advisor) 답변 본문 마크다운 헤딩 레벨 정규화(접근성·표시 경계만 — 순수 함수).
//
// 배경(WCAG 1.3.1 Info and Relationships / 2.4.6 Headings and Labels / 2.4.10
// Section Headings): 상담 답변은 채팅 대화 '안의 콘텐츠'이지 문서 최상위 섹션이
// 아니다. 그런데 페르소나가 "마크다운(제목/리스트/표/굵게)을 적극 사용"하라고
// 지시하므로 LLM 은 `#`/`##`/`###` 헤딩을 자주 출력하고, react-markdown 은 이를
// 그대로 h1/h2/h3 로 렌더한다. /advisor 페이지엔 h1 이 전혀 없고(브랜드·breadcrumb
// 은 헤딩 아님) 빈 상태의 h2("무엇을 도와드릴까요?")조차 대화가 시작되면 사라지므로,
// 답변 헤딩이 페이지 헤딩 아웃라인을 '문서 레벨'에서 오염시킨다 — 다중 h1, 레벨
// 건너뜀(h2 다음 곧 새 답변의 h1), 그리고 어느 답변에 속한 헤딩인지 알 수 없음.
//
// 해결: 모든 답변 헤딩을 h3 이하로 강등한다(offset +2, h6 클램프). 상대적 계층은
// 보존(원본 h1<h2<h3 → 강등 h3<h4<h5)하되 대화 하위(섹션 미만) 레벨에 둔다.
// 시각적 크기/색은 원본 레벨을 담은 클래스(.md-h-N)로 유지하므로 화면 표시는 무변경.

export type HeadingTag = "h3" | "h4" | "h5" | "h6";

/** 원본 마크다운 헤딩 레벨(1~6) → 강등 레벨(3~6). offset +2, 하한 3·상한 6 클램프. */
export function demotedHeadingLevel(level: number): 3 | 4 | 5 | 6 {
  const src = Math.min(6, Math.max(1, Math.floor(level)));
  const demoted = Math.min(6, src + 2); // h1→3 h2→4 h3→5 h4→6 h5→6 h6→6
  return demoted as 3 | 4 | 5 | 6;
}

/** 원본 헤딩 레벨 → 렌더할 강등 태그명("h3".."h6"). */
export function demotedHeadingTag(level: number): HeadingTag {
  return ("h" + demotedHeadingLevel(level)) as HeadingTag;
}
