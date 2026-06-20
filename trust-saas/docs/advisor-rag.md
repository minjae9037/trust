# Pillar 2 상담 코파일럿 — RAG 고도화 설계

## 현재(구현됨)
- `/api/advisor`(서버, claude-sonnet-4-6, 스트리밍) + RAG-lite.
- 검색: `lib/advisor/retrieve.ts`(키워드 점수 = 태그×3 + 본문등장×1, 임계 3, topK 4).
- 지식: `lib/advisor/knowledge.ts` — **26개 큐레이션 청크**(신탁 구조·PF·자본시장·세제 + 담보평가/감정/경매 일반지식). 대외비 0.
- 서류 핸드오프: 답변 끝 `<<doc:ID>>` 마커 → 위저드 연결.
- 비용: 호출마다 Anthropic 토큰 과금(입력=페르소나+RAG+대화이력, 출력≤2048). 페르소나 prompt caching 적용.

## ✅ #2 — Q&A 자가고도화 루프 (구현됨)
- [수집] `/api/advisor`가 질문·RAG적중·topScore·검색청크id를 `advisor-logs/qa-YYYY-MM.jsonl`에 적재(`lib/advisor/log.ts`). 답변 👍/👎 피드백은 `/api/advisor/feedback` → 같은 로그.
- [분석] `node scripts/advisor-improve.mjs` → `advisor-logs/gap-report.md` 생성: 미적중·약한적중(topScore<8)·👎 질문을 집계해 "보강 필요 주제" 리포트.
- [보강] 리포트 기반 검증된 청크를 **사업팀 검수 후** knowledge.ts에 추가(자동 병합 금지=환각·정확성 가드레일).
- ⚠️ 로그는 서버 FS 기록 → 로컬은 영구, Vercel 서버리스는 휘발성(영구보관은 별도 스토리지 필요).

## ✅ #3 — back-data RAG 인제스트 (구현됨, 로컬)
- `node scripts/build-backdata-index.mjs` → `src/lib/advisor/_backdata-index.json`(**gitignore**). 현재 1,007개 일반지식 문서 → **37,666 청크**.
- 대외비 차단: allowlist(업무매뉴얼·지침·실무·요령·기준·평가론 등) ∧ ¬exclude(IM·사업수지·계약서·심사·제안서 등 딜문서) ∧ 특정사명 폴더 제외 ∧ **청크 본문 누출패턴(Z:\Drive·원본주석·특정사명) 후처리 폐기(잔존 0 검증)**.
- `lib/advisor/backdata.ts`가 인덱스를 서버에서 1회 로드·캐시 → `retrieve(q, k, loadBackdataChunks())`로 KNOWLEDGE와 병합 검색.
- ⚠️ 인덱스(34MB)는 gitignore라 public repo·Vercel 빌드에 미포함 → **back-data RAG는 인덱스가 있는 로컬/서버에서만 동작**. 프로덕션은 비공개 스토리지로 인덱스 공급 필요. 미빌드 시 자동으로 KNOWLEDGE 26청크만 사용.

## (원안) #3 — back-data를 근거로 (RAG 인제스트)
목표: `D:\Claude_Cowork\back-data\knowledge`(추출본)를 검색 근거로.
- 방식: **RAG**(모델 재학습 아님). 인제스트 스크립트 → 청크 JSON 인덱스 → retrieve가 로드.
- ⚠️ **대외비 차단(필수)**: back-data엔 실제 딜·계약서가 섞여 있음.
  1. **allowlist**: 일반 지침/실무/개념 문서만 인제스트(IM·사업수지·계약서·심사요청서 등 딜 특정 문서 제외).
  2. **마스킹/큐레이션**: 회사·시행사·SPC·프로젝트·지역사업명·인명·금액 제거. (이번에 추가한 14청크가 그 예시 — 사람이/에이전트가 일반화)
  3. **공개 저장소 금지**: 인덱스에 원문이 들어가면 public repo로 새므로, 큐레이션된 일반지식만 커밋하거나, 원문 인덱스는 비공개 저장소/서버 전용(Vercel env·private storage)으로 분리.
- 확장: 키워드 → **임베딩 벡터검색**으로 retrieve만 교체(코퍼스 커지면 정확도↑).

## #2 — Q&A 자가고도화 루프
모델 재학습이 아니라 지식·프롬프트를 키우는 루프(trust-corp 워커처럼 스케줄 가능):
```
수집(질문·답변·피드백 로깅) → 분석(저품질·검색0건=지식공백 추출)
→ 보강(권위있는 답변 작성·검증 → KNOWLEDGE 청크 추가)
→ 평가(골든 Q&A로 품질측정 → 페르소나·리트리버 튜닝) → 반복
```
- 로깅 저장소 필요(서버/DB) → 정적 Pages 불가, Vercel+DB 또는 로컬에서.
- ⚠️ 모델 자기답변 무검증 재흡수 금지(환각 누적). 신탁·법률은 **사업팀 검수 게이트** 필수.

## 한계
- Pillar 2는 서버(`ANTHROPIC_API_KEY`)가 있어야 동작 → 정적 GitHub Pages 링크에선 비활성. 로컬(.env.local)·Vercel에서만.
