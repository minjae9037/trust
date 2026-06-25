/* ================================================================
   계약 저장소 — localStorage 백엔드 (무계정 동작)
   ⚠️ 출시 시 lib/contracts.ts(Supabase)로 교체하면 동일 인터페이스로 스왑 가능.
   ================================================================ */
import type { ContractForm, JointForm } from "@/lib/engine/model";

const KEY = "trust_contracts";

/**
 * 저장되는 입력값 — 담보신탁 등은 ContractForm, 공동사업표준협약서(joint)는 JointForm.
 * doc_type 으로 구분한다(localStorage 는 JSON 이라 런타임 영향 없음 · 타입만 분기).
 */
export type StoredForm = ContractForm | JointForm;

export interface ContractRow {
  id: string;
  doc_type: string;
  category: string | null;
  status: string;
  title: string;
  form_data: StoredForm;
  updated_at: string;
  created_at: string;
}

export interface SaveInput {
  id?: string;
  docType: string;
  category: string | null;
  title: string;
  formData: StoredForm;
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

/**
 * 다운로드 파일명이 같아 산출 .docx 가 섞일 수 있는 행들의 id 집합(순수).
 * 로컬 우선(브라우저 다운로드) 구조라, 두 계약의 산출 파일명이 같으면 사용자가 받는 .docx 가
 * 서로 덮어쓰이거나(브라우저 "(1)" 접미사) 어느 계약 것인지 구분되지 않아 섞인다 — 신탁 서류는
 * 법적 효력 문서라 섞임은 정확성 위험이다(다른 계약의 서류를 제출). 산출 파일명은 서류종류명이
 * 서류마다 불변이므로, 두 계약이 (모든 서류에서) 섞이는지 = 다운로드 식별 키(위탁자·체결일·소재지)
 * 동일 여부와 같다. keyFor 가 각 행의 그 키를 준다(엔진 contractFileKey 등 **실제 다운로드명과 동일
 * 단일 출처** 주입) — 식별 불가(빈 키 null)면 제외(빈 초안 노이즈 방지). 같은 키 행이 2개 이상이면
 * 그 행 전부를 충돌로 표시한다(입력 배열 무변형 — 순수 함수, 회귀 가드에서 직접 단언).
 * ※ 조문·엔진·검증·산출물 무접촉 — 저장된 행의 식별 키를 묶어 표시에 쓸 뿐이다.
 */
export function collidingDownloadIds(
  rows: ContractRow[],
  keyFor: (r: ContractRow) => string | null,
): Set<string> {
  const byKey = new Map<string, string[]>();
  for (const r of rows) {
    const k = keyFor(r);
    if (!k) continue;
    const arr = byKey.get(k);
    if (arr) arr.push(r.id);
    else byKey.set(k, [r.id]);
  }
  const out = new Set<string>();
  for (const ids of byKey.values()) {
    if (ids.length > 1) for (const id of ids) out.add(id);
  }
  return out;
}

/**
 * 작성 중(위저드) 계약의 다운로드 식별 키가 **다른** 저장 계약과 충돌하는지(순수).
 * 내 계약 목록의 사후 경고(collidingDownloadIds)와 짝이 되는 위저드 사전 점검 — 생성·
 * 다운로드 직전, 같은 키(위탁자·체결일·소재지)의 다른 저장 계약이 있어 산출 .docx/PDF 가
 * 섞일 수 있는지 미리 알린다. keyFor 는 collidingDownloadIds 와 **동일한 downloadKeyOf**
 * (lib/ui/download-key 단일 출처)를 주입해 목록 경고와 판정이 어긋나지 않게 한다(드리프트 0).
 * currentId(작성 중 계약의 저장 id, 미저장 null)는 제외(자기 자신은 충돌 아님), 빈 키
 * (식별 불가)면 false. ※ contractRepo 는 엔진을 import 하지 않으므로(가드 런타임 로더 호환)
 * 키 산출을 외부 주입으로 받는다 — 표시 전용, 저장 행의 식별 키를 비교할 뿐(조문·엔진 무접촉).
 */
export function downloadKeyCollidesWithSaved(
  rows: ContractRow[],
  currentId: string | null,
  currentKey: string | null,
  keyFor: (r: ContractRow) => string | null,
): boolean {
  if (!currentKey) return false;
  return rows.some((r) => r.id !== currentId && keyFor(r) === currentKey);
}

/** 현재 저장된 모든 계약 행의 스냅샷(동기) — 위저드의 사전 충돌 점검 등 즉시 조회용. */
export function snapshotContracts(): ContractRow[] {
  return readAll();
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
  // 쓰기 성공 후에만 구독자에게 변경을 알린다(실패=무손상이므로 미통지). 저장·삭제·
  // 복원·이름변경·복제·가져오기 등 모든 변형이 writeAll 단일 경로를 지나므로, 여기 한
  // 곳에서 통지하면 카운트 구독자(브레드크럼 "내 계약 N")가 항상 저장소와 일치한다.
  emitContractsChanged();
}

/* ----------------------------------------------------------------
   저장 건수 구독(표시 전용) — 브레드크럼 "내 계약 N" 배지가 저장소 변경에 따라
   살아 있게 한다. 같은 탭의 변형은 writeAll 통지로, 다른 탭의 변형은 window "storage"
   이벤트로 반영한다(useSyncExternalStore 표준 패턴). 조문·엔진·산출물·검증 무접촉 —
   저장된 행 수를 읽어 표시에 쓸 뿐이다(순수 카운트, 회귀 가드에서 직접 단언).
   ---------------------------------------------------------------- */
const contractListeners = new Set<() => void>();
function emitContractsChanged() {
  for (const l of contractListeners) l();
}

/** 현재 저장된 계약 수(localStorage). getSnapshot=원시 number 라 참조 안정성 불요. */
export function contractCount(): number {
  return readAll().length;
}

/**
 * 저장 건수 변경 구독(useSyncExternalStore subscribe 계약) — 콜백 등록 + 다른 탭의
 * 저장소 변경(storage 이벤트, 우리 KEY 한정) 연결. 정리 함수에서 둘 다 해제한다.
 */
export function subscribeContracts(cb: () => void): () => void {
  contractListeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    // 다른 탭의 localStorage 변경만 전달된다. 우리 키(또는 전체 clear=key null)일 때만 통지.
    if (e.key === null || e.key === KEY) cb();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    contractListeners.delete(cb);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}
function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "c-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * 저장 (id 있으면 갱신, 없으면 신규). 저장된 id 반환.
 * 제목은 normalizeTitle 로 정규화한다(앞뒤 공백 제거·빈/공백 → "제목 없음") — rename 과 동일
 * 단일 출처. 종전 `input.title || "제목 없음"` 은 공백만 입력("   ")을 truthy 로 통과시켜
 * 카드 제목이 공백으로 저장되던(목록에서 빈 제목 카드) 반면, rename 은 "제목 없음" 으로 정규화해
 * 두 경로의 결과가 갈렸다 → normalizeTitle 재사용으로 저장·이름변경 트림 일관성 확보.
 */
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
        title: normalizeTitle(input.title),
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
    title: normalizeTitle(input.title),
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
 * 삭제 실행취소 큐(순수) — 연속 삭제(실행취소 창 7초 안에 여러 건)에도 각 삭제가
 * **독립된** 실행취소 항목을 갖게 한다. 단일 슬롯이면 다음 삭제가 직전 항목을 덮어써
 * 먼저 지운 계약을 되돌릴 수 없게 되고(영구 유실 — "실수 삭제 방지" 위배), 그 사실이
 * 사용자에게 보이지도 않는다. 최근 삭제가 맨 앞(LIFO 표시)이며 id 중복은 차단한다.
 * dequeueUndo 는 실행취소·만료 시 해당 항목만 제거한다(다른 대기 항목 보존).
 * (순수 함수 — 입력 배열 무변형. 회귀 가드에서 직접 단언)
 */
export function enqueueUndo(queue: ContractRow[], row: ContractRow): ContractRow[] {
  return [row, ...queue.filter((r) => r.id !== row.id)];
}
export function dequeueUndo(queue: ContractRow[], id: string): ContractRow[] {
  return queue.filter((r) => r.id !== id);
}

/**
 * "(사본)" 제목 생성 — 기존 사본 접미사를 한 번 벗겨(중첩 방지) 충돌 시 번호를 붙인다.
 * 예) "계약 A" → "계약 A (사본)", 다시 복제 → "계약 A (사본 2)".
 * 사본 접미사를 벗긴 뒤의 트림·빈 → "제목 없음" 폴백은 normalizeTitle 단일 출처를 재사용한다
 * (저장 saveContract·이름변경 renameRow 와 동일 규칙 — 종전 인라인 `.trim() || "제목 없음"`
 * 중복을 제거해, 정규화 규칙이 바뀌어도 세 경로가 갈리지 않게 한다. 호이스팅으로 정의 앞 호출 안전).
 * (순수 함수 — 회귀 가드에서 직접 단언)
 */
export function nextCopyTitle(base: string, existingTitles: string[]): string {
  const root = normalizeTitle((base || "").replace(/\s*\(사본(?: \d+)?\)\s*$/, ""));
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
    form_data: JSON.parse(JSON.stringify(src.form_data)) as StoredForm,
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

/* ----------------------------------------------------------------
   이름 변경(rename) — 저장된 계약의 제목만 바꾼다.
   배경: 제목은 저장 시 자동 생성되거나 복제 시 "(사본)"이 붙는데, 목록에서 이를
   의미 있는 딜명("판교 PF 담보신탁" 등)으로 바꿀 수단이 없었다(삭제·복제·백업은
   있으나 rename 부재). 실무에선 같은 위탁자·여러 사본을 제목으로 구분하므로
   카드에서 바로 이름을 고칠 수 있어야 한다(검색·정렬·식별의 핵심).
   ※ 제목만 변경 — form_data·doc_type·status·생성 시각은 무변형(조문·엔진 무접촉).
   ---------------------------------------------------------------- */

/** 제목 정규화(순수) — 앞뒤 공백 제거, 비면 "제목 없음". 저장(saveContract)·이름변경(renameRow) 공용 단일 출처. */
export function normalizeTitle(raw: string): string {
  return (raw || "").trim() || "제목 없음";
}

/**
 * 제목 변경(순수) — id 가 일치하는 행의 title 만 정규화해 교체하고 updated_at 을 갱신한다.
 * 입력 배열·행을 변형하지 않으며(불변), id 미존재 시 내용 변화 없이 그대로 반환한다.
 * title 외 필드(form_data·doc_type·status·created_at)는 보존한다(제목만 변경 보장).
 * (순수 함수 — 회귀 가드에서 직접 단언)
 */
export function renameRow(rows: ContractRow[], id: string, title: string, now: string): ContractRow[] {
  const clean = normalizeTitle(title);
  return rows.map((r) => (r.id === id ? { ...r, title: clean, updated_at: now } : r));
}

/** 이름 변경 — 저장된 계약의 제목만 바꾼다(정규화·시각 갱신, 나머지 무변형). */
export async function renameContract(id: string, title: string): Promise<void> {
  writeAll(renameRow(readAll(), id, title, new Date().toISOString()));
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
