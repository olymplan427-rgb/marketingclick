// 피드백/문의 게시판 — 스레드형(작성 + 답변), 본인/관리자만 조회 가능(서버측 필터링).
var feedbackState = { threads: [], selectedThreadId: null, isAdmin: false };

function feedbackEsc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function feedbackEscNl(s) {
  return feedbackEsc(s).replace(/\n/g, '<br>');
}

function feedbackInit() {
  var auth = getUserAuth();
  feedbackState.isAdmin = !!(auth && auth.role === '관리자');
  var alertEl = document.getElementById('fb-alert');
  if (alertEl) alertEl.className = 'blog-alert err';

  gasFeedbackList().then(function(threads) {
    feedbackState.threads = threads || [];
    feedbackRenderList();
    var selected = feedbackState.threads.filter(function(t) { return t.threadId === feedbackState.selectedThreadId; })[0];
    feedbackRenderDetail(selected || null);
  }).catch(function(e) {
    if (alertEl) { alertEl.textContent = e.message || '문의 목록을 불러오지 못했습니다.'; alertEl.className = 'blog-alert err show'; }
  });
}

function feedbackRenderList() {
  var listEl = document.getElementById('fb-list');
  if (!listEl) return;
  var threads = feedbackState.threads;
  if (!threads.length) {
    listEl.innerHTML = '<p style="color:#9aa1ad;font-size:13px;">등록된 문의가 없습니다.</p>';
    return;
  }
  listEl.innerHTML = threads.map(function(t) {
    var isActive = t.threadId === feedbackState.selectedThreadId;
    var last = t.messages[t.messages.length - 1];
    var ownerTag = feedbackState.isAdmin
      ? (feedbackEsc(t.ownerName) + (t.ownerAcademy ? ' · ' + feedbackEsc(t.ownerAcademy) : '') + ' — ')
      : '';
    var preview = feedbackEsc((last && last.content || '').slice(0, 40));
    return '<div class="blog-card' + (isActive ? ' highlight' : '') + '" style="cursor:pointer;padding:10px 12px;margin-bottom:8px;" onclick="feedbackSelectThread(\'' + t.threadId + '\')">'
      + '<div style="display:flex;justify-content:space-between;gap:8px;align-items:start;">'
        + '<div style="font-size:13px;font-weight:700;color:#172033;line-height:1.4;">' + ownerTag + preview + '</div>'
        + '<div style="font-size:11px;color:#9aa1ad;white-space:nowrap;flex-shrink:0;">' + feedbackEsc((last || {}).date || '') + '</div>'
      + '</div>'
      + '<div style="margin-top:4px;font-size:11px;color:#657181;">' + t.messages.length + '개 메시지</div>'
      + '</div>';
  }).join('');
}

function feedbackSelectThread(threadId) {
  feedbackState.selectedThreadId = threadId;
  feedbackRenderList();
  var t = feedbackState.threads.filter(function(x) { return x.threadId === threadId; })[0];
  feedbackRenderDetail(t || null);
}

function feedbackRenderDetail(t) {
  var c = document.getElementById('fb-detail');
  if (!c) return;
  if (!t) {
    c.innerHTML = '<div class="blog-card"><div style="font-size:13px;font-weight:900;color:var(--txt);margin-bottom:8px;">피드백 / 문의</div><div style="font-size:12px;color:var(--mut);line-height:1.7;">왼쪽 목록에서 글을 클릭하면<br>여기에 전체 대화가 표시됩니다.</div></div>';
    return;
  }
  var auth = getUserAuth();
  var html = '<div class="blog-card">';
  if (feedbackState.isAdmin) {
    html += '<div style="font-size:12px;color:var(--mut);margin-bottom:10px;">' + feedbackEsc(t.ownerName) + (t.ownerAcademy ? ' · ' + feedbackEsc(t.ownerAcademy) : '') + '</div>';
  }
  html += t.messages.map(function(m) {
    var mine = auth && String(m.authorId) === String(auth.id);
    var isAdminMsg = m.authorRole === '관리자';
    var who = isAdminMsg ? '관리자' : feedbackEsc(m.authorName);
    return '<div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--bdr);">'
      + '<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px;">'
        + '<span style="font-size:12px;font-weight:700;color:' + (isAdminMsg ? 'var(--acc)' : 'var(--txt)') + ';">' + who + (mine ? ' (나)' : '') + '</span>'
        + '<span style="font-size:11px;color:#9aa1ad;">' + feedbackEsc(m.date) + '</span>'
      + '</div>'
      + '<div style="font-size:13px;color:var(--txt);line-height:1.6;white-space:pre-wrap;">' + feedbackEscNl(m.content) + '</div>'
    + '</div>';
  }).join('');
  html += '<textarea class="blog-input" id="fb-reply-content" rows="3" placeholder="답변을 입력하세요" style="min-height:70px;"></textarea>'
    + '<button class="btn btn-primary" style="margin-top:8px;" onclick="feedbackReply()">답변 등록</button>'
    + '<div id="fb-reply-alert" class="blog-alert err"></div>';
  html += '</div>';
  c.innerHTML = html;
}

async function feedbackPost() {
  var el = document.getElementById('fb-new-content');
  var alertEl = document.getElementById('fb-alert');
  var content = (el.value || '').trim();
  if (!content) return;
  try {
    await gasFeedbackPost(content);
    el.value = '';
    if (alertEl) alertEl.className = 'blog-alert err';
    feedbackInit();
  } catch (e) {
    if (alertEl) { alertEl.textContent = e.message || '등록 실패'; alertEl.className = 'blog-alert err show'; }
  }
}

async function feedbackReply() {
  var el = document.getElementById('fb-reply-content');
  var alertEl = document.getElementById('fb-reply-alert');
  var content = (el.value || '').trim();
  if (!content || !feedbackState.selectedThreadId) return;
  try {
    await gasFeedbackReply(feedbackState.selectedThreadId, content);
    feedbackInit();
  } catch (e) {
    if (alertEl) { alertEl.textContent = e.message || '등록 실패'; alertEl.className = 'blog-alert err show'; }
  }
}
