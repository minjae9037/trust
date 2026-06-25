"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  listContracts,
  deleteContract,
  restoreContract,
  duplicateContract,
  renameContract,
  exportContracts,
  importContracts,
  contractIdentity,
  enqueueUndo,
  dequeueUndo,
  type ContractRow,
} from "@/lib/contractRepo";
import { DOCUMENT_TYPES, CATEGORY_LABEL, COLLATERAL_OUTPUT_DOCS } from "@/lib/engine/schema";
import { validateDoc, validateJoint, type Missing } from "@/lib/engine/validate";
import { generateCollateralDoc, generateJointDoc, previewDocHTML } from "@/lib/engine/docx";
import type { Category, ContractForm, DocId, JointForm } from "@/lib/engine/model";
import { openMultiDocPreviewWindow } from "@/lib/ui/preview-window";
import { splitStatusGlyph } from "@/lib/ui/status-glyph";
import { highlightSegments } from "@/lib/ui/highlight";
import { formatRelativeTime } from "@/lib/engine/calc";
import { loadSortKey, saveSortKey, type SortKey } from "@/lib/store/listPref";

/**
 * 계약별 서류 생성 준비도 — 담보신탁(collateral)만 7종 산출 서류가 정의돼 있어
 * `validateDoc`(검증 게이트와 동일 로직)을 재사용해 "몇 종 생성 가능"한지 집계한다.
 * 다른 서류종은 산출 서류 정의가 달라 집계 대상이 아니다(null 반환 → 칩 미표시).
 * 구버전/손상 저장본(form_data 일부 누락)은 try/catch로 격리(목록 렌더 크래시 방지).
 * ※ 조문·엔진 무접촉 — 기존 검증 결과를 목록 수준에서 보여줄 뿐이다.
 */
/**
 * 동적 상태 메시지(role=status·aria-live) — 맨 앞 장식 글리프(✓ 등)를 aria-hidden
 * 으로 분리해 렌더한다. 라이브 영역 갱신 시 SR 이 글리프("check mark")를 먼저
 * 낭독하지 않게 하고 의미 본문만 낭독되게 한다(시각 표시는 글리프+공백 동일).
 */
function StatusGlyphText({ msg }: { msg: string }) {
  const { glyph, text } = splitStatusGlyph(msg);
  return (
    <>
      {glyph && <span aria-hidden="true">{glyph} </span>}
      {text}
    </>
  );
}
/**
 * 검색어 일치 부분 시각 강조 — 카드 제목·식별줄·서류명에서 현재 검색어와 일치하는
 * 구간만 `.search-hl` span 으로 감싼다(highlightSegments 단일 출처). 검색어가 비면
 * 전체가 비매칭 단일 세그먼트라 평문과 동일하게 렌더된다(동작 무변경). 강조는 순수
 * 시각 표시이므로 의미 텍스트는 그대로 낭독되고 SR 의미는 바뀌지 않는다(span=장식).
 */
function Highlight({ text, query }: { text: string; query: string }) {
  const segs = highlightSegments(text, query);
  return (
    <>
      {segs.map((s, i) =>
        s.match ? (
          <span key={i} className="search-hl">
            {s.text}
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}
/**
 * 생성 가능한(검증 통과) 서류 id 목록 — 준비도 칩과 목록-일괄생성의 **단일 출처**.
 * 칩의 "N종 생성 가능"과 일괄 생성 대상이 정의상 100% 일치하도록 한 곳에서 산출한다.
 * (Wizard 헤더의 generateAllReady 와 동일한 검증 게이트 = validateDoc(form, docId).ok)
 */
function readyDocIds(row: ContractRow): DocId[] | null {
  if (row.doc_type !== "collateral") return null;
  // doc_type==="collateral" 가드로 form_data 는 ContractForm 임이 보장된다(joint 는 위에서 차단).
  const form = row.form_data as ContractForm;
  try {
    return COLLATERAL_OUTPUT_DOCS.filter((d) => validateDoc(form, d.id).ok).map(
      (d) => d.id,
    );
  } catch {
    return null;
  }
}

function docReadiness(row: ContractRow): { ready: number; total: number } | null {
  const ids = readyDocIds(row);
  if (ids === null) return null;
  return { ready: ids.length, total: COLLATERAL_OUTPUT_DOCS.length };
}

/**
 * 계약별 "남은 필수 입력"(라벨 기준 중복 제거 목록) — 담보신탁(collateral)만, 7종 산출
 * 서류에 걸쳐 validateDoc(검증 게이트와 동일 로직)이 보고한 누락 항목을 모은다.
 * Wizard 헤더 missingList 의 **목록 패리티** — 그간 저장된 계약 카드는 "N/7 생성 가능"
 * 건수 칩만 있어, 정작 *무엇이* 남았는지는 계약을 열어 각 서류 검증박스를 일일이 뒤져야
 * 알 수 있었다(카드 칩 title 도 "열기 → 각 서류에서 확인"이라 안내). 공통 누락(위탁자·
 * 우선수익자 등)은 7종 모두의 missing 에 반복 등장하므로 label 기준 1회만 담는다. 전부
 * 준비됐으면 빈 배열(readyDocIds 가 7종 전부일 때). joint·기타 종류·손상 저장본은 빈 배열.
 * ※ 조문·엔진·검증 판정 무접촉 — 이미 산출된 validateDoc.missing 을 목록 수준에서 모을 뿐.
 */
function rowMissing(row: ContractRow): Missing[] {
  if (row.doc_type !== "collateral") return [];
  // doc_type==="collateral" 가드로 form_data 는 ContractForm 임이 보장된다.
  const form = row.form_data as ContractForm;
  try {
    const seen = new Set<string>();
    const list: Missing[] = [];
    for (const d of COLLATERAL_OUTPUT_DOCS) {
      const { missing } = validateDoc(form, d.id);
      for (const mi of missing) {
        if (seen.has(mi.label)) continue;
        seen.add(mi.label);
        list.push(mi);
      }
    }
    return list;
  } catch {
    return [];
  }
}

/**
 * 공동사업표준협약서(joint) 계약의 생성 준비도 — 협약서는 단일 산출물이라 collateral
 * 의 "N/7" 대신 boolean(생성 가능 여부)이다. 검증 게이트와 동일한 `validateJoint(form).ok`
 * 를 재사용해 목록에서 열지 않고도 "협약서 생성 가능 / 필수 입력 누락"을 보여 준다
 * (collateral 준비도 칩의 joint 패리티 — 그간 joint 계약은 목록에서 준비 신호가 전무했다).
 * joint 외 서류종은 null(칩 미표시). 구버전/손상 저장본은 try/catch 로 격리(렌더 크래시 방지).
 * ※ 조문·엔진·검증 판정 무접촉 — 기존 validateJoint 결과를 목록 수준에서 표시할 뿐이다.
 */
function jointReadiness(row: ContractRow): boolean | null {
  if (row.doc_type !== "joint") return null;
  // doc_type==="joint" 가드로 form_data 는 JointForm 임이 보장된다.
  try {
    return validateJoint(row.form_data as JointForm).ok;
  } catch {
    return null;
  }
}

/**
 * 공동사업표준협약서(joint) 계약의 "남은 필수 입력" 라벨 목록 — collateral 의 rowMissing
 * 패리티(joint 단일 산출물 버전). 그간 collateral 카드는 미준비 시 *무엇이* 남았는지 한 줄로
 * 보여 줬는데(rowMissing), joint 카드는 "필수 입력 누락" 칩만 있어 무엇을 채울지는 계약을
 * 열어야 알 수 있었다(목록 패리티 갭). 검증 게이트와 동일한 `validateJoint(form).missing`
 * 을 그대로 쓴다(별도 판정 로직 없음 — 이미 산출된 누락 라벨을 목록 수준에서 보여 줄 뿐).
 * joint 의 missing 은 이미 라벨 단위로 유일하므로(collateral 처럼 7종 반복이 아님) 중복
 * 제거가 필요 없다. joint 외 종류·손상 저장본은 빈 배열(요약 미표시·렌더 크래시 방지).
 * ※ 조문·엔진·검증 판정 무접촉.
 */
function rowJointMissing(row: ContractRow): string[] {
  if (row.doc_type !== "joint") return [];
  // doc_type==="joint" 가드로 form_data 는 JointForm 임이 보장된다.
  const form = row.form_data as JointForm;
  // null/비객체(손상 저장본)는 빈 배열 — collateral rowMissing(validateDoc throw→[]) 패리티.
  // (validateJoint 는 null 을 관대히 처리해 throw 하지 않으므로 명시 가드로 손상본 노이즈 차단.)
  if (!form || typeof form !== "object") return [];
  try {
    return validateJoint(form).missing;
  } catch {
    return [];
  }
}

type StatusFilter = "all" | "draft" | "completed";
// SortKey 는 영속 경계(listPref)가 단일 출처 — 저장 가능한 정렬 키 집합과 일치 보장.

const SORT_LABEL: Record<SortKey, string> = {
  recent: "최근 수정순",
  title: "제목순 (가나다)",
  trustor: "위탁자순 (가나다)",
  readiness: "생성 준비도순",
};

/** 완료 status 판정 — 그 외(draft/빈값/구버전)는 모두 "작성중"으로 묶는다. */
const isCompleted = (r: ContractRow) => r.status === "completed";

export function ContractsView({
  onOpen,
  onStart,
}: {
  onOpen: (row: ContractRow) => void;
  // 계약이 0건일 때(첫 진입·캐시 삭제) 빈 화면에서 바로 새 계약 작성으로 보내는 내비게이션 콜백.
  // 표시·이동 전용 — 조문·엔진·산출물 무관. 미전달이면 CTA 버튼을 렌더하지 않는다(후방호환).
  onStart?: () => void;
}) {
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

  // 저장된 정렬 선호 반영(마운트 1회) — SSR/하이드레이션 안전: 초기값은 기본 "recent"
  // 로 렌더(localStorage 는 서버에 없음)하고 마운트 후 저장 선호를 읽어 반영한다
  // (previewPref·draft 복원과 동형). 저장은 사용자 변경에서만(아래 select onChange)
  // 일어나 적재 경로가 저장값을 자기 자신으로 덮어쓰지 않는다(클로버 차단).
  useEffect(() => {
    setSort(loadSortKey());
  }, []);

  // 삭제 — 즉시 삭제하되 일정 시간 "실행취소"를 제공한다(실수 삭제의 영구 유실 방지).
  // dirty 가드(세션 내)·백업(세션 간)에 이어 유실 방지 계열의 마지막 안전망. 삭제된 행을
  // 그대로 보관했다가 실행취소 시 restoreContract 로 되돌린다(id·시각·form_data 무변형).
  // ★연속 삭제(7초 창 안에 여러 건)에도 각 삭제가 독립된 실행취소 항목을 갖도록 큐로 관리한다
  //   — 단일 슬롯이면 다음 삭제가 직전 항목을 덮어써 먼저 지운 계약이 말없이 영구 유실됐다.
  //   각 항목은 자기 만료 타이머를 가지며(undoTimers: id→timer), 실행취소/만료 시 그 항목만 제거.
  const UNDO_MS = 7000;
  const undoTimers = useRef<Map<string, number>>(new Map());
  const [undoRows, setUndoRows] = useState<ContractRow[]>([]);

  // 타이머 누수 방지(언마운트 시 전부 정리).
  useEffect(() => {
    const timers = undoTimers.current;
    return () => {
      for (const t of timers.values()) window.clearTimeout(t);
      timers.clear();
    };
  }, []);

  async function onDelete(row: ContractRow) {
    await deleteContract(row.id);
    await load();
    // 같은 id 의 기존 만료 타이머가 있으면 교체(큐 중복은 enqueueUndo 가 차단).
    const prev = undoTimers.current.get(row.id);
    if (prev) window.clearTimeout(prev);
    setUndoRows((q) => enqueueUndo(q, row));
    const t = window.setTimeout(() => {
      setUndoRows((q) => dequeueUndo(q, row.id));
      undoTimers.current.delete(row.id);
    }, UNDO_MS);
    undoTimers.current.set(row.id, t);
  }

  async function onUndoDelete(row: ContractRow) {
    await restoreContract(row);
    const t = undoTimers.current.get(row.id);
    if (t) window.clearTimeout(t);
    undoTimers.current.delete(row.id);
    setUndoRows((q) => dequeueUndo(q, row.id));
    await load();
  }

  // 이름 변경 — 자동 생성·"(사본)" 제목을 의미 있는 딜명으로 바꾼다(검색·정렬·식별의 핵심).
  // 카드 제목을 인라인 입력으로 전환해 그 자리에서 편집한다(Enter=저장 / Esc=취소).
  // ★카드 본문은 클릭 시 열기(onOpen)이므로, 편집 입력/버튼은 stopPropagation 으로 열기와 분리한다.
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  function startRename(row: ContractRow) {
    if (batch?.busy) return;
    setEditId(row.id);
    setEditVal(row.title);
  }
  function cancelRename() {
    setEditId(null);
    setEditVal("");
  }
  async function commitRename() {
    if (editId === null) return;
    await renameContract(editId, editVal);
    setEditId(null);
    setEditVal("");
    await load();
  }

  // 복제 — 동일 위탁자·유사 구조 계약을 반복 작성하는 흐름 가속(입력값 그대로 사본, 작성중 상태).
  // 복제는 거의 항상 "사본을 고쳐 새 계약을 만들기" 위함이므로, 만든 직후 사본을 위저드에서 바로 연다
  // (열지 못하면 — 미저장 변경 confirm 취소 등 — 목록에는 이미 사본이 추가돼 있으니 직접 열 수 있다).
  async function onDuplicate(id: string) {
    const newId = await duplicateContract(id);
    const fresh = await listContracts();
    setRows(fresh);
    const copy = newId ? fresh.find((r) => r.id === newId) : null;
    if (copy) onOpen(copy);
  }

  // ── 백업(내보내기)·복원(가져오기) — 로컬 저장 데이터의 유실 방지·기기 이동.
  //    내보내기: 모든 계약을 JSON 파일로 다운로드. 가져오기: 비파괴 병합(기존 보존, 새 계약만 추가).
  //    조문·엔진·생성 로직 무접촉 — 저장된 행을 직렬화/병합할 뿐이다.
  const fileRef = useRef<HTMLInputElement>(null);
  const [backupMsg, setBackupMsg] = useState("");

  function onExport() {
    try {
      const backup = exportContracts();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trustform-계약백업-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBackupMsg(`✓ ${backup.count}건을 백업 파일로 내보냈습니다 — 다운로드를 확인하세요.`);
    } catch (e) {
      setBackupMsg("내보내기 실패: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;
    try {
      const text = await file.text();
      const { added, skipped } = importContracts(text);
      await load();
      setBackupMsg(
        added > 0
          ? `✓ ${added}건을 가져왔습니다${skipped ? ` (이미 있는 ${skipped}건은 건너뜀)` : ""}.`
          : `가져올 새 계약이 없습니다${skipped ? ` (${skipped}건은 이미 보관 중)` : ""}.`,
      );
    } catch (err) {
      setBackupMsg("가져오기 실패: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  // ── 목록에서 바로 서류 일괄 생성(.docx) — 계약을 열지 않고도 준비된 서류 전부 내려받기.
  //    대상은 readyDocIds(검증 게이트 통과 서류)뿐 → 누락 서류는 절대 생성하지 않음(정확성 보존).
  //    Wizard 헤더 generateAllReady 와 동일 패턴(기존 generateCollateralDoc 순차 호출, 350ms 간격).
  //    조문·엔진·생성 로직 무손상 — 저장된 form_data 를 기존 단건 생성기에 넘길 뿐이다.
  const [batch, setBatch] = useState<{ id: string; msg: string; busy: boolean } | null>(null);

  async function generateRowDocs(row: ContractRow) {
    if (batch?.busy) return;
    const ids = readyDocIds(row);
    if (!ids || ids.length === 0) return;
    // ids 가 non-null = collateral 행만 도달 → form_data 는 ContractForm.
    const form = row.form_data as ContractForm;
    setBatch({ id: row.id, msg: `서류 생성 중… (0/${ids.length})`, busy: true });
    try {
      for (let i = 0; i < ids.length; i++) {
        const meta = COLLATERAL_OUTPUT_DOCS.find((d) => d.id === ids[i]);
        setBatch({
          id: row.id,
          msg: `서류 생성 중… (${i + 1}/${ids.length}) ${meta?.name ?? ids[i]}`,
          busy: true,
        });
        await generateCollateralDoc(form, ids[i]);
        // 브라우저의 연속 다운로드 차단 회피용 짧은 간격.
        if (i < ids.length - 1) await new Promise((r) => setTimeout(r, 350));
      }
      setBatch({
        id: row.id,
        msg: `✓ 준비된 ${ids.length}종 Word(.docx) 생성 완료 — 다운로드를 확인하세요.`,
        busy: false,
      });
    } catch (e) {
      setBatch({ id: row.id, msg: "오류: " + (e instanceof Error ? e.message : String(e)), busy: false });
    }
  }

  // ── 목록에서 바로 준비된 N종 "통합 검수 미리보기" — 계약을 열지 않고도 준비된 서류 전부를
  //    한 새 창에서 정독(읽기 전용·인쇄 대화상자 없음). 목록 일괄 생성(generateRowDocs)의 검수 짝
  //    — 동일 readyDocIds 집합을 대상으로 하되 다운로드가 아닌 통합 검수 창을 연다(내려받기 전 정독).
  //    Wizard 헤더 previewAllReady 와 동일 패턴 — 저장된 계약 측 패리티(그간 목록에선 열어야 검수 가능).
  //    각 서류 미리보기(previewDocHTML)는 변형 없이 격리 iframe 에 그대로 들어간다 —
  //    조문·엔진·빌더·검증·산출물 무접촉(읽기 전용). 진행 메시지는 일괄 생성과 동일한 per-row
  //    영역(batch.msg)에 싣고, 동기 작업이라 busy=false(진행 중 일괄 생성을 중단시키지 않게 가드).
  function previewRowDocs(row: ContractRow) {
    if (batch?.busy) return;
    const ids = readyDocIds(row);
    if (!ids || ids.length === 0) return;
    // ids 가 non-null = collateral 행만 도달 → form_data 는 ContractForm.
    const form = row.form_data as ContractForm;
    const docs = ids.map((id) => ({
      name: COLLATERAL_OUTPUT_DOCS.find((d) => d.id === id)?.name ?? id,
      html: previewDocHTML(form, id),
    }));
    // 입력 미완으로 이 검수에서 빠진 서류 이름 — 통합 창 부분집합 고지로 명시해, 준비된 N종을
    // 전체 세트로 오인한 채 미완 서류 누락을 못 보고 출하하는 것을 막는다(정확성 최우선·표시 전용).
    const readySet = new Set<DocId>(ids);
    const excluded = COLLATERAL_OUTPUT_DOCS.filter((d) => !readySet.has(d.id)).map((d) => d.name);
    const r = openMultiDocPreviewWindow(
      docs,
      () => window.open("", "_blank", "width=1040,height=1000"),
      { excluded },
    );
    setBatch({
      id: row.id,
      msg:
        r === "blocked"
          ? "새 창을 열 수 없습니다 — 브라우저의 팝업 차단을 해제하신 뒤 다시 시도해주세요."
          : `✓ 준비된 ${ids.length}종을 새 창에서 정독 검수하실 수 있습니다(읽기 전용).`,
      busy: false,
    });
  }

  // ── 목록에서 바로 공동사업표준협약서(joint) 생성(.docx) — 계약을 열지 않고도 협약서 내려받기.
  //    collateral 의 generateRowDocs(N종 일괄) 과 동형이나 joint 는 단일 산출물이라 1건만 생성한다.
  //    검증 게이트(validateJoint.ok)를 통과한 행만 도달 → 빈 칸 협약서는 생성하지 않음(정확성 보존).
  //    JointForm 컴포넌트의 onDocx 와 동일한 generateJointDoc 를 호출할 뿐 — 조문·엔진·산출물 무손상.
  async function generateRowJoint(row: ContractRow) {
    if (batch?.busy) return;
    if (jointReadiness(row) !== true) return;
    // jointReadiness===true = joint 행 + 검증 통과 → form_data 는 JointForm.
    const form = row.form_data as JointForm;
    setBatch({ id: row.id, msg: "협약서 생성 중…", busy: true });
    try {
      await generateJointDoc(form);
      setBatch({
        id: row.id,
        msg: "✓ 공동사업표준협약서 Word(.docx) 생성 완료 — 다운로드를 확인하세요.",
        busy: false,
      });
    } catch (e) {
      setBatch({ id: row.id, msg: "오류: " + (e instanceof Error ? e.message : String(e)), busy: false });
    }
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
        // 제목·서류명에 더해 위탁자명·물건 소재지까지 검색 대상에 포함(실무 식별 기준).
        const { trustor, property } = contractIdentity(r);
        const hay = `${r.title} ${docName} ${trustor} ${property}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const sorted = [...out];
    if (sort === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title, "ko"));
    } else if (sort === "trustor") {
      // 위탁자명 가나다순 — 신탁 실무의 핵심 식별자(검색·카드 부제와 동일 출처 contractIdentity).
      // 위탁자명이 비면(미입력·구버전·이질 종류) 맨 뒤로, 동명은 최근 수정순으로 안정 정렬.
      const name = (r: ContractRow) => contractIdentity(r).trustor;
      sorted.sort((a, b) => {
        const na = name(a);
        const nb = name(b);
        if (!na && !nb) return a.updated_at < b.updated_at ? 1 : -1;
        if (!na) return 1;
        if (!nb) return -1;
        return na.localeCompare(nb, "ko") || (a.updated_at < b.updated_at ? 1 : -1);
      });
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

  // 검색·필터 결과 건수 SR 라이브 고지 — 시각 사용자는 툴바 우측 "N / M건"과 빈 결과 안내가
  // 검색어/필터에 따라 즉시 갱신되는 걸 보지만, 그 카운트 span 과 빈 결과 <p> 는 라이브 영역이
  // 아니어서 SR 사용자는 필터링 결과(몇 건 남았는지·0건인지)를 전혀 듣지 못했다(WCAG 4.1.3
  // 상태 메시지). 필터가 활성일 때만 결과 건수를 polite 라이브 영역으로 고지한다. 키 입력마다
  // 낭독되지 않도록 짧게 디바운스하고, 필터 해제·로딩·오류·초기 진입에는 메시지를 비워 침묵한다
  // (시각 표시는 기존 span·<p> 가 담당 → 낭독 책임 분리·중복 낭독 0). 검색/정렬 로직·조문·엔진·
  // 검증 게이트 무접촉 — 이미 산출된 visible.length 를 SR 에 들려줄 뿐이다.
  const [searchAnnounce, setSearchAnnounce] = useState("");
  useEffect(() => {
    if (loading || err || !filtersActive) {
      setSearchAnnounce(""); // 초기 진입·로딩·오류·필터 해제 → 이전 고지 비움(새 낭독 없음).
      return;
    }
    const t = window.setTimeout(() => {
      setSearchAnnounce(
        visible.length > 0 ? `검색 결과 ${visible.length}건` : "조건에 맞는 계약이 없습니다",
      );
    }, 350);
    return () => window.clearTimeout(t);
  }, [filtersActive, visible.length, loading, err]);

  // 전이 상태(일괄 생성 진행·백업 결과)의 SR 영속 라이브 영역 단일 낭독 출처.
  // 일괄 생성이 진행/완료 중이면 그 메시지를, 아니면 백업 결과를 — 장식 글리프(✓ 등)는
  // splitStatusGlyph 로 떼고 본문만 고지한다. 각 위치의 시각 span 은 낭독 책임을 갖지 않아
  // (role=status 미부착) 중복 낭독이 없고, 아래 영속 영역이 첫 메시지부터 안정 고지한다.
  const liveStatus = batch?.msg
    ? splitStatusGlyph(batch.msg).text
    : backupMsg
      ? splitStatusGlyph(backupMsg).text
      : "";

  // 카드 "수정 시각" 상대 표기의 기준 시각 — 한 번의 렌더 안 모든 카드가 같은 now 를 쓰게
  // 렌더 최상단에서 1회 계산(목록 상호작용마다 재렌더되며 갱신, 표시 전용).
  const nowMs = Date.now();

  return (
    <main className="page active">
      <div className="page-header">
        <div className="page-eyebrow">내 계약</div>
        <h1 className="page-title">저장된 계약</h1>
        <p className="page-desc">작성 중이거나 완료한 계약을 이어서 편집하거나 서류를 다시 생성할 수 있습니다.</p>
      </div>

      {/* 전이 상태 SR 영속 라이브 영역 — 일괄 생성 진행(0/N→완료)·백업 결과를 첫 메시지부터 고지.
          ★항상 렌더(영속) → 라이브 영역이 콘텐츠 변경 '전'에 이미 DOM 에 존재(advisor .advisor-live 선례).
          시각 표시는 카드 버튼 옆·백업 바의 span 이 담당하고 이 영역은 낭독 전용(중복 낭독 0). */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveStatus}
      </div>

      {/* 검색·필터 결과 건수 SR 라이브 고지 — 시각 카운트(툴바 "N/M건")·빈 결과 <p> 는 라이브가
          아니라 SR 사용자에게 필터 결과를 들려줄 전용 영역(항상 렌더 = 콘텐츠 변경 전 DOM 존재).
          전이 상태(liveStatus)와 분리된 별도 polite 영역이라 검색 고지가 일괄생성/백업 메시지와
          섞이지 않는다. 시각 표시는 기존 span·<p> 가 담당하고 이 영역은 낭독 전용(중복 낭독 0). */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {searchAnnounce}
      </div>

      {/* 백업(내보내기)·복원(가져오기) — 로컬 저장 데이터의 유실 방지·기기 이동.
          가져오기는 비파괴(기존 보존)이므로 계약이 0건(캐시 삭제·새 기기)일 때도 항상 노출해 복원 가능. */}
      {!loading && !err && (
        <div className="contracts-backup">
          <button
            className="btn btn-ghost btn-sm"
            onClick={onExport}
            disabled={rows.length === 0}
            title="모든 계약을 JSON 백업 파일로 내보냅니다 (다른 브라우저·기기로 옮기거나 보관용)"
          >
            <span aria-hidden="true">⬆ </span>백업 내보내기
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => fileRef.current?.click()}
            title="백업 파일(JSON)에서 계약을 가져옵니다 (기존 계약은 보존, 새 계약만 추가)"
          >
            <span aria-hidden="true">⬇ </span>백업 가져오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={onImportFile}
          />
          {/* 시각 표시 전용 — 낭독은 상단 영속 라이브 영역(liveStatus)이 담당(role=status 미부착=중복 낭독 0). */}
          {backupMsg && (
            <span className="field-hint">
              <StatusGlyphText msg={backupMsg} />
            </span>
          )}
        </div>
      )}

      {/* 삭제 실행취소 — 방금 삭제한 계약을 일정 시간 안에 되돌릴 수 있다(영구 유실 방지).
          연속 삭제 시 각 건이 자기 실행취소 바를 가져, 먼저 지운 계약도 덮어쓰기 없이 되돌릴 수 있다. */}
      {undoRows.map((u) => (
        <div key={u.id} className="contracts-undo" role="status" aria-live="polite">
          <span>
            <span aria-hidden="true">🗑 </span>
            <strong>{u.title}</strong> 삭제됨
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onUndoDelete(u)}
            aria-label={`${u.title} 삭제 실행취소`}
          >
            실행취소
          </button>
        </div>
      ))}

      {/* 검색 + 상태 필터 + 정렬 + 건수 — 계약이 많아질 때 탐색성·정리 */}
      {!loading && !err && rows.length > 0 && (
        <div className="contracts-toolbar">
          <input
            className="input"
            aria-label="계약 검색 (제목·위탁자·서류)"
            placeholder="🔍 제목·위탁자·서류로 검색"
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
            onChange={(e) => {
              const k = e.target.value as SortKey;
              setSort(k);
              saveSortKey(k); // 사용자 명시 변경에서만 영속(재진입·새로고침 후 유지)
            }}
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
      {/* 첫 진입(계약 0건)은 종전엔 안내 문구뿐인 막다른 빈 화면이라, 사용자가 여기서 바로
          작성을 시작할 길이 없었다(상단 breadcrumb 로 되돌아가야 했음). 안내 문구에 더해
          "새 계약 작성하기" 1차 CTA 를 둬 첫 사용 흐름을 연결한다(onStart=서류/신탁사 선택으로 이동).
          순수 내비게이션 — 조문·엔진·검증·산출물 무접촉(이동 콜백만 호출). */}
      {!loading && !err && rows.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
          <p className="field-hint">아직 저장된 계약이 없습니다. 서류를 작성하고 저장하면 여기에 모입니다.</p>
          {onStart && (
            <button className="btn btn-primary btn-sm" onClick={onStart}>
              <span aria-hidden="true">+ </span>새 계약 작성하기
            </button>
          )}
        </div>
      )}
      {!loading && !err && rows.length > 0 && visible.length === 0 && (
        <p className="field-hint">조건에 맞는 계약이 없습니다 — 검색어나 상태 필터를 바꿔 보세요.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visible.map((r) => {
          const docName = DOCUMENT_TYPES.find((d) => d.id === r.doc_type)?.name || r.doc_type;
          const readiness = docReadiness(r);
          const allReady = readiness !== null && readiness.ready === readiness.total;
          // joint(공동사업표준협약서) 준비도 — collateral 의 "N/7" 대신 단일 협약서 생성 가능 여부.
          const jointReady = jointReadiness(r);
          // 카드 "남은 필수 입력" 라벨 — 담보신탁(7종 합집합 rowMissing)·공동사업표준협약서
          // (validateJoint) 양쪽 패리티. 한 행은 collateral 또는 joint 라 상호배타 — 준비 안 된
          // 쪽의 누락 라벨만 채워지고, 전부 준비(allReady)·산출정의 없는 종류면 빈 배열이라
          // 표시도 SR 고지도 없다. 카드 칩의 "N/7 생성 가능"(몇 종)·"필수 입력 누락"이 무엇이
          // 남았는지는 안 알려 주던 것을, 열지 않고 카드에서 바로 보여 준다(검증 흐름 UX —
          // 표시 전용·검증 게이트 무접촉, 라벨은 collateral=Missing.label / joint=문자열).
          const missingLabels: string[] =
            readiness && !allReady
              ? rowMissing(r).map((mi) => mi.label)
              : jointReady === false
                ? rowJointMissing(r)
                : [];
          // 위탁자·물건 소재지 — 실무 식별 기준(제목만으론 "(사본)"·동명 구분이 어려움).
          const identity = contractIdentity(r);
          const identityLine = [identity.trustor && `위탁자 ${identity.trustor}`, identity.property]
            .filter(Boolean)
            .join(" · ");
          // 카드 본문 클릭 = 계약 열기인데, 종전엔 <div onClick> 뿐이라 마우스로만
          // 활성화됐다(키보드/스크린리더는 우측 "열기" 버튼만 가능 — 큰 클릭 영역의
          // 마우스↔키보드 불일치). role=button + tabIndex + Enter/Space 로 키보드
          // 동등성을 부여한다(WCAG 2.1.1 Keyboard / 4.1.2 Name·Role·Value).
          // ★이름변경(인라인 입력) 중에는 role/포커스를 빼 입력의 Space 가 버블돼
          //   카드를 열지 않게 하고, 입력 자체가 포커스 대상이 되게 한다.
          const isEditing = editId === r.id;
          const statusLabel = r.status === "completed" ? "완료" : "작성중";
          const readyLabel = readiness
            ? `, 서류 ${readiness.ready}/${readiness.total} 생성 가능`
            : jointReady !== null
              ? `, ${jointReady ? "협약서 생성 가능" : "필수 입력 누락"}`
              : "";
          // 카드 본문(role=button)의 접근명에 남은 필수 입력을 포함 — 시각 사용자는 아래
          // 빨강 요약 줄(aria-hidden)을 보지만, SR 사용자는 카드 aria-label 이 내부 텍스트를
          // 가리므로(name 계산 우선) 여기에 실어 줘야 '무엇이' 남았는지 듣는다(요약 줄과 동일 출처).
          const missingLabel =
            missingLabels.length > 0
              ? `, 남은 필수 입력 ${missingLabels.length}건: ${missingLabels.join(", ")}`
              : "";
          const openLabel = `${r.title}, ${statusLabel}${readyLabel}${missingLabel} — 열기`;
          return (
            <div key={r.id} className="contract-card">
              <div
                className="contract-card-open"
                style={{ cursor: "pointer", flex: 1 }}
                onClick={() => onOpen(r)}
                {...(isEditing
                  ? {}
                  : {
                      role: "button",
                      tabIndex: 0,
                      "aria-label": openLabel,
                      onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                        // 카드 자체에서 난 Enter/Space 만 처리 — 내부 요소에서 버블된
                        // 키는 무시(e.currentTarget 기준)해 오작동을 막는다.
                        if (e.target !== e.currentTarget) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpen(r);
                        }
                      },
                    })}
              >
                <div className="contract-card-head">
                  {editId === r.id ? (
                    <span className="contract-rename" onClick={(e) => e.stopPropagation()}>
                      <input
                        className="input contract-rename-input"
                        value={editVal}
                        autoFocus
                        aria-label="계약 이름"
                        maxLength={120}
                        onChange={(e) => setEditVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitRename();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelRename();
                          }
                        }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={commitRename}>
                        저장
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={cancelRename}>
                        취소
                      </button>
                    </span>
                  ) : (
                    <span className="contract-card-title">
                      <Highlight text={r.title} query={q} />
                    </span>
                  )}
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
                      <span aria-hidden="true">{allReady ? "✓" : "⚠"}</span> 서류 {readiness.ready}/{readiness.total} 생성 가능
                    </span>
                  )}
                  {jointReady !== null && (
                    <span
                      className={"ready-chip " + (jointReady ? "ok" : "warn")}
                      title={
                        jointReady
                          ? "필수 입력이 모두 채워져 공동사업표준협약서를 생성할 수 있습니다"
                          : "필수 입력 누락으로 아직 협약서를 생성할 수 없습니다(열기 → 누락 항목 확인)"
                      }
                    >
                      <span aria-hidden="true">{jointReady ? "✓" : "⚠"}</span>{" "}
                      {jointReady ? "협약서 생성 가능" : "필수 입력 누락"}
                    </span>
                  )}
                </div>
                {identityLine && (
                  <div className="contract-card-identity" style={{ marginTop: 4 }}>
                    <Highlight text={identityLine} query={q} />
                  </div>
                )}
                <div className="field-hint" style={{ marginTop: 5 }}>
                  <Highlight text={docName} query={q} />
                  {r.category ? ` · ${CATEGORY_LABEL[r.category as Category] || r.category}` : ""} ·{" "}
                  {/* 수정 시각 = 상대 표기(최근 수정순 정렬 훑기). 정확한 전체 시각은 title(hover)·
                      sr-only 로 보존해 상대 표기로 잃는 정밀도를 보강한다(표시 전용). 손상 저장본의
                      비실재 시각은 toISOString 이 throw 하므로 유효할 때만 dateTime 부여(렌더 크래시 방지). */}
                  {(() => {
                    const ts = new Date(r.updated_at);
                    const valid = Number.isFinite(ts.getTime());
                    const full = ts.toLocaleString("ko-KR");
                    return (
                      <time dateTime={valid ? ts.toISOString() : undefined} title={full}>
                        {formatRelativeTime(r.updated_at, nowMs) || full}
                        <span className="sr-only"> ({full})</span>
                      </time>
                    );
                  })()}
                </div>
                {/* 남은 필수 입력 요약 — 준비도 칩(담보신탁 '몇 종'·협약서 '누락')에 더해
                    '무엇이' 남았는지 한 줄로(앞 4건 + "외 N건"). 담보신탁·공동사업협약 양쪽
                    패리티. 계약을 열지 않고도 무엇을 채워야 하는지 바로 보인다. 줄 전체
                    aria-hidden — 낭독은 카드 aria-label(openLabel)이 전담(중복 0). 검증 게이트
                    무접촉(collateral=rowMissing / joint=validateJoint.missing 표시)·새 CSS 0. */}
                {missingLabels.length > 0 && (
                  <div
                    className="field-hint"
                    style={{ marginTop: 5, color: "var(--c-danger)" }}
                    aria-hidden="true"
                  >
                    ⚠ 남은 필수 입력: {missingLabels.slice(0, 4).join(" · ")}
                    {missingLabels.length > 4 ? ` 외 ${missingLabels.length - 4}건` : ""}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {readiness && readiness.ready > 0 && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => generateRowDocs(r)}
                      disabled={batch?.busy}
                      aria-label={`${r.title} — 준비된 서류 ${readiness.ready}종 생성`}
                      title={`준비된 ${readiness.ready}종 서류를 Word(.docx)로 한 번에 생성합니다 (누락 서류는 제외)`}
                    >
                      {batch?.busy && batch.id === r.id
                        ? "⏳ 생성 중…"
                        : `⬇ 서류 ${readiness.ready}종 생성`}
                    </button>
                  )}
                  {/* 준비된 N종 통합 검수 미리보기 — 일괄 생성의 검수 짝(내려받기 전 정독).
                      열지 않고도 준비된 서류 전부를 한 새 창에 모아 읽기 전용으로 검수한다.
                      Wizard 헤더 previewAllReady 의 목록 패리티. 동일 readiness.ready>0 조건. */}
                  {readiness && readiness.ready > 0 && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => previewRowDocs(r)}
                      disabled={batch?.busy}
                      aria-label={`${r.title} — 준비된 서류 ${readiness.ready}종 검수 미리보기`}
                      title={`준비된 ${readiness.ready}종 서류를 한 새 창에 모아 정독합니다(읽기 전용 · 인쇄 대화상자 없음)`}
                    >
                      <span aria-hidden="true">🔍 </span>검수 미리보기
                    </button>
                  )}
                  {jointReady === true && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => generateRowJoint(r)}
                      disabled={batch?.busy}
                      aria-label={`${r.title} 협약서 생성`}
                      title="공동사업표준협약서를 Word(.docx)로 생성합니다"
                    >
                      {batch?.busy && batch.id === r.id ? "⏳ 생성 중…" : "⬇ 협약서 생성"}
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onOpen(r)}
                    aria-label={`${r.title} 열기`}
                  >
                    열기
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => startRename(r)}
                    disabled={batch?.busy || editId === r.id}
                    aria-label={`${r.title} 이름변경`}
                    title="이 계약의 이름(제목)을 바꿉니다"
                  >
                    이름변경
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onDuplicate(r.id)}
                    disabled={batch?.busy}
                    aria-label={`${r.title} 복제`}
                    title="이 계약을 입력값 그대로 사본으로 복제하고 바로 편집합니다 (작성중 상태)"
                  >
                    복제
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onDelete(r)}
                    disabled={batch?.busy}
                    aria-label={`${r.title} 삭제`}
                  >
                    삭제
                  </button>
                </div>
                {/* 시각 표시 전용(카드 옆 진행 표시) — 낭독은 상단 영속 라이브 영역(liveStatus)이 담당. */}
                {batch?.id === r.id && batch.msg && (
                  <span
                    className="field-hint"
                    style={{ textAlign: "right", maxWidth: 320 }}
                  >
                    <StatusGlyphText msg={batch.msg} />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
