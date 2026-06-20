# 신탁 자동화 AI 경영조직 (trust-corp)

엠제이인사이트 주식회사가 세우는 **신탁 업무 자동화 SaaS**(brand 미정 / trust-saas)를 키우는
**AI 가상 경영조직**. 대표님(이민재)이 최종 의사결정권자이며, 그 아래 AI 임직원이 일간 단위로
회사를 운영·개발·확장한다. 1차 목표 = **계약서 자동화 서비스 구현·출시.**

## 조직도

```
                     대표님 (이민재) — 최종 의사결정
                          ▲  │ 보고      │ 의사결정
                          │  ▼           ▼
                  ┌──────────────────────────┐
                  │  C0  대표이사(CEO)        │  ← 오케스트레이터
                  └──────────────────────────┘
                          ▲ 취합보고  │ 지시
                          │           ▼
                  ┌──────────────────────────┐
                  │  T1  기획팀 (PM·전략 허브) │  ← 하위 취합·CEO 보고
                  └──────────────────────────┘
            ┌─────────────┬─────────────┬─────────────┐
           T2            T3            T4            T5
          개발          디자인         마케팅         사업(신탁)
        (4인:팀장·       (팀장·과장)    (팀장·과장)     (팀장·과장,
       차장·과장·대리)                                 신탁 전문가)
```

- **역할 정의**: [org/](./org/) — `00-ceo.md` `01-planning.md` `02-engineering.md` `03-design.md` `04-marketing.md` `05-business.md`
- **추가 신설**: 대표님 지정 5팀 운영을 위해 **기획팀(T1)** 을 PM·전략 허브로 신설(분배·취합 담당).
- **개발팀**은 대표님 지시대로 **팀장+차장+과장+대리 4인**이 병렬·효율 개발.

## 일일 운영 흐름 (Daily Cycle)

```
[1] 분배   : 기획팀이 대표님 의사결정(decisions/inbox.md)+우선순위 → 개발/디자인/마케팅/사업에 미션 배정
[2] 실행   : 4팀이 각자 역할대로 수행 → reports/<날짜>/<팀>.md 산출 (개발=4인 분담)
[3] 취합   : 기획팀이 전 팀 결과+의존성 조정 → planning-rollup.md
[4] 보고   : CEO가 대표님 관점으로 압축 → ceo-brief.md (성과/리스크/★결정필요)
[5] 동기화 : reports를 Notion "Trust series"에 미러링 + 대표님 보고
[6] 의사결정: 대표님이 ceo-brief 검토 → decisions/inbox.md 지시 → 다음 사이클 반영 (루프)
```

- 실행 엔진: [.claude/workflows/daily-cycle.mjs](./.claude/workflows/daily-cycle.mjs) (Workflow) — 대규모 구현 사이클용
- 스케줄: `scripts/run-daily.ps1` (Task Scheduler 등록은 대표님 승인 필요)

## 24시간 연속 업무 + 보고 리듬 (대표님 지시)
회사는 **24시간 연속 개발**하며, 정해진 시점에 보고한다.
- **08 work-start**: `ensure-worker.ps1`가 24h 연속 개발 워커(`run-worker.ps1`)를 가동(이미 실행중이면 유지).
  워커는 멈춤 플래그(`stop-worker.ps1`) 전까지 백로그를 1개씩 구현·검증하며 연속 반복(로컬 한정, 배포 금지).
- 보고 4시점은 모드별 헤드리스 세션(`scripts/run-report.ps1 -Mode <mode>`):
  **02 verify**(검증,내부) → **06 prep**(정리,내부) → **09 morning**(어제피드백+오늘계획,보고) →
  **14 progress**(진행,보고) → **17 interim**(중간,보고) → **21 final**(최종,보고)
- 보고 4회(09/14/17/21)만 대표님 알림. 02/06/08은 내부.
- 등록: `scripts/register-tasks.ps1`(작업 7개, **대표님 직접 1회 실행** — 무인 bypass 루프라 자동승인 차단), 해제: `unregister-tasks.ps1`. 상세 `state/config.md`.

## 산출물 위치
- `reports/<YYYY-MM-DD>/` — 팀별 보고 + planning-rollup + ceo-brief
- `decisions/inbox.md` (대표님 입력) · `decisions/log.md` (히스토리)
- `alerts/log.md` (즉시 보고) · `state/{backlog,kpi,config}.md`
- `context/{company,product}.md` (기준 문서)

## 운영 원칙
1. **사실 기반** — 추정 보고/추정 조문 금지. 출처(파일·법령·양식) 명시.
2. **정확성 최우선** — 신탁 서류는 법적 효력 문서. 조문/특약은 verbatim 원본 기반만.
3. **가드레일** — 변호사법 경계(서류 작성 도구로 포지셔닝), PII 토큰화, 임의 배포 금지.
4. **실행 지향** — "다음 액션 + 담당 부서" 명시. 취합은 기획, 압축은 CEO, 결정은 대표님.
5. 호칭은 "대표님".

## 관리 자산
- `trust-saas` (핵심 제품, Next.js+Supabase) · `trust-automatic` (조문 원천 PoC)
- 상세: [context/product.md](./context/product.md)
