# -*- coding: utf-8 -*-
import json, os
P = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                 "trust-saas", "src", "lib", "advisor", "_backdata-index.json")
data = json.load(open(P, encoding="utf-8"))
leak_keys = ["동부건설", "DL건설", "Z:\\Drive", "W:\\", "원본:"]
leaks = {k: 0 for k in leak_keys}
for c in data:
    t = c["text"]
    for k in leak_keys:
        if k in t:
            leaks[k] += 1
qna = sum(1 for c in data if c["id"].startswith("qna-"))
bd = sum(1 for c in data if c["id"].startswith("bd-"))
topics = sorted(set(c["topic"] for c in data if c["id"].startswith("qna-")))
print("total:", len(data), "| bd:", bd, "| qna:", qna)
print("leaks:", leaks)
print("qna docs:", len(topics))
for t in topics:
    print("  -", t)
