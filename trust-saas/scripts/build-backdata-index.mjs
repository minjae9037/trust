/* ================================================================
   back-data → 상담 RAG 인덱스 빌더 (#3 대량 인제스트)
   D:\Claude_Cowork\back-data\knowledge\**.md 중 "일반 지침/매뉴얼"만 골라
   청크로 쪼개 src/lib/advisor/_backdata-index.json 생성(서버 전용·gitignore).
   ⚠️ 대외비 보호:
     - allowlist(업무매뉴얼·지침·실무·요령·기준·평가론·방법론 등)만 포함
     - 딜/고객 특정 문서(IM·사업수지·계약서·심사·제안서·의뢰서·약정서·확약서·
       투자설명서·확인서·견적·감정평가서·보고서·현황·명세 등) 제외
     - 산출 JSON은 절대 공개 저장소 커밋 금지(.gitignore 처리됨). 로컬/서버 전용.
   실행: node scripts/build-backdata-index.mjs
   ================================================================ */
import { promises as fs } from "fs";
import path from "path";

const SRC = "D:\\Claude_Cowork\\back-data\\knowledge";
// 사용자가 직접 올리는 Q&A 근거 자료 (trust-qna/references) — 큐레이션된 것으로 보고 도메인게이트 면제
const QNA_SRC = path.join(process.cwd(), "..", "trust-qna", "references");
const OUT = path.join(process.cwd(), "src", "lib", "advisor", "_backdata-index.json");

// 포함 신호(일반 지식). 경로 또는 파일명에 하나라도 있으면 후보.
const INCLUDE = /업무매뉴얼|지침|매뉴얼|실무|요령|기준|평가론|방법론|가이드|해설|개론|규정|약관|표준/;
// 제외 신호(딜/고객 특정). 하나라도 있으면 제외(대외비 우선).
const EXCLUDE = /IM_|_IM|사업수지|계약서|심사|제안서|의뢰서|약정서|확약서|투자설명서|설명서|확인서|동의서|합의서|현황|명세|내역|견적|감정평가서|보고서|심의|송부|날인|천공|수지분석|매입약정|대출/;
// 특정사 내부자료(고유명) 폴더/문서 제외 — 발견 시 추가
const COMPANY_EXCLUDE = /동부건설|DL건설/;
// 청크 본문에 남으면 누출로 보고 폐기하는 패턴(경로·원본주석 잔재)
const LEAK = /Z:\\Drive|W:\\|\\Drive\\|원본\s*:/;
// 도메인 관련성(신탁·부동산금융·평가·자본시장). 무관 문서(건설교육·패션 등) 배제용.
const DOMAIN = /신탁|부동산|담보|우선수익|수익권|감정평가|경매|낙찰|유동화|리츠|펀드|PF|프로젝트금융|브릿지|대출|여신|채권|자본시장|증권사?|세무|취득세|양도세|종부세|분양|시행사?|시공사?|준공|인허가|금융|저당|근저당|신용|에스크로|대리사무|수탁|위탁자/g;
const DOMAIN_MIN = 6; // 문서 본문에서 도메인 키워드가 이 횟수 이상이어야 포함


function walk(dir) {
  return fs.readdir(dir, { withFileTypes: true }).then(async (ents) => {
    const out = [];
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...(await walk(p)));
      else if (e.isFile() && e.name.endsWith(".md")) out.push(p);
    }
    return out;
  });
}

function walkAll(dir) {
  return fs.readdir(dir, { withFileTypes: true }).then(async (ents) => {
    const out = [];
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...(await walkAll(p)));
      else if (e.isFile()) out.push(p);
    }
    return out;
  });
}

function tokenize(s) {
  return Array.from(new Set((s.toLowerCase().match(/[가-힣]{2,}|[a-z0-9]{2,}/g) || [])));
}
function topTags(text, n = 8) {
  const freq = new Map();
  for (const t of tokenize(text)) {
    if (t.length < 2) continue;
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([t]) => t);
}

/** 긴 세그먼트를 문장/길이 기준으로 강제 분할(단일 개행 문서 대응) */
function splitLong(seg, size) {
  if (seg.length <= size) return [seg];
  // 문장 경계(…다. / . / ? / !) 우선, 안 되면 하드 컷
  const sentences = seg.split(/(?<=[다요음함])\.\s|(?<=[.?!])\s/);
  const out = [];
  let buf = "";
  for (const s of sentences) {
    if (!s) continue;
    if ((buf + " " + s).length > size && buf) { out.push(buf.trim()); buf = s; }
    else buf = buf ? buf + " " + s : s;
    while (buf.length > size * 1.6) { out.push(buf.slice(0, size).trim()); buf = buf.slice(size); }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/** 본문을 ~700자 단위 청크로(문단·줄·문장·길이 다단계 분할) */
function chunkText(text, size = 700) {
  // 문단(빈 줄) → 없으면 줄 단위로 1차 세그먼트화
  let segs = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  if (segs.length <= 2) segs = text.split(/\n/).map((s) => s.trim()).filter(Boolean);
  // 각 세그먼트를 길이 제한으로 강제 분할
  const pieces = segs.flatMap((s) => splitLong(s, size));
  // 인접 조각을 ~size 로 재병합
  const chunks = [];
  let buf = "";
  for (const p of pieces) {
    if ((buf + "\n" + p).length > size && buf) { chunks.push(buf.trim()); buf = p; }
    else buf = buf ? buf + "\n" + p : p;
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.filter((c) => c.length >= 120 && c.length <= size * 2);
}

function cleanBase(name) {
  return name.replace(/\.(pdf|docx|xlsx|hwp)?\.md$/i, "").replace(/\.md$/i, "").replace(/[_]+/g, " ").trim();
}

async function main() {
  let files;
  try {
    files = await walk(SRC);
  } catch (e) {
    console.error("back-data 경로 접근 실패:", SRC, e.message);
    process.exit(1);
  }

  const included = [];
  const excludedByRule = [];
  const notGeneral = [];
  const offDomain = [];
  for (const f of files) {
    const rel = f.replace(SRC + "\\", "");
    const base = path.basename(f);
    const hay = rel; // 경로+파일명 전체로 판정
    if (EXCLUDE.test(hay) || COMPANY_EXCLUDE.test(hay)) { excludedByRule.push(rel); continue; }
    if (!INCLUDE.test(hay)) { notGeneral.push(rel); continue; }
    included.push({ f, base, rel });
  }

  const chunks = [];
  let nDoc = 0;
  for (const it of included) {
    let raw;
    try { raw = await fs.readFile(it.f, "utf8"); } catch { continue; }
    // 도메인 관련성 게이트: 신탁/금융/평가 키워드가 충분치 않으면 통째로 제외(노이즈 차단)
    const domainHits = (raw.match(DOMAIN) || []).length;
    if (domainHits < DOMAIN_MIN) { offDomain.push(it.rel); continue; }
    // 정제: 프런트매터 + 추출 주석(원본 경로·회사명 포함) + 내부경로 줄 제거(대외비 누출 차단)
    let body = raw.replace(/^---[\s\S]*?---\n/, "");
    body = body.replace(/<!--[\s\S]*?-->/g, "");           // <!-- 원본: Z:\... --> 주석 제거
    body = body
      .split("\n")
      .filter((ln) => !/(원본\s*:|Z:\\Drive|W:\\|\\Drive\\|^!\[)/.test(ln)) // 경로/이미지 줄 제거
      .join("\n");
    const parts = chunkText(body);
    if (parts.length === 0) continue;
    nDoc++;
    const topicBase = cleanBase(it.base);
    parts.forEach((text, i) => {
      if (LEAK.test(text) || COMPANY_EXCLUDE.test(text)) return; // 누출/특정사명 잔존 청크 폐기
      chunks.push({
        id: `bd-${nDoc}-${i}`,
        topic: topicBase,
        tags: topTags(text),
        text,
        _src: it.rel, // 출처(서버 로그/디버그용, 클라이언트 노출 안 함)
      });
    });
  }

  // ── 사용자 업로드 Q&A 근거 (trust-qna/references) 인제스트 ──
  // 사용자가 의도적으로 올린 자료 → 도메인게이트/allowlist 면제, 정제·누출필터만 적용.
  // ⚠️ 단, 특정사 실명·딜 특정 자료는 제외(대표님 지시 2026-06-21, 공개 상담 반영이므로 누출 차단).
  //    일반 신탁 실무·사규·교육·매뉴얼·법령·세무·참고자료만 인제스트.
  const QNA_BLOCK = /동부건설|DL건설|수주심의 Tool|경영실적보고|추정재무제표|현장별 손익|시공사 분석|수주사전검토회의 부의안|개발사업 B\.P|이행여부 검토 보고서|평택 타운 및 골프장|46배판/;
  let qnaFiles = [], qnaAll = [];
  try {
    qnaAll = (await walkAll(QNA_SRC)).filter((f) => /\.(md|txt)$/i.test(f) && !/[\\/](README|_manifest)\.md$/i.test(f));
    qnaFiles = qnaAll.filter((f) => !QNA_BLOCK.test(f));
  } catch { qnaFiles = []; }
  const nQnaBlocked = qnaAll.length - qnaFiles.length;
  let nQna = 0;
  for (const f of qnaFiles) {
    let raw;
    try { raw = await fs.readFile(f, "utf8"); } catch { continue; }
    let body = raw.replace(/^---[\s\S]*?---\n/, "").replace(/<!--[\s\S]*?-->/g, "");
    body = body.split("\n").filter((ln) => !/(원본\s*:|Z:\\Drive|W:\\|\\Drive\\|^!\[)/.test(ln)).join("\n");
    const parts = chunkText(body);
    if (parts.length === 0) continue;
    nQna++;
    const topicBase = cleanBase(path.basename(f));
    parts.forEach((text, i) => {
      if (LEAK.test(text) || COMPANY_EXCLUDE.test(text)) return; // 누출/특정사명 잔존 청크 폐기
      chunks.push({ id: `qna-${nQna}-${i}`, topic: topicBase, tags: topTags(text), text, _src: "qna:" + path.basename(f) });
    });
  }

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(chunks), "utf8");

  console.log("==== Q&A RAG 인덱스 빌드 ====");
  console.log(`back-data 총 .md: ${files.length}`);
  console.log(`trust-qna/references 업로드 문서: ${nQna} (도메인게이트 면제) · 특정사/딜 제외 ${nQnaBlocked}`);
  console.log(`포함(도메인 관련): 문서 ${nDoc} → 총 청크 ${chunks.length}`);
  console.log(`제외(딜/고객 특정 규칙): ${excludedByRule.length}`);
  console.log(`제외(매뉴얼/지침 아님): ${notGeneral.length}`);
  console.log(`제외(도메인 무관, 키워드<${DOMAIN_MIN}): ${offDomain.length}`);
  console.log(`출력: ${OUT}  (${(JSON.stringify(chunks).length / 1024 / 1024).toFixed(2)} MB, gitignored)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
