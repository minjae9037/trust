"use client";

import { useEffect, useState } from "react";
import { listContracts, deleteContract, type ContractRow } from "@/lib/contractRepo";
import { DOCUMENT_TYPES, CATEGORY_LABEL } from "@/lib/engine/schema";
import type { Category } from "@/lib/engine/model";

export function ContractsView({ onOpen }: { onOpen: (row: ContractRow) => void }) {
  const [rows, setRows] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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

  return (
    <main className="page active">
      <div className="page-header">
        <div className="page-eyebrow">내 계약</div>
        <h1 className="page-title">저장된 계약</h1>
        <p className="page-desc">작성 중이거나 완료한 계약을 이어서 편집하거나 서류를 다시 생성할 수 있습니다.</p>
      </div>

      {loading && <p className="field-hint">불러오는 중…</p>}
      {err && <p className="field-hint" style={{ color: "var(--c-danger)" }}>오류: {err}</p>}
      {!loading && !err && rows.length === 0 && (
        <p className="field-hint">아직 저장된 계약이 없습니다. 서류를 작성하고 저장해 보세요.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r) => {
          const docName = DOCUMENT_TYPES.find((d) => d.id === r.doc_type)?.name || r.doc_type;
          return (
            <div
              key={r.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--c-paper)",
                border: "1px solid var(--c-line)",
                borderRadius: "var(--r-lg)",
                padding: "16px 18px",
              }}
            >
              <div style={{ cursor: "pointer", flex: 1 }} onClick={() => onOpen(r)}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{r.title}</div>
                <div className="field-hint" style={{ marginTop: 4 }}>
                  {docName}
                  {r.category ? ` · ${CATEGORY_LABEL[r.category as Category] || r.category}` : ""} ·{" "}
                  {new Date(r.updated_at).toLocaleString("ko-KR")} · {r.status === "completed" ? "완료" : "작성중"}
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
