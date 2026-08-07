// ── 뉴스 기반 블로그 소재 추천 (js/blog.js 로드 후 동작) ──────────────
// 최근 교육 뉴스를 GAS(getEducationNews)로 가져온 뒤, Gemini(geminiProxy)로
// 중복 소재를 제외하고 블로그 작성 주제를 추천한다. blogtab-news 탭에서 동작.

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
    return '<div style="font-size:12px;color:var(--mut);margin-top:4px;">· <a href="' + src.link.replace(/"/g,'&quot;') + '" target="_blank" rel="noopener" style="color:var(--acc);text-decoration:underline;">' + (src.title || '').replace(/</g,'&lt;') + '</a></div>';
  }).join('');

  c.innerHTML = [
    '<div class="blog-card">',
      (t.blogType ? '<span style="background:var(--acc-light);color:var(--acc);font-size:11px;padding:2px 8px;border-radius:99px;font-weight:600;">' + t.blogType.replace(/</g,'&lt;') + '</span>' : ''),
      '<div style="font-size:16px;font-weight:700;color:var(--txt);margin:8px 0 6px;">' + (t.title || '').replace(/</g,'&lt;') + '</div>',
      '<div style="font-size:12px;color:var(--mut);margin-bottom:10px;">' + (t.keywords || '').replace(/</g,'&lt;') + '</div>',
      '<div style="font-size:13px;color:var(--txt);line-height:1.6;margin-bottom:10px;">' + (t.reason || '').replace(/</g,'&lt;') + '</div>',
      sources,
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
