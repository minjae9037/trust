"use client";

import { useContractStore } from "@/lib/store/contractStore";
import { STEPS, TAB_LABELS } from "@/lib/engine/schema";
import type { Category } from "@/lib/engine/model";
import { StepParties, StepPriority } from "./steps/StepParties";
import { StepLoanCalc } from "./steps/StepLoanCalc";
import { StepProperty } from "./steps/StepProperty";
import { StepBasic } from "./steps/StepBasic";
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
  const { tab, step, setTab, setStep } = useContractStore();

  const current = STEPS.find((s) => s.idx === step) || STEPS[0];
  const tabSteps = STEPS.filter((s) => s.tab === tab);
  const totalSteps = STEPS.length;

  function goStep(idx: number) {
    const s = STEPS.find((x) => x.idx === idx);
    if (!s) return;
    setStep(idx);
    setTab(s.tab);
  }

  return (
    <main className="page active">
      <div className="page-header">
        <div className="page-eyebrow">{docName}</div>
        <h1 className="page-title">담보신탁계약</h1>
        <p className="page-desc">
          관계사 정보를 입력하고, 계약 조건을 정한 뒤, 마지막 단계에서 7종 서류를 Word·PDF로
          생성합니다. (단계: {category === "new" ? "신규" : category})
        </p>
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
        {tabSteps.map((s) => (
          <button
            key={s.idx}
            className={"sub-step" + (s.idx === step ? " active" : "")}
            onClick={() => goStep(s.idx)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="wizard-layout">
        <aside className="stepper">
          <div className="stepper-title">진행 단계</div>
          <div>
            {STEPS.map((s) => (
              <div
                key={s.idx}
                className={"stepper-item" + (s.idx === step ? " active" : "")}
                onClick={() => goStep(s.idx)}
                style={{ cursor: "pointer" }}
              >
                <span className="stepper-num">{s.idx}</span>
                <span>{s.title}</span>
              </div>
            ))}
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
            >
              ‹
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
            >
              ›
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
    default:
      if (docId) return <DocStep docId={docId as never} />;
      return null;
  }
}
