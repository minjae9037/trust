"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useContractStore, isFormDirty } from "@/lib/store/contractStore";
import {
  DOCUMENT_TYPES,
  CATEGORIES,
  CATEGORY_LABEL,
  TRUST_COMPANIES,
} from "@/lib/engine/schema";
import type { Category } from "@/lib/engine/model";
import {
  saveContract,
  subscribeContracts,
  contractCount,
  type ContractRow,
} from "@/lib/contractRepo";
import { loadDraft, saveDraft, clearDraft, type ContractDraft } from "@/lib/store/draftRepo";
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
  // AI 어시스턴트 다이얼로그를 닫으면 포커스를 트리거(chat-fab)로 되돌린다 — fab 은
  // 드로어 열림 시 언마운트되므로 복귀는 다이얼로그 밖(여기)에서 해야 한다(WCAG
  // 2.4.3 Focus Order). 다이얼로그 내부의 포커스 트랩·Esc·초기 포커스는 useDialog 담당.
  const fabRef = useRef<HTMLButtonElement>(null);
  const chatWasOpen = useRef(false);
  useEffect(() => {
    if (chatWasOpen.current && !chatOpen) fabRef.current?.focus();
    chatWasOpen.current = chatOpen;
  }, [chatOpen]);
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
    restoreDraft,
  } = store;

  // 새로고침·이탈 시 복원할 진행 중 서류 초안(draftRepo) — 마운트 후 클라이언트에서만
  // 1회 읽어 첫 화면(신탁사 선택)에 "이어서 작성하기" 진입점을 띄운다(SSR 스냅샷 null →
  // 하이드레이션 일치). 복원·이탈 확정 시 null 로 비운다. 표시·재개 전용.
  const [restorableDraft, setRestorableDraft] = useState<ContractDraft | null>(null);
  useEffect(() => {
    const d = loadDraft();
    if (d) setRestorableDraft(d);
  }, []);

  const docType = DOCUMENT_TYPES.find((d) => d.id === docTypeId) || null;

  // 저장된 계약 수 — 브레드크럼 "내 계약 N" 배지(돌아온 사용자가 저장된 작업이 있음을 한눈에).
  // 저장소 변경(저장·삭제·복원·가져오기)에 구독해 항상 최신을 유지한다(useSyncExternalStore).
  // SSR 스냅샷은 0(서버엔 localStorage 부재) → 하이드레이션 후 클라이언트 실제 수로 갱신.
  // 순수 표시 — 조문·엔진·산출물·검증 무접촉(이동 콜백·카운트만).
  const savedCount = useSyncExternalStore(subscribeContracts, contractCount, () => 0);

  // 진입 딥링크 처리(마운트 1회):
  //  ① 상담 코파일럿에서 넘어온 ?doc=ID → 신탁사 자동선택 후 단계 선택으로 진입.
  //  ② 홈 재개 진입점(HomeResumeEntry)에서 넘어온 ?view=contracts → 내 계약(저장 목록)으로 직행
  //     — 돌아온 사용자가 홈에서 한 번에 저장된 작업으로 가는 동선(브레드크럼 "내 계약" 클릭과
  //     동일 내비게이션 의미·표시/이동 전용). 둘 다 처리 후 주소창을 깨끗한 /app 으로 정리한다.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const doc = params.get("doc");
    if (doc && DOCUMENT_TYPES.find((d) => d.id === doc && d.ready)) {
      setCompany(ACTIVE_COMPANY);
      setDocType(doc);
      setView("category");
      window.history.replaceState({}, "", "/app");
      return;
    }
    if (params.get("view") === "contracts") {
      setView("contracts");
      window.history.replaceState({}, "", "/app");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 현재 열린 서류의 활성 폼(joint=jointForm, 그 외=form) — 미저장 변경 판정 단일 기준.
  const isJointOpen = store.docTypeId === "joint";
  const activeForm = isJointOpen ? store.jointForm : store.form;
  const draftDirty = !!docTypeId && isFormDirty(activeForm, store.savedHash, isJointOpen);

  // 진행 중(미저장) 서류 초안 자동 영속 — 새로고침·이탈 시 복원. dirty(작성 중·미저장)면
  // 현재 store 스냅샷을 저장한다. 비움은 **명시 저장된 경우에만**(저장 직후 markSaved 로
  // savedHash 가 채워져 not dirty 가 된 상태) — 저장본은 contractRepo 가 보관하므로 별도
  // 초안이 불필요하다. ★서류 미선택(docTypeId null·초기/빈 양식)에는 아무 것도 하지 않는다
  // — 마운트 직후 빈 상태가 복원 대상 초안을 덮어쓰지 않게(restorableDraft 적재 보호).
  // ★★savedHash===null 인 not-dirty(=손대지 않은 빈 양식)에도 비우지 않는다: 상담
  //   doc-action(?doc= 딥링크)이나 새 서류 선택이 docTypeId 만 설정해 **빈 양식인데
  //   docTypeId 만 채워진** 찰나가 생기는데, 종전엔 그 not-dirty 가 무조건 else→clearDraft
  //   로 빠져 *이전에 저장돼 있던 다른 초안을 사용자가 아무 것도 입력하기 전에 조용히
  //   삭제*했다(상담→서류 동선에서 진행 중 작업 유실). 저장 기준선이 있을 때만 비운다.
  //   best-effort·표시/재개 전용.
  useEffect(() => {
    if (!docTypeId) return; // 서류 미선택 = 저장/비움 대상 아님(저장된 초안 보존)
    if (draftDirty) {
      saveDraft({
        docTypeId,
        category,
        title: store.title,
        form: store.form,
        jointForm: store.jointForm,
        tab: store.tab,
        step: store.step,
      });
    } else if (store.savedHash !== null) {
      // not dirty + 저장 기준선 존재 = 방금 명시 저장됨 → 초안 비움(contractRepo 가 보관).
      // savedHash===null 인 not-dirty 는 "손대지 않은 빈 양식"이라 비우지 않는다(위 ★★).
      clearDraft();
    }
  }, [
    docTypeId,
    draftDirty,
    store.savedHash,
    category,
    store.title,
    store.form,
    store.jointForm,
    store.tab,
    store.step,
  ]);

  function goHome() {
    // 위저드에서 미저장 변경이 있으면 초기화(reset) 전 확인 — 데이터 유실 방지
    if (
      view === "wizard" &&
      isFormDirty(activeForm, store.savedHash, isJointOpen) &&
      !confirm("저장되지 않은 변경이 있습니다. 저장하지 않고 처음으로 돌아갈까요?")
    ) {
      return;
    }
    reset();
    // ★이탈 확정 = 사용자가 명시적으로 버린 작업 → 저장된 초안도 비운다(버린 뒤에도
    //   "이어서 작성" 으로 되살아나 혼란 주지 않게). 비움의 명시 경로(저장/복원과 동렬).
    clearDraft();
    setRestorableDraft(null);
    setCompany(null);
    setView("company");
  }

  // 진행 중이던 초안을 위저드로 복원(첫 화면 "이어서 작성하기"). store 를 미저장 상태로
  // 되살리고(restoreDraft) 위저드로 진입한다 — 초안에 단계(category)가 없으면(드문 경우)
  // 단계 선택으로 보낸다. 복원 후 진입점은 숨긴다(setRestorableDraft null).
  function resumeDraft() {
    const d = restorableDraft;
    if (!d) return;
    restoreDraft(d);
    setCompany(ACTIVE_COMPANY);
    setView(d.category ? "wizard" : "category");
    setRestorableDraft(null);
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
    // 위저드에 미저장 변경이 있는데 다른 계약을 열면 loadContract가 현재 폼을
    // 조용히 덮어쓴다(데이터 유실). 덮어쓰기 전 확인 — goHome과 동일 가드.
    if (
      isFormDirty(activeForm, store.savedHash, isJointOpen) &&
      !confirm("저장되지 않은 변경이 있습니다. 저장하지 않고 다른 계약을 열까요?")
    ) {
      return;
    }
    loadContract(row);
    setView("wizard");
  }

  return (
    <>
      <header className="topbar">
        {/* 브랜드 로고 = "홈으로(신탁사 선택)" 단축. 종전엔 <div onClick> 라 마우스
            전용(cursor:pointer·title)이고 키보드/AT 엔 비-상호작용 div 로 노출됐다
            (WCAG 4.1.2 Name·Role·Value / 키보드 동등성 갭). 내 계약 카드 본문
            (ContractsView .contract-card-open)이 받은 것과 동형으로 role="button"·
            tabIndex=0·aria-label·Enter/Space 키 핸들러를 부여해 키보드 동등성을 맞춘다.
            onClick(goHome)·title·cursor·내부 마크업 보존(시각 무변경, 포커스 시 기본
            포커스 링만 — WCAG 2.4.7 가시 포커스). goHome 의 미저장 변경 확인 가드는
            클릭·키보드 양쪽이 동일 함수를 호출하므로 그대로 공유된다. */}
        <div
          className="brand"
          style={{ cursor: "pointer" }}
          title="홈으로"
          role="button"
          tabIndex={0}
          aria-label="홈으로 — 신탁사 선택"
          onClick={goHome}
          onKeyDown={(e) => {
            // 로고 자체에 포커스가 있을 때 난 Enter/Space 만 처리(e.currentTarget 기준).
            // 내부 자식(brand-glyph 등)은 비-포커스라 사실상 버블이 없으나, 카드 패턴과
            // 동일하게 가드해 일관성을 둔다. Space 의 페이지 스크롤은 preventDefault 로 차단.
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              goHome();
            }
          }}
        >
          {/* 信託 = 브랜드 장식 글리프(순수 시각). 이 셸은 aria-label="홈으로 — 신탁사 선택"
              이라 접근명 자체는 이미 깨끗하나, browse/읽기 모드에서 한자 글리프가
              독립 콘텐츠로 낭독되지 않게 장식 컨벤션(aria-hidden)을 동일 적용. */}
          <div className="brand-glyph" aria-hidden="true">信託</div>
          <div>
            <div className="brand-name">TrustForm</div>
            <div className="brand-sub">트러스트폼 · 신탁 서류 자동화</div>
          </div>
        </div>
        <nav className="breadcrumb">
          <button
            type="button"
            className={"crumb" + (view === "company" ? " active" : "")}
            onClick={goHome}
            aria-current={view === "company" ? "page" : undefined}
          >
            신탁사 선택
          </button>
          {company && view !== "contracts" && (
            <>
              <span className="sep" aria-hidden="true">›</span>
              <button
                type="button"
                className={"crumb" + (view === "home" ? " active" : "")}
                onClick={() => setView("home")}
                aria-current={view === "home" ? "page" : undefined}
              >
                {company}
              </button>
            </>
          )}
          {docType && (view === "category" || view === "wizard") && (
            <>
              <span className="sep" aria-hidden="true">›</span>
              <button
                type="button"
                className={"crumb" + (view === "category" ? " active" : "")}
                onClick={() => setView("category")}
                aria-current={view === "category" ? "page" : undefined}
              >
                {docType.name}
              </button>
            </>
          )}
          {category && view === "wizard" && (
            <>
              <span className="sep" aria-hidden="true">›</span>
              <span className="crumb active" aria-current="page">{CATEGORY_LABEL[category]}</span>
            </>
          )}
          <span className="sep" aria-hidden="true">·</span>
          {/* 내 계약 = 저장된 작업 진입점. 이 뷰가 활성일 때 현재 위치를 표시한다
              (다른 crumb 들과 달리 종전엔 active/aria-current 가 없어 contracts 뷰에선
              브레드크럼에 현재 위치 표시가 전무했음 — WCAG 2.4.8 Location 일관성). 저장
              계약이 있으면 건수 배지를 덧붙여 돌아온 사용자가 작업이 있음을 한눈에 안다.
              시각 "(N)" 은 장식(aria-hidden), 의미는 sr-only ", 저장 N건" 으로 고지. */}
          <button
            type="button"
            className={"crumb" + (view === "contracts" ? " active" : "")}
            aria-current={view === "contracts" ? "page" : undefined}
            onClick={() => setView("contracts")}
          >
            내 계약
            {savedCount > 0 && (
              <>
                <span aria-hidden="true"> ({savedCount})</span>
                <span className="sr-only">, 저장 {savedCount}건</span>
              </>
            )}
          </button>
          <span className="sep" aria-hidden="true">·</span>
          {/* 서류↔상담 왕복 복귀 — ?resume=1 로 보내 상담 화면이 직전 대화를 즉시 복원하게 한다
              (doc-action 으로 상담→서류 갔다가 이어가는 동선의 마지막 끊김 마감). 저장본이 없으면
              상담 화면에서 무동작(빈 상태)이라 후방호환. 표시·내비게이션 전용. */}
          <Link href="/advisor?resume=1" className="crumb" style={{ textDecoration: "none" }}>
            <span aria-hidden="true">💬 </span>상담<span aria-hidden="true"> →</span>
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

      {view === "company" && (
        <CompanyPage
          onPick={pickCompany}
          // 돌아온 사용자의 "이어서 작업하기" 진입점 — 첫 화면(신탁사 선택)에서 저장된
          // 계약이 있으면 바로 내 계약으로. 빈 화면 "새 계약 작성하기" CTA(start)의 대칭(resume).
          savedCount={savedCount}
          onResume={() => setView("contracts")}
          // 작성 중이던(미저장) 서류 초안이 있으면 "이어서 작성하기" — 끊긴 작성을 그 자리로
          // 복원한다(저장된 계약 재개와 별개 신호: 진행 중 미저장 초안).
          draft={restorableDraft}
          onResumeDraft={resumeDraft}
        />
      )}
      {view === "home" && <HomePage company={company} onPick={pickDoc} />}
      {view === "category" && docType && <CategoryPage docName={docType.name} onPick={pickCategory} />}
      {view === "wizard" && docType && category && (
        <>
          <SaveBar />
          <Wizard docTypeId={docType.id} docName={docType.name} category={category} />
        </>
      )}
      {view === "contracts" && (
        <ContractsView
          onOpen={openContract}
          // 계약 0건 빈 화면의 "새 계약 작성하기" CTA — goBack 의 contracts 분기와 동일 의미로
          // 신탁사가 정해졌으면 서류 선택(home), 아니면 신탁사 선택(company)으로 보낸다.
          onStart={() => setView(company ? "home" : "company")}
        />
      )}

      {!chatOpen && (
        <button
          ref={fabRef}
          type="button"
          className="chat-fab"
          onClick={() => setChatOpen(true)}
          title="AI 어시스턴트"
        >
          <span aria-hidden="true">💬 </span>AI 어시스턴트
        </button>
      )}
      {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
    </>
  );
}

function SaveBar() {
  const {
    form,
    jointForm,
    docTypeId,
    category,
    title,
    setTitle,
    currentContractId,
    setCurrentContractId,
    savedHash,
    markSaved,
  } = useContractStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // 공동사업표준협약서(joint)는 입력 모델이 jointForm 으로 분리돼 있다 — 저장·미저장
  // 판정 모두 현재 열린 서류의 활성 폼을 대상으로 해야 joint 입력이 유실되지 않는다.
  const isJoint = docTypeId === "joint";
  const activeForm = isJoint ? jointForm : form;

  // 미저장 변경 여부 — 저장 기준선(savedHash)과 현재 활성 폼 비교
  const dirty = isFormDirty(activeForm, savedHash, isJoint);

  // 미저장 변경이 있을 때 탭 닫기/새로고침 시 이탈 경고(데이터 유실 방지)
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const id = await saveContract({
        id: currentContractId ?? undefined,
        docType: docTypeId || "collateral",
        category: category,
        title: title || (isJoint ? jointForm.gap.name : form.trustors[0]?.name) || "제목 없음",
        formData: activeForm,
      });
      setCurrentContractId(id);
      markSaved(); // 현재 form을 저장됨 기준선으로 기록 → dirty=false
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
        aria-label="계약 제목"
        placeholder="계약 제목 (예: 여주 홍문 담보신탁)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ maxWidth: 320 }}
      />
      <button
        className={"btn btn-sm " + (dirty ? "btn-primary" : "btn-ghost")}
        onClick={save}
        disabled={busy}
      >
        <span aria-hidden="true">💾 </span>저장
      </button>
      {/* 저장 상태 표시: 변경됨(미저장) ↔ 저장됨 */}
      {dirty ? (
        <span className="field-hint" style={{ color: "var(--c-danger)" }}>
          <span aria-hidden="true">● </span>저장되지 않은 변경
        </span>
      ) : (
        currentContractId && (
          <span className="field-hint" style={{ color: "var(--c-blue-deep)" }}>
            <span aria-hidden="true">✓ </span>저장됨
          </span>
        )
      )}
      {msg && msg.startsWith("오류") && <span className="field-hint" style={{ color: "var(--c-danger)" }}>{msg}</span>}
    </div>
  );
}

function CompanyPage({
  onPick,
  savedCount,
  onResume,
  draft,
  onResumeDraft,
}: {
  onPick: (name: string) => void;
  savedCount: number;
  onResume?: () => void;
  draft?: ContractDraft | null;
  onResumeDraft?: () => void;
}) {
  // 작성 중이던 서류 이름(있으면) — 초안 docTypeId 로 표시. 미발견 시 "서류"로 폴백.
  const draftDocName = draft
    ? DOCUMENT_TYPES.find((d) => d.id === draft.docTypeId)?.name || "서류"
    : null;
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
      {/* 작성 중이던(미저장) 서류 초안 "이어서 작성하기" — 새로고침·이탈로 끊긴 위저드
          입력을 그 자리로 복원. 저장된 계약 재개(아래)와 별개 신호(진행 중 미저장 초안)라
          그보다 위에 둔다. onResumeDraft 미전달·초안 부재면 미렌더(후방호환). 시각 "→"
          글리프는 aria-hidden. 표시·재개 전용 — 조문·엔진·검증·산출물 무접촉, 새 CSS 0. */}
      {onResumeDraft && draft && (
        <div
          role="region"
          aria-label="작성 중이던 서류 이어서 작성하기"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <span className="field-hint">
            작성 중이던 <strong>{draftDocName}</strong> 서류가 있습니다.
          </span>
          <button className="btn btn-primary btn-sm" onClick={onResumeDraft}>
            이어서 작성하기<span aria-hidden="true"> →</span>
          </button>
        </div>
      )}
      {/* 돌아온 사용자 "이어서 작업하기" — 첫 화면(신탁사 선택)에서 저장된 계약이 있으면
          바로 내 계약으로 진입. 빈 화면 "새 계약 작성하기" CTA(start)의 대칭(resume) —
          종전엔 이 화면에서 저장 작업 신호가 상단 브레드크럼 "내 계약 (N)" 배지뿐이라
          돌아온 사용자가 매번 신탁사부터 다시 골라야 했다. onResume 미전달·저장 0건이면
          미렌더(후방호환). 시각 "→" 글리프는 aria-hidden(접근명 오염 0). 표시·내비게이션
          전용 — 조문·엔진·검증·산출물 무접촉, 새 CSS 0(기존 field-hint/btn-primary+인라인). */}
      {onResume && savedCount > 0 && (
        <div
          role="region"
          aria-label="저장된 작업 이어서 하기"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <span className="field-hint">
            저장된 계약 <strong>{savedCount}건</strong>이 있습니다.
          </span>
          <button className="btn btn-primary btn-sm" onClick={onResume}>
            이어서 작업하기<span aria-hidden="true"> →</span>
          </button>
        </div>
      )}
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
