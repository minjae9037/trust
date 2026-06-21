import type { NextConfig } from "next";

// DEPLOY_TARGET=pages 일 때만 정적 export 모드(GitHub Pages 서브경로 /trust-saas/).
// 일반 dev / Vercel 배포에는 영향 없음(서버 라우트·미들웨어 정상).
const isPages = process.env.DEPLOY_TARGET === "pages";

const nextConfig: NextConfig = {
  // 상담 RAG 인덱스(_backdata-index.json)는 코드가 정적 import 하지 않고 런타임 fs 로 읽으므로
  // Vercel serverless 번들에 자동 포함되지 않는다 → 파일 트레이싱에 명시 포함(공개 repo엔 .gitignore 로 계속 제외).
  outputFileTracingIncludes: {
    "/api/advisor": [
      "./src/lib/advisor/_backdata-index.json",
      // 시맨틱 캐시 정적 FAQ 시드(런타임 fs 로 읽음) — 무 API 즉답 1차 캐시.
      "./src/lib/advisor/_advisor-faq.json",
    ],
  },
  // docx 는 node/브라우저 양쪽 번들; pdf.js·tesseract 는 public/lib 에서 동적 로드
  ...(isPages
    ? {
        output: "export" as const,
        basePath: "/trust-saas",
        assetPrefix: "/trust-saas",
        images: { unoptimized: true },
        trailingSlash: true,
        // 클라이언트에서 public/lib(OCR pdf.js·tesseract) 경로 접두어로 사용
        env: { NEXT_PUBLIC_BASE_PATH: "/trust-saas" },
      }
    : {}),
};

export default nextConfig;
