"use client";

/* ================================================================
   처분신탁 계약서 위저드 (C-2b) — 버튼 활성화 후 실제 계약서 생성 동선.
   담보 위저드(CollateralWizard, 7종 서류)와 달리 처분은 단일 서류(계약서)라
   탭형 입력(당사자·부동산·기본정보) + 계약서 미리보기/PDF 로 구성.
   입력은 담보와 동일한 ContractForm(공유 store)이라 StepParties/StepProperty/
   StepBasic 을 그대로 재사용한다. 렌더는 previewDisposalHTML/generateDisposalPDF
   (builders.js buildDisposalContractFullHTML — 5종 검증 본문 23조). 담보 무접촉.
   별첨4(신탁특약)는 MVP 단계로 "별도 협의" 표기(후속 verbatim 이식).
   ================================================================ */
import { useEffect, useMemo, useState } from "react";
import { useContractStore } from "@/lib/store/contractStore";
import { previewDisposalHTML, generateDisposalPDF, generateDisposalDoc } from "@/lib/engine/docx";
import { StepParties } from "./steps/StepParties";
import { StepProperty } from "./steps/StepProperty";
import { StepBasic } from "./steps/StepBasic";

type DTab = "parties" | "property" | "basic" | "doc";

// 입력 중 미리보기 재생성을 잠깐 미뤄 타이핑 끊김 방지(DocStep 과 동일 패턴).
function useDebounced<T>(value: T, ms: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return d;
}

export function DisposalWizard({ docName }: { docName: string }) {
  const { form } = useContractStore();
  const [tab, setTab] = useState<DTab>("parties");
  const [msg, setMsg] = useState("");
  const debounced = useDebounced(form, 250);
  const previewHtml = useMemo(() => {
    try {
      return previewDisposalHTML(debounced, "contract");
    } catch {
      return "";
    }
  }, [debounced]);

  // 최소 충족: 위탁자명 1 + 신탁부동산 1 (이 둘이 있어야 계약서가 의미를 가진다)
  const hasTrustor = form.trustors.some((t) => (t.name || "").trim());
  const hasProperty = form.properties.some((p) => (p.address || "").trim());
  const ready = hasTrustor && hasProperty;

  function onPdf() {
    if (!ready) {
      setMsg("위탁자명과 신탁부동산을 먼저 입력하세요.");
      return;
    }
    const opened = generateDisposalPDF(form, "contract");
    setMsg(
      opened
        ? "PDF 인쇄창을 열었습니다 — 인쇄 대화상자에서 '대상 → PDF로 저장'을 선택하세요."
        : "PDF 창을 열지 못했습니다 — 브라우저 팝업 차단을 해제한 뒤 다시 시도하세요.",
    );
  }
  async function onDocx() {
    if (!ready) {
      setMsg("위탁자명과 신탁부동산을 먼저 입력하세요.");
      return;
    }
    setMsg("Word 파일 생성 중…");
    try {
      await generateDisposalDoc(form, "contract");
      setMsg("✓ Word(.docx) 생성 완료 — 다운로드를 확인하세요.");
    } catch (e) {
      setMsg("오류: " + (e instanceof Error ? e.message : String(e)));
    }
  }
  function onBig() {
    const w = window.open("", "_blank", "width=1040,height=1000");
    if (!w) {
      setMsg("새 창을 열 수 없습니다 — 브라우저 팝업 차단을 해제한 뒤 다시 시도하세요.");
      return;
    }
    w.document.open();
    w.document.write(previewDisposalHTML(form, "contract"));
    w.document.close();
  }

  const TABS: [DTab, string][] = [
    ["parties", "① 당사자"],
    ["property", "② 신탁부동산"],
    ["basic", "③ 기본정보"],
    ["doc", "④ 계약서"],
  ];

  return (
    <main className="page active">
      <div className="page-header">
        <div className="page-eyebrow">{docName}</div>
        <h1 className="page-title">부동산처분신탁계약</h1>
        <p className="page-desc">
          ① 위탁자·수익자 → ② 신탁부동산 → ③ 기본정보(계약체결일) 입력 후{" "}
          <strong>처분신탁계약서</strong>를 미리보고 PDF로 생성합니다. (본문 제1~23조 표준 ·
          별첨4 신탁특약은 별도 협의로 첨부)
        </p>
      </div>

      <div className="tabs">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            className={"tab" + (tab === k ? " active" : "")}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="form-panel">
        {tab === "parties" && <StepParties />}
        {tab === "property" && <StepProperty />}
        {tab === "basic" && <StepBasic />}
        {tab === "doc" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <button className="btn btn-accent" onClick={onDocx} disabled={!ready}>
                Word(.docx) 생성
              </button>
              <button className="btn btn-accent" onClick={onPdf} disabled={!ready}>
                PDF 생성
              </button>
              <button className="btn btn-ghost" onClick={onBig}>
                크게 보기
              </button>
            </div>
            {!ready && (
              <p className="field-hint" style={{ color: "var(--c-danger)" }}>
                ① 당사자 탭의 위탁자명과 ② 신탁부동산을 입력하면 계약서가 완성됩니다.
              </p>
            )}
            {msg && (
              <p className="field-hint" role="status" aria-live="polite">
                {msg}
              </p>
            )}
            <iframe
              title="처분신탁계약서 미리보기"
              srcDoc={previewHtml}
              style={{
                width: "100%",
                height: "70vh",
                border: "1px solid var(--c-border, #ddd)",
                borderRadius: 8,
                background: "#fff",
                marginTop: 4,
              }}
            />
          </div>
        )}
      </section>
    </main>
  );
}
