"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useContractStore } from "@/lib/store/contractStore";
import { usePreviewOpen } from "@/lib/store/usePreviewOpen";
import { generateJointDoc, generateJointPDFDoc, previewJointHTML, jointDocFileName, jointPdfTitle } from "@/lib/engine/docx";
import {
  downloadKeyCollidesWithSaved,
  snapshotContracts,
  subscribeContracts,
  contractCount,
} from "@/lib/contractRepo";
import { downloadKeyOf } from "@/lib/ui/download-key";
import { openDocPreviewWindow } from "@/lib/ui/preview-window";
import { validateJoint, jointFieldIdForMissing } from "@/lib/engine/validate";
import { genFreshness } from "@/lib/engine/genStatus";
import { isValidCorpRegNo, isRealDate, weekdayKo } from "@/lib/engine/calc";
import { splitStatusGlyph } from "@/lib/ui/status-glyph";

// stale(입력 변경) 안내 문구 단일 출처 — 시각 span 과 SR 영속 라이브 영역이 같은 문구를
// 쓰도록 모듈 상수로 둔다(낭독은 글리프 ● 를 splitStatusGlyph 로 떼고 본문만).
const STALE_MSG = "● 입력이 변경되었습니다 — 다시 생성하세요";

// 동적 상태 메시지의 선두 장식 글리프(✓/●)를 aria-hidden 으로 감싸 시각만 보존하고
// 본문은 그대로 두는 시각-전용 렌더(ContractsView StatusGlyphText 와 동형). 이 span 들은
// role=status 를 갖지 않으므로(낭독은 영속 영역 전담) 선형 탐색 시 글리프 낭독만 막는다.
function StatusGlyphText({ msg }: { msg: string }) {
  const { glyph, text } = splitStatusGlyph(msg);
  return (
    <>
      {glyph && <span aria-hidden="true">{glyph} </span>}
      {text}
    </>
  );
}

// 입력 중에는 값 반영을 잠깐 미뤄(미리보기 한정) 매 키 입력마다 완성 협약서
// HTML 재생성·iframe srcDoc 재파싱을 막는다(담보신탁 DocStep 과 동일 패턴).
// 입력 필드는 store를 직접 읽어 즉시 반영(이 디바운스 영향 없음).
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function JointForm() {
  const { jointForm, updateJoint, currentContractId } = useContractStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // "크게 보기"(새 창) 팝업 차단 안내. 차단 외에는 비워 둔다.
  const [previewNote, setPreviewNote] = useState("");
  // 미리보기 접기/펼치기(담보신탁 DocStep 과 동형) — 기본 펼침(true·후방호환).
  // 접으면 입력란이 전체 폭(좁은 화면 force-stack 우회·넓은 화면 입력 집중).
  // 마지막 선택은 localStorage(previewPref)에 영속돼 DocStep 과 공유·유지된다.
  const [previewOpen, togglePreview] = usePreviewOpen();
  // 마지막 생성(Word/PDF) 시점의 입력 스냅샷. 이후 입력이 바뀌면 "✓ 완료"
  // 확인이 구버전을 최신으로 오인시키므로(법적 서류=정확성) "다시 생성하세요"로
  // 전환한다(담보신탁 DocStep onDocx/onPdf 신선도와 동일 단일 출처 판정).
  const [genSnap, setGenSnap] = useState<string | null>(null);
  const gap = jointForm.gap;
  const project = jointForm.project;

  // ── 우측 실시간 미리보기 (담보신탁 DocStep 과 동형) — 완성 협약서를 그대로
  //    iframe srcdoc 으로 격리 렌더(WYSIWYG, 실제 산출물과 동일). jointForm 은
  //    250ms 디바운스해 빠른 연속 입력 시 재생성 횟수를 줄인다.
  const debouncedForm = useDebounced(jointForm, 250);
  // store 는 매 수정마다 새 jointForm 참조를 만들므로(스프레드) 참조 불일치가
  // "갱신 대기" 신호 — 그 동안만 "갱신 중…" 인디케이터를 표시한다.
  const previewPending = jointForm !== debouncedForm;
  const previewHtml = useMemo(() => {
    try {
      return previewJointHTML(debouncedForm);
    } catch {
      return "";
    }
  }, [debouncedForm]);

  // ── 검증 게이트 (담보신탁 DocStep 과 동형) — 필수 입력 충족 시에만 생성 활성화.
  //    미리보기와 달리 라이브 jointForm 을 직접 읽어 즉시 반영(디바운스 영향 없음).
  const { ok, missing } = useMemo(() => validateJoint(jointForm), [jointForm]);

  // 다운로드 직전 "받게 될 파일명" 미리보기 (담보신탁 DocStep 과 동형) — generateJointDoc 이
  // 실제 저장하는 .docx 이름(jointDocFileName → jointFileBase: 공동사업표준협약서_{갑 상호})과
  // 단일 출처라 미리보기와 실제 다운로드명이 어긋나지 않는다(드리프트 0). 표시 전용 — 조문/
  // 엔진/검증 게이트(validateJoint)/산출물 동작 무접촉.
  const docxFileName = useMemo(() => jointDocFileName(jointForm), [jointForm]);
  // PDF 경로("PDF 생성" → 인쇄창)는 "PDF로 저장" 시 브라우저가 인쇄 HTML <title>(jointPdfTitle
  // = `공동사업표준협약서_{갑 상호} (PDF)`)을 파일명으로 제안한다 — .docx 와 다른 이름이라 함께 고지(드리프트 0).
  const pdfFileName = useMemo(() => jointPdfTitle(jointForm), [jointForm]);

  // 다운로드 직전 "파일명 충돌" 사전 경고 (담보신탁 DocStep 4b7c513 의 joint 짝) — 같은
  // 다운로드 식별 키(joint 는 갑 상호 = `joint:{gap.name}`)의 다른 저장 계약이 있으면, 지금
  // 생성·다운로드할 .docx/PDF 가 그 계약 파일과 섞일 수 있다(브라우저가 덮어쓰거나 "(1)"
  // 자동부여 — 신탁 서류는 법적 효력 문서라 섞임은 정확성 위험). downloadKeyOf 는 내 계약
  // 목록의 사후 경고(collidingDownloadIds)·DocStep 사전 경고와 동일한 단일 출처(lib/ui/
  // download-key)라 세 표면의 판정이 어긋나지 않는다(드리프트 0). 작성 중 계약 자신
  // (currentContractId)은 제외. 저장 변경에 구독(useSyncExternalStore)해 다른 계약을 저장·
  // 삭제하면 경고가 살아 있게 한다(staleness 0). ★표시 전용 — 조문/엔진/검증 게이트
  // (validateJoint)/산출물(docx/PDF) 동작 무접촉(식별 키 비교만).
  const currentDownloadKey = useMemo(
    () => downloadKeyOf({ doc_type: "joint", form_data: jointForm }),
    [jointForm],
  );
  const savedCount = useSyncExternalStore(subscribeContracts, contractCount, () => 0);
  const filenameCollision = useMemo(
    () => downloadKeyCollidesWithSaved(snapshotContracts(), currentContractId, currentDownloadKey, downloadKeyOf),
    [savedCount, currentContractId, currentDownloadKey],
  );

  // ── 인라인 검증 피드백 (담보신탁 PartyCard/StepBasic 패리티) — 게이트(validateJoint)는
  //    하단 .validate-box 에 누락을 모아 알려 주지만, "그 필드 옆"에서 입력 즉시 오류를
  //    짚어 주는 인라인 안내는 joint 에 없었다. 담보신탁 PartyCard 의 corpInvalid 와 동형으로
  //    게이트와 같은 단일 출처(isValidCorpRegNo·isRealDate)를 써 판정 불일치를 막는다.
  //    부분 입력 중에는 표시하지 않는다(나그 방지) — 완전 입력 + 무효일 때만 안내.
  const gapCorpDigits = [gap.corpRegFront, gap.corpRegBack].map((x) => x ?? "").join("").replace(/\D/g, "");
  const gapCorpInvalid = gapCorpDigits.length === 13 && !isValidCorpRegNo(gapCorpDigits);
  // 협약일은 자유 텍스트(담보신탁은 유효일만 노출하는 드롭다운이라 인라인 불요)라 2월 31일 등
  // 실재하지 않는 날짜를 타이핑할 수 있다 → 연·월·일 3칸이 모두 채워졌는데 달력상 없는 날짜일
  // 때만 안내(비숫자도 Number→NaN→isRealDate=false 로 동일 처리). 게이트와 동일 isRealDate.
  const agY = String(project.agreementYear ?? "").trim();
  const agM = String(project.agreementMonth ?? "").trim();
  const agD = String(project.agreementDay ?? "").trim();
  const agreementDateInvalid =
    agY !== "" && agM !== "" && agD !== "" && !isRealDate(Number(agY), Number(agM), Number(agD));
  // 협약일이 실재하는 날짜면 "YYYY년 M월 D일"로 해석을 에코한다(담보신탁 DocStep 자유 텍스트
  // 날짜 readback 패리티). 협약일은 협약서 제1조·서명란에 박히는 법적 날짜인데, 연·월·일이
  // 따로따로 자유 텍스트라 "3월 7일 ↔ 7월 3일" 같은 월·일 전치는 둘 다 달력상 실재하는 날짜라
  // agreementDateInvalid(실재하지 않는 날짜) 검사로는 잡히지 않는다. 해석한 날짜를 그대로 되읽어
  // 주면 사용자가 입력 지점에서 전치를 확인할 수 있다(비차단·표시 경계, 게이트 판정 무접촉).
  // agreementDateInvalid 와 상호배타(실재=readback / 비실재=invalid 안내)·게이트와 동일 isRealDate.
  const agreementDateReal =
    agY !== "" && agM !== "" && agD !== "" && isRealDate(Number(agY), Number(agM), Number(agD));

  // ── 생성 신선도 (담보신탁 DocStep 과 동형) — 값 기반 입력 스냅샷(참조 동일성
  //    대신 직렬화 비교, store dirty 추적과 동일 패턴). 생성 후 입력이 바뀌면
  //    none(미생성)·fresh(무변경)·stale(변경됨) 판정으로 재생성 안내한다.
  const formSnap = useMemo(() => JSON.stringify(jointForm), [jointForm]);
  const freshness = genFreshness(formSnap, genSnap);

  // 생성 상태(진행·완료·오류·stale)의 SR 영속 라이브 영역 단일 낭독 출처(ContractsView 14:05
  // 선례). 종전엔 생성 msg span 이 `{msg && <span role="status">…}` 로 **메시지가 생길 때
  // 비로소 마운트**돼 라이브 영역이 콘텐츠 변경 '전'에 DOM 부재 → 첫 메시지("Word 생성 중…")
  // 미고지였다. stale 이면 변경 안내를, 아니면 생성 msg 를 — 장식 글리프(✓/●)는 떼고 본문만
  // 고지한다. 하단 시각 span 은 낭독 책임 없음(role=status 미부착=중복 낭독 0).
  const genLiveStatus =
    freshness === "stale"
      ? splitStatusGlyph(STALE_MSG).text
      : msg
        ? splitStatusGlyph(msg).text
        : "";

  // 입력이 바뀌면 직전 생성 완료/오류 메시지는 더 이상 유효하지 않다 → 비운다
  // (생성 자체는 jointForm 을 바꾸지 않으므로 "✓ 완료" 직후엔 살아 있고,
  //  첫 편집에 사라져 stale 안내가 드러난다 — DocStep formSnap effect 와 동형).
  useEffect(() => {
    setMsg("");
  }, [formSnap]);

  const setGap = (patch: Partial<typeof gap>) => updateJoint({ gap: { ...gap, ...patch } });
  const setProject = (patch: Partial<typeof project>) =>
    updateJoint({ project: { ...project, ...patch } });

  async function onDocx() {
    if (!ok) return; // 버튼 disabled 와 더불어 방어적 차단(빈 칸 협약서 생성 방지)
    setBusy(true);
    setMsg("Word 생성 중…");
    try {
      await generateJointDoc(jointForm);
      setMsg("✓ Word(.docx) 생성 완료.");
      setGenSnap(formSnap); // 생성 시점 스냅샷 = 이후 편집을 stale 로 판정할 기준선
    } catch (e) {
      setMsg("오류: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }
  function onPdf() {
    if (!ok) return; // 버튼 disabled 와 더불어 방어적 차단
    try {
      // 인쇄창이 실제로 열렸을 때만 성공으로 표시한다. 팝업이 차단돼 창이 열리지
      // 않았는데(generateJointPDFDoc=false, 빌더가 alert 만 띄움) "열었습니다"로
      // 표시하면 만든 적 없는 PDF 를 성공으로 오인한다(담보신탁 DocStep onPdf 와
      // 동일 원칙 — 팝업 차단 거짓 성공 차단, 법적 서류=정확성).
      const opened = generateJointPDFDoc(jointForm);
      if (opened) {
        // 인쇄창이 실제로 열렸을 때만 성공 표시 + 생성 신선도 스냅샷 기록.
        setMsg("PDF 인쇄창을 열었습니다 — 인쇄 대화상자에서 'PDF로 저장'을 선택하세요.");
        setGenSnap(formSnap);
      } else {
        // 차단 시 genSnap 미기록 → freshness 가 거짓 fresh 로 남지 않는다(거짓 신선도 방지).
        setMsg("PDF 창을 열지 못했습니다 — 브라우저 팝업 차단을 해제한 뒤 다시 시도해 주세요.");
      }
    } catch (e) {
      setMsg("오류: " + (e instanceof Error ? e.message : String(e)));
    }
  }
  // 협약서 전체를 새 창에서 전체 크기로 정독 검수(생성 전 육안 확인). 완성
  // 미리보기(previewJointHTML)를 변형 없이 띄우는 읽기 전용 보기(자동 인쇄 없음·
  // 조문 무접촉). 팝업 차단 시 PDF 생성과 동일하게 성공으로 오인하지 않고 안내만.
  function onExpandPreview() {
    // 새 창은 항상 최신(라이브) jointForm 으로 — 디바운스 대기 중에도 정독은
    // 즉시 최신을 보여 준다. 라이브 생성이 드물게 throw 하면 디바운스 previewHtml 로
    // 폴백해 빈 창/미처리 예외를 막는다(담보신탁 DocStep onExpandPreview 와 동일 방어).
    // 차단 시 PDF 생성과 동일하게 성공 오인 없이 안내만.
    let live: string;
    try {
      live = previewJointHTML(jointForm);
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

  // 입력 필드 id 로 스크롤·포커스(담보신탁 DocStep goToStep 의 단일 폼 버전 — 스텝이
  // 없으므로 필드 자체로 데려간다). 검증 게이트 누락 점프(focusMissing)와 파일명 충돌
  // 식별값 점프가 공유하는 단일 동선. DOM 에 없는 id 면 무동작(死점프 0).
  function focusFieldById(id: string) {
    const el = typeof document !== "undefined" ? document.getElementById(id) : null;
    if (!el) return;
    // 모션 감축 설정(prefers-reduced-motion: reduce) 시 부드러운 스크롤은 JS 옵션이라
    // CSS scroll-behavior 로 꺼지지 않으므로 여기서 존중해 즉시(auto) 스크롤한다(WCAG 2.3.3).
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    (el as HTMLElement).focus({ preventScroll: true });
  }

  // 검증 게이트 누락 항목 클릭 → 해당 입력 필드로. 매핑은 validate.ts 단일 출처
  // (jointFieldIdForMissing). 매칭 실패(미상 라벨)는 무동작.
  function focusMissing(label: string) {
    const id = jointFieldIdForMissing(label);
    if (!id) return;
    focusFieldById(id);
  }

  return (
    <main className="page active">
      <div className="page-header">
        <div className="page-eyebrow">공동사업표준협약서</div>
        <h1 className="page-title">공동사업표준협약서</h1>
        <p className="page-desc">
          &lsquo;을&rsquo; = 한국투자부동산신탁(고정), &lsquo;갑&rsquo; = 시행사(입력). 정보를 입력하면
          협약서를 Word·PDF로 생성합니다.
        </p>
      </div>

      {/* 생성 상태 SR 영속 라이브 영역 — 진행(생성 중…)·완료·오류·stale 을 첫 메시지부터 고지.
          ★항상 렌더(영속) → 라이브 영역이 콘텐츠 변경 '전'에 이미 DOM 에 존재(ContractsView·
          advisor .advisor-live 선례). 시각 표시는 하단 버튼 행 span 이 담당, 이 영역은 낭독 전용. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {genLiveStatus}
      </div>

      <div className={previewOpen ? "doc-split" : "doc-split doc-split--preview-collapsed"}>
        {/* ── 좌: 입력 ── */}
        <div className="doc-split-input">
      <section className="form-panel">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>갑 (시행사) 정보</h2>
        <div className="field-grid">
          <div className="field">
            <label className="field-label" htmlFor="joint-gapName">상호</label>
            <input id="joint-gapName" className="input" value={gap.name} onChange={(e) => setGap({ name: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="joint-gapRepDir">대표이사</label>
            <input id="joint-gapRepDir" className="input" value={gap.repDir} onChange={(e) => setGap({ repDir: e.target.value })} />
          </div>
          <div className="field full">
            <label className="field-label" htmlFor="joint-gapAddress">주소</label>
            <input id="joint-gapAddress" className="input" value={gap.address} onChange={(e) => setGap({ address: e.target.value })} />
          </div>
          <div className="field">
            {/* 법인등록번호는 앞/뒤 2칸 묶음이라 단일 htmlFor 부적합 → 그룹 라벨 id +
                role="group" aria-labelledby, 각 input 에 개별 aria-label(앞/뒷자리). */}
            <div className="field-label" id="joint-gapCorpReg">법인등록번호</div>
            <div role="group" aria-labelledby="joint-gapCorpReg" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input id="joint-gapCorpRegFront" className="input" maxLength={6} value={gap.corpRegFront} aria-label="법인등록번호 앞자리"
                aria-invalid={gapCorpInvalid || undefined}
                aria-describedby={gapCorpInvalid ? "joint-gapCorpReg-err" : undefined}
                onChange={(e) => setGap({ corpRegFront: e.target.value.replace(/\D/g, "") })} />
              <span>-</span>
              <input className="input" maxLength={7} value={gap.corpRegBack} aria-label="법인등록번호 뒷자리"
                aria-invalid={gapCorpInvalid || undefined}
                aria-describedby={gapCorpInvalid ? "joint-gapCorpReg-err" : undefined}
                onChange={(e) => setGap({ corpRegBack: e.target.value.replace(/\D/g, "") })} />
            </div>
            {gapCorpInvalid && (
              <div id="joint-gapCorpReg-err" className="field-hint" role="alert" style={{ marginTop: 4, color: "var(--c-danger)" }}>
                유효하지 않은 법인등록번호입니다 (체크섬 확인 필요)
              </div>
            )}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="joint-representative">대표사 지정</label>
            <select id="joint-representative" className="select" value={jointForm.representative}
              onChange={(e) => updateJoint({ representative: e.target.value as "developer" | "trust" })}>
              <option value="developer">대표 = 시행사(갑)</option>
              <option value="trust">대표 = 신탁사(을)</option>
            </select>
          </div>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "26px 0 14px" }}>사업 정보</h2>
        <div className="field-grid">
          <div className="field full">
            <label className="field-label" htmlFor="joint-projectName">사업명</label>
            <input id="joint-projectName" className="input" value={project.name} onChange={(e) => setProject({ name: e.target.value })} />
          </div>
          <div className="field full">
            <label className="field-label" htmlFor="joint-projectSite">사업부지</label>
            <input id="joint-projectSite" className="input" value={project.site} onChange={(e) => setProject({ site: e.target.value })} />
          </div>
          <div className="field full">
            <label className="field-label" htmlFor="joint-projectScaleUse">규모/용도</label>
            <input id="joint-projectScaleUse" className="input" value={project.scaleUse} onChange={(e) => setProject({ scaleUse: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="joint-agreementYear">협약 연도</label>
            <input id="joint-agreementYear" className="input" value={project.agreementYear}
              aria-invalid={agreementDateInvalid || undefined}
              aria-describedby={agreementDateInvalid ? "joint-agreement-err" : undefined}
              onChange={(e) => setProject({ agreementYear: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="joint-agreementMonth">월</label>
            <input id="joint-agreementMonth" className="input" value={project.agreementMonth}
              aria-invalid={agreementDateInvalid || undefined}
              aria-describedby={agreementDateInvalid ? "joint-agreement-err" : undefined}
              onChange={(e) => setProject({ agreementMonth: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="joint-agreementDay">일</label>
            <input id="joint-agreementDay" className="input" value={project.agreementDay}
              aria-invalid={agreementDateInvalid || undefined}
              aria-describedby={agreementDateInvalid ? "joint-agreement-err" : undefined}
              onChange={(e) => setProject({ agreementDay: e.target.value })} />
          </div>
          {agreementDateInvalid && (
            <div className="field full">
              <div id="joint-agreement-err" className="field-hint" role="alert" style={{ marginTop: 4, color: "var(--c-danger)" }}>
                실재하지 않는 협약일입니다 (연·월·일 확인)
              </div>
            </div>
          )}
          {agreementDateReal && (
            <div className="field full">
              <div className="loan-hangul" role="status" aria-live="polite">
                {Number(agY)}년 {Number(agM)}월 {Number(agD)}일
                {weekdayKo(Number(agY), Number(agM), Number(agD)) &&
                  ` (${weekdayKo(Number(agY), Number(agM), Number(agD))})`}
              </div>
            </div>
          )}
        </div>

        {/* ── 검증 게이트 안내 (담보신탁 DocStep 과 동형, joint 적용) ── */}
        {!ok && (
          <div className="validate-box" role="alert" style={{ marginTop: 24 }}>
            <div className="validate-title"><span aria-hidden="true">⚠ </span>생성 전 필수 입력이 누락되었습니다</div>
            <ul className="validate-list">
              {missing.map((label, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="validate-jump"
                    onClick={() => focusMissing(label)}
                    title="입력란으로 이동"
                  >
                    <strong>{label}</strong>
                    <span className="validate-where"> — 입력란으로 ›</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 24, flexWrap: "wrap" }}>
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
            msg && <span className="field-hint" style={{ color: "var(--c-blue-deep)" }}><StatusGlyphText msg={msg} /></span>
          )}
        </div>

        {/* 다운로드 직전 "받게 될 파일명" 미리보기 (담보신탁 DocStep 과 동형) — 실제 .docx
            저장명과 단일 출처(jointDocFileName). 필수 입력 충족(ok)일 때만 표출(미완 임시
            파일명 미표시). 표시 전용 — 낭독은 가시 텍스트가 전달(글리프만 aria-hidden),
            role=status 미부착(생성 상태 낭독은 상단 영속 라이브 영역 전담 → 중복 낭독 0).
            새 CSS 0(기존 field-hint). */}
        {ok && docxFileName && (
          <p className="field-hint" style={{ marginTop: 8 }}>
            <span aria-hidden="true">💾 </span>
            저장 파일명: <strong style={{ wordBreak: "break-all" }}>{docxFileName}</strong>
          </p>
        )}
        {/* PDF 경로 — "PDF 생성"은 인쇄창을 띄우고 "PDF로 저장" 시 브라우저가 인쇄 제목
            (jointPdfTitle)을 파일명으로 제안한다. .docx 와 이름이 달라(끝에 " (PDF)") 함께
            고지(담보신탁 DocStep 과 동형). 표시 전용 — 🖨 글리프만 aria-hidden, role=status 미부착. */}
        {ok && pdfFileName && (
          <p className="field-hint" style={{ marginTop: 4 }}>
            <span aria-hidden="true">🖨 </span>
            PDF로 저장 시(브라우저 제안): <strong style={{ wordBreak: "break-all" }}>{pdfFileName}</strong>
          </p>
        )}
        {/* 다운로드 직전 "파일명 충돌" 사전 경고 (담보신탁 DocStep 4b7c513 의 joint 짝) — 같은
            식별 키(갑 상호)의 다른 저장 계약이 있어 받게 될 .docx/PDF 가 섞일 수 있을 때. 막지
            않는 안내(차단 적색 아님·var(--c-brown))이며 입력 지점 advisory 패밀리와 동형
            (role=status·aria-live=polite, ⚠ 글리프만 aria-hidden). 새 CSS 0(기존 field-hint +
            인라인 style). 표시 전용 — 산출/검증/조문 무접촉. ★정확성: 파일명은 갑(시행사) 상호로
            정해져 협약 "제목"과 무관하므로(downloadKeyOf/jointFileBase), 이름변경이 아니라 받은
            파일명 직접 변경을 실제 해소책으로 안내한다(내 계약 목록·DocStep 충돌 경고와 동일 출처). */}
        {ok && filenameCollision && (
          <>
            <p
              className="field-hint"
              role="status"
              aria-live="polite"
              style={{ marginTop: 6, color: "var(--c-brown)" }}
            >
              <span aria-hidden="true">⚠ </span>
              다른 계약과 다운로드 파일명이 같아 받게 될 .docx·PDF 가 섞일 수 있습니다 — 파일명은
              갑(시행사) 상호로 정해집니다(협약 제목과 무관). 같은 계약이면 받은 파일 이름을 직접 바꿔 주세요.
            </p>
            {/* 충돌 경고 → 식별값(갑 상호) 입력으로 잇는 1-클릭 점프 (담보신탁 DocStep 20:01 의
                joint 짝). joint 다운로드 키는 갑(시행사) 상호 한 값(joint:{gap.name})으로만 정해지므로
                점프 대상도 갑 상호 입력 1개다. 검증 게이트 누락 점프(focusMissing)와 동일한
                focusFieldById·validate-jump 마크업을 그대로 재사용한다(새 CSS 0). role=status 영속
                영역(위 <p>)에 들지 않는 별도 ul 이라 중복 낭독 0(점프 버튼은 조작 컨트롤). */}
            <ul className="validate-list" style={{ marginTop: 4 }}>
              <li>
                <button
                  type="button"
                  className="validate-jump"
                  onClick={() => focusFieldById("joint-gapName")}
                  title="입력란으로 이동"
                >
                  <strong>갑(시행사) 상호 확인하러 가기</strong>
                  <span className="validate-where"> — 입력란으로 ›</span>
                </button>
              </li>
            </ul>
          </>
        )}
      </section>
        </div>

        {/* ── 우: 실시간 미리보기 (완성 협약서 그대로, 실제 산출물과 동일) ── */}
        <aside className="doc-split-preview">
          <div className="preview-head">
            <span className="preview-badge">실시간 미리보기</span>
            {/* 담보신탁 DocStep 과 동형 — 필수 입력 누락(!ok) 동안엔 미리보기가 초안임을
                미리보기 쪽에서 직접 표시(좌측 validate-box 만으로는 미리보기만 보는 사용자가
                누락을 놓침). 낭독은 좌측 게이트(role=alert) 전담 → 시각 전용(글리프 aria-hidden). */}
            {previewHtml && !ok && (
              <span className="preview-badge-draft">
                <span aria-hidden="true">✎ </span>초안 · 필수 입력 {missing.length}개 남음
              </span>
            )}
            <span className="field-hint">입력값이 즉시 반영됩니다 (공동사업표준협약서)</span>
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
                SR 에 고지. previewHtml 유무와 무관하게 항상 노출(빈 상태에서도 폭 확보 가능).
                담보신탁 DocStep preview-toggle 과 동형. */}
            <button
              type="button"
              className="preview-toggle"
              onClick={togglePreview}
              aria-expanded={previewOpen}
              aria-controls="joint-preview-body"
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
              래퍼 밖이라 접어도 보인다(팝업 차단 안내 유실 방지). 담보신탁 DocStep 과 동형. */}
          <div id="joint-preview-body" className="doc-preview-body" hidden={!previewOpen}>
          {previewHtml ? (
            // 읽기 전용 미리보기는 정적 HTML+CSS만 렌더한다(스크립트 불필요) → 완전
            // 격리 sandbox(빈 값=allow-* 전무)로 스크립트 실행 불능 + 부모 origin
            // 차단(opaque origin). 빌더 escHTML/escAttr·stripAutoPrint 가 1차 방어지만,
            // PII 가 박힌 법적 서류 미리보기라 그 방어 회귀 시에도 코드 실행·localStorage
            // 접근을 막는 방어심층화(담보신탁 DocStep preview-frame 과 동형). 정적 렌더라
            // allow-scripts/allow-same-origin 불요 — 표·조문·스타일은 그대로 표시.
            <iframe
              className="preview-frame"
              srcDoc={previewHtml}
              sandbox=""
              title="공동사업표준협약서 미리보기"
            />
          ) : (
            <div className="preview-scroll">
              <p className="field-hint" style={{ padding: 16 }}>
                정보를 입력하면 공동사업표준협약서 미리보기가 나타납니다.
              </p>
            </div>
          )}
          </div>
        </aside>
      </div>
    </main>
  );
}
