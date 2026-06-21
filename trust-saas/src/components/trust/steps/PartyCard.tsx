"use client";

import { useState } from "react";
import type { Party, PartyType } from "@/lib/engine/model";
import type { PartyRole } from "@/lib/store/contractStore";
import { useContractStore } from "@/lib/store/contractStore";
import { OCR } from "@/lib/engine/ocr";
import { isValidBizNo, isValidCorpRegNo, isValidBirthDate, partyIdLabel } from "@/lib/engine/calc";

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

  // 사업자등록번호: 10자리를 모두 입력했는데 국세청 표준 체크섬이 깨졌을 때만 입력 즉시 안내한다
  // (입력 중 부분 숫자에는 표시 안 함 — 나그 방지). 게이트(validateDoc)와 동일한 isValidBizNo
  // 단일 출처를 사용하며, 게이트는 부분 입력까지 생성 차단으로 별도 방어한다.
  const bizDigits = [party.bizP1, party.bizP2, party.bizP3].map((x) => x ?? "").join("").replace(/\D/g, "");
  const bizInvalid = bizDigits.length === 10 && !isValidBizNo(bizDigits);

  // 법인등록번호: "법인"이고 13자리를 모두 입력했는데 체크섬이 깨졌을 때만 입력 즉시 안내한다
  // (개인=생년월일 칸이라 비대상, 부분 입력엔 미표시 — 나그 방지). 게이트(validateDoc)와 동일한
  // isValidCorpRegNo 단일 출처를 사용하며, 게이트는 부분 입력까지 생성 차단으로 별도 방어한다.
  const corpDigits = [party.corpRegFront, party.corpRegBack].map((x) => x ?? "").join("").replace(/\D/g, "");
  const corpInvalid = party.type === "법인" && corpDigits.length === 13 && !isValidCorpRegNo(corpDigits);

  // 생년월일: "개인"이고 앞 6자리(YYMMDD)를 모두 입력했는데 실재하지 않는 날짜일 때만 입력 즉시 안내한다
  // (법인=법인등록번호 칸이라 비대상, 부분 입력엔 미표시 — 나그 방지). 게이트(validateDoc)와 동일한
  // isValidBirthDate 단일 출처를 사용하며, 게이트는 부분 입력까지 생성 차단으로 별도 방어한다.
  const birthDigits = String(party.corpRegFront ?? "").replace(/\D/g, "");
  const birthInvalid = party.type === "개인" && birthDigits.length === 6 && !isValidBirthDate(party.corpRegFront, party.corpRegBack);

  // 법인 전용 입력 affordance — 자연인(개인)에겐 존재하지 않는 개념이라 개인일 때 숨긴다.
  //   · 대표이사/사내이사 = 이사회 직위(법인 전용). 사업자등록번호는 개인사업자도 보유하므로 제외(계속 노출).
  //   · 법인등기부 PDF(OCR) = 법인 등기 추출이라 개인엔 무의미.
  // ★비파괴: 숨기기만 하고 모델 값(representativeDirector/insideDirector)은 비우지 않는다
  //   → 법인↔개인 전환 시 데이터 보존(법인으로 되돌리면 그대로 복귀). 산출물(builders.js)·조문 무접촉.
  // ※개인 당사자의 산출물 라벨(상호/대표이사/법인등록번호) 정합은 서명란 verbatim 영역이라
  //   원본 양식 대조(사업팀 M1) 이후 별도 처리 — 추정 형식 금지.
  const isCorp = party.type !== "개인";

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
          {isCorp && (
            <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer", margin: 0 }}>
              법인등기부 PDF
              <input
                type="file"
                accept="application/pdf"
                style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && onCorpPdf(e.target.files[0])}
              />
            </label>
          )}
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
          {/* 라벨은 산출물(builders.js)과 동일하게 type 에 따라 분기 — 개인이면 "생년월일",
              법인이면 "법인등록번호". partyIdLabel 단일 출처로 입력↔출력 라벨 불일치 제거. */}
          <div className="field-label">{partyIdLabel(party.type)}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              className="input"
              value={party.corpRegFront}
              maxLength={6}
              placeholder={party.type === "개인" ? "생년월일" : "######"}
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
          {corpInvalid && (
            <div className="field-hint" role="alert" style={{ marginTop: 4, color: "var(--c-danger)" }}>
              유효하지 않은 법인등록번호입니다 (체크섬 확인 필요)
            </div>
          )}
          {birthInvalid && (
            <div className="field-hint" role="alert" style={{ marginTop: 4, color: "var(--c-danger)" }}>
              실재하지 않는 생년월일입니다 (YYMMDD 형식 확인)
            </div>
          )}
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
          {bizInvalid && (
            <div className="field-hint" role="alert" style={{ marginTop: 4, color: "var(--c-danger)" }}>
              유효하지 않은 사업자등록번호입니다 (체크섬 확인 필요)
            </div>
          )}
        </div>

        {/* 대표이사·사내이사 = 법인 전용(이사회 직위). 개인일 땐 숨기되 값은 보존(비파괴). */}
        {isCorp && (
          <>
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
          </>
        )}

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
