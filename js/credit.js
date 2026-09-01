// ── 크레딧 현황 페이지 (js/common.js 로드 후 동작) ──────────────────
// getCreditStatus()/getCreditHistory()(둘 다 common.js)로 잔액·사용 내역을 가져와 표시.

function creditEsc(str) {
  return String(str == null ? '' : str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function creditInit() {
  if (typeof creditUpdateBadge === 'function') creditUpdateBadge();
  var balEl = document.getElementById('credit-balance-num');
  var unitEl = document.getElementById('credit-balance-unit');
  var bodyEl = document.getElementById('credit-history-body');
  var emptyEl = document.getElementById('credit-history-empty');
  if (!balEl) return;

  balEl.textContent = '...';
  if (bodyEl) bodyEl.innerHTML = '';
  if (emptyEl) emptyEl.style.display = 'none';

  try {
    var status = await getCreditStatus();
    if (!status || status.unlimited) {
      balEl.textContent = '무제한';
      if (unitEl) unitEl.style.display = 'none';
    } else {
      balEl.textContent = status.remaining;
      if (unitEl) { unitEl.style.display = ''; unitEl.textContent = '크레딧'; }
    }
  } catch (e) {
    balEl.textContent = '오류';
  }

  try {
    var items = await getCreditHistory(50);
    if (!items.length) {
      if (emptyEl) emptyEl.style.display = '';
      return;
    }
    if (bodyEl) {
      bodyEl.innerHTML = items.map(function(it) {
        var delta = parseInt(it.delta, 10) || 0;
        var deltaHtml = '<span style="color:' + (delta > 0 ? '#16a34a' : 'var(--txt)') + ';font-weight:700;">' + (delta > 0 ? '+' : '') + delta + '</span>';
        return '<tr style="border-bottom:1px solid var(--bdr);">' +
          '<td style="padding:10px;">' + creditEsc(it.date) + '</td>' +
          '<td style="padding:10px;">' + creditEsc(it.type) + '</td>' +
          '<td style="padding:10px;">' + creditEsc(it.item) + '</td>' +
          '<td style="padding:10px;text-align:right;">' + deltaHtml + '</td>' +
          '<td style="padding:10px;text-align:right;">' + creditEsc(it.remaining) + '</td>' +
        '</tr>';
      }).join('');
    }
  } catch (e) {
    if (emptyEl) { emptyEl.style.display = ''; emptyEl.textContent = '사용 내역을 불러오지 못했습니다.'; }
  }
}

function creditRefresh() {
  creditInit();
}

// 사이드바 "크레딧" 메뉴 옆 잔액 뱃지 — 로그인 직후·크레딧 사용 직후에도 갱신되도록
// hideLoginOverlay()/useCredit()(둘 다 common.js)에서 호출한다.
async function creditUpdateBadge() {
  var badge = document.getElementById('nav-credit-badge');
  if (!badge || typeof getUserAuth !== 'function' || !getUserAuth()) return;
  try {
    var status = await getCreditStatus();
    if (!status) { badge.style.display = 'none'; return; }
    badge.textContent = status.unlimited ? '무제한' : status.remaining;
    badge.style.display = '';
  } catch (e) { badge.style.display = 'none'; }
}
