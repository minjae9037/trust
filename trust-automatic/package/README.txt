═══════════════════════════════════════════════════════════════
   한국투자부동산신탁 · 서류 자동화 시스템
   오프라인 패키지 (사내망 사용 가능)
═══════════════════════════════════════════════════════════════


[ 빠른 시작 — 3가지 실행 방법 ]

  ※ 압축 해제 전 1회만: ZIP 파일 우클릭 → 속성 → "차단 해제" 체크 → 확인
     (Windows 의 "Mark of the Web" 으로 .bat 실행이 차단되는 것을 방지)


  ▣ 방법 1 (권장 / 가장 안전): START_PowerShell.bat 더블클릭
     - Windows 기본 PowerShell 사용 (외부 실행파일 없음)
     - 사내 보안 정책 친화적
     - 브라우저 자동으로 http://localhost:8765 접속

  ▣ 방법 2 (대안): START_Python.bat 더블클릭
     - 동봉된 Python (python-portable 폴더) 사용
     - PowerShell 실행 정책이 막힌 경우 시도
     - 단점: python.exe 실행이 EDR/AV 에 의해 차단될 가능성

  ▣ 방법 3 (제한적): index.html 직접 더블클릭
     - 브라우저에서 file:// 로 열기
     - 단점: Chrome/Edge 의 file:// 보안 제한 때문에 OCR 기능이
       동작하지 않을 수 있음
     - 데이터 입력만 사용한다면 가능


[ 폴더 구조 ]

  ./
  ├── index.html                  (본 시스템, 약 84KB)
  ├── START_PowerShell.bat         ★ 방법 1
  ├── START_Python.bat             ★ 방법 2
  ├── server.ps1                  (PowerShell 서버 스크립트)
  ├── README.txt                  (본 파일)
  ├── lib/
  │   ├── pdfjs/                  (PDF 변환 라이브러리)
  │   └── tesseract/              (OCR 엔진 + 한국어 데이터)
  └── python-portable/            (Python 3.12, 약 19MB)

  ※ lib 폴더와 python-portable 폴더는 절대 삭제·이동하지 마십시오.


[ 사내 환경 호환성 확인 ]

  처음 사용 시, 다음 순서로 시도하여 가장 잘 동작하는 방법을 찾으세요:

  1단계: START_PowerShell.bat 더블클릭
         → 검은색 콘솔이 뜨면서 "서버 시작" 메시지 보이고
           브라우저가 http://localhost:8765 로 자동 접속되면 성공.
         → PowerShell 실행 정책 오류가 나면 2단계로.

  2단계: START_Python.bat 더블클릭
         → 검은색 콘솔이 뜨면서 브라우저가 자동 접속되면 성공.
         → "Windows에서 PC를 보호했습니다" 같은 SmartScreen 차단
           메시지 또는 EDR 차단 알림이 뜨면 3단계로.

  3단계: index.html 직접 더블클릭
         → 화면은 보이지만 PDF 업로드 후 OCR 동작 시 오류 가능.
         → 정보보안팀에 문의하여 사내 웹서버 호스팅 검토.


[ OCR 기능 안내 ]

  ▣ 지원 문서
     - 법인등기부등본 PDF (위탁자/채무자/수익자/우선수익자)
     - 부동산등기부등본 PDF (토지·건물, 복수 업로드 가능)

  ▣ 자동 추출 항목
     [법인등기부등본]
       · 법인명 (상호)
       · 법인등록번호 (XXXXXX-XXXXXXX)
       · 사업자등록번호 (인식되는 경우)
       · 대표이사
       · 본점 소재지

     [부동산등기부등본]
       · 등기 고유번호 (XXXX-XXXX-XXXXXX)
       · 소재지 · 지목 · 면적

  ▣ 정확도 안내
     - 한국어 OCR 정확도: 약 85~92%
     - 인쇄체·가로글자: 정확도 높음
     - 표·세로글자·도장·인감: 정확도 낮음
     - 결과는 반드시 직접 입력 탭에서 검수하세요.

  ▣ 처리 시간
     - 최초 1회: 약 15~25초 (OCR 엔진 로딩)
     - 이후 PDF 1건당: 약 5~15초


[ 트러블슈팅 ]

  Q. START_PowerShell.bat 실행 시 "실행 정책 오류" 발생
     → START_Python.bat 시도

  Q. START_Python.bat 실행 시 SmartScreen 또는 EDR 차단
     → "추가 정보" → "실행" 선택하거나, 정보보안팀 통해
       python.exe 화이트리스트 등록 요청

  Q. 브라우저가 자동으로 안 열림
     → 브라우저(Edge/Chrome) 직접 열고
       http://localhost:8765/ 주소창에 입력

  Q. "포트 8765 이 이미 사용 중" 오류
     → 이전 서버 창이 살아있을 수 있음. 작업 표시줄에서
       PowerShell/Python 콘솔창 모두 닫고 재시도.

  Q. PDF 업로드 후 "OCR 오류" 또는 무한 대기
     → 1) 사용한 실행 방법 확인 (file:// 가 아닌 http://localhost
          으로 접속되어 있는지 주소창 확인)
       2) F12 → Console 탭에서 빨간색 오류 메시지 확인 후 문의

  Q. OCR 인식이 너무 느림
     → 최초 1회는 한국어 데이터 12MB 로딩 + WASM 초기화로 느립니다.
       두 번째 PDF 부터는 빠릅니다. (페이지당 5~15초 소요)


[ 보안 안내 ]

  - 본 시스템의 로컬 서버는 127.0.0.1 (localhost) 에만 바인딩됩니다.
    → 같은 PC 에서만 접근 가능, 사내 네트워크 다른 PC 에서 접근 불가.
  - 외부 인터넷으로 어떠한 데이터도 전송되지 않습니다.
  - 업로드한 PDF, 입력 정보, 생성된 Word 파일은 모두 PC 내에만 저장.
  - 동봉된 python.exe 는 Python Software Foundation 정식 서명 파일.
  - 사용 전 정보보안팀 사전 승인을 권장합니다.


[ 라이선스 ]

  - PDF.js (Mozilla)        : Apache License 2.0
  - Tesseract.js            : Apache License 2.0
  - kor.traineddata         : Apache License 2.0
  - Python 3.12             : PSF License (python-portable/LICENSE.txt)

═══════════════════════════════════════════════════════════════
