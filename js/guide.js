// 사용법 가이드 — 좌측 목차 클릭 시 우측 콘텐츠로 스크롤 이동.
function guideScrollTo(id) {
  var target = document.getElementById(id);
  var area = document.getElementById('guide-scroll-area');
  if (!target || !area) return;
  var delta = target.getBoundingClientRect().top - area.getBoundingClientRect().top;
  area.scrollTo({ top: area.scrollTop + delta - 8, behavior: 'smooth' });
}
