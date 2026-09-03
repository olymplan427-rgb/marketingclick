// 문의(1:1) 게시판 — 스레드형(작성 + 답변), 본인/관리자만 조회 가능(서버측 필터링).
// 문의 분류/세부 항목은 서버 스키마 변경 없이 content 텍스트 맨 앞에 "[분류 > 세부항목] 제목" 형태로
// 얹어서 저장한다(2026-09-04, gasFeedbackPost가 content 문자열 하나만 받는 구조라 이 방식이 가장 단순).
// 대분류는 사이드바 섹션 제목(블로그/시장트렌드/콘텐츠 제작)과, 세부 항목은 사이드바 실제 메뉴
// 이름과 1:1로 동일하게 맞춤(index.html 참고) — 세부 항목은 현재(베타) 사이드바에 노출되는 기능만
// 반영, FEATURE_FLAGS로 숨겨진 경쟁학원 모니터링/인스타그램 연동은 제외해뒀다가 베타에 풀리면 추가할 것.
var FEEDBACK_CATEGORIES = [
  { label: '블로그', subs: ['AI 글작성', 'AI 소재추천', '히스토리'] },
  { label: '시장트렌드', subs: ['주변 학원 검색', '지역 트렌드 AI리포트', '학교 점유율'] },
  { label: '콘텐츠 제작', subs: ['이미지 스튜디오'] },
  { label: '계정/설정', subs: ['크레딧', '설정'] },
  { label: '기타 문의', subs: [] }
];

var feedbackState = { threads: [], expandedThreadId: null, isAdmin: false };

function feedbackEsc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function feedbackEscNl(s) {
  return feedbackEsc(s).replace(/\n/g, '<br>');
}

function feedbackInit() {
  var auth = getUserAuth();
  feedbackState.isAdmin = !!(auth && auth.role === '관리자');
  feedbackShowList();

  gasFeedbackList().then(function(threads) {
    feedbackState.threads = threads || [];
    feedbackRenderList();
  }).catch(function(e) {
    var listEl = document.getElementById('fb-list');
    if (listEl) listEl.innerHTML = '<p style="font-size:13px;color:#ef4444;">' + feedbackEsc(e.message || '문의 목록을 불러오지 못했습니다.') + '</p>';
  });
}

function feedbackShowList() {
  var listView = document.getElementById('fb-view-list');
  var writeView = document.getElementById('fb-view-write');
  if (listView) listView.style.display = '';
  if (writeView) writeView.style.display = 'none';
}

function feedbackShowWrite() {
  var listView = document.getElementById('fb-view-list');
  var writeView = document.getElementById('fb-view-write');
  if (listView) listView.style.display = 'none';
  if (writeView) writeView.style.display = '';

  var catEl = document.getElementById('fb-category');
  if (catEl && !catEl._inited) {
    catEl._inited = true;
    catEl.innerHTML = FEEDBACK_CATEGORIES.map(function(c) {
      return '<option value="' + feedbackEsc(c.label) + '">' + feedbackEsc(c.label) + '</option>';
    }).join('');
    feedbackUpdateSubcategories();
  }

  var titleEl = document.getElementById('fb-title');
  var contentEl = document.getElementById('fb-new-content');
  var alertEl = document.getElementById('fb-alert');
  if (titleEl) titleEl.value = '';
  if (contentEl) contentEl.value = '';
  feedbackUpdateCount();
  if (alertEl) alertEl.className = 'blog-alert err';
}

function feedbackUpdateSubcategories() {
  var catEl = document.getElementById('fb-category');
  var subEl = document.getElementById('fb-subcategory');
  if (!catEl || !subEl) return;
  var cat = FEEDBACK_CATEGORIES.filter(function(c) { return c.label === catEl.value; })[0];
  var subs = (cat && cat.subs) || [];
  subEl.innerHTML = '<option value="">선택 안 함</option>' + subs.map(function(s) {
    return '<option value="' + feedbackEsc(s) + '">' + feedbackEsc(s) + '</option>';
  }).join('');
}

function feedbackUpdateCount() {
  var contentEl = document.getElementById('fb-new-content');
  var countEl = document.getElementById('fb-count');
  if (contentEl && countEl) countEl.textContent = (contentEl.value || '').length + '/4000';
}

// 스레드의 첫 메시지(content)에서 "[분류 > 세부항목] 제목" 헤더를 분리 — 없으면 전체를 제목으로 간주.
function feedbackParseHeader(content) {
  var m = /^\[([^\]]*)\]\s*([\s\S]*)$/.exec(content || '');
  if (!m) return { tag: '', title: (content || '').split('\n')[0], body: content || '' };
  var rest = m[2];
  var nlIdx = rest.indexOf('\n');
  var title = nlIdx === -1 ? rest : rest.slice(0, nlIdx);
  return { tag: m[1], title: title || '(제목 없음)', body: content || '' };
}

function feedbackRenderList() {
  var listEl = document.getElementById('fb-list');
  if (!listEl) return;
  var threads = feedbackState.threads;
  if (!threads.length) {
    listEl.innerHTML = [
      '<div class="empty-state">',
        '<div class="empty-state-title">작성한 문의가 없습니다</div>',
        '<div class="empty-state-desc">궁금한 점이나 오류가 있으면 문의를 남겨 주세요.</div>',
        '<button class="btn btn-primary" style="margin-top:14px;" onclick="feedbackShowWrite()">문의 작성하기</button>',
      '</div>'
    ].join('');
    return;
  }

  listEl.innerHTML = threads.map(function(t) {
    var isExpanded = t.threadId === feedbackState.expandedThreadId;
    var first = t.messages[0];
    var header = feedbackParseHeader(first && first.content);
    var ownerTag = feedbackState.isAdmin
      ? (feedbackEsc(t.ownerName) + (t.ownerAcademy ? ' · ' + feedbackEsc(t.ownerAcademy) : '') + ' — ')
      : '';
    var hasReply = t.messages.length > 1;
    var last = t.messages[t.messages.length - 1];

    var row = '<div class="blog-card" style="cursor:pointer;padding:14px 16px;margin-bottom:10px;" onclick="feedbackToggleThread(\'' + t.threadId + '\')">'
      + '<div style="display:flex;justify-content:space-between;gap:8px;align-items:start;">'
        + '<div>'
          + (header.tag ? '<span class="info-banner-badge" style="background:var(--acc-light);color:var(--acc);margin-bottom:4px;display:inline-block;">' + feedbackEsc(header.tag) + '</span><br>' : '')
          + '<span style="font-size:14px;font-weight:700;color:var(--txt);">' + ownerTag + feedbackEsc(header.title) + '</span>'
        + '</div>'
        + '<div style="font-size:11px;color:var(--mut);white-space:nowrap;flex-shrink:0;">' + feedbackEsc((last || {}).date || '') + '</div>'
      + '</div>'
      + '<div style="margin-top:8px;">'
        + (hasReply ? '<span class="info-banner-badge" style="background:var(--acc-light);color:var(--acc);">답변 완료</span>' : '<span class="info-banner-badge" style="background:var(--hover);color:var(--mut);">답변 대기</span>')
      + '</div>'
    + '</div>';

    if (!isExpanded) return row;

    var replyAuth = getUserAuth();
    var detailBody = t.messages.map(function(m, i) {
      var mine = replyAuth && String(m.authorId) === String(replyAuth.id);
      var isAdminMsg = m.authorRole === '관리자';
      var who = isAdminMsg ? '관리자' : feedbackEsc(m.authorName);
      var content = i === 0 ? feedbackParseHeader(m.content).body.replace(/^\[[^\]]*\]\s*[^\n]*\n?/, '') : m.content;
      return '<div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--bdr);">'
        + '<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px;">'
          + '<span style="font-size:12px;font-weight:700;color:' + (isAdminMsg ? 'var(--acc)' : 'var(--txt)') + ';">' + who + (mine ? ' (나)' : '') + '</span>'
          + '<span style="font-size:11px;color:var(--mut);">' + feedbackEsc(m.date) + '</span>'
        + '</div>'
        + '<div style="font-size:13px;color:var(--txt);line-height:1.6;white-space:pre-wrap;">' + feedbackEscNl(content) + '</div>'
      + '</div>';
    }).join('');

    var detail = '<div class="blog-card" style="margin:-4px 0 10px;padding:16px;">'
      + detailBody
      + '<textarea class="blog-input" id="fb-reply-content" rows="3" placeholder="답변을 입력하세요" style="min-height:70px;"></textarea>'
      + '<button class="btn btn-primary" style="margin-top:8px;" onclick="feedbackReply()">답변 등록</button>'
      + '<div id="fb-reply-alert" class="blog-alert err"></div>'
    + '</div>';

    return row + detail;
  }).join('');
}

function feedbackToggleThread(threadId) {
  feedbackState.expandedThreadId = feedbackState.expandedThreadId === threadId ? null : threadId;
  feedbackRenderList();
}

async function feedbackPost() {
  var catEl = document.getElementById('fb-category');
  var subEl = document.getElementById('fb-subcategory');
  var titleEl = document.getElementById('fb-title');
  var contentEl = document.getElementById('fb-new-content');
  var alertEl = document.getElementById('fb-alert');

  var title = (titleEl.value || '').trim();
  var body = (contentEl.value || '').trim();
  if (!title) { if (alertEl) { alertEl.textContent = '제목을 입력해주세요.'; alertEl.className = 'blog-alert err show'; } return; }
  if (!body) { if (alertEl) { alertEl.textContent = '내용을 입력해주세요.'; alertEl.className = 'blog-alert err show'; } return; }

  var cat = catEl ? catEl.value : '';
  var sub = subEl ? subEl.value : '';
  var tag = cat + (sub ? ' > ' + sub : '');
  var content = '[' + tag + '] ' + title + '\n' + body;

  try {
    await gasFeedbackPost(content);
    if (alertEl) alertEl.className = 'blog-alert err';
    feedbackState.expandedThreadId = null;
    feedbackShowList();
    feedbackInit();
  } catch (e) {
    if (alertEl) { alertEl.textContent = e.message || '등록 실패'; alertEl.className = 'blog-alert err show'; }
  }
}

async function feedbackReply() {
  var el = document.getElementById('fb-reply-content');
  var alertEl = document.getElementById('fb-reply-alert');
  var content = (el.value || '').trim();
  if (!content || !feedbackState.expandedThreadId) return;
  try {
    await gasFeedbackReply(feedbackState.expandedThreadId, content);
    feedbackInit();
  } catch (e) {
    if (alertEl) { alertEl.textContent = e.message || '등록 실패'; alertEl.className = 'blog-alert err show'; }
  }
}
