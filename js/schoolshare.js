// js/schoolshare.js
// 학교 검색은 학교알리미 OpenAPI(schoolinfo.go.kr)를 blog-tracker Worker(action=schoolShareSearch)로
// 서버사이드 프록시해서 받는다 — 브라우저 직접호출은 CORS로 막혀서 안 됨. 시/도·시군구 코드 매핑은
// js/schoolRegionCodes.js (index.html에서 이 파일보다 먼저 로드됨).
//
// 데이터 모델(저장 JSON): { schools: [{code,name,type,maxGrade,totalByGrade:{1:n,...}}], monthly: { "YYYY-MM": { code: {grade: ours} } } }
// "전체 학생수"(totalByGrade)는 학교알리미 API값(수정 가능), "우리 학원생 수"(monthly)는 달마다 따로 기록해서
// 과거 값이 덮어써지지 않게 한다.

let ssSchools = [];
let ssMonthly = {};
let ssSearchResults = []; // 최근 검색 결과 캐시 — onclick엔 index만 넘겨서 학교명에 홑따옴표가 있어도 안전
let ssCompareMonth = null;
let ssInputMonth = null;
let ssTrendExpandedCodes = new Set(); // 추이 탭에서 학년별 상세를 펼친 학교 code들

function ssPad2(n) { return String(n).padStart(2, '0'); }
function ssMonthKeyOf(date) { return date.getFullYear() + '-' + ssPad2(date.getMonth() + 1); }
function ssCurrentMonthKey() { return ssMonthKeyOf(new Date()); }
function ssPrevMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 - 1, 1);
  return ssMonthKeyOf(d);
}
function ssNextMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + 1, 1);
  return ssMonthKeyOf(d);
}
function ssAllMonthKeys() {
  const keys = new Set(Object.keys(ssMonthly));
  keys.add(ssCurrentMonthKey());
  if (ssCompareMonth) keys.add(ssCompareMonth); // ‹›로 데이터 없는 달까지 넘어가도 드롭다운에 계속 표시되게
  if (ssInputMonth) keys.add(ssInputMonth);
  return Array.from(keys).sort();
}

function ssPopulateSidoSelect() {
  const sel = document.getElementById('ss-sido-select');
  sel.innerHTML = '<option value="">시/도 선택</option>' +
    SIDO_CODES.map(s => `<option value="${s.code}">${s.name}</option>`).join('');
}

function ssOnSidoChange() {
  const sidoCode = document.getElementById('ss-sido-select').value;
  const sggSel = document.getElementById('ss-sgg-select');
  const list = SGG_CODES_BY_SIDO[sidoCode] || [];
  if (list.length === 0) {
    sggSel.innerHTML = '<option value="">시군구 코드 준비중</option>';
    return;
  }
  sggSel.innerHTML = '<option value="">시군구 선택</option>' +
    list.map(s => `<option value="${s.code}">${s.name}</option>`).join('');
}

// ── 탭 전환 ─────────────────────────────────────────────────────
function ssShowTab(tab) {
  const compareView = document.getElementById('ss-compare-view');
  const monthlyView = document.getElementById('ss-monthly-view');
  const trendView = document.getElementById('ss-trend-view');
  const btnCompare = document.getElementById('ss-tab-btn-compare');
  const btnMonthly = document.getElementById('ss-tab-btn-monthly');
  const btnTrend = document.getElementById('ss-tab-btn-trend');
  const desc = document.getElementById('ss-tab-desc');

  compareView.style.display = tab === 'compare' ? '' : 'none';
  monthlyView.style.display = tab === 'monthly' ? '' : 'none';
  trendView.style.display = tab === 'trend' ? '' : 'none';
  btnCompare.classList.toggle('active-date', tab === 'compare');
  btnMonthly.classList.toggle('active-date', tab === 'monthly');
  btnTrend.classList.toggle('active-date', tab === 'trend');

  if (tab === 'monthly') {
    desc.textContent = '학교별로 이번 달 재원생 수를 한 번에 입력하세요';
    ssRenderMonthlyInput();
  } else if (tab === 'trend') {
    desc.textContent = '학교별 점유율이 월별로 어떻게 변해왔는지 확인하세요';
    ssRenderTrendTable();
  } else {
    desc.textContent = '왼쪽에서 학교를 검색해 추가한 뒤 점유율을 비교하세요';
    ssRenderCompareTable();
  }
}

// ── 검색 (다중 선택 추가) ───────────────────────────────────────
function ssRenderSearchResults() {
  const resultsDiv = document.getElementById('ss-search-results');
  if (ssSearchResults.length === 0) return;
  let html = `<div style="max-height:280px; overflow-y:auto; border:1px solid var(--bdr); border-radius:8px;">`;
  ssSearchResults.forEach((school, idx) => {
    const isAdded = ssSchools.find(s => s.code === school.code);
    html += `
      <label style="padding:10px 12px; border-bottom:1px solid var(--bdr); display:flex; gap:10px; align-items:center; cursor:${isAdded ? 'default' : 'pointer'};">
        <input type="checkbox" data-idx="${idx}" ${isAdded ? 'disabled checked' : ''} style="flex-shrink:0; width:16px; height:16px;">
        <div style="flex:1;">
          <div style="font-weight:bold; font-size:14px;">${school.name}${isAdded ? ' <span style=\'font-size:11px;color:var(--mut);font-weight:normal;\'>(이미 추가됨)</span>' : ''}</div>
          <div style="font-size:12px; color:var(--mut);">${school.address}</div>
        </div>
      </label>
    `;
  });
  html += `</div>
    <button class="btn btn-primary" style="width:100%; margin-top:8px;" onclick="ssAddSelectedSchools()">선택한 학교 추가</button>
  `;
  resultsDiv.style.display = 'block';
  resultsDiv.innerHTML = html;
}

async function ssSearchSchool() {
  const sidoCode = document.getElementById('ss-sido-select').value;
  const sggCode = document.getElementById('ss-sgg-select').value;
  const schulKndCode = document.getElementById('ss-kind-select').value;

  if (!sidoCode || !sggCode || !schulKndCode) {
    showToast('시/도, 시군구, 학교급을 모두 선택하세요.');
    return;
  }

  const resultsDiv = document.getElementById('ss-search-results');
  resultsDiv.style.display = 'block';
  resultsDiv.innerHTML = '<div style="font-size:13px; color:var(--mut);">검색 중...</div>';

  try {
    const auth = getUserAuth();
    if (!auth) { showToast('로그인이 필요합니다.'); return; }
    const cfg = getGasConfig();
    if (!cfg.url || !cfg.token) { showToast('서버 설정 오류'); return; }

    const json = await _fetchGasJson(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'schoolShareSearch', token: cfg.token, userId: auth.id, userPw: auth.pw,
        sidoCode, sggCode, schulKndCode
      })
    });

    if (!json.ok) {
      resultsDiv.innerHTML = `<div style="font-size:13px; color:#ef4444;">${json.error || '검색 실패'}</div>`;
      return;
    }

    ssSearchResults = json.schools || [];
    if (ssSearchResults.length === 0) {
      resultsDiv.innerHTML = `<div style="font-size:13px; color:#ef4444;">검색 결과가 없습니다.</div>`;
      return;
    }

    ssRenderSearchResults();
  } catch (e) {
    console.error(e);
    resultsDiv.innerHTML = `<div style="font-size:13px; color:#ef4444;">API 호출에 실패했습니다.</div>`;
  }
}

function ssAddSelectedSchools() {
  const checked = document.querySelectorAll('#ss-search-results input[type="checkbox"]:checked:not(:disabled)');
  if (checked.length === 0) {
    showToast('추가할 학교를 선택하세요.');
    return;
  }
  let addedCount = 0;
  checked.forEach((box) => {
    const idx = parseInt(box.getAttribute('data-idx'), 10);
    const school = ssSearchResults[idx];
    if (!school || ssSchools.find(s => s.code === school.code)) return;
    const maxGrade = school.kindCode === '02' ? 6 : 3;
    const typeName = school.kindCode === '02' ? '초등학교' : (school.kindCode === '03' ? '중학교' : '고등학교');
    ssSchools.push({ code: school.code, name: school.name, type: typeName, maxGrade, totalByGrade: school.grades || {} });
    addedCount++;
  });
  ssRenderSearchResults(); // 목록은 유지하고 "이미 추가됨" 상태만 갱신 — 계속 더 골라 추가할 수 있게
  ssRenderCompareTable();
  ssRenderMonthlyInput();
  ssRenderTrendTable();
  showToast(`${addedCount}개 학교가 추가되었습니다.`);
}

function ssRemoveSchool(code) {
  ssSchools = ssSchools.filter(s => s.code !== code);
  ssRenderCompareTable();
}

// ── 비교 통표 ───────────────────────────────────────────────────
// 진한 단색 채우기 대신 옅은 톤 3단계로만 구분 — 표 전체가 너무 진해서 오히려
// 안 읽히는 문제(2026-09-03 피드백) 때문에 글자색은 항상 기본(어두운) 색 유지.
function ssShareTier(percent) {
  if (percent >= 20) return 'background:#dcd5f5;';
  if (percent >= 10) return 'background:#ece7fa;';
  if (percent > 0) return 'background:#f6f4fc;';
  return '';
}

// 학교의 특정 월 합계 점유율(학년 전체 합산) — 비교/추이 탭이 공유
function ssSchoolMonthPercent(school, monthKey) {
  const monthData = (ssMonthly[monthKey] && ssMonthly[monthKey][school.code]) || {};
  let sumTotal = 0, sumOurs = 0;
  for (let g = 1; g <= school.maxGrade; g++) {
    sumTotal += school.totalByGrade[g] || 0;
    sumOurs += monthData[g] || 0;
  }
  return { sumTotal, sumOurs, percent: sumTotal > 0 ? (sumOurs / sumTotal * 100) : 0 };
}

// 학교의 특정 월·특정 학년 점유율 — 추이 탭의 학년별 상세 펼침에서 사용
function ssGradePercent(school, monthKey, grade) {
  const monthData = (ssMonthly[monthKey] && ssMonthly[monthKey][school.code]) || {};
  const total = school.totalByGrade[grade] || 0;
  const ours = monthData[grade] || 0;
  return total > 0 ? (ours / total * 100) : 0;
}

// %p 증감을 ▲/▼/– 화살표로 — 비교/추이 탭이 공유
function ssArrowHtml(diff) {
  const arrow = diff > 0 ? '▲' : (diff < 0 ? '▼' : '–');
  const color = diff > 0 ? '#16a34a' : (diff < 0 ? '#ef4444' : 'var(--mut)');
  return `<span style="color:${color}; font-weight:bold;">${arrow} ${Math.abs(diff).toFixed(1)}%p</span>`;
}

function ssOnCompareMonthChange(value) {
  ssCompareMonth = value;
  ssRenderCompareTable();
}

function ssRenderCompareTable() {
  const container = document.getElementById('ss-schools-container');
  if (ssSchools.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-title">아직 추가한 학교가 없습니다</div><div class="empty-state-desc">왼쪽에서 학교를 검색해 추가해보세요</div></div>';
    return;
  }

  if (!ssCompareMonth) ssCompareMonth = ssAllMonthKeys()[ssAllMonthKeys().length - 1];
  const monthKeys = ssAllMonthKeys();
  const prevKey = ssPrevMonthKey(ssCompareMonth);
  const maxGradeOverall = Math.max(...ssSchools.map(s => s.maxGrade));

  let html = `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
      <button class="btn" style="padding:4px 10px;" onclick="ssOnCompareMonthChange('${ssPrevMonthKey(ssCompareMonth)}')">‹</button>
      <select class="blog-input" style="width:140px;" onchange="ssOnCompareMonthChange(this.value)">
        ${monthKeys.map(k => `<option value="${k}" ${k === ssCompareMonth ? 'selected' : ''}>${k}</option>`).join('')}
      </select>
      <button class="btn" style="padding:4px 10px;" onclick="ssOnCompareMonthChange('${ssNextMonthKey(ssCompareMonth)}')">›</button>
      <span style="font-size:12px; color:var(--mut);">해당 월 우리 학원생 수는 "재원생입력" 탭에서 등록</span>
    </div>
    ${!ssMonthly[ssCompareMonth] ? `<div style="background:var(--acc-light); border:1px solid var(--acc-border); border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:13px;">
      <b>${ssCompareMonth}</b>에는 아직 입력된 재원생 데이터가 없어 전부 0%로 표시됩니다 — "재원생입력" 탭에서 등록해주세요.
    </div>` : ''}
    <div style="overflow-x:auto;">
    <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:center;">
      <thead>
        <tr style="background:var(--bg); border-bottom:1px solid var(--bdr);">
          <th style="padding:10px; text-align:left; border-right:1px solid var(--bdr);">학교</th>
          ${Array.from({ length: maxGradeOverall }, (_, i) => `<th style="padding:10px; border-right:1px solid var(--bdr);">${i + 1}학년</th>`).join('')}
          <th style="padding:10px; border-right:1px solid var(--bdr);">합계</th>
          <th style="padding:10px; border-right:1px solid var(--bdr);">전월 대비</th>
          <th style="padding:10px;"></th>
        </tr>
      </thead>
      <tbody>
  `;

  ssSchools.forEach((school) => {
    const monthData = (ssMonthly[ssCompareMonth] && ssMonthly[ssCompareMonth][school.code]) || {};
    const prevData = (ssMonthly[prevKey] && ssMonthly[prevKey][school.code]) || null;
    let sumTotal = 0, sumOurs = 0, prevSumTotal = 0, prevSumOurs = 0, hasPrev = false;

    html += `<tr style="border-bottom:1px solid var(--bdr);">
      <td style="padding:10px; text-align:left; border-right:1px solid var(--bdr);">
        <div style="font-weight:bold;">${school.name}</div>
        <div style="font-size:11px; color:var(--mut);">${school.type}</div>
      </td>`;

    for (let g = 1; g <= maxGradeOverall; g++) {
      if (g > school.maxGrade) { html += `<td style="padding:10px; border-right:1px solid var(--bdr); color:var(--mut);">-</td>`; continue; }
      const total = school.totalByGrade[g] || 0;
      const ours = monthData[g] || 0;
      sumTotal += total; sumOurs += ours;
      if (prevData) { hasPrev = true; prevSumTotal += (school.totalByGrade[g] || 0); prevSumOurs += (prevData[g] || 0); }

      const percent = total > 0 ? (ours / total * 100) : 0;
      html += `<td style="padding:10px; border-right:1px solid var(--bdr); ${ssShareTier(percent)}">
        <div style="font-weight:bold;">${percent.toFixed(1)}%</div>
        <div style="font-size:10px; opacity:.8;">${ours}/${total}</div>
      </td>`;
    }

    const totalPercent = sumTotal > 0 ? (sumOurs / sumTotal * 100) : 0;
    let trendHtml = '<span style="color:var(--mut);">–</span>';
    if (hasPrev && prevSumTotal > 0) {
      const prevPercent = prevSumOurs / prevSumTotal * 100;
      trendHtml = ssArrowHtml(totalPercent - prevPercent);
    }

    html += `
      <td style="padding:10px; border-right:1px solid var(--bdr); font-weight:bold; ${ssShareTier(totalPercent)}">${totalPercent.toFixed(1)}%</td>
      <td style="padding:10px; border-right:1px solid var(--bdr);">${trendHtml}</td>
      <td style="padding:10px; white-space:nowrap;">
        <span style="cursor:pointer; font-size:12px; color:#ef4444;" data-code="${school.code}" onclick="ssRemoveSchool(this.getAttribute('data-code'))">삭제</span>
      </td>
    </tr>`;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

// ── 월별 입력 ───────────────────────────────────────────────────
function ssOnInputMonthChange(value) {
  ssInputMonth = value;
  ssRenderMonthlyInput();
}

function ssLoadPrevMonthValues() {
  const prevKey = ssPrevMonthKey(ssInputMonth);
  const prevData = ssMonthly[prevKey];
  if (!prevData) { showToast('직전 달(' + prevKey + ') 데이터가 없습니다.'); return; }
  if (!ssMonthly[ssInputMonth]) ssMonthly[ssInputMonth] = {};
  ssSchools.forEach((school) => {
    const prevSchoolData = prevData[school.code];
    if (!prevSchoolData) return;
    if (!ssMonthly[ssInputMonth][school.code]) ssMonthly[ssInputMonth][school.code] = {};
    for (let g = 1; g <= school.maxGrade; g++) {
      const existing = ssMonthly[ssInputMonth][school.code][g];
      if (existing === undefined && prevSchoolData[g] !== undefined) {
        ssMonthly[ssInputMonth][school.code][g] = prevSchoolData[g];
      }
    }
  });
  ssRenderMonthlyInput();
  showToast(prevKey + ' 값을 불러왔습니다 (빈 칸만 채움).');
}

function ssUpdateMonthlyValue(code, grade, value) {
  if (!ssMonthly[ssInputMonth]) ssMonthly[ssInputMonth] = {};
  if (!ssMonthly[ssInputMonth][code]) ssMonthly[ssInputMonth][code] = {};
  const num = parseInt(value, 10);
  ssMonthly[ssInputMonth][code][grade] = isNaN(num) ? 0 : num;
}

function ssRenderMonthlyInput() {
  const container = document.getElementById('ss-monthly-container');
  if (ssSchools.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-title">아직 추가한 학교가 없습니다</div><div class="empty-state-desc">왼쪽에서 학교를 검색해 추가해보세요</div></div>';
    return;
  }
  if (!ssInputMonth) ssInputMonth = ssCompareMonth || ssCurrentMonthKey();
  const maxGradeOverall = Math.max(...ssSchools.map(s => s.maxGrade));
  const monthData = ssMonthly[ssInputMonth] || {};

  let html = `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
      <input type="month" class="blog-input" style="width:160px;" value="${ssInputMonth}" onchange="ssOnInputMonthChange(this.value)">
      <button class="btn" onclick="ssLoadPrevMonthValues()">이전 달 값 불러오기</button>
      <button class="btn btn-primary" onclick="ssSaveData()" style="margin-left:auto;">저장하기</button>
    </div>
    <div style="overflow-x:auto;">
    <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:center;">
      <thead>
        <tr style="background:var(--bg); border-bottom:1px solid var(--bdr);">
          <th style="padding:10px; text-align:left; border-right:1px solid var(--bdr);">학교</th>
          ${Array.from({ length: maxGradeOverall }, (_, i) => `<th style="padding:10px; border-right:1px solid var(--bdr);">${i + 1}학년</th>`).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  ssSchools.forEach((school) => {
    const schoolMonthData = monthData[school.code] || {};
    html += `<tr style="border-bottom:1px solid var(--bdr);">
      <td style="padding:10px; text-align:left; border-right:1px solid var(--bdr); font-weight:bold;">${school.name}</td>`;
    for (let g = 1; g <= maxGradeOverall; g++) {
      if (g > school.maxGrade) { html += `<td style="padding:10px; border-right:1px solid var(--bdr); color:var(--mut);">-</td>`; continue; }
      const val = schoolMonthData[g];
      html += `<td style="padding:6px; border-right:1px solid var(--bdr);">
        <input type="number" min="0" class="set-input" style="width:60px; text-align:center; padding:4px;" value="${val === undefined ? '' : val}" data-code="${school.code}" data-grade="${g}" onchange="ssUpdateMonthlyValue(this.getAttribute('data-code'), parseInt(this.getAttribute('data-grade'),10), this.value)">
      </td>`;
    }
    html += `</tr>`;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

// ── 추이 (학교×월 매트릭스, 행 클릭 시 학년별 상세 펼침) ──────────
function ssToggleTrendExpand(code) {
  if (ssTrendExpandedCodes.has(code)) ssTrendExpandedCodes.delete(code);
  else ssTrendExpandedCodes.add(code);
  ssRenderTrendTable();
}

function ssRenderTrendTable() {
  const container = document.getElementById('ss-trend-container');
  if (ssSchools.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-title">아직 추가한 학교가 없습니다</div><div class="empty-state-desc">왼쪽에서 학교를 검색해 추가해보세요</div></div>';
    return;
  }

  const monthKeys = ssAllMonthKeys(); // 오름차순
  let html = `<div style="overflow-x:auto;">
    <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:center;">
      <thead>
        <tr style="background:var(--bg); border-bottom:1px solid var(--bdr);">
          <th style="padding:10px; text-align:left; border-right:1px solid var(--bdr);">학교</th>
          ${monthKeys.map(k => `<th style="padding:10px; border-right:1px solid var(--bdr);">${k}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  ssSchools.forEach((school) => {
    const expanded = ssTrendExpandedCodes.has(school.code);
    html += `<tr style="border-bottom:1px solid var(--bdr); cursor:pointer;" data-code="${school.code}" onclick="ssToggleTrendExpand(this.getAttribute('data-code'))">
      <td style="padding:10px; text-align:left; border-right:1px solid var(--bdr);">
        <span style="display:inline-block; width:14px; color:var(--mut);">${expanded ? '▾' : '▸'}</span>
        <span style="font-weight:bold;">${school.name}</span>
        <span style="font-size:11px; color:var(--mut);">(${school.type})</span>
      </td>`;

    let prevPercent = null;
    monthKeys.forEach((mk) => {
      const { percent } = ssSchoolMonthPercent(school, mk);
      const trend = prevPercent === null ? '' : `<div style="font-size:10px; margin-top:2px;">${ssArrowHtml(percent - prevPercent)}</div>`;
      html += `<td style="padding:10px; border-right:1px solid var(--bdr); ${ssShareTier(percent)}">
        <div style="font-weight:bold;">${percent.toFixed(1)}%</div>
        ${trend}
      </td>`;
      prevPercent = percent;
    });
    html += `</tr>`;

    if (expanded) {
      for (let g = 1; g <= school.maxGrade; g++) {
        html += `<tr style="border-bottom:1px solid var(--bdr); background:var(--bg);">
          <td style="padding:6px 10px 6px 30px; text-align:left; border-right:1px solid var(--bdr); font-size:12px; color:var(--mut);">${g}학년</td>`;
        monthKeys.forEach((mk) => {
          const p = ssGradePercent(school, mk, g);
          html += `<td style="padding:6px; border-right:1px solid var(--bdr); font-size:12px; ${ssShareTier(p)}">${p.toFixed(1)}%</td>`;
        });
        html += `</tr>`;
      }
    }
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

// ── 로드/저장 (+ 구버전 데이터 마이그레이션) ────────────────────
function ssMigrateIfNeeded(parsed) {
  if (Array.isArray(parsed)) {
    // 구버전: [{code,name,type,maxGrade,grades:{i:{total,ours}}}]
    const monthKey = ssCurrentMonthKey();
    const monthly = {};
    const schools = parsed.map((s) => {
      const totalByGrade = {};
      const ours = {};
      Object.keys(s.grades || {}).forEach((g) => {
        totalByGrade[g] = s.grades[g].total || 0;
        ours[g] = s.grades[g].ours || 0;
      });
      monthly[s.code] = ours;
      return { code: s.code, name: s.name, type: s.type, maxGrade: s.maxGrade, totalByGrade };
    });
    return { schools, monthly: { [monthKey]: monthly } };
  }
  return { schools: parsed.schools || [], monthly: parsed.monthly || {} };
}

async function ssInit() {
  ssPopulateSidoSelect();
  try {
    const auth = getUserAuth();
    if (!auth) return;
    const cfg = getGasConfig();
    if (!cfg.url || !cfg.token) return;

    const json = await _fetchGasJson(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'loadSchoolShare', token: cfg.token, userId: auth.id, userPw: auth.pw, site: _siteId() })
    });

    if (json.ok && json.data) {
      const migrated = ssMigrateIfNeeded(JSON.parse(json.data));
      ssSchools = migrated.schools;
      ssMonthly = migrated.monthly;
      ssRenderCompareTable();
    }
  } catch (e) {
    console.error('학교 점유율 로드 실패:', e);
  }
}

async function ssSaveData() {
  try {
    const auth = getUserAuth();
    if (!auth) {
      showToast('로그인이 필요합니다.');
      return;
    }
    const cfg = getGasConfig();
    if (!cfg.url || !cfg.token) {
      showToast('서버 설정 오류');
      return;
    }

    const jsonData = JSON.stringify({ schools: ssSchools, monthly: ssMonthly });
    const json = await _fetchGasJson(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'saveSchoolShare', token: cfg.token, userId: auth.id, userPw: auth.pw, site: _siteId(), jsonData: jsonData })
    });

    if (json.ok) {
      showToast('저장되었습니다.');
    } else {
      showToast('저장 실패: ' + (json.error || '알 수 없는 오류'));
    }
  } catch (e) {
    console.error('학교 점유율 저장 실패:', e);
    showToast('저장 중 오류가 발생했습니다.');
  }
}

// 라우터 초기화 이벤트 리스너 추가
document.addEventListener('DOMContentLoaded', () => {
  ssInit();
});
