# trust-qna — Pillar 2 상담(Q&A) 데이터

신탁 자동화 SaaS의 **Pillar 2(대체투자 상담 코파일럿)** 의 **지식·레퍼런스 데이터** 폴더.
> ⚠️ 데이터 전용입니다. 상담 **실행 코드**(`/advisor`, `/api/advisor`, `lib/advisor`)는
> 라이브 앱인 [`trust-saas`](../trust-saas)에 있으며 함께 Vercel 배포됩니다.

## 구조
```
trust-qna/
├─ references/   ← ★여기에 질의답변 근거 자료를 업로드하세요 (.md / .txt / *.pdf.md)
└─ README.md
```

## 동작 흐름 (RAG)
```
references/ 업로드  +  back-data 일반지식
        │  (인제스트)
        ▼
trust-saas/scripts/build-backdata-index.mjs
        │  → 큐레이션·청크·대외비 누출 후처리
        ▼
trust-saas/src/lib/advisor/_backdata-index.json  (gitignore, 서버 전용)
        │  (런타임 로드·검색)
        ▼
/api/advisor  →  상담 답변 + "📚 참고한 자료" 근거 표시
```

## 업로드 방법
1. `references/` 폴더에 자료를 넣는다.
   - 텍스트(.md/.txt)는 바로 인제스트됨.
   - PDF/HWP/DOCX는 텍스트 추출본(.md)으로 넣는 것을 권장(원본 그대로면 추출 단계 필요).
2. 인덱스 재생성: `cd ../trust-saas && node scripts/build-backdata-index.mjs`
3. 상담이 즉시 새 자료를 근거로 활용(로컬/서버).

## 주의 (대외비)
- `references/` 내용은 대외비 가능 → **git/배포에서 제외**(`.gitignore`, `.vercelignore`).
- 인제스트가 경로·회사명 등 누출 패턴을 후처리로 제거하지만, 업로드 전 민감정보(고객·딜 특정) 검토 권장.
- 자가고도화 [분석]: `node trust-corp/scripts/run-advisor-improve.ps1` → gap-report로 보강 필요 주제 도출.
