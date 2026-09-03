// ── 지역 트렌드 리포트 (지역 경쟁학원 블로그 분석) ────────────────────────
// 우리 학원이 속한 구/동을 기준으로 "{지역} 수학학원" 네이버 블로그를 모아
// ① 언급량 추이(월별 건수 — AI 없이 직접 집계) ② 주요 발화 학원 프로필
// ③ 콘텐츠 패턴 ④ 시사점 순으로 정리한다. 숫자 집계는 할루시네이션 위험이
// 있는 AI에 맡기지 않고 원본 데이터에서 직접 계산한다.
// 블로그 주제 추천은 2026-09-03부로 AI 소재추천(js/news.js, regionTopics*)으로
// 이관됨 — 이 리포트는 순수 동향 분석에만 집중. reportFetchRegionBlogs는
// news.js의 지역 트렌드 기반 소재추천에서도 재사용(각자 독립적으로 호출).

// 100개 게시글을 한 번의 AI 호출로 다 분석하면(응답까지 길게 요구) Vercel 릴레이의 실행시간 제한을
// 넘겨 타임아웃(524)이 나는 문제가 실측으로 확인되어, 맵-리듀스로 나눔(2026-09-01):
// ① MAP — REPORT_CHUNK_SIZE개씩 나눠 묶음별로 학원 프로필/패턴 후보만 가볍게 추출(호출 여러 번, 각각은 작아서 빠름)
// ② REDUCE — 묶음별 후보들(원본 블로그 글이 아니라 이미 요약된 소량 데이터)을 모아 중복 병합 + 시사점까지 최종 정리
// 데이터 100개·응답 분량·thinking 전부 원래대로 유지 — 품질 저하 없이 호출 하나당 처리량만 줄이는 방식.
var REPORT_CHUNK_SIZE = 20;

var REPORT_SYSTEM_MAP = [
  '너는 {{과목}} 학원({{학원명}}) 마케팅 담당자를 돕는 경쟁학원 분석가야.',
  '특정 지역 수학학원 관련 네이버 블로그 검색 결과 중 한 묶음(전체의 일부, JSON 목록)을 받는다. 각 항목엔 index가 붙어 있다.',
  '목록 중 학원과 무관한 글(개인 잡담·후기성 글, 수학학원이 아닌 다른 과목 학원, 명백한 스팸)은 제외하고,',
  '실제 그 지역 수학학원들의 운영·마케팅 콘텐츠만 대상으로 아래를 정리해라.',
  '이 묶음은 전체 데이터의 일부일 뿐이니, 여기 없다고 해서 다른 묶음에도 없다고 단정하지 마라.',
  '',
  '1. brands: 이 묶음에서 반복 등장하는 학원/브랜드별 프로필. 같은 학원의 여러 글을 종합해서 그 학원이',
  '   어떤 컨셉·톤·소재로 블로그를 운영하는지 2~3문장으로 요약해라(단순 글 목록 나열 금지, 종합 분석).',
  '   각 항목: name(학원명), summary(종합 요약), sourceIndexes(근거가 된 index 배열, 최대 5개)',
  '2. patterns: 이 묶음에서 관찰되는 콘텐츠 포맷/전략 패턴 1~3개',
  '   (예: 학교별 시험 분석형, 학부모 후기형, 인접 지역 해시태그 확장 전략 등).',
  '   각 항목: label(패턴명), description(구체적 설명, 1~2문장)',
  '',
  '반드시 아래 JSON 형식으로만 응답 (다른 텍스트 금지):',
  '{"brands":[{"name":"","summary":"","sourceIndexes":[0]}],"patterns":[{"label":"","description":""}]}'
].join('\n');

var REPORT_SYSTEM_REDUCE = [
  '너는 {{과목}} 학원({{학원명}}) 마케팅 담당자를 돕는 경쟁학원 분석가야.',
  '여러 묶음으로 나눠 1차 분석한 학원 프로필 후보 목록과 콘텐츠 패턴 후보 목록(JSON)을 받는다.',
  '같은 학원이 여러 묶음에서 중복으로 등장할 수 있고, 비슷한 패턴도 표현만 다르게 여러 번 나올 수 있다.',
  '이걸 바탕으로 아래 4가지 최종 리포트를 정리해라.',
  '',
  '1. brands: 후보들을 학원명 기준으로 병합·중복제거하고, 여러 묶음의 요약을 종합해 2~3문장으로 다시 작성해라.',
  '   sourceIndexes도 합쳐서 최대 5개까지(중복 제거). 최대 8개 학원까지만.',
  '2. patterns: 후보 패턴 중 유사한 것끼리 통합해서 공통 패턴 3~5개로 정리해라.',
  '   각 항목: label(패턴명), description(구체적 설명, 1~2문장)',
  '3. insights: 위 학원 프로필·패턴을 바탕으로 우리 학원이 참고할 만한 전략적 시사점 2~4개(각 1~2문장, 문자열 배열)',
  '',
  '반드시 아래 JSON 형식으로만 응답 (다른 텍스트 금지):',
  '{"brands":[{"name":"","summary":"","sourceIndexes":[0]}],"patterns":[{"label":"","description":""}],"insights":[""]}'
].join('\n');

function reportFillPlaceholders(template) {
  var profile = loadAcademyProfile();
  return template
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
  try {
    await useCreditConfirm('report_generate', '지역 트렌드 리포트 생성');
  } catch (ce) { if (!ce.cancelled) alert(ce.message || '크레딧 확인에 실패했습니다.'); return; }

  btn.disabled = true;
  btn.textContent = '⏳ 블로그 수집 중...';
  if (resultEl) resultEl.innerHTML = '';

  try {
    var items = await reportFetchRegionBlogs(region);
    if (!items.length) {
      if (resultEl) resultEl.innerHTML = '<p style="font-size:14px;color:var(--txt);">"' + reportEsc(region) + ' 수학학원" 관련 블로그를 찾지 못했습니다.</p>';
      return;
    }

    var trend = reportComputeMonthlyTrend(items);

    var itemsForAI = items.slice(0, 100).map(function(it, i) {
      return { index: i, title: it.title, description: it.description, bloggername: it.bloggername, postdate: it.postdate };
    });
    var chunks = [];
    for (var ci = 0; ci < itemsForAI.length; ci += REPORT_CHUNK_SIZE) chunks.push(itemsForAI.slice(ci, ci + REPORT_CHUNK_SIZE));

    var mapSystem = reportFillPlaceholders(REPORT_SYSTEM_MAP);
    var partials = [];
    var failedChunks = 0;
    for (var i = 0; i < chunks.length; i++) {
      btn.textContent = '⏳ AI가 정리 중... (' + (i + 1) + '/' + chunks.length + ')';
      // 묶음 하나가 일시적으로 느려지거나(Gemini 쪽 드문 지연) 실패해도 전체 리포트를 중단시키지
      // 않도록, 한 번 재시도 후에도 안 되면 그 묶음만 건너뛴다(2026-09-01, 실측: 20개 묶음 4개는
      // 16~18초로 정상이었는데 나머지 하나가 50초 넘게 지연되어 전체가 죽는 문제 확인).
      var parsedChunk = null;
      for (var attempt = 0; attempt < 2 && !parsedChunk; attempt++) {
        try {
          var rawChunk = await geminiProxyCall({ model: getModel('gemini'), system: mapSystem, content: JSON.stringify(chunks[i]), max_tokens: 3000 });
          parsedChunk = reportParseJsonSafe(rawChunk);
        } catch (chunkErr) {
          console.warn('리포트 묶음 ' + (i + 1) + ' 분석 실패(시도 ' + (attempt + 1) + '):', chunkErr.message);
        }
      }
      if (parsedChunk) partials.push(parsedChunk);
      else failedChunks++;
    }
    if (!partials.length) throw new Error('묶음별 1차 분석에 전부 실패했습니다 — 콘솔(F12)에서 원본 응답 확인.');
    if (failedChunks) showToast(failedChunks + '개 묶음은 응답 지연으로 제외하고 나머지로 리포트를 만듭니다');

    var reduceInput = {
      brands: [].concat.apply([], partials.map(function(p) { return p.brands || []; })),
      patterns: [].concat.apply([], partials.map(function(p) { return p.patterns || []; }))
    };
    btn.textContent = '⏳ 최종 정리 중...';
    var reduceSystem = reportFillPlaceholders(REPORT_SYSTEM_REDUCE);
    var parsed = null, reduceErr = null;
    for (var rAttempt = 0; rAttempt < 2 && !parsed; rAttempt++) {
      try {
        var rawFinal = await geminiProxyCall({ model: getModel('gemini'), system: reduceSystem, content: JSON.stringify(reduceInput), max_tokens: 8000 });
        parsed = reportParseJsonSafe(rawFinal);
        if (!parsed) reduceErr = '최종 정리 응답 JSON 파싱 실패 — 콘솔(F12)에서 원본 응답 확인. 앞부분: ' + String(rawFinal).slice(0, 200);
      } catch (e) { reduceErr = e.message; }
    }
    if (!parsed) throw new Error(reduceErr || '최종 정리에 실패했습니다.');

    var brands = parsed.brands || [];
    var patterns = parsed.patterns || [];
    var insights = parsed.insights || [];
    if (!brands.length && !patterns.length && !insights.length) { alert('정리할 만한 내용을 찾지 못했습니다.'); return; }

    await useCreditCommit('report_generate');
    window._reportItems = items;
    reportRender(region, trend, brands, patterns, insights);
  } catch (e) {
    alert('리포트 생성 실패: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}

function reportParseJsonSafe(raw) {
  try {
    return blogParseJson(raw);
  } catch (parseErr) {
    // 응답이 max_tokens에 걸려 중간에 잘렸을 가능성 — 잘린 JSON 복구를 한 번 더 시도
    return (typeof blogRepairJson === 'function') ? blogRepairJson(raw) : null;
  }
}

function reportSourceLinks(sourceIndexes) {
  return (sourceIndexes || []).map(function(idx) {
    var src = window._reportItems[idx];
    if (!src) return '';
    return '<div style="font-size:12.5px;color:var(--txt);margin-top:4px;">· <a href="' + reportEsc(src.link) + '" target="_blank" rel="noopener" style="color:var(--acc);font-weight:700;text-decoration:underline;">' + reportEsc(src.title || '') + '</a></div>';
  }).join('');
}

function reportRender(region, trend, brands, patterns, insights) {
  var resultEl = document.getElementById('report-result');
  if (!resultEl) return;

  var trendRows = trend.map(function(t) {
    return '<tr><td style="padding:6px 10px;border-bottom:1px solid var(--bdr);font-weight:600;">' + reportEsc(t.month) + (t.partial ? ' (오늘까지)' : '') + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid var(--bdr);text-align:right;font-weight:800;">' + t.count + '건</td></tr>';
  }).join('');
  var trendSection = '<div class="blog-card">' + (trend.length
    ? '<table style="width:100%;font-size:14px;color:var(--txt);border-collapse:collapse;">' + trendRows + '</table>'
    : '<p style="font-size:14px;color:var(--txt);">집계할 게시글이 없습니다.</p>') + '</div>';

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

  var insightList = '<div class="blog-card">' + (insights.length
    ? '<ul style="margin:0;padding-left:20px;font-size:14px;color:var(--txt);line-height:1.9;">' +
        insights.map(function(i) { return '<li>' + reportEsc(i) + '</li>'; }).join('') +
      '</ul>'
    : '<p style="font-size:14px;color:var(--txt);">-</p>') + '</div>';

  function section(title, body) {
    return '<div style="margin-bottom:20px;"><div style="font-size:15px;font-weight:900;color:var(--txt);margin-bottom:8px;">' + title + '</div>' + body + '</div>';
  }

  resultEl.innerHTML =
    '<div class="blog-card" style="font-size:16px;font-weight:900;color:var(--txt);">' + reportEsc(region) + ' 수학학원 현황</div>' +
    section('① 언급량 추이 (네이버 블로그, 월별)', trendSection) +
    section('② 자주 언급되는 학원 (' + brands.length + '건)', brandCards || '<p style="font-size:14px;color:var(--txt);">식별된 학원이 없습니다.</p>') +
    section('③ 콘텐츠 패턴', patternCards || '<p style="font-size:14px;color:var(--txt);">특별한 패턴이 발견되지 않았습니다.</p>') +
    section('④ 시사점', insightList || '<p style="font-size:14px;color:var(--txt);">-</p>');
}

function reportEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
