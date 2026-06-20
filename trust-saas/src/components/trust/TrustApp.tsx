"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useContractStore } from "@/lib/store/contractStore";
import {
  DOCUMENT_TYPES,
  CATEGORIES,
  CATEGORY_LABEL,
  TRUST_COMPANIES,
} from "@/lib/engine/schema";
import type { Category } from "@/lib/engine/model";
import { saveContract, type ContractRow } from "@/lib/contractRepo";
import { Wizard } from "./Wizard";
import { ChatPanel } from "./ChatPanel";
import { ContractsView } from "./ContractsView";

type View = "company" | "home" | "category" | "wizard" | "contracts";

const ACTIVE_COMPANY =
  TRUST_COMPANIES.find((c) => c.ready)?.name || "한국투자부동산신탁";

export function TrustApp() {
  const [view, setView] = useState<View>("company");
  const [company, setCompany] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const store = useContractStore();
  const {
    docTypeId,
    category,
    setDocType,
    setCategory,
    setTab,
    setStep,
    reset,
    loadContract,
  } = store;

  const docType = DOCUMENT_TYPES.find((d) => d.id === docTypeId) || null;

  // 상담 코파일럿에서 넘어온 ?doc=ID → 신탁사 자동선택 후 단계 선택으로 진입
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const doc = params.get("doc");
    if (doc && DOCUMENT_TYPES.find((d) => d.id === doc && d.ready)) {
      setCompany(ACTIVE_COMPANY);
      setDocType(doc);
      setView("category");
      window.history.replaceState({}, "", "/app");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goHome() {
    reset();
    setCompany(null);
    setView("company");
  }
  function pickCompany(name: string) {
    setCompany(name);
    setView("home");
  }
  function pickDoc(id: string) {
    setDocType(id);
    setView("category");
  }
  function goBack() {
    if (view === "wizard") setView("category");
    else if (view === "category") setView("home");
    else if (view === "home") {
      setCompany(null);
      setView("company");
    } else if (view === "contracts") setView(company ? "home" : "company");
  }
  function pickCategory(c: Category) {
    setCategory(c);
    setTab(1);
    setStep(1);
    setView("wizard");
  }
  function openContract(row: ContractRow) {
    loadContract(row);
    setView("wizard");
  }

  return (
    <>
      <header className="topbar">
        <div className="brand" style={{ cursor: "pointer" }} title="홈으로" onClick={goHome}>
          <div className="brand-glyph">信託</div>
          <div>
            <div className="brand-name">TrustForm</div>
            <div className="brand-sub">트러스트폼 · 신탁 서류 자동화</div>
          </div>
        </div>
        <nav className="breadcrumb">
          <span className={"crumb" + (view === "company" ? " active" : "")} onClick={goHome}>
            신탁사 선택
          </span>
          {company && view !== "contracts" && (
            <>
              <span className="sep">›</span>
              <span
                className={"crumb" + (view === "home" ? " active" : "")}
                onClick={() => setView("home")}
              >
                {company}
              </span>
            </>
          )}
          {docType && (view === "category" || view === "wizard") && (
            <>
              <span className="sep">›</span>
              <span
                className={"crumb" + (view === "category" ? " active" : "")}
                onClick={() => setView("category")}
              >
                {docType.name}
              </span>
            </>
          )}
          {category && view === "wizard" && (
            <>
              <span className="sep">›</span>
              <span className="crumb active">{CATEGORY_LABEL[category]}</span>
            </>
          )}
          <span className="sep">·</span>
          <span className="crumb" onClick={() => setView("contracts")}>
            내 계약
          </span>
          <span className="sep">·</span>
          <Link href="/advisor" className="crumb" style={{ textDecoration: "none" }}>
            💬 상담 →
          </Link>
        </nav>
      </header>

      {view === "company" ? (
        <div className="back-bar">
          <Link href="/" className="back-btn" style={{ textDecoration: "none" }}>
            ‹ 이전 (홈)
          </Link>
        </div>
      ) : (
        <div className="back-bar">
          <button className="back-btn" onClick={goBack}>
            ‹ 이전
          </button>
        </div>
      )}

      {view === "company" && <CompanyPage onPick={pickCompany} />}
      {view === "home" && <HomePage company={company} onPick={pickDoc} />}
      {view === "category" && docType && <CategoryPage docName={docType.name} onPick={pickCategory} />}
      {view === "wizard" && docType && category && (
        <>
          <SaveBar />
          <Wizard docTypeId={docType.id} docName={docType.name} category={category} />
        </>
      )}
      {view === "contracts" && <ContractsView onOpen={openContract} />}

      {!chatOpen && (
        <button className="chat-fab" onClick={() => setChatOpen(true)} title="AI 어시스턴트">
          💬 AI 어시스턴트
        </button>
      )}
      {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
    </>
  );
}

function SaveBar() {
  const { form, docTypeId, category, title, setTitle, currentContractId, setCurrentContractId } =
    useContractStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const id = await saveContract({
        id: currentContractId ?? undefined,
        docType: docTypeId || "collateral",
        category: category,
        title: title || form.trustors[0]?.name || "제목 없음",
        formData: form,
      });
      setCurrentContractId(id);
      setMsg("✓ 저장됨");
    } catch (e) {
      setMsg("오류: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="save-bar">
      <input
        className="input"
        placeholder="계약 제목 (예: 여주 홍문 담보신탁)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ maxWidth: 320 }}
      />
      <button className="btn btn-ghost btn-sm" onClick={save} disabled={busy}>
        💾 저장
      </button>
      {msg && <span className="field-hint">{msg}</span>}
    </div>
  );
}

function CompanyPage({ onPick }: { onPick: (name: string) => void }) {
  return (
    <main className="page active">
      <div className="page-header">
        <div className="page-eyebrow">신탁사 선택</div>
        <h1 className="page-title">신탁사를 선택해 주세요</h1>
        <p className="page-desc">
          현재 <strong>한국투자부동산신탁</strong>이 활성화되어 있습니다. 나머지 신탁사는 표준양식
          수급 후 순차 오픈됩니다.
        </p>
      </div>
      <div className="company-grid">
        {TRUST_COMPANIES.map((c) => (
          <button
            key={c.id}
            className="doc-card"
            disabled={!c.ready}
            onClick={() => c.ready && onPick(c.name)}
          >
            <div className="doc-card-label">{c.ready ? "활성" : "준비중"}</div>
            <div className="doc-card-name">{c.name}</div>
            <div className="doc-card-foot">
              <span className={"badge " + (c.ready ? "ready" : "soon")}>
                {c.ready ? "사용 가능" : "준비중"}
              </span>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}

function HomePage({ company, onPick }: { company: string | null; onPick: (id: string) => void }) {
  return (
    <main className="page active">
      <div className="page-header">
        <div className="page-eyebrow">{company || "서류 자동화"}</div>
        <h1 className="page-title">작성할 서류를 선택해 주세요</h1>
        <p className="page-desc">
          토글 입력 또는 자연어 대화로 조건을 정리하면 표준 계약서가 Word·PDF로 자동 생성됩니다.
          현재 담보신탁·자금관리대리사무·공동사업표준협약서 활성화, 나머지는 표준양식 수급 후 순차
          오픈.
        </p>
      </div>
      <div className="doc-grid">
        {DOCUMENT_TYPES.map((d) => (
          <button
            key={d.id}
            className="doc-card"
            disabled={!d.ready}
            onClick={() => d.ready && onPick(d.id)}
          >
            <div className="doc-card-label">{d.ready ? "활성" : "준비중"}</div>
            <div className="doc-card-name">{d.name}</div>
            <div className="doc-card-foot">
              <span className={"badge " + (d.ready ? "ready" : "soon")}>
                {d.ready ? "사용 가능" : "표준양식 수급 후"}
              </span>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}

function CategoryPage({ docName, onPick }: { docName: string; onPick: (c: Category) => void }) {
  return (
    <main className="page active">
      <div className="page-header">
        <div className="page-eyebrow">{docName}</div>
        <h1 className="page-title">계약 단계 선택</h1>
        <p className="page-desc">
          계약 단계는 <strong>신규</strong>(체결) → <strong>진행</strong>(인허가 절차) →{" "}
          <strong>정산</strong>(해지) 3단계로 구분됩니다.
        </p>
      </div>
      <div className="cat-grid">
        {CATEGORIES.map((c) => (
          <button key={c.id} className="cat-card" disabled={!c.ready} onClick={() => c.ready && onPick(c.id)}>
            <div className="cat-card-label">{c.label}</div>
            <div className="cat-card-name">{c.name}</div>
            <div className="cat-card-desc">{c.desc}</div>
            <div className="cat-card-foot">
              <span className={"badge " + (c.ready ? "ready" : "soon")}>{c.ready ? "사용 가능" : "준비중"}</span>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}
