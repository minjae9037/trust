"use client";

import { useState } from "react";
import type { Party, PartyType } from "@/lib/engine/model";
import type { PartyRole } from "@/lib/store/contractStore";
import { useContractStore } from "@/lib/store/contractStore";
import { OCR } from "@/lib/engine/ocr";

interface Props {
  role: PartyRole;
  idx: number;
  party: Party;
  label: string;
  showLoanFields?: boolean; // 우선수익자 전용
  removable: boolean;
}

export function PartyCard({ role, idx, party, label, showLoanFields, removable }: Props) {
  const { updateParty, removeParty } = useContractStore();
  const [ocrMsg, setOcrMsg] = useState<string>("");
  const set = (patch: Partial<Party>) => updateParty(role, idx, patch);

  async function onCorpPdf(file: File) {
    setOcrMsg("등기부 분석 중… (최초 1회 엔진 로딩 15~25초)");
    try {
      const { text, source } = await OCR.recognizePDF(file, (p) =>
        setOcrMsg(`처리 중: ${p.status}${p.page ? ` ${p.page}/${p.total}` : ""}`)
      );
      const r = OCR.parseCorporateRegistry(text);
      set({ ...r, _inputMethod: "ocr" });
      setOcrMsg(
        `자동 추출 완료(${source === "embedded" ? "텍스트" : "OCR"}). 반드시 검수하세요.`
      );
    } catch (e) {
      setOcrMsg("추출 실패: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <div className="party-card" style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <strong style={{ fontSize: 13 }}>
          {label} {idx + 1}
        </strong>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer", margin: 0 }}>
            법인등기부 PDF
            <input
              type="file"
              accept="application/pdf"
              style={{ display: "none" }}
              onChange={(e) => e.target.files?.[0] && onCorpPdf(e.target.files[0])}
            />
          </label>
          {removable && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => removeParty(role, idx)}
              title="삭제"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {ocrMsg && (
        <div className="field-hint" style={{ marginBottom: 8, color: "var(--c-blue-deep)" }}>
          {ocrMsg}
        </div>
      )}

      <div className="field-grid">
        <div className="field">
          <div className="field-label">구분</div>
          <select
            className="select"
            value={party.type}
            onChange={(e) => set({ type: e.target.value as PartyType })}
          >
            <option value="법인">법인</option>
            <option value="개인">개인</option>
          </select>
        </div>
        <div className="field">
          <div className="field-label">법인명/성명</div>
          <input className="input" value={party.name} onChange={(e) => set({ name: e.target.value })} />
        </div>

        <div className="field">
          <div className="field-label">법인등록번호</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              className="input"
              value={party.corpRegFront}
              maxLength={6}
              placeholder="######"
              onChange={(e) => set({ corpRegFront: e.target.value.replace(/\D/g, "") })}
            />
            <span>-</span>
            <input
              className="input"
              value={party.corpRegBack}
              maxLength={7}
              placeholder="#######"
              onChange={(e) => set({ corpRegBack: e.target.value.replace(/\D/g, "") })}
            />
          </div>
        </div>
        <div className="field">
          <div className="field-label">사업자등록번호</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input className="input" value={party.bizP1} maxLength={3} placeholder="###"
              onChange={(e) => set({ bizP1: e.target.value.replace(/\D/g, "") })} />
            <span>-</span>
            <input className="input" value={party.bizP2} maxLength={2} placeholder="##"
              onChange={(e) => set({ bizP2: e.target.value.replace(/\D/g, "") })} />
            <span>-</span>
            <input className="input" value={party.bizP3} maxLength={5} placeholder="#####"
              onChange={(e) => set({ bizP3: e.target.value.replace(/\D/g, "") })} />
          </div>
        </div>

        <div className="field">
          <div className="field-label">대표이사</div>
          <input className="input" value={party.representativeDirector}
            onChange={(e) => set({ representativeDirector: e.target.value })} />
        </div>
        <div className="field">
          <div className="field-label">사내이사</div>
          <input className="input" value={party.insideDirector}
            onChange={(e) => set({ insideDirector: e.target.value })} />
        </div>

        <div className="field full">
          <div className="field-label">주소</div>
          <input className="input" value={party.address} onChange={(e) => set({ address: e.target.value })} />
        </div>
        <div className="field">
          <div className="field-label">연락처</div>
          <input className="input" value={party.contact} onChange={(e) => set({ contact: e.target.value })} />
        </div>

        {showLoanFields && (
          <>
            <div className="field">
              <div className="field-label">대출금액 (원)</div>
              <input className="input" type="number" inputMode="numeric" value={party.loanAmount}
                placeholder="예) 5000000000"
                onChange={(e) => set({ loanAmount: e.target.value })} />
            </div>
            <div className="field">
              <div className="field-label">피담보채권 채무자</div>
              <input className="input" value={party.claimDebtor}
                onChange={(e) => set({ claimDebtor: e.target.value })} />
            </div>
            <div className="field full">
              <div className="field-label">피담보채권 문구 (별첨2)</div>
              <input className="input" value={party.securedClaim}
                onChange={(e) => set({ securedClaim: e.target.value })} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
