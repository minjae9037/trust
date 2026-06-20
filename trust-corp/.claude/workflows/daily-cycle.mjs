export const meta = {
  name: 'trust-daily-cycle',
  description: '신탁 자동화 AI 경영조직 일일 사이클: 기획팀 미션분배 → 4팀(개발/디자인/마케팅/사업) 실행 → 취합 → CEO가 대표님께 보고',
  phases: [
    { title: '분배', detail: '기획팀(T1)이 대표님 의사결정+우선순위를 읽고 개발/디자인/마케팅/사업 미션 배정' },
    { title: '실행', detail: '개발(4인)·디자인·마케팅·사업 4팀이 역할대로 수행하고 보고서 작성' },
    { title: '취합', detail: '기획팀이 전 팀 결과를 취합 → planning-rollup' },
    { title: '보고', detail: 'CEO(C0)가 대표님용 ceo-brief 작성 + 중대 알림 식별' },
  ],
}

const ROOT = 'd:\\Claude_Cowork\\trust\\trust-corp'
let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (e) { A = {} } }
const DATE = (A && A.date) || 'UNDATED'
const REPORTS = `${ROOT}\\reports\\${DATE}`

const TEAMS = [
  { key: '02-engineering', name: '개발팀(팀장+차장+과장+대리 4인)' },
  { key: '03-design',      name: '디자인팀(팀장+과장)' },
  { key: '04-marketing',   name: '마케팅팀(팀장+과장)' },
  { key: '05-business',    name: '사업팀/신탁 전문(팀장+과장)' },
]

const ALERT = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      severity: { type: 'string', enum: ['info', 'high', 'critical'] },
      title: { type: 'string' },
      detail: { type: 'string' },
    },
    required: ['severity', 'title', 'detail'],
  },
}

const COMMON = `너는 신탁 업무 자동화 SaaS(trust-saas)를 만드는 엠제이인사이트 주식회사의 AI 임직원이다.
먼저 다음 기준 문서를 Read로 읽어라:
- ${ROOT}\\context\\company.md (회사·가드레일)
- ${ROOT}\\context\\product.md (제품·기술 현황)
원칙: 사실 기반(추정은 "추정" 표기), 신탁 서류 정확성 최우선(verbatim 조문만, 추정 조문 금지),
가드레일(변호사법 경계·PII 토큰화·임의 배포 금지) 준수, 실행지향(다음 액션·담당 명시). 호칭은 "대표님".
제품 코드: d:\\Claude_Cowork\\trust\\trust-saas (조문 원천: d:\\Claude_Cowork\\trust\\trust-automatic)
대상 날짜: ${DATE}. 보고서 폴더: ${REPORTS}`

// ── Phase 1: 분배 (기획팀) ─────────────────────────────────────
phase('분배')
const missionResult = await agent(`${COMMON}

너는 [기획팀(T1) — 팀장+과장]이다. 역할 정의를 Read로 읽어라: ${ROOT}\\org\\01-planning.md
그리고 다음을 읽어라:
- ${ROOT}\\decisions\\inbox.md (대표님 의사결정 — 최우선 반영)
- ${ROOT}\\state\\backlog.md (전사 백로그)
- ${ROOT}\\state\\kpi.md

할 일:
1. 대표님 의사결정과 백로그 우선순위를 근거로 오늘 회사 우선순위 1~3개를 정한다. (★1차 목표=계약서 자동화 서비스 구현)
2. 개발/디자인/마케팅/사업 각 팀에 오늘의 미션 1~2개씩을 구체적으로 배정한다. (측정가능·실행가능하게)
3. 너의 기획팀 보고서를 ${REPORTS}\\01-planning.md 에 작성한다(오늘 우선순위 + 팀별 배정 미션 + 로드맵 메모).

마지막에 각 팀 미션을 구조화해 반환하라.`, {
  label: '기획팀:미션배정', phase: '분배',
  schema: {
    type: 'object', additionalProperties: false,
    properties: {
      priorities: { type: 'array', items: { type: 'string' } },
      missions: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            team: { type: 'string', description: '팀 key (예: 02-engineering)' },
            tasks: { type: 'array', items: { type: 'string' } },
          },
          required: ['team', 'tasks'],
        },
      },
    },
    required: ['priorities', 'missions'],
  },
})

const missionFor = (key) => {
  const m = (missionResult && missionResult.missions || []).find(x => x.team === key)
  return m ? m.tasks.map((t, i) => `  ${i + 1}. ${t}`).join('\n') : '  (별도 배정 없음 — 역할 정의의 일일 책임을 수행)'
}
const prioText = (missionResult && missionResult.priorities || []).map((p, i) => `${i + 1}. ${p}`).join('\n')

// ── Phase 2: 실행 (4팀 병렬) ───────────────────────────────────
phase('실행')
const teamResults = await parallel(TEAMS.map((t) => () =>
  agent(`${COMMON}

너는 [${t.name}]이다. 역할 정의를 Read로 읽어라: ${ROOT}\\org\\${t.key}.md
${t.key === '02-engineering'
    ? '개발팀은 팀장+차장(엔진/백엔드)+과장(프론트)+대리(QA/통합) 4인이다. 작업을 4인 관점으로 병렬 분담해 처리하라.'
    : '이 팀은 팀장 1 + 과장 1, 2인이다. 팀장(방향·판단)과 과장(실행·세부) 두 관점을 모두 반영하라.'}

오늘의 회사 우선순위:
${prioText || '(기획팀 배정 참조)'}

기획팀이 너에게 배정한 오늘 미션:
${missionFor(t.key)}

할 일:
1. 역할 정의의 "일일 책임"과 위 미션을 수행한다. 필요하면 제품 폴더(d:\\Claude_Cowork\\trust\\trust-saas)나 조문 원천(trust-automatic), 도구를 조사해 사실을 확인한다.
2. 역할 정의에 명시된 보고서 형식대로 ${REPORTS}\\${t.key}.md 파일을 작성한다.
3. 중대 이벤트가 있으면 alerts로 보고한다(severity critical/high). 없으면 빈 배열.

보고서는 간결하고 실행지향적으로. 추정은 "추정"으로 표기. 코드 변경은 검증 후 보고로 제안(임의 배포 금지).`, {
    label: t.name, phase: '실행',
    schema: {
      type: 'object', additionalProperties: false,
      properties: {
        team: { type: 'string' },
        summary: { type: 'string', description: '팀 핵심 2~3줄' },
        nextActions: { type: 'array', items: { type: 'string' } },
        alerts: ALERT,
      },
      required: ['team', 'summary', 'nextActions', 'alerts'],
    },
  }).then(r => ({ ...(r || {}), _team: t }))
))

const ok = teamResults.filter(Boolean)
const allAlerts = ok.flatMap(r => (r.alerts || []).map(a => ({ ...a, team: r._team ? r._team.name : r.team })))
const summaries = ok.map(r => `### ${r._team ? r._team.name : r.team}\n${r.summary || '(보고 없음)'}`).join('\n\n')

// ── Phase 3: 취합 (기획팀) ─────────────────────────────────────
phase('취합')
await agent(`${COMMON}

너는 [기획팀(T1)]이다. 개발/디자인/마케팅/사업 전 팀의 오늘 보고서를 취합해 CEO에게 올릴 단일 보고를 만든다.
각 팀 보고서를 Read로 읽어라(${REPORTS} 폴더의 02~05 .md). 팀별 요약:

${summaries}

오늘 회사 우선순위:
${prioText}

할 일:
1. 전 팀 핵심을 통합하고, 부서 간 충돌/의존성을 조정한다(예: 사업팀 도메인 스펙 → 개발팀 구현 의존).
2. 계약서 자동화 로드맵 진척과 다음 단계를 정리한다.
3. CEO께 올릴 권고와 "대표님 결정 필요 후보"를 정리한다.
4. ${REPORTS}\\planning-rollup.md 파일을 역할 정의의 형식대로 작성한다.`, {
  label: '기획팀:취합', phase: '취합',
})

// ── Phase 4: CEO 보고 ─────────────────────────────────────────
phase('보고')
const briefResult = await agent(`${COMMON}

너는 [대표이사(CEO, C0)]이다. 역할 정의를 Read로 읽어라: ${ROOT}\\org\\00-ceo.md
기획팀의 취합 보고를 Read로 읽어라: ${REPORTS}\\planning-rollup.md

전 팀에서 올라온 alerts(중대 이벤트):
${JSON.stringify(allAlerts, null, 2)}

할 일:
1. 대표님이 1분 내 읽고 결정할 수 있도록 ${REPORTS}\\ceo-brief.md 를 역할 정의의 형식대로 작성한다.
   (한 줄 요약 / 오늘의 성과 / 리스크 / ★대표님 결정 필요[+CEO 추천안] / 내일 자동진행 / 지표 스냅샷)
2. critical 알림이 있으면 대표님께 즉시 보고가 필요하다고 표시한다.

마지막에 구조화해 반환하라.`, {
  label: 'CEO:대표님보고', phase: '보고',
  schema: {
    type: 'object', additionalProperties: false,
    properties: {
      oneLiner: { type: 'string' },
      topAchievements: { type: 'array', items: { type: 'string' } },
      decisionsNeeded: { type: 'array', items: { type: 'string' } },
      criticalAlerts: ALERT,
    },
    required: ['oneLiner', 'topAchievements', 'decisionsNeeded', 'criticalAlerts'],
  },
})

return {
  date: DATE,
  reportsDir: REPORTS,
  priorities: missionResult ? missionResult.priorities : [],
  brief: briefResult,
  allAlerts,
  criticalCount: allAlerts.filter(a => a.severity === 'critical').length,
}
