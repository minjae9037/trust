# trust — 신탁 업무 자동화 (TrustForm)

엠제이인사이트 주식회사의 **신탁 자동화 SaaS** 프로젝트. 신탁사·시행사·시공사·증권사의
계약서·신탁 서류 작성을 AI로 자동화한다. 1차 목표 = **계약서 자동화 서비스**.

## 구성
| 폴더 | 설명 |
|------|------|
| [`trust-saas/`](./trust-saas) | 핵심 제품 — Next.js 16 + Supabase. 서류 자동화 엔진 + 자연어 상담. **로컬 우선(무로그인)** 동작 |
| [`trust-corp/`](./trust-corp) | AI 가상 경영조직 — CEO+기획+개발(4인)+디자인+마케팅+사업(신탁 전문). 24h 연속 개발 + 정시 보고 |
| [`trust-automatic/`](./trust-automatic) | 초기 PoC HTML (조문 verbatim 원천) |

## 로컬 실행 (trust-saas)
```bash
cd trust-saas
npm install
npx next dev --webpack    # http://localhost:3000  (Turbopack은 OOM → webpack 사용)
```
- `/app` 계약서 자동화(입력→2분할 미리보기→검증 게이트→DOCX→내 계약 저장, localStorage·무계정)
- `/advisor` 신탁 상담 (ANTHROPIC_API_KEY 필요)

## 원칙
신탁 서류는 법적 효력 문서 — **조문/특약은 검증된 원본(verbatim)만**, 추정·창작 조문 금지.
변호사법 경계상 "법률 자문"이 아닌 "서류 작성 도구/정보 제공"으로 포지셔닝.
