"use client";

import { useMemo, useState } from "react";
import { useContractStore } from "@/lib/store/contractStore";
import { STEPS, TAB_LABELS } from "@/lib/engine/schema";
import { validateDoc, type Missing } from "@/lib/engine/validate";
import { generateCollateralDoc } from "@/lib/engine/docx";
import type { Category, DocId } from "@/lib/engine/model";
import { StepParties, StepPriority } from "./steps/StepParties";
import { StepLoanCalc } from "./steps/StepLoanCalc";
import { StepProperty } from "./steps/StepProperty";
import { StepBasic } from "./steps/StepBasic";
import { StepConditions } from "./steps/StepConditions";
import { DocStep } from "./steps/DocStep";
import { JointForm } from "./JointForm";

interface Props {
  docTypeId: string;
  docName: string;
  category: Category;
}

export function Wizard({ docTypeId, docName, category }: Props) {
  // joint 은 전용 폼
  if (docTypeId === "joint") return <JointForm />;
  if (docTypeId === "fund") return <FundPlaceholder docName={docName} />;
  return <CollateralWizard docName={docName} category={category} />;
}

function FundPlaceholder({ docName }: { docName: string }) {
  return (
    <main className="page active">
      <div className="page-header">
        <div className="page-eyebrow">{docName}</div>
        <h1 className="page-title">자금관리대리사무</h1>
        <p className="page-desc">
          본 양식은 이식 예정입니다. 현재 담보신탁·공동사업표준협약서가 활성화되어 있습니다.
        </p>
      </div>
    </main>
  );
}

function CollateralWizard({ docName, category }: { docName: string; category: Category }) {
  const { form, tab, step, setTab, setStep } = useContractStore();

  const current = STEPS.find((s) => s.idx === step) || STEPS[0];
  const tabSteps = STEPS.filter((s) => s.tab === tab);
  const totalSteps = STEPS.length;

  // ── 서류별 생성 가능 여부 + 계약 전체 "남은 필수 입력"(중복 제거) — 한 번의 검증 패스로 산출.
  //    docReady: 각 서류 step의 생성 가능 여부(네비 ✓/⚠ 마커). 각 서류 step에 들어가지 않고도
  //      어떤 서류가 필수 입력 누락으로 막혔는지 위저드 네비에서 한눈에 표시.
  //    missingList: 7종 서류에 걸쳐 누락된 필수 입력을 label 기준 중복 제거해 한 곳에 모은 목록.
  //      공통 누락(위탁자·우선수익자·대출금액·물건·체결일 등)은 7종 모두의 missing에 반복 등장하므로
  //      1회만 담는다. 헤더의 firstBlocked(단일 서류 이동)·각 DocStep 검증박스(그 서류 한정)와 달리
  //      "계약 전체에 남은 입력 전부"를 한 곳에서 보여주고 항목별로 바로 점프한다. (조문·엔진 무손상)
  const { docReady, missingList } = useMemo(() => {
    const map: Record<number, boolean> = {};
    const seen = new Set<string>();
    const list: Missing[] = [];
    for (const s of STEPS) {
      if (!s.docId) continue;
      const { ok, missing } = validateDoc(form, s.docId);
      map[s.idx] = ok;
      for (const mi of missing) {
        if (seen.has(mi.label)) continue;
        seen.add(mi.label);
        list.push(mi);
      }
    }
    return { docReady: map, missingList: list };
  }, [form]);

  // ── 서류 생성 준비 현황 요약(✓ N/7) — 7종 서류 중 몇 종이 생성 가능한지 한눈에.
  //    데스크톱 stepper(<980px 숨김)와 무관하게 항상 노출 → 모바일에서도 진행도 파악.
  //    (docReady 재집계일 뿐 조문·엔진·검증 판정 무손상)
  const docSteps = useMemo(() => STEPS.filter((s) => s.docId), []);
  const readyCount = docSteps.reduce((n, s) => n + (docReady[s.idx] ? 1 : 0), 0);
  const totalDocs = docSteps.length;
  const firstBlocked = docSteps.find((s) => !docReady[s.idx]);

  function goStep(idx: number) {
    const s = STEPS.find((x) => x.idx === idx);
    if (!s) return;
    setStep(idx);
    setTab(s.tab);
  }

  // ── 준비된 서류 일괄 생성(.docx) — 필수 입력을 충족한 서류만 한 번에 내려받기.
  //    각 서류 step을 일일이 열어 7번 생성 클릭하던 수고를 제거(랜딩 카피 "입력 한 번으로 일괄 생성"과 일치).
  //    검증 게이트(docReady=validateDoc.ok)를 통과한 서류만 대상 → 누락 서류는 절대 생성하지 않음(정확성 보존).
  //    조문·엔진·생성 로직(generateCollateralDoc) 무손상 — 기존 단건 생성기를 ready 집합에 순차 호출할 뿐.
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchMsg, setBatchMsg] = useState("");

  async function generateAllReady() {
    if (batchBusy) return;
    const ready = docSteps.filter((s) => docReady[s.idx]);
    if (!ready.length) return;
    setBatchBusy(true);
    try {
      for (let i = 0; i < ready.length; i++) {
        const id = ready[i].docId as DocId;
        setBatchMsg(`서류 생성 중… (${i + 1}/${ready.length}) ${ready[i].title}`);
        await generateCollateralDoc(form, id);
        // 브라우저가 연속 다운로드를 차단하지 않도록 사이에 짧은 간격을 둔다.
        if (i < ready.length - 1) await new Promise((r) => setTimeout(r, 350));
      }
      setBatchMsg(`✓ 준비된 ${ready.length}종 Word(.docx) 생성 완료 — 다운로드를 확인하세요.`);
    } catch (e) {
      setBatchMsg("오류: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBatchBusy(false);
    }
  }

  return (
    <main className="page active">
      <div className="page-header">
        <div className="page-eyebrow">{docName}</div>
        <h1 className="page-title">담보신탁계약</h1>
        <p className="page-desc">
          ① 관계사 정보 → ② <strong>계약 조건·특약(경우의 수)</strong> 선택 → ③ 7종 서류 Word·PDF 생성.
          담보물 유형·우선수익자 구조·정족수·대리금융기관·인허가 등 계약서마다 달라지는 항목은
          <strong> STEP 05</strong>에서 한 번에 선택합니다. (단계: {category === "new" ? "신규" : category})
        </p>
      </div>

      {/* 서류 생성 준비 현황 요약 — 7종 중 몇 종이 생성 가능한지 한눈에 (모바일 stepper 부재 보완) */}
      <div className="doc-progress" role="group" aria-label={`서류 생성 준비 현황: ${totalDocs}종 중 ${readyCount}종 생성 가능`}>
        <div className="doc-progress-meter" aria-hidden="true">
          <span
            className={"doc-progress-fill" + (readyCount === totalDocs ? " full" : "")}
            style={{ width: `${totalDocs ? (readyCount / totalDocs) * 100 : 0}%` }}
          />
        </div>
        <div className="doc-progress-text">
          <span className={"doc-progress-count" + (readyCount === totalDocs ? " ok" : "")}>
            {readyCount === totalDocs ? "✓ " : ""}서류 <strong>{readyCount}/{totalDocs}</strong> 생성 가능
          </span>
          {firstBlocked ? (
            <button
              className="doc-progress-jump"
              onClick={() => goStep(firstBlocked.idx)}
              title={`${firstBlocked.label} ${firstBlocked.title}(으)로 이동해 필수 입력 채우기`}
            >
              ⚠ {totalDocs - readyCount}종 입력 필요 — {firstBlocked.label}로 이동 ›
            </button>
          ) : (
            <span className="doc-progress-done">모든 서류 생성 준비 완료</span>
          )}
          {readyCount > 0 && (
            <button
              className="doc-progress-batch"
              onClick={generateAllReady}
              disabled={batchBusy}
              title={`필수 입력을 충족한 ${readyCount}종 서류를 한 번에 Word(.docx)로 내려받습니다`}
            >
              {batchBusy ? "⏳ 생성 중…" : `⬇ 준비된 ${readyCount}종 일괄 생성(.docx)`}
            </button>
          )}
        </div>
        {/* 남은 필수 입력 통합 체크리스트 — 계약 전체에서 아직 채워야 할 입력을 중복 없이 한 곳에.
            firstBlocked(첫 막힌 서류로 이동)는 한 서류만, 각 DocStep 검증박스는 그 서류 한정인 데 비해,
            여기서는 7종에 걸친 누락 입력 전부를 보고 항목별로 바로 점프한다(접어두어 헤더는 간결 유지). */}
        {missingList.length > 0 && (
          <details className="doc-progress-missing">
            <summary>
              남은 필수 입력 <strong>{missingList.length}</strong>건 — 펼쳐서 항목별로 바로 이동
            </summary>
            <ul className="doc-progress-missing-list">
              {missingList.map((mi) => (
                <li key={mi.label}>
                  <button
                    type="button"
                    className="validate-jump"
                    onClick={() => goStep(mi.stepIdx)}
                    title={`${mi.where}(으)로 이동해 입력`}
                  >
                    <strong>{mi.label}</strong>
                    <span className="validate-where"> — {mi.where} ›</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
        {batchMsg && (
          <div className="doc-progress-msg" role="status" aria-live="polite">
            {batchMsg}
          </div>
        )}
      </div>

      {/* 탭 */}
      <div className="tabs">
        {[1, 2, 3].map((t) => (
          <button
            key={t}
            className={"tab" + (tab === t ? " active" : "")}
            onClick={() => {
              const first = STEPS.find((s) => s.tab === t);
              if (first) goStep(first.idx);
            }}
          >
            <span className="tab-num">{t}</span>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* 서브스텝 pill */}
      <div className="sub-steps">
        {tabSteps.map((s) => {
          const ready = s.docId ? docReady[s.idx] : undefined;
          return (
            <button
              key={s.idx}
              className={"sub-step" + (s.idx === step ? " active" : "")}
              onClick={() => goStep(s.idx)}
              title={
                ready === undefined
                  ? undefined
                  : ready
                    ? "필수 입력 충족 — 생성 가능"
                    : "필수 입력 누락 — 입력 후 생성 가능"
              }
            >
              {s.label}
              {ready !== undefined && (
                <span
                  className={"sub-step-flag " + (ready ? "ok" : "warn")}
                  aria-label={ready ? "생성 가능" : "필수 입력 누락"}
                >
                  {ready ? "✓" : "⚠"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="wizard-layout">
        <aside className="stepper">
          <div className="stepper-title">진행 단계</div>
          <div>
            {STEPS.map((s) => {
              const ready = s.docId ? docReady[s.idx] : undefined;
              return (
                <button
                  key={s.idx}
                  type="button"
                  className={"stepper-item" + (s.idx === step ? " active" : "")}
                  onClick={() => goStep(s.idx)}
                  aria-current={s.idx === step ? "step" : undefined}
                  title={
                    ready === undefined
                      ? undefined
                      : ready
                        ? "필수 입력 충족 — 생성 가능"
                        : "필수 입력 누락 — 입력 후 생성 가능"
                  }
                >
                  <span className="stepper-num">{s.idx}</span>
                  <span>{s.title}</span>
                  {ready !== undefined && (
                    <span
                      className={"stepper-flag " + (ready ? "ok" : "warn")}
                      aria-label={ready ? "생성 가능" : "필수 입력 누락"}
                    >
                      {ready ? "✓" : "⚠"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="form-panel">
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{current.title}</h2>
          <p className="field-hint" style={{ marginBottom: 18 }}>
            {current.desc}
          </p>

          <StepContent stepKey={current.key} docId={current.docId} />

          <div className="pagenav">
            <button
              className="nav-circle"
              disabled={step <= 1}
              onClick={() => goStep(step - 1)}
              aria-label="이전 단계"
              title="이전 단계"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <div className="nav-label">
              <span>
                <strong>{step}</strong> / {totalSteps}
              </span>
              <span className="nav-name">{current.title}</span>
            </div>
            <button
              className="nav-circle"
              disabled={step >= totalSteps}
              onClick={() => goStep(step + 1)}
              aria-label="다음 단계"
              title="다음 단계"
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function StepContent({ stepKey, docId }: { stepKey: string; docId?: string }) {
  switch (stepKey) {
    case "parties":
      return <StepParties />;
    case "priority":
      return <StepPriority />;
    case "loanCalc":
      return <StepLoanCalc />;
    case "property":
      return <StepProperty />;
    case "basic":
      return <StepBasic />;
    case "conditions":
      return <StepConditions />;
    default:
      if (docId) return <DocStep docId={docId as never} />;
      return null;
  }
}
