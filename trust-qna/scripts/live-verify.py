# -*- coding: utf-8 -*-
import urllib.request, json, base64, io

URL = "https://trust-olive.vercel.app/api/advisor"
QS = [
    "분양관리신탁 업무규정상 신탁사의 의무와 분양대금 관리 방법을 설명해줘",
    "신탁계정대란 무엇이고 어떤 경우에 투입되나요?",
    "재산세·종합부동산세·취득세 신탁 관련 과세 기준을 알려줘",
]
LEAK = ["동부건설", "DL건설", "한국투자부동산신탁", "평동 지식산업센터", "여주 홍문", "남천동"]
out = io.StringIO()
for q in QS:
    body = json.dumps({"messages": [{"role": "user", "content": q}]}).encode("utf-8")
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req, timeout=90)
    src = resp.headers.get("X-Advisor-Sources", "")
    sources = json.loads(base64.b64decode(src).decode("utf-8")) if src else []
    text = resp.read().decode("utf-8")
    leaks = [k for k in LEAK if k in text]
    out.write(f"### Q: {q}\n")
    out.write(f"- retrieved: {resp.headers.get('X-Debug-Retrieved')} / topScore: {resp.headers.get('X-Debug-TopScore')}\n")
    out.write(f"- sources({len(sources)}): " + " | ".join(f"[{s['kind']}]{s['topic'][:40]}" for s in sources) + "\n")
    out.write(f"- 특정사명 노출: {leaks if leaks else 'NONE'}\n")
    out.write(f"- 본문길이: {len(text)} / 앞부분: {text[:120]}\n\n")
open("D:/Claude_Cowork/trust/trust-qna/scripts/_live-result.md", "w", encoding="utf-8").write(out.getvalue())
print("done")
