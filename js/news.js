// ── AI 소재추천 (js/blog.js 로드 후 동작, blogtab-news 탭) ──────────────
// 두 소스를 토글로 전환: ① 뉴스 기반 — 최근 교육 뉴스를 GAS(getEducationNews)로 가져온 뒤
// Gemini(geminiProxy)로 중복 소재를 제외하고 블로그 주제를 추천. ② 지역 트렌드 기반(2026-09-03) —
// js/report.js의 reportFetchRegionBlogs를 그대로 재사용해 "{지역} 수학학원" 네이버 블로그를
// 독립적으로 수집한 뒤, 지역 트렌드 리포트보다 가벼운 단일 AI 호출로 주제만 추천한다
// (리포트는 언급량/프로필/패턴/시사점까지 무거운 맵-리듀스 분석이 필요하지만, 여긴 주제만 필요해서
// news.js의 뉴스 기반 소재추천과 동일하게 단일 호출로 충분 — 캐시나 리포트 생성 선행 없이 즉시 동작).

function newsShowSource(source) {
  var isNews = source === 'news';
  document.getElementById('news-source-news').style.display = isNews ? '' : 'none';
  document.getElementById('news-source-region').style.display = isNews ? 'none' : '';
  document.getElementById('news-source-btn-news').classList.toggle('active', isNews);
  document.getElementById('news-source-btn-region').classList.toggle('active', !isNews);
  if (!isNews) regionTopicsInit();
}

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

function buildNewsTopicSystem() {
  var profile = loadAcademyProfile();
  return NEWS_TOPIC_SYSTEM_TECHNICAL
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

async function newsCallGemini(systemPrompt, userContent, maxTokens) {
  return geminiProxyCall({ model: getModel('gemini'), system: systemPrompt, content: userContent, max_tokens: maxTokens || 3500 });
}

// 뉴스 소재 정리는 무조건 Gemini만 사용 — Claude는 시도하지 않는다.
// Gemini 쪽(geminiProxy → GEMINI_MODEL_FALLBACK)이 무료 상위 모델부터 순차적으로 폴백한다.
async function newsGenerateTopics(systemPrompt, userContent, maxTokens) {
  return newsCallGemini(systemPrompt, userContent, maxTokens);
}

async function newsSuggestTopics(btn) {
  var resultEl = document.getElementById('news-result');
  var cfg = (typeof getNewsGasConfig === 'function') ? getNewsGasConfig() : { url: '', token: '' };
  if (!cfg.url || !cfg.token) { alert('서버 설정 오류(GAS 미설정)'); return; }

  var orig = btn.textContent;
  try {
    await useCreditConfirm('news_search', '기사검색 주제 추천');
  } catch (ce) { if (!ce.cancelled) alert(ce.message || '크레딧 확인에 실패했습니다.'); return; }

  btn.disabled = true;
  btn.textContent = '⏳ 뉴스 수집 중...';
  if (resultEl) resultEl.innerHTML = '';

  try {
    var fetched = await newsFetchEducationNews();
    var news = fetched.items;

    if (!news.length) {
      if (resultEl) resultEl.innerHTML = newsRenderDebug(fetched.debug);
      return;
    }

    btn.textContent = '⏳ AI가 주제 정리 중...';

    var newsForAI = news.slice(0, 150);
    var trimmed = newsForAI.map(function(it, i) {
      return { id: i, title: it.title, description: (it.description || '').slice(0, 100), pubDate: it.pubDate };
    });

    var systemPrompt = buildNewsTopicSystem();
    var userContent = JSON.stringify(trimmed);
    var raw = await newsGenerateTopics(systemPrompt, userContent, 3500);
    var parsed;
    try {
      parsed = blogParseJson(raw);
    } catch (parseErr) {
      // 응답이 잘렸거나 잡담이 섞였을 가능성 → 더 큰 토큰으로 1회 재시도
      raw = await newsGenerateTopics(systemPrompt, userContent, 8192);
      try {
        parsed = blogParseJson(raw);
      } catch (parseErr2) {
        // 재시도도 실패 → 잘린 JSON 복구 시도 (최후의 안전망)
        parsed = blogRepairJson(raw);
        if (!parsed) throw new Error('JSON 파싱 실패 — 응답 앞부분: ' + String(raw).slice(0, 200));
      }
    }
    var topics = (parsed && parsed.topics) || [];
    if (!topics.length) { alert('추천할 만한 주제를 찾지 못했습니다.'); return; }

    await useCreditCommit('news_search');
    window._newsRaw = newsForAI;
    newsRenderTopicSuggestions(topics);
  } catch (e) {
    alert('주제 추천 실패: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}

// GAS에서 뉴스를 하나도 못 가져왔을 때 원인 진단용 표 (쿼리별 응답 상태)
function newsRenderDebug(debug) {
  if (!debug || !debug.length) {
    return '<p style="font-size:13px;color:#ef4444;">최근 1개월 이내 교육 뉴스를 찾지 못했습니다. (GAS가 debug 정보를 반환하지 않음 — 배포된 스크립트가 최신 버전인지 확인해 주세요)</p>';
  }
  var rows = debug.map(function(d) {
    var status;
    if (d.error) status = '<span style="color:#ef4444;">오류: ' + d.error.replace(/</g,'&lt;') + '</span>';
    else if (d.status !== 200) status = '<span style="color:#ef4444;">HTTP ' + d.status + ' — ' + (d.body || '').replace(/</g,'&lt;') + '</span>';
    else status = '원본 ' + d.raw + '건 → 최근 1개월 필터 후 ' + d.kept + '건';
    return '<tr><td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;">' + d.query + '</td><td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;">' + status + '</td></tr>';
  }).join('');
  return [
    '<p style="font-size:13px;color:#ef4444;margin-bottom:10px;">최근 1개월 이내 교육 뉴스를 찾지 못했습니다. 아래는 쿼리별 응답 내역입니다.</p>',
    '<p style="font-size:12px;color:var(--mut);margin-bottom:10px;">모든 쿼리가 HTTP 401/403이라면 관리자가 GAS에 NAVER_CLIENT_ID/SECRET을 아직 설정하지 않은 것입니다.</p>',
    '<table style="width:100%;font-size:12px;border-collapse:collapse;">' + rows + '</table>'
  ].join('');
}

var newsSelectedIdx = -1;

// 왼쪽 목록 — 제목만 표시 (블로그 히스토리 탭과 동일한 리스트+상세 패턴)
function newsRenderTopicSuggestions(topics) {
  window._newsTopicSuggestions = topics;
  var resultEl = document.getElementById('news-result');
  if (!resultEl) return;

  var rows = topics.map(function(t, i) {
    var isActive = i === newsSelectedIdx;
    return '<div class="blog-card' + (isActive ? ' is-thumb' : '') + '" style="cursor:pointer;padding:10px 12px;margin-bottom:8px;" onclick="newsShowTopicDetail(' + i + ')">'
      + (t.blogType ? '<div style="margin-bottom:4px;"><span style="background:var(--acc-light);color:var(--acc);font-size:10px;padding:2px 8px;border-radius:99px;font-weight:600;">' + t.blogType.replace(/</g,'&lt;') + '</span></div>' : '')
      + '<div style="font-size:13px;font-weight:700;color:var(--txt);line-height:1.4;">' + (t.title || '').replace(/</g,'&lt;') + '</div>'
      + '</div>';
  }).join('');

  resultEl.innerHTML = '<h3 style="font-size:15px;font-weight:700;margin:0 0 12px;">추천 주제 (' + topics.length + '건)</h3>' + rows;

  newsSelectedIdx = -1;
  newsRenderTopicDetail(null);
}

function newsShowTopicDetail(idx) {
  newsSelectedIdx = idx;
  newsRenderTopicSuggestions(window._newsTopicSuggestions || []);
  newsRenderTopicDetail((window._newsTopicSuggestions || [])[idx], idx);
}

// 오른쪽 패널 — 선택한 주제의 키워드/추천 이유/출처 뉴스 + "이 주제로 쓰기"
function newsRenderTopicDetail(t, idx) {
  var c = document.getElementById('news-detail');
  if (!c) return;
  if (!t) {
    c.innerHTML = '<div class="blog-card"><div style="font-size:13px;font-weight:900;color:var(--txt);margin-bottom:8px;">주제 상세</div><div style="font-size:12px;color:var(--mut);line-height:1.7;">왼쪽 목록에서 주제를 클릭하면<br>여기에 상세 내용이 표시됩니다.</div></div>';
    return;
  }
  var newsRaw = window._newsRaw || [];
  var sources = (t.sourceIds || []).map(function(id) {
    var src = newsRaw[id];
    if (!src) return '';
    var desc = (src.description || '').replace(/</g,'&lt;');
    if (desc.length > 90) desc = desc.slice(0, 90) + '…';
    return [
      '<div style="margin-top:8px;">',
        '<a href="' + src.link.replace(/"/g,'&quot;') + '" target="_blank" rel="noopener" style="font-size:12px;color:var(--acc);text-decoration:underline;font-weight:600;">· ' + (src.title || '').replace(/</g,'&lt;') + '</a>',
        (desc ? '<div style="font-size:11px;color:var(--mut);line-height:1.5;margin:2px 0 0 10px;">' + desc + '</div>' : ''),
      '</div>'
    ].join('');
  }).join('');

  c.innerHTML = [
    '<div class="blog-card">',
      (t.blogType ? '<span style="background:var(--acc-light);color:var(--acc);font-size:11px;padding:2px 8px;border-radius:99px;font-weight:600;">' + t.blogType.replace(/</g,'&lt;') + '</span>' : ''),
      '<div style="font-size:16px;font-weight:700;color:var(--txt);margin:8px 0 6px;">' + (t.title || '').replace(/</g,'&lt;') + '</div>',
      '<div style="font-size:12px;color:var(--mut);margin-bottom:10px;">' + (t.keywords || '').replace(/</g,'&lt;') + '</div>',
      '<div style="font-size:13px;color:var(--txt);line-height:1.6;margin-bottom:10px;">' + (t.reason || '').replace(/</g,'&lt;') + '</div>',
      (sources ? '<div style="font-size:11px;font-weight:700;color:var(--mut);margin-top:12px;padding-top:10px;border-top:1px solid var(--bdr);">참고 기사</div>' + sources : ''),
      '<button class="btn btn-primary" style="margin-top:14px;width:100%;" onclick="newsUseTopicSuggestion(' + idx + ')">이 주제로 쓰기</button>',
    '</div>'
  ].join('');
}

function newsUseTopicSuggestion(idx) {
  var t = (window._newsTopicSuggestions || [])[idx];
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

  var newsRaw = window._newsRaw || [];
  var links = (t.sourceIds || []).map(function(id) { return newsRaw[id] && newsRaw[id].link; }).filter(Boolean);
  setVal('blog-ref-url', links.join('\n'));

  showPage('blog');
  showToast('주제가 채워졌습니다');
}

function newsEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// ── 지역 트렌드 기반 소재추천 (report.js의 reportFetchRegionBlogs/reportExtractRegion 재사용) ──

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

function buildRegionTopicSystem() {
  var profile = loadAcademyProfile();
  return REGION_TOPIC_SYSTEM
    .replace(/\{\{학원명\}\}/g, profile.name || '학원')
    .replace(/\{\{과목\}\}/g, profile.subject || '수학');
}

function regionTopicsInit() {
  var input = document.getElementById('region-topic-region');
  if (!input || input._inited) return;
  input._inited = true;
  var profile = loadAcademyProfile();
  var region = (typeof reportExtractRegion === 'function') ? reportExtractRegion(profile.address || '') : '';
  input.value = region;
  var hintEl = document.getElementById('region-topic-hint');
  if (hintEl) {
    hintEl.textContent = region
      ? '학원 프로필 주소에서 자동으로 추출했습니다. 필요하면 직접 수정하세요.'
      : '학원 프로필에 주소가 없어 자동 추출하지 못했습니다. 지역명을 직접 입력해주세요.';
  }
}

var regionTopicSelectedIdx = -1;

async function regionTopicsGenerate(btn) {
  var regionInput = document.getElementById('region-topic-region');
  var resultEl = document.getElementById('region-topic-result');
  var region = regionInput ? regionInput.value.trim() : '';
  if (!region) { alert('지역을 입력해주세요'); return; }

  var orig = btn.textContent;
  try {
    await useCreditConfirm('region_topic_search', '지역 트렌드 기반 소재추천');
  } catch (ce) { if (!ce.cancelled) alert(ce.message || '크레딧 확인에 실패했습니다.'); return; }

  btn.disabled = true;
  btn.textContent = '⏳ 블로그 수집 중...';
  if (resultEl) resultEl.innerHTML = '';
  regionTopicSelectedIdx = -1;
  regionTopicsRenderDetail(null);

  try {
    var items = await reportFetchRegionBlogs(region);
    if (!items.length) {
      if (resultEl) resultEl.innerHTML = '<p style="font-size:14px;color:var(--txt);">"' + newsEsc(region) + ' 수학학원" 관련 블로그를 찾지 못했습니다.</p>';
      return;
    }

    btn.textContent = '⏳ AI가 주제 정리 중...';
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
    if (!topics.length) { alert('추천할 만한 주제를 찾지 못했습니다.'); return; }

    await useCreditCommit('region_topic_search');
    window._regionTopicItems = items;
    regionTopicsRenderList(topics);
  } catch (e) {
    alert('주제 추천 실패: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}

function regionTopicsRenderList(topics) {
  window._regionTopics = topics;
  var resultEl = document.getElementById('region-topic-result');
  if (!resultEl) return;

  var rows = topics.map(function(t, i) {
    var isActive = i === regionTopicSelectedIdx;
    return '<div class="blog-card' + (isActive ? ' is-thumb' : '') + '" style="cursor:pointer;padding:10px 12px;margin-bottom:8px;" onclick="regionTopicsShowDetail(' + i + ')">'
      + (t.blogType ? '<div style="margin-bottom:4px;"><span style="background:var(--acc-light);color:var(--acc);font-size:10px;padding:2px 8px;border-radius:99px;font-weight:600;">' + newsEsc(t.blogType) + '</span></div>' : '')
      + '<div style="font-size:13px;font-weight:700;color:var(--txt);line-height:1.4;">' + newsEsc(t.title || '') + '</div>'
      + '</div>';
  }).join('');

  resultEl.innerHTML = '<h3 style="font-size:15px;font-weight:700;margin:0 0 12px;">추천 주제 (' + topics.length + '건)</h3>' + rows;
  regionTopicSelectedIdx = -1;
  regionTopicsRenderDetail(null);
}

function regionTopicsShowDetail(idx) {
  regionTopicSelectedIdx = idx;
  regionTopicsRenderList(window._regionTopics || []);
  regionTopicsRenderDetail((window._regionTopics || [])[idx], idx);
}

function regionTopicsRenderDetail(t, idx) {
  var c = document.getElementById('region-topic-detail');
  if (!c) return;
  if (!t) {
    c.innerHTML = '<div class="blog-card"><div style="font-size:13px;font-weight:900;color:var(--txt);margin-bottom:8px;">주제 상세</div><div style="font-size:12px;color:var(--mut);line-height:1.7;">왼쪽 목록에서 주제를 클릭하면<br>여기에 상세 내용이 표시됩니다.</div></div>';
    return;
  }
  var rawItems = window._regionTopicItems || [];
  var sources = (t.sourceIndexes || []).map(function(idx2) {
    var src = rawItems[idx2];
    if (!src) return '';
    var desc = (src.description || '').replace(/</g, '&lt;');
    if (desc.length > 90) desc = desc.slice(0, 90) + '…';
    return [
      '<div style="margin-top:8px;">',
        '<a href="' + (src.link || '').replace(/"/g, '&quot;') + '" target="_blank" rel="noopener" style="font-size:12px;color:var(--acc);text-decoration:underline;font-weight:600;">· ' + newsEsc(src.title || '') + '</a>',
        (desc ? '<div style="font-size:11px;color:var(--mut);line-height:1.5;margin:2px 0 0 10px;">' + desc + '</div>' : ''),
      '</div>'
    ].join('');
  }).join('');

  c.innerHTML = [
    '<div class="blog-card">',
      (t.blogType ? '<span style="background:var(--acc-light);color:var(--acc);font-size:11px;padding:2px 8px;border-radius:99px;font-weight:600;">' + newsEsc(t.blogType) + '</span>' : ''),
      '<div style="font-size:16px;font-weight:700;color:var(--txt);margin:8px 0 6px;">' + newsEsc(t.title || '') + '</div>',
      '<div style="font-size:12px;color:var(--mut);margin-bottom:10px;">' + newsEsc(t.keywords || '') + '</div>',
      '<div style="font-size:13px;color:var(--txt);line-height:1.6;margin-bottom:10px;">' + newsEsc(t.reason || '') + '</div>',
      (sources ? '<div style="font-size:11px;font-weight:700;color:var(--mut);margin-top:12px;padding-top:10px;border-top:1px solid var(--bdr);">참고 글</div>' + sources : ''),
      '<button class="btn btn-primary" style="margin-top:14px;width:100%;" onclick="regionTopicsUseSuggestion(' + idx + ')">이 주제로 쓰기</button>',
    '</div>'
  ].join('');
}

function regionTopicsUseSuggestion(idx) {
  var t = (window._regionTopics || [])[idx];
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

  var rawItems = window._regionTopicItems || [];
  var links = (t.sourceIndexes || []).map(function(idx2) { return rawItems[idx2] && rawItems[idx2].link; }).filter(Boolean);
  setVal('blog-ref-url', links.join('\n'));

  showPage('blog');
  showToast('주제가 채워졌습니다');
}
