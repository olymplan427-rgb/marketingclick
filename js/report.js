// ── 학원현황 리포트 (지역 경쟁학원 블로그 월별 정리) ──────────────────
// 우리 학원이 속한 구/동을 기준으로 "{지역} 수학학원" 네이버 블로그를 모아
// Gemini로 개강/특강/행사/이슈/강조 프로그램을 분류·월별 정리하고,
// 이를 바탕으로 우리 학원 블로그 주제도 함께 추천한다.

var REPORT_CATEGORIES = ['개강', '특강', '행사', '이슈사항', '강조 프로그램', '기타'];

var REPORT_SYSTEM_TECHNICAL = [
  '너는 {{과목}} 학원({{학원명}}) 마케팅 담당자를 돕는 경쟁학원 분석가야.',
  '특정 지역 수학학원 관련 네이버 블로그 검색 결과(JSON 목록)를 받는다. 각 항목엔 index가 붙어 있다.',
  '',
  '작업 순서:',
  '1. 목록 중 실제로 그 지역 수학학원의 운영 소식(개강, 특강, 행사, 이슈, 프로그램 소개 등)을 다루는 글만 골라라.',
  '   - 학원과 무관한 글, 학부모 개인 잡담·후기, 광고 배너성 글, 수학학원이 아닌 다른 과목 학원 글은 제외.',
  '   - 같은 사건을 다루는 여러 글은 대표 1개만 남겨라.',
  '2. 고른 글마다 다음을 정리:',
  '   - academy: 학원명 (알 수 있으면, 모르면 빈 문자열)',
  '   - category: "개강"/"특강"/"행사"/"이슈사항"/"강조 프로그램"/"기타" 중 하나',
  '   - summary: 무엇을 했는지 한 줄 요약(한국어, 40자 내외)',
  '   - month: 글 작성일(postdate) 기준 "YYYY-MM"',
  '   - sourceIndex: 원본 목록의 index',
  '3. 위 정리를 바탕으로, 우리 학원이 이번 달에 쓸 만한 블로그 주제 5~8개를 추천해라.',
  '   경쟁학원 사례를 참고하되 그대로 베끼지 말고 우리 학원 관점으로 재구성하고, 우리 학원이 아직 안 다룬 소재를 우선하라.',
  '   각 주제는 title/blogType/keywords/reason/sourceIndexes(참고한 항목의 sourceIndex 배열, 0~3개)를 가진다.',
  '   blogType은 다음 중 하나: 교육칼럼, 입시정보, 학원홍보, 합격인터뷰, 수학정보, 이벤트안내, 학원공지',
  '',
  '반드시 아래 JSON 형식으로만 응답 (다른 텍스트 금지):',
  '{"entries":[{"academy":"","category":"개강","summary":"","month":"2026-06","sourceIndex":0}],"topics":[{"title":"","blogType":"교육칼럼","keywords":"","reason":"","sourceIndexes":[0]}]}'
].join('\n');

function buildReportSystem() {
  var profile = loadAcademyProfile();
  return REPORT_SYSTEM_TECHNICAL
    .replace(/\{\{학원명\}\}/g, profile.name || '학원')
    .replace(/\{\{과목\}\}/g, profile.subject || '수학');
}

// 학원 프로필 주소에서 "(시/도) (시/구/군)"까지만 뽑아낸다 — 동 단위는 도로명 주소 표기가
// 제각각(도로명이라 동이 아예 안 나오는 경우가 많음)이라 정확도가 낮아 기본값에서 제외,
// 필요하면 입력창에서 사용자가 직접 동까지 추가하면 됨. 최선의 추정치일 뿐이라
// 입력창은 항상 수정 가능하게 열어둔다(reportInit의 hint 참고).
function reportExtractRegion(address) {
  if (!address) return '';
  var tokens = address.trim().split(/\s+/).slice(0, 4);
  var guIdx = -1, siIdx = -1;
  tokens.forEach(function(t, i) {
    if (/[가-힣]+[구군]$/.test(t)) guIdx = i;
    else if (siIdx === -1 && /[가-힣]+시$/.test(t)) siIdx = i;
  });
  var idx = guIdx !== -1 ? guIdx : siIdx;
  if (idx === -1) return '';
  return idx === 0 ? tokens[0] : tokens[0] + ' ' + tokens[idx];
}

function reportInit() {
  var input = document.getElementById('report-region');
  if (!input || input._inited) return;
  input._inited = true;
  var profile = loadAcademyProfile();
  var region = reportExtractRegion(profile.address || '');
  input.value = region;
  var hintEl = document.getElementById('report-region-hint');
  if (hintEl) {
    hintEl.textContent = region
      ? '학원 프로필 주소에서 자동으로 추출했습니다. 필요하면 직접 수정하세요.'
      : '학원 프로필에 주소가 없어 자동 추출하지 못했습니다. 지역명을 직접 입력해주세요.';
  }
}

async function reportFetchRegionBlogs(region) {
  var cfg = (typeof getNewsGasConfig === 'function') ? getNewsGasConfig() : { url: '', token: '' };
  if (!cfg.url || !cfg.token) throw new Error('서버 설정 오류(GAS 미설정)');
  var url = cfg.url + '?action=regionAcademyBlogs&token=' + encodeURIComponent(cfg.token) + '&region=' + encodeURIComponent(region);
  var res = await fetch(url);
  var json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.items || [];
}

async function reportGenerate(btn) {
  var regionInput = document.getElementById('report-region');
  var resultEl = document.getElementById('report-result');
  var region = regionInput ? regionInput.value.trim() : '';
  if (!region) { alert('지역을 입력해주세요'); return; }

  var orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ 블로그 수집 중...';
  if (resultEl) resultEl.innerHTML = '';

  try {
    var items = await reportFetchRegionBlogs(region);
    if (!items.length) {
      if (resultEl) resultEl.innerHTML = '<p style="font-size:13px;color:var(--mut);">최근 3개월 내 "' + reportEsc(region) + ' 수학학원" 관련 블로그를 찾지 못했습니다.</p>';
      return;
    }

    btn.textContent = '⏳ AI가 정리 중...';
    var itemsForAI = items.slice(0, 100).map(function(it, i) {
      return { index: i, title: it.title, description: it.description, bloggername: it.bloggername, postdate: it.postdate };
    });

    var raw = await geminiProxyCall({ model: getModel('gemini'), system: buildReportSystem(), content: JSON.stringify(itemsForAI), max_tokens: 4000 });
    var parsed = blogParseJson(raw);
    var entries = (parsed && parsed.entries) || [];
    var topics = (parsed && parsed.topics) || [];
    if (!entries.length && !topics.length) { alert('정리할 만한 내용을 찾지 못했습니다.'); return; }

    window._reportItems = items;
    reportRender(region, entries, topics);
  } catch (e) {
    alert('리포트 생성 실패: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}

function reportRender(region, entries, topics) {
  var resultEl = document.getElementById('report-result');
  if (!resultEl) return;

  var byMonth = {};
  entries.forEach(function(e) {
    var m = e.month || '기타';
    (byMonth[m] = byMonth[m] || []).push(e);
  });
  var months = Object.keys(byMonth).sort().reverse();

  var monthSections = months.map(function(m) {
    var rows = byMonth[m].map(function(e) {
      var src = window._reportItems[e.sourceIndex];
      var link = src ? src.link : '';
      return '' +
        '<div class="blog-copy-section">' +
          '<div class="blog-copy-header">' +
            '<span class="blog-copy-label">' + reportEsc(e.category || '기타') + (e.academy ? ' · ' + reportEsc(e.academy) : '') + '</span>' +
            (link ? '<a class="bc-btn" href="' + reportEsc(link) + '" target="_blank" rel="noopener">원문 보기 →</a>' : '') +
          '</div>' +
          '<div class="blog-copy-content">' + reportEsc(e.summary || '') + '</div>' +
        '</div>';
    }).join('');
    return '' +
      '<div style="margin-bottom:16px;">' +
        '<div style="font-size:14px;font-weight:900;color:var(--txt);margin-bottom:8px;">' + reportEsc(m) + '</div>' +
        rows +
      '</div>';
  }).join('');

  var topicCards = topics.map(function(t, i) {
    var sources = (t.sourceIndexes || []).map(function(idx) {
      var src = window._reportItems[idx];
      if (!src) return '';
      return '<div style="font-size:11px;color:var(--mut);margin-top:2px;">· <a href="' + reportEsc(src.link) + '" target="_blank" rel="noopener" style="color:var(--acc);text-decoration:underline;">' + reportEsc(src.title || '') + '</a></div>';
    }).join('');
    return [
      '<div class="blog-card" style="margin-bottom:10px;">',
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">',
          '<div style="flex:1;">',
            '<span style="background:var(--acc-light);color:var(--acc);font-size:11px;padding:2px 8px;border-radius:99px;font-weight:600;">' + reportEsc(t.blogType || '') + '</span>',
            '<div style="font-size:15px;font-weight:700;color:var(--txt);margin:6px 0 4px;">' + reportEsc(t.title || '') + '</div>',
            '<div style="font-size:12px;color:var(--mut);margin-bottom:6px;">' + reportEsc(t.keywords || '') + '</div>',
            '<div style="font-size:12px;color:var(--txt);">' + reportEsc(t.reason || '') + '</div>',
            sources,
          '</div>',
          '<button class="btn btn-primary" style="white-space:nowrap;" onclick="reportUseTopicSuggestion(' + i + ')">이 주제로 쓰기</button>',
        '</div>',
      '</div>'
    ].join('');
  }).join('');

  resultEl.innerHTML =
    '<div style="font-size:15px;font-weight:900;margin-bottom:4px;">' + reportEsc(region) + ' 수학학원 현황 (최근 3개월)</div>' +
    '<div style="font-size:12px;color:var(--mut);margin-bottom:16px;">경쟁학원 ' + entries.length + '건 정리됨</div>' +
    (monthSections || '<p style="font-size:13px;color:var(--mut);">월별로 정리할 만한 내용이 없었습니다.</p>') +
    '<div style="font-size:14px;font-weight:900;color:var(--txt);margin:20px 0 12px;">추천 블로그 주제 (' + topics.length + '건)</div>' +
    topicCards;
  window._reportTopics = topics;
}

function reportUseTopicSuggestion(idx) {
  var t = (window._reportTopics || [])[idx];
  if (!t) return;
  var setVal = function(id, val) {
    var el = document.getElementById(id);
    if (el && val) el.value = val;
  };
  setVal('blog-topic', t.title);
  setVal('blog-keywords', t.keywords);
  var typeEl = document.getElementById('blog-type');
  if (typeEl && t.blogType && Array.from(typeEl.options).some(function(o) { return o.value === t.blogType; })) {
    typeEl.value = t.blogType;
  }

  var links = (t.sourceIndexes || []).map(function(idx2) {
    var src = (window._reportItems || [])[idx2];
    return src && src.link;
  }).filter(Boolean);
  setVal('blog-ref-url', links.join('\n'));

  showPage('blog');
  showToast('주제가 채워졌습니다');
}

function reportEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
