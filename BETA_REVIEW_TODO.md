# 베타 출시 전 코드 점검 결과 & 수정 지시서

> 작성일: 2026-08-25
> 목적: 베타 테스트 오픈 전, 코드 리뷰에서 발견된 이슈를 우선순위별로 정리. 각 항목은 그대로 복사해서 Claude Code 등 코딩 에이전트에게 "이 항목을 고쳐줘"라고 지시할 수 있도록 작성함.
> 범위: 프론트엔드(`js/`, `pages/`, `index.html`), 백엔드(`vercel-ai-relay/`, `vercel-schoolinfo-proxy/`, `cloudflare-migration/*`)

## 총평

정적 프론트엔드 + 서버리스 릴레이 구조 자체는 합리적이고, GAS → Cloudflare Workers 이관도 대체로 잘 마무리됨. 다만 **"로그인 게이트"와 "기능 플래그"가 실제 보안 경계가 아니라 UI상의 눈속임에 가깝고**, **AI 호출 비용에 대한 서버단 쿼터 체크가 빠져 있는 것**이 가장 심각한 문제. 사내 베타 규모에서는 당장 크게 터지지 않겠지만, URL 유출이나 devtools 조작 한 번으로 바로 드러나는 구멍들이라 출시 전 정리 권장.

---

## 🔴 Blocker — 베타 전 반드시 수정

### [B-1] AI 생성 호출 자체에 하루 쿼터 체크가 없음

- **위치**: `cloudflare-migration/blog-tracker/src/index.js` (`claudeProxy`, `geminiProxy` 액션 핸들러)
- **문제**: 하루 작성 횟수 제한이 `savePost`에서만 검사됨. 실제 과금이 발생하는 `claudeProxy`/`geminiProxy`는 `verifyUser`만 거치고 쿼터 체크가 없음.
- **위험 시나리오**: 로그인한 사용자가 "저장" 버튼을 누르지 않고 생성만 반복하면, 하루 횟수 제한과 무관하게 무제한으로 Claude/Gemini/OpenAI API를 호출해 비용이 그대로 청구됨.
- **수정 지시**:
  1. `blog-tracker/src/index.js`에서 `savePost`가 쓰는 `countTodayPosts`/`getDailyLimitFor` 로직을 공용 함수로 추출.
  2. `claudeProxy`, `geminiProxy` (그리고 존재한다면 OpenAI 프록시 액션) 핸들러 진입 시점에 동일한 쿼터 체크를 추가하고, 한도 초과 시 AI 호출 전에 에러를 반환.
  3. 클라이언트(`js/blog.js`)가 이 에러를 받아 사용자에게 "오늘 작성 가능 횟수를 초과했습니다"로 표시하는지 확인.
- **완료 조건**: 하루 한도를 채운 계정으로 `claudeProxyCall`/`geminiProxyCall`을 호출하면 저장 여부와 무관하게 서버가 즉시 거부한다.

### [B-2] `savePost`가 인증 없이도 시트에 쓰기 가능

- **위치**: `cloudflare-migration/blog-tracker/src/index.js` (기본 라우팅에서 `AUTHED_ACTIONS`에 없는 액션이 `savePost`로 falls through하는 부분), `js/common.js:484` (게스트가 `userId: ''`로 전송)
- **문제**: `userId`가 빈 값이면 `savePost`가 사용자 검증 없이 구글시트에 행을 추가함.
- **위험 시나리오**: 누구나 `userId`를 빈 문자열로 보내는 요청을 반복하면 인증 없이 시트에 무제한으로 데이터를 쓸 수 있음 (스팸/데이터 오염).
- **수정 지시**: `savePost` 핸들러 최상단에서 `userId`/`userPw`가 없으면 즉시 401을 반환하도록 변경 (게스트 저장을 허용할 정책적 이유가 없다면). 게스트 저장이 의도된 기능이라면, 최소한 IP 기반 또는 별도 익명 레이트리밋을 추가.
- **완료 조건**: `userId`를 비운 요청으로 `savePost`를 호출하면 거부된다.

### [B-3] `mapsearch-tracker`/`news-tracker`가 공개된 공용 토큰만으로 "인증"됨 + SSRF

- **위치**:
  - `cloudflare-migration/mapsearch-tracker/src/index.js`, `cloudflare-migration/news-tracker/src/index.js` — `SHARED_TOKEN`/`KAKAO_KEY` 체크만 존재, 실사용자 인증(`verifyUser`) 없음.
  - 해당 토큰은 배포 시 `config.js`에 평문으로 삽입되어 GitHub Pages에 공개됨 (`.github/workflows/deploy.yml`).
  - `cloudflare-migration/blog-tracker/src/index.js`의 `fetchNaverBlog`/`normalizeNaverMobileUrl` — naver.com 패턴이 아닌 URL은 검증 없이 그대로 서버에서 fetch (SSRF).
- **문제**: "공용 토큰"은 페이지 소스만 봐도 꺼낼 수 있어 사실상 접근 제어가 아님. 여기에 SSRF까지 겹쳐 있어, 외부에서 이 토큰으로 워커를 직접 호출해 회사 Naver/Kakao API 쿼터를 소진시키거나, 워커를 통해 임의 URL로 요청을 보내는 프록시로 악용 가능.
- **수정 지시**:
  1. `normalizeNaverMobileUrl`이 반환한 호스트가 `blog.naver.com`/`m.blog.naver.com`이 아니면 fetch를 거부하도록 화이트리스트 검증 추가.
  2. `mapsearch-tracker`/`news-tracker`에도 `blog-tracker`의 `verifyUser` 패턴을 적용해 실제 로그인 사용자 기준 인증으로 전환 (최소한 사용자별/IP별 레이트리밋이라도 추가).
  3. 장기적으로는 `SHARED_TOKEN`류를 "공개돼도 되는 값"으로 재정의하거나, 클라이언트에 노출하지 않는 구조로 재설계.
- **완료 조건**: 토큰만 알고 로그인 정보가 없는 요청은 거부되며, naver.com이 아닌 URL로 `fetchNaverBlog`를 호출하면 거부된다.

### [B-4] schoolshare "베타 숨김" 기능 플래그가 실제로는 아무것도 숨기지 않음

- **위치**: `js/common.js`의 `applyFeatureFlags()` (사이드바 nav item만 `display:none`), `js/schoolshare.js` (`DOMContentLoaded`에서 `ssInit()` 무조건 실행), `index.html` (`pages/schoolshare.html`, `js/schoolshare.js`를 무조건 로드)
- **문제**: `FEATURE_FLAGS.schoolshare = false`로 설정해도 메뉴만 안 보일 뿐, `showPage('schoolshare')`를 콘솔에서 직접 호출하면 그대로 동작하고, `ssInit()`은 페이지 로드 시 플래그와 무관하게 실제 네트워크 호출을 이미 발생시킴.
- **위험 시나리오**: 베타에서 아직 검증 안 된 기능을 "숨겼다"고 생각했지만 실제로는 누구나 콘솔 한 줄로 접근 가능하고, 안 쓰는 사용자도 이미 매 페이지 로드마다 해당 API를 호출해 쿼터를 소모함.
- **수정 지시**:
  1. `applyFeatureFlags()`에서 플래그가 꺼진 기능은 해당 `pages/*.html`을 애초에 DOM에 삽입하지 않도록 `index.html`의 로딩 로직을 조건부로 변경 (또는 최소한 `showPage()`/`ssInit()` 진입 시점에 플래그 체크를 추가해 꺼져 있으면 즉시 return).
  2. `ssInit()`이 `DOMContentLoaded`에서 무조건 실행되지 않고, 플래그가 켜져 있을 때만 실행되도록 수정.
- **완료 조건**: `FEATURE_FLAGS.schoolshare = false`일 때 `showPage('schoolshare')`를 강제 호출해도 화면이 뜨지 않고, 페이지 로드 시 schoolshare 관련 네트워크 요청이 전혀 발생하지 않는다.

### [B-5] 로그인 게이트가 CSS 오버레이일 뿐, 데이터는 이미 다 로드됨

- **위치**: `js/common.js`의 `initLoginGate` / 로그인 오버레이, `js/monitor.js` (경쟁학원 실명·네이버 카페 게시글 텍스트가 정적으로 하드코딩됨)
- **문제**: 로그인 전에도 모든 스크립트와 데이터가 이미 DOM/JS에 로드되어 있고, 화면만 오버레이로 가려짐. view-source나 devtools로 로그인 없이 열람 가능.
- **위험 시나리오**: 페이지 URL이 (의도치 않게) 외부에 알려지면 로그인 없이 경쟁사 실명 데이터 등이 그대로 노출됨.
- **수정 지시**: (선택 1, 근본적) 민감 데이터는 로그인 성공 후 서버에서 fetch하는 구조로 전환. (선택 2, 임시) 최소한 배포 URL이 비공개/추측 불가능하게 유지되는지 확인하고, README/배포 문서에 "이 URL은 외부 공유 금지"를 명시.
- **완료 조건**: 팀 내 합의된 방식(근본 수정 또는 URL 비공개 운영 확인)을 문서화하고 반영.

### [B-6] 비밀번호/토큰이 브라우저에 평문 장기 보관

- **위치**: `js/common.js` (사용자 비밀번호를 `localStorage`에 무기한 저장, 요청마다 평문 재전송), `cloudflare-migration/blog-tracker/src/index.js:78` 부근 (`String(u.password) !== String(password)` 평문 비교), `js/image.js` (GitHub PAT, Instagram 액세스 토큰, OpenAI 키를 `localStorage`에 저장 후 브라우저에서 직접 GitHub API 호출)
- **문제**: 비밀번호가 해싱 없이 저장/비교되고, 레포 쓰기 권한이 있는 GitHub PAT을 포함한 여러 토큰이 브라우저에 장기 보관됨. XSS 한 번이면 전부 탈취 가능 (아래 B-7 참고).
- **수정 지시** (우선순위 순):
  1. (필수, 빠름) B-7의 XSS부터 막아 탈취 경로 자체를 차단.
  2. (권장) 서버(구글시트) 비밀번호를 최소한 해시(bcrypt 등)로 저장하고 비교하도록 `blog-tracker`를 수정. 기존 평문 비밀번호는 최초 로그인 시 마이그레이션.
  3. (중기) GitHub PAT을 이용한 Instagram 업로드용 파일 커밋 로직을 브라우저에서 직접 하지 말고, 서버(Vercel/Workers) 경유로 옮겨 PAT이 클라이언트에 존재하지 않도록 재설계.
- **완료 조건**: 최소한 1번(XSS 차단)은 베타 전 완료. 2, 3번은 로드맵에 티켓으로 등록.

### [B-7] 이스케이프 없는 `innerHTML` 삽입 (XSS)

- **위치**: `js/schoolshare.js` (약 73-74줄 등, `school.name`/`school.address`를 이스케이프 없이 `innerHTML`에 삽입 — 이 파일만 유일하게 `*Esc()` 헬퍼가 없음), `js/image.js` (약 1006줄, 붙여넣기한 명단 텍스트 `b.text`를 이스케이프 없이 삽입)
- **문제**: 외부 API 응답 또는 사용자가 붙여넣은 텍스트가 그대로 HTML로 렌더링됨. B-6의 토큰들이 탈취될 수 있는 실제 경로.
- **수정 지시**: `js/mapsearch.js`의 `msEsc()`, `js/report.js`의 `reportEsc()`처럼 이미 저장소에 존재하는 이스케이프 헬퍼 패턴을 참고해, `js/schoolshare.js`에 동일한 `ssEsc()` 헬퍼를 추가하고 모든 `innerHTML` 삽입 지점에 적용. `js/image.js`의 `b.text` 등 사용자 입력이 들어가는 모든 `innerHTML` 지점도 동일하게 이스케이프 처리.
- **완료 조건**: `school.name`이나 명단 텍스트에 `<script>` 또는 `<img onerror=...>` 같은 문자열을 넣어도 스크립트가 실행되지 않고 문자 그대로 표시된다.

---

## 🟠 Should-fix — 베타 중/직후 수정 권장

### [S-1] 저장 실패가 조용히 무시됨
- **위치**: `js/common.js`의 `gasSavePost` (`mode:'no-cors'` + 빈 `catch(e){}`), `js/blog.js`의 `blogFinalize`
- **문제**: 시트 저장이 실패해도 사용자에게는 성공한 것처럼 보임 → 히스토리에 없는데 "저장됨"으로 인지.
- **수정 지시**: `no-cors` 모드를 사용하지 않고 실제 응답을 확인할 수 있는 방식(CORS 허용 + 응답 상태 체크)으로 변경하거나, 최소한 저장 결과를 별도로 폴링해 확인 후 사용자에게 성공/실패를 정확히 표시.
- **완료 조건**: 저장이 실패하는 상황을 인위적으로 만들었을 때 사용자에게 실패가 표시된다.

### [S-2] 워커에 레이트리밋이 전혀 없음
- **위치**: `cloudflare-migration/news-tracker/src/index.js` (`getEducationNews`가 호출당 네이버 쿼리 15개를 병렬 발사)
- **문제**: 남용 시 회사 Naver/Kakao API 키가 프로바이더에 의해 차단될 위험.
- **수정 지시**: 사용자별/IP별 최소 호출 간격 또는 분당 호출 횟수 제한을 Workers KV 등을 이용해 추가.
- **완료 조건**: 짧은 시간에 반복 호출 시 일정 횟수 이후 요청이 거부된다.

### [S-3] `js/monitor.js`의 일부 `innerHTML` 삽입도 이스케이프 누락
- **위치**: `js/monitor.js` (`ac.name`/`p.text`/`post.text` 등)
- **문제**: 현재는 정적 데이터라 저위험이지만, 데이터 파이프라인이 자동화되면 XSS로 이어질 수 있음.
- **수정 지시**: B-7과 동일한 패턴으로 이스케이프 적용.
- **완료 조건**: B-7과 동일.

---

## 🟡 Minor / 리팩터링 권장 (급하지 않음)

### [M-1] 죽은 코드 정리
- **위치**: `js/blog.js` (썸네일 전용으로 바뀐 뒤 남은 "본문 삽입 이미지" 브랜치)
- **수정 지시**: 사용되지 않는 브랜치/함수를 제거.

### [M-2] 중복 보일러플레이트 통합
- **위치**: `js/common.js`, `js/schoolshare.js`, `js/mapsearch.js`, `js/report.js`, `js/news.js`의 `getUserAuth()+getGasConfig()` 패턴 중복
- **문제**: 과거 `forwardToGas`에서 `userId/userPw/site` 누락 버그가 바로 이 중복 때문에 발생한 전례가 있음.
- **수정 지시**: 공용 `gasCall(action, payload)` 헬퍼로 통합해 인증 파라미터 누락을 구조적으로 방지.

---

## ✅ 잘 되어 있는 부분 (참고용, 수정 불필요)

- `vercel-ai-relay/api/relay.js`, `vercel-schoolinfo-proxy/api/search.js`: API 키는 env로만 관리, 재시도 루프는 모두 bounded, 에러 응답에 스택트레이스 미노출.
- `js/mapsearch.js`: 이 저장소에서 가장 잘 작성된 파일. 이스케이프 일관성, bounded retry, 동시성 제한 큐, 명확한 에러 분기(NO_KEY/NO_MATCH/HTTP/CORS).
- git에 커밋된 시크릿 없음 (`config.js`/`flags.js` gitignore 정상 작동, 각 `wrangler.toml`에도 시크릿 없음).
- 이중 제출 방지(버튼 비활성화), 블로그 생성 재시도 로직(repair→retry) 모두 무한루프 없이 bounded.

---

## 권장 작업 순서

1. B-7 (XSS 이스케이프) — 가장 빠르고 파급력 큼, 다른 블로커의 전제조건.
2. B-4 (schoolshare 플래그 실제 적용) — 베타에 아직 노출하면 안 되는 기능이므로 최우선.
3. B-1, B-2 (쿼터/인증 체크) — 비용/데이터 무결성 직결.
4. B-3 (워커 인증 + SSRF) — 외부 악용 가능성 차단.
5. B-6, B-5 — 구조 변경이 필요해 시간이 걸리므로 베타 기간 중 순차 진행 가능. 단, 이 두 항목이 남아있는 동안은 **배포 URL을 외부에 공유하지 않도록** 팀에 공지.
6. S-1 ~ S-3, M-1 ~ M-2 — 베타 운영하면서 여유 될 때 처리.
