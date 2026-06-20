# trust-corp

신탁 업무 자동화 SaaS를 운영·개발하는 **AI 가상 경영조직**. 상세 운영 규칙은 [CLAUDE.md](./CLAUDE.md).

## 빠른 실행 (수동)
```powershell
# 일일 사이클 1회 실행 (헤드리스)
powershell -File d:\Claude_Cowork\trust\trust-corp\scripts\run-daily.ps1
```
또는 대화형으로 Workflow `.claude/workflows/daily-cycle.mjs` 를 `{ "date": "YYYY-MM-DD" }` args로 실행.

## 구조
```
trust/
├─ trust-corp/        ← AI 경영조직 (이 폴더)
│  ├─ org/            팀별 역할 정의 (00~05)
│  ├─ context/        company.md, product.md (기준 문서)
│  ├─ state/          config, backlog, kpi
│  ├─ decisions/      inbox(대표님 입력), log
│  ├─ alerts/         즉시 보고 로그
│  ├─ reports/        일일 산출물 (YYYY-MM-DD)
│  ├─ scripts/        run-daily.ps1, daily-prompt.md
│  └─ .claude/workflows/daily-cycle.mjs
├─ trust-saas/        ← 핵심 제품 (Next.js + Supabase)
└─ trust-automatic/   ← 초기 PoC HTML (조문 원천)
```

## 팀
| 코드 | 팀 | 구성 |
|------|-----|------|
| C0 | 대표이사(CEO) | 1 (오케스트레이터) |
| T1 | 기획(PM·전략 허브) | 팀장+과장 |
| T2 | 개발 | 팀장+차장+과장+대리 (4인) |
| T3 | 디자인 | 팀장+과장 |
| T4 | 마케팅 | 팀장+과장 |
| T5 | 사업(신탁 전문) | 팀장+과장 |
