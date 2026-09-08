// 관리자 페이지 — AI 프로바이더 키/모델, 기능별 크레딧 비용, 사용자 관리(D1 직접 반영).
// 서버(blog-tracker Worker)가 role==='관리자' 아니면 모든 admin* 액션을 거부하므로,
// 여기서는 sidebar 노출 + 편의 UI만 담당(applyAdminVisibility는 js/common.js).
var adminState = { config: null, users: [], notices: [], posts: [], selectedPostId: null, validationSummary: [], validationNote: '', promptVersionFilter: '', promptVersions: [], creditStats: [], feedbackThreads: [], tokenPeriod: 'today', tokenStats: { byAction: [], byUser: [], byProvider: [], byDay: [], totals: { cnt: 0, input: 0, output: 0, total: 0 } } };

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
    var [config, users, notices, postsResult, promptVersions, creditStats, feedbackThreads] = await Promise.all([
      adminGetConfig(), adminListUsers(), getAnnouncements(), adminListPosts(), adminListPromptVersions(),
      adminCreditStats(), gasFeedbackList()
    ]);
    adminState.config = config;
    adminState.users = users;
    adminState.notices = notices;
    adminState.posts = postsResult.posts;
    adminState.validationSummary = postsResult.validationSummary;
    adminState.validationNote = postsResult.validationNote;
    adminState.promptVersions = promptVersions;
    adminState.creditStats = creditStats;
    adminState.feedbackThreads = feedbackThreads;
    adminRenderAiList();
    adminRenderCreditCosts();
    adminRenderUsers();
    adminRenderNotices();
    adminRenderPosts();
    adminRenderValidationSummary();
    adminRenderPromptVersions();
    adminRenderStats();
    adminLoadTokenStats();
    var dateEl = document.getElementById('admin-notice-date');
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);
    var now = new Date();
    var fromEl = document.getElementById('admin-token-custom-from');
    var toEl = document.getElementById('admin-token-custom-to');
    if (fromEl && !fromEl.value) fromEl.value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    if (toEl && !toEl.value) toEl.value = now.toISOString().slice(0, 10);
  } catch (e) {
    adminShowError(e.message || '관리자 정보를 불러오지 못했습니다.');
  }
}

// ── 탭 전환 ───────────────────────────────────────────────────────
function adminShowTab(tab) {
  ['stats', 'users', 'content', 'ai'].forEach(function(t) {
    var panel = document.getElementById('admin-tab-panel-' + t);
    if (panel) panel.style.display = (t === tab) ? '' : 'none';
    var btn = document.getElementById('admin-tab-btn-' + t);
    if (btn) btn.classList.toggle('active', t === tab);
  });
}

// ── 통계 ─────────────────────────────────────────────────────────
function adminStatCard(num, label) {
  return '<div class="admin-stat-card"><div class="admin-stat-num">' + adminEsc(num) + '</div><div class="admin-stat-label">' + adminEsc(label) + '</div></div>';
}

function adminRenderStats() {
  var users = adminState.users || [];
  var usersEl = document.getElementById('admin-stat-users');
  if (usersEl) {
    var active = users.filter(function(u) { return u.status === '사용'; }).length;
    var pending = users.filter(function(u) { return u.status === '대기'; }).length;
    var admins = users.filter(function(u) { return u.role === '관리자'; }).length;
    usersEl.innerHTML = adminStatCard(users.length, '총 가입자')
      + adminStatCard(active, '활성 계정')
      + adminStatCard(pending, '승인 대기')
      + adminStatCard(admins, '관리자 계정');
  }

  var creditBody = document.getElementById('admin-credit-stats-body');
  if (creditBody) {
    var stats = adminState.creditStats || [];
    creditBody.innerHTML = stats.length
      ? stats.map(function(s) {
          return '<tr style="border-bottom:1px solid var(--bdr);">'
            + '<td style="padding:10px;">' + adminEsc(s.item) + '</td>'
            + '<td style="padding:10px;">' + adminEsc(s.cnt) + '회</td>'
            + '<td style="padding:10px;">' + adminEsc(s.spent) + '크레딧</td>'
          + '</tr>';
        }).join('')
      : '<tr><td colspan="3" style="padding:10px;color:var(--mut);">아직 사용 내역이 없습니다.</td></tr>';
  }

  var posts = adminState.posts || [];
  var postsEl = document.getElementById('admin-stat-posts');
  if (postsEl) {
    var byType = {};
    posts.forEach(function(p) { var t = p.type || '기타'; byType[t] = (byType[t] || 0) + 1; });
    var typeCards = Object.keys(byType).sort(function(a, b) { return byType[b] - byType[a]; })
      .map(function(t) { return adminStatCard(byType[t], t); }).join('');
    postsEl.innerHTML = adminStatCard(posts.length, '총 작성 글') + typeCards;
  }

  var threads = adminState.feedbackThreads || [];
  var fbEl = document.getElementById('admin-stat-feedback');
  if (fbEl) {
    var waiting = threads.filter(function(t) { return t.messages.length <= 1; }).length;
    fbEl.innerHTML = adminStatCard(threads.length, '전체 문의')
      + adminStatCard(waiting, '답변 대기');
  }
}

// ── 토큰 사용량 (기간 필터 + 기능별/사용자별 집계 + 드릴다운) ─────────
// 날짜는 클라이언트 로컬 시각 기준(관리자 화면 표시용이라 KST 엄밀함까지는 불필요) — 서버가
// created_at 'YYYY-MM-DD' 접두 문자열 비교로 필터링(index.js의 adminTokenStats 참고).
function adminTokenPeriodRange(period) {
  var now = new Date();
  var fmt = function(d) { return d.toISOString().slice(0, 10); };
  if (period === 'today') { var t = fmt(now); return { from: t, to: t }; }
  if (period === 'yesterday') { var y = new Date(now); y.setDate(y.getDate() - 1); var yt = fmt(y); return { from: yt, to: yt }; }
  if (period === '7d') { var from7 = new Date(now); from7.setDate(from7.getDate() - 6); return { from: fmt(from7), to: fmt(now) }; }
  if (period === 'month') { var fromM = new Date(now.getFullYear(), now.getMonth(), 1); return { from: fmt(fromM), to: fmt(now) }; }
  if (period === 'custom') {
    var fromEl = document.getElementById('admin-token-custom-from');
    var toEl = document.getElementById('admin-token-custom-to');
    return { from: (fromEl && fromEl.value) || '', to: (toEl && toEl.value) || '' };
  }
  return { from: '', to: '' }; // 전체
}

function adminSetTokenPeriod(period) {
  adminState.tokenPeriod = period;
  ['today', 'yesterday', '7d', 'month', 'all'].forEach(function(p) {
    var btn = document.getElementById('admin-token-period-' + p);
    if (btn) btn.classList.toggle('active', p === period);
  });
  adminLoadTokenStats();
}

// 날짜 직접 지정 — 프리셋 필(오늘/어제/최근7일/이번달/전체)에 없는 특정일/기간 조회용
// (2026-09-08 피드백: "날짜를 지정해서 볼 수 있는게 있어야 할 듯").
function adminSetTokenCustomRange() {
  var fromEl = document.getElementById('admin-token-custom-from');
  var toEl = document.getElementById('admin-token-custom-to');
  if (!fromEl || !toEl || !fromEl.value) return;
  if (!toEl.value) toEl.value = fromEl.value;
  adminState.tokenPeriod = 'custom';
  ['today', 'yesterday', '7d', 'month', 'all'].forEach(function(p) {
    var btn = document.getElementById('admin-token-period-' + p);
    if (btn) btn.classList.remove('active');
  });
  adminLoadTokenStats();
}

// ── 예상 비용 환산 (참고용 추정치) ──────────────────────────────────
// 실제 청구 금액이 아니라 "이 정도 토큰량이면 유료 API 기준 대략 얼마 정도인가"를 가늠하기 위한
// 참고 수치다(2026-09-08 피드백: "금액으로 환산할수가 있나?"). Gemini는 현재 무료 티어 키를 순환
// 사용 중이라 실제 청구는 0원이지만, 사용량 감(sense)을 잡을 수 있도록 유료 기준가로도 계산해 보여줌.
// 가격은 1M(백만) 토큰당 USD, 모델명에 포함된 키워드로 매칭 — 정확한 청구서가 아니므로 근사치.
var ADMIN_TOKEN_PRICING_USD_PER_M = [
  { match: /opus/i, input: 15, output: 75 },
  { match: /sonnet/i, input: 3, output: 15 },
  { match: /haiku/i, input: 0.8, output: 4 },
  { match: /flash/i, input: 0.075, output: 0.3 },
  { match: /gemini.*pro|pro.*gemini/i, input: 1.25, output: 5 },
  { match: /gpt-4o-mini/i, input: 0.15, output: 0.6 },
  { match: /gpt-4o|gpt-4/i, input: 2.5, output: 10 }
];
var ADMIN_USD_TO_KRW = 1450; // 대략적인 환율 — 참고용 추정치라 엄밀하지 않음

function adminPriceForModel(model) {
  for (var i = 0; i < ADMIN_TOKEN_PRICING_USD_PER_M.length; i++) {
    if (ADMIN_TOKEN_PRICING_USD_PER_M[i].match.test(model || '')) return ADMIN_TOKEN_PRICING_USD_PER_M[i];
  }
  return null;
}

function adminEstimateCostUsd(byProvider) {
  var total = 0;
  var matched = false;
  (byProvider || []).forEach(function(s) {
    var price = adminPriceForModel(s.model);
    if (!price) return;
    matched = true;
    total += ((s.input || 0) / 1e6) * price.input + ((s.output || 0) / 1e6) * price.output;
  });
  return matched ? total : null;
}

async function adminLoadTokenStats() {
  try {
    var range = adminTokenPeriodRange(adminState.tokenPeriod);
    adminState.tokenStats = await adminTokenStats(range.from, range.to);
    adminRenderTokenStats();
  } catch (e) {
    adminShowError(e.message || '토큰 사용량을 불러오지 못했습니다.');
  }
}

// 천 단위 콤마 — 호출 횟수처럼 작은 수치용(2026-09-08 피드백: 콤마 없이는 크기 가늠이 안 됨).
function adminNumFmt(n) {
  return Number(n || 0).toLocaleString('ko-KR');
}

// 토큰 수치 전용 — 자릿수가 너무 커서(수만~수십만) 일의 자리까지 다 보여주면 오히려 안 읽히므로
// 1000 이상은 K 단위로 축약해서 보여줌(2026-09-08 피드백: "일의 자리까지 다 보여주지 말고 K형태로").
function adminTokenFmt(n) {
  n = Number(n || 0);
  if (n < 1000) return adminNumFmt(n);
  var k = n / 1000;
  var s = k >= 100 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '');
  return s + 'K';
}

function adminRenderTokenStats() {
  var t = adminState.tokenStats.totals || {};
  var byProvider = adminState.tokenStats.byProvider || [];
  var costUsd = adminEstimateCostUsd(byProvider);
  var costLabel = costUsd === null ? '—' : '$' + costUsd.toFixed(2);
  var summaryEl = document.getElementById('admin-stat-tokens');
  if (summaryEl) {
    summaryEl.innerHTML = adminStatCard(adminNumFmt(t.cnt), '총 호출')
      + adminStatCard(adminTokenFmt(t.input), '입력 토큰')
      + adminStatCard(adminTokenFmt(t.output), '출력 토큰')
      + adminStatCard(adminTokenFmt(t.total), '총 토큰')
      + adminStatCard(costLabel, '예상 비용(유료 환산)');
  }
  var noteEl = document.getElementById('admin-token-cost-note');
  if (noteEl) {
    noteEl.textContent = costUsd === null
      ? '예상 비용은 알려진 모델 단가와 매칭되는 경우에만 계산됩니다.'
      : '예상 비용은 각 모델의 유료 API 단가 기준 추정치입니다(약 ' + adminNumFmt(Math.round(costUsd * ADMIN_USD_TO_KRW)) + '원, 환율 1450원/$ 기준). 현재 Gemini는 무료 티어 키를 사용 중이라 실제 청구액은 이보다 적거나 0원일 수 있습니다.';
  }
  adminRenderTokenDailyChart();

  var actionBody = document.getElementById('admin-token-by-action-body');
  if (actionBody) {
    var byAction = adminState.tokenStats.byAction || [];
    actionBody.innerHTML = byAction.length
      ? byAction.map(function(s) {
          return '<tr class="admin-token-row" onclick="adminShowTokenDetail(\'action\',\'' + adminEsc(s.action_key) + '\')">'
            + '<td style="padding:8px;">' + adminEsc(s.label) + '</td>'
            + '<td style="padding:8px;">' + adminNumFmt(s.cnt) + '</td>'
            + '<td style="padding:8px;">' + adminTokenFmt(s.total) + '</td>'
          + '</tr>';
        }).join('')
      : '<tr><td colspan="3" style="padding:8px;color:var(--mut);">내역 없음</td></tr>';
  }

  var userBody = document.getElementById('admin-token-by-user-body');
  if (userBody) {
    var byUser = adminState.tokenStats.byUser || [];
    userBody.innerHTML = byUser.length
      ? byUser.map(function(s) {
          return '<tr class="admin-token-row" onclick="adminShowTokenDetail(\'user\',\'' + adminEsc(s.user_id) + '\')">'
            + '<td style="padding:8px;">' + adminEsc(s.user_id || '(알 수 없음)') + '</td>'
            + '<td style="padding:8px;">' + adminNumFmt(s.cnt) + '</td>'
            + '<td style="padding:8px;">' + adminTokenFmt(s.total) + '</td>'
          + '</tr>';
        }).join('')
      : '<tr><td colspan="3" style="padding:8px;color:var(--mut);">내역 없음</td></tr>';
  }

  var providerBody = document.getElementById('admin-token-by-provider-body');
  if (providerBody) {
    var byProvider = adminState.tokenStats.byProvider || [];
    providerBody.innerHTML = byProvider.length
      ? byProvider.map(function(s) {
          var name = (s.provider || '(알 수 없음)') + (s.model ? ' · ' + s.model : '');
          return '<tr class="admin-token-row" onclick="adminShowTokenDetail(\'provider\',\'' + adminEsc(s.provider) + '\')">'
            + '<td style="padding:8px;">' + adminEsc(name) + '</td>'
            + '<td style="padding:8px;">' + adminNumFmt(s.cnt) + '</td>'
            + '<td style="padding:8px;">' + adminTokenFmt(s.input) + '</td>'
            + '<td style="padding:8px;">' + adminTokenFmt(s.output) + '</td>'
            + '<td style="padding:8px;">' + adminTokenFmt(s.total) + '</td>'
          + '</tr>';
        }).join('')
      : '<tr><td colspan="5" style="padding:8px;color:var(--mut);">내역 없음</td></tr>';
  }
}

// 일별 추이 그래프 — 외부 차트 라이브러리 없이 막대 높이를 순수 CSS/JS로 계산해서 그림
// (2026-09-08 피드백: "기본으로 보이는 것은 매일 그래프형태로 할까?" → 기본 뷰에 항상 표시).
function adminRenderTokenDailyChart() {
  var chartEl = document.getElementById('admin-token-daily-chart');
  var labelsEl = document.getElementById('admin-token-daily-labels');
  if (!chartEl) return;
  var byDay = adminState.tokenStats.byDay || [];
  if (!byDay.length) {
    chartEl.innerHTML = '<div style="width:100%;text-align:center;color:var(--mut);font-size:12px;align-self:center;">내역 없음</div>';
    if (labelsEl) labelsEl.innerHTML = '';
    return;
  }
  var max = Math.max.apply(null, byDay.map(function(d) { return d.total || 0; })) || 1;
  chartEl.innerHTML = byDay.map(function(d) {
    var h = Math.max(2, Math.round(((d.total || 0) / max) * 116));
    var title = d.day + ' · 호출 ' + adminNumFmt(d.cnt) + '회 · 토큰 ' + adminTokenFmt(d.total);
    return '<div class="admin-token-bar" style="height:' + h + 'px;" title="' + adminEsc(title) + '"></div>';
  }).join('');
  // 막대 수가 많아지면(전체 기간 등) 라벨을 다 못 넣으니 대략 8~10개만 간격을 두고 표시
  var showEvery = Math.max(1, Math.ceil(byDay.length / 8));
  if (labelsEl) {
    labelsEl.innerHTML = byDay.map(function(d, i) {
      var text = (i % showEvery === 0 || i === byDay.length - 1) ? d.day.slice(5) : '';
      return '<div style="flex:1;min-width:4px;text-align:center;white-space:nowrap;overflow:hidden;">' + adminEsc(text) + '</div>';
    }).join('');
  }
}

async function adminShowTokenDetail(kind, key) {
  var titleEl = document.getElementById('admin-token-detail-title');
  var bodyEl = document.getElementById('admin-token-detail-body');
  var overlay = document.getElementById('admin-token-detail-modal');
  var titleMap = { action: '기능별 상세', user: (key || '(알 수 없음)') + ' 상세', provider: (key || '(알 수 없음)') + ' 상세' };
  if (titleEl) titleEl.textContent = titleMap[kind] || '상세';
  if (bodyEl) bodyEl.innerHTML = '<p style="font-size:13px;color:var(--mut);">불러오는 중...</p>';
  if (overlay) overlay.style.display = 'flex';

  try {
    var range = adminTokenPeriodRange(adminState.tokenPeriod);
    var rows = await adminTokenLogDetail(
      range.from, range.to,
      kind === 'action' ? key : '',
      kind === 'user' ? key : '',
      kind === 'provider' ? key : ''
    );
    if (!bodyEl) return;
    bodyEl.innerHTML = rows.length
      ? '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="border-bottom:1px solid var(--bdr);color:var(--mut);text-align:left;">'
        + '<th style="padding:6px;">시각</th><th style="padding:6px;">아이디</th><th style="padding:6px;">기능</th><th style="padding:6px;">모델</th><th style="padding:6px;">입력</th><th style="padding:6px;">출력</th><th style="padding:6px;">합계</th>'
        + '</tr></thead><tbody>'
        + rows.map(function(r) {
            return '<tr style="border-bottom:1px solid var(--bdr);">'
              + '<td style="padding:6px;white-space:nowrap;">' + adminEsc(r.created_at) + '</td>'
              + '<td style="padding:6px;">' + adminEsc(r.user_id) + '</td>'
              + '<td style="padding:6px;">' + adminEsc(r.label) + '</td>'
              + '<td style="padding:6px;">' + adminEsc(r.model) + '</td>'
              + '<td style="padding:6px;">' + adminTokenFmt(r.input_tokens) + '</td>'
              + '<td style="padding:6px;">' + adminTokenFmt(r.output_tokens) + '</td>'
              + '<td style="padding:6px;">' + adminTokenFmt(r.total_tokens) + '</td>'
            + '</tr>';
          }).join('')
        + '</tbody></table></div>'
      : '<p style="font-size:13px;color:var(--mut);">해당 기간에 호출 내역이 없습니다.</p>';
  } catch (e) {
    if (bodyEl) bodyEl.innerHTML = '<p style="font-size:13px;color:#ef4444;">' + adminEsc(e.message || '상세 조회 실패') + '</p>';
  }
}

function adminCloseTokenDetailModal() {
  var overlay = document.getElementById('admin-token-detail-modal');
  if (overlay) overlay.style.display = 'none';
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
  { title: '시장트렌드', keys: ['mapsearch_nearby', 'report_generate'] },
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

// ── 블로그 작성 프롬프트 버전 관리(2026-09-03) ────────────────────
var ADMIN_PROMPT_STATUS_STYLE = {
  active:   { label: '활성',    bg: '#e3f1e6', fg: '#1e7a34' },
  draft:    { label: '검토대기', bg: '#fff4d6', fg: '#8a5a00' },
  archived: { label: '보관됨',   bg: '#eee',    fg: '#6b7280' }
};
function adminRenderPromptVersions() {
  var body = document.getElementById('admin-prompt-version-body');
  if (!body) return;
  var versions = adminState.promptVersions || [];
  if (!versions.length) { body.innerHTML = '<tr><td colspan="7" style="padding:10px;color:var(--mut);">버전이 없습니다.</td></tr>'; return; }
  body.innerHTML = versions.map(function(v) {
    var s = ADMIN_PROMPT_STATUS_STYLE[v.status] || { label: v.status, bg: '#eee', fg: '#374151' };
    var badge = '<span style="display:inline-block;background:' + s.bg + ';color:' + s.fg + ';border-radius:20px;padding:3px 9px;font-size:11px;font-weight:800;">' + s.label + '</span>';
    var sourceLabel = v.source === 'ai_auto' ? 'AI 제안' : '수동';
    var activateBtn = v.status === 'active' ? '' : '<button class="btn" onclick="adminRunActivatePromptVersion(' + v.id + ')">활성화</button> ';
    return '<tr style="border-bottom:1px solid var(--bdr);">'
      + '<td style="padding:10px;font-weight:700;font-size:12px;">' + adminEsc(v.versionLabel) + '</td>'
      + '<td style="padding:10px;color:var(--mut);">' + adminEsc(sourceLabel) + '</td>'
      + '<td style="padding:10px;">' + badge + '</td>'
      + '<td style="padding:10px;">' + v.postCount + '건</td>'
      + '<td style="padding:10px;color:var(--mut);font-size:12px;">' + adminEsc(v.changeSummary || '(초기 버전)') + '</td>'
      + '<td style="padding:10px;color:var(--mut);font-size:11px;">' + adminEsc(v.activatedAt || '-') + '</td>'
      + '<td style="padding:10px;white-space:nowrap;">'
        + activateBtn
        + '<button class="btn" onclick="adminPreviewPromptVersion(' + v.id + ')">미리보기</button>'
      + '</td>'
    + '</tr>';
  }).join('');
}

async function adminRunGenerateAiPromptRevision(btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'AI 분석 중... (3단계로 나눠 진행 — 재시도 포함 최대 5분 소요될 수 있음)'; }
  try {
    var res = await adminGenerateAiPromptRevision();
    adminState.promptVersions = await adminListPromptVersions();
    adminRenderPromptVersions();
    alert('새 버전(' + res.versionLabel + ')이 "검토대기" 상태로 생성되었습니다.\n\n변경 요약: ' + (res.changeSummary || '(없음)') + '\n\n"미리보기"로 내용을 확인한 뒤 괜찮으면 "활성화"를 눌러주세요.');
  } catch (e) {
    alert('AI 개선안 생성 실패: ' + (e.message || ''));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'AI 개선안 생성 (호출당 비용 발생)'; }
  }
}

async function adminRunActivatePromptVersion(id) {
  if (!confirm('이 버전을 활성화하면 지금부터 모든 사용자의 블로그 작성에 즉시 적용됩니다. 계속할까요?')) return;
  try {
    await adminActivatePromptVersion(id);
    adminState.promptVersions = await adminListPromptVersions();
    adminRenderPromptVersions();
  } catch (e) {
    alert('활성화 실패: ' + (e.message || ''));
  }
}

async function adminPreviewPromptVersion(id) {
  try {
    var detail = await adminGetPromptVersionDetail(id);
    var typeRules = {};
    try { typeRules = JSON.parse(detail.typeRulesJson || '{}'); } catch (e) {}
    var typeRulesHtml = Object.keys(typeRules).map(function(k) {
      return '<div style="margin-bottom:8px;"><strong style="font-size:12px;color:var(--acc);">' + adminEsc(k) + '</strong><div style="font-size:12px;color:var(--txt);white-space:pre-wrap;">' + adminEsc(typeRules[k]) + '</div></div>';
    }).join('');
    document.getElementById('admin-prompt-modal-title').textContent = detail.versionLabel + ' (' + detail.status + ')';
    document.getElementById('admin-prompt-modal-body').innerHTML =
      (detail.changeSummary ? '<div style="background:var(--acc-light);color:var(--acc);border-radius:8px;padding:10px 12px;font-size:12.5px;margin-bottom:14px;">' + adminEsc(detail.changeSummary) + '</div>' : '')
      + '<div style="font-size:12px;font-weight:700;color:var(--txt);margin-bottom:4px;">draft_technical</div>'
      + '<div style="font-size:12px;color:var(--txt);white-space:pre-wrap;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px;margin-bottom:14px;">' + adminEsc(detail.draftTechnical) + '</div>'
      + '<div style="font-size:12px;font-weight:700;color:var(--txt);margin-bottom:4px;">final_system</div>'
      + '<div style="font-size:12px;color:var(--txt);white-space:pre-wrap;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px;margin-bottom:14px;">' + adminEsc(detail.finalSystem) + '</div>'
      + '<div style="font-size:12px;font-weight:700;color:var(--txt);margin-bottom:4px;">type_rules</div>'
      + typeRulesHtml;
    document.getElementById('admin-prompt-modal').style.display = 'flex';
  } catch (e) {
    alert('불러오기 실패: ' + (e.message || ''));
  }
}

function adminClosePromptModal() {
  document.getElementById('admin-prompt-modal').style.display = 'none';
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
