"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  listContracts,
  deleteContract,
  restoreContract,
  duplicateContract,
  renameContract,
  exportContracts,
  importContracts,
  contractIdentity,
  enqueueUndo,
  dequeueUndo,
  type ContractRow,
} from "@/lib/contractRepo";
import { DOCUMENT_TYPES, CATEGORY_LABEL, COLLATERAL_OUTPUT_DOCS } from "@/lib/engine/schema";
import { validateDoc, validateJoint } from "@/lib/engine/validate";
import { generateCollateralDoc, generateJointDoc } from "@/lib/engine/docx";
import type { Category, ContractForm, DocId, JointForm } from "@/lib/engine/model";
import { splitStatusGlyph } from "@/lib/ui/status-glyph";

/**
 * 계약별 서류 생성 준비도 — 담보신탁(collateral)만 7종 산출 서류가 정의돼 있어
 * `validateDoc`(검증 게이트와 동일 로직)을 재사용해 "몇 종 생성 가능"한지 집계한다.
 * 다른 서류종은 산출 서류 정의가 달라 집계 대상이 아니다(null 반환 → 칩 미표시).
 * 구버전/손상 저장본(form_data 일부 누락)은 try/catch로 격리(목록 렌더 크래시 방지).
 * ※ 조문·엔진 무접촉 — 기존 검증 결과를 목록 수준에서 보여줄 뿐이다.
 */
/**
 * 동적 상태 메시지(role=status·aria-live) — 맨 앞 장식 글리프(✓ 등)를 aria-hidden
 * 으로 분리해 렌더한다. 라이브 영역 갱신 시 SR 이 글리프("check mark")를 먼저
 * 낭독하지 않게 하고 의미 본문만 낭독되게 한다(시각 표시는 글리프+공백 동일).
 */
function StatusGlyphText({ msg }: { msg: string }) {
  const { glyph, text } = splitStatusGlyph(msg);
  return (
    <>
      {glyph && <span aria-hidden="true">{glyph} </span>}
      {text}
    </>
  );
}
/**
 * 생성 가능한(검증 통과) 서류 id 목록 — 준비도 칩과 목록-일괄생성의 **단일 출처**.
 * 칩의 "N종 생성 가능"과 일괄 생성 대상이 정의상 100% 일치하도록 한 곳에서 산출한다.
 * (Wizard 헤더의 generateAllReady 와 동일한 검증 게이트 = validateDoc(form, docId).ok)
 */
function readyDocIds(row: ContractRow): DocId[] | null {
  if (row.doc_type !== "collateral") return null;
  // doc_type==="collateral" 가드로 form_data 는 ContractForm 임이 보장된다(joint 는 위에서 차단).
  const form = row.form_data as ContractForm;
  try {
    return COLLATERAL_OUTPUT_DOCS.filter((d) => validateDoc(form, d.id).ok).map(
      (d) => d.id,
    );
  } catch {
    return null;
  }
}

function docReadiness(row: ContractRow): { ready: number; total: number } | null {
  const ids = readyDocIds(row);
  if (ids === null) return null;
  return { ready: ids.length, total: COLLATERAL_OUTPUT_DOCS.length };
}

/**
 * 공동사업표준협약서(joint) 계약의 생성 준비도 — 협약서는 단일 산출물이라 collateral
 * 의 "N/7" 대신 boolean(생성 가능 여부)이다. 검증 게이트와 동일한 `validateJoint(form).ok`
 * 를 재사용해 목록에서 열지 않고도 "협약서 생성 가능 / 필수 입력 누락"을 보여 준다
 * (collateral 준비도 칩의 joint 패리티 — 그간 joint 계약은 목록에서 준비 신호가 전무했다).
 * joint 외 서류종은 null(칩 미표시). 구버전/손상 저장본은 try/catch 로 격리(렌더 크래시 방지).
 * ※ 조문·엔진·검증 판정 무접촉 — 기존 validateJoint 결과를 목록 수준에서 표시할 뿐이다.
 */
function jointReadiness(row: ContractRow): boolean | null {
  if (row.doc_type !== "joint") return null;
  // doc_type==="joint" 가드로 form_data 는 JointForm 임이 보장된다.
  try {
    return validateJoint(row.form_data as JointForm).ok;
  } catch {
    return null;
  }
}

type StatusFilter = "all" | "draft" | "completed";
type SortKey = "recent" | "title" | "trustor" | "readiness";

const SORT_LABEL: Record<SortKey, string> = {
  recent: "최근 수정순",
  title: "제목순 (가나다)",
  trustor: "위탁자순 (가나다)",
  readiness: "생성 준비도순",
};

/** 완료 status 판정 — 그 외(draft/빈값/구버전)는 모두 "작성중"으로 묶는다. */
const isCompleted = (r: ContractRow) => r.status === "completed";

export function ContractsView({ onOpen }: { onOpen: (row: ContractRow) => void }) {
  const [rows, setRows] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      setRows(await listContracts());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  // 삭제 — 즉시 삭제하되 일정 시간 "실행취소"를 제공한다(실수 삭제의 영구 유실 방지).
  // dirty 가드(세션 내)·백업(세션 간)에 이어 유실 방지 계열의 마지막 안전망. 삭제된 행을
  // 그대로 보관했다가 실행취소 시 restoreContract 로 되돌린다(id·시각·form_data 무변형).
  // ★연속 삭제(7초 창 안에 여러 건)에도 각 삭제가 독립된 실행취소 항목을 갖도록 큐로 관리한다
  //   — 단일 슬롯이면 다음 삭제가 직전 항목을 덮어써 먼저 지운 계약이 말없이 영구 유실됐다.
  //   각 항목은 자기 만료 타이머를 가지며(undoTimers: id→timer), 실행취소/만료 시 그 항목만 제거.
  const UNDO_MS = 7000;
  const undoTimers = useRef<Map<string, number>>(new Map());
  const [undoRows, setUndoRows] = useState<ContractRow[]>([]);

  // 타이머 누수 방지(언마운트 시 전부 정리).
  useEffect(() => {
    const timers = undoTimers.current;
    return () => {
      for (const t of timers.values()) window.clearTimeout(t);
      timers.clear();
    };
  }, []);

  async function onDelete(row: ContractRow) {
    await deleteContract(row.id);
    await load();
    // 같은 id 의 기존 만료 타이머가 있으면 교체(큐 중복은 enqueueUndo 가 차단).
    const prev = undoTimers.current.get(row.id);
    if (prev) window.clearTimeout(prev);
    setUndoRows((q) => enqueueUndo(q, row));
    const t = window.setTimeout(() => {
      setUndoRows((q) => dequeueUndo(q, row.id));
      undoTimers.current.delete(row.id);
    }, UNDO_MS);
    undoTimers.current.set(row.id, t);
  }

  async function onUndoDelete(row: ContractRow) {
    await restoreContract(row);
    const t = undoTimers.current.get(row.id);
    if (t) window.clearTimeout(t);
    undoTimers.current.delete(row.id);
    setUndoRows((q) => dequeueUndo(q, row.id));
    await load();
  }

  // 이름 변경 — 자동 생성·"(사본)" 제목을 의미 있는 딜명으로 바꾼다(검색·정렬·식별의 핵심).
  // 카드 제목을 인라인 입력으로 전환해 그 자리에서 편집한다(Enter=저장 / Esc=취소).
  // ★카드 본문은 클릭 시 열기(onOpen)이므로, 편집 입력/버튼은 stopPropagation 으로 열기와 분리한다.
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  function startRename(row: ContractRow) {
    if (batch?.busy) return;
    setEditId(row.id);
    setEditVal(row.title);
  }
  function cancelRename() {
    setEditId(null);
    setEditVal("");
  }
  async function commitRename() {
    if (editId === null) return;
    await renameContract(editId, editVal);
    setEditId(null);
    setEditVal("");
    await load();
  }

  // 복제 — 동일 위탁자·유사 구조 계약을 반복 작성하는 흐름 가속(입력값 그대로 사본, 작성중 상태).
  // 복제는 거의 항상 "사본을 고쳐 새 계약을 만들기" 위함이므로, 만든 직후 사본을 위저드에서 바로 연다
  // (열지 못하면 — 미저장 변경 confirm 취소 등 — 목록에는 이미 사본이 추가돼 있으니 직접 열 수 있다).
  async function onDuplicate(id: string) {
    const newId = await duplicateContract(id);
    const fresh = await listContracts();
    setRows(fresh);
    const copy = newId ? fresh.find((r) => r.id === newId) : null;
    if (copy) onOpen(copy);
  }

  // ── 백업(내보내기)·복원(가져오기) — 로컬 저장 데이터의 유실 방지·기기 이동.
  //    내보내기: 모든 계약을 JSON 파일로 다운로드. 가져오기: 비파괴 병합(기존 보존, 새 계약만 추가).
  //    조문·엔진·생성 로직 무접촉 — 저장된 행을 직렬화/병합할 뿐이다.
  const fileRef = useRef<HTMLInputElement>(null);
  const [backupMsg, setBackupMsg] = useState("");

  function onExport() {
    try {
      const backup = exportContracts();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trustform-계약백업-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBackupMsg(`✓ ${backup.count}건을 백업 파일로 내보냈습니다 — 다운로드를 확인하세요.`);
    } catch (e) {
      setBackupMsg("내보내기 실패: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;
    try {
      const text = await file.text();
      const { added, skipped } = importContracts(text);
      await load();
      setBackupMsg(
        added > 0
          ? `✓ ${added}건을 가져왔습니다${skipped ? ` (이미 있는 ${skipped}건은 건너뜀)` : ""}.`
          : `가져올 새 계약이 없습니다${skipped ? ` (${skipped}건은 이미 보관 중)` : ""}.`,
      );
    } catch (err) {
      setBackupMsg("가져오기 실패: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  // ── 목록에서 바로 서류 일괄 생성(.docx) — 계약을 열지 않고도 준비된 서류 전부 내려받기.
  //    대상은 readyDocIds(검증 게이트 통과 서류)뿐 → 누락 서류는 절대 생성하지 않음(정확성 보존).
  //    Wizard 헤더 generateAllReady 와 동일 패턴(기존 generateCollateralDoc 순차 호출, 350ms 간격).
  //    조문·엔진·생성 로직 무손상 — 저장된 form_data 를 기존 단건 생성기에 넘길 뿐이다.
  const [batch, setBatch] = useState<{ id: string; msg: string; busy: boolean } | null>(null);

  async function generateRowDocs(row: ContractRow) {
    if (batch?.busy) return;
    const ids = readyDocIds(row);
    if (!ids || ids.length === 0) return;
    // ids 가 non-null = collateral 행만 도달 → form_data 는 ContractForm.
    const form = row.form_data as ContractForm;
    setBatch({ id: row.id, msg: `서류 생성 중… (0/${ids.length})`, busy: true });
    try {
      for (let i = 0; i < ids.length; i++) {
        const meta = COLLATERAL_OUTPUT_DOCS.find((d) => d.id === ids[i]);
        setBatch({
          id: row.id,
          msg: `서류 생성 중… (${i + 1}/${ids.length}) ${meta?.name ?? ids[i]}`,
          busy: true,
        });
        await generateCollateralDoc(form, ids[i]);
        // 브라우저의 연속 다운로드 차단 회피용 짧은 간격.
        if (i < ids.length - 1) await new Promise((r) => setTimeout(r, 350));
      }
      setBatch({
        id: row.id,
        msg: `✓ 준비된 ${ids.length}종 Word(.docx) 생성 완료 — 다운로드를 확인하세요.`,
        busy: false,
      });
    } catch (e) {
      setBatch({ id: row.id, msg: "오류: " + (e instanceof Error ? e.message : String(e)), busy: false });
    }
  }

  // ── 목록에서 바로 공동사업표준협약서(joint) 생성(.docx) — 계약을 열지 않고도 협약서 내려받기.
  //    collateral 의 generateRowDocs(N종 일괄) 과 동형이나 joint 는 단일 산출물이라 1건만 생성한다.
  //    검증 게이트(validateJoint.ok)를 통과한 행만 도달 → 빈 칸 협약서는 생성하지 않음(정확성 보존).
  //    JointForm 컴포넌트의 onDocx 와 동일한 generateJointDoc 를 호출할 뿐 — 조문·엔진·산출물 무손상.
  async function generateRowJoint(row: ContractRow) {
    if (batch?.busy) return;
    if (jointReadiness(row) !== true) return;
    // jointReadiness===true = joint 행 + 검증 통과 → form_data 는 JointForm.
    const form = row.form_data as JointForm;
    setBatch({ id: row.id, msg: "협약서 생성 중…", busy: true });
    try {
      await generateJointDoc(form);
      setBatch({
        id: row.id,
        msg: "✓ 공동사업표준협약서 Word(.docx) 생성 완료 — 다운로드를 확인하세요.",
        busy: false,
      });
    } catch (e) {
      setBatch({ id: row.id, msg: "오류: " + (e instanceof Error ? e.message : String(e)), busy: false });
    }
  }

  // 상태별 건수 — 세그먼트 토글에 표기(계약이 쌓일수록 완료/작성중 한눈에).
  const counts = useMemo(
    () => ({
      all: rows.length,
      completed: rows.filter(isCompleted).length,
      draft: rows.filter((r) => !isCompleted(r)).length,
    }),
    [rows],
  );

  // 검색(제목·서류종) + 상태 필터 + 정렬 — 계약이 쌓일수록 빠르게 찾기·정리.
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (status === "completed" && !isCompleted(r)) return false;
      if (status === "draft" && isCompleted(r)) return false;
      if (needle) {
        const docName = DOCUMENT_TYPES.find((d) => d.id === r.doc_type)?.name || r.doc_type;
        // 제목·서류명에 더해 위탁자명·물건 소재지까지 검색 대상에 포함(실무 식별 기준).
        const { trustor, property } = contractIdentity(r);
        const hay = `${r.title} ${docName} ${trustor} ${property}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const sorted = [...out];
    if (sort === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title, "ko"));
    } else if (sort === "trustor") {
      // 위탁자명 가나다순 — 신탁 실무의 핵심 식별자(검색·카드 부제와 동일 출처 contractIdentity).
      // 위탁자명이 비면(미입력·구버전·이질 종류) 맨 뒤로, 동명은 최근 수정순으로 안정 정렬.
      const name = (r: ContractRow) => contractIdentity(r).trustor;
      sorted.sort((a, b) => {
        const na = name(a);
        const nb = name(b);
        if (!na && !nb) return a.updated_at < b.updated_at ? 1 : -1;
        if (!na) return 1;
        if (!nb) return -1;
        return na.localeCompare(nb, "ko") || (a.updated_at < b.updated_at ? 1 : -1);
      });
    } else if (sort === "readiness") {
      // 생성 가능 서류 수 내림차순(준비 안 된 계약을 먼저 손보도록) — 산출정의 없는 종류(null)는 맨 뒤.
      const score = (r: ContractRow) => docReadiness(r)?.ready ?? -1;
      sorted.sort((a, b) => score(b) - score(a) || (a.updated_at < b.updated_at ? 1 : -1));
    } else {
      sorted.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)); // recent (기본)
    }
    return sorted;
  }, [rows, q, status, sort]);

  const filtersActive = status !== "all" || q.trim().length > 0;

  return (
    <main className="page active">
      <div className="page-header">
        <div className="page-eyebrow">내 계약</div>
        <h1 className="page-title">저장된 계약</h1>
        <p className="page-desc">작성 중이거나 완료한 계약을 이어서 편집하거나 서류를 다시 생성할 수 있습니다.</p>
      </div>

      {/* 백업(내보내기)·복원(가져오기) — 로컬 저장 데이터의 유실 방지·기기 이동.
          가져오기는 비파괴(기존 보존)이므로 계약이 0건(캐시 삭제·새 기기)일 때도 항상 노출해 복원 가능. */}
      {!loading && !err && (
        <div className="contracts-backup">
          <button
            className="btn btn-ghost btn-sm"
            onClick={onExport}
            disabled={rows.length === 0}
            title="모든 계약을 JSON 백업 파일로 내보냅니다 (다른 브라우저·기기로 옮기거나 보관용)"
          >
            ⬆ 백업 내보내기
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => fileRef.current?.click()}
            title="백업 파일(JSON)에서 계약을 가져옵니다 (기존 계약은 보존, 새 계약만 추가)"
          >
            ⬇ 백업 가져오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={onImportFile}
          />
          {backupMsg && (
            <span className="field-hint" role="status" aria-live="polite">
              <StatusGlyphText msg={backupMsg} />
            </span>
          )}
        </div>
      )}

      {/* 삭제 실행취소 — 방금 삭제한 계약을 일정 시간 안에 되돌릴 수 있다(영구 유실 방지).
          연속 삭제 시 각 건이 자기 실행취소 바를 가져, 먼저 지운 계약도 덮어쓰기 없이 되돌릴 수 있다. */}
      {undoRows.map((u) => (
        <div key={u.id} className="contracts-undo" role="status" aria-live="polite">
          <span>
            <span aria-hidden="true">🗑 </span>
            <strong>{u.title}</strong> 삭제됨
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onUndoDelete(u)}
            aria-label={`${u.title} 삭제 실행취소`}
          >
            실행취소
          </button>
        </div>
      ))}

      {/* 검색 + 상태 필터 + 정렬 + 건수 — 계약이 많아질 때 탐색성·정리 */}
      {!loading && !err && rows.length > 0 && (
        <div className="contracts-toolbar">
          <input
            className="input"
            aria-label="계약 검색 (제목·위탁자·서류)"
            placeholder="🔍 제목·위탁자·서류로 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 280 }}
          />
          <div className="seg" role="group" aria-label="상태 필터">
            {([
              ["all", "전체"],
              ["draft", "작성중"],
              ["completed", "완료"],
            ] as [StatusFilter, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={"seg-btn" + (status === key ? " active" : "")}
                aria-pressed={status === key}
                onClick={() => setStatus(key)}
              >
                {label}
                <span className="seg-num">{counts[key]}</span>
              </button>
            ))}
          </div>
          <select
            className="input"
            aria-label="정렬"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            style={{ maxWidth: 180 }}
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABEL[k]}
              </option>
            ))}
          </select>
          <span className="field-hint" style={{ marginLeft: "auto" }}>
            {filtersActive ? `${visible.length} / ${rows.length}건` : `총 ${rows.length}건`}
          </span>
        </div>
      )}

      {loading && <p className="field-hint">불러오는 중…</p>}
      {err && <p className="field-hint" style={{ color: "var(--c-danger)" }}>오류: {err}</p>}
      {!loading && !err && rows.length === 0 && (
        <p className="field-hint">아직 저장된 계약이 없습니다. 서류를 작성하고 저장해 보세요.</p>
      )}
      {!loading && !err && rows.length > 0 && visible.length === 0 && (
        <p className="field-hint">조건에 맞는 계약이 없습니다 — 검색어나 상태 필터를 바꿔 보세요.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visible.map((r) => {
          const docName = DOCUMENT_TYPES.find((d) => d.id === r.doc_type)?.name || r.doc_type;
          const readiness = docReadiness(r);
          const allReady = readiness !== null && readiness.ready === readiness.total;
          // joint(공동사업표준협약서) 준비도 — collateral 의 "N/7" 대신 단일 협약서 생성 가능 여부.
          const jointReady = jointReadiness(r);
          // 위탁자·물건 소재지 — 실무 식별 기준(제목만으론 "(사본)"·동명 구분이 어려움).
          const identity = contractIdentity(r);
          const identityLine = [identity.trustor && `위탁자 ${identity.trustor}`, identity.property]
            .filter(Boolean)
            .join(" · ");
          // 카드 본문 클릭 = 계약 열기인데, 종전엔 <div onClick> 뿐이라 마우스로만
          // 활성화됐다(키보드/스크린리더는 우측 "열기" 버튼만 가능 — 큰 클릭 영역의
          // 마우스↔키보드 불일치). role=button + tabIndex + Enter/Space 로 키보드
          // 동등성을 부여한다(WCAG 2.1.1 Keyboard / 4.1.2 Name·Role·Value).
          // ★이름변경(인라인 입력) 중에는 role/포커스를 빼 입력의 Space 가 버블돼
          //   카드를 열지 않게 하고, 입력 자체가 포커스 대상이 되게 한다.
          const isEditing = editId === r.id;
          const statusLabel = r.status === "completed" ? "완료" : "작성중";
          const readyLabel = readiness
            ? `, 서류 ${readiness.ready}/${readiness.total} 생성 가능`
            : jointReady !== null
              ? `, ${jointReady ? "협약서 생성 가능" : "필수 입력 누락"}`
              : "";
          const openLabel = `${r.title}, ${statusLabel}${readyLabel} — 열기`;
          return (
            <div key={r.id} className="contract-card">
              <div
                className="contract-card-open"
                style={{ cursor: "pointer", flex: 1 }}
                onClick={() => onOpen(r)}
                {...(isEditing
                  ? {}
                  : {
                      role: "button",
                      tabIndex: 0,
                      "aria-label": openLabel,
                      onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                        // 카드 자체에서 난 Enter/Space 만 처리 — 내부 요소에서 버블된
                        // 키는 무시(e.currentTarget 기준)해 오작동을 막는다.
                        if (e.target !== e.currentTarget) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpen(r);
                        }
                      },
                    })}
              >
                <div className="contract-card-head">
                  {editId === r.id ? (
                    <span className="contract-rename" onClick={(e) => e.stopPropagation()}>
                      <input
                        className="input contract-rename-input"
                        value={editVal}
                        autoFocus
                        aria-label="계약 이름"
                        maxLength={120}
                        onChange={(e) => setEditVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitRename();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelRename();
                          }
                        }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={commitRename}>
                        저장
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={cancelRename}>
                        취소
                      </button>
                    </span>
                  ) : (
                    <span className="contract-card-title">{r.title}</span>
                  )}
                  <span className={"badge " + (r.status === "completed" ? "ready" : "soon")}>
                    {r.status === "completed" ? "완료" : "작성중"}
                  </span>
                  {readiness && (
                    <span
                      className={"ready-chip " + (allReady ? "ok" : "warn")}
                      title={
                        allReady
                          ? "필수 입력이 모두 채워져 7종 서류 전부 생성 가능합니다"
                          : "일부 서류는 필수 입력 누락으로 아직 생성할 수 없습니다(열기 → 각 서류에서 확인)"
                      }
                    >
                      <span aria-hidden="true">{allReady ? "✓" : "⚠"}</span> 서류 {readiness.ready}/{readiness.total} 생성 가능
                    </span>
                  )}
                  {jointReady !== null && (
                    <span
                      className={"ready-chip " + (jointReady ? "ok" : "warn")}
                      title={
                        jointReady
                          ? "필수 입력이 모두 채워져 공동사업표준협약서를 생성할 수 있습니다"
                          : "필수 입력 누락으로 아직 협약서를 생성할 수 없습니다(열기 → 누락 항목 확인)"
                      }
                    >
                      <span aria-hidden="true">{jointReady ? "✓" : "⚠"}</span>{" "}
                      {jointReady ? "협약서 생성 가능" : "필수 입력 누락"}
                    </span>
                  )}
                </div>
                {identityLine && (
                  <div className="contract-card-identity" style={{ marginTop: 4 }}>{identityLine}</div>
                )}
                <div className="field-hint" style={{ marginTop: 5 }}>
                  {docName}
                  {r.category ? ` · ${CATEGORY_LABEL[r.category as Category] || r.category}` : ""} ·{" "}
                  {new Date(r.updated_at).toLocaleString("ko-KR")}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {readiness && readiness.ready > 0 && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => generateRowDocs(r)}
                      disabled={batch?.busy}
                      aria-label={`${r.title} — 준비된 서류 ${readiness.ready}종 생성`}
                      title={`준비된 ${readiness.ready}종 서류를 Word(.docx)로 한 번에 생성합니다 (누락 서류는 제외)`}
                    >
                      {batch?.busy && batch.id === r.id
                        ? "⏳ 생성 중…"
                        : `⬇ 서류 ${readiness.ready}종 생성`}
                    </button>
                  )}
                  {jointReady === true && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => generateRowJoint(r)}
                      disabled={batch?.busy}
                      aria-label={`${r.title} 협약서 생성`}
                      title="공동사업표준협약서를 Word(.docx)로 생성합니다"
                    >
                      {batch?.busy && batch.id === r.id ? "⏳ 생성 중…" : "⬇ 협약서 생성"}
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onOpen(r)}
                    aria-label={`${r.title} 열기`}
                  >
                    열기
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => startRename(r)}
                    disabled={batch?.busy || editId === r.id}
                    aria-label={`${r.title} 이름변경`}
                    title="이 계약의 이름(제목)을 바꿉니다"
                  >
                    이름변경
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onDuplicate(r.id)}
                    disabled={batch?.busy}
                    aria-label={`${r.title} 복제`}
                    title="이 계약을 입력값 그대로 사본으로 복제하고 바로 편집합니다 (작성중 상태)"
                  >
                    복제
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onDelete(r)}
                    disabled={batch?.busy}
                    aria-label={`${r.title} 삭제`}
                  >
                    삭제
                  </button>
                </div>
                {batch?.id === r.id && batch.msg && (
                  <span
                    className="field-hint"
                    role="status"
                    aria-live="polite"
                    style={{ textAlign: "right", maxWidth: 320 }}
                  >
                    <StatusGlyphText msg={batch.msg} />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
