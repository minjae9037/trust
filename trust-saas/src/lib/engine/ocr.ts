/* ================================================================
   OCR — 등기부등본 PDF 추출 (참조 HTML OCR 객체 1259~1485 이식)
   pdf.js 임베디드 텍스트 우선 → 없으면 tesseract OCR 폴백.
   라이브러리는 /lib (public/lib) 에서 동적 로드. 클라이언트 전용.
   ================================================================ */
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface OcrProgress {
  status: string;
  progress?: number;
  page?: number;
  total?: number;
  source?: string;
}
export type OnProgress = (p: OcrProgress) => void;

export interface CorporateRegistryResult {
  corpRegFront?: string;
  corpRegBack?: string;
  name?: string;
  address?: string;
  representativeDirector?: string;
  insideDirector?: string;
}
export interface PropertyRegistryResult {
  regNo?: string;
  category?: string;
  area?: string;
  address?: string;
}

function cleanText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/* ---- 동적 스크립트 로더 (public/lib) ---- */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`스크립트 로드 실패: ${src}`));
    document.head.appendChild(s);
  });
}

async function ensurePdfjs(): Promise<any> {
  if (!(window as any).pdfjsLib) await loadScript("/lib/pdfjs/pdf.min.js");
  const lib = (window as any).pdfjsLib;
  if (!lib) throw new Error("pdf.js 로드 실패");
  lib.GlobalWorkerOptions.workerSrc = "/lib/pdfjs/pdf.worker.min.js";
  return lib;
}

async function ensureTesseract(): Promise<any> {
  if (!(window as any).Tesseract) await loadScript("/lib/tesseract/tesseract.min.js");
  const T = (window as any).Tesseract;
  if (!T) throw new Error("tesseract.js 로드 실패");
  return T;
}

class OcrEngine {
  worker: any = null;
  initPromise: Promise<any> | null = null;
  onProgress: OnProgress | null = null;

  async getWorker(): Promise<any> {
    if (this.worker) return this.worker;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      const Tesseract = await ensureTesseract();
      this.onProgress?.({ status: "loading-engine", progress: 0 });
      const w = await Tesseract.createWorker("kor", 1, {
        workerPath: "/lib/tesseract/worker.min.js",
        corePath: "/lib/tesseract/",
        langPath: "/lib/tesseract/",
        gzip: false,
        cacheMethod: "none",
        workerBlobURL: true,
        logger: (m: any) => this.onProgress?.(m),
      });
      this.worker = w;
      return w;
    })();
    return this.initPromise;
  }

  /** PDF → 페이지별 Canvas (OCR 폴백용) */
  async pdfToCanvases(file: File, maxPages = 3): Promise<HTMLCanvasElement[]> {
    const pdfjsLib = await ensurePdfjs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const n = Math.min(pdf.numPages, maxPages);
    const canvases: HTMLCanvasElement[] = [];
    for (let i = 1; i <= n; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      canvases.push(canvas);
    }
    return canvases;
  }

  /** PDF 임베디드 텍스트 직접 추출 (정확도 100%) */
  async pdfToEmbeddedText(file: File, maxPages = 5): Promise<string> {
    const pdfjsLib = await ensurePdfjs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const n = Math.min(pdf.numPages, maxPages);
    let fullText = "";
    for (let i = 1; i <= n; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = content.items;
      if (!items.length) continue;
      const lines: string[] = [];
      let currentY: number | null = null;
      let currentLine: string[] = [];
      for (const it of items) {
        const y = Math.round(it.transform[5]);
        if (currentY === null || Math.abs(y - currentY) < 3) {
          currentLine.push(it.str);
          currentY = y;
        } else {
          lines.push(currentLine.join(""));
          currentLine = [it.str];
          currentY = y;
        }
      }
      if (currentLine.length) lines.push(currentLine.join(""));
      fullText += lines.join("\n") + "\n";
    }
    return fullText;
  }

  async pdfToOcrText(file: File, onProgress?: OnProgress): Promise<string> {
    this.onProgress = onProgress ?? null;
    onProgress?.({ status: "pdf-converting", progress: 0 });
    const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((_, rej) =>
          setTimeout(() => rej(new Error(`타임아웃: ${label} (${ms / 1000}초 초과)`)), ms)
        ),
      ]);
    const canvases = await withTimeout(this.pdfToCanvases(file), 30000, "PDF → 이미지 변환");
    const worker = await withTimeout(this.getWorker(), 90000, "OCR 엔진 초기화");
    let fullText = "";
    for (let i = 0; i < canvases.length; i++) {
      onProgress?.({ status: "recognizing", page: i + 1, total: canvases.length });
      const res = await withTimeout<any>(
        worker.recognize(canvases[i]),
        60000,
        `${i + 1}페이지 OCR`
      );
      fullText += res.data.text + "\n";
    }
    onProgress?.({ status: "done" });
    return fullText;
  }

  /** 메인: 임베디드 텍스트 우선, 없으면 OCR */
  async recognizePDF(
    file: File,
    onProgress?: OnProgress
  ): Promise<{ text: string; source: "embedded" | "ocr" }> {
    this.onProgress = onProgress ?? null;
    onProgress?.({ status: "text-extracting" });
    let text = "";
    try {
      text = await this.pdfToEmbeddedText(file);
    } catch (e) {
      console.warn("PDF 텍스트 추출 실패, OCR 폴백:", e);
    }
    const meaningfulChars = text.replace(/[\s\n.\-_~]/g, "").length;
    if (meaningfulChars >= 100) {
      onProgress?.({ status: "done", source: "embedded" });
      return { text, source: "embedded" };
    }
    onProgress?.({ status: "ocr-fallback" });
    const ocrText = await this.pdfToOcrText(file, onProgress);
    return { text: ocrText, source: "ocr" };
  }

  /* ============= 법인등기부등본 파싱 ============= */
  parseCorporateRegistry(text: string): CorporateRegistryResult {
    const out: CorporateRegistryResult = {};
    const regBlock = text.match(/등\s*록\s*번\s*호[\s:：]*([\dOoIl\s\-‐–—−~]{13,25})/);
    if (regBlock) {
      const normalized = regBlock[1]
        .replace(/[Oo]/g, "0")
        .replace(/[Il]/g, "1")
        .replace(/[‐–—−~]/g, "-")
        .replace(/\s+/g, "");
      const inner = normalized.match(/(\d{6})-?(\d{7})/);
      if (inner) {
        out.corpRegFront = inner[1];
        out.corpRegBack = inner[2];
      }
    }
    const nameMatch = text.match(
      /(?:상\s*호|회\s*사\s*명|명\s*칭)[\s:：]*([^\n(]+?)(?=[(\n]|\s{3,}|\.\s*\.)/
    );
    if (nameMatch) {
      let name = nameMatch[1].trim();
      name = name.replace(/[\s.,_~\-]+$/, "");
      name = name.replace(/^[\s_]+/, "");
      if (name.length >= 2) out.name = cleanText(name);
    }
    const addrMatch = text.match(
      /(?:본\s*점(?:\s*소재지)?|주\s*사\s*무\s*소)\s*([\s\S]+?)(?=\n\s*(?:공고\s*방법|1\s*주\s*의|발\s*행\s*할|발\s*행\s*주식|회사\s*성립|목\s*적|임원\s*에\s*관|이\s*사\s*의|등기기록))/
    );
    if (addrMatch) {
      let addr = addrMatch[1];
      const cleaned = addr
        .split("\n")
        .map((line) => line.replace(/\s*\.\s*\.\s*\.?\s*$/, "").trim())
        .filter((l) => l && !/^[.\s_]+$/.test(l));
      addr = cleaned.join("");
      if (addr.length >= 5) out.address = cleanText(addr);
    }
    const repMatch = text.match(
      /(?:^|\s)(?:공동|각자)?\s*대\s*표\s*이?\s*사\s+([가-힣]{2,5})(?=\s+\d|\s*\n|\s*$)/
    );
    if (repMatch) out.representativeDirector = repMatch[1].trim();
    const inMatch = text.match(/(?:^|\s)사\s*내\s*이?\s*사\s+([가-힣]{2,5})(?=\s+\d|\s*\n|\s*$)/);
    if (inMatch) out.insideDirector = inMatch[1].trim();
    return out;
  }

  /* ============= 부동산등기부등본 파싱 ============= */
  parsePropertyRegistry(text: string): PropertyRegistryResult {
    const out: PropertyRegistryResult = {};
    const m1 = text.match(/고\s*유\s*번\s*호[\s:：]*\s*(\d{4})\s*[-‐]\s*(\d{4})\s*[-‐]\s*(\d{6})/);
    if (m1) out.regNo = `${m1[1]}-${m1[2]}-${m1[3]}`;
    const m2 = text.match(
      /지\s*목[\s:：]*\s*(대|전|답|임야|공장용지|학교용지|도로|하천|제방|구거|유지|수도용지|체육용지|창고용지|주차장|주유소용지|잡종지|과수원|목장용지|광천지|염전|종교용지|사적지|묘지|유원지|철도용지|운수용지)/
    );
    if (m2) out.category = m2[1].trim();
    const m3 = text.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:㎡|m²|m2|평방미터)/);
    if (m3) out.area = m3[1];
    const m4 = text.match(
      /((?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[\s가-힣0-9\-]{5,})/
    );
    if (m4) out.address = cleanText(m4[1]);
    return out;
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch {
        /* noop */
      }
      this.worker = null;
      this.initPromise = null;
    }
  }
}

export const OCR = new OcrEngine();
