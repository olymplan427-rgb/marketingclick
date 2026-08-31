// js/blog.js를 그대로 Node에서 로드한다 — 실제 배포되는 프롬프트 문자열/조립 로직을 한 글자도
// 베끼지 않고 원본 그대로 재사용하기 위함(프롬프트가 바뀌어도 이 파일을 손댈 필요 없음).
//
// blog.js는 브라우저 전역(document/localStorage)에 의존하는 부분이 있지만, 여기서 실제로 쓰는
// 함수들(getBlogDraftSystem, getBlogFinalSystem, applyAcademyVars, blogBuildInputText,
// blogGenerateWithRepair, blogParseJson/blogRepairJson, blogFilterBannedWords, blogStripBold)은
// 전부 순수 로직 + localStorage뿐이라 document는 안전한 더미로만 채워두면 된다.
// blogCall(실제 백엔드 호출)만 로드 후 별도로 로컬 CLI 버전으로 덮어써서, 구글시트/사용량 등
// 운영 데이터를 절대 건드리지 않는다.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeLocalStorage(seed) {
  const store = new Map(Object.entries(seed || {}));
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

function makeDummyElement() {
  const el = {
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {},
    focus() {},
    getAttribute() { return null; },
    setAttribute() {},
    textContent: '',
    innerHTML: '',
    value: '',
    disabled: false,
  };
  return el;
}

// academyProfile: { name, keywords, subject, target, website, phone, map } — applyAcademyVars가 씀
function loadBlogSandbox(academyProfile) {
  const blogJsPath = path.join(__dirname, '..', 'js', 'blog.js');
  const source = fs.readFileSync(blogJsPath, 'utf8');

  // 전화/지도/웹사이트를 비워두면 blog.js의 "비어 있는 항목은 생략" 지시 때문에 연락처
  // 블록이 학원명만 남고 사실상 사라져서, 연락처 블록 검사가 항상 무의미하게 실패한다 —
  // 실제 운영 환경(학원 프로필이 다 채워진 상태)과 최대한 비슷하게 기본값을 채워둔다.
  const profile = Object.assign(
    {
      id: 'p_test', name: '테스트수학학원', keywords: '소수정예, 개념 중심',
      subject: '수학', target: '학부모·학생',
      website: 'www.test-academy.co.kr', phone: '02-000-0000', map: 'naver.me/test',
    },
    academyProfile || {}
  );

  const sandbox = {
    console,
    localStorage: makeLocalStorage({
      mtt_academy_profiles: JSON.stringify([profile]),
      mtt_academy_active_id: profile.id,
    }),
    document: { getElementById: () => makeDummyElement() },
    window: {},
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);

  vm.runInContext(source, context, { filename: 'blog.js' });
  return context; // getBlogDraftSystem, getBlogFinalSystem, blogState, blogGenerateWithRepair 등이 여기 들어있음
}

module.exports = { loadBlogSandbox, makeLocalStorage };
