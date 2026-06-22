"use client";

import { useState } from "react";
import { useContractStore } from "@/lib/store/contractStore";
import { OCR } from "@/lib/engine/ocr";
import { isValidRegNo, isPositiveAmount, formatAreaReadback, formatRegNoReadback } from "@/lib/engine/calc";
import { useFocusAfterRemove } from "@/lib/ui/use-focus-after-remove";

export function StepProperty() {
  const { form, addProperty, removeProperty, updateProperty } = useContractStore();
  const [ocrMsg, setOcrMsg] = useState("");
  // 부동산 삭제 버튼 후 포커스를 "+ 부동산 추가" 버튼으로 이동(WCAG 2.4.3)
  const propFocus = useFocusAfterRemove(form.properties.length);

  async function onPdf(file: File, idx: number) {
    setOcrMsg("부동산 등기부 분석 중…");
    try {
      const { text, source } = await OCR.recognizePDF(file, (p) =>
        setOcrMsg(`처리 중: ${p.status}${p.page ? ` ${p.page}/${p.total}` : ""}`)
      );
      const r = OCR.parsePropertyRegistry(text);
      updateProperty(idx, r);
      setOcrMsg(`자동 추출 완료(${source === "embedded" ? "텍스트" : "OCR"}). 검수하세요.`);
    } catch (e) {
      setOcrMsg("추출 실패: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <div>
      {/* OCR 진행/결과 상태 스크린리더 고지(WCAG 4.1.3 Status Messages) — 등기부 PDF 자동추출은
          담보물(소재지·지목·면적·등기 고유번호) 정량 데이터를 사용자 입력 없이 채우는 핵심·정확성
          직결 동선인데, 진행("분석 중…")·완료("자동 추출 완료 — 검수하세요")·실패("추출 실패…")
          메시지가 일반 div 라 스크린리더가 전혀 고지받지 못했다. OCR 은 오인식 가능 → 완료 시
          "검수하세요" 안내가 SR 사용자에게 닿지 않으면 잘못 추출된 법적 데이터를 검수 없이 확정할
          위험이 있다(회사 "정확성 최우선·검수" 원칙 직결).
          ★라이브 영역은 콘텐츠 변경 '전'에 DOM 에 존재해야 첫 메시지부터 안정적으로 낭독되므로
          (advisor `.advisor-live` 가 영속 영역을 둔 이유와 동일), ocrMsg 유무와 무관하게 컨테이너를
          항상 렌더하고 메시지 div 만 조건부로 렌더한다(빈 컨테이너=무여백·시각 무변경). polite =
          사용자가 능동 트리거 후 대기하는 비동기 상태라 진행·완료·실패를 적시 고지(과다 낭독 없음). */}
      <div role="status" aria-live="polite" aria-atomic="true">
        {ocrMsg && (
          <div className="field-hint" style={{ marginBottom: 10, color: "var(--c-blue-deep)" }}>
            {ocrMsg}
          </div>
        )}
      </div>
      {form.properties.map((p, i) => (
        <div className="party-card" key={i} style={{ marginBottom: 14 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <strong style={{ fontSize: 13 }}>부동산 {i + 1}</strong>
            <div style={{ display: "flex", gap: 8 }}>
              <label className="btn btn-ghost btn-sm file-upload-btn" style={{ cursor: "pointer", margin: 0 }}>
                등기부 PDF
                <input
                  type="file"
                  accept="application/pdf"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && onPdf(e.target.files[0], i)}
                />
              </label>
              {form.properties.length > 1 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => { removeProperty(i); propFocus.markRemoved(); }}
                  aria-label={`부동산 ${i + 1} 삭제`}
                  title="삭제"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              )}
            </div>
          </div>
          <div className="field-grid">
            <div className="field full">
              <label className="field-label" htmlFor={`prop-${i}-address`}>소재지</label>
              <input id={`prop-${i}-address`} className="input" value={p.address}
                onChange={(e) => updateProperty(i, { address: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`prop-${i}-category`}>지목</label>
              <input id={`prop-${i}-category`} className="input" value={p.category}
                onChange={(e) => updateProperty(i, { category: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`prop-${i}-area`}>면적 (㎡)</label>
              {/* 면적은 별첨1·신청서 부동산표 면적칸에 `area + "㎡"`로 박히는 정량 출력값.
                  게이트(validateDoc)와 같은 단일 출처(isPositiveAmount)·같은 채움 조건(trim>0)을
                  재사용해 "채웠지만 0·음수·비숫자"면 그 입력 옆에서 즉시 안내한다(판정 불일치 0,
                  등기번호·가격·원본가액 인라인 패리티). 빈 값·유효 면적은 미표시(나그 방지). */}
              <input id={`prop-${i}-area`} className="input" value={p.area}
                aria-invalid={(p.area.trim().length > 0 && !isPositiveAmount(p.area)) || undefined}
                aria-describedby={p.area.trim().length > 0 && !isPositiveAmount(p.area) ? `prop-${i}-area-err` : undefined}
                onChange={(e) => updateProperty(i, { area: e.target.value })} />
              {p.area.trim().length > 0 && !isPositiveAmount(p.area) && (
                <div id={`prop-${i}-area-err`} className="field-hint" role="alert" style={{ marginTop: 4, color: "var(--c-danger)" }}>
                  면적은 0보다 큰 숫자만 입력하세요 (㎡ 단위는 자동 표기 — 이 값으로는 서류를 생성할 수 없습니다).
                </div>
              )}
              {/* 면적 확인용 readback — 면적은 별첨1·신청서·계약서 별지 부동산표에 `area + "㎡"`로
                  박히는 정량 입력값이라, 금액 한글 readback(자릿수 확인)과 같은 철학으로 입력 지점에서
                  규모를 눈으로 교차검증하게 한다(천단위 콤마 + 평 환산). ★산출물은 ㎡만 표기하고 평은
                  입력 확인 표시 전용이다(빌더·조문 무접촉). formatAreaReadback 은 양수일 때만 문구를
                  돌려주므로 위 무효 안내(0·음수·비숫자)와 상호배타 — loan-hangul 기존 클래스 재사용(새 CSS 0). */}
              {formatAreaReadback(p.area) && (
                <div className="loan-hangul" role="status" aria-live="polite">{formatAreaReadback(p.area)}</div>
              )}
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`prop-${i}-regNo`}>등기 고유번호</label>
              <input id={`prop-${i}-regNo`} className="input" value={p.regNo}
                aria-invalid={(p.regNo.trim().length > 0 && !isValidRegNo(p.regNo)) || undefined}
                aria-describedby={p.regNo.trim().length > 0 && !isValidRegNo(p.regNo) ? `prop-${i}-regNo-err` : undefined}
                onChange={(e) => updateProperty(i, { regNo: e.target.value })} />
              {p.regNo.trim().length > 0 && !isValidRegNo(p.regNo) && (
                <div id={`prop-${i}-regNo-err`} className="field-hint" role="alert" style={{ marginTop: 4, color: "var(--c-danger)" }}>
                  등기 고유번호는 숫자 14자리입니다 (현재 {p.regNo.replace(/\D/g, "").length}자리)
                </div>
              )}
              {/* 등기 고유번호 확인용 readback — 정확히 14자리일 때 등기사항증명서 표기와 동일한
                  4-4-6 묶음("NNNN-NNNN-NNNNNN")으로 되읽어, 14자리 숫자열의 전치·누락을 입력 지점에서
                  등기부등본과 눈으로 대조하게 한다(금액 한글·면적 평환산 readback 동일 철학). 빌더는
                  raw 값을 박으므로(builders.js tc(p.regNo)) 묶음은 입력 확인 표시 전용(조문·게이트 무접촉).
                  formatRegNoReadback 은 14자리일 때만 문구를 돌려주므로 위 무효 안내와 상호배타 —
                  loan-hangul 기존 클래스 재사용(새 CSS 0). */}
              {formatRegNoReadback(p.regNo) && (
                <div className="loan-hangul" role="status" aria-live="polite">{formatRegNoReadback(p.regNo)}</div>
              )}
            </div>
          </div>
        </div>
      ))}
      <button ref={propFocus.addBtnRef} type="button" className="btn btn-ghost btn-sm party-add-btn" onClick={addProperty}>
        + 부동산 추가
      </button>
    </div>
  );
}
