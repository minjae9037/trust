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
  /** 순서 변경(▲▼) 노출 — 우선수익자처럼 배열 순서가 곧 선·후순위인 목록에서만 true */
  orderable?: boolean;
  /** 같은 역할 카드 총수(순서 변경 버튼의 경계 비활성 판정용) */
  count?: number;
  /** 순위 배지 문구(예: "제1순위 · 최선순위") — 있으면 제목 옆에 표시. 표시 전용 */
  rankNote?: string;
}

export function PartyCard({ role, idx, party, label, showLoanFields, removable, orderable, count, rankNote }: Props) {
  const { updateParty, removeParty, moveParty } = useContractStore();
  const total = count ?? 1;
  const isFirst = idx === 0;
  const isLast = idx === total - 1;
  const [ocrMsg, setOcrMsg] = useState<string>("");
  const set = (patch: Partial<Party>) => updateParty(role, idx, patch);

  // 라벨↔컨트롤 접근성: 같은 PartyCard 가 역할(role)·순번(idx)별로 여러 개 렌더되므로
  // id 는 role·idx·필드키로 고유화한다(중복 id 충돌 방지·단일 출처). DocStep 의
  // `doc-${docId}-${key}` 패턴과 동형.
  const fid = (key: string) => `party-${role}-${idx}-${key}`;

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
        <strong style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          {label} {idx + 1}
          {rankNote && <span className="party-rank">{rankNote}</span>}
        </strong>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {orderable && total > 1 && (
            <div className="party-move" role="group" aria-label={`${label} ${idx + 1} 순위 변경`}>
              <button
                type="button"
                className="party-move-btn"
                onClick={() => moveParty(role, idx, -1)}
                disabled={isFirst}
                aria-label={`${label} ${idx + 1} 위로 이동(선순위로)`}
                title="위로 이동 — 선순위로"
              >
                <span aria-hidden="true">▲</span>
              </button>
              <button
                type="button"
                className="party-move-btn"
                onClick={() => moveParty(role, idx, 1)}
                disabled={isLast}
                aria-label={`${label} ${idx + 1} 아래로 이동(후순위로)`}
                title="아래로 이동 — 후순위로"
              >
                <span aria-hidden="true">▼</span>
              </button>
            </div>
          )}
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
          <label className="field-label" htmlFor={fid("type")}>구분</label>
          <select
            id={fid("type")}
            className="select"
            value={party.type}
            onChange={(e) => set({ type: e.target.value as PartyType })}
          >
            <option value="법인">법인</option>
            <option value="개인">개인</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor={fid("name")}>법인명/성명</label>
          <input id={fid("name")} className="input" value={party.name} onChange={(e) => set({ name: e.target.value })} />
        </div>

        <div className="field">
          {/* 라벨은 산출물(builders.js)과 동일하게 type 에 따라 분기 — 개인이면 "생년월일",
              법인이면 "법인등록번호". partyIdLabel 단일 출처로 입력↔출력 라벨 불일치 제거.
              앞/뒤 2개 input 묶음이라 단일 htmlFor 부적합 → 그룹 라벨 id + role="group"
              aria-labelledby, 각 input 에 앞/뒤 aria-label 부여. */}
          <div className="field-label" id={fid("regid")}>{partyIdLabel(party.type)}</div>
          {/* 오류 상태를 입력 컨트롤에 프로그래밍적으로 연결(aria-invalid + aria-describedby)
              → 스크린리더 사용자가 필드 포커스 시 오류 상태·내용 인지. corpInvalid·birthInvalid 는
              type(법인/개인)에 따라 상호배타라 활성 오류 1개의 id 만 참조. */}
          <div role="group" aria-labelledby={fid("regid")} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              className="input"
              aria-label={`${partyIdLabel(party.type)} 앞자리`}
              aria-invalid={corpInvalid || birthInvalid || undefined}
              aria-describedby={corpInvalid ? fid("corpErr") : birthInvalid ? fid("birthErr") : undefined}
              value={party.corpRegFront}
              maxLength={6}
              placeholder={party.type === "개인" ? "생년월일" : "######"}
              onChange={(e) => set({ corpRegFront: e.target.value.replace(/\D/g, "") })}
            />
            <span>-</span>
            <input
              className="input"
              aria-label={`${partyIdLabel(party.type)} 뒷자리`}
              aria-invalid={corpInvalid || birthInvalid || undefined}
              aria-describedby={corpInvalid ? fid("corpErr") : birthInvalid ? fid("birthErr") : undefined}
              value={party.corpRegBack}
              maxLength={7}
              placeholder="#######"
              onChange={(e) => set({ corpRegBack: e.target.value.replace(/\D/g, "") })}
            />
          </div>
          {corpInvalid && (
            <div id={fid("corpErr")} className="field-hint" role="alert" style={{ marginTop: 4, color: "var(--c-danger)" }}>
              유효하지 않은 법인등록번호입니다 (체크섬 확인 필요)
            </div>
          )}
          {birthInvalid && (
            <div id={fid("birthErr")} className="field-hint" role="alert" style={{ marginTop: 4, color: "var(--c-danger)" }}>
              실재하지 않는 생년월일입니다 (YYMMDD 형식 확인)
            </div>
          )}
        </div>
        <div className="field">
          <div className="field-label" id={fid("biz")}>사업자등록번호</div>
          <div role="group" aria-labelledby={fid("biz")} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input className="input" aria-label="사업자등록번호 앞 3자리"
              aria-invalid={bizInvalid || undefined} aria-describedby={bizInvalid ? fid("bizErr") : undefined}
              value={party.bizP1} maxLength={3} placeholder="###"
              onChange={(e) => set({ bizP1: e.target.value.replace(/\D/g, "") })} />
            <span>-</span>
            <input className="input" aria-label="사업자등록번호 가운데 2자리"
              aria-invalid={bizInvalid || undefined} aria-describedby={bizInvalid ? fid("bizErr") : undefined}
              value={party.bizP2} maxLength={2} placeholder="##"
              onChange={(e) => set({ bizP2: e.target.value.replace(/\D/g, "") })} />
            <span>-</span>
            <input className="input" aria-label="사업자등록번호 뒤 5자리"
              aria-invalid={bizInvalid || undefined} aria-describedby={bizInvalid ? fid("bizErr") : undefined}
              value={party.bizP3} maxLength={5} placeholder="#####"
              onChange={(e) => set({ bizP3: e.target.value.replace(/\D/g, "") })} />
          </div>
          {bizInvalid && (
            <div id={fid("bizErr")} className="field-hint" role="alert" style={{ marginTop: 4, color: "var(--c-danger)" }}>
              유효하지 않은 사업자등록번호입니다 (체크섬 확인 필요)
            </div>
          )}
        </div>

        {/* 대표이사·사내이사 = 법인 전용(이사회 직위). 개인일 땐 숨기되 값은 보존(비파괴). */}
        {isCorp && (
          <>
            <div className="field">
              <label className="field-label" htmlFor={fid("repDir")}>대표이사</label>
              <input id={fid("repDir")} className="input" value={party.representativeDirector}
                onChange={(e) => set({ representativeDirector: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor={fid("insDir")}>사내이사</label>
              <input id={fid("insDir")} className="input" value={party.insideDirector}
                onChange={(e) => set({ insideDirector: e.target.value })} />
            </div>
          </>
        )}

        <div className="field full">
          <label className="field-label" htmlFor={fid("address")}>주소</label>
          <input id={fid("address")} className="input" value={party.address} onChange={(e) => set({ address: e.target.value })} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={fid("contact")}>연락처</label>
          <input id={fid("contact")} className="input" value={party.contact} onChange={(e) => set({ contact: e.target.value })} />
        </div>

        {showLoanFields && (
          <>
            <div className="field">
              <label className="field-label" htmlFor={fid("loanAmount")}>대출금액 (원)</label>
              <input id={fid("loanAmount")} className="input" type="number" inputMode="numeric" value={party.loanAmount}
                placeholder="예) 5000000000"
                onChange={(e) => set({ loanAmount: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor={fid("claimDebtor")}>피담보채권 채무자</label>
              <input id={fid("claimDebtor")} className="input" value={party.claimDebtor}
                onChange={(e) => set({ claimDebtor: e.target.value })} />
            </div>
            <div className="field full">
              <label className="field-label" htmlFor={fid("securedClaim")}>피담보채권 문구 (별첨2)</label>
              <input id={fid("securedClaim")} className="input" value={party.securedClaim}
                onChange={(e) => set({ securedClaim: e.target.value })} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
