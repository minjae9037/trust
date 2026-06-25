"use client";

/* ================================================================
   STEP 05 · 계약 조건·특약 (경우의 수)
   실제 한국투자부동산신탁 담보신탁계약서 7건 비교에서 도출한 분기 항목을
   한 화면에서 선택한다. 본문(제1~31조)은 고정, 차이는 별첨2/3/4에 집중.
   - [조문 자동반영] majorityCriteria·agentBank·includeArt21·builderName → annex.ts 별첨4
   - [프로파일 기록] 나머지 → 계약 프로파일·메모 컨텍스트 (조문 연동 예정)
   ================================================================ */
import { useContractStore } from "@/lib/store/contractStore";
import type { ContractForm } from "@/lib/engine/model";

type CC = ContractForm["docContents"]["contract"];

const COLLATERAL_TYPES: { v: NonNullable<CC["collateralType"]>; l: string }[] = [
  { v: "land", l: "토지담보" },
  { v: "apartment", l: "공동주택" },
  { v: "mixed", l: "주상복합" },
  { v: "officetel", l: "오피스텔" },
  { v: "logistics", l: "물류센터" },
  { v: "solar", l: "태양광 발전" },
  { v: "etc", l: "기타" },
];

const LICENSE_TYPES: { v: NonNullable<CC["licenseType"]>; l: string }[] = [
  { v: "building", l: "건축허가" },
  { v: "housing", l: "주택건설사업계획승인" },
  { v: "urban", l: "도시개발사업" },
  { v: "remodel", l: "대수선" },
  { v: "none", l: "해당 없음(순수 담보)" },
];

const MAJORITY: { v: NonNullable<CC["majorityCriteria"]>; l: string }[] = [
  { v: "half", l: "과반수 초과" },
  { v: "twothird", l: "3분의 2 초과 (표준)" },
  { v: "fourfifth", l: "5분의 4 초과" },
  { v: "unanimous", l: "우선수익자 전원 동의" },
];

function EngineBadge() {
  return (
    <span className="badge ready" style={{ marginLeft: 6, fontSize: 10 }} title="이 선택은 별첨4 신탁특약 조문에 자동 반영됩니다.">
      조문 자동반영
    </span>
  );
}
function ProfileBadge() {
  return (
    <span className="badge soon" style={{ marginLeft: 6, fontSize: 10 }} title="계약 프로파일·생성 컨텍스트로 기록됩니다. 표준양식 수급 시 해당 조문에 연동됩니다.">
      프로파일 기록
    </span>
  );
}

export function StepConditions() {
  const { form, updateDocContent } = useContractStore();
  const c = (form.docContents.contract || {}) as CC;
  const set = (patch: Partial<CC>) => updateDocContent("contract", patch as never);

  // 우선수익자 구조 — priorities 중 실제 이름이 있는 행 수로 단독/복수 판정
  const priorityCount = form.priorities.filter((p) => (p.name || "").trim()).length;
  const isMulti = priorityCount >= 2;

  // 입력 지점 교차검증(표시 전용·게이트 아님) — 대리금융기관(제20조) 지정을 켰는데(agentBankEnabled)
  // 회사명(agentBank)을 비워 두면, 별첨4 제20조 "대리금융기관의 선임" 조문의 {{AGENT_BANK}} 자리가
  // builders.js·annex.ts 에서 "[              ]"(빈 괄호) 로 치환돼 산출물 조문에 빈칸이 박힌다. 제20조는
  // 대리금융기관에게 "우선수익자로서의 일체의 권한"을 위임하는 조항이라(권한을 위임받는 주체가 공란이면
  // 조문 자체가 결함이 된다), 이 항목은 "조문 자동반영"(EngineBadge)으로 입력값이 그대로 별첨4 조문에
  // 흘러든다. 게이트(validateDoc)는 지정 여부만 보고 회사명 채움은 검사하지 않아(섹션 hint 도 "빈 값이면
  // 빈칸 출력" 명시), 지정만 켜고 이름을 비운 채 조용히 진행될 수 있었다. ubo "다름"인데 성명 빈칸·
  // 우선수익자 대출 있는데 채무자 빈칸 advisory 와 동형의 "활성 항목인데 식별 필드 빈칸 → 산출물 빈칸"
  // 완결성 갈래로, 기존 단독+지정(구조 불일치) advisory 와는 직교한다. 막지 않고(작성 중 임시 빈칸 등
  // 사용자 선택 보존) 입력 지점에서 부드럽게 되짚는다. agentBankEnabled·agentBank 파생이라 새 상태/모델/
  // 엔진/조문 무접촉. 한 글자라도 채우면(작성 완료 간주) 미표출.
  const agentBankNameMissing = !!c.agentBankEnabled && (c.agentBank || "").trim().length === 0;

  const collateralLabel = COLLATERAL_TYPES.find((t) => t.v === (c.collateralType || "land"))?.l;
  const licenseLabel = LICENSE_TYPES.find((t) => t.v === (c.licenseType || "building"))?.l;
  const majorityLabel = MAJORITY.find((m) => m.v === (c.majorityCriteria || "twothird"))?.l;

  return (
    <div className="cond-wrap" style={{ maxWidth: 760 }}>
      {/* ── 1. 담보물/사업 유형 ── */}
      <Section id="cond-collateralType" title="담보물 / 사업 유형" badge="profile"
        hint="별첨1 표시 양식과 인허가 특약 분기의 1차 축입니다. (예: 토지담보·공동주택·주상복합·물류·태양광)">
        <div className="field full">
          <select className="select" aria-labelledby="cond-collateralType" value={c.collateralType || "land"} onChange={(e) => set({ collateralType: e.target.value as CC["collateralType"] })}>
            {COLLATERAL_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>
      </Section>

      {/* ── 2. 우선수익자 구조 (자동 판정) ── */}
      <Section id="cond-priorityStruct" title="우선수익자 구조" badge="auto"
        hint="STEP 02에서 입력한 우선수익자 수로 자동 판정됩니다.">
        <div className="cond-readout" style={{ padding: "10px 12px", background: "var(--c-paper)", border: "1px solid var(--c-line)", borderRadius: "var(--r-md)", fontSize: 13.5 }}>
          {priorityCount === 0 ? (
            <span className="field-hint" style={{ color: "var(--c-danger)" }}>아직 우선수익자가 입력되지 않았습니다 (STEP 02).</span>
          ) : (
            <span>
              현재 <strong>{priorityCount}인</strong> → <strong>{isMulti ? "복수(대주단) 구조" : "단독 우선수익자"}</strong>
              {isMulti
                ? " — 처분 의사결정 정족수·대리금융기관 조항이 의미를 가집니다."
                : " — 단독이므로 정족수 조항은 사실상 적용되지 않습니다."}
            </span>
          )}
        </div>
      </Section>

      {/* ── 3. 처분 의사결정 정족수 (복수일 때) ── */}
      <Section id="cond-majorityCriteria" title="처분 의사결정 정족수 (제3조 제3항)" badge="engine"
        hint="개별 우선수익자의 공매 요청에 따른 공매실행(처분) 결정 기준. 대출약정에서 정한 값을 선택하세요.">
        <div className="field full">
          <select className="select" aria-labelledby="cond-majorityCriteria" value={c.majorityCriteria || "twothird"}
            disabled={!isMulti}
            onChange={(e) => set({ majorityCriteria: e.target.value as CC["majorityCriteria"] })}>
            {MAJORITY.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
          {!isMulti && <div className="field-hint">단독 우선수익자에서는 비활성화됩니다(전원=단독).</div>}
        </div>
      </Section>

      {/* ── 4. 대리금융기관 ── */}
      <Section id="cond-agentBank" title="대리금융기관 (제20조)" badge="engine"
        hint="다수 우선수익자(대주단)가 권한을 위임하는 대리금융기관. 단독이면 보통 미지정입니다.">
        <label className="inline-check" style={{ marginBottom: 8 }}>
          <input type="checkbox" checked={!!c.agentBankEnabled}
            onChange={(e) => set({ agentBankEnabled: e.target.checked, agentBank: e.target.checked ? c.agentBank : "" })} />
          <span><strong>대리금융기관 지정</strong></span>
        </label>
        {c.agentBankEnabled && (
          <div className="field full">
            <input className="input" placeholder="예) ○○신용협동조합 / 한국투자증권 주식회사"
              aria-label="대리금융기관 회사명"
              value={c.agentBank || ""} onChange={(e) => set({ agentBank: e.target.value })} />
            <div className="field-hint">입력한 회사명이 별첨4 제20조에 자동 기재됩니다(빈 값이면 빈칸 출력).</div>
            {/* 입력 지점 교차검증(표시 전용·게이트 아님) — 지정을 켰는데 회사명이 빈칸이면 별첨4
                제20조(대리금융기관의 선임) {{AGENT_BANK}} 자리가 "[              ]"로 출력돼 권한을
                위임받는 주체가 공란인 결함 조문이 된다. ubo 성명 빈칸·우선수익자 채무자 빈칸 advisory 와
                동형의 완결성 되짚음 — 막지 않고(사용자 선택 보존) 입력 직하에서 부드럽게 안내한다.
                동적 출현이라 role=status·aria-live=polite + 선두 ⚠ aria-hidden(접근명 오염 0), 색 =
                var(--c-brown)(검토 신호 — 차단 적색 아님), field-hint 재사용(새 CSS 0). */}
            {agentBankNameMissing && (
              <div className="field-hint" role="status" aria-live="polite" style={{ marginTop: 6, color: "var(--c-brown)", fontWeight: 600 }}>
                <span aria-hidden="true">⚠ </span>
                대리금융기관 지정을 켰는데 회사명이 비어 있습니다 — 별첨4 제20조(대리금융기관의 선임)에 회사명이 빈칸으로 출력됩니다. 대리금융기관명을 입력하거나 지정을 해제하세요.
              </div>
            )}
          </div>
        )}
        {/* 입력 지점 교차검증(표시 전용·게이트 아님) — 대리금융기관(제20조)은 STEP 02 우선수익자 수로
            자동 판정되는 구조가 복수(대주단)일 때 권한 위임을 위해 두는 조항인데(섹션 hint 와 동일 취지),
            단독 우선수익자인데도 지정이 켜져 있으면 그 회사명이 별첨4 제20조에 그대로 기재된다(흔한
            오설정). 정족수(제3조3항)는 단독에서 select 를 비활성화해 막지만, 대리금융기관 체크박스는
            그런 가드가 없어 단독+지정 조합이 조용히 조문에 흘러들던 갭. 막지 않고(사용자 선택 보존)
            입력 지점에서 부드럽게 되짚는다 — isMulti 는 priorityCount 파생이라 새 상태/모델/엔진 무접촉. */}
        {c.agentBankEnabled && !isMulti && (
          <div className="field-hint" role="status" aria-live="polite" style={{ color: "var(--c-brown)", fontWeight: 600 }}>
            <span aria-hidden="true">⚠ </span>
            단독 우선수익자인데 대리금융기관(제20조)이 지정되어 있습니다 — 대리금융기관은 통상 복수(대주단) 구조에서 권한을 위임하기 위해 둡니다. 단독이면 지정 해제를 검토하세요.
          </div>
        )}
      </Section>

      {/* ── 5. 인허가 / 건축주 권한 ── */}
      <Section id="cond-art21" title="인허가 업무 및 건축주의 권한 (제21조)" badge="engine"
        hint="인허가 진행 사업이면 포함, 순수 단순담보이면 제외합니다.">
        <label className="inline-check" style={{ marginBottom: 8 }}>
          <input type="checkbox" checked={c.includeArt21 !== false}
            onChange={(e) => set({ includeArt21: e.target.checked })} />
          <span><strong>제21조 인허가 조항 포함</strong></span>
        </label>
        {c.includeArt21 !== false && (
          <div className="field-grid">
            <div className="field full">
              <label className="field-label" htmlFor="cond-builderName">건축주(인허가) 명의 <EngineBadge /></label>
              <select id="cond-builderName" className="select" value={c.builderName || "truster"} onChange={(e) => set({ builderName: e.target.value as CC["builderName"] })}>
                <option value="truster">위탁자(시행사) 명의 (표준)</option>
                <option value="trustee">수탁자(신탁사) 명의</option>
              </select>
            </div>
            <div className="field full">
              <label className="field-label" htmlFor="cond-licenseType">인허가 유형 <ProfileBadge /></label>
              <select id="cond-licenseType" className="select" value={c.licenseType || "building"} onChange={(e) => set({ licenseType: e.target.value as CC["licenseType"] })}>
                {LICENSE_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
              <div className="field-hint">계약서별로 「건축허가」/「주택건설사업계획승인」/「도시개발사업」 등 명칭이 다릅니다.</div>
            </div>
          </div>
        )}
        {/* 입력 지점 교차검증(표시 전용·게이트 아님) — 제21조 인허가 조항을 포함(includeArt21!==false)했다는 것은
            이 섹션 hint 가 명시하듯 "인허가 진행 사업"을 의미하는데, 그 안에서 인허가 유형(licenseType)을
            "none"(=「해당 없음(순수 담보)」)으로 두면 "인허가 진행 사업인데 인허가가 해당 없음"이라는 구조적
            모순이 된다(섹션 hint "인허가 진행 사업이면 포함, 순수 단순담보이면 제외합니다." 와 어긋남). 대리금융기관·
            담보보수 단독 advisory 와 동형의 조건-의존 정합 갭 — 막지 않고(사용자 선택 보존) 입력 지점에서
            부드럽게 되짚는다. ★이미 includeArt21!==false 블록 안이라 추가 조건은 licenseType==="none" 뿐이고,
            기존 필드(includeArt21·licenseType) 파생이라 새 상태/모델/엔진 무접촉. */}
        {c.includeArt21 !== false && c.licenseType === "none" && (
          <div className="field-hint" role="status" aria-live="polite" style={{ marginTop: 4, color: "var(--c-brown)", fontWeight: 600 }}>
            <span aria-hidden="true">⚠ </span>
            제21조 인허가 조항을 포함했는데 인허가 유형이 &lsquo;해당 없음(순수 담보)&rsquo;으로 설정되어 있습니다 — 제21조는 통상 인허가 진행 사업일 때 둡니다. 인허가 진행 사업이면 유형을 선택하고, 순수 단순담보면 위 제21조 포함을 해제하는 것을 검토하세요.
          </div>
        )}
      </Section>

      {/* ── 6. 처분(공매) 방식 ── */}
      <Section id="cond-disposal" title="처분(공매) 방식" badge="profile"
        hint="공매 진행 방식과 수의계약 조건의 케이스별 차이입니다.">
        <label className="inline-check" style={{ marginBottom: 6 }}>
          <input type="checkbox" checked={c.onbid !== false} onChange={(e) => set({ onbid: e.target.checked })} />
          <span>온비드(한국자산관리공사 전자자산처분시스템) 공매 이용</span>
        </label>
        <label className="inline-check">
          <input type="checkbox" checked={c.privateSaleAppraisal6m !== false} onChange={(e) => set({ privateSaleAppraisal6m: e.target.checked })} />
          <span>수의계약 시 감정평가금액(6개월 이내) 이상 제한</span>
        </label>
      </Section>

      {/* ── 7. 보수 / 자금관리 ── */}
      <Section id="cond-fee" title="보수 · 자금관리" badge="profile"
        hint="담보보수 납부 주체와 자금관리계좌 특약 병행 여부.">
        <div className="field full">
          <div className="field-label" id="cond-feePayer">담보보수 납부 주체</div>
          <div role="radiogroup" aria-labelledby="cond-feePayer" style={{ display: "flex", gap: 14, marginTop: 6 }}>
            {(["truster", "priority"] as const).map((v) => (
              <label key={v} className="inline-check">
                <input type="radio" name="feePayer" checked={(c.feePayer || "truster") === v} onChange={() => set({ feePayer: v })} />
                {v === "truster" ? "위탁자" : "우선수익자(안분)"}
              </label>
            ))}
          </div>
        </div>
        {/* 입력 지점 교차검증(표시 전용·게이트 아님·프로파일 기록 항목) — 담보보수 납부 주체를
            "우선수익자(안분)"로 둔 경우, '안분'은 통상 복수 우선수익자 사이에서 보수를 비율대로
            나눌 때 의미를 가지는데, STEP 02 우선수익자가 단독(!isMulti)이면 안분 대상이 없다.
            대리금융기관(제20조) 단독 advisory 와 동형의 구조-의존 정합 되짚음 — 막지 않고(사용자
            선택 보존) 입력 지점에서 부드럽게 확인을 권유한다. isMulti 는 priorityCount 파생이라
            새 상태/모델/엔진 무접촉이고, feePayer 는 프로파일 기록 항목이라 조문·산출물 무관. */}
        {c.feePayer === "priority" && !isMulti && (
          <div className="field-hint" role="status" aria-live="polite" style={{ marginTop: 8, color: "var(--c-brown)", fontWeight: 600 }}>
            <span aria-hidden="true">⚠ </span>
            단독 우선수익자인데 담보보수 납부 주체가 &lsquo;우선수익자(안분)&rsquo;로 설정되어 있습니다 — &lsquo;안분&rsquo;은 통상 복수 우선수익자 사이에서 보수를 나눌 때 의미를 가집니다. 단독이면 안분 대상이 없으니 설정을 확인하세요.
          </div>
        )}
        <label className="inline-check" style={{ marginTop: 10 }}>
          <input type="checkbox" checked={!!c.fundMgmtAccount} onChange={(e) => set({ fundMgmtAccount: e.target.checked })} />
          <span>자금관리계좌(자금집행요청·별첨5) 특약 병행</span>
        </label>
      </Section>

      {/* ── 8. 담보 차수 ── */}
      <Section id="cond-collateralOrder" title="담보 차수" badge="profile"
        hint="추가담보(2·3차)는 선순위 잔존 전제·조사분석서 생략 등 차이가 있습니다.">
        <div role="radiogroup" aria-labelledby="cond-collateralOrder" style={{ display: "flex", gap: 14, marginTop: 2 }}>
          {(["new", "additional"] as const).map((v) => (
            <label key={v} className="inline-check">
              <input type="radio" name="collateralOrder" checked={(c.collateralOrder || "new") === v} onChange={() => set({ collateralOrder: v })} />
              {v === "new" ? "신규(1차) 담보" : "추가(2·3차) 담보"}
            </label>
          ))}
        </div>
        {/* 입력 지점 교차검증(표시 전용·게이트 아님) — 본 섹션 hint 가 명시하듯 "추가담보(2·3차)는
            …조사분석서 생략 등 차이가 있습니다"가 제품이 단언하는 도메인 사실이다(추정 아님). 그런데
            조사분석서 포함 여부(appform.researchReport)는 신청서(Doc 01) 단계에서 따로 설정돼, 차수를
            추가(2·3차)로 두고도 조사분석서가 '포함'으로 남아 신청서 표1 체크박스에 "■ 포함"이 박히는
            모순이 조용히 성립하던 갭. 대리금융기관(제20조)·담보보수 안분·제21조 인허가 유형 advisory 와
            동형의 조건-의존 정합으로, 막지 않고(사용자 선택 보존) 입력 지점에서 부드럽게 되짚는다.
            ★조건은 기존 필드(collateralOrder·appform.researchReport) 파생이라 새 상태/모델/엔진 무접촉이고,
            researchReport 는 신청서(appform) 산출물 키지만 본 advisory 는 표시일 뿐 builders·게이트 무관. */}
        {c.collateralOrder === "additional" && form.docContents.appform?.researchReport === "include" && (
          <div className="field-hint" role="status" aria-live="polite" style={{ marginTop: 10, color: "var(--c-brown)", fontWeight: 600 }}>
            <span aria-hidden="true">⚠ </span>
            추가(2·3차) 담보인데 신청서(Doc 01) 조사분석서가 &lsquo;포함&rsquo;으로 설정되어 있습니다 — 추가담보는 통상 선순위 담보 잔존을 전제로 조사분석서를 생략합니다. 새 조사분석서가 필요한지 확인하세요.
          </div>
        )}
      </Section>

      {/* ── 계약 프로파일 요약 ── */}
      <div className="panel-footnote" style={{ marginTop: 22 }}>
        <strong><span aria-hidden="true">📋 </span>계약 프로파일 요약</strong>
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
          <li>유형: <strong>{collateralLabel}</strong> · 인허가: {c.includeArt21 === false ? "미포함" : licenseLabel} · 차수: {c.collateralOrder === "additional" ? "추가담보" : "신규담보"}</li>
          <li>우선수익자: {priorityCount}인({isMulti ? "복수" : "단독"}) · 정족수: {isMulti ? majorityLabel : "단독"} · 대리금융기관: {c.agentBankEnabled ? (c.agentBank || "(이름 미입력)") : "미지정"}</li>
          <li>처분: {c.onbid !== false ? "온비드 공매" : "일반 공매"}{c.privateSaleAppraisal6m !== false ? " · 수의계약 6개월 감정제한" : ""} · 보수납부: {c.feePayer === "priority" ? "우선수익자" : "위탁자"}{c.fundMgmtAccount ? " · 자금관리계좌 병행" : ""}</li>
        </ul>
        <div className="field-hint" style={{ marginTop: 8 }}>
          <span className="badge ready" style={{ fontSize: 10 }}>조문 자동반영</span> 정족수·대리금융기관·인허가 포함·건축주 명의는 별첨4 조문에 즉시 반영됩니다.{" "}
          <span className="badge soon" style={{ fontSize: 10 }}>프로파일 기록</span> 나머지는 계약 프로파일로 기록되며, 회사 표준양식(.docx) 수급 시 해당 조문에 연동됩니다.
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, hint, badge, children }: {
  id: string; title: string; hint?: string; badge?: "engine" | "profile" | "auto"; children: React.ReactNode;
}) {
  return (
    <div className="cond-section" style={{ padding: "16px 0", borderBottom: "1px solid var(--c-line)" }}>
      <div className="field-label" id={id} style={{ fontSize: 15, fontWeight: 700 }}>
        {title}
        {badge === "engine" && <EngineBadge />}
        {badge === "profile" && <ProfileBadge />}
        {badge === "auto" && <span className="badge" style={{ marginLeft: 6, fontSize: 10 }}>자동 판정</span>}
      </div>
      {hint && <div className="field-hint" style={{ marginBottom: 10 }}>{hint}</div>}
      {children}
    </div>
  );
}
