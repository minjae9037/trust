"use client";

import { useEffect, useMemo, useState } from "react";
import { useContractStore } from "@/lib/store/contractStore";
import { DOC_FIELDS, COLLATERAL_OUTPUT_DOCS, STEPS } from "@/lib/engine/schema";
import type { DocId } from "@/lib/engine/model";
import {
  generateCollateralDoc,
  generateCollateralPDF,
  previewDocHTML,
} from "@/lib/engine/docx";
import { validateDoc } from "@/lib/engine/validate";
import { parseAmount, fmtKRW, amountToHangul } from "@/lib/engine/calc";

// 입력 중에는 값 반영을 잠깐 미뤄(미리보기 한정) 매 키 입력마다
// 무거운 완성 문서 HTML(계약서 본문 37KB+) 재생성·iframe srcDoc 재파싱을 막는다.
// 입력 필드/검증 게이트는 store를 직접 읽어 즉시 반영(이 디바운스 영향 없음).
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function DocStep({ docId }: { docId: DocId }) {
  const { form, updateDocContent, setStep, setTab } = useContractStore();

  // 누락 항목 → 해당 입력 단계로 바로 이동(점프). 검증 게이트가 "어디로 가라"고
  // 안내만 하던 것을 한 번의 클릭으로 그 단계까지 데려가 누락을 즉시 채우게 한다.
  function goToStep(idx: number) {
    const s = STEPS.find((x) => x.idx === idx);
    if (!s) return;
    setStep(s.idx);
    setTab(s.tab);
  }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const meta = COLLATERAL_OUTPUT_DOCS.find((d) => d.id === docId);
  const fields = DOC_FIELDS[docId] || [];
  const content = (form.docContents[docId] || {}) as Record<string, unknown>;

  // ── 검증 게이트 (M2-2) — 필수 입력 충족 시에만 생성 활성화 ──
  const { ok, missing } = useMemo(() => validateDoc(form, docId), [form, docId]);

  // ── 실시간 미리보기 (M2-1) — 선택한 서류의 완성 문서를 그대로 렌더(WYSIWYG).
  //    docId별 PDF 빌더 HTML을 iframe srcdoc로 격리 표시 → 실제 생성물과 동일.
  //    form은 250ms 디바운스: 빠른 연속 입력 시 재생성 횟수를 줄여 타이핑 끊김 방지.
  //    docId 전환은 즉시(서류 바꾸면 debouncedForm은 이미 최신이라 지연 없음).
  const debouncedForm = useDebounced(form, 250);
  // 디바운스 대기 중(입력 직후 ~250ms)에는 미리보기가 아직 직전 상태다.
  // store 는 매 수정마다 새 form 참조를 만들므로(스프레드) 참조 불일치가
  // "갱신 대기" 신호 — 그 동안만 "갱신 중…" 인디케이터를 표시해
  // 미리보기가 멈춘 게 아니라 반영 중임을 알린다.
  const previewPending = form !== debouncedForm;
  const previewHtml = useMemo(() => {
    try {
      return previewDocHTML(debouncedForm, docId);
    } catch {
      return "";
    }
  }, [debouncedForm, docId]);

  const setField = (key: string, value: unknown) =>
    updateDocContent(docId, { [key]: value } as never);

  async function onDocx() {
    if (!ok) return;
    setBusy(true);
    setMsg("Word 파일 생성 중…");
    try {
      await generateCollateralDoc(form, docId);
      setMsg("✓ Word(.docx) 생성 완료 — 다운로드를 확인하세요.");
    } catch (e) {
      setMsg("오류: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }
  function onPdf() {
    if (!ok) return;
    try {
      generateCollateralPDF(form, docId);
      setMsg("PDF 인쇄창을 열었습니다(팝업 허용 필요).");
    } catch (e) {
      setMsg("오류: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <div className="doc-split">
      {/* ── 좌: 입력 ── */}
      <div className="doc-split-input">
        <p className="field-hint" style={{ marginBottom: 16 }}>
          {meta?.desc}
        </p>

        <div className="field-grid">
          {fields.map((f) => {
            const val = content[f.key];
            // 라벨↔컨트롤 접근성: field-label 을 <label htmlFor> 로 컨트롤 id 에
            // 연결(라벨 클릭 시 포커스 + 스크린리더 접근명). 서류·필드별 고유 id.
            const fid = `doc-${docId}-${f.key}`;
            if (f.type === "textarea") {
              return (
                <div className="field full" key={f.key}>
                  <label className="field-label" htmlFor={fid}>{f.label}</label>
                  {f.hint && <div className="field-hint">{f.hint}</div>}
                  <textarea
                    id={fid}
                    className="input"
                    rows={3}
                    placeholder={f.placeholder}
                    value={(val as string) ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                </div>
              );
            }
            if (f.type === "select") {
              return (
                <div className="field full" key={f.key}>
                  <label className="field-label" htmlFor={fid}>{f.label}</label>
                  {f.hint && <div className="field-hint">{f.hint}</div>}
                  <select
                    id={fid}
                    className="select"
                    value={(val as string) ?? (f.default as string) ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                  >
                    {f.options?.map((o) => (
                      <option key={o.v} value={o.v}>{o.l}</option>
                    ))}
                  </select>
                </div>
              );
            }
            if (f.type === "radio") {
              // 라디오 그룹: 개별 옵션은 감싼 <label> 로 이름이 붙으나, 그룹 전체
              // 라벨은 role=radiogroup + aria-labelledby 로 연결(htmlFor 는 단일
              // 컨트롤 전용이라 그룹엔 부적합).
              return (
                <div className="field full" key={f.key}>
                  <div className="field-label" id={fid}>{f.label}</div>
                  {f.hint && <div className="field-hint">{f.hint}</div>}
                  <div role="radiogroup" aria-labelledby={fid} style={{ display: "flex", gap: 14, marginTop: 6 }}>
                    {f.options?.map((o) => (
                      <label key={o.v} className="inline-check">
                        <input
                          type="radio"
                          name={f.key}
                          checked={(val as string) === o.v}
                          onChange={() => setField(f.key, o.v)}
                        />
                        {o.l}
                      </label>
                    ))}
                  </div>
                </div>
              );
            }
            if (f.type === "toggle") {
              const on = val === undefined ? (f.default as boolean) : (val as boolean);
              return (
                <div className="field full" key={f.key}>
                  <label className="inline-check">
                    <input type="checkbox" checked={!!on} onChange={(e) => setField(f.key, e.target.checked)} />
                    <span>
                      <strong>{f.label}</strong>
                    </span>
                  </label>
                  {f.hint && <div className="field-hint">{f.hint}</div>}
                </div>
              );
            }
            // text / amount
            // money 필드(가격·원본가액 등 대형 법적 금액)는 입력 즉시 천단위 콤마 + 한글 금액을
            // 에코로 보여 0 개수 오입력을 눈으로 검증하게 한다(산출물에 한글 금액으로 박히므로
            // 입력↔출력 정합 미리보기 역할). parseAmount>0 일 때만 표시(빈 값·0·음수는 검증 박스가 안내).
            const amt = f.money ? parseAmount(val as string) : 0;
            return (
              <div className="field full" key={f.key}>
                <label className="field-label" htmlFor={fid}>{f.label}</label>
                {f.hint && <div className="field-hint">{f.hint}</div>}
                <input
                  id={fid}
                  className="input"
                  type={f.type === "amount" ? "number" : "text"}
                  placeholder={f.placeholder}
                  value={(val as string) ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
                {f.money && amt > 0 && (
                  <div className="amount-echo" role="status" aria-live="polite">
                    <span className="amount-echo-num">{fmtKRW(val as string)}</span>
                    <span className="amount-echo-hangul">{amountToHangul(val as string)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="panel-footnote" style={{ margin: "18px 0" }}>
          <strong>📝 양식 안내</strong> 현재 출력은 입력값 검증용 표준(안)입니다. 회사 표준양식(.docx)
          수급 시 입력값이 양식 변수에 자동 치환됩니다.
        </div>

        {/* ── 검증 게이트 안내 (M2-2) ── */}
        {!ok && (
          <div className="validate-box" role="alert">
            <div className="validate-title">⚠ 생성 전 필수 입력이 누락되었습니다</div>
            <ul className="validate-list">
              {missing.map((m, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="validate-jump"
                    onClick={() => goToStep(m.stepIdx)}
                    title={`${m.where}(으)로 이동`}
                  >
                    <strong>{m.label}</strong>
                    <span className="validate-where"> — {m.where} ›</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            className="btn btn-primary"
            onClick={onDocx}
            disabled={busy || !ok}
            title={ok ? "" : "필수 입력을 모두 채우면 활성화됩니다"}
          >
            📄 Word(.docx) 생성
          </button>
          <button
            className="btn btn-ghost"
            onClick={onPdf}
            disabled={busy || !ok}
            title={ok ? "" : "필수 입력을 모두 채우면 활성화됩니다"}
          >
            🖨 PDF 생성
          </button>
          {msg && <span className="field-hint" style={{ color: "var(--c-blue-deep)" }}>{msg}</span>}
        </div>
      </div>

      {/* ── 우: 실시간 미리보기 (선택 서류 그대로, 실제 생성물과 동일) ── */}
      <aside className="doc-split-preview">
        <div className="preview-head">
          <span className="preview-badge">실시간 미리보기</span>
          <span className="field-hint">입력값이 즉시 반영됩니다 ({meta?.name})</span>
          {previewPending && (
            <span className="preview-updating" role="status" aria-live="polite">
              <span className="preview-updating-dot" aria-hidden="true" />
              갱신 중…
            </span>
          )}
        </div>
        {previewHtml ? (
          <iframe
            className="preview-frame"
            srcDoc={previewHtml}
            title={`${meta?.name ?? "서류"} 미리보기`}
          />
        ) : (
          <div className="preview-scroll">
            <p className="field-hint" style={{ padding: 16 }}>
              관계사·물건·금액을 입력하면 {meta?.name ?? "서류"} 미리보기가 나타납니다.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
