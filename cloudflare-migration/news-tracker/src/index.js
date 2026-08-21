// gas/news_tracker.gs 이전 — 네이버 뉴스 검색 오픈API로 최근 교육 뉴스 조회 +
// 지역+수학학원 블로그 조회(지역 트렌드 리포트용). 소재 추천/분류 자체(Gemini 호출)는
// blog-tracker의 geminiProxy를 그대로 쓴다 — 여기는 순수 "블로그/뉴스 목록 조회"만 담당.

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

const REGION_BLOG_MAX_DAYS = 90;  // 최근 3개월 — 월별로 나눠 보기에 충분한 기간
const REGION_BLOG_DISPLAY = 100;  // 네이버 블로그 검색 API 최대 허용치

// 단일 쿼리("{구/군/시} 수학학원")로 최대 100건을 가져온 뒤 최근 REGION_BLOG_MAX_DAYS일만 남긴다.
// 실제로 어떤 글이 "진짜 수학학원 소식"인지 거르는 건 클라이언트가 Gemini로 처리한다.
async function searchRegionAcademyBlogs(env, region) {
  if (!region) return { error: '지역 정보 없음' };

  // "서울 중랑구"처럼 시/도 접두어까지 붙이면 네이버 검색이 AND 조건이라 결과가
  // 과도하게 좁아져 최신 글이 다 걸러지는 문제가 실측으로 확인됨 — 마지막 토큰
  // (구/군/시 단위)만 남겨서 검색한다. 화면에 보여주는 지역 표시(region)는 그대로 유지.
  const districtOnly = region.trim().split(/\s+/).pop() || region;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - REGION_BLOG_MAX_DAYS);

  try {
    const url = 'https://openapi.naver.com/v1/search/blog.json'
      + '?query=' + encodeURIComponent(districtOnly + ' 수학학원')
      + '&display=' + REGION_BLOG_DISPLAY + '&sort=date';
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': env.NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET
      }
    });
    if (!res.ok) {
      return { items: [], debug: { status: res.status, body: (await res.text()).slice(0, 200) } };
    }
    const json = await res.json();
    const items = (json.items || [])
      .map((it) => ({
        title: stripTags(it.title),
        description: stripTags(it.description),
        link: it.link,
        bloggername: it.bloggername || '',
        postdate: it.postdate || '' // "20260602"
      }))
      .filter((it) => {
        if (!it.postdate || it.postdate.length !== 8) return true; // 날짜 파싱 불가하면 일단 포함
        const d = new Date(Number(it.postdate.slice(0, 4)), Number(it.postdate.slice(4, 6)) - 1, Number(it.postdate.slice(6, 8)));
        return d >= cutoff;
      });
    return { items };
  } catch (err) {
    return { items: [], error: String(err) };
  }
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
    if (action === 'regionAcademyBlogs') return jsonResponse(await searchRegionAcademyBlogs(env, p.get('region') || ''));
    return jsonResponse({ error: '알 수 없는 action' });
  }
};
