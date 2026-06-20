/* ============================================================
   회귀 가드 — TrustForm 브랜드 아이콘(favicon) + 메타/OG

   배경: 앱에 아이콘 자산이 전혀 없어 브라우저가 /favicon.ico 를 임의
   요청 → 매 검증마다 콘솔 404 가 발생했다(대표님 확정 "타이틀·메타·OG·
   아이콘 브랜딩"의 미완 부분). App Router 규약 app/icon.svg 를 추가하고
   layout.tsx 에 icons/openGraph/twitter 메타를 선언해 브라우저가 선언된
   브랜드 아이콘을 쓰도록(=/favicon.ico 임의요청 차단) 했다.

   이 가드는 그 브랜딩 자산이 사라지거나 메타가 비는 회귀를 정적 차단한다.
     (A) app/icon.svg 존재 + TrustForm 브랜드 색(브라운) 사용
     (B) layout.tsx 에 아이콘 선언(icons → /icon.svg)
     (C) layout.tsx 에 OG/Twitter 메타(브랜드명·제목·설명) 존재

   실행:
     cd trust-saas
     node scripts/verify-brand-icon.mjs
   ============================================================ */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconPath = join(root, "src/app/icon.svg");
const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] App Router 규약 아이콘(app/icon.svg) 존재 + 브랜드 색");
ok(existsSync(iconPath), "src/app/icon.svg 파일 존재(favicon 자동 주입)");
const svg = existsSync(iconPath) ? readFileSync(iconPath, "utf8") : "";
ok(/<svg[\s\S]*<\/svg>/.test(svg), "유효한 <svg> 마크업");
ok(/#8B6E4F|#5C4836|#C9A875|#F5E8D2/i.test(svg), "TrustForm 브라운 팔레트 사용");

console.log("\n[B] layout.tsx 아이콘 선언 → /icon.svg");
ok(/icons\s*:/.test(layout), "metadata.icons 선언 존재");
ok(/icon\.svg/.test(layout), "아이콘 경로 /icon.svg 참조(브라우저가 선언된 아이콘 사용)");

console.log("\n[C] OG/Twitter 브랜드 메타");
ok(/openGraph\s*:/.test(layout), "openGraph 메타 존재");
ok(/twitter\s*:/.test(layout), "twitter 카드 메타 존재");
ok(/locale\s*:\s*["']ko_KR["']/.test(layout), "og:locale = ko_KR");
ok(/TrustForm/.test(layout) && /트러스트폼/.test(layout), "브랜드명(TrustForm·트러스트폼) 메타 반영");

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
