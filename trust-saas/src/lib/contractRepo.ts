/* ================================================================
   계약 저장소 — localStorage 백엔드 (무계정 동작)
   ⚠️ 출시 시 lib/contracts.ts(Supabase)로 교체하면 동일 인터페이스로 스왑 가능.
   ================================================================ */
import type { ContractForm } from "@/lib/engine/model";

const KEY = "trust_contracts";

export interface ContractRow {
  id: string;
  doc_type: string;
  category: string | null;
  status: string;
  title: string;
  form_data: ContractForm;
  updated_at: string;
  created_at: string;
}

export interface SaveInput {
  id?: string;
  docType: string;
  category: string | null;
  title: string;
  formData: ContractForm;
  status?: string;
}

/**
 * 카드 표시·검색용 보조 식별자 — 실무에선 계약을 **위탁자(truster)·물건 소재지**로 식별한다.
 * 제목은 사용자 자유 입력(미입력·중복·"(사본)" 다수 가능)이라 그것만으론 구분이 어렵다.
 * 저장된 form_data에서 대표 위탁자명과 첫 물건 소재지를 뽑아 카드 부제·검색 대상으로 보강한다.
 * doc_type별 구조 차이(collateral=trustors[]/properties[], joint=gap/project)와
 * 구버전·손상 저장본(키 누락·null)을 옵셔널 체이닝+try/catch로 안전 격리(목록 크래시 방지).
 * ※ 조문·엔진 무접촉 — 저장된 입력값을 읽어 표시·검색에 쓸 뿐이다(순수 함수, 회귀 가드 단언).
 */
export function contractIdentity(row: {
  doc_type: string;
  form_data: unknown;
}): { trustor: string; property: string } {
  const fd = row.form_data as
    | {
        trustors?: { name?: string }[];
        properties?: { address?: string }[];
        gap?: { name?: string };
        project?: { site?: string };
      }
    | null
    | undefined;
  try {
    if (row.doc_type === "joint") {
      return { trustor: (fd?.gap?.name ?? "").trim(), property: (fd?.project?.site ?? "").trim() };
    }
    return {
      trustor: (fd?.trustors?.[0]?.name ?? "").trim(),
      property: (fd?.properties?.[0]?.address ?? "").trim(),
    };
  } catch {
    return { trustor: "", property: "" };
  }
}

function readAll(): ContractRow[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as ContractRow[];
  } catch {
    return [];
  }
}

/* ----------------------------------------------------------------
   저장 실패(용량 초과·비활성) 가드 — 유실 방지 계열의 마지막 갭
   로컬 우선(localStorage) 구조라 저장이 실패하면 곧 데이터 유실이다.
   localStorage 는 보통 5~10MB로 한정돼 계약이 쌓이면 setItem 이
   QuotaExceededError 를 던지고(용량 초과), 사생활/시크릿 모드에선
   접근 자체가 막혀 SecurityError 를 던질 수 있다. 가드 없이 두면
   브라우저별 영문 DOMException 이 그대로 노출돼 사용자가 무엇을 해야
   할지 알 수 없다 → 친화적 한글 안내(백업 후 정리)로 바꿔 surface.
   ※ 조문·엔진·산출물 무접촉 — 저장소 쓰기 신뢰성만 보강한다.
   ---------------------------------------------------------------- */

/** localStorage 쓰기 실패 — 호출 UI 가 quota 여부로 분기·안내할 수 있다. */
export class StorageWriteError extends Error {
  readonly quota: boolean;
  constructor(message: string, quota: boolean) {
    super(message);
    this.name = "StorageWriteError";
    this.quota = quota;
  }
}

/**
 * 브라우저별 용량 초과(QuotaExceededError) 식별(순수).
 * Chrome/Safari: name "QuotaExceededError" 또는 code 22.
 * Firefox: name "NS_ERROR_DOM_QUOTA_REACHED" 또는 code 1014.
 * 구형(WebKit/IE): name "QUOTA_EXCEEDED_ERR".
 * (회귀 가드에서 직접 단언)
 */
export function isQuotaExceeded(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as { name?: string; code?: number };
  return (
    err.name === "QuotaExceededError" ||
    err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    err.name === "QUOTA_EXCEEDED_ERR" ||
    err.code === 22 ||
    err.code === 1014
  );
}

/** 저장 실패 사용자 안내 문구(순수·단일 출처) — quota 여부로 분기. */
export function storageWriteErrorMessage(quota: boolean): string {
  return quota
    ? "저장 공간이 가득 찼습니다. 계약을 내보내기(백업)한 뒤 오래된 계약을 삭제하고 다시 저장해 주세요."
    : "브라우저 저장소에 접근할 수 없어 저장하지 못했습니다(사생활·시크릿 모드일 수 있습니다). 계약을 내보내기로 백업해 주세요.";
}

function writeAll(rows: ContractRow[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows));
  } catch (e) {
    // setItem 실패 시 기존 저장본은 그대로 유지된다(부분 기록 없음=무손상).
    // 새 변경만 반영되지 못하므로, 사용자가 백업·정리할 수 있게 친화적으로 안내한다.
    const quota = isQuotaExceeded(e);
    throw new StorageWriteError(storageWriteErrorMessage(quota), quota);
  }
}
function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "c-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** 저장 (id 있으면 갱신, 없으면 신규). 저장된 id 반환 */
export async function saveContract(input: SaveInput): Promise<string> {
  const rows = readAll();
  const now = new Date().toISOString();
  if (input.id) {
    const i = rows.findIndex((r) => r.id === input.id);
    if (i >= 0) {
      rows[i] = {
        ...rows[i],
        doc_type: input.docType,
        category: input.category,
        title: input.title || "제목 없음",
        form_data: input.formData,
        status: input.status ?? rows[i].status,
        updated_at: now,
      };
      writeAll(rows);
      return input.id;
    }
  }
  const id = uuid();
  rows.unshift({
    id,
    doc_type: input.docType,
    category: input.category,
    status: input.status ?? "draft",
    title: input.title || "제목 없음",
    form_data: input.formData,
    created_at: now,
    updated_at: now,
  });
  writeAll(rows);
  return id;
}

export async function listContracts(): Promise<ContractRow[]> {
  return readAll().sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

export async function getContract(id: string): Promise<ContractRow | null> {
  return readAll().find((r) => r.id === id) ?? null;
}

export async function deleteContract(id: string): Promise<void> {
  writeAll(readAll().filter((r) => r.id !== id));
}

/**
 * 삭제 실행취소(순수) — 삭제됐던 행을 그대로 되돌린다(맨 앞에 복원).
 * 이미 같은 id가 있으면 변경하지 않는다(멱등 — 중복 복원 방지). id·시각·form_data 무변형.
 * (dirty 가드·백업과 동일한 "유실 방지" 계열 — 실수 삭제의 마지막 안전망. 회귀 가드에서 직접 단언)
 */
export function restoreRow(existing: ContractRow[], row: ContractRow): ContractRow[] {
  if (existing.some((r) => r.id === row.id)) return existing;
  return [row, ...existing];
}

/** 삭제 실행취소 — 방금 삭제한 행을 그대로 저장소에 되돌린다(멱등). */
export async function restoreContract(row: ContractRow): Promise<void> {
  writeAll(restoreRow(readAll(), row));
}

/**
 * "(사본)" 제목 생성 — 기존 사본 접미사를 한 번 벗겨(중첩 방지) 충돌 시 번호를 붙인다.
 * 예) "계약 A" → "계약 A (사본)", 다시 복제 → "계약 A (사본 2)".
 * (순수 함수 — 회귀 가드에서 직접 단언)
 */
export function nextCopyTitle(base: string, existingTitles: string[]): string {
  const root = (base || "").replace(/\s*\(사본(?: \d+)?\)\s*$/, "").trim() || "제목 없음";
  const taken = new Set(existingTitles);
  let cand = `${root} (사본)`;
  for (let n = 2; taken.has(cand); n++) cand = `${root} (사본 ${n})`;
  return cand;
}

/**
 * 원본 행 → 사본 행(순수). form_data 를 깊은 복사해 원본과 참조를 분리하고,
 * 상태는 "작성중"으로 초기화한다(사본은 항상 새 작성건). id·시각은 호출자가 주입.
 * (순수 함수 — 회귀 가드에서 직접 단언)
 */
export function makeDuplicateRow(
  src: ContractRow,
  existingTitles: string[],
  newId: string,
  now: string,
): ContractRow {
  return {
    ...src,
    id: newId,
    title: nextCopyTitle(src.title, existingTitles),
    form_data: JSON.parse(JSON.stringify(src.form_data)) as ContractForm,
    status: "draft",
    created_at: now,
    updated_at: now,
  };
}

/**
 * 복제 — 기존 계약을 입력값 그대로 새 계약(사본)으로 저장. 새 id 반환(원본 없으면 null).
 * 동일 위탁자·유사 구조 계약을 반복 작성하는 흐름을 가속한다(조문·엔진 무접촉, 저장 데이터만).
 */
export async function duplicateContract(id: string): Promise<string | null> {
  const rows = readAll();
  const src = rows.find((r) => r.id === id);
  if (!src) return null;
  const newId = uuid();
  const dup = makeDuplicateRow(src, rows.map((r) => r.title), newId, new Date().toISOString());
  rows.unshift(dup);
  writeAll(rows);
  return newId;
}

/* ================================================================
   백업(내보내기) · 복원(가져오기)
   로컬 우선(localStorage) 구조라 계약 데이터가 한 브라우저에 갇혀 있다 — 캐시 삭제·
   기기 변경 시 전부 유실되고, 동료와 계약을 주고받을 수단도 없다. JSON 백업 파일로
   내보내고 다시 가져와 이 유실 위험을 막는다(dirty 가드와 동일한 "유실 방지" 계열).
   ※ 조문·엔진·생성 로직 무접촉 — 저장된 행을 직렬화·병합할 뿐이다.
   ================================================================ */
export const BACKUP_FORMAT = "trustform.contracts";
export const BACKUP_VERSION = 1;

export interface ContractBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exported_at: string;
  count: number;
  contracts: ContractRow[];
}

/** 행 배열 → 백업 객체(순수). 시각은 호출자가 주입. */
export function makeBackup(rows: ContractRow[], now: string): ContractBackup {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exported_at: now, count: rows.length, contracts: rows };
}

/** 가져오기 가능한 최소 형태인지 검사(순수) — 손상·이질 데이터 격리용. */
export function isValidRow(x: unknown): x is ContractRow {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.id === "string" && r.id.length > 0 &&
    typeof r.doc_type === "string" &&
    typeof r.title === "string" &&
    !!r.form_data && typeof r.form_data === "object"
  );
}

/** 백업 텍스트 파싱·형식 검증(순수) — 형식 불일치 시 throw. */
export function parseBackup(text: string): ContractBackup {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error("JSON 파싱 실패 — 올바른 백업 파일이 아닙니다.");
  }
  const b = obj as Partial<ContractBackup> | null;
  if (!b || typeof b !== "object" || b.format !== BACKUP_FORMAT || !Array.isArray(b.contracts)) {
    throw new Error("TrustForm 계약 백업 형식이 아닙니다.");
  }
  return b as ContractBackup;
}

/**
 * 비파괴 병합(순수) — 가져온 행 중 **로컬에 없는 id만 추가**하고, 이미 있는 id는 건너뛴다.
 * → 기존 계약을 절대 덮어쓰거나 지우지 않으며(데이터 안전), 같은 백업을 다시 가져와도
 *   중복이 생기지 않는다(복원 멱등성). 가져온 파일 내부의 중복 id도 한 번만 추가.
 */
export function mergeImported(
  existing: ContractRow[],
  imported: unknown[],
): { merged: ContractRow[]; added: number; skipped: number } {
  const seen = new Set(existing.map((r) => r.id));
  const toAdd: ContractRow[] = [];
  for (const r of imported) {
    if (!isValidRow(r) || seen.has(r.id)) continue;
    seen.add(r.id);
    toAdd.push(r);
  }
  return { merged: [...toAdd, ...existing], added: toAdd.length, skipped: imported.length - toAdd.length };
}

/** 내보내기 — 현재 모든 계약을 백업 객체로 반환(직렬화·다운로드는 호출자/UI 담당). */
export function exportContracts(): ContractBackup {
  return makeBackup(readAll(), new Date().toISOString());
}

/** 가져오기 — 백업 텍스트를 파싱·비파괴 병합해 저장. 추가/건너뜀 건수 반환. */
export function importContracts(text: string): { added: number; skipped: number } {
  const backup = parseBackup(text);
  const { merged, added, skipped } = mergeImported(readAll(), backup.contracts);
  writeAll(merged);
  return { added, skipped };
}
