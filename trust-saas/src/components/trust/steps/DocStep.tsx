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
import { parseAmount, fmtKRW, amountToHangul, isPositiveAmount, interpretDate, interpretSharePct } from "@/lib/engine/calc";
import { genFreshness } from "@/lib/engine/genStatus";
import { openDocPreviewWindow } from "@/lib/ui/preview-window";

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
  // "크게 보기"(새 창) 팝업 차단 안내. 차단 외에는 비워 둔다.
  const [previewNote, setPreviewNote] = useState("");
  // 마지막 생성(Word/PDF) 시점의 입력 스냅샷. 이후 입력이 바뀌면 "✓ 완료"
  // 확인이 오해를 부르므로(법적 서류=정확성) "다시 생성하세요"로 전환한다.
  const [genSnap, setGenSnap] = useState<string | null>(null);
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

  // 값 기반 입력 스냅샷(참조 동일성 대신 직렬화 비교 — store dirty 추적과 동일 패턴).
  const formSnap = useMemo(() => JSON.stringify(form), [form]);
  // 생성 후 입력이 바뀌었는지: none(미생성)·fresh(무변경)·stale(변경됨).
  const freshness = genFreshness(formSnap, genSnap);

  // 서류 전환 시 직전 서류의 생성 확인·메시지 초기화.
  useEffect(() => {
    setMsg("");
    setGenSnap(null);
    setPreviewNote("");
  }, [docId]);
  // 입력이 바뀌면 직전 생성 완료/오류 메시지는 더 이상 유효하지 않다 → 비운다
  // (생성 자체는 form을 바꾸지 않으므로 "✓ 완료" 직후엔 살아 있고, 첫 편집에 사라진다).
  useEffect(() => {
    setMsg("");
  }, [formSnap]);

  const setField = (key: string, value: unknown) =>
    updateDocContent(docId, { [key]: value } as never);

  async function onDocx() {
    if (!ok) return;
    setBusy(true);
    setMsg("Word 파일 생성 중…");
    try {
      await generateCollateralDoc(form, docId);
      setMsg("✓ Word(.docx) 생성 완료 — 다운로드를 확인하세요.");
      setGenSnap(formSnap);
    } catch (e) {
      setMsg("오류: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }
  function onPdf() {
    if (!ok) return;
    try {
      // 인쇄창이 실제로 열렸을 때만 "생성 완료" 표시 + 생성 신선도 스냅샷 기록.
      // 팝업이 차단돼 창이 열리지 않았는데 성공으로 표시하면, 만든 적 없는 PDF를
      // "생성됨(fresh)"으로 오인해(거짓 신선도) 잘못된/없는 버전을 제출할 위험이 있다.
      const opened = generateCollateralPDF(form, docId);
      if (opened) {
        setMsg("PDF 인쇄창을 열었습니다 — 인쇄 대화상자에서 'PDF로 저장'을 선택하세요.");
        setGenSnap(formSnap);
      } else {
        // 차단 시 genSnap 미기록 → freshness 가 거짓 fresh 로 남지 않는다.
        setMsg("PDF 창을 열지 못했습니다 — 브라우저 팝업 차단을 해제한 뒤 다시 시도해 주세요.");
      }
    } catch (e) {
      setMsg("오류: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  // 현재 미리보기를 새 창에서 전체 크기로 — 좁은 2분할 패널로는 어려운 다중
  // 페이지 법적 서류 정독 검수용. previewDocHTML 출력을 변형 없이 그대로 띄우는
  // 읽기 전용 보기(자동 인쇄 없음·조문 무접촉). 팝업 차단 시 PDF 생성과 동일하게
  // 성공으로 오인하지 않고 친화적 안내만 남긴다.
  function onExpandPreview() {
    // ★새 창은 항상 최신(라이브) form 으로 생성한다 — 인라인 미리보기는 타이핑
    // 끊김 방지를 위해 250ms 디바운스(debouncedForm)지만, 정독 검수 창은 디바운스
    // 대기 중이라도 직전 입력까지 반영된 최신본을 보여야 한다(법적 서류=정확성,
    // 구버전 정독 방지). JointForm onExpandPreview 와 동일 원칙(라이브 폼). 라이브
    // 생성이 드물게 throw 하면 디바운스 previewHtml 로 폴백해 빈 창을 띄우지 않는다.
    let live: string;
    try {
      live = previewDocHTML(form, docId);
    } catch {
      live = previewHtml;
    }
    const r = openDocPreviewWindow(live, () =>
      window.open("", "_blank", "width=980,height=1100"),
    );
    setPreviewNote(
      r === "blocked"
        ? "새 창을 열지 못했습니다 — 브라우저 팝업 차단을 해제한 뒤 다시 시도해 주세요."
        : "",
    );
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
            // 인라인 검증 — money 필드(신탁부동산 가격·신탁재산 원본가액)는 "채웠지만 0·음수·
            // 비숫자"이면 게이트(docMissing)가 이미 생성을 차단하나(별첨/신청서 가격칸이 빈칸·
            // 잘못된 금액으로 박히는 것을 막음), 그 사실을 입력 옆에서 즉시 알리지 않으면
            // amt>0 아님 → 한글 에코만 조용히 사라질 뿐, 무엇이 왜 막혔는지는 하단 검증 박스까지
            // 봐야 안다. 게이트와 같은 단일 출처(isPositiveAmount) + 같은 "채움" 조건(trim>0)을
            // 재사용해 판정 불일치 없이 그 입력 옆에서 즉시 짚어 준다(StepBasic 신탁보수·StepLoanCalc
            // 개별 대출금액 인라인 패리티, 표시/접근성만 — 빌더·조문·게이트 판정 무접촉).
            const moneyFilled = f.money && typeof val === "string" && val.trim().length > 0;
            const moneyInvalid = moneyFilled && !isPositiveAmount(val as string);
            // 자유 텍스트 날짜(평가기준일·회의 일자)는 산출물에 raw 그대로 박히므로, 입력이 숫자
            // 날짜꼴일 때 "YYYY년 M월 D일"로 해석을 에코해 월·일 전치(07-03↔03-07)를 확인하게 하고
            // 달력에 없는 날짜(2025-02-30)면 비차단 주의를 띄운다(계약 체결일 daysInMonth 클램프와
            // 같은 isRealDate 단일 출처). 날짜꼴이 아닌 free-form 은 null → 무간섭(형식 강제 없음).
            const dateInfo = f.date ? interpretDate(val as string) : null;
            // 지분율(%)은 실제소유자확인서(ubo)의 법적 정량값(특금법 실제소유자=25% 이상 지분)으로
            // 산출물 표에 raw 그대로 박힌다. 숫자꼴이면 0~100 범위·25% 기준 충족 여부를 에코해
            // 자릿수 오입력("5"↔"50")을 입력 지점에서 확인하게 하고, 범위 밖(0 이하·100 초과)이면
            // 비차단 주의를 띄운다(면적·날짜 readback 과 같은 isPositiveAmount/interpretDate 계열의
            // 표시 전용 확인 — 게이트·빌더·조문 무접촉, 자유 텍스트라 형식 강제·차단 없음).
            const pctInfo = f.pct ? interpretSharePct(val as string) : null;
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
                  aria-invalid={moneyInvalid || undefined}
                  aria-describedby={moneyInvalid ? `${fid}-err` : undefined}
                />
                {f.money && amt > 0 && (
                  <div className="amount-echo" role="status" aria-live="polite">
                    <span className="amount-echo-num">{fmtKRW(val as string)}</span>
                    <span className="amount-echo-hangul">{amountToHangul(val as string)}</span>
                  </div>
                )}
                {moneyInvalid && (
                  <div id={`${fid}-err`} className="field-hint" role="alert" style={{ color: "var(--c-danger)" }}>
                    유효하지 않은 금액입니다 — 0보다 큰 숫자만 입력할 수 있습니다 (이 값으로는 서류를 생성할 수 없습니다).
                  </div>
                )}
                {dateInfo && dateInfo.real && (
                  <div className="loan-hangul" role="status" aria-live="polite">
                    {dateInfo.year}년 {dateInfo.month}월 {dateInfo.day}일
                  </div>
                )}
                {dateInfo && !dateInfo.real && (
                  <div className="field-hint" role="status" style={{ color: "var(--c-danger)" }}>
                    달력에 없는 날짜일 수 있습니다 — 연·월·일을 확인해 주세요.
                  </div>
                )}
                {pctInfo && pctInfo.inRange && (
                  <div className="loan-hangul" role="status" aria-live="polite">
                    지분율 {pctInfo.pct}% · 실제소유자 기준(25% 이상) {pctInfo.meetsUbo ? "충족" : "미만"}
                  </div>
                )}
                {pctInfo && !pctInfo.inRange && (
                  <div className="field-hint" role="status" style={{ color: "var(--c-danger)" }}>
                    지분율은 0 초과 100 이하의 숫자로 확인해 주세요 (현재 {pctInfo.pct}).
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
          {freshness === "stale" ? (
            <span
              className="field-hint"
              role="status"
              aria-live="polite"
              style={{ color: "var(--c-danger)" }}
            >
              ● 입력이 변경되었습니다 — 다시 생성하세요
            </span>
          ) : (
            msg && (
              <span
                className="field-hint"
                role="status"
                aria-live="polite"
                style={{ color: "var(--c-blue-deep)" }}
              >
                {msg}
              </span>
            )
          )}
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
          {previewHtml && (
            <button
              type="button"
              className="preview-expand"
              onClick={onExpandPreview}
              title="현재 미리보기를 새 창에서 전체 크기로 봅니다(읽기 전용 — 인쇄 대화상자 없음)"
            >
              🔍 크게 보기
            </button>
          )}
        </div>
        {previewNote && (
          <div className="preview-note" role="status" aria-live="polite">
            {previewNote}
          </div>
        )}
        {previewHtml ? (
          // 읽기 전용 미리보기는 정적 HTML+CSS만 렌더한다(스크립트 불필요) → 완전
          // 격리 sandbox(빈 값=allow-* 전무)로 ① 스크립트 실행 불능 ② 부모 origin
          // 차단(opaque origin)을 강제한다. 빌더 출력은 이미 escHTML/escAttr 로
          // 이스케이프되고 stripAutoPrint 로 <script> 가 제거되지만, 이 미리보기는
          // 입력한 PII(주민번호·사업자번호 등)가 박힌 법적 서류라 그 두 방어가
          // 회귀해도(이벤트 핸들러 주입 등) 코드가 실행되거나 localStorage(저장 계약)에
          // 닿지 못하도록 방어심층화한다. 정적 렌더라 allow-scripts/allow-same-origin
          // 불요 — 표·조문·인라인 스타일은 sandbox 와 무관하게 그대로 표시된다.
          <iframe
            className="preview-frame"
            srcDoc={previewHtml}
            sandbox=""
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
