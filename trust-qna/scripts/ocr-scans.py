# -*- coding: utf-8 -*-
"""
스캔본(이미지) PDF OCR 추출 — fitz 렌더 → tesseract(kor+eng).
가치 높은 교육/매뉴얼만 INCLUDE(양식·딜특정·개인정보 PDF 제외).
결과를 references/_extracted/<평탄화>.ocr.md 로 저장(자동 인제스트).
실행: python scripts/ocr-scans.py [--test]
"""
import os, sys, subprocess
import fitz  # PyMuPDF

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "references")
OUT = os.path.join(SRC, "_extracted")
TESS = r"C:\Users\minja\scoop\shims\tesseract.exe"

# OCR 대상(파일명 일부 매칭) — 가치 높은 교육/매뉴얼만
INCLUDE = [
    "NPL OJT 교육자료",
    "민사소송 및 보전처분 업무매뉴얼",
    "KB신탁_신규사업 검토 교육자료",
    "토지신탁(차입형,관리형)",
    "분양업무 매뉴얼북 2020(미드미네트웍스)",
]
PAGE_CAP = 80   # 파일당 최대 페이지(폭주 방지)
DPI = 300

def ocr_page(page):
    pix = page.get_pixmap(dpi=DPI)
    png = pix.tobytes("png")  # 임시파일 없이 stdin 파이프(Windows 핸들 충돌 회피)
    r = subprocess.run([TESS, "stdin", "stdout", "-l", "kor+eng", "--psm", "3"],
                       input=png, capture_output=True)
    return r.stdout.decode("utf-8", errors="replace")

def find_targets():
    out = []
    for dirpath, dirs, files in os.walk(SRC):
        if os.path.abspath(dirpath).startswith(os.path.abspath(OUT)):
            continue
        for fn in sorted(files):
            if not fn.lower().endswith(".pdf"):
                continue
            rel = os.path.relpath(os.path.join(dirpath, fn), SRC)
            if any(inc in rel for inc in INCLUDE):
                out.append((os.path.join(dirpath, fn), rel, fn))
    return out

def main():
    test = "--test" in sys.argv
    os.makedirs(OUT, exist_ok=True)
    targets = find_targets()
    print(f"OCR 대상 {len(targets)}건")
    for src, rel, fn in targets:
        doc = fitz.open(src)
        n = min(len(doc), PAGE_CAP)
        if test:
            n = min(n, 2)
        parts = []
        for i in range(n):
            t = ocr_page(doc[i]).strip()
            if t:
                parts.append(f"\n--- p.{i+1} ---\n{t}")
            if (i + 1) % 10 == 0:
                print(f"  [{fn}] {i+1}/{n}p ...", flush=True)
        if len(doc) > PAGE_CAP:
            parts.append(f"\n[... {len(doc)-PAGE_CAP}p 생략(총 {len(doc)}p) ...]")
        doc.close()
        text = "".join(parts).strip()
        if len(text) < 50:
            print(f"  FAIL(빈본문): {rel}")
            continue
        safe = rel.replace("\\", "__").replace("/", "__")
        out_path = os.path.join(OUT, safe) + (".test" if test else "") + ".ocr.md"
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(f"# {fn} (OCR)\n\n{text}")
        print(f"  OK: {rel} -> {len(text):,}자 ({n}p){' [TEST]' if test else ''}", flush=True)

if __name__ == "__main__":
    main()
