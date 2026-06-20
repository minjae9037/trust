/* 확장자 없는 import 를 .ts 로 해석해주는 최소 ESM 로더 (Node 타입스트립과 함께 사용) */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

export async function resolve(specifier, context, next) {
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !path.extname(specifier)) {
    const parentPath = fileURLToPath(context.parentURL);
    const base = path.resolve(path.dirname(parentPath), specifier);
    for (const cand of [base + ".ts", base + ".tsx", path.join(base, "index.ts")]) {
      if (existsSync(cand)) {
        return next(pathToFileURL(cand).href, context);
      }
    }
  }
  return next(specifier, context);
}
