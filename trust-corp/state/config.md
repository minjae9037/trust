# 운영 설정 (Config)

## 운영 리듬 (대표님 지시 2026-06-20 — 24시간 연속 업무)
| 시각 | 모드 | 내용 | 대표님 알림 |
|------|------|------|------|
| 02:00 | verify | 어제 한 일 검증·피드백 준비 | ✗ (내부) |
| 06:00 | prep | 피드백 정리 → 09시 보고 지원 | ✗ (내부) |
| **08:00** | **work-start** | **개발 워커 가동(24h 연속, 이미 실행중이면 유지)** | ✗ (내부) |
| 09:00 | morning | 어제 피드백 + 오늘 계획 | ✓ |
| 14:00 | progress | 09시 계획 대비 진행상황 | ✓ |
| 17:00 | interim | 오늘 한 일 중간 보고 | ✓ |
| 21:00 | final | 오늘 한 일 최종 보고 | ✓ |

### 24시간 연속 개발 워커
- 엔진: `scripts/run-worker.ps1` — 멈춤 플래그 전까지 **연속 루프**. 1 iteration = `claude -p`가 work.md로 백로그 1개 구현+검증(tsc/build), `reports/<date>/worklog.md`에 append. iteration 사이 8초.
- 단일 인스턴스: `state/worker.lock`(PID)로 중복 방지. 자정 넘어가면 날짜·worklog 자동 롤오버.
- 가동: 매일 08:00 `scripts/ensure-worker.ps1`(없으면 시작, 있으면 유지) / **중지**: `scripts/stop-worker.ps1`(현재 iteration 후 종료) → `state/worker-stop.flag`
- 워커는 **로컬 코드 수정·검증만**(배포·푸시·외부 발행 금지). 보고 4회는 워커의 worklog를 읽어 보고.

### 공통
- 실행: `scripts/run-report.ps1 -Mode <mode>` (프롬프트: `scripts/report-prompts/<mode>.md`)
- 등록: `scripts/register-tasks.ps1` (작업 7개=08 work-start + 6 보고, 대표님 직접 1회 실행 — 무인 bypass 루프라 자동승인 차단됨) / 해제: `unregister-tasks.ps1`
- 상태 파일: `state/today-plan.md`(09시→점검 기준), `state/morning-feedback.md`(06시→09시 입력), `reports/<date>/worklog.md`(워커·보고 공용 진행 누적)
- 구 단일 사이클 `scripts/run-daily.ps1`(daily-cycle.mjs)은 수동/대규모 구현 사이클용으로 유지.

## Notion 미러링
- 상위 페이지: **"Trust series"** — https://app.notion.com/p/3858d177882f81b5b976f7710db04816
- 일일 보고: 하위 "운영 보고(Daily)" (id `3858d177-882f-8130-b4d0-f3e7d116d2a7`)에 누적
- 제품 로드맵: id `3858d177-882f-8117-95f9-db33d4b4c5f1`
- 의사결정 로그: id `3858d177-882f-81b2-876b-c65290d2dd27`

## 경로
- ROOT: `d:\Claude_Cowork\trust\trust-corp`
- 제품: `d:\Claude_Cowork\trust\trust-saas`, `d:\Claude_Cowork\trust\trust-automatic`

## 조직 (13 페르소나)
- C0 CEO
- T1 기획팀 (팀장+과장)
- T2 개발팀 (팀장+차장+과장+대리 = 4인)
- T3 디자인팀 (팀장+과장)
- T4 마케팅팀 (팀장+과장)
- T5 사업팀/신탁 전문 (팀장+과장)

## 이벤트 즉시보고(critical) 트리거
빌드/배포 실패, 조문 정확성 결함(법적 리스크), 보안/데이터 유출 위험, 결제·매출 급변, 규제·법령 개정
