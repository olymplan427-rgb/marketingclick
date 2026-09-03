// ── AI 소재추천 (js/blog.js 로드 후 동작, blogtab-news 탭) ──────────────
// 뉴스 기반 + 지역 트렌드 기반을 버튼 하나로 동시에 조회해 한 리스트에 [뉴스]/[지역트렌드]
// 배지로만 구분해 나열한다(2026-09-03, 별도 버튼/입력창 없앰). 학원 프로필 기준으로만 조회하고,
// 프로필이 없으면(학원명 미등록) 등록 안내만 보여주고 조회하지 않는다.
// ① 뉴스 기반 — 최근 교육 뉴스를 GAS(getEducationNews)로 가져온 뒤 Gemini(geminiProxy)로
//   중복 소재를 제외하고 블로그 주제를 추천.
// ② 지역 트렌드 기반 — js/report.js의 reportFetchRegionBlogs를 그대로 재사용해 학원 프로필
//   주소에서 자동 추출한 "{지역} 수학학원" 네이버 블로그를 독립적으로 수집한 뒤, 지역 트렌드
//   리포트보다 가벼운 단일 AI 호출로 주제만 추천한다(리포트는 언급량/프로필/패턴/시사점까지
//   무거운 맵-리듀스 분석이 필요하지만, 여긴 주제만 필요해서 단일 호출로 충분).
//   프로필에 주소가 없어 지역을 못 뽑으면 이 부분만 건너뛰고 뉴스 기반은 정상 진행한다.
// 두 결과 다 "sourceIds"/"sourceIndexes" 같은 원본 참조 방식이 달라서, 조회 시점에 refs(참고 글
// title/link/description 배열)로 미리 통일해 저장 — 렌더링/모달 쪽은 source 종류를 몰라도 됨.

var NEWS_TOPIC_SYSTEM_TECHNICAL = [
  '너는 {{과목}} 학원({{학원명}}) 블로그 담당자를 돕는 소재 기획자야.',
  '최근 1개월 교육 관련 뉴스 목록(JSON)을 받는다.',
  '',
  '작업 순서:',
  '1. 같은 사건/주제를 다루는 기사끼리 묶어서 중복 소재를 제거해라 (예: 같은 정책 발표를 다룬 여러 매체 기사는 1개 소재로 합침).',
  '2. 다음 기사는 반드시 제외해라:',
  '   - 학원 마케팅 소재와 관련 없는 기사 (정치, 사건사고, 스포츠 등)',
  '   - 학원 불법 교습·단속·과태료·특별점검 등 학원을 단속·규제 대상으로 다루는 기사',
  '   - 사교육비 통계, 사교육 시장 규모, 사교육 과열 논란 등 사교육을 부정적/사회문제로 다루는 기사',
  '   - 학원을 부정적으로 언급하거나 학부모에게 불안감만 주고 학원 블로그로 풀어내기 애매한 기사',
  '3. 초등·중등 학부모 대상 콘텐츠와 입시(고입·대입) 관련 소재를 우선적으로 선정해라. 고등/수능 소재보다 초등·중등·입시 소재 비중을 높게 가져가라.',
  '4. 남은 소재 중 학원 블로그(학부모 대상)로 긍정적·건설적으로 풀어내기 좋은 것 8개 내외를 선정해라.',
  '5. 각 소재를 블로그 "주제" 문구로 바꿔라 — 뉴스 제목을 그대로 베끼지 말고, 학부모 공감형/문제 직시형 톤으로 재구성.',
  '',
  '아래 글 유형 중 하나를 blogType으로 지정: 교육칼럼, 입시정보, 학원홍보, 합격인터뷰, 수학정보, 이벤트안내, 학원공지',
  '',
  '뉴스 목록의 각 항목에는 id가 붙어 있다. 이 소재에 참고한 원본 뉴스의 id를 sourceIds에 배열로 넣어라 (1~3개).',
  '',
  '반드시 아래 JSON 형식으로만 응답 (다른 텍스트 금지):',
  '{"topics":[{"title":"블로그 주제 문구","blogType":"교육칼럼","keywords":"키워드1, 키워드2","reason":"이 소재를 추천하는 이유 한 줄","sourceIds":[0,3]}]}'
].join('\n');

var REGION_TOPIC_SYSTEM = [
  '너는 {{과목}} 학원({{학원명}}) 마케팅 담당자를 돕는 소재 기획자야.',
  '특정 지역 수학학원 관련 네이버 블로그 검색 결과 목록(JSON, 각 항목에 index가 붙어 있음)을 받는다.',
  '목록 중 학원과 무관한 글(개인 잡담·후기성 글, 수학학원이 아닌 다른 과목 학원, 명백한 스팸)은 제외하고,',
  '실제 그 지역 수학학원들이 최근 다룬 소재를 참고해 우리 학원 블로그로 쓸 만한 주제를 만들어라.',
  '경쟁학원 사례를 그대로 베끼지 말고 우리 학원 관점으로 재구성하고, 아직 안 다뤄진 소재를 우선하라.',
  '',
  '5~8개 주제를 추천해라. 각 항목: title/blogType/keywords/reason/sourceIndexes(참고한 글의 index 배열, 0~3개)',
  'blogType은 다음 중 하나: 교육칼럼, 입시정보, 학원홍보, 합격인터뷰, 수학정보, 이벤트안내, 학원공지',
  '',
  '반드시 아래 JSON 형식으로만 응답 (다른 텍스트 금지):',
  '{"topics":[{"title":"","blogType":"교육칼럼","keywords":"","reason":"","sourceIndexes":[0]}]}'
].join('\n');

function buildNewsTopicSystem() {
  var profile = loadAcademyProfile();
  return NEWS_TOPIC_SYSTEM_TECHNICAL
    .replace(/\{\{학원명\}\}/g, profile.name || '학원')
    .replace(/\{\{과목\}\}/g, profile.subject || '수학');
}

function buildRegionTopicSystem() {
  var profile = loadAcademyProfile();
  return REGION_TOPIC_SYSTEM
    .replace(/\{\{학원명\}\}/g, profile.name || '학원')
    .replace(/\{\{과목\}\}/g, profile.subject || '수학');
}

async function newsFetchEducationNews() {
  var cfg = (typeof getNewsGasConfig === 'function') ? getNewsGasConfig() : { url: '', token: '' };
  if (!cfg.url || !cfg.token) throw new Error('서버 설정 오류(GAS 미설정)');
  var url = cfg.url + '?action=getEducationNews&token=' + encodeURIComponent(cfg.token);
  var res = await fetch(url);
  var json = await res.json();
  if (json.error) throw new Error(json.error);
  return { items: json.items || [], debug: json.debug || [] };
}

// 뉴스 기반 소재 조회+AI 정리 — 실패 시 throw, 성공 시 refs(title/link/description)까지 채운 topics 배열 반환.
async function fetchNewsTopics() {
  var fetched = await newsFetchEducationNews();
  var news = fetched.items;
  if (!news.length) throw new Error('최근 1개월 이내 교육 뉴스를 찾지 못했습니다.');

  var newsForAI = news.slice(0, 150);
  var trimmed = newsForAI.map(function(it, i) {
    return { id: i, title: it.title, description: (it.description || '').slice(0, 100), pubDate: it.pubDate };
  });

  var systemPrompt = buildNewsTopicSystem();
  var userContent = JSON.stringify(trimmed);
  var raw = await geminiProxyCall({ model: getModel('gemini'), system: systemPrompt, content: userContent, max_tokens: 3500 });
  var parsed;
  try {
    parsed = blogParseJson(raw);
  } catch (parseErr) {
    // 응답이 잘렸거나 잡담이 섞였을 가능성 → 더 큰 토큰으로 1회 재시도
    raw = await geminiProxyCall({ model: getModel('gemini'), system: systemPrompt, content: userContent, max_tokens: 8192 });
    try {
      parsed = blogParseJson(raw);
    } catch (parseErr2) {
      parsed = blogRepairJson(raw);
      if (!parsed) throw new Error('JSON 파싱 실패 — 응답 앞부분: ' + String(raw).slice(0, 200));
    }
  }
  var topics = (parsed && parsed.topics) || [];
  if (!topics.length) throw new Error('추천할 만한 주제를 찾지 못했습니다.');

  return topics.map(function(t) {
    var refs = (t.sourceIds || []).map(function(id) {
      var src = newsForAI[id];
      return src && { title: src.title, link: src.link, description: src.description };
    }).filter(Boolean);
    return { title: t.title, blogType: t.blogType, keywords: t.keywords, reason: t.reason, refs: refs };
  });
}

// 지역 트렌드 기반 소재 조회+AI 정리 — 실패 시 throw, 성공 시 refs까지 채운 topics 배열 반환.
async function fetchRegionTopics(region) {
  var items = await reportFetchRegionBlogs(region);
  if (!items.length) throw new Error('"' + region + ' 수학학원" 관련 블로그를 찾지 못했습니다.');

  var itemsForAI = items.slice(0, 100).map(function(it, i) {
    return { index: i, title: it.title, description: it.description, bloggername: it.bloggername, postdate: it.postdate };
  });

  var systemPrompt = buildRegionTopicSystem();
  var userContent = JSON.stringify(itemsForAI);
  var raw = await geminiProxyCall({ model: getModel('gemini'), system: systemPrompt, content: userContent, max_tokens: 3500 });
  var parsed;
  try {
    parsed = blogParseJson(raw);
  } catch (parseErr) {
    raw = await geminiProxyCall({ model: getModel('gemini'), system: systemPrompt, content: userContent, max_tokens: 8192 });
    try {
      parsed = blogParseJson(raw);
    } catch (parseErr2) {
      parsed = blogRepairJson(raw);
      if (!parsed) throw new Error('JSON 파싱 실패 — 응답 앞부분: ' + String(raw).slice(0, 200));
    }
  }
  var topics = (parsed && parsed.topics) || [];
  if (!topics.length) throw new Error('추천할 만한 주제를 찾지 못했습니다.');

  return topics.map(function(t) {
    var refs = (t.sourceIndexes || []).map(function(idx) {
      var src = items[idx];
      return src && { title: src.title, link: src.link, description: src.description };
    }).filter(Boolean);
    return { title: t.title, blogType: t.blogType, keywords: t.keywords, reason: t.reason, refs: refs };
  });
}

// 페이지 진입 시(showPage('blog-news')) 호출 — 프로필 없으면 등록 안내, 있으면 사용될 학원/지역을 알려줌.
function topicSuggestInit() {
  var hintEl = document.getElementById('topic-suggest-hint');
  var profile = loadAcademyProfile();
  if (!profile || !profile.name) {
    if (hintEl) hintEl.textContent = '학원 프로필이 없어 소재추천을 진행할 수 없습니다. 아래에서 먼저 등록해주세요.';
    var resultEl = document.getElementById('topic-suggest-result');
    if (resultEl) resultEl.innerHTML = topicSuggestNoProfileMessage();
    return;
  }
  var region = (typeof reportExtractRegion === 'function') ? reportExtractRegion(profile.address || '') : '';
  if (hintEl) {
    hintEl.textContent = region
      ? '"' + profile.name + '" 프로필 기준(지역: ' + region + ')으로 조회됩니다.'
      : '"' + profile.name + '" 프로필 기준으로 조회됩니다. (주소가 없어 지역 트렌드 기반은 건너뜁니다)';
  }
}

function topicSuggestNoProfileMessage() {
  return [
    '<div class="blog-card" style="text-align:center;padding:28px 16px;">',
      '<div style="font-size:14px;font-weight:700;color:var(--txt);margin-bottom:8px;">학원 프로필이 아직 등록되지 않았습니다</div>',
      '<div style="font-size:13px;color:var(--mut);line-height:1.6;margin-bottom:16px;">뉴스·지역 트렌드 기반 소재추천은 학원 프로필(학원명·주소 등)을 기준으로 동작합니다.<br>먼저 AI 글작성에서 학원 프로필을 등록해주세요.</div>',
      '<button class="btn btn-primary" onclick="showPage(\'blog\')">학원 프로필 등록하러 가기</button>',
    '</div>'
  ].join('');
}

async function topicSuggestGenerate(btn) {
  var resultEl = document.getElementById('topic-suggest-result');
  var profile = loadAcademyProfile();
  if (!profile || !profile.name) {
    if (resultEl) resultEl.innerHTML = topicSuggestNoProfileMessage();
    return;
  }

  var orig = btn.textContent;
  try {
    await useCreditConfirm('topic_suggest_combined', '소재 추천받기');
  } catch (ce) { if (!ce.cancelled) alert(ce.message || '크레딧 확인에 실패했습니다.'); return; }

  btn.disabled = true;
  btn.textContent = '⏳ 뉴스·지역 트렌드 수집 중...';
  if (resultEl) resultEl.innerHTML = '';

  var region = (typeof reportExtractRegion === 'function') ? reportExtractRegion(profile.address || '') : '';

  var newsPromise = fetchNewsTopics()
    .then(function(topics) { return { topics: topics }; })
    .catch(function(e) { return { error: e.message }; });
  var regionPromise = region
    ? fetchRegionTopics(region).then(function(topics) { return { topics: topics }; }).catch(function(e) { return { error: e.message }; })
    : Promise.resolve({ skipped: true });

  var results = await Promise.all([newsPromise, regionPromise]);
  var newsRes = results[0], regionRes = results[1];

  btn.disabled = false;
  btn.textContent = orig;

  var combined = [];
  var notes = [];
  if (newsRes.error) notes.push('뉴스 기반: ' + newsRes.error);
  else combined = combined.concat(newsRes.topics.map(function(t) {
    return { title: t.title, blogType: t.blogType, keywords: t.keywords, reason: t.reason, refs: t.refs, source: 'news' };
  }));

  if (regionRes.skipped) notes.push('지역 트렌드 기반: 학원 프로필에 주소가 등록되어 있지 않아 건너뛰었습니다.');
  else if (regionRes.error) notes.push('지역 트렌드 기반(' + region + '): ' + regionRes.error);
  else combined = combined.concat(regionRes.topics.map(function(t) {
    return { title: t.title, blogType: t.blogType, keywords: t.keywords, reason: t.reason, refs: t.refs, source: 'region' };
  }));

  if (!combined.length) {
    if (resultEl) resultEl.innerHTML = '<p style="font-size:13px;color:#ef4444;">' + notes.map(newsEsc).join('<br>') + '</p>';
    return;
  }

  await useCreditCommit('topic_suggest_combined');
  window._topicSuggestions = combined;
  topicSuggestRender(combined, notes);
}

var topicSuggestSelectedIdx = -1;

// 왼쪽 목록 — 제목 한 줄 + [뉴스]/[지역트렌드] 배지만 표시. 클릭하면 오른쪽에 상세를 띄움.
function topicSuggestRender(topics, notes) {
  window._topicSuggestions = topics;
  var resultEl = document.getElementById('topic-suggest-result');
  if (!resultEl) return;

  var noteHtml = (notes && notes.length)
    ? '<p style="font-size:12px;color:var(--mut);margin-bottom:10px;">' + notes.map(newsEsc).join('<br>') + '</p>'
    : '';

  var rows = topics.map(function(t, i) {
    var isNews = t.source === 'news';
    var isActive = i === topicSuggestSelectedIdx;
    var sourceLabel = isNews ? '뉴스' : '지역트렌드';
    var sourceBg = isNews ? 'var(--acc-light)' : '#e0f2f1';
    var sourceColor = isNews ? 'var(--acc)' : '#0f766e';
    return '<div class="news-topic-row' + (isActive ? ' is-thumb' : '') + '" onclick="topicSuggestShowDetail(' + i + ')">'
      + '<span style="background:' + sourceBg + ';color:' + sourceColor + ';font-size:10px;padding:2px 8px;border-radius:99px;font-weight:700;flex-shrink:0;">' + sourceLabel + '</span>'
      + (t.blogType ? '<span style="background:#f3f4f6;color:var(--mut);font-size:10px;padding:2px 8px;border-radius:99px;font-weight:600;flex-shrink:0;">' + newsEsc(t.blogType) + '</span>' : '')
      + '<span class="news-topic-row-title">' + newsEsc(t.title || '') + '</span>'
      + '</div>';
  }).join('');

  resultEl.innerHTML = noteHtml + '<h3 style="font-size:14px;font-weight:700;margin:0 0 10px;">추천 주제 (' + topics.length + '건)</h3>' + rows;

  topicSuggestSelectedIdx = -1;
  topicSuggestRenderDetail(null);
}

function topicSuggestShowDetail(idx) {
  topicSuggestSelectedIdx = idx;
  topicSuggestRender(window._topicSuggestions || [], null);
  topicSuggestRenderDetail((window._topicSuggestions || [])[idx], idx);
}

// 오른쪽 패널 — 선택한 주제의 키워드/추천 이유/출처 + "이 주제로 쓰기"
function topicSuggestRenderDetail(t, idx) {
  var c = document.getElementById('topic-suggest-detail');
  if (!c) return;
  if (!t) {
    c.innerHTML = '<div class="blog-card"><div style="font-size:13px;font-weight:900;color:var(--txt);margin-bottom:8px;">주제 상세</div><div style="font-size:12px;color:var(--mut);line-height:1.7;">왼쪽 목록에서 주제를 클릭하면<br>여기에 상세 내용이 표시됩니다.</div></div>';
    return;
  }

  var sources = (t.refs || []).map(function(src) {
    var desc = (src.description || '').replace(/</g, '&lt;');
    if (desc.length > 90) desc = desc.slice(0, 90) + '…';
    return '<div style="margin-top:8px;"><a href="' + (src.link || '').replace(/"/g, '&quot;') + '" target="_blank" rel="noopener" style="font-size:12px;color:var(--acc);text-decoration:underline;font-weight:600;">· ' + newsEsc(src.title || '') + '</a>'
      + (desc ? '<div style="font-size:11px;color:var(--mut);line-height:1.5;margin:2px 0 0 10px;">' + desc + '</div>' : '') + '</div>';
  }).join('');

  c.innerHTML = [
    '<div class="blog-card">',
      '<span style="background:' + (t.source === 'news' ? 'var(--acc-light)' : '#e0f2f1') + ';color:' + (t.source === 'news' ? 'var(--acc)' : '#0f766e') + ';font-size:11px;padding:2px 8px;border-radius:99px;font-weight:700;">' + (t.source === 'news' ? '뉴스' : '지역트렌드') + '</span>',
      (t.blogType ? ' <span style="background:#f3f4f6;color:var(--mut);font-size:11px;padding:2px 8px;border-radius:99px;font-weight:600;">' + newsEsc(t.blogType) + '</span>' : ''),
      '<div style="font-size:16px;font-weight:700;color:var(--txt);margin:8px 0 6px;">' + newsEsc(t.title || '') + '</div>',
      '<div style="font-size:12px;color:var(--mut);margin-bottom:10px;">' + newsEsc(t.keywords || '') + '</div>',
      '<div style="font-size:13px;color:var(--txt);line-height:1.6;margin-bottom:10px;">' + newsEsc(t.reason || '') + '</div>',
      (sources ? '<div style="font-size:11px;font-weight:700;color:var(--mut);margin-top:12px;padding-top:10px;border-top:1px solid var(--bdr);">참고 글</div>' + sources : ''),
      '<button class="btn btn-primary" style="margin-top:14px;width:100%;" onclick="topicSuggestUseSuggestion(' + idx + ')">이 주제로 쓰기</button>',
    '</div>'
  ].join('');
}

function topicSuggestUseSuggestion(idx) {
  var t = (window._topicSuggestions || [])[idx];
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

  var links = (t.refs || []).map(function(src) { return src.link; }).filter(Boolean);
  setVal('blog-ref-url', links.join('\n'));

  showPage('blog');
  showToast('주제가 채워졌습니다');
}

function newsEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
