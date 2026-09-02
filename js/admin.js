// 관리자 페이지 — AI 프로바이더 키/모델, 기능별 크레딧 비용, 사용자 관리(D1 직접 반영).
// 서버(blog-tracker Worker)가 role==='관리자' 아니면 모든 admin* 액션을 거부하므로,
// 여기서는 sidebar 노출 + 편의 UI만 담당(applyAdminVisibility는 js/common.js).
var adminState = { config: null, users: [], notices: [], posts: [], selectedPostId: null };

function adminEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function adminShowError(msg) {
  var el = document.getElementById('admin-alert');
  if (!el) return;
  if (!msg) { el.className = 'blog-alert err'; el.textContent = ''; return; }
  el.textContent = msg;
  el.className = 'blog-alert err show';
}

async function adminInit() {
  adminShowError('');
  try {
    var [config, users, notices, posts] = await Promise.all([adminGetConfig(), adminListUsers(), getAnnouncements(), adminListPosts()]);
    adminState.config = config;
    adminState.users = users;
    adminState.notices = notices;
    adminState.posts = posts;
    adminRenderAiList();
    adminRenderCreditCosts();
    adminRenderUsers();
    adminRenderNotices();
    adminRenderPosts();
    var dateEl = document.getElementById('admin-notice-date');
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);
  } catch (e) {
    adminShowError(e.message || '관리자 정보를 불러오지 못했습니다.');
  }
}

// ── 공지사항 ────────────────────────────────────────────────────
function adminRenderNotices() {
  var el = document.getElementById('admin-notice-list');
  if (!el) return;
  if (!adminState.notices.length) { el.innerHTML = '<div style="font-size:12px;color:var(--mut);">등록된 공지가 없습니다.</div>'; return; }
  el.innerHTML = adminState.notices.map(function(n) {
    return '<div class="blog-card" style="display:flex;justify-content:space-between;gap:12px;align-items:start;">'
      + '<div><div style="font-size:11px;color:var(--mut);">' + adminEsc(n.date) + '</div>'
        + '<div style="font-size:13px;font-weight:700;color:var(--txt);margin-top:2px;">' + adminEsc(n.title) + '</div>'
        + '<div style="font-size:12px;color:var(--mut);margin-top:2px;">' + adminEsc(n.body) + '</div></div>'
      + '<button class="btn" onclick="adminDeleteNotice(' + n.id + ')" style="flex-shrink:0;">삭제</button>'
    + '</div>';
  }).join('');
}

async function adminAddNotice() {
  var dateEl = document.getElementById('admin-notice-date');
  var titleEl = document.getElementById('admin-notice-title');
  var bodyEl = document.getElementById('admin-notice-body');
  var title = titleEl ? titleEl.value.trim() : '';
  if (!title) { adminShowError('공지 제목을 입력하세요.'); return; }
  try {
    await adminAddAnnouncement(dateEl.value || '', title, bodyEl.value.trim());
    titleEl.value = ''; bodyEl.value = '';
    adminShowError('');
    adminState.notices = await getAnnouncements();
    adminRenderNotices();
  } catch (e) {
    adminShowError(e.message || '등록 실패');
  }
}

async function adminDeleteNotice(id) {
  try {
    await adminDeleteAnnouncement(id);
    adminState.notices = await getAnnouncements();
    adminRenderNotices();
  } catch (e) {
    adminShowError(e.message || '삭제 실패');
  }
}

// ── AI 프로바이더 (키/모델) ──────────────────────────────────────
// config.model(아래 드롭다운)은 "1차 시도 모델"일 뿐이고, 실제 순차 폴백(1차 실패/429 시 다음
// 모델로 자동 전환)은 Gemini에서만 동작하며 그 순서는 config_models 테이블(우선순위 목록)이
// 결정한다(claudeProxy/geminiProxy 참고 — provider==='gemini'일 때만 fallback 배열을 붙임).
// Claude/OpenAI는 폴백 없이 1차 모델 하나만 사용.
var PROVIDER_LABELS = { claude: 'Claude (Anthropic)', gemini: 'Gemini (Google)', openai: 'OpenAI' };

function adminRenderAiList() {
  var el = document.getElementById('admin-ai-list');
  if (!el || !adminState.config) return;
  var models = adminState.config.models || {};
  el.innerHTML = adminState.config.keys.map(function(k) {
    var modelOptions = (models[k.provider] || []).map(function(m) {
      return '<option value="' + adminEsc(m) + '"' + (m === k.model ? ' selected' : '') + '>' + adminEsc(m) + '</option>';
    }).join('');
    var fallbackBlock = '';
    if (k.provider === 'gemini') {
      var fallbackList = (models.gemini || []).join('\n');
      fallbackBlock = '<div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--bdr);">'
        + '<div style="font-size:12px;font-weight:700;color:var(--txt);margin-bottom:4px;">순차 폴백 우선순위 (한 줄에 모델 하나, 위에서부터 순서대로 시도 — 한도초과/실패 시 다음 줄로 자동 전환)</div>'
        + '<textarea class="blog-input" id="admin-fallback-' + k.provider + '" rows="4" style="width:100%;font-family:monospace;font-size:12px;">' + adminEsc(fallbackList) + '</textarea>'
        + '<button class="btn" style="margin-top:6px;" onclick="adminSaveFallback(\'' + k.provider + '\')">폴백 순서 저장</button>'
      + '</div>';
    }
    return '<div class="blog-card">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">'
        + '<div style="font-weight:800;font-size:13px;color:var(--txt);">' + adminEsc(PROVIDER_LABELS[k.provider] || k.provider) + '</div>'
        + '<div style="font-size:11px;color:' + (k.hasValue ? '#16a34a' : 'var(--mut)') + ';font-weight:700;">' + (k.hasValue ? '키 설정됨' : '키 없음') + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
        + '<input class="blog-input" style="flex:1;min-width:220px;" id="admin-key-' + k.provider + '" placeholder="' + (k.hasValue ? '변경하려면 새 키 입력 (' + adminEsc(k.maskedValue) + ')' : 'API 키 입력') + '">'
        + '<select class="blog-input" style="width:220px;" id="admin-model-' + k.provider + '">' + modelOptions + '</select>'
        + '<button class="btn btn-primary" onclick="adminSaveAiRow(\'' + k.provider + '\',\'' + k.key + '\')">저장</button>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--mut);margin-top:6px;">위 드롭다운은 1차 시도 모델' + (k.provider === 'gemini' ? '(아래 폴백 목록 맨 앞에 없어도 항상 가장 먼저 시도됨)' : '') + '</div>'
      + fallbackBlock
    + '</div>';
  }).join('');
}

async function adminSaveAiRow(provider, key) {
  var keyEl = document.getElementById('admin-key-' + provider);
  var modelEl = document.getElementById('admin-model-' + provider);
  var value = keyEl ? keyEl.value.trim() : '';
  var model = modelEl ? modelEl.value : '';
  try {
    await adminSetConfigValue(key, value, model);
    if (keyEl) keyEl.value = '';
    adminShowError('');
    await adminInit();
  } catch (e) {
    adminShowError(e.message || '저장 실패');
  }
}

async function adminSaveFallback(provider) {
  var el = document.getElementById('admin-fallback-' + provider);
  var list = el ? el.value.split('\n').map(function(s) { return s.trim(); }).filter(Boolean) : [];
  try {
    await adminSetModels(provider, list);
    adminShowError('');
    await adminInit();
  } catch (e) {
    adminShowError(e.message || '저장 실패');
  }
}

// ── 기능별 크레딧 비용 ────────────────────────────────────────────
var CREDIT_COST_GROUPS = [
  { title: '블로그', keys: ['blog_analyze', 'blog_generate', 'blog_finalize', 'news_search'] },
  { title: '도구', keys: ['mapsearch_nearby', 'report_generate', 'image_promo', 'image_download'] }
];

function adminRenderCreditCosts() {
  var body = document.getElementById('admin-credit-cost-body');
  if (!body || !adminState.config) return;
  var byKey = {};
  adminState.config.creditCosts.forEach(function(c) { byKey[c.actionKey] = c; });
  body.innerHTML = CREDIT_COST_GROUPS.map(function(g) {
    var groupHeader = '<tr><td colspan="3" style="padding:14px 10px 6px;font-size:12px;font-weight:800;color:var(--acc);">' + adminEsc(g.title) + '</td></tr>';
    var rows = g.keys.map(function(actionKey) {
      var c = byKey[actionKey];
      if (!c) return '';
      return '<tr style="border-bottom:1px solid var(--bdr);">'
        + '<td style="padding:10px;">' + adminEsc(c.label) + '</td>'
        + '<td style="padding:10px;"><input class="blog-input" type="number" min="0" style="width:100px;" id="admin-cost-' + c.actionKey + '" value="' + adminEsc(c.cost) + '"></td>'
        + '<td style="padding:10px;"><button class="btn" onclick="adminSaveCreditCost(\'' + c.actionKey + '\')">저장</button></td>'
      + '</tr>';
    }).join('');
    return groupHeader + rows;
  }).join('');
}

async function adminSaveCreditCost(actionKey) {
  var el = document.getElementById('admin-cost-' + actionKey);
  var cost = el ? el.value : '';
  try {
    await adminSetCreditCost(actionKey, cost);
    adminShowError('');
  } catch (e) {
    adminShowError(e.message || '저장 실패');
  }
}

// ── 사용자 관리 ──────────────────────────────────────────────────
function adminRenderUsers() {
  var body = document.getElementById('admin-user-body');
  var pendingBanner = document.getElementById('admin-pending-banner');
  if (!body) return;
  var pendingCount = adminState.users.filter(function(u) { return u.status === '대기'; }).length;
  if (pendingBanner) {
    pendingBanner.style.display = pendingCount ? '' : 'none';
    pendingBanner.textContent = '가입 승인 대기 ' + pendingCount + '건';
  }
  // 승인 대기 계정을 맨 위로 정렬 — 관리자가 바로 눈에 띄게.
  var sorted = adminState.users.slice().sort(function(a, b) {
    return (a.status === '대기' ? 0 : 1) - (b.status === '대기' ? 0 : 1);
  });
  body.innerHTML = sorted.map(function(u) {
    var uid = adminEsc(u.id);
    var isPending = u.status === '대기';
    return '<tr style="border-bottom:1px solid var(--bdr);' + (isPending ? 'background:var(--acc-light);' : '') + '">'
      + '<td style="padding:10px;font-weight:700;">' + uid + (isPending ? ' <span class="info-banner-badge" style="background:var(--acc);color:#fff;">승인대기</span>' : '') + '</td>'
      + '<td style="padding:10px;">' + adminEsc(u.name) + (u.academy ? ' · ' + adminEsc(u.academy) : '') + '</td>'
      + '<td style="padding:10px;"><select class="blog-input" id="admin-u-status-' + uid + '">'
        + '<option value="사용"' + (u.status === '사용' ? ' selected' : '') + '>사용</option>'
        + '<option value="중지"' + (u.status !== '사용' && u.status !== '대기' ? ' selected' : '') + '>중지</option>'
        + (isPending ? '<option value="대기" selected>대기</option>' : '')
      + '</select></td>'
      + '<td style="padding:10px;"><select class="blog-input" id="admin-u-role-' + uid + '">'
        + '<option value=""' + (!u.role ? ' selected' : '') + '>일반</option>'
        + '<option value="관리자"' + (u.role === '관리자' ? ' selected' : '') + '>관리자</option>'
      + '</select></td>'
      + '<td style="padding:10px;"><input class="blog-input" type="number" min="0" id="admin-u-monthly-' + uid + '" value="' + adminEsc(u.monthly_credit == null ? '' : u.monthly_credit) + '" placeholder="무제한"></td>'
      + '<td style="padding:10px;"><input class="blog-input" type="number" min="0" id="admin-u-remaining-' + uid + '" value="' + adminEsc(u.remaining_credit == null ? '' : u.remaining_credit) + '"></td>'
      + '<td style="padding:10px;white-space:nowrap;">'
        + (isPending ? '<button class="btn btn-primary" onclick="adminApproveUserRow(\'' + uid + '\')">승인</button> ' : '')
        + '<button class="btn' + (isPending ? ' btn-outline' : ' btn-primary') + '" onclick="adminSaveUser(\'' + uid + '\')">저장</button>'
      + '</td>'
    + '</tr>';
  }).join('');
}

async function adminApproveUserRow(id) {
  try {
    await adminApproveUser(id);
    adminShowError('');
    await adminInit();
  } catch (e) {
    adminShowError(e.message || '승인 실패');
  }
}

async function adminSaveUser(id) {
  var status = document.getElementById('admin-u-status-' + id).value;
  var role = document.getElementById('admin-u-role-' + id).value;
  var monthlyCredit = document.getElementById('admin-u-monthly-' + id).value;
  var remainingCredit = document.getElementById('admin-u-remaining-' + id).value;
  try {
    await adminUpdateUser(id, { status: status, role: role, monthlyCredit: monthlyCredit, remainingCredit: remainingCredit });
    adminShowError('');
    await adminInit();
  } catch (e) {
    adminShowError(e.message || '저장 실패');
  }
}

// ── 블로그 글 관리 (전체 사용자) ───────────────────────────────
function adminRenderPosts() {
  var body = document.getElementById('admin-post-body');
  if (!body) return;
  var filterEl = document.getElementById('admin-post-filter');
  var filter = filterEl ? filterEl.value.trim().toLowerCase() : '';
  var list = adminState.posts.filter(function(p) {
    if (!filter) return true;
    return (p.userId || '').toLowerCase().indexOf(filter) !== -1 || (p.title || '').toLowerCase().indexOf(filter) !== -1;
  });
  if (!list.length) { body.innerHTML = '<tr><td colspan="5" style="padding:10px;color:var(--mut);">글이 없습니다.</td></tr>'; return; }
  body.innerHTML = list.map(function(p) {
    return '<tr style="border-bottom:1px solid var(--bdr);">'
      + '<td style="padding:10px;font-weight:700;">' + adminEsc(p.userId) + '</td>'
      + '<td style="padding:10px;color:var(--mut);">' + adminEsc(p.date) + '</td>'
      + '<td style="padding:10px;">' + adminEsc(p.title) + '</td>'
      + '<td style="padding:10px;color:var(--mut);">' + adminEsc(p.type) + '</td>'
      + '<td style="padding:10px;white-space:nowrap;">'
        + '<button class="btn" onclick="adminTogglePostDetail(' + p.id + ')">보기</button> '
        + '<button class="btn" onclick="adminDeletePostRow(' + p.id + ')">삭제</button>'
      + '</td>'
    + '</tr>';
  }).join('');
}

function adminTogglePostDetail(id) {
  var post = adminState.posts.filter(function(p) { return p.id === id; })[0];
  if (!post) return;
  document.getElementById('admin-post-modal-title').textContent = post.userId + ' · ' + post.date + ' · ' + post.type;
  document.getElementById('admin-post-modal-body').innerHTML =
    '<div style="font-size:15px;font-weight:800;color:var(--txt);margin-bottom:10px;">' + adminEsc(post.title) + '</div>'
    + '<div style="font-size:13px;color:var(--txt);line-height:1.7;white-space:pre-wrap;">' + adminEsc(post.body) + '</div>';
  document.getElementById('admin-post-modal').style.display = 'flex';
}

function adminCloseModal() {
  document.getElementById('admin-post-modal').style.display = 'none';
}

async function adminDeletePostRow(id) {
  if (!confirm('이 글을 삭제할까요? 되돌릴 수 없습니다.')) return;
  try {
    await adminDeletePost(id);
    adminState.posts = adminState.posts.filter(function(p) { return p.id !== id; });
    adminCloseModal();
    adminRenderPosts();
    adminShowError('');
  } catch (e) {
    adminShowError(e.message || '삭제 실패');
  }
}
