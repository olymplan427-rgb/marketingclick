// 사용법 가이드 — 좌측 목차 클릭 시 해당 섹션만 표시(탭 방식).
function guideShow(id, navEl) {
  document.querySelectorAll('#page-guide .guide-section').forEach(function(s) { s.style.display = 'none'; });
  var target = document.getElementById(id);
  if (target) target.style.display = '';
  document.querySelectorAll('#page-guide .guide-toc-item').forEach(function(i) { i.classList.remove('active'); });
  if (navEl) navEl.classList.add('active');
  var area = document.getElementById('guide-scroll-area');
  if (area) area.scrollTop = 0;
}
