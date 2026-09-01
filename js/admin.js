// 관리자 페이지 — AI 프로바이더 키/모델, 기능별 크레딧 비용, 사용자 관리(D1 직접 반영).
// 서버(blog-tracker Worker)가 role==='관리자' 아니면 모든 admin* 액션을 거부하므로,
// 여기서는 sidebar 노출 + 편의 UI만 담당(applyAdminVisibility는 js/common.js).
var adminState = { config: null, users: [] };

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
    var [config, users] = await Promise.all([adminGetConfig(), adminListUsers()]);
    adminState.config = config;
    adminState.users = users;
    adminRenderAiList();
    adminRenderCreditCosts();
    adminRenderUsers();
  } catch (e) {
    adminShowError(e.message || '관리자 정보를 불러오지 못했습니다.');
  }
}

// ── AI 프로바이더 (키/모델) ──────────────────────────────────────
var PROVIDER_LABELS = { claude: 'Claude (Anthropic)', gemini: 'Gemini (Google)', openai: 'OpenAI' };

function adminRenderAiList() {
  var el = document.getElementById('admin-ai-list');
  if (!el || !adminState.config) return;
  var models = adminState.config.models || {};
  el.innerHTML = adminState.config.keys.map(function(k) {
    var modelOptions = (models[k.provider] || []).map(function(m) {
      return '<option value="' + adminEsc(m) + '"' + (m === k.model ? ' selected' : '') + '>' + adminEsc(m) + '</option>';
    }).join('');
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

// ── 기능별 크레딧 비용 ────────────────────────────────────────────
function adminRenderCreditCosts() {
  var body = document.getElementById('admin-credit-cost-body');
  if (!body || !adminState.config) return;
  body.innerHTML = adminState.config.creditCosts.map(function(c) {
    return '<tr style="border-bottom:1px solid var(--bdr);">'
      + '<td style="padding:10px;">' + adminEsc(c.label) + '</td>'
      + '<td style="padding:10px;"><input class="blog-input" type="number" min="0" style="width:100px;" id="admin-cost-' + c.actionKey + '" value="' + adminEsc(c.cost) + '"></td>'
      + '<td style="padding:10px;"><button class="btn" onclick="adminSaveCreditCost(\'' + c.actionKey + '\')">저장</button></td>'
    + '</tr>';
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
  if (!body) return;
  body.innerHTML = adminState.users.map(function(u) {
    var uid = adminEsc(u.id);
    return '<tr style="border-bottom:1px solid var(--bdr);">'
      + '<td style="padding:10px;font-weight:700;">' + uid + '</td>'
      + '<td style="padding:10px;">' + adminEsc(u.name) + (u.academy ? ' · ' + adminEsc(u.academy) : '') + '</td>'
      + '<td style="padding:10px;"><select class="blog-input" id="admin-u-status-' + uid + '">'
        + '<option value="사용"' + (u.status === '사용' ? ' selected' : '') + '>사용</option>'
        + '<option value="중지"' + (u.status !== '사용' ? ' selected' : '') + '>중지</option>'
      + '</select></td>'
      + '<td style="padding:10px;"><select class="blog-input" id="admin-u-role-' + uid + '">'
        + '<option value=""' + (!u.role ? ' selected' : '') + '>일반</option>'
        + '<option value="관리자"' + (u.role === '관리자' ? ' selected' : '') + '>관리자</option>'
      + '</select></td>'
      + '<td style="padding:10px;"><input class="blog-input" type="number" min="0" id="admin-u-monthly-' + uid + '" value="' + adminEsc(u.monthly_credit == null ? '' : u.monthly_credit) + '" placeholder="무제한"></td>'
      + '<td style="padding:10px;"><input class="blog-input" type="number" min="0" id="admin-u-remaining-' + uid + '" value="' + adminEsc(u.remaining_credit == null ? '' : u.remaining_credit) + '"></td>'
      + '<td style="padding:10px;"><button class="btn btn-primary" onclick="adminSaveUser(\'' + uid + '\')">저장</button></td>'
    + '</tr>';
  }).join('');
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
