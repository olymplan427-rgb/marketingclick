// ============================================================
// 지도검색 — 카카오 로컬 API(주소검색+키워드검색) + 카카오맵 장소별 블로그 리뷰 취합
// ============================================================
// 블로그 취합은 지도검색 전용 GAS 프록시(gas/mapsearch_tracker.gs, searchAcademyPosts 액션)를 거쳐
// 카카오맵 장소 상세페이지가 쓰는 비공식 API(place-api.map.kakao.com)를 호출 —
// 서버 대 서버 호출이라 CORS 제약이 없고, 학원명 텍스트 검색이 아니라 장소 ID로
// 정확히 매칭된 블로그만 가져온다.

var msState = { radius: 1000, keyword: '수학학원', results: [], loading: false, locationQuery: '', postsCache: {} };

// 결과 목록에 뜨자마자 45건 전부를 동시에 확인하면 GAS(전원 공유 계정) 부하가 튀므로
// 동시 실행 개수를 제한해서 순차적으로 흘려보냄
var MS_BLOG_CHECK_CONCURRENCY = 4;

// 네이버지도 "검색" 형태 공유링크(.../search/장소명)는 URL에 장소명이 그대로 들어있어 파싱 가능.
// (참고: "장소 상세" 링크나 naver.me 단축링크는 브라우저 CORS로 직접 못 풀고, GAS 프록시로 시도해봤으나
// 네이버가 구글 앱스스크립트 서버 IP를 차단(429)해서 신뢰할 수 없어 포기 — 프로필의 "주소" 필드를 직접 씀)
function msExtractQueryFromMapLink(mapUrl) {
  if (!mapUrl) return '';
  try {
    var m = mapUrl.match(/\/search\/([^/?#]+)/);
    if (m) return decodeURIComponent(m[1].replace(/\+/g, ' '));
  } catch (e) {}
  return '';
}

function msPopulateProfiles() {
  var sel = document.getElementById('ms-profile-select');
  if (!sel) return;
  var profiles = (typeof loadAcademyProfiles === 'function') ? loadAcademyProfiles() : [];
  var activeId = (typeof getActiveProfileId === 'function') ? getActiveProfileId() : '';
  if (!profiles.length) {
    sel.innerHTML = '<option value="">등록된 학원 프로필이 없습니다</option>';
    return;
  }
  sel.innerHTML = profiles.map(function(p) {
    return '<option value="' + p.id + '"' + (p.id === activeId ? ' selected' : '') + '>' + msEsc(p.name || '(이름 없음)') + '</option>';
  }).join('');
}

function msOnProfileChange() {
  var sel = document.getElementById('ms-profile-select');
  var hintEl = document.getElementById('ms-profile-map-hint');
  if (!sel) return;
  var profiles = (typeof loadAcademyProfiles === 'function') ? loadAcademyProfiles() : [];
  var p = profiles.filter(function(x) { return x.id === sel.value; })[0];
  msState.locationQuery = '';

  if (!p || !p.name) {
    if (hintEl) hintEl.textContent = '블로그 작성 페이지에서 학원 프로필(학원명·주소)을 먼저 등록해주세요';
    return;
  }
  if (p.address) {
    msState.locationQuery = p.address;
    if (hintEl) hintEl.textContent = '등록된 주소로 검색합니다: ' + p.address;
    return;
  }
  var fromText = msExtractQueryFromMapLink(p.map);
  if (fromText) {
    msState.locationQuery = fromText;
    if (hintEl) hintEl.textContent = '지도 링크에서 인식된 위치: ' + fromText;
    return;
  }
  msState.locationQuery = p.name;
  if (hintEl) hintEl.textContent = '등록된 주소가 없어 학원명으로 검색합니다: ' + p.name + ' (블로그 작성 페이지에서 주소를 등록하면 더 정확해집니다)';
}

function msInit() {
  msPopulateProfiles();
  msOnProfileChange();
}

function msSetRadius(el, r) {
  msState.radius = r;
  document.querySelectorAll('#ms-radius-group .mon-pill').forEach(function(p) { p.classList.remove('active-date'); });
  el.classList.add('active-date');
}

function msRadiusLabel(r) {
  return r >= 1000 ? (r / 1000) + 'km' : r + 'm';
}

async function msKakaoFetch(url) {
  var key = getKakaoKey();
  if (!key) throw new Error('NO_KEY');
  var res = await fetch(url, { headers: { Authorization: 'KakaoAK ' + key } });
  if (!res.ok) {
    var bodyText = await res.text().catch(function() { return '(응답 본문 읽기 실패)'; });
    console.error('[지도검색] 카카오 API 실패', res.status, url, bodyText);
    throw new Error('HTTP_' + res.status);
  }
  return res.json();
}

// 주소 → 좌표. 지번/도로명 주소 검색 실패 시 키워드 검색(장소명 등)으로 한 번 더 시도
async function msGeocode(address) {
  var addrJson = await msKakaoFetch('https://dapi.kakao.com/v2/local/search/address.json?query=' + encodeURIComponent(address));
  if (addrJson.documents && addrJson.documents.length) {
    var d = addrJson.documents[0];
    return { x: d.x, y: d.y };
  }
  var kwJson = await msKakaoFetch('https://dapi.kakao.com/v2/local/search/keyword.json?query=' + encodeURIComponent(address));
  if (kwJson.documents && kwJson.documents.length) {
    var k = kwJson.documents[0];
    return { x: k.x, y: k.y };
  }
  throw new Error('NO_MATCH');
}

// 카카오 키워드검색은 size·page 조합과 무관하게 총 45건이 하드 캡(카카오 공식 답변) —
// 45보다 크게 설정해도 더 못 받아오고 빈 페이지만 호출하니 45로 고정
var MS_MAX_RESULTS = 45;
var MS_PAGE_SIZE = 15;

async function msKeywordSearch(x, y, radius, keyword) {
  var all = [];
  var maxPages = Math.ceil(MS_MAX_RESULTS / MS_PAGE_SIZE);
  for (var page = 1; page <= maxPages; page++) {
    var url = 'https://dapi.kakao.com/v2/local/search/keyword.json'
      + '?query=' + encodeURIComponent(keyword)
      + '&x=' + x + '&y=' + y + '&radius=' + radius
      + '&category_group_code=AC5&sort=distance&size=' + MS_PAGE_SIZE + '&page=' + page;
    var json = await msKakaoFetch(url);
    var docs = json.documents || [];
    all = all.concat(docs.map(function(d) {
      return {
        name: d.place_name,
        address: d.road_address_name || d.address_name,
        category: d.category_name,
        distance: parseInt(d.distance, 10) || 0,
        link: d.place_url,
        x: d.x,
        y: d.y
      };
    }));
    if (!json.meta || json.meta.is_end || docs.length < MS_PAGE_SIZE) break;
  }
  return all.slice(0, MS_MAX_RESULTS);
}

async function msSearch() {
  var address = (msState.locationQuery || '').trim();
  msState.keyword = (document.getElementById('ms-keyword') || {}).value || '수학학원';
  var countEl = document.getElementById('ms-result-count');
  var wrap = document.getElementById('ms-result-list');

  if (!address) {
    if (countEl) countEl.textContent = '기준 위치(학원 프로필)를 먼저 선택해주세요';
    return;
  }
  if (!getKakaoKey()) {
    if (countEl) countEl.textContent = '카카오 REST API 키가 설정되지 않았습니다';
    if (wrap) wrap.innerHTML = '<div class="mon-empty-right" style="grid-column:1/-1;">설정 → 지도검색 연동에서 카카오 REST API 키를 먼저 입력해주세요</div>';
    return;
  }

  try {
    await useCreditConfirm('mapsearch_nearby', '주변 학원 검색');
  } catch (ce) {
    if (!ce.cancelled && countEl) countEl.textContent = ce.message || '크레딧 확인에 실패했습니다.';
    return;
  }

  msState.loading = true;
  if (countEl) countEl.textContent = '검색 중...';
  if (wrap) wrap.innerHTML = '<div class="blog-loading show" style="grid-column:1/-1;"><span class="blog-spinner"></span>인근 학원을 검색하고 있습니다...</div>';

  try {
    var coord = await msGeocode(address);
    var list = await msKeywordSearch(coord.x, coord.y, msState.radius, msState.keyword);
    msState.results = list.sort(function(a, b) { return a.distance - b.distance; });
    msState.postsCache = {};
    if (wrap) wrap.innerHTML = '<div class="blog-loading show" style="grid-column:1/-1;"><span class="blog-spinner"></span>학원리스트 조회중...</div>';
    await msRunBlogChecks();
    if (countEl) {
      countEl.textContent = address + ' 기준, 반경 ' + msRadiusLabel(msState.radius) + ' 이내 "' + msState.keyword + '" ' + msState.results.length + '건';
    }
    msRenderList();
  } catch (e) {
    msState.results = [];
    var msg = '검색 중 오류가 발생했습니다.';
    if (e.message === 'NO_KEY') msg = '카카오 REST API 키가 설정되지 않았습니다.';
    else if (e.message === 'NO_MATCH') msg = '"' + address + '" 위치를 찾을 수 없습니다. 학원 프로필의 학원명·지도 링크를 확인해주세요.';
    else if (e.message && e.message.indexOf('HTTP_401') !== -1) msg = 'API 키가 유효하지 않습니다 (401).';
    else if (e.message && e.message.indexOf('HTTP_') !== -1) msg = '카카오 API 호출 실패 (' + e.message + ')';
    else msg = 'CORS 또는 네트워크 오류로 호출에 실패했습니다. 카카오 디벨로퍼스에서 Web 플랫폼 도메인 등록을 확인해주세요.';
    if (countEl) countEl.textContent = msg;
    if (wrap) wrap.innerHTML = '<div class="mon-empty-right" style="grid-column:1/-1;">' + msEsc(msg) + '</div>';
  } finally {
    msState.loading = false;
  }
}

function msRenderList() {
  var wrap = document.getElementById('ms-result-list');
  if (!wrap) return;
  if (!msState.results.length) {
    wrap.innerHTML = '<div class="mon-empty-right" style="grid-column:1/-1;">검색 결과가 없습니다. 반경을 넓혀보세요.</div>';
    return;
  }
  wrap.innerHTML = msState.results.map(function(a, i) {
    var naverUrl = 'https://map.naver.com/p/search/' + encodeURIComponent(a.name + ' ' + (a.address || ''));
    var noBlog = a.hasBlog === false;
    var btnLabel = noBlog ? '📋 블로그 없음' : '📋 블로그 취합';
    var btnAttrs = noBlog ? ' disabled' : ' onclick="msFetchPosts(' + i + ')"';
    return '' +
      '<div class="blog-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
          '<div style="display:flex;align-items:center;gap:8px;min-width:0;">' +
            '<div class="bimg-badge body-img" style="flex-shrink:0;">' + msRadiusLabel(a.distance) + '</div>' +
            '<div style="font-size:14px;font-weight:800;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><a href="' + msEsc(naverUrl) + '" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;">' + msEsc(a.name) + '</a></div>' +
          '</div>' +
          '<button class="bc-btn" id="ms-blog-btn-' + i + '" style="flex-shrink:0;"' + btnAttrs + '>' + btnLabel + '</button>' +
        '</div>' +
        '<div style="font-size:12px;color:var(--mut);margin-top:6px;">' + msEsc(a.address) + '</div>' +
      '</div>';
  }).join('');
}

function msCloseModal() {
  var modal = document.getElementById('ms-post-modal');
  if (modal) modal.style.display = 'none';
}

// 카카오 로컬 API의 place_url(예: https://place.map.kakao.com/12923294)에서 장소 ID만 추출
function msExtractPlaceId(placeUrl) {
  var m = (placeUrl || '').match(/place\.map\.kakao\.com\/(\d+)/);
  return m ? m[1] : '';
}

// GAS(searchAcademyPosts)를 호출해 { ok, posts } 또는 { ok:false, error }로 정규화.
// error === '__PARSE__'면 GAS가 JSON 대신 HTML 에러 페이지를 반환한 경우(할당량 초과 등).
async function msRequestAcademyPosts(placeId, cfg) {
  try {
    var res = await fetch(cfg.url, {
      method: 'POST',
      body: JSON.stringify({ token: cfg.token, action: 'searchAcademyPosts', placeId: placeId })
    });
    var rawText = await res.text();
    var json;
    try {
      json = JSON.parse(rawText);
    } catch (parseErr) {
      return { ok: false, error: '__PARSE__' };
    }
    if (!json || !json.ok) {
      return { ok: false, error: (json && json.error) || '알 수 없는 오류' };
    }
    return { ok: true, posts: json.posts || [] };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// 리스트를 렌더링하기 전에 전체 학원의 블로그 보유 여부를 먼저 확인 — 목록이 뜰 때부터
// 없는 학원은 바로 비활성화된 상태로 보이게 하기 위함(렌더 후 버튼이 뒤늦게 바뀌는 걸 방지).
// 실패(네트워크 오류 등)한 경우는 판단 불가로 보고 활성 상태로 둔다(오탐으로 기능을 막지 않기 위해).
async function msRunBlogChecks() {
  var cfg = (typeof getMapsearchGasConfig === 'function') ? getMapsearchGasConfig() : { url: '', token: '' };
  if (!cfg.url || !cfg.token) return;

  var queue = msState.results.map(function(a, i) { return i; });
  var workers = [];
  for (var w = 0; w < MS_BLOG_CHECK_CONCURRENCY; w++) {
    workers.push((async function worker() {
      while (queue.length) {
        var idx = queue.shift();
        await msCheckHasBlog(idx, cfg);
      }
    })());
  }
  await Promise.all(workers);
}

// 일시적 오류(카카오/GAS 순간 장애 등)로 "블로그 없음"을 잘못 단정하지 않도록,
// 실패 시 짧은 대기 후 최대 2회까지 재시도한다 (총 3회 시도)
var MS_BLOG_CHECK_RETRIES = 2;
var MS_BLOG_CHECK_RETRY_DELAY = 500;

function msDelay(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

// 확인 결과를 academy 객체(msState.results[idx])에 직접 기록 — 이 시점엔 아직 리스트를
// 렌더링하지 않은 상태라 버튼 DOM이 없음. hasBlog는 true/false/undefined(판단 불가) 3가지.
async function msCheckHasBlog(idx, cfg) {
  var academy = msState.results[idx];
  if (!academy) return;
  var placeId = msExtractPlaceId(academy.link);
  if (!placeId) return;

  var result = await msRequestAcademyPosts(placeId, cfg);
  for (var attempt = 0; !result.ok && attempt < MS_BLOG_CHECK_RETRIES; attempt++) {
    await msDelay(MS_BLOG_CHECK_RETRY_DELAY);
    result = await msRequestAcademyPosts(placeId, cfg);
  }
  if (!result.ok) return;
  msState.postsCache[placeId] = result.posts;
  academy.hasBlog = result.posts.length > 0;
}

async function msFetchPosts(idx) {
  var academy = msState.results[idx];
  if (!academy) return;
  var modal = document.getElementById('ms-post-modal');
  var titleEl = document.getElementById('ms-modal-title');
  var bodyEl = document.getElementById('ms-modal-body');
  if (!modal || !bodyEl) return;

  var placeId = msExtractPlaceId(academy.link);
  var cfg = (typeof getMapsearchGasConfig === 'function') ? getMapsearchGasConfig() : { url: '', token: '' };
  // 배경 확인(msRunBlogChecks)에서 이미 가져온 결과가 있으면 재요청하지 않고 재사용
  var cached = placeId ? msState.postsCache[placeId] : null;

  titleEl.textContent = academy.name + ' — 블로그 취합';
  modal.style.display = 'flex';

  if (!placeId) {
    bodyEl.innerHTML = '<div class="hint-text">카카오맵 장소 정보를 찾을 수 없습니다</div>';
    return;
  }
  if (!cfg.url || !cfg.token) {
    bodyEl.innerHTML = '<div class="hint-text">설정 → AI 설정에서 구글시트 연동(GAS URL·토큰)을 먼저 설정해주세요</div>';
    return;
  }

  bodyEl.innerHTML = '<div class="blog-loading show"><span class="blog-spinner"></span>블로그 검색 중...</div>';
  var result = cached ? { ok: true, posts: cached } : await msRequestAcademyPosts(placeId, cfg);

  if (!result.ok) {
    if (result.error === '__PARSE__') {
      bodyEl.innerHTML = '<div class="hint-text">취합 실패: 서버(GAS)가 응답을 반환하지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
    } else {
      bodyEl.innerHTML = '<div class="hint-text">취합 실패: ' + msEsc(result.error) + '</div>';
    }
    return;
  }

  msState.postsCache[placeId] = result.posts;
  var posts = result.posts.slice().sort(function(a, b) {
    return (b.date || '').localeCompare(a.date || '');
  });
  if (!posts.length) {
    bodyEl.innerHTML = '<div class="hint-text">관련 블로그 글을 찾지 못했습니다</div>';
    return;
  }
  // 각 글마다 별도 박스로 감싸서 헤더(날짜·버튼)와 내용이 한 세트임을 명확히 구분
  bodyEl.innerHTML = posts.map(function(p) {
    return '' +
      '<div class="blog-copy-section">' +
        '<div class="blog-copy-header">' +
          '<span class="blog-copy-label">' + msEsc(p.source) + (p.date ? ' · ' + msEsc(p.date) : '') + '</span>' +
          '<a class="bc-btn" href="' + msEsc(p.link) + '" target="_blank" rel="noopener">원문 보기 →</a>' +
        '</div>' +
        '<div class="blog-copy-content">' + msEsc(p.title) + '<div class="hint-text" style="margin-top:4px;">' + msEsc(p.author) + '</div></div>' +
      '</div>';
  }).join('');
}

function msEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
