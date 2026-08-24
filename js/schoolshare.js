// js/schoolshare.js
// 학교 검색은 학교알리미 OpenAPI(schoolinfo.go.kr)를 blog-tracker Worker(action=schoolShareSearch)로
// 서버사이드 프록시해서 받는다 — 브라우저 직접호출은 CORS로 막혀서 안 됨. 시/도·시군구 코드 매핑은
// js/schoolRegionCodes.js (index.html에서 이 파일보다 먼저 로드됨).

let ssSchools = [];
let ssSearchResults = []; // 최근 검색 결과 캐시 — onclick엔 index만 넘겨서 학교명에 홑따옴표가 있어도 안전

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

    let html = `<div style="max-height:240px; overflow-y:auto; border:1px solid var(--bdr); border-radius:8px;">`;
    ssSearchResults.forEach((school, idx) => {
      const isAdded = ssSchools.find(s => s.code === school.code);
      html += `
        <div style="padding:12px; border-bottom:1px solid var(--bdr); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:bold; font-size:14px;">${school.name}</div>
            <div style="font-size:12px; color:var(--mut);">${school.address}</div>
          </div>
          <button class="btn btn-primary" style="padding:4px 8px; font-size:12px;" data-idx="${idx}" onclick="ssAddSchoolFromSearch(this)" ${isAdded ? 'disabled' : ''}>
            ${isAdded ? '추가됨' : '추가'}
          </button>
        </div>
      `;
    });
    html += `</div>`;
    resultsDiv.innerHTML = html;
  } catch (e) {
    console.error(e);
    resultsDiv.innerHTML = `<div style="font-size:13px; color:#ef4444;">API 호출에 실패했습니다.</div>`;
  }
}

function ssAddSchoolFromSearch(btn) {
  const idx = parseInt(btn.getAttribute('data-idx'), 10);
  const school = ssSearchResults[idx];
  if (!school) return;
  ssAddSchool(school.code, school.name, school.kindCode, school.grades);
}

function ssAddSchool(code, name, kindCode, apiGrades) {
  if (ssSchools.find(s => s.code === code)) return;

  // 학제에 따른 학년 수 설정 (초등 6, 중/고 3)
  const maxGrade = kindCode === '02' ? 6 : 3;
  const typeName = kindCode === '02' ? '초등학교' : (kindCode === '03' ? '중학교' : '고등학교');

  const newSchool = {
    code,
    name,
    type: typeName,
    maxGrade,
    grades: {}
  };

  for (let i = 1; i <= maxGrade; i++) {
    const apiTotal = apiGrades && apiGrades[i];
    newSchool.grades[i] = { total: apiTotal || 0, ours: 0 };
  }

  ssSchools.push(newSchool);
  document.getElementById('ss-search-results').style.display = 'none';
  ssRenderSchools();
  showToast(`${name} 추가되었습니다.`);
}

function ssRemoveSchool(code) {
  ssSchools = ssSchools.filter(s => s.code !== code);
  ssRenderSchools();
}

function ssUpdateData(code, grade, field, value) {
  const school = ssSchools.find(s => s.code === code);
  if (school) {
    const num = parseInt(value, 10);
    school.grades[grade][field] = isNaN(num) ? 0 : num;
    ssRenderSchoolCard(school); // Re-render only this card
  }
}

function ssRenderSchools() {
  const container = document.getElementById('ss-schools-container');
  container.innerHTML = '';
  
  if (ssSchools.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--mut); font-size:14px; border:1px dashed var(--bdr); border-radius:8px;">추가된 학교가 없습니다.</div>';
    return;
  }
  
  ssSchools.forEach(school => {
    const card = document.createElement('div');
    card.id = `ss-card-${school.code}`;
    card.style.cssText = 'border:1px solid var(--bdr); border-radius:12px; padding:20px; margin-bottom:16px; background:#fff;';
    container.appendChild(card);
    ssRenderSchoolCard(school);
  });
}

function ssRenderSchoolCard(school) {
  const card = document.getElementById(`ss-card-${school.code}`);
  if (!card) return;
  
  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <h3 style="margin:0; font-size:16px; color:var(--acc);">${school.name} <span style="font-size:12px; color:var(--mut); font-weight:normal;">(${school.type})</span></h3>
      <button class="btn" style="background:#fee2e2; color:#ef4444; border:none; padding:4px 8px; font-size:12px;" data-code="${school.code}" onclick="ssRemoveSchool(this.getAttribute('data-code'))">삭제</button>
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:center;">
        <thead>
          <tr style="background:var(--bg); border-bottom:1px solid var(--bdr);">
            <th style="padding:10px; border-right:1px solid var(--bdr);">학년</th>
            <th style="padding:10px; border-right:1px solid var(--bdr);">전체 학생 수<br><span style="font-size:10px; color:var(--mut); font-weight:normal;">(학교알리미 API, 수정 가능)</span></th>
            <th style="padding:10px; border-right:1px solid var(--bdr);">우리 학원생 수</th>
            <th style="padding:10px;">점유율</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  let sumTotal = 0;
  let sumOurs = 0;

  for (let i = 1; i <= school.maxGrade; i++) {
    const data = school.grades[i];
    sumTotal += data.total;
    sumOurs += data.ours;
    const percent = data.total > 0 ? ((data.ours / data.total) * 100).toFixed(1) : '0.0';
    
    html += `
      <tr style="border-bottom:1px solid var(--bdr);">
        <td style="padding:10px; border-right:1px solid var(--bdr); font-weight:bold;">${i}학년</td>
        <td style="padding:10px; border-right:1px solid var(--bdr);">
          <input type="number" min="0" class="set-input" style="width:70px; text-align:center; padding:4px;" value="${data.total || ''}" onchange="ssUpdateData('${school.code}', ${i}, 'total', this.value)">
        </td>
        <td style="padding:10px; border-right:1px solid var(--bdr);">
          <input type="number" min="0" class="set-input" style="width:70px; text-align:center; padding:4px;" value="${data.ours || ''}" onchange="ssUpdateData('${school.code}', ${i}, 'ours', this.value)">
        </td>
        <td style="padding:10px;">
          <div style="font-weight:bold; color:${percent > 0 ? 'var(--acc)' : 'var(--mut)'}">${percent}%</div>
          <div style="width:100%; background:var(--bg); height:6px; border-radius:3px; margin-top:4px; overflow:hidden;">
            <div style="width:${Math.min(percent, 100)}%; background:var(--acc); height:100%;"></div>
          </div>
        </td>
      </tr>
    `;
  }
  
  // Total Row
  const totalPercent = sumTotal > 0 ? ((sumOurs / sumTotal) * 100).toFixed(1) : '0.0';
  html += `
        <tr style="background:#f8fafc; font-weight:bold;">
          <td style="padding:10px; border-right:1px solid var(--bdr);">합계</td>
          <td style="padding:10px; border-right:1px solid var(--bdr);">${sumTotal}명</td>
          <td style="padding:10px; border-right:1px solid var(--bdr);">${sumOurs}명</td>
          <td style="padding:10px; color:var(--acc);">${totalPercent}%</td>
        </tr>
        </tbody>
      </table>
    </div>
  `;
  
  card.innerHTML = html;
}

// 초기화 시 백엔드에서 데이터 로드
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
      ssSchools = JSON.parse(json.data);
      ssRenderSchools();
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

    const jsonData = JSON.stringify(ssSchools);
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
