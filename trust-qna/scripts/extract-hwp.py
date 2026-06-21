# -*- coding: utf-8 -*-
"""
HWP 추출기 — 형식 분기:
  - OLE2(D0CF11E0) = HWP 5.0 → hwp5txt
  - XML(<?xml, BOM 포함) = 한컴 XML(.hwp 확장자) → 태그 제거 텍스트
결과를 references/_extracted/<평탄화>.hwp.md 로 저장(extract-refs 산출물과 동일 위치 → 자동 인제스트).
PDF 추출본이 이미 있는 중복 HWP는 스킵.
실행: python scripts/extract-hwp.py
"""
import os, re, subprocess, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # trust-qna
SRC = os.path.join(BASE, "references")
OUT = os.path.join(SRC, "_extracted")
HWP5TXT = r"C:\Users\minja\scoop\apps\python\current\Scripts\hwp5txt.exe"

# PDF 추출본이 이미 있어 중복인 HWP(파일명 일부 매칭) → 스킵
SKIP = ["건축물 분양 제도 업무 편람", "건축물 분양제도 업무 편람", "주택공급 업무 매뉴얼"]

def sig(path):
    with open(path, "rb") as f:
        head = f.read(8)
    if head[:4] == b"\xd0\xcf\x11\xe0":
        return "ole2"
    if head[:3] == b"\xef\xbb\xbf" or head[:5] == b"<?xml":
        return "xml"
    return "unknown"

def from_ole2(path):
    r = subprocess.run([HWP5TXT, path], capture_output=True)
    if r.returncode != 0:
        return ""
    return r.stdout.decode("utf-8", errors="replace")

def from_xml(path):
    for enc in ("utf-8-sig", "utf-16", "cp949"):
        try:
            raw = open(path, encoding=enc).read()
            break
        except (UnicodeDecodeError, UnicodeError):
            raw = None
    if raw is None:
        raw = open(path, encoding="utf-8", errors="replace").read()
    # 태그 제거 + 엔티티 정리
    txt = re.sub(r"<[^>]+>", " ", raw)
    txt = re.sub(r"&[a-zA-Z]+;|&#\d+;", " ", txt)
    txt = re.sub(r"[ \t]+", " ", txt)
    txt = re.sub(r"\n\s*\n+", "\n", txt)
    return txt.strip()

def main():
    os.makedirs(OUT, exist_ok=True)
    done = skipped = failed = 0
    for dirpath, dirs, files in os.walk(SRC):
        if os.path.abspath(dirpath).startswith(os.path.abspath(OUT)):
            continue
        for fn in sorted(files):
            if not fn.lower().endswith(".hwp"):
                continue
            src = os.path.join(dirpath, fn)
            rel = os.path.relpath(src, SRC)
            if any(s in rel for s in SKIP):
                print(f"SKIP(중복): {rel}")
                skipped += 1
                continue
            kind = sig(src)
            try:
                text = from_ole2(src) if kind == "ole2" else (from_xml(src) if kind == "xml" else "")
            except Exception as e:
                print(f"FAIL {rel}: {type(e).__name__} {e}")
                failed += 1
                continue
            text = (text or "").strip()
            if len(text) < 50:
                print(f"FAIL(빈본문/{kind}): {rel} (len={len(text)})")
                failed += 1
                continue
            safe = rel.replace("\\", "__").replace("/", "__")
            out_path = os.path.join(OUT, safe) + ".md"
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(f"# {fn}\n\n{text}")
            print(f"OK({kind}): {rel} -> {len(text):,}자")
            done += 1
    print(f"\n=== HWP done={done} skip={skipped} fail={failed} ===")

if __name__ == "__main__":
    main()
