// gas/news_tracker.gs 이전 — 네이버 뉴스 검색 오픈API로 최근 교육 뉴스 조회.
// 소재 추천 자체(Gemini 호출)는 blog-tracker의 geminiProxy를 그대로 쓴다 —
// 여기는 순수 "뉴스 목록 조회"만 담당(gas 버전과 동일한 역할 분리).

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
  });
}

const NEWS_QUERIES = [
  '수학교육', '입시정책', '선행학습', '고교학점제', '내신',
  '수능', '자사고', '특목고', '영재학교', '과학고',
  '외고', '국제고', '초등수학', '중등수학', '고등수학'
];
const NEWS_MAX_DAYS = 30;
const NEWS_PER_QUERY_DISPLAY = 30;

function stripTags(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function getEducationNews(env) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - NEWS_MAX_DAYS);
  const seen = {};
  const items = [];
  const debug = [];

  // GAS는 UrlFetchApp이 동기라 쿼리를 순차 호출했지만, Workers의 fetch는 비동기라
  // 전부 동시에 보내도 됨(정렬은 마지막에 한 번에 하므로 순서 무관) — 응답 속도 개선.
  await Promise.all(NEWS_QUERIES.map(async (q) => {
    try {
      const url = 'https://openapi.naver.com/v1/search/news.json'
        + '?query=' + encodeURIComponent(q)
        + '&display=' + NEWS_PER_QUERY_DISPLAY + '&sort=date';
      const res = await fetch(url, {
        headers: {
          'X-Naver-Client-Id': env.NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET
        }
      });
      if (!res.ok) {
        debug.push({ query: q, status: res.status, body: (await res.text()).slice(0, 200) });
        return;
      }
      const json = await res.json();
      const rawCount = (json.items || []).length;
      let kept = 0;
      (json.items || []).forEach((it) => {
        const pub = new Date(it.pubDate);
        if (isNaN(pub.getTime()) || pub < cutoff) return;
        const link = it.originallink || it.link;
        if (!link || seen[link]) return;
        seen[link] = true;
        kept++;
        items.push({ title: stripTags(it.title), description: stripTags(it.description), link, pubDate: it.pubDate, query: q });
      });
      debug.push({ query: q, status: 200, raw: rawCount, kept });
    } catch (err) {
      debug.push({ query: q, error: String(err) });
    }
  }));

  items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  return { items, debug };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    const url = new URL(request.url);
    const p = url.searchParams;
    if (p.get('token') !== env.SHARED_TOKEN) return jsonResponse({ error: 'Unauthorized' }, 401);
    const action = p.get('action') || '';
    if (action === 'getEducationNews') return jsonResponse(await getEducationNews(env));
    return jsonResponse({ error: '알 수 없는 action' });
  }
};
