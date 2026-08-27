# MarketingTool

올림피아드교육 내부 마케팅 도구.

- 개발: `https://olymplan427-rgb.github.io/marketingtool/`
- 베타: `https://olymplan427-rgb.github.io/marketingtool/beta/`

## 기능

- **블로그 작성**: 주제·키워드 입력 → AI가 초안부터 완성글까지 생성, 히스토리 조회
- **뉴스 소재 추천**: 최근 교육 뉴스 조회 → 블로그 소재 추천
- **성적우수 이미지 생성**: 합격자 명단 → 인스타그램용 이미지 생성, AI 홍보문구 생성
- **지도검색**: 학원 인근 경쟁학원 검색 + 관련 블로그 게시물 취합
- **경쟁학원 모니터링**: 지역별 경쟁학원 언급 현황
- **인스타그램 자동 게시**

로그인 후 사용하며, 사용할 AI(Claude/Gemini/OpenAI)와 계정별 하루 작성 횟수는 관리자가 구글시트에서 관리한다.

## 구조

```
index.html         # 진입점 (사이드바 + 로그인)
css/main.css        # 스타일
js/                  # 기능별 스크립트 (blog, image, mapsearch, monitor, news, common)
pages/               # 각 화면 HTML
gas/                 # 백엔드(Google Apps Script) — 로그인/블로그저장/지도검색/뉴스검색
```
