"use client";

import { useEffect, useMemo, useState } from "react";
import { listContracts, deleteContract, type ContractRow } from "@/lib/contractRepo";
import { DOCUMENT_TYPES, CATEGORY_LABEL, COLLATERAL_OUTPUT_DOCS } from "@/lib/engine/schema";
import { validateDoc } from "@/lib/engine/validate";
import type { Category } from "@/lib/engine/model";

/**
 * 계약별 서류 생성 준비도 — 담보신탁(collateral)만 7종 산출 서류가 정의돼 있어
 * `validateDoc`(검증 게이트와 동일 로직)을 재사용해 "몇 종 생성 가능"한지 집계한다.
 * 다른 서류종은 산출 서류 정의가 달라 집계 대상이 아니다(null 반환 → 칩 미표시).
 * 구버전/손상 저장본(form_data 일부 누락)은 try/catch로 격리(목록 렌더 크래시 방지).
 * ※ 조문·엔진 무접촉 — 기존 검증 결과를 목록 수준에서 보여줄 뿐이다.
 */
function docReadiness(row: ContractRow): { ready: number; total: number } | null {
  if (row.doc_type !== "collateral") return null;
  try {
    const total = COLLATERAL_OUTPUT_DOCS.length;
    const ready = COLLATERAL_OUTPUT_DOCS.filter(
      (d) => validateDoc(row.form_data, d.id).ok,
    ).length;
    return { ready, total };
  } catch {
    return null;
  }
}

type StatusFilter = "all" | "draft" | "completed";
type SortKey = "recent" | "title" | "readiness";

const SORT_LABEL: Record<SortKey, string> = {
  recent: "최근 수정순",
  title: "제목순 (가나다)",
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

  async function onDelete(id: string) {
    if (!confirm("이 계약을 삭제할까요?")) return;
    await deleteContract(id);
    load();
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
        if (
          !r.title.toLowerCase().includes(needle) &&
          !docName.toLowerCase().includes(needle)
        )
          return false;
      }
      return true;
    });
    const sorted = [...out];
    if (sort === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title, "ko"));
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

      {/* 검색 + 상태 필터 + 정렬 + 건수 — 계약이 많아질 때 탐색성·정리 */}
      {!loading && !err && rows.length > 0 && (
        <div className="contracts-toolbar">
          <input
            className="input"
            placeholder="🔍 제목·서류로 검색"
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
          return (
            <div key={r.id} className="contract-card">
              <div style={{ cursor: "pointer", flex: 1 }} onClick={() => onOpen(r)}>
                <div className="contract-card-head">
                  <span className="contract-card-title">{r.title}</span>
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
                      {allReady ? "✓" : "⚠"} 서류 {readiness.ready}/{readiness.total} 생성 가능
                    </span>
                  )}
                </div>
                <div className="field-hint" style={{ marginTop: 5 }}>
                  {docName}
                  {r.category ? ` · ${CATEGORY_LABEL[r.category as Category] || r.category}` : ""} ·{" "}
                  {new Date(r.updated_at).toLocaleString("ko-KR")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => onOpen(r)}>
                  열기
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => onDelete(r.id)}>
                  삭제
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
