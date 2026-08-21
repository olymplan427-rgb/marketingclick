// ── 지역 트렌드 리포트 (지역 경쟁학원 블로그 분석) ────────────────────────
// 우리 학원이 속한 구/동을 기준으로 "{지역} 수학학원" 네이버 블로그를 모아
// ① 언급량 추이(월별 건수 — AI 없이 직접 집계) ② 주요 발화 학원 프로필
// ③ 콘텐츠 패턴 ④ 시사점 ⑤ 블로그 주제 추천 순으로 정리한다.
// 숫자 집계는 할루시네이션 위험이 있는 AI에 맡기지 않고 원본 데이터에서 직접 계산한다.

var REPORT_SYSTEM_TECHNICAL = [
  '너는 {{과목}} 학원({{학원명}}) 마케팅 담당자를 돕는 경쟁학원 분석가야.',
  '특정 지역 수학학원 관련 네이버 블로그 검색 결과(JSON 목록)를 받는다. 각 항목엔 index가 붙어 있다.',
  '목록 중 학원과 무관한 글(개인 잡담·후기성 글, 수학학원이 아닌 다른 과목 학원, 명백한 스팸)은 분석에서 제외하고,',
  '실제 그 지역 수학학원들의 운영·마케팅 콘텐츠만 대상으로 아래 4가지를 정리해라.',
  '',
  '1. brands: 반복적으로 등장하는 학원/브랜드별 프로필. 같은 학원의 여러 글을 종합해서 그 학원이',
  '   어떤 컨셉·톤·소재로 블로그를 운영하는지 2~3문장으로 요약해라(단순 글 목록 나열 금지, 종합 분석).',
  '   각 항목: name(학원명), summary(종합 요약), sourceIndexes(근거가 된 index 배열, 최대 5개)',
  '2. patterns: 전체 데이터에서 공통으로 관찰되는 콘텐츠 포맷/전략 패턴 3~5개',
  '   (예: 학교별 시험 분석형, 학부모 후기형, 인접 지역 해시태그 확장 전략 등).',
  '   각 항목: label(패턴명), description(구체적 설명, 1~2문장)',
  '3. insights: 위 분석을 바탕으로 우리 학원이 참고할 만한 전략적 시사점 2~4개(각 1~2문장, 문자열 배열)',
  '4. topics: 위 분석을 바탕으로 우리 학원이 쓸 만한 블로그 주제 5~8개.',
  '   경쟁학원 사례를 참고하되 그대로 베끼지 말고 우리 학원 관점으로 재구성하고, 아직 안 다뤄진 소재를 우선하라.',
  '   각 항목: title/blogType/keywords/reason/sourceIndexes(참고 index 배열, 0~3개)',
  '   blogType은 다음 중 하나: 교육칼럼, 입시정보, 학원홍보, 합격인터뷰, 수학정보, 이벤트안내, 학원공지',
  '',
  '응답 길이 제한이 있으니 brands는 최대 8개, patterns는 최대 5개까지만 — 전부 간결하게 작성해라.',
  '반드시 아래 JSON 형식으로만 응답 (다른 텍스트 금지):',
  '{"brands":[{"name":"","summary":"","sourceIndexes":[0]}],"patterns":[{"label":"","description":""}],"insights":[""],"topics":[{"title":"","blogType":"교육칼럼","keywords":"","reason":"","sourceIndexes":[0]}]}'
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
// 입력창은 항상 수정 가능하게 열어둔다(reportInit의 hint 참고). 시/도 접두어는
// 붙이지 않음 — 검색 시 AND 조건이 좁아져 최신 글이 걸러지는 문제가 실측으로 확인됨.
function reportExtractRegion(address) {
  if (!address) return '';
  var tokens = address.trim().split(/\s+/).slice(0, 4);
  var guIdx = -1, siIdx = -1;
  tokens.forEach(function(t, i) {
    if (/[가-힣]+[구군]$/.test(t)) guIdx = i;
    else if (siIdx === -1 && /[가-힣]+시$/.test(t)) siIdx = i;
  });
  var idx = guIdx !== -1 ? guIdx : siIdx;
  return idx === -1 ? '' : tokens[idx];
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

// AI에 맡기지 않고 원본 postdate에서 월별 건수를 직접 집계 — 숫자 정확도 보장.
// 오래된→최신 순으로 반환하고, 이번 달은 "(오늘까지)" 표시를 붙여 부분 집계임을 알림.
function reportComputeMonthlyTrend(items) {
  var counts = {};
  items.forEach(function(it) {
    if (!it.postdate || it.postdate.length !== 8) return;
    var m = it.postdate.slice(0, 4) + '.' + it.postdate.slice(4, 6);
    counts[m] = (counts[m] || 0) + 1;
  });
  var now = new Date();
  var thisMonth = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0');
  return Object.keys(counts).sort().map(function(m) {
    return { month: m, count: counts[m], partial: m === thisMonth };
  });
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
      if (resultEl) resultEl.innerHTML = '<p style="font-size:14px;color:var(--txt);">최근 3개월 내 "' + reportEsc(region) + ' 수학학원" 관련 블로그를 찾지 못했습니다.</p>';
      return;
    }

    var trend = reportComputeMonthlyTrend(items);

    btn.textContent = '⏳ AI가 정리 중...';
    var itemsForAI = items.slice(0, 100).map(function(it, i) {
      return { index: i, title: it.title, description: it.description, bloggername: it.bloggername, postdate: it.postdate };
    });

    var raw = await geminiProxyCall({ model: getModel('gemini'), system: buildReportSystem(), content: JSON.stringify(itemsForAI), max_tokens: 8000 });
    var parsed;
    try {
      parsed = blogParseJson(raw);
    } catch (parseErr) {
      // 응답이 max_tokens에 걸려 중간에 잘렸을 가능성 — 잘린 JSON 복구를 한 번 더 시도
      parsed = (typeof blogRepairJson === 'function') ? blogRepairJson(raw) : null;
      if (!parsed) throw new Error('JSON 파싱 실패 — 콘솔(F12)에서 원본 응답 확인. 앞부분: ' + String(raw).slice(0, 200));
    }
    var brands = (parsed && parsed.brands) || [];
    var patterns = (parsed && parsed.patterns) || [];
    var insights = (parsed && parsed.insights) || [];
    var topics = (parsed && parsed.topics) || [];
    if (!brands.length && !patterns.length && !topics.length) { alert('정리할 만한 내용을 찾지 못했습니다.'); return; }

    window._reportItems = items;
    reportRender(region, trend, brands, patterns, insights, topics);
  } catch (e) {
    alert('리포트 생성 실패: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}

function reportSourceLinks(sourceIndexes) {
  return (sourceIndexes || []).map(function(idx) {
    var src = window._reportItems[idx];
    if (!src) return '';
    return '<div style="font-size:12.5px;color:var(--txt);margin-top:4px;">· <a href="' + reportEsc(src.link) + '" target="_blank" rel="noopener" style="color:var(--acc);font-weight:700;text-decoration:underline;">' + reportEsc(src.title || '') + '</a></div>';
  }).join('');
}

function reportRender(region, trend, brands, patterns, insights, topics) {
  var resultEl = document.getElementById('report-result');
  if (!resultEl) return;

  var trendRows = trend.map(function(t) {
    return '<tr><td style="padding:6px 10px;border-bottom:1px solid var(--bdr);font-weight:600;">' + reportEsc(t.month) + (t.partial ? ' (오늘까지)' : '') + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid var(--bdr);text-align:right;font-weight:800;">' + t.count + '건</td></tr>';
  }).join('');
  var trendSection = trend.length
    ? '<table style="width:100%;font-size:14px;color:var(--txt);border-collapse:collapse;margin-bottom:8px;">' + trendRows + '</table>'
    : '<p style="font-size:14px;color:var(--txt);">집계할 게시글이 없습니다.</p>';

  var brandCards = brands.map(function(b) {
    return '' +
      '<div class="blog-copy-section">' +
        '<div class="blog-copy-header"><span style="font-size:14px;font-weight:800;color:var(--txt);">' + reportEsc(b.name || '이름 미상') + '</span></div>' +
        '<div class="blog-copy-content">' + reportEsc(b.summary || '') + reportSourceLinks(b.sourceIndexes) + '</div>' +
      '</div>';
  }).join('');

  var patternCards = patterns.map(function(p) {
    return '' +
      '<div class="blog-copy-section">' +
        '<div class="blog-copy-header"><span style="font-size:14px;font-weight:800;color:var(--txt);">' + reportEsc(p.label || '') + '</span></div>' +
        '<div class="blog-copy-content">' + reportEsc(p.description || '') + '</div>' +
      '</div>';
  }).join('');

  var insightList = insights.length
    ? '<ul style="margin:0;padding-left:20px;font-size:14px;color:var(--txt);line-height:1.9;">' +
        insights.map(function(i) { return '<li>' + reportEsc(i) + '</li>'; }).join('') +
      '</ul>'
    : '';

  var topicCards = topics.map(function(t, i) {
    return [
      '<div class="blog-card" style="margin-bottom:10px;">',
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">',
          '<div style="flex:1;">',
            '<span style="background:var(--acc-light);color:var(--acc);font-size:12px;font-weight:800;padding:2px 8px;border-radius:99px;">' + reportEsc(t.blogType || '') + '</span>',
            '<div style="font-size:16px;font-weight:800;color:var(--txt);margin:6px 0 4px;">' + reportEsc(t.title || '') + '</div>',
            '<div style="font-size:13px;color:var(--txt);font-weight:600;margin-bottom:6px;">' + reportEsc(t.keywords || '') + '</div>',
            '<div style="font-size:13px;color:var(--txt);">' + reportEsc(t.reason || '') + '</div>',
            reportSourceLinks(t.sourceIndexes),
          '</div>',
          '<button class="btn btn-primary" style="white-space:nowrap;" onclick="reportUseTopicSuggestion(' + i + ')">이 주제로 쓰기</button>',
        '</div>',
      '</div>'
    ].join('');
  }).join('');

  function section(title, body) {
    return '<div style="margin-bottom:20px;"><div style="font-size:15px;font-weight:900;color:var(--txt);margin-bottom:8px;">' + title + '</div>' + body + '</div>';
  }

  resultEl.innerHTML =
    '<div style="font-size:16px;font-weight:900;color:var(--txt);margin-bottom:16px;">' + reportEsc(region) + ' 수학학원 현황 (최근 3개월)</div>' +
    section('① 언급량 추이 (네이버 블로그, 월별)', trendSection) +
    section('② 자주 언급되는 학원 (' + brands.length + '건)', brandCards || '<p style="font-size:14px;color:var(--txt);">식별된 학원이 없습니다.</p>') +
    section('③ 콘텐츠 패턴', patternCards || '<p style="font-size:14px;color:var(--txt);">특별한 패턴이 발견되지 않았습니다.</p>') +
    section('④ 시사점', insightList || '<p style="font-size:14px;color:var(--txt);">-</p>') +
    section('⑤ 추천 블로그 주제 (' + topics.length + '건)', topicCards);
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
