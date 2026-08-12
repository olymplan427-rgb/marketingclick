// gas/mapsearch_tracker.gs 이전 — 카카오맵 장소별 블로그 리뷰 조회.
// Cloudflare Workers는 GAS의 실행 할당량 경합 문제가 없지만, 사용자 결정에 따라
// GAS와 동일하게 blog-tracker와 별도 워커로 유지한다.

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
  });
}

// 카카오맵 장소 상세페이지("블로그 리뷰" 탭)가 내부적으로 쓰는 비공식 API — 공식 문서화된
// API가 아니므로 카카오 쪽에서 예고 없이 스펙을 바꾸거나 막을 수 있음(gas 버전과 동일한 주의사항).
async function searchAcademyPosts(placeId) {
  if (!placeId) return { ok: false, error: '카카오맵 장소 정보 없음' };
  try {
    const url = 'https://place-api.map.kakao.com/places/panel3/' + encodeURIComponent(placeId);
    const res = await fetch(url, {
      headers: {
        appVersion: '6.6.0',
        pf: 'PC',
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://place.map.kakao.com/' + encodeURIComponent(placeId),
        Origin: 'https://place.map.kakao.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return { ok: false, error: '카카오맵 응답 실패 (HTTP ' + res.status + ')' };
    const json = await res.json();
    const reviews = (json.blog_review && json.blog_review.reviews) || [];
    const posts = reviews.map((r) => ({
      source: '블로그',
      title: r.title || '',
      link: r.origin_url || '',
      author: r.author || '',
      date: (r.registered_at || '').slice(0, 10).replace(/-/g, '.')
    }));
    return { ok: true, posts };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    try {
      const data = await request.json();
      if (data.token !== env.SHARED_TOKEN) return jsonResponse({ ok: false, error: 'Unauthorized' });
      if (data.action === 'searchAcademyPosts') return jsonResponse(await searchAcademyPosts(data.placeId || ''));
      return jsonResponse({ ok: false, error: '알 수 없는 action' });
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  }
};
