// ============================================================
// COMMON UTILITIES
// ============================================================
// ADMIN_GAS 는 config.js 에서 로드됩니다 (GitHub 비공개)

function toggleMobileMenu() {
  var sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

function switchPage(num) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById('page-' + num).classList.add('active');
  document.querySelectorAll('.sidebar-item').forEach(function(n) { n.classList.remove('active'); });
  var nav = document.getElementById('nav-p' + num);
  if (nav) nav.classList.add('active');
  var sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');
  if (num === 2) p2render();
}


function showPage(id) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.sidebar-item').forEach(function(i) { i.classList.remove('active'); });
  // 설정 서브메뉴는 설정 계열이 아닐 때 닫기
  if (id !== 'settings-prompt' && id !== 'settings-instagram') {
    var subnav = document.getElementById('sidebar-subnav-settings');
    if (subnav) subnav.style.display = 'none';
  }
  // 이미지 만들기 서브메뉴는 이미지 계열이 아닐 때 닫기
  if (id !== 'list' && id !== 2 && id !== 'free') {
    var imgSubnav = document.getElementById('sidebar-subnav-image');
    if (imgSubnav) imgSubnav.style.display = 'none';
    document.querySelectorAll('#sidebar-subnav-image .sidebar-subitem').forEach(function(i) { i.classList.remove('active'); });
  }
  if (id === 'list' || id === 2) {
    document.getElementById('page-2').classList.add('active');
    var navGroup = document.getElementById('nav-image-group');
    if (navGroup) navGroup.classList.add('active');
    var imgSubnavOpen = document.getElementById('sidebar-subnav-image');
    if (imgSubnavOpen) imgSubnavOpen.style.display = '';
    document.querySelectorAll('#sidebar-subnav-image .sidebar-subitem').forEach(function(i) { i.classList.remove('active'); });
    var nav = document.getElementById('nav-list');
    if (nav) nav.classList.add('active');
    var lp = document.querySelector('#page-2 .left-panel');
    if (lp) { lp.classList.remove('mode-free'); lp.classList.add('mode-list'); }
    p2State.templateKey = 'list';
    p2render();
  } else if (id === 'free') {
    document.getElementById('page-2').classList.add('active');
    var navGroup = document.getElementById('nav-image-group');
    if (navGroup) navGroup.classList.add('active');
    var imgSubnavOpen = document.getElementById('sidebar-subnav-image');
    if (imgSubnavOpen) imgSubnavOpen.style.display = '';
    document.querySelectorAll('#sidebar-subnav-image .sidebar-subitem').forEach(function(i) { i.classList.remove('active'); });
    var nav = document.getElementById('nav-free');
    if (nav) nav.classList.add('active');
    var lp = document.querySelector('#page-2 .left-panel');
    if (lp) { lp.classList.remove('mode-list'); lp.classList.add('mode-free'); }
    p2State.templateKey = 'free';
    p2render();
  } else if (id === 'blog' || id === 'blog-history' || id === 'blog-news') {
    document.getElementById('page-blog').classList.add('active');
    var navWrite = document.getElementById('nav-blog-write');
    var navHistory = document.getElementById('nav-blog-history');
    var navNews = document.getElementById('nav-blog-news');
    if (navWrite) navWrite.classList.toggle('active', id === 'blog');
    if (navHistory) navHistory.classList.toggle('active', id === 'blog-history');
    if (navNews) navNews.classList.toggle('active', id === 'blog-news');
    var tabWrite = document.getElementById('blogtab-write');
    var tabHistory = document.getElementById('blogtab-history');
    var tabNews = document.getElementById('blogtab-news');
    if (tabWrite) tabWrite.style.display = (id === 'blog') ? '' : 'none';
    if (tabHistory) tabHistory.style.display = (id === 'blog-history') ? '' : 'none';
    if (tabNews) tabNews.style.display = (id === 'blog-news') ? '' : 'none';
    if (id === 'blog') {
      initAcademyProfile();
      blogGoStep(blogState.step || 1);
    } else if (id === 'blog-history') {
      blogHistoryInit();
    }
  } else if (id === 'settings-prompt' || id === 'settings-instagram') {
    document.getElementById('page-settings').classList.add('active');
    var navSettings = document.getElementById('nav-settings');
    if (navSettings) navSettings.classList.add('active');
    var subnav = document.getElementById('sidebar-subnav-settings');
    if (subnav) subnav.style.display = '';
    var sub = id === 'settings-prompt' ? 'prompt' : 'instagram';
    ['prompt','instagram'].forEach(function(t) {
      var ni = document.getElementById('nav-settings-' + t);
      if (ni) ni.classList.toggle('active', t === sub);
      var ti = document.getElementById('settab-' + t);
      if (ti) ti.style.display = (t === sub) ? '' : 'none';
    });
    if (sub === 'prompt') settingsInitPrompt();
    else settingsInitInstagram();
  } else if (id === 'monitor') {
    document.getElementById('page-monitor').classList.add('active');
    var navMon = document.getElementById('nav-monitor');
    if (navMon) navMon.classList.add('active');
    monRenderList();
  } else if (id === 'mapsearch') {
    document.getElementById('page-mapsearch').classList.add('active');
    var navMs = document.getElementById('nav-mapsearch');
    if (navMs) navMs.classList.add('active');
    if (typeof msInit === 'function') msInit();
  } else if (id === 'report') {
    document.getElementById('page-report').classList.add('active');
    var navRp = document.getElementById('nav-report');
    if (navRp) navRp.classList.add('active');
    if (typeof reportInit === 'function') reportInit();
  } else if (id === 'schoolshare') {
    document.getElementById('page-schoolshare').classList.add('active');
    var navSs = document.getElementById('nav-schoolshare');
    if (navSs) navSs.classList.add('active');
  } else if (id === 'credit') {
    document.getElementById('page-credit').classList.add('active');
    var navCr = document.getElementById('nav-credit');
    if (navCr) navCr.classList.add('active');
    if (typeof creditInit === 'function') creditInit();
  } else if (id === 'feedback') {
    document.getElementById('page-feedback').classList.add('active');
    var navFb = document.getElementById('nav-feedback');
    if (navFb) navFb.classList.add('active');
    if (typeof feedbackInit === 'function') feedbackInit();
  } else if (id === 'admin') {
    document.getElementById('page-admin').classList.add('active');
    var navAd = document.getElementById('nav-admin');
    if (navAd) navAd.classList.add('active');
    if (typeof adminInit === 'function') adminInit();
  }
}

function toggleCollapse(contentId, btnId) {
  var el = document.getElementById(contentId);
  var btn = document.getElementById(btnId);
  if (!el) return;
  var open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  if (btn) btn.textContent = btn.textContent.replace(open ? '▴' : '▾', open ? '▾' : '▴');
}

function showToast(msg, duration) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(function() { t.style.display = 'none'; }, duration || 2000);
}

// ── API 키 브리지 ─────────────────────────────────────────────────
// React 앱(5173)의 ai_api_keys 형식과 기존 mtt_* 형식 모두 지원
function getApiKey(type) {
  try {
    var reactKeys = JSON.parse(localStorage.getItem('ai_api_keys') || '{}');
    var reactKey = type === 'claude' ? reactKeys.anthropic : reactKeys[type];
    if (reactKey) return reactKey;
  } catch(e) {}
  var fallback = { claude: 'mtt_claude_key', gemini: 'mtt_gemini_key', openai: 'mtt_openai_key' };
  return localStorage.getItem(fallback[type]) || '';
}

function getKakaoKey() {
  return (typeof ADMIN_KAKAO_KEY !== 'undefined' && ADMIN_KAKAO_KEY) ? ADMIN_KAKAO_KEY : '';
}

// ── 로그인(임시 — 구글시트 기반, 추후 실제 사용자 데이터 연동 예정) ──
// dev/beta가 같은 도메인(olympiadedu.github.io)의 하위 경로라 localStorage가 공유되므로,
// window.SITE_ID(flags.js가 주입 — dev/beta)로 키를 구분해 로그인 상태가 서로 섞이지 않게 함
function _authKey(name) {
  return 'mtt_' + _siteId() + '_' + name;
}
// flags.js가 주입하는 window.SITE_ID('dev'/'beta') — 로컬 등 미설정 시 'local'로 취급
function _siteId() {
  return (typeof window.SITE_ID === 'string' && window.SITE_ID) ? window.SITE_ID : 'local';
}

function getUserAuth() {
  var id = localStorage.getItem(_authKey('user_id')) || '';
  var pw = localStorage.getItem(_authKey('user_pw')) || '';
  if (!id || !pw) return null;
  return { id: id, pw: pw, name: localStorage.getItem(_authKey('user_name')) || id, academy: localStorage.getItem(_authKey('user_academy')) || '', role: localStorage.getItem(_authKey('user_role')) || '' };
}

function clearUserAuth() {
  ['user_id','user_pw','user_name','user_academy','user_role','last_active'].forEach(function(k){ localStorage.removeItem(_authKey(k)); });
}

async function loginSubmit() {
  var idEl = document.getElementById('login-id');
  var pwEl = document.getElementById('login-pw');
  var errEl = document.getElementById('login-error');
  var btn = document.getElementById('login-submit');
  var id = idEl ? idEl.value.trim() : '';
  var pw = pwEl ? pwEl.value : '';
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  if (!id || !pw) { if (errEl) { errEl.textContent = '아이디와 비밀번호를 입력하세요.'; errEl.style.display = 'block'; } return; }
  var cfg = getGasConfig();
  if (!cfg.url || !cfg.token) { if (errEl) { errEl.textContent = '서버 설정 오류(GAS 미설정)'; errEl.style.display = 'block'; } return; }
  if (btn) { btn.disabled = true; btn.textContent = '확인 중...'; }
  try {
    var json = await _fetchGasJson(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // GAS는 OPTIONS(preflight)를 못 받으므로 simple-request로 보냄
      body: JSON.stringify({ action: 'login', token: cfg.token, userId: id, userPw: pw, site: _siteId() })
    });
    if (!json.ok) { if (errEl) { errEl.textContent = json.error || '로그인 실패'; errEl.style.display = 'block'; } return; }
    localStorage.setItem(_authKey('user_id'), id);
    localStorage.setItem(_authKey('user_pw'), pw);
    localStorage.setItem(_authKey('user_name'), json.name || id);
    localStorage.setItem(_authKey('user_academy'), json.academy || '');
    localStorage.setItem(_authKey('user_role'), json.role || '');
    localStorage.setItem(_authKey('last_active'), String(Date.now()));
    hideLoginOverlay();
  } catch(e) {
    if (errEl) { errEl.textContent = '연결 오류: ' + e.message; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '로그인'; }
  }
}

var _loginOverlayMode = 'login';

function setLoginOverlayMode(mode) {
  _loginOverlayMode = mode;
  var isRegister = mode === 'register';
  var titleEl = document.getElementById('login-title');
  var subEl = document.getElementById('login-subtitle');
  var fieldsEl = document.getElementById('login-register-fields');
  var pwConfirmFieldEl = document.getElementById('login-reg-pw-confirm-field');
  var btnEl = document.getElementById('login-submit');
  var toReg = document.getElementById('login-toggle-to-register');
  var toLogin = document.getElementById('login-toggle-to-login');
  var errEl = document.getElementById('login-error');
  if (titleEl) titleEl.textContent = isRegister ? '마케팅딸깍 회원가입' : '마케팅딸깍 로그인';
  if (subEl) subEl.textContent = isRegister ? '원하는 아이디/비밀번호를 만들어주세요' : '클릭 한 번으로 학원 마케팅을 준비하세요';
  if (fieldsEl) fieldsEl.style.display = isRegister ? 'flex' : 'none';
  if (pwConfirmFieldEl) pwConfirmFieldEl.style.display = isRegister ? 'flex' : 'none';
  var rememberRow = document.getElementById('login-remember-row');
  if (rememberRow) rememberRow.style.display = isRegister ? 'none' : 'flex';
  if (btnEl) btnEl.textContent = isRegister ? '가입하고 시작하기' : '로그인';
  if (toReg) toReg.style.display = isRegister ? 'none' : 'block';
  if (toLogin) toLogin.style.display = isRegister ? 'block' : 'none';
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
}

function loginOverlaySubmit() {
  if (_loginOverlayMode === 'register') return registerSubmit();
  return loginSubmit();
}

async function registerSubmit() {
  var idEl = document.getElementById('login-id');
  var pwEl = document.getElementById('login-pw');
  var pwConfirmEl = document.getElementById('login-reg-pw-confirm');
  var nameEl = document.getElementById('login-reg-name');
  var academyEl = document.getElementById('login-reg-academy');
  var errEl = document.getElementById('login-error');
  var btn = document.getElementById('login-submit');
  var id = idEl ? idEl.value.trim() : '';
  var pw = pwEl ? pwEl.value : '';
  var pwConfirm = pwConfirmEl ? pwConfirmEl.value : '';
  var name = nameEl ? nameEl.value.trim() : '';
  var academy = academyEl ? academyEl.value.trim() : '';
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  if (!id || !pw || !pwConfirm || !name || !academy) { if (errEl) { errEl.textContent = '모든 항목을 입력하세요.'; errEl.style.display = 'block'; } return; }
  if (pw !== pwConfirm) { if (errEl) { errEl.textContent = '비밀번호가 일치하지 않습니다.'; errEl.style.display = 'block'; } return; }
  var cfg = getGasConfig();
  if (!cfg.url || !cfg.token) { if (errEl) { errEl.textContent = '서버 설정 오류(GAS 미설정)'; errEl.style.display = 'block'; } return; }
  if (btn) { btn.disabled = true; btn.textContent = '가입 중...'; }
  try {
    var json = await _fetchGasJson(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'register', token: cfg.token, userId: id, userPw: pw, name: name, academy: academy, site: _siteId() })
    });
    if (!json.ok) { if (errEl) { errEl.textContent = json.error || '가입 실패'; errEl.style.display = 'block'; } return; }
    localStorage.setItem(_authKey('user_id'), id);
    localStorage.setItem(_authKey('user_pw'), pw);
    localStorage.setItem(_authKey('user_name'), name);
    localStorage.setItem(_authKey('user_academy'), academy);
    localStorage.setItem(_authKey('user_role'), '');
    localStorage.setItem(_authKey('last_active'), String(Date.now()));
    hideLoginOverlay();
  } catch(e) {
    if (errEl) { errEl.textContent = '연결 오류: ' + e.message; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = _loginOverlayMode === 'register' ? '가입하고 시작하기' : '로그인'; }
  }
}

function logoutUser() {
  clearUserAuth();
  setLoginOverlayMode('login');
  showLoginOverlay();
}

function showLoginOverlay() {
  var el = document.getElementById('login-overlay');
  if (el) el.style.display = 'flex';
}
function hideLoginOverlay() {
  var el = document.getElementById('login-overlay');
  if (el) el.style.display = 'none';
  var nameEl = document.getElementById('login-user-name');
  var auth = getUserAuth();
  if (nameEl && auth) nameEl.textContent = auth.name + (auth.academy ? ' · ' + auth.academy : '');
  maybeShowBetaIntro();
  if (typeof creditUpdateBadge === 'function') creditUpdateBadge();
  applyAdminVisibility();
}

// ── 베타 시작 안내 모달 — "다시 보지 않기" 체크 시 계정별로 재노출 안 함 ──
function maybeShowBetaIntro() {
  if (localStorage.getItem(_authKey('beta_intro_dismissed')) === '1') return;
  var el = document.getElementById('beta-intro-overlay');
  if (el) el.style.display = 'flex';
}
function closeBetaIntro() {
  var chk = document.getElementById('beta-intro-dont-show');
  if (chk && chk.checked) localStorage.setItem(_authKey('beta_intro_dismissed'), '1');
  var el = document.getElementById('beta-intro-overlay');
  if (el) el.style.display = 'none';
}
function initLoginGate() {
  _checkAutoLogout();
  if (getUserAuth()) { hideLoginOverlay(); _touchActivity(); return; }
  showLoginOverlay();
}

// ── 8시간 미사용 시 자동 로그아웃 ──────────────────────────────────
var AUTO_LOGOUT_MS = 8 * 60 * 60 * 1000;

// 활동마다 매번 쓰면 낭비이므로(특히 mousemove), 최소 1분 간격으로만 기록
function _touchActivity() {
  if (!getUserAuth()) return;
  var last = parseInt(localStorage.getItem(_authKey('last_active')), 10) || 0;
  var now = Date.now();
  if (now - last < 60000) return;
  localStorage.setItem(_authKey('last_active'), String(now));
}

function _checkAutoLogout() {
  if (!getUserAuth()) return;
  var last = parseInt(localStorage.getItem(_authKey('last_active')), 10);
  if (!last) { _touchActivity(); return; }
  if (Date.now() - last > AUTO_LOGOUT_MS) logoutUser();
}

['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach(function (evt) {
  document.addEventListener(evt, _touchActivity, { passive: true });
});
// 탭을 열어둔 채 방치한 경우까지 잡기 위해 주기적으로도 확인
setInterval(_checkAutoLogout, 5 * 60 * 1000);

// ── Claude 프록시 (관리자 키로 서버측 호출 — 클라이언트는 Claude API 키를 절대 갖지 않음) ──
async function claudeProxyCall(payload) {
  var auth = getUserAuth();
  if (!auth) { showLoginOverlay(); throw new Error('로그인이 필요합니다.'); }
  var cfg = getGasConfig();
  if (!cfg.url || !cfg.token) throw new Error('서버 설정 오류(GAS 미설정)');
  var json = await _fetchGasJson(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // GAS는 OPTIONS(preflight)를 못 받으므로 simple-request로 보냄
    body: JSON.stringify({ action: 'claudeProxy', token: cfg.token, userId: auth.id, userPw: auth.pw, site: _siteId(), payload: payload })
  });
  if (!json.ok) throw new Error(json.error || 'Claude 요청 실패');
  return json.data;
}

// 로그인/사용량 등 로그인 경로를 도는 요청들이 GAS 실행 할당량이 몰릴 때 가끔 JSON 대신
// HTML 에러 페이지를 돌려주는 게 확인됨(간헐적, 재시도하면 대부분 성공) — 그래서 한 번 자동
// 재시도하고, 그래도 안 되면 원인을 바로 알 수 있는 메시지로 던짐(res.json()의
// "Unexpected token '<' ... is not valid JSON" 그대로 노출하지 않음).
async function _fetchGasJson(url, options) {
  var lastErr;
  for (var attempt = 0; attempt < 2; attempt++) {
    try {
      var res = await fetch(url, options);
      var text = await res.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        lastErr = new Error('서버(GAS)가 일시적으로 응답하지 못했습니다. 다시 시도해주세요. (HTTP ' + res.status + ')');
        continue;
      }
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  throw lastErr;
}

// Gemini 프록시 (뉴스 소재 추천 등 텍스트 전용 호출) — { model, system, content, max_tokens } 형태
async function geminiProxyCall(payload) {
  var auth = getUserAuth();
  if (!auth) { showLoginOverlay(); throw new Error('로그인이 필요합니다.'); }
  var cfg = getGasConfig();
  if (!cfg.url || !cfg.token) throw new Error('서버 설정 오류(GAS 미설정)');
  var json = await _fetchGasJson(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // GAS는 OPTIONS(preflight)를 못 받으므로 simple-request로 보냄
    body: JSON.stringify({ action: 'geminiProxy', token: cfg.token, userId: auth.id, userPw: auth.pw, site: _siteId(), payload: payload })
  });
  if (!json.ok) throw new Error(json.error || 'Gemini 요청 실패');
  return json.text;
}

// 오늘 남은 블로그 작성 가능 횟수 확인 (초안 생성 전에 먼저 체크)
async function claudeQuotaCheck() {
  var auth = getUserAuth();
  if (!auth) { showLoginOverlay(); throw new Error('로그인이 필요합니다.'); }
  var cfg = getGasConfig();
  if (!cfg.url || !cfg.token) throw new Error('서버 설정 오류(GAS 미설정)');
  var json = await _fetchGasJson(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // GAS는 OPTIONS(preflight)를 못 받으므로 simple-request로 보냄
    body: JSON.stringify({ action: 'quotaStatus', token: cfg.token, userId: auth.id, userPw: auth.pw, site: _siteId() })
  });
  if (!json.ok) throw new Error(json.error || '사용량 확인 실패');
  return json; // { count, limit, remaining }
}

// 크레딧 시스템(2026-09) — 기능 실행 직전에 호출해 차감. 실패 시 throw(메시지는 잔여/필요 크레딧 안내문).
// {ok, remaining, monthlyCredit, unlimited} 형태로 반환.
async function useCredit(actionKey) {
  var auth = getUserAuth();
  if (!auth) { showLoginOverlay(); throw new Error('로그인이 필요합니다.'); }
  var cfg = getGasConfig();
  if (!cfg.url || !cfg.token) throw new Error('서버 설정 오류(GAS 미설정)');
  var json = await _fetchGasJson(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'useCredit', token: cfg.token, userId: auth.id, userPw: auth.pw, site: _siteId(), actionKey: actionKey })
  });
  if (!json.ok) throw new Error(json.error || '크레딧 사용에 실패했습니다.');
  if (typeof creditUpdateBadge === 'function') creditUpdateBadge();
  return json;
}

// 실제 차감 없이 비용만 미리 조회(사용 확인 팝업용).
async function getCreditQuote(actionKey) {
  var auth = getUserAuth();
  if (!auth) { showLoginOverlay(); throw new Error('로그인이 필요합니다.'); }
  var cfg = getGasConfig();
  if (!cfg.url || !cfg.token) throw new Error('서버 설정 오류(GAS 미설정)');
  var json = await _fetchGasJson(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'creditQuote', token: cfg.token, userId: auth.id, userPw: auth.pw, site: _siteId(), actionKey: actionKey })
  });
  if (!json.ok) throw new Error(json.error || '크레딧 확인에 실패했습니다.');
  return json;
}

// 크레딧이 드는 액션을 실행하기 전에 "예상 크레딧 사용 안내" 팝업(#credit-confirm-overlay)을
// 띄우고, 사용자가 "계속"을 눌러야 실제 useCredit()(차감)까지 진행한다. 무제한 계정은 확인
// 없이 바로 진행(어차피 차감되지 않음). 취소 시 던지는 Error에 cancelled=true를 표시해두면
// 호출부 catch에서 "실패"가 아니라 "사용자 취소"임을 구분해 별도 오류 메시지를 띄우지 않을 수 있다.
var _creditConfirmResolve = null;
function useCreditConfirm(actionKey, label) {
  return new Promise(function(resolve, reject) {
    (async function() {
      var quote;
      try {
        quote = await getCreditQuote(actionKey);
      } catch (e) { reject(e); return; }

      if (quote.unlimited) {
        try { resolve(await useCredit(actionKey)); } catch (e) { reject(e); }
        return;
      }

      var overlay = document.getElementById('credit-confirm-overlay');
      if (!overlay) { // 팝업 DOM이 없으면 안전하게 그냥 진행
        try { resolve(await useCredit(actionKey)); } catch (e) { reject(e); }
        return;
      }

      var descEl = document.getElementById('credit-confirm-desc');
      var labelEl = document.getElementById('credit-confirm-label');
      var costEl = document.getElementById('credit-confirm-cost');
      var balEl = document.getElementById('credit-confirm-balance');
      if (descEl) descEl.textContent = label + ' 시 크레딧이 차감됩니다.';
      if (labelEl) labelEl.textContent = label;
      if (costEl) costEl.textContent = '예상 ' + quote.cost + '크레딧';
      if (balEl) balEl.textContent = '남은 크레딧 ' + quote.remaining + '개 · 차감 후 ' + Math.max(0, quote.remaining - quote.cost) + '개';
      overlay.style.display = 'flex';

      _creditConfirmResolve = function(proceed) {
        overlay.style.display = 'none';
        _creditConfirmResolve = null;
        if (!proceed) {
          var cancelErr = new Error('취소되었습니다.');
          cancelErr.cancelled = true;
          reject(cancelErr);
          return;
        }
        useCredit(actionKey).then(resolve, reject);
      };
    })();
  });
}
function creditConfirmProceed() {
  if (_creditConfirmResolve) _creditConfirmResolve(true);
}
function creditConfirmCancel() {
  if (_creditConfirmResolve) _creditConfirmResolve(false);
}

// 설정(계정) 화면 표시용 — 차감 없이 잔여 크레딧만 조회.
async function getCreditStatus() {
  var auth = getUserAuth();
  if (!auth) return null;
  var cfg = getGasConfig();
  if (!cfg.url || !cfg.token) return null;
  var json = await _fetchGasJson(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'creditStatus', token: cfg.token, userId: auth.id, userPw: auth.pw, site: _siteId() })
  });
  return json.ok ? json : null;
}

// 크레딧 사용 내역(크레딧 페이지 전용, 본인 것만 최신순)
async function getCreditHistory(n) {
  var auth = getUserAuth();
  if (!auth) return [];
  var cfg = getGasConfig();
  if (!cfg.url || !cfg.token) return [];
  try {
    var json = await _fetchGasJson(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'creditHistory', token: cfg.token, userId: auth.id, userPw: auth.pw, site: _siteId(), n: n || 50 })
    });
    return json.ok ? (json.items || []) : [];
  } catch (e) { return []; }
}

// 본인이 작성한 글만 조회 (히스토리 탭 전용 — gasGetRecentPosts는 유사글 검사용으로 전체 공용 유지)
async function gasGetMyPosts(n) {
  var auth = getUserAuth();
  if (!auth) return [];
  var cfg = getGasConfig();
  if (!cfg.url || !cfg.token) return [];
  var json = await _fetchGasJson(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // GAS는 OPTIONS(preflight)를 못 받으므로 simple-request로 보냄
    body: JSON.stringify({ action: 'myPosts', token: cfg.token, userId: auth.id, userPw: auth.pw, site: _siteId(), n: n || 100 })
  });
  if (!json.ok) throw new Error(json.error || '히스토리 조회 실패');
  return json.posts || [];
}

// ── 피드백/문의 (게시판 형태, 스레드별로 본인+관리자만 조회 가능) ─────
async function gasFeedbackList() {
  var auth = getUserAuth();
  if (!auth) { showLoginOverlay(); throw new Error('로그인이 필요합니다.'); }
  var cfg = getGasConfig();
  if (!cfg.url || !cfg.token) throw new Error('서버 설정 오류(GAS 미설정)');
  var json = await _fetchGasJson(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // GAS는 OPTIONS(preflight)를 못 받으므로 simple-request로 보냄
    body: JSON.stringify({ action: 'feedbackList', token: cfg.token, userId: auth.id, userPw: auth.pw, site: _siteId() })
  });
  if (!json.ok) throw new Error(json.error || '문의 목록 조회 실패');
  return json.threads || [];
}

async function gasFeedbackPost(content) {
  var auth = getUserAuth();
  if (!auth) { showLoginOverlay(); throw new Error('로그인이 필요합니다.'); }
  var cfg = getGasConfig();
  if (!cfg.url || !cfg.token) throw new Error('서버 설정 오류(GAS 미설정)');
  var json = await _fetchGasJson(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // GAS는 OPTIONS(preflight)를 못 받으므로 simple-request로 보냄
    body: JSON.stringify({ action: 'feedbackPost', token: cfg.token, userId: auth.id, userPw: auth.pw, site: _siteId(), content: content })
  });
  if (!json.ok) throw new Error(json.error || '등록 실패');
  return json.threadId;
}

async function gasFeedbackReply(threadId, content) {
  var auth = getUserAuth();
  if (!auth) { showLoginOverlay(); throw new Error('로그인이 필요합니다.'); }
  var cfg = getGasConfig();
  if (!cfg.url || !cfg.token) throw new Error('서버 설정 오류(GAS 미설정)');
  var json = await _fetchGasJson(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // GAS는 OPTIONS(preflight)를 못 받으므로 simple-request로 보냄
    body: JSON.stringify({ action: 'feedbackReply', token: cfg.token, userId: auth.id, userPw: auth.pw, site: _siteId(), threadId: threadId, content: content })
  });
  if (!json.ok) throw new Error(json.error || '답변 등록 실패');
}

// ── 관리자 페이지 (역할==='관리자'만 서버에서 허용, 프론트는 sidebar 노출만 담당) ──
async function _adminCall(action, extra) {
  var auth = getUserAuth();
  if (!auth) { showLoginOverlay(); throw new Error('로그인이 필요합니다.'); }
  var cfg = getGasConfig();
  if (!cfg.url || !cfg.token) throw new Error('서버 설정 오류');
  var body = Object.assign({ action: action, token: cfg.token, userId: auth.id, userPw: auth.pw, site: _siteId() }, extra || {});
  var json = await _fetchGasJson(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });
  if (!json.ok) throw new Error(json.error || '요청 실패');
  return json;
}

async function adminListUsers() {
  var json = await _adminCall('adminListUsers');
  return json.users || [];
}
async function adminUpdateUser(targetId, patch) {
  return _adminCall('adminUpdateUser', { targetId: targetId, patch: patch });
}
async function adminGetConfig() {
  return _adminCall('adminGetConfig');
}
async function adminSetConfigValue(key, value, model) {
  return _adminCall('adminSetConfigValue', { key: key, value: value, model: model });
}
async function adminSetModels(provider, models) {
  return _adminCall('adminSetModels', { provider: provider, models: models });
}
async function adminSetCreditCost(actionKey, cost) {
  return _adminCall('adminSetCreditCost', { actionKey: actionKey, cost: cost });
}

// ── 기능별 on/off (flags.js가 배포 시 window.FEATURE_FLAGS 일부를 덮어씀) ──
function applyFeatureFlags() {
  var f = window.FEATURE_FLAGS || {};
  if (f.monitor === false) {
    var navMon = document.getElementById('nav-monitor');
    if (navMon) navMon.style.display = 'none';
  }
  if (f.mapsearch === false) {
    var navMs = document.getElementById('nav-mapsearch');
    if (navMs) navMs.style.display = 'none';
  }
  if (f.schoolshare === false) {
    var navSs = document.getElementById('nav-schoolshare');
    if (navSs) navSs.style.display = 'none';
  }
  if (f.instagram === false) {
    var navIg = document.getElementById('nav-settings-instagram');
    if (navIg) navIg.style.display = 'none';
    var igSec = document.getElementById('ig-post-section');
    if (igSec) igSec.style.display = 'none';
  }
  if (f.promo === false) {
    var promoSec = document.getElementById('promo-section');
    if (promoSec) promoSec.style.display = 'none';
    var imgPromoSec = document.getElementById('img-promo-section');
    if (imgPromoSec) imgPromoSec.style.display = 'none';
  }
}

// 관리자(role==='관리자') 로그인 시에만 사이드바에 "관리자" 메뉴 노출 — hideLoginOverlay()에서 매번 호출.
function applyAdminVisibility() {
  var navAdmin = document.getElementById('nav-admin');
  if (!navAdmin) return;
  var auth = getUserAuth();
  navAdmin.style.display = (auth && auth.role === '관리자') ? '' : 'none';
}

// ── 모델 선택 ─────────────────────────────────────────────────────
var MODEL_DEFAULTS = { claude: 'claude-sonnet-4-6', gemini: 'gemini-2.5-flash', openai: 'gpt-4o' };
function getModel(type) {
  return localStorage.getItem('mtt_model_' + type) || MODEL_DEFAULTS[type];
}

// ── 설정 탭 전환 (사이드바 서브메뉴에서 호출) ─────────────────────
function settingsTab(tab) {
  showPage('settings-' + tab);
}

// ── 구글 시트 연동 ────────────────────────────────────────────────
function getGasConfig() {
  var gas = (typeof ADMIN_GAS !== 'undefined') ? ADMIN_GAS : {};
  return {
    url:   (gas.url   && gas.url.trim())   ? gas.url.trim()   : (localStorage.getItem('mtt_gas_url')   || ''),
    token: (gas.token && gas.token.trim()) ? gas.token.trim() : (localStorage.getItem('mtt_gas_token') || '')
  };
}

// 지도검색 전용 GAS(gas/mapsearch_tracker.gs) — blog_tracker.gs와 별개 배포·별개 할당량
function getMapsearchGasConfig() {
  var gas = (typeof ADMIN_GAS_MAPSEARCH !== 'undefined') ? ADMIN_GAS_MAPSEARCH : {};
  return {
    url:   (gas.url   && gas.url.trim())   ? gas.url.trim()   : (localStorage.getItem('mtt_gas_url_mapsearch')   || ''),
    token: (gas.token && gas.token.trim()) ? gas.token.trim() : (localStorage.getItem('mtt_gas_token_mapsearch') || '')
  };
}

// 기사검색(뉴스 조회) 전용 GAS(gas/news_tracker.gs) — blog_tracker.gs와 별개 배포·별개 할당량
function getNewsGasConfig() {
  var gas = (typeof ADMIN_GAS_NEWS !== 'undefined') ? ADMIN_GAS_NEWS : {};
  return {
    url:   (gas.url   && gas.url.trim())   ? gas.url.trim()   : (localStorage.getItem('mtt_gas_url_news')   || ''),
    token: (gas.token && gas.token.trim()) ? gas.token.trim() : (localStorage.getItem('mtt_gas_token_news') || '')
  };
}

// 경쟁학원 온디맨드 모니터링 전용 Worker(cloudflare-migration/monitor-tracker) — 2026-08-31 프로토타입
function getMonitorGasConfig() {
  var gas = (typeof ADMIN_GAS_MONITOR !== 'undefined') ? ADMIN_GAS_MONITOR : {};
  return {
    url:   (gas.url   && gas.url.trim())   ? gas.url.trim()   : (localStorage.getItem('mtt_gas_url_monitor')   || ''),
    token: (gas.token && gas.token.trim()) ? gas.token.trim() : (localStorage.getItem('mtt_gas_token_monitor') || '')
  };
}

async function gasSavePost(data) {
  var cfg = getGasConfig();
  if (!cfg.url || !cfg.token) return;
  var auth = getUserAuth();
  var payload = {
    token:     cfg.token,
    action:    'save',
    type:      data.type      || '',
    mood:      data.mood      || '',
    title:     data.title     || '',
    topic:     data.topic     || '',
    keywords:  data.keywords  || '',
    tags:      data.tags      || '',
    body:      data.body      || '',
    structure: data.structure || '',
    targetLength:  data.targetLength  || '',
    sectionGuide:  data.sectionGuide  || '',
    promptVersion: data.promptVersion || '',
    userId:    auth ? auth.id : '',
    userPw:    auth ? auth.pw : '',
    site:      _siteId()
  };
  // 저장 후 화면의 "오늘 작성 현황"이 바로 갱신되도록, 호출부에서 await할 수 있게
  // fetch의 완료를 기다린다 (no-cors라 응답 내용은 못 읽지만, 요청이 서버에 도달했는지는
  // 이 await로 보장됨 — 이게 없으면 quotaStatus 조회가 저장 완료보다 먼저 도착해서
  // 화면에는 갱신 전 개수가 표시되는 경쟁 상태가 있었음)
  try {
    await fetch(cfg.url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {}
}

async function gasGetRecentPosts(n) {
  var cfg = getGasConfig();
  if (!cfg.url || !cfg.token) return [];
  try {
    var url = cfg.url + '?action=get&token=' + encodeURIComponent(cfg.token) + '&n=' + (n || 20);
    var res = await fetch(url);
    var json = await res.json();
    return json.posts || [];
  } catch(e) { return []; }
}

// 네이버 블로그 URL의 본문을 GAS 경유로 수집 (브라우저 CORS 우회, 참고 URL 기능용)
// GAS 미설정/실패/네이버 블로그가 아닌 경우 null 반환 — 호출부에서 조용히 폴백 처리
async function gasFetchNaverBlogContent(url) {
  var cfg = getGasConfig();
  if (!cfg.url || !cfg.token) return null;
  if (!/blog\.naver\.com/.test(url)) return null;
  try {
    var reqUrl = cfg.url + '?action=fetchNaverBlog&token=' + encodeURIComponent(cfg.token) + '&url=' + encodeURIComponent(url);
    var res = await fetch(reqUrl);
    var json = await res.json();
    return (json && json.ok && json.content) ? json.content : null;
  } catch(e) { return null; }
}

// ── 설정 페이지 초기화 ────────────────────────────────────────────
function _migrateOldPrompts() {
  // 구버전 기술 프롬프트가 저장돼 있으면 삭제 (사용자가 편집할 수 없는 숨김 부분)
  var oldPromo = localStorage.getItem('mtt_promo_prompt') || '';
  if (oldPromo.indexOf('이미지를 분석하여') !== -1 || oldPromo.indexOf('[훅]') !== -1) {
    localStorage.removeItem('mtt_promo_prompt');
  }
  var oldBlog = localStorage.getItem('mtt_blog_prompt') || '';
  if (oldBlog.indexOf('{{TYPE_RULES}}') !== -1 || oldBlog.indexOf('JSON 형식으로만 응답') !== -1) {
    localStorage.removeItem('mtt_blog_prompt');
  }
}

function settingsInitPrompt() {
  _migrateOldPrompts();
  var promoEl = document.getElementById('promo-prompt-edit');
  if (promoEl && !promoEl._inited) {
    promoEl.value = localStorage.getItem('mtt_promo_prompt') || (typeof DEFAULT_PROMO_TEMPLATE !== 'undefined' ? DEFAULT_PROMO_TEMPLATE : '');
    promoEl._inited = true;
  }
  var blogEl = document.getElementById('blog-prompt-edit');
  if (blogEl && !blogEl._inited) {
    blogEl.value = localStorage.getItem('mtt_blog_prompt') || (typeof BLOG_DRAFT_BASE !== 'undefined' ? BLOG_DRAFT_BASE : '');
    blogEl._inited = true;
  }
  var promoReset = document.getElementById('promo-reset-btn');
  if (promoReset && !promoReset._bound) {
    promoReset._bound = true;
    promoReset.onclick = function() {
      localStorage.removeItem('mtt_promo_prompt');
      var el = document.getElementById('promo-prompt-edit');
      if (el) { el.value = typeof DEFAULT_PROMO_TEMPLATE !== 'undefined' ? DEFAULT_PROMO_TEMPLATE : ''; el._inited = true; }
      showToast('홍보문구 프롬프트가 기본값으로 초기화되었습니다');
    };
  }
  var blogReset = document.getElementById('blog-reset-btn');
  if (blogReset && !blogReset._bound) {
    blogReset._bound = true;
    blogReset.onclick = function() {
      localStorage.removeItem('mtt_blog_prompt');
      var el = document.getElementById('blog-prompt-edit');
      if (el) { el.value = typeof BLOG_DRAFT_BASE !== 'undefined' ? BLOG_DRAFT_BASE : ''; el._inited = true; }
      showToast('블로그 프롬프트가 기본값으로 초기화되었습니다');
    };
  }
}

function settingsUpdateStatus() {
  if (typeof _igUpdateStatus === 'function') _igUpdateStatus();
  if (typeof igShowSection === 'function') igShowSection();
  settingsUpdateCurrent();
}

function settingsUpdateCurrent() {
  var nameEl = document.getElementById('cur-user');
  var auth = getUserAuth();
  if (nameEl) nameEl.textContent = auth ? (auth.name + (auth.academy ? ' · ' + auth.academy : '')) : '—';
}

function settingsSave() {
  // 프롬프트 저장
  var promoEl = document.getElementById('promo-prompt-edit');
  if (promoEl && promoEl.value.trim()) localStorage.setItem('mtt_promo_prompt', promoEl.value.trim());
  var blogEl = document.getElementById('blog-prompt-edit');
  if (blogEl && blogEl.value.trim()) localStorage.setItem('mtt_blog_prompt', blogEl.value.trim());
  // 인스타그램 설정 저장
  var igUserId = document.getElementById('set-ig-user-id');
  var igToken = document.getElementById('set-ig-token');
  var githubToken = document.getElementById('set-github-token');
  if (igUserId)    { var v = igUserId.value.trim();    if (v) localStorage.setItem('mtt_ig_user_id', v);    else localStorage.removeItem('mtt_ig_user_id'); }
  if (igToken)     { var v = igToken.value.trim();     if (v) localStorage.setItem('mtt_ig_token', v);      else localStorage.removeItem('mtt_ig_token'); }
  if (githubToken) { var v = githubToken.value.trim(); if (v) localStorage.setItem('mtt_github_token', v);  else localStorage.removeItem('mtt_github_token'); }
  settingsUpdateStatus();
  showToast('설정이 저장되었습니다');
}

function settingsInitInstagram() {
  var igUserId    = document.getElementById('set-ig-user-id');
  var igToken     = document.getElementById('set-ig-token');
  var githubToken = document.getElementById('set-github-token');
  if (igUserId)    igUserId.value    = localStorage.getItem('mtt_ig_user_id')   || '';
  if (igToken)     igToken.value     = localStorage.getItem('mtt_ig_token')     || '';
  if (githubToken) githubToken.value = localStorage.getItem('mtt_github_token') || '';
  _igUpdateStatus();
}

function _igUpdateStatus() {
  function mark(id, key) {
    var el = document.getElementById(id);
    if (!el) return;
    var val = localStorage.getItem(key);
    el.textContent = (val && val.length > 3) ? '✓ 설정됨' : '× 미설정';
    el.className = 'set-current-val ' + ((val && val.length > 3) ? 'ok' : 'none');
  }
  mark('status-ig-user-id',    'mtt_ig_user_id');
  mark('status-ig-token',      'mtt_ig_token');
  mark('status-github-token',  'mtt_github_token');
}

applyFeatureFlags();
initLoginGate();
showPage('blog'); // 로그인 후 첫 화면을 블로그로 (index.html/pages의 기본 active 상태와 맞춤)
