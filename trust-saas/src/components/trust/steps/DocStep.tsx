"use client";

import { useEffect, useMemo, useState } from "react";
import { useContractStore } from "@/lib/store/contractStore";
import { usePreviewOpen } from "@/lib/store/usePreviewOpen";
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
import { splitStatusGlyph } from "@/lib/ui/status-glyph";

// stale(입력 변경) 안내 문구 단일 출처 — 시각 span 과 SR 영속 라이브 영역이 같은 문구를
// 쓰도록 모듈 상수로 둔다(낭독은 글리프 ● 를 splitStatusGlyph 로 떼고 본문만). JointForm 동형.
const STALE_MSG = "● 입력이 변경되었습니다 — 다시 생성하세요";

// 동적 상태 메시지의 선두 장식 글리프(✓/●)를 aria-hidden 으로 감싸 시각만 보존하고
// 본문은 그대로 두는 시각-전용 렌더(ContractsView·JointForm StatusGlyphText 와 동형). 이
// span 들은 role=status 를 갖지 않으므로(낭독은 영속 영역 전담) 선형 탐색 시 글리프만 막는다.
function StatusGlyphText({ msg }: { msg: string }) {
  const { glyph, text } = splitStatusGlyph(msg);
  return (
    <>
      {glyph && <span aria-hidden="true">{glyph} </span>}
      {text}
    </>
  );
}

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
  // 미리보기 패널 접기/펼치기 — 좁은 화면(≤1080px)에선 미리보기가 입력 위로
  // 쌓여(order:-1, 60vh) 폼에 닿으려면 지나쳐 스크롤해야 하고, 넓은 화면에서도
  // 입력에 집중할 땐 미리보기 열을 접어 입력란을 전체 폭으로 쓰게 한다. 접어도
  // 머리말의 초안 배지·갱신 표시·"크게 보기"는 그대로라 검수 동선은 유지된다.
  // 표시 전용(조문/엔진/검증 게이트/산출물 무접촉) — 기본 펼침. 마지막 선택은
  // localStorage(previewPref)에 영속돼 문서 간·새로고침 후에도 유지된다(JointForm 공용).
  const [previewOpen, togglePreview] = usePreviewOpen();
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

  // 생성 상태(진행·완료·오류·stale)의 SR 영속 라이브 영역 단일 낭독 출처(JointForm 14:55·
  // ContractsView 14:05 선례). 종전엔 상태 span 이 `{freshness==="stale" ? … : (msg && …)}`
  // 로 **메시지가 생길 때 비로소 마운트**돼 라이브 영역이 콘텐츠 변경 '전'에 DOM 부재 →
  // 첫 메시지("Word 파일 생성 중…")가 미고지였다(DocStep=주력 계약 생성 동선인데 누락된 잔여).
  // stale 이면 변경 안내를, 아니면 생성 msg 를 — 장식 글리프(✓/●)는 떼고 본문만 고지한다.
  // 하단 시각 span 은 낭독 책임 없음(role=status 미부착=중복 낭독 0).
  const genLiveStatus =
    freshness === "stale"
      ? splitStatusGlyph(STALE_MSG).text
      : msg
        ? splitStatusGlyph(msg).text
        : "";

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
    <div className={previewOpen ? "doc-split" : "doc-split doc-split--preview-collapsed"}>
      {/* SR 영속 라이브 영역(WCAG 4.1.3) — 생성 진행·완료·오류·stale 상태를 항상-렌더
          단일 영역으로 고지(조건부 마운트 시 첫 메시지 미고지 결함 차단). 하단 시각 span
          은 낭독 책임 없음(role=status 미부착=중복 낭독 0). 시각 무변경(.sr-only). */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {genLiveStatus}
      </div>
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
              // 입력 지점 교차검증(표시 전용·게이트 아님) — 실제소유자확인서(ubo)의 "위탁자와
              // 동일 여부"(sameAsTrustor)를 "동일"로 표기했는데 위탁자가 모두 법인이면 부드럽게
              // 되짚는다. 특정금융정보법(§5의2)·시행령상 법인 고객의 실제소유자는 그 법인의
              // 지분을 25% 이상 보유한 자연인(없으면 대표자 등)으로, 법인 자신은 자신의
              // 실제소유자가 될 수 없다. 그런데 실제소유자 정보(ubo 블록)와 위탁자 유형(STEP 02
              // PartyCard 의 법인/개인)이 서로 다른 화면에서 입력돼, 위탁자가 법인인데도 "실제
              // 소유자 = 위탁자와 동일"이 조용히 성립할 수 있었다(개인 위탁자 폼을 법인으로
              // 바꾸고 ubo 를 손대지 않은 경우 등). ★false-positive 방지: 위탁자 중 한 명이라도
              // 개인이면 "동일"이 그 개인을 가리킬 수 있어 미표출 — 모든 위탁자가 법인일 때만
              // "동일"이 반드시 법인을 가리키므로 표출한다. 기존 입력(form.trustors[].type·ubo
              // sameAsTrustor) 파생이라 새 상태/모델/엔진/조문 무접촉이고, 막지 않는다(드물게
              // 1인 법인의 대표자=실제소유자를 "동일"로 본 사용자 의도 등 보존). 날짜·금액·
              // 당사자 동일주체 advisory 패밀리와 동형의 "차단 아닌 되짚음".
              const uboSameAsCorpTrustor =
                docId === "ubo" &&
                f.key === "sameAsTrustor" &&
                (val as string) === "yes" &&
                form.trustors.length > 0 &&
                form.trustors.every((t) => t.type === "법인");
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
                  {/* 입력 지점 교차검증(표시 전용·게이트 아님) — 실제소유자=위탁자 동일인데 위탁자가
                      모두 법인이면 "법인은 자신의 실제소유자가 될 수 없다"를 부드럽게 되짚는다(당사자
                      동일주체 advisory 패밀리와 동형의 "차단 아닌 되짚음"). form.trustors[].type·ubo
                      sameAsTrustor 파생이라 새 상태/모델/엔진/조문 무접촉. role=status·aria-live=polite
                      (동적 출현 SR 고지) + 선두 ⚠ aria-hidden(장식 접근명 오염 0). 색 = var(--c-brown)
                      (차단 적색 아님 — 검토 신호). */}
                  {uboSameAsCorpTrustor && (
                    <div className="field-hint" role="status" aria-live="polite" style={{ marginTop: 8, color: "var(--c-brown)", fontWeight: 600 }}>
                      <span aria-hidden="true">⚠ </span>
                      실제소유자가 위탁자와 동일로 표기됐으나 위탁자가 법인입니다 — 법인의 실제소유자는 그 법인의 지분을 25% 이상 보유한 자연인이어야 합니다(법인 자신은 실제소유자가 될 수 없음). 확인하세요.
                    </div>
                  )}
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
            // 입력 지점 교차검증(표시 전용·게이트 아님) — Doc 04(신탁재산 원본가액 신고서)의
            // 원본가액(principalValue)과 Doc 01(신청서·appform)의 신탁부동산 가격(valuationPrice)은
            // 같은 신탁 부동산의 평가액을 서로 다른 서류에서 각각 입력받는다. 통상 동일 평가액이라
            // 둘이 다르면 한쪽 오기(0 개수 오입력·구버전 평가) 가능성이 있어 입력 지점에서 부드럽게
            // 되짚는다(막지 않음 — 원본가액=장부가·가격=감정가처럼 정당하게 다를 수 있어 사용자
            // 선택 보존). 두 기존 입력의 순수 산술 비교일 뿐 새 상태/모델/엔진/조문 무접촉이고,
            // 어느 한쪽이라도 미입력·무효(양수 아님)이면 미표출한다(나그·오탐 방지). StepLoanCalc
            // 한도합계 vs 평가가격 advisory 와 동형의 "차단 아닌 되짚음".
            const crossPrice = form.docContents.appform?.valuationPrice;
            const valuationMismatch =
              docId === "valReport" &&
              f.key === "principalValue" &&
              isPositiveAmount(val as string) &&
              isPositiveAmount(crossPrice) &&
              parseAmount(val as string) !== parseAmount(crossPrice);
            // 입력 지점 교차검증(표시 전용·게이트 아님) — Doc 04(신탁재산 원본가액 신고서)의
            // 평가기준일(valuationDate)이 계약 체결일(common.year/month/day)보다 미래(뒤)인지
            // 순수 날짜 비교로 되짚는다. 담보신탁에서 신탁재산 평가(감정평가 등)는 통상 계약
            // 체결을 위한 선행 절차라 평가기준일은 체결일 당일 또는 그 이전인데, 평가기준일과
            // 체결일은 서로 다른 화면(Doc 04 자유 텍스트 ↔ STEP 05 드롭다운)에서 입력돼 평가
            // 기준일이 체결일보다 뒤인 선후 역전이 조용히 성립할 수 있었다(한쪽 날짜의 연도·
            // 월·일 오기 가능성). StepBasic 신탁기간 시작 vs 체결일 advisory(2eddf65)와 동형의
            // "차단 아닌 되짚음"으로, 이미 해석된 dateInfo(interpretDate 단일 출처)와 체결일을
            // Date.UTC 자정 기준(TZ·시각 성분 무영향)으로 비교할 뿐 새 상태/모델/엔진/조문
            // 무접촉이다. 날짜꼴 아님·비실재 날짜(dateInfo 없음/real=false)·체결일 일(日) 미정
            // 이면 미표출(나그·오탐 방지). 드물게 계약 후 재평가 등 정당한 경우의 사용자 선택을
            // 보존(막지 않음). 체결일과 같거나 이전이면 미표출.
            const valuationAfterContract =
              docId === "valReport" &&
              f.key === "valuationDate" &&
              dateInfo !== null &&
              dateInfo.real &&
              typeof form.common.day === "number" &&
              Date.UTC(dateInfo.year, dateInfo.month - 1, dateInfo.day) >
                Date.UTC(form.common.year, form.common.month - 1, form.common.day);
            // 입력 지점 교차검증(표시 전용·게이트 아님) — Doc 05(이사회 의사록·boardMin)의
            // 회의 일자(meetingDate)가 계약 체결일(common.year/month/day)보다 미래(뒤)인지
            // 순수 날짜 비교로 되짚는다. 담보신탁에서 위탁자(법인) 이사회의 담보신탁 결의는
            // 통상 계약 체결을 위한 선행 절차(결의 → 체결)라 회의 일자는 체결일 당일 또는
            // 그 이전인데, 회의 일자(Doc 05 자유 텍스트)와 체결일(STEP 05 드롭다운)이 서로
            // 다른 화면에서 입력돼 회의 일자가 체결일보다 뒤인 선후 역전(한쪽 날짜의 연도·
            // 월·일 오기 가능성)이 조용히 성립할 수 있었다. 평가기준일 vs 체결일 advisory
            // (d2a6f23)와 동형의 "차단 아닌 되짚음"으로, 이미 해석된 dateInfo(interpretDate
            // 단일 출처)와 체결일을 Date.UTC 자정 기준(TZ·시각 성분 무영향)으로 비교할 뿐
            // 새 상태/모델/엔진/조문 무접촉이다. 날짜꼴 아님·비실재 날짜·체결일 일(日) 미정·
            // 체결일과 같거나 이전이면 미표출(나그·오탐 방지). 드물게 추인 결의 등 정당한
            // 경우의 사용자 선택을 보존(막지 않음).
            const boardMeetingAfterContract =
              docId === "boardMin" &&
              f.key === "meetingDate" &&
              dateInfo !== null &&
              dateInfo.real &&
              typeof form.common.day === "number" &&
              Date.UTC(dateInfo.year, dateInfo.month - 1, dateInfo.day) >
                Date.UTC(form.common.year, form.common.month - 1, form.common.day);
            // 입력 지점 교차검증(표시 전용·게이트 아님) — Doc 05(이사회 의사록·boardMin)는
            // 스키마상 "위탁자(법인) 이사회의 담보신탁 결의" 서류다(이사회=법인의 의사결정
            // 기관). 그런데 위탁자가 모두 개인(자연인)이면 이사회 자체가 존재하지 않아 이
            // 서류의 작성 전제가 성립하지 않는다. 위탁자 유형(STEP 02 PartyCard 의 법인/개인)과
            // 이사회 의사록 입력(Doc 05 자유 텍스트)이 서로 다른 화면에서 입력돼, 위탁자가
            // 모두 개인인데도 이사회 의사록이 조용히 채워질 수 있었다(법인 위탁자 폼을 개인으로
            // 바꾸고 Doc 05 를 손대지 않은 경우, 또는 개인 위탁자인데 서류를 잘못 고른 경우).
            // ubo=위탁자 동일·전원 법인 advisory(c75053c)의 대칭(역) 형태로, 거기는 every(법인)
            // 일 때 표출하고 여기는 every(개인)일 때 표출한다. ★false-positive 방지: 위탁자 중
            // 한 명이라도 법인이면 그 법인의 이사회 결의로 정당하므로 미표출 — every(개인)일
            // 때만 이사회 부재가 확실해 표출한다. 회의 일자(meetingDate)가 채워졌을 때만(이
            // 서류를 실제 작성 중이라는 신호) 띄우고, 날짜 실재 여부와 무관하다(구조 부정합은
            // 날짜 유효성과 별개). 기존 입력(form.trustors[].type · meetingDate) 파생이라 새
            // 상태/모델/엔진/조문 무접촉이고, 막지 않는다(드물게 정당한 작성 의도 보존).
            const boardMinIndividualTrustor =
              docId === "boardMin" &&
              f.key === "meetingDate" &&
              typeof val === "string" &&
              val.trim().length > 0 &&
              form.trustors.length > 0 &&
              form.trustors.every((t) => t.type === "개인");
            // 입력 지점 교차검증(표시 전용·게이트 아님) — 실제소유자확인서(ubo)에서 "위탁자와
            // 동일 여부"(sameAsTrustor)를 "다름"(no)으로 표기하면, 실제소유자는 위탁자 본인이
            // 아닌 별도 자연인이므로 그 성명(uboName)을 반드시 식별해 기재해야 한다(특정금융
            // 정보법 §5의2·시행령: 법인 고객의 실제소유자 = 그 법인 지분 25% 이상 보유 자연인).
            // 그런데 "다름" 라디오와 성명 텍스트가 같은 서류 안의 서로 다른 입력이라, "다름"을
            // 고른 뒤 성명을 비워 둔 채(또는 "동일"→"다름"으로 바꾸고 성명을 안 채운 채) 조용히
            // 진행될 수 있었다 → 산출물(실제소유자확인서)에 실소유자 성명칸이 빈칸으로 박힌다.
            // ubo=위탁자 동일·전원 법인 advisory(c75053c)의 보완 갈래로, 거기는 "동일"인데 법인일
            // 때(법인은 자기 실소유자가 될 수 없음) 표출하고, 여기는 "다름"인데 그 별도 자연인을
            // 안 적었을 때 표출한다. 두 기존 입력(ubo.sameAsTrustor·uboName) 파생이라 새 상태/모델/
            // 엔진/조문 무접촉이고, 막지 않는다(작성 중 임시 빈칸 등 사용자 선택 보존 — 표시뿐).
            const uboDistinctNameMissing =
              docId === "ubo" &&
              f.key === "uboName" &&
              form.docContents.ubo?.sameAsTrustor === "no" &&
              (typeof val !== "string" || val.trim().length === 0);
            // 입력 지점 교차검증(표시 전용·게이트 아님) — 위 uboDistinctNameMissing(성명)의 동형
            // 보완 갈래로, 실제소유자=위탁자 "다름"(no)인데 지분율(uboShare)을 비워 두면 산출물
            // (실제소유자확인서) 고유정보 표의 "지분율 (%)" 칸이 빈칸으로 박힌다(builders.js docRows:
            // kvRow("지분율 (%)", raw)). 지분율은 특정금융정보법 §5의2상 실제소유자(그 법인 지분 25%
            // 이상 보유 자연인)를 식별하는 법적 정량값이라 별도 자연인을 지정했으면 그 보유 지분도
            // 식별해 기재해야 한다. 값이 채워지면 같은 필드의 pctInfo readback(충족/미만)이 대신
            // 뜨므로(interpretSharePct: 빈 문자열이면 null) 둘은 상호배타다. 두 기존 입력
            // (ubo.sameAsTrustor·uboShare) 파생이라 새 상태/모델/엔진/조문 무접촉이고, 막지 않는다
            // (작성 중 임시 빈칸 등 사용자 선택 보존 — 표시뿐).
            const uboShareDistinctMissing =
              docId === "ubo" &&
              f.key === "uboShare" &&
              form.docContents.ubo?.sameAsTrustor === "no" &&
              (typeof val !== "string" || val.trim().length === 0);
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
                {/* 입력 지점 교차검증(표시 전용·게이트 아님) — 원본가액(Doc 04) ≠ 신탁부동산 가격(Doc 01)
                    이면 같은 부동산 평가액이 문서마다 다른지 부드럽게 되짚는다(StepLoanCalc 한도합계 vs
                    평가가격 advisory 와 동형의 "차단 아닌 되짚음"). 두 기존 입력 파생이라 새 상태/모델/
                    엔진/조문 무접촉. role=status·aria-live=polite(동적 출현 SR 고지) + 선두 ⚠ aria-hidden
                    (장식 접근명 오염 0). 색 = var(--c-brown)(차단 적색 아님 — 검토 신호). */}
                {valuationMismatch && (
                  <div className="field-hint" role="status" aria-live="polite" style={{ color: "var(--c-brown)", fontWeight: 600 }}>
                    <span aria-hidden="true">⚠ </span>
                    신탁재산 원본가액({parseAmount(val as string).toLocaleString()} 원)이 신청서(Doc 01)에 입력한 신탁부동산 가격({parseAmount(crossPrice).toLocaleString()} 원)과 다릅니다 — 같은 부동산 평가액이 문서마다 다른지 확인하세요.
                  </div>
                )}
                {dateInfo && dateInfo.real && (
                  <div className="loan-hangul" role="status" aria-live="polite">
                    {dateInfo.year}년 {dateInfo.month}월 {dateInfo.day}일{dateInfo.weekday && ` (${dateInfo.weekday})`}
                  </div>
                )}
                {dateInfo && !dateInfo.real && (
                  <div className="field-hint" role="status" style={{ color: "var(--c-danger)" }}>
                    달력에 없는 날짜일 수 있습니다 — 연·월·일을 확인해 주세요.
                  </div>
                )}
                {/* 입력 지점 교차검증(표시 전용·게이트 아님) — 평가기준일(Doc 04)이 계약 체결일보다
                    미래(뒤)이면 한쪽 날짜 오기 가능성을 부드럽게 되짚는다(StepBasic 신탁기간 시작 vs
                    체결일 advisory 와 동형의 "차단 아닌 되짚음"). dateInfo·form.common 파생이라 새 상태/
                    모델/엔진/조문 무접촉. role=status·aria-live=polite(동적 출현 SR 고지) + 선두 ⚠
                    aria-hidden(장식 접근명 오염 0). 색 = var(--c-brown)(차단 적색 아님 — 검토 신호). */}
                {valuationAfterContract && (
                  <div className="field-hint" role="status" aria-live="polite" style={{ color: "var(--c-brown)", fontWeight: 600 }}>
                    <span aria-hidden="true">⚠ </span>
                    평가기준일({dateInfo!.year}년 {dateInfo!.month}월 {dateInfo!.day}일)이 계약 체결일({form.common.year}년 {form.common.month}월 {form.common.day}일)보다 뒤입니다 — 통상 신탁재산 평가는 계약 체결 이전 또는 당일에 이뤄집니다. 확인하세요.
                  </div>
                )}
                {/* 입력 지점 교차검증(표시 전용·게이트 아님) — 이사회 회의 일자(Doc 05)가 계약
                    체결일보다 미래(뒤)이면 한쪽 날짜 오기 가능성을 부드럽게 되짚는다(평가기준일
                    vs 체결일 advisory 와 동형의 "차단 아닌 되짚음" — 결의→체결 선행 통상). dateInfo·
                    form.common 파생이라 새 상태/모델/엔진/조문 무접촉. role=status·aria-live=polite
                    (동적 출현 SR 고지) + 선두 ⚠ aria-hidden(장식 접근명 오염 0). 색 = var(--c-brown)
                    (차단 적색 아님 — 검토 신호). */}
                {boardMeetingAfterContract && (
                  <div className="field-hint" role="status" aria-live="polite" style={{ color: "var(--c-brown)", fontWeight: 600 }}>
                    <span aria-hidden="true">⚠ </span>
                    이사회 회의 일자({dateInfo!.year}년 {dateInfo!.month}월 {dateInfo!.day}일)가 계약 체결일({form.common.year}년 {form.common.month}월 {form.common.day}일)보다 뒤입니다 — 통상 위탁자 이사회의 담보신탁 결의는 계약 체결 이전 또는 당일에 이뤄집니다. 확인하세요.
                  </div>
                )}
                {/* 입력 지점 교차검증(표시 전용·게이트 아님) — 이사회 의사록(Doc 05)을 작성 중인데
                    위탁자가 모두 개인이면 "이사회는 법인의 기관 — 개인 위탁자는 이사회가 없다"를
                    부드럽게 되짚는다(ubo=위탁자 동일·전원 법인 advisory 의 대칭 형태). form.trustors[].type·
                    meetingDate 파생이라 새 상태/모델/엔진/조문 무접촉. role=status·aria-live=polite(동적
                    출현 SR 고지) + 선두 ⚠ aria-hidden(장식 접근명 오염 0). 색 = var(--c-brown)(차단 적색
                    아님 — 검토 신호). */}
                {boardMinIndividualTrustor && (
                  <div className="field-hint" role="status" aria-live="polite" style={{ color: "var(--c-brown)", fontWeight: 600 }}>
                    <span aria-hidden="true">⚠ </span>
                    이사회 의사록은 위탁자(법인) 이사회의 담보신탁 결의 서류인데 현재 위탁자가 모두 개인입니다 — 개인(자연인) 위탁자는 이사회가 없습니다. 위탁자 유형 또는 이 서류 작성 여부를 확인하세요.
                  </div>
                )}
                {/* 입력 지점 교차검증(표시 전용·게이트 아님) — 실제소유자=위탁자 "다름"인데 실제
                    소유자 성명이 비어 있으면 "별도 자연인을 지정했으면 그 성명을 식별해야 한다"를
                    부드럽게 되짚는다(ubo=위탁자 동일·전원 법인 advisory 의 보완 갈래). ubo.sameAsTrustor·
                    uboName 파생이라 새 상태/모델/엔진/조문 무접촉. role=status·aria-live=polite(동적
                    출현 SR 고지) + 선두 ⚠ aria-hidden(장식 접근명 오염 0). 색 = var(--c-brown)(차단
                    적색 아님 — 검토 신호). */}
                {uboDistinctNameMissing && (
                  <div className="field-hint" role="status" aria-live="polite" style={{ color: "var(--c-brown)", fontWeight: 600 }}>
                    <span aria-hidden="true">⚠ </span>
                    실제소유자가 위탁자와 다르다고 표기했으나 실제 소유자 성명이 비어 있습니다 — 특정금융정보법상 법인의 실제소유자(그 법인 지분 25% 이상 보유 자연인)의 성명을 입력하세요.
                  </div>
                )}
                {/* 입력 지점 교차검증(표시 전용·게이트 아님) — 실제소유자=위탁자 "다름"인데 지분율이
                    비어 있으면 "별도 자연인을 지정했으면 그 보유 지분도 식별해야 한다"를 부드럽게
                    되짚는다(uboDistinctNameMissing 성명 advisory 의 동형 보완 갈래 — 거기는 성명 빈칸,
                    여기는 지분율 빈칸). 값이 채워지면 아래 pctInfo readback 이 대신 뜨므로 상호배타.
                    ubo.sameAsTrustor·uboShare 파생이라 새 상태/모델/엔진/조문 무접촉. role=status·
                    aria-live=polite(동적 출현 SR 고지) + 선두 ⚠ aria-hidden(장식 접근명 오염 0). 색 =
                    var(--c-brown)(차단 적색 아님 — 검토 신호). */}
                {uboShareDistinctMissing && (
                  <div className="field-hint" role="status" aria-live="polite" style={{ color: "var(--c-brown)", fontWeight: 600 }}>
                    <span aria-hidden="true">⚠ </span>
                    실제소유자가 위탁자와 다르다고 표기했으나 지분율(%)이 비어 있습니다 — 산출물 실제소유자확인서의 지분율 칸이 빈칸으로 출력됩니다. 특정금융정보법상 실제소유자(그 법인 지분 25% 이상 보유 자연인)의 지분율을 입력하세요.
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
          <strong><span aria-hidden="true">📝 </span>양식 안내</strong> 현재 출력은 입력값 검증용 표준(안)입니다. 회사 표준양식(.docx)
          수급 시 입력값이 양식 변수에 자동 치환됩니다.
        </div>

        {/* ── 검증 게이트 안내 (M2-2) ── */}
        {!ok && (
          <div className="validate-box" role="alert">
            <div className="validate-title"><span aria-hidden="true">⚠ </span>생성 전 필수 입력이 누락되었습니다</div>
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
            <span aria-hidden="true">📄 </span>Word(.docx) 생성
          </button>
          <button
            className="btn btn-ghost"
            onClick={onPdf}
            disabled={busy || !ok}
            title={ok ? "" : "필수 입력을 모두 채우면 활성화됩니다"}
          >
            <span aria-hidden="true">🖨 </span>PDF 생성
          </button>
          {/* 시각 표시 전용 — 낭독은 상단 영속 라이브 영역(genLiveStatus)이 담당(role=status
              미부착=중복 낭독 0). 글리프(✓/●)는 StatusGlyphText 로 aria-hidden(시각 보존). */}
          {freshness === "stale" ? (
            <span className="field-hint" style={{ color: "var(--c-danger)" }}>
              <StatusGlyphText msg={STALE_MSG} />
            </span>
          ) : (
            msg && (
              <span className="field-hint" style={{ color: "var(--c-blue-deep)" }}>
                <StatusGlyphText msg={msg} />
              </span>
            )
          )}
        </div>
      </div>

      {/* ── 우: 실시간 미리보기 (선택 서류 그대로, 실제 생성물과 동일) ── */}
      <aside className="doc-split-preview">
        <div className="preview-head">
          <span className="preview-badge">실시간 미리보기</span>
          {/* 미리보기는 부분 입력도 빈칸으로 렌더하므로, 필수 입력이 누락된(!ok) 동안엔
              이 미리보기가 완성본이 아니라 초안임을 미리보기 쪽에서 직접 표시한다(좌측
              검증 게이트만 보이는 입력 옆에 있어 우측 미리보기만 보면 누락을 놓침). 낭독은
              좌측 validate-box(role=alert)가 전담 → 시각 표시 전용(글리프 aria-hidden). */}
          {previewHtml && !ok && (
            <span className="preview-badge-draft">
              <span aria-hidden="true">✎ </span>초안 · 필수 입력 {missing.length}개 남음
            </span>
          )}
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
              <span aria-hidden="true">🔍 </span>크게 보기
            </button>
          )}
          {/* 미리보기 접기/펼치기 — 입력란을 전체 폭으로(좁은 화면 force-stack 우회·
              넓은 화면 입력 집중). 의미는 가시 텍스트(접기/펼치기)가 전달, 선두 글리프는
              장식이라 aria-hidden. aria-expanded 로 상태를, aria-controls 로 대상 본문을
              SR 에 고지. previewHtml 유무와 무관하게 항상 노출(빈 상태에서도 폭 확보 가능). */}
          <button
            type="button"
            className="preview-toggle"
            onClick={togglePreview}
            aria-expanded={previewOpen}
            aria-controls="doc-preview-body"
            title={
              previewOpen
                ? "미리보기를 접어 입력란을 넓게 씁니다(머리말·크게 보기는 유지)"
                : "미리보기를 다시 펼칩니다"
            }
          >
            <span aria-hidden="true">{previewOpen ? "▾ " : "▸ "}</span>
            {previewOpen ? "접기" : "펼치기"}
          </button>
        </div>
        {previewNote && (
          <div className="preview-note" role="status" aria-live="polite">
            {previewNote}
          </div>
        )}
        {/* 접기 대상 본문 — hidden 으로 레이아웃에서 제거(display:none)해 입력란이
            전체 폭을 쓰게 한다. iframe 은 언마운트하지 않고 hidden 만 토글해 펼칠 때
            재로딩 없이 직전 미리보기를 즉시 보여준다(접기≠초기화). previewNote 는
            래퍼 밖이라 접어도 보인다(팝업 차단 안내 유실 방지). */}
        <div id="doc-preview-body" className="doc-preview-body" hidden={!previewOpen}>
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
        </div>
      </aside>
    </div>
  );
}
