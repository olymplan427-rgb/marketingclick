// 홈 페이지 — 공지사항 + 크레딧 요약 + 기능 바로가기 + 최근 작성 글.
// 로그인 직후(hideLoginOverlay) 자동 실행되며, 이전에 있던 "베타 시작 안내" 팝업을 대체한다.

// 공지사항 — 날짜 최신순으로 위에 추가. 관리자가 코드에서 직접 편집(별도 관리 화면 없음).
var HOME_ANNOUNCEMENTS = [
  { date: '2026-09-01', title: '마케팅딸깍 베타를 시작합니다', desc: '원장님의 사용 경험과 피드백을 바탕으로 계속 개선해 나갑니다. 불편한 점이나 아이디어는 사이드바의 "피드백"/"문의하기"로 언제든 남겨주세요.' },
  { date: '2026-09-01', title: '신규 가입 시 500 크레딧 지급', desc: '블로그 작성, 이미지 제작 등 기능별로 크레딧이 소모됩니다. 잔여량과 사용 내역은 사이드바 "크레딧"에서 확인할 수 있어요.' },
  { date: '2026-09-01', title: '일부 기능은 베타 기간 중 순차 공개됩니다', desc: '경쟁학원 모니터링, 학교 점유율 등은 안정화 후 순서대로 열릴 예정입니다.' }
];

function homeEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// { page, title, desc, flag, icon } — flag가 있고 FEATURE_FLAGS[flag]===false면 "준비중"으로 비활성 표시.
var HOME_FEATURE_CARDS = [
  { page: 'blog', flag: null, title: '블로그 작성', desc: '주제와 키워드만 입력하면 완성 글까지 한 번에', icon: '<path d="M4 20l4-1 10-10-3-3L5 16l-1 4z"/><path d="M14 7l3 3"/>' },
  { page: 'blog-news', flag: null, title: '뉴스 소재 추천', desc: '최근 교육 뉴스로 블로그 소재를 찾아드려요', icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>' },
  { page: 'mapsearch', flag: null, title: '주변 학원 검색', desc: '인근 경쟁학원과 블로그 리뷰를 한눈에', icon: '<circle cx="12" cy="10" r="3"/><path d="M12 21s-7-5.686-7-11a7 7 0 0 1 14 0c0 5.314-7 11-7 11z"/>' },
  { page: 'report', flag: null, title: '지역 트렌드 리포트', desc: '우리 지역 수학학원들의 최근 3개월 동향 정리', icon: '<path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M15 3v5h5"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/>' },
  { page: 'list', flag: null, title: '이미지 만들기', desc: '성적우수 이미지를 자동으로 생성', icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.4"/><path d="M21 16l-5-4-4 3-3-2-5 4"/>' },
  { page: 'monitor', flag: 'monitor', title: '경쟁학원 모니터링', desc: '지역 경쟁학원 언급 현황을 추적', icon: '<line x1="5" y1="19" x2="5" y2="11"/><line x1="12" y1="19" x2="12" y2="6"/><line x1="19" y1="19" x2="19" y2="14"/>' },
  { page: 'schoolshare', flag: 'schoolshare', title: '학교 점유율', desc: '인근 학교 대비 우리 학원 재원생 비율 관리', icon: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>' }
];

async function homeInit() {
  var auth = getUserAuth();
  if (!auth) return;
  var greetEl = document.getElementById('home-greeting');
  if (greetEl) greetEl.textContent = (auth.academy || auth.name) + '님, 안녕하세요 👋';

  homeRenderNotices();
  homeRenderFeatures();
  homeRenderCredit();
  homeRenderRecentPosts();
}

function homeRenderNotices() {
  var el = document.getElementById('home-notice-list');
  if (!el) return;
  el.innerHTML = HOME_ANNOUNCEMENTS.map(function(n) {
    return '<div class="home-notice-card">'
      + '<div class="home-notice-date">' + homeEsc(n.date) + '</div>'
      + '<div><div class="home-notice-title">' + homeEsc(n.title) + '</div><div class="home-notice-desc">' + homeEsc(n.desc) + '</div></div>'
    + '</div>';
  }).join('');
}

function homeRenderFeatures() {
  var el = document.getElementById('home-feature-grid');
  if (!el) return;
  var flags = window.FEATURE_FLAGS || {};
  el.innerHTML = HOME_FEATURE_CARDS.map(function(f) {
    var enabled = !f.flag || flags[f.flag] !== false;
    var onclick = enabled ? ' onclick="showPage(\'' + f.page + '\')"' : '';
    return '<div class="home-feature-card' + (enabled ? '' : ' disabled') + '"' + onclick + '>'
      + '<div class="home-feature-icon"><svg viewBox="0 0 24 24">' + f.icon + '</svg></div>'
      + '<div class="home-feature-title">' + homeEsc(f.title) + (enabled ? '' : '<span class="home-feature-badge">준비중</span>') + '</div>'
      + '<div class="home-feature-desc">' + homeEsc(f.desc) + '</div>'
    + '</div>';
  }).join('');
}

async function homeRenderCredit() {
  var numEl = document.getElementById('home-credit-num');
  if (!numEl) return;
  try {
    var status = await getCreditStatus();
    if (!status || status.unlimited) numEl.textContent = '무제한';
    else numEl.textContent = status.remaining;
  } catch (e) {
    numEl.textContent = '-';
  }
}

async function homeRenderRecentPosts() {
  var listEl = document.getElementById('home-recent-list');
  var emptyEl = document.getElementById('home-recent-empty');
  if (!listEl) return;
  try {
    var posts = await gasGetMyPosts(3);
    if (!posts.length) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = '';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    listEl.innerHTML = posts.map(function(p) {
      return '<div class="home-recent-item">'
        + '<div class="home-recent-title">' + homeEsc(p.title || p.topic || '(제목 없음)') + '</div>'
        + '<div class="home-recent-meta">' + homeEsc(p.date) + ' · ' + homeEsc(p.type) + '</div>'
      + '</div>';
    }).join('');
  } catch (e) {
    listEl.innerHTML = '';
    if (emptyEl) { emptyEl.style.display = ''; emptyEl.textContent = '최근 글을 불러오지 못했습니다.'; }
  }
}
