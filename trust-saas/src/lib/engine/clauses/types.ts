/* 계약 조문 데이터 타입 (참조 HTML c[].l/p/t/dyn 구조) */
export interface ClauseLine {
  l?: number; // 0=항 / 1=호 / 2=목
  p?: boolean; // true=항번호 없는 단일 문단
  t?: string; // 본문 텍스트
  dyn?: string; // 동적 치환 키 (빌드 시 옵션값으로 결정)
}

/** 본문 제N조 */
export interface BodyArticle {
  n: number;
  t: string;
  c: ClauseLine[];
}

/** 별첨4 특약 조항 (label 없으면 빌더가 번호 부여) */
export interface AnnexArticle {
  label?: string;
  t: string;
  c: ClauseLine[];
}
