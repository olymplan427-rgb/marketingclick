# GAS → Cloudflare Workers 이전

`../gas/*.gs` 3개를 그대로 대체하는 워커 3개. 기존 GAS 파일과 사이트 코드는 전혀 건드리지 않았고,
클라이언트(`js/common.js`, `js/mapsearch.js`, `js/news.js`)도 수정 불필요 — GAS 웹앱 URL/토큰이
있던 자리에 이 워커들의 URL/토큰만 바꿔 넣으면 그대로 동작한다(요청 형식이 동일함).

```
blog-tracker/       # 로그인·블로그 저장/조회·사용량 제한·Claude/Gemini/OpenAI 프록시 (Sheets API 필요)
mapsearch-tracker/  # 카카오맵 블로그 리뷰 조회 (Sheets 불필요)
news-tracker/       # 네이버 뉴스 검색 (Sheets 불필요)
```

## 1. Google 서비스 계정 준비 (blog-tracker만 필요)

GAS는 같은 구글 계정으로 실행되어 시트에 자동으로 접근했지만, Workers는 별도 인증이 필요하다.

1. https://console.cloud.google.com → 프로젝트 생성(또는 기존 프로젝트 사용)
2. **API 및 서비스 → 라이브러리** → "Google Sheets API" 검색 후 활성화
3. **API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → 서비스 계정** 생성
4. 생성된 서비스 계정 → **키 → 키 추가 → JSON** → 다운로드 (이 JSON 안에 `client_email`, `private_key`가 있음)
5. 대상 구글 시트를 열어서 **공유** → 방금 만든 서비스 계정의 이메일(`client_email` 값)을 **편집자**로 추가
   (이 단계를 빼먹으면 워커가 403 오류를 낸다)
6. 시트 URL의 `/d/`와 `/edit` 사이 문자열이 `SHEET_ID`
7. **`feedback` 탭이 아직 없다면 직접 추가** — GAS의 `setupFeedbackSheet()`처럼 자동으로 만들어주는
   기능이 Workers 쪽엔 없음. 시트 하단에서 `+`로 새 탭을 만들고 이름을 정확히 `feedback`으로,
   1행에 아래 순서 그대로 헤더를 입력:
   `글ID | 스레드ID | 날짜 | 작성자ID | 작성자이름 | 작성자역할 | 소유자ID | 소유자이름 | 소유자학원 | 내용`
   (이미 GAS로 한 번이라도 `setupFeedbackSheet()`를 실행해서 시트가 만들어져 있다면 이 단계는 건너뛰어도 됨 — 같은 시트를 그대로 씀)

## 2. Cloudflare 준비

```bash
npm install -g wrangler
wrangler login
```

무료 플랜(Workers Free)으로 충분 — 하루 100,000 요청까지 무료, 이 서비스 규모에는 넉넉함.

## 3. 각 워커 배포

### blog-tracker

```bash
cd cloudflare-migration/blog-tracker
npm install
wrangler secret put SHARED_TOKEN            # 기존 GAS_TOKEN과 같은 값으로 (또는 새 값)
wrangler secret put SHEET_ID                # 위 1-6번 값
wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL   # JSON의 client_email
wrangler secret put GOOGLE_PRIVATE_KEY      # JSON의 private_key (줄바꿈 포함 그대로 붙여넣기)
wrangler deploy
```

`GOOGLE_PRIVATE_KEY`를 붙여넣을 때 터미널에서 여러 줄 입력이 막히면, 파일에 값을 저장해두고
`wrangler secret put GOOGLE_PRIVATE_KEY < key.txt` 처럼 파이프로 넣는 게 안전하다. (`key.txt`는
등록 후 바로 삭제할 것 — 커밋하지 말 것.)

### mapsearch-tracker

```bash
cd cloudflare-migration/mapsearch-tracker
npm install
wrangler secret put SHARED_TOKEN            # 기존 MAPSEARCH_GAS_TOKEN과 같은 값으로
wrangler deploy
```

### news-tracker

```bash
cd cloudflare-migration/news-tracker
npm install
wrangler secret put SHARED_TOKEN            # 기존 NEWS_GAS_TOKEN과 같은 값으로
wrangler secret put NAVER_CLIENT_ID
wrangler secret put NAVER_CLIENT_SECRET
wrangler deploy
```

배포가 끝나면 각각 `https://mtt-blog-tracker.<your-subdomain>.workers.dev` 형태의 URL이 출력된다.

## 4. GitHub Actions Secrets 교체

회사 저장소(`olymplan427-rgb/marketingtool`) → Settings → Secrets and variables → Actions:

| 기존 값(GAS) | 새 값 |
|---|---|
| `GAS_URL` | blog-tracker 배포 URL |
| `GAS_TOKEN` | blog-tracker의 `SHARED_TOKEN` |
| `MAPSEARCH_GAS_URL` | mapsearch-tracker 배포 URL |
| `MAPSEARCH_GAS_TOKEN` | mapsearch-tracker의 `SHARED_TOKEN` |
| `NEWS_GAS_URL` | news-tracker 배포 URL |
| `NEWS_GAS_TOKEN` | news-tracker의 `SHARED_TOKEN` |

바꾼 뒤 Actions에서 워크플로우를 재실행(또는 아무 커밋이나 push)하면 새 `config.js`가 생성되어
사이트가 워커를 바라보게 된다. `KAKAO_KEY`, `BETA_DISABLED_FEATURES`는 그대로 유지.

## 5. 확인할 것

- 로그인, 블로그 작성/저장/히스토리, 오늘 작성 횟수(사용량 제한) 정상 동작
- 지도검색 "블로그 취합" 정상 동작
- 뉴스 소재 추천 정상 동작
- config 시트의 AI 키/모델 변경이 그대로 반영되는지 (시트 값을 읽는 방식은 동일)
- 피드백/문의 게시판(작성/답변, 본인+관리자만 조회) 정상 동작
- 문제 없으면 기존 3개 Apps Script 웹앱은 "배포 중지"만 해두고 완전 삭제는 며칠 지켜본 뒤에

## 6. 이후 코드 수정 시 자동 배포 (GAS와의 가장 큰 차이점)

GAS는 코드를 고칠 때마다 Apps Script 편집기에 전체를 복붙하고 수동으로 재배포해야 했지만,
Workers는 `.github/workflows/deploy-workers.yml`(아래에서 만듦)을 한 번만 설정해두면 이 폴더
안의 파일을 고쳐서 `main`에 push하는 것만으로 자동 배포된다.

1. Cloudflare 대시보드 → 오른쪽 위 프로필 → **My Profile → API Tokens → Create Token** →
   "Edit Cloudflare Workers" 템플릿 선택 → 생성된 토큰 값 복사
2. 대시보드 우측 하단(또는 아무 워커 페이지)에서 **Account ID** 확인
3. 회사 저장소 Settings → Secrets → Actions에 추가:
   - `CLOUDFLARE_API_TOKEN` (1번 값)
   - `CLOUDFLARE_ACCOUNT_ID` (2번 값)
4. 저장소에 `.github/workflows/deploy-workers.yml` 워크플로우를 추가(아래 예시) — `cloudflare-migration/**`
   경로가 바뀐 채로 `main`에 push될 때만 3개 워커를 각각 `wrangler deploy`

```yaml
name: Deploy Cloudflare Workers
on:
  push:
    branches: [main]
    paths: ['cloudflare-migration/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        worker: [blog-tracker, mapsearch-tracker, news-tracker]
    steps:
      - uses: actions/checkout@v4
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: cloudflare-migration/${{ matrix.worker }}
          command: deploy
```

이후로는 이 폴더의 코드를 고치고 커밋 → push만 하면 되고, `wrangler secret put`으로 등록한 값들은
그대로 유지된다(재배포해도 secret이 지워지지 않음) — 코드가 바뀔 때만 다시 등록하면 되는 건
`SHEET_ID`/`SHARED_TOKEN` 같은 값이 바뀌는 경우뿐.

## 알아둘 차이점

- **날짜 저장 방식**: GAS는 문자열을 시트에 넣으면 가끔 자동으로 날짜형으로 바뀌는 버그가 있어서
  `_rowDateKST`가 이를 우회했다. 이 워커는 `valueInputOption=RAW`로 항상 원문 그대로 저장해 그 문제를
  원천적으로 피한다. 기존에 이미 쌓인 행(GAS가 쓴 것)은 그대로 남아있으니 형식이 섞여도 조회 시
  앞 10자만 사용하는 방식(`rowDateKST`)으로 동일하게 처리한다.
- **동시 요청 제한 없음**: GAS의 "약 20% 확률로 HTML 에러 페이지 반환" 문제가 Cloudflare Workers에는
  없다. `js/common.js`의 `_fetchGasJson()` 재시도 로직은 그대로 둬도 무해하지만, 완전히 안정화되면
  제거를 고려해도 된다(지금은 안 건드림).
- **CORS**: GAS와 달리 Workers는 OPTIONS(preflight)를 정상 처리한다. 클라이언트가 여전히
  `Content-Type: text/plain`으로 보내는 것도 문제없이 파싱한다 — 변경 불필요.
