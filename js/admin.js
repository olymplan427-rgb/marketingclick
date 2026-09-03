// 관리자 페이지 — AI 프로바이더 키/모델, 기능별 크레딧 비용, 사용자 관리(D1 직접 반영).
// 서버(blog-tracker Worker)가 role==='관리자' 아니면 모든 admin* 액션을 거부하므로,
// 여기서는 sidebar 노출 + 편의 UI만 담당(applyAdminVisibility는 js/common.js).
var adminState = { config: null, users: [], notices: [], posts: [], selectedPostId: null, validationSummary: [], validationNote: '', promptVersionFilter: '' };

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
    var [config, users, notices, postsResult] = await Promise.all([adminGetConfig(), adminListUsers(), getAnnouncements(), adminListPosts()]);
    adminState.config = config;
    adminState.users = users;
    adminState.notices = notices;
    adminState.posts = postsResult.posts;
    adminState.validationSummary = postsResult.validationSummary;
    adminState.validationNote = postsResult.validationNote;
    adminRenderAiList();
    adminRenderCreditCosts();
    adminRenderUsers();
    adminRenderNotices();
    adminRenderPosts();
    adminRenderValidationSummary();
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
        + '<div style="font-size:12px;font-weight:700;color:var(--txt);margin-bottom:4px;">순차 폴백 우선순위 (한 줄에 모델 하나, 위에서부터 순서대로 시도 — 한도초과/실패 시 다음 줄로 자동 전환). 위 API 키에 쉼표로 여러 키를 넣으면 모델 하나당 그 키들도 순서대로 다 시도한 뒤 다음 모델로 넘어감(예: 3.7×키A→3.7×키B→3.6×키A→...)</div>'
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
        + '<input class="blog-input" style="flex:1;min-width:220px;" id="admin-key-' + k.provider + '" placeholder="' + (k.hasValue ? '변경하려면 새 키 입력 (' + adminEsc(k.maskedValue) + ')' : (k.provider === 'gemini' ? 'API 키 입력 (쉼표로 여러 개 가능: 키A,키B)' : 'API 키 입력')) + '">'
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
  { title: '블로그', keys: ['blog_analyze', 'blog_generate', 'blog_finalize', 'topic_suggest_combined'] },
  { title: '도구', keys: ['mapsearch_nearby', 'report_generate'] },
  { title: '이미지 스튜디오', keys: ['image_generate', 'image_promo', 'image_download'] }
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
      var isFree = Number(c.cost) === 0;
      var freeBadge = isFree ? ' <span class="info-banner-badge" style="background:var(--acc-light);color:var(--acc);">무료</span>' : '';
      return '<tr style="border-bottom:1px solid var(--bdr);">'
        + '<td style="padding:10px;">' + adminEsc(c.label) + freeBadge + '</td>'
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
  var pvFilter = adminState.promptVersionFilter;
  var list = adminState.posts.filter(function(p) {
    if (pvFilter && (p.promptVersion || '(미기록)') !== pvFilter) return false;
    if (!filter) return true;
    return (p.userId || '').toLowerCase().indexOf(filter) !== -1 || (p.title || '').toLowerCase().indexOf(filter) !== -1;
  });
  var pvBannerEl = document.getElementById('admin-post-pv-filter-banner');
  if (pvBannerEl) {
    pvBannerEl.innerHTML = pvFilter
      ? '<div style="font-size:12px;background:var(--acc-light);color:var(--acc);border-radius:6px;padding:6px 10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">'
        + '프롬프트 버전 <strong>' + adminEsc(pvFilter) + '</strong>만 표시 중 (' + list.length + '건)'
        + '<button class="btn" onclick="adminClearPromptVersionFilter()" style="padding:2px 8px;">필터 해제</button></div>'
      : '';
  }
  if (!list.length) { body.innerHTML = '<tr><td colspan="7" style="padding:10px;color:var(--mut);">글이 없습니다.</td></tr>'; return; }
  body.innerHTML = list.map(function(p) {
    return '<tr style="border-bottom:1px solid var(--bdr);">'
      + '<td style="padding:10px;font-weight:700;">' + adminEsc(p.userId) + '</td>'
      + '<td style="padding:10px;color:var(--mut);">' + adminEsc(p.date) + '</td>'
      + '<td style="padding:10px;">' + adminEsc(p.title) + '</td>'
      + '<td style="padding:10px;color:var(--mut);">' + adminEsc(p.type) + '</td>'
      + '<td style="padding:10px;color:var(--mut);font-size:11.5px;">' + adminEsc(p.promptVersion || '(미기록)') + '</td>'
      + '<td style="padding:10px;">' + adminValidationBadge(p.validation) + '</td>'
      + '<td style="padding:10px;white-space:nowrap;">'
        + '<button class="btn" onclick="adminTogglePostDetail(' + p.id + ')">보기</button> '
        + '<button class="btn" onclick="adminDeletePostRow(' + p.id + ')">삭제</button>'
      + '</td>'
    + '</tr>';
  }).join('');
}

function adminFilterByPromptVersion(promptVersion) {
  adminState.promptVersionFilter = promptVersion;
  adminRenderPosts();
  var body = document.getElementById('admin-post-body');
  if (body) body.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function adminClearPromptVersionFilter() {
  adminState.promptVersionFilter = '';
  adminRenderPosts();
}

var ADMIN_VALIDATION_STATUS_STYLE = {
  PASS:   { label: 'PASS',   bg: '#e3f1e6', fg: '#1e7a34' },
  REVISE: { label: 'REVISE', bg: '#fff4d6', fg: '#8a5a00' },
  HOLD:   { label: 'HOLD',   bg: '#fde3e3', fg: '#a51d1d' }
};
function adminValidationBadge(validation) {
  if (!validation) return '';
  var s = ADMIN_VALIDATION_STATUS_STYLE[validation.status] || ADMIN_VALIDATION_STATUS_STYLE.PASS;
  var issueCount = (validation.issues || []).filter(function(i) { return i.severity !== 'INFO'; }).length;
  return '<span style="display:inline-block;background:' + s.bg + ';color:' + s.fg + ';border-radius:20px;padding:3px 9px;font-size:11px;font-weight:800;">' + s.label + (issueCount ? ' · ' + issueCount : '') + '</span>';
}

// 프롬프트 버전별 문제 집계 — "검증하고 끝"이 아니라 어느 프롬프트 버전에서 어떤 문제가
// 반복되는지 보고 blog.js 프롬프트를 계속 고쳐나가기 위한 패널.
function adminRenderValidationSummary() {
  var el = document.getElementById('admin-validation-summary');
  if (!el) return;
  var summary = adminState.validationSummary || [];
  var note = adminState.validationNote ? '<div style="font-size:11.5px;color:var(--mut);margin-bottom:6px;">' + adminEsc(adminState.validationNote) + '</div>' : '';
  if (!summary.length) { el.innerHTML = note; return; }
  var rows = summary.map(function(v) {
    var cats = Object.keys(v.categoryCounts || {}).map(function(c) { return c + ' ' + v.categoryCounts[c]; }).join(', ') || '없음';
    return '<tr style="border-bottom:1px solid var(--bdr);cursor:pointer;" onclick="adminFilterByPromptVersion(\'' + adminEsc(v.promptVersion).replace(/'/g, "\\'") + '\')" title="클릭하면 이 버전 글만 아래 목록에서 필터링됩니다">'
      + '<td style="padding:7px 10px;font-weight:700;text-decoration:underline;">' + adminEsc(v.promptVersion) + '</td>'
      + '<td style="padding:7px 10px;">' + v.total + '건</td>'
      + '<td style="padding:7px 10px;color:#1e7a34;">PASS ' + (v.statusCounts.PASS || 0) + '</td>'
      + '<td style="padding:7px 10px;color:#8a5a00;">REVISE ' + (v.statusCounts.REVISE || 0) + '</td>'
      + '<td style="padding:7px 10px;color:#a51d1d;">HOLD ' + (v.statusCounts.HOLD || 0) + '</td>'
      + '<td style="padding:7px 10px;color:var(--mut);">' + adminEsc(cats) + '</td>'
    + '</tr>';
  }).join('');
  el.innerHTML = note
    + '<div style="font-size:12px;font-weight:700;color:var(--txt);margin-bottom:6px;">프롬프트 버전별 검증 현황 (행을 클릭하면 아래 글 목록이 그 버전만 필터링됩니다 — 반복되는 문제를 보고 blog.js를 고칠지 판단하세요)</div>'
    + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;">'
    + '<thead><tr style="border-bottom:1px solid var(--bdr);color:var(--mut);text-align:left;"><th style="padding:7px 10px;">프롬프트 버전</th><th style="padding:7px 10px;">건수</th><th style="padding:7px 10px;" colspan="3">상태</th><th style="padding:7px 10px;">문제 카테고리별 건수</th></tr></thead>'
    + '<tbody>' + rows + '</tbody></table></div>';
}

function adminRenderValidationIssues(validation) {
  if (!validation) return '';
  var issues = (validation.issues || []).filter(function(i) { return i.severity !== 'INFO'; });
  var infos = (validation.issues || []).filter(function(i) { return i.severity === 'INFO'; });
  if (!issues.length && !infos.length) return '<div style="font-size:12.5px;color:#1e7a34;margin-bottom:10px;">규칙 검사 통과 (문제 없음)</div>';
  var sevColor = { BLOCKER: '#a51d1d', MAJOR: '#c2740b', MINOR: '#6b7280' };
  var rows = issues.concat(infos).map(function(i) {
    var color = sevColor[i.severity] || '#6b7280';
    return '<div style="font-size:12.5px;line-height:1.6;padding:6px 0;border-bottom:1px solid var(--bdr);">'
      + '<span style="color:' + color + ';font-weight:800;">[' + i.severity + ']</span> '
      + '<span style="color:var(--mut);">' + adminEsc(i.category) + '</span> — ' + adminEsc(i.message)
    + '</div>';
  }).join('');
  return '<div style="margin-bottom:12px;"><div style="font-size:12px;font-weight:700;color:var(--txt);margin-bottom:4px;">규칙 검사 결과 (' + adminEsc(validation.rulesetVersion) + ')</div>' + rows + '</div>';
}

function adminTogglePostDetail(id) {
  var post = adminState.posts.filter(function(p) { return p.id === id; })[0];
  if (!post) return;
  adminState.selectedPostId = id;
  document.getElementById('admin-post-modal-title').textContent = post.userId + ' · ' + post.date + ' · ' + post.type;
  document.getElementById('admin-post-modal-body').innerHTML =
    '<div style="font-size:15px;font-weight:800;color:var(--txt);margin-bottom:10px;">' + adminEsc(post.title) + '</div>'
    + adminRenderValidationIssues(post.validation)
    + '<div style="margin-bottom:14px;">'
      + '<button class="btn" id="admin-ai-validate-btn" onclick="adminRunAiValidation(' + id + ', this)">AI 검증 실행 (2계층 — 호출당 비용 발생)</button>'
    + '</div>'
    + '<div id="admin-ai-validation-area" style="margin-bottom:14px;"><p style="font-size:12px;color:var(--mut);">AI 검증 이력을 불러오는 중...</p></div>'
    + '<div style="font-size:13px;color:var(--txt);line-height:1.7;white-space:pre-wrap;">' + adminEsc(post.body) + '</div>';
  document.getElementById('admin-post-modal').style.display = 'flex';
  adminLoadPostValidations(id);
}

async function adminLoadPostValidations(id) {
  var area = document.getElementById('admin-ai-validation-area');
  if (!area) return;
  try {
    var items = await adminGetPostValidations(id);
    if (!items.length) { area.innerHTML = '<p style="font-size:12px;color:var(--mut);">아직 AI 검증 이력이 없습니다.</p>'; return; }
    area.innerHTML = items.map(adminRenderAiValidationEntry).join('');
  } catch (e) {
    area.innerHTML = '<p style="font-size:12px;color:#a51d1d;">이력을 불러오지 못했습니다: ' + adminEsc(e.message || '') + '</p>';
  }
}

async function adminRunAiValidation(id, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'AI 검증 중... (재시도 포함 최대 3분 소요될 수 있음)'; }
  try {
    await adminValidatePostAI(id);
    await adminLoadPostValidations(id);
  } catch (e) {
    alert('AI 검증 실패: ' + (e.message || ''));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'AI 검증 실행 (2계층 — 호출당 비용 발생)'; }
  }
}

function adminRenderAiValidationEntry(item) {
  var r = item.result || {};
  var s = ADMIN_VALIDATION_STATUS_STYLE[r.final_status] || { label: r.final_status || '?', bg: '#eee', fg: '#374151' };
  var scores = r.scores || {};
  var scoreRow = ['factual_safety', 'math_curriculum', 'title_search_intent', 'logic_practicality', 'style_readability', 'brand_fit', 'cta']
    .map(function(k) { return k + ' ' + (scores[k] != null ? scores[k] : '-'); }).join(' · ');
  var issues = (r.issues || []).map(function(i) {
    var color = { BLOCKER: '#a51d1d', MAJOR: '#c2740b', MINOR: '#6b7280', INFO: '#9aa1ad' }[i.severity] || '#6b7280';
    return '<div style="font-size:12.5px;line-height:1.6;padding:6px 0;border-bottom:1px solid var(--bdr);">'
      + '<span style="color:' + color + ';font-weight:800;">[' + adminEsc(i.severity) + ']</span> <span style="color:var(--mut);">' + adminEsc(i.category) + '</span><br>'
      + '<span style="color:var(--txt);">문제: ' + adminEsc(i.original_text || '') + '</span><br>'
      + '<span style="color:var(--txt);">이유: ' + adminEsc(i.reason || '') + '</span><br>'
      + (i.suggested_revision ? '<span style="color:#1e7a34;">수정안: ' + adminEsc(i.suggested_revision) + '</span>' : '')
    + '</div>';
  }).join('') || '<div style="font-size:12px;color:var(--mut);">발견된 문제 없음</div>';
  var claims = (r.claims || []).map(function(c) {
    return '<div style="font-size:12px;color:var(--mut);">· [' + adminEsc(c.verification_status) + '] ' + adminEsc(c.claim) + (c.note ? ' — ' + adminEsc(c.note) : '') + '</div>';
  }).join('');
  var strengths = (r.strengths || []).map(function(s2) { return '<div style="font-size:12px;color:#1e7a34;">· ' + adminEsc(s2) + '</div>'; }).join('');
  var missing = (r.missing_inputs || []).length ? '<div style="font-size:12px;color:var(--mut);margin-top:6px;">입력 부족: ' + adminEsc((r.missing_inputs || []).join(', ')) + '</div>' : '';
  var decisionRow = '<div style="margin-top:8px;display:flex;gap:6px;align-items:center;">'
    + '<span style="font-size:11.5px;color:var(--mut);">관리자 처리: ' + adminEsc(item.adminDecision || '미처리') + (item.adminNote ? ' (' + adminEsc(item.adminNote) + ')' : '') + '</span>'
    + '<button class="btn" style="padding:2px 8px;font-size:11px;" onclick="adminDecideValidation(' + item.id + ', \'approved\')">승인</button>'
    + '<button class="btn" style="padding:2px 8px;font-size:11px;" onclick="adminDecideValidation(' + item.id + ', \'dismissed\')">무시</button>'
  + '</div>';
  return '<div style="border:1px solid var(--bdr);border-radius:8px;padding:12px;margin-bottom:10px;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
      + '<span style="display:inline-block;background:' + s.bg + ';color:' + s.fg + ';border-radius:20px;padding:3px 9px;font-size:11px;font-weight:800;">' + adminEsc(r.final_status || '?') + ' · ' + (r.total_score != null ? r.total_score : '-') + '점</span>'
      + '<span style="font-size:11px;color:var(--mut);">' + adminEsc(item.createdAt) + ' · ' + adminEsc(item.model) + ' · ' + adminEsc(item.standardVersion) + '</span>'
    + '</div>'
    + '<div style="font-size:12.5px;color:var(--txt);margin-bottom:6px;">' + adminEsc(r.summary || '') + '</div>'
    + '<div style="font-size:11px;color:var(--mut);margin-bottom:8px;">' + scoreRow + '</div>'
    + issues
    + (claims ? '<div style="margin-top:8px;font-size:12px;font-weight:700;color:var(--txt);">확인 필요 주장</div>' + claims : '')
    + (strengths ? '<div style="margin-top:8px;font-size:12px;font-weight:700;color:var(--txt);">잘된 점</div>' + strengths : '')
    + missing
    + decisionRow
  + '</div>';
}

async function adminDecideValidation(validationId, decision) {
  var note = '';
  if (decision === 'dismissed') note = prompt('무시 사유(선택, 비워도 됨):') || '';
  try {
    await adminSetValidationDecision(validationId, decision, note);
    if (adminState.selectedPostId != null) adminLoadPostValidations(adminState.selectedPostId);
  } catch (e) {
    alert('처리 실패: ' + (e.message || ''));
  }
}

function adminCloseModal() {
  document.getElementById('admin-post-modal').style.display = 'none';
  adminState.selectedPostId = null;
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
