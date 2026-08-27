// gas/blog_tracker.gs 이전 — 블로그 저장/조회 + 로그인/사용량 제한 + Claude·Gemini·OpenAI 프록시.
// 클라이언트(js/common.js)는 전혀 수정 불필요 — GAS 웹앱 URL 자리에 이 워커의 URL만 넣으면 됨.
import { getValues, appendRow, updateRow, getSheetRowCount } from './sheets.js';

const USERS_SHEET = 'users';
const BLOG_SHEET = 'blog_posts';
const FEEDBACK_SHEET = 'feedback';
const DAILY_BLOG_LIMIT = 5;
const RECENT_SCAN_ROWS = 500;

const AUTHED_ACTIONS = ['login', 'myPosts', 'quotaStatus', 'claudeProxy', 'geminiProxy', 'feedbackList', 'feedbackPost', 'feedbackReply', 'loadSchoolShare', 'saveSchoolShare', 'schoolShareSearch'];
const SCHOOL_SHARE_SHEET = 'school_share';

// ── AI 설정 — gas/blog_tracker.gs에서 그대로 포팅 (전부 "config" 시트 하나로 관리) ──
// 활성 프로바이더를 따로 고르지 않음 — API 키가 채워진 행이 곧 쓰이는 AI다. 여러 개가 채워져 있으면
// AI_PROVIDERS 선언 순서(claude → gemini → openai)대로 가장 먼저 키가 있는 걸 사용한다.
const CONFIG_SHEET = 'config';
const AI_PROVIDERS = ['claude', 'gemini', 'openai'];
const AI_KEY_PROP = { claude: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY', openai: 'OPENAI_API_KEY' };
const AI_DEFAULT_MODEL = { claude: 'claude-sonnet-5', gemini: 'gemini-3.6-flash', openai: 'gpt-5.6-terra' };
const AI_MODEL_CATALOG = {
  claude: ['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001', 'claude-fable-5'],
  gemini: ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash', 'gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'],
  openai: ['gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5.6-luna']
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
  });
}

// AI 프로바이더(Claude/Gemini/OpenAI) 자체가 거부/실패한 경우 502로 응답해 Cloudflare
// Analytics의 "Workers 오류"에 잡히게 함 — 클라이언트는 상태코드를 안 보고 json.ok만 보므로
// (_fetchGasJson) 동작에는 영향 없음, 순수 관측성 개선.
function aiJsonResponse(data) {
  return jsonResponse(data, data && data.upstreamError ? 502 : 200);
}

function todayKST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

function nowKST() {
  const d = new Date();
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return date + ' ' + time;
}

function rowDateKST(val) {
  return String(val || '').substring(0, 10);
}

// ── users 시트 ──────────────────────────────────────────────────
async function findUser(env, id) {
  const rows = await getValues(env, USERS_SHEET + '!A2:G');
  for (const r of rows) {
    if (String(r[0]) === String(id)) {
      return { id: r[0], password: r[1], name: r[2], academy: r[3], status: r[4], role: r[5], dailyLimit: r[6] };
    }
  }
  return null;
}

function getDailyLimitFor(user) {
  if (!user) return DAILY_BLOG_LIMIT;
  if (String(user.role) === '관리자') return null; // 무제한
  const n = parseInt(user.dailyLimit, 10);
  return (!isNaN(n) && n > 0) ? n : DAILY_BLOG_LIMIT;
}

async function registerUser(env, id, password, name, academy, site) {
  if (!id || !password || !name || !academy) return { ok: false, error: '모든 항목을 입력하세요.' };
  if (site === 'dev') return { ok: false, error: '이 주소는 개발용입니다. 정식 주소에서 가입해주세요.' };
  const existing = await findUser(env, id);
  if (existing) return { ok: false, error: '이미 사용 중인 아이디입니다.' };
  await appendRow(env, USERS_SHEET, [id, password, name, academy, '사용', '', DAILY_BLOG_LIMIT]);
  return { ok: true };
}

async function verifyUser(env, id, password, site) {
  const u = await findUser(env, id);
  if (!u) return { valid: false, error: '존재하지 않는 아이디입니다.' };
  if (String(u.status) !== '사용') return { valid: false, error: '비활성화된 계정입니다. 관리자에게 문의하세요.' };
  if (String(u.password) !== String(password)) return { valid: false, error: '비밀번호가 일치하지 않습니다.' };
  if (site === 'dev' && String(u.role) !== '관리자') return { valid: false, error: '이 주소는 개발용입니다.' };
  return { valid: true, name: u.name, academy: u.academy, role: u.role };
}

// ── blog_posts 시트 ─────────────────────────────────────────────
async function recentBlogRows(env) {
  const lastRow = await getSheetRowCount(env, BLOG_SHEET);
  const startRow = Math.max(2, lastRow - RECENT_SCAN_ROWS + 1);
  return getValues(env, BLOG_SHEET + '!A' + startRow + ':M' + lastRow);
}

// 컬럼 순서: 날짜(0)~구조(8), 목표분량(9), 섹션가이드(10), 프롬프트버전(11), 작성자(12)
async function countTodayPosts(env, userId) {
  const rows = await recentBlogRows(env);
  const today = todayKST();
  let count = 0;
  for (const row of rows) {
    if (rowDateKST(row[0]) === today && String(row[12] || '') === String(userId)) count++;
  }
  return count;
}

async function getMyPosts(env, userId, n) {
  const rows = await getValues(env, BLOG_SHEET + '!A2:M');
  return rows
    .filter((r) => String(r[12] || '') === String(userId))
    .reverse()
    .slice(0, Math.min(n || 100, 100))
    .map((r) => ({
      date: rowDateKST(r[0]), type: r[1] || '', mood: r[2] || '', topic: r[3] || '',
      keywords: r[4] || '', tags: r[5] || '', title: r[6] || '', body: r[7] || '', structure: r[8] || ''
    }));
}

async function getQuotaStatus(env, userId) {
  const count = await countTodayPosts(env, userId);
  const limit = getDailyLimitFor(await findUser(env, userId));
  if (limit === null) return { ok: true, count, limit: null, remaining: null, unlimited: true };
  return { ok: true, count, limit, remaining: Math.max(0, limit - count), unlimited: false };
}

async function savePost(env, data) {
  if (data.userId) {
    const v = await verifyUser(env, data.userId, data.userPw, data.site);
    if (!v.valid) return { ok: false, error: v.error };
    const limit = getDailyLimitFor(await findUser(env, data.userId));
    if (limit !== null && (await countTodayPosts(env, data.userId)) >= limit) {
      return { ok: false, error: '오늘 작성 가능 횟수(' + limit + '회)를 모두 사용했습니다.' };
    }
  }
  await appendRow(env, BLOG_SHEET, [
    nowKST(), data.type || '', data.mood || '', data.topic || '', data.keywords || '',
    data.tags || '', data.title || '', data.body || '', data.structure || '',
    data.targetLength || '', data.sectionGuide || '', data.promptVersion || '', data.userId || ''
  ]);
  return { ok: true };
}

// ── 피드백/문의 (게시판 형태, 스레드별로 본인+관리자만 조회 가능) ─────
async function allFeedbackRows(env) {
  return getValues(env, FEEDBACK_SHEET + '!A2:J');
}

async function getFeedbackThreads(env, userId, role) {
  const rows = await allFeedbackRows(env);
  const isAdmin = String(role) === '관리자';
  const byThread = {};
  const order = [];

  rows.forEach((row) => {
    const threadId = row[1];
    const ownerId = row[6];
    if (!isAdmin && String(ownerId) !== String(userId)) return;
    if (!byThread[threadId]) {
      byThread[threadId] = { threadId, ownerId, ownerName: row[7] || '', ownerAcademy: row[8] || '', messages: [] };
      order.push(threadId);
    }
    byThread[threadId].messages.push({
      id: row[0], date: row[2], authorId: row[3], authorName: row[4] || '', authorRole: row[5] || '', content: row[9] || ''
    });
  });

  const threads = order.map((id) => byThread[id]);
  threads.sort((a, b) => {
    const aLast = a.messages[a.messages.length - 1].date;
    const bLast = b.messages[b.messages.length - 1].date;
    return aLast < bLast ? 1 : aLast > bLast ? -1 : 0;
  });

  return { ok: true, threads };
}

async function postFeedback(env, userId, v, content) {
  if (!content) return { ok: false, error: '내용을 입력해주세요.' };
  const id = crypto.randomUUID();
  await appendRow(env, FEEDBACK_SHEET, [id, id, nowKST(), userId, v.name || userId, v.role || '', userId, v.name || userId, v.academy || '', content]);
  return { ok: true, threadId: id };
}

async function replyFeedback(env, userId, v, threadId, content) {
  if (!content) return { ok: false, error: '내용을 입력해주세요.' };
  if (!threadId) return { ok: false, error: '스레드 정보가 없습니다.' };

  const rows = await allFeedbackRows(env);
  const match = rows.find((r) => String(r[1]) === String(threadId));
  if (!match) return { ok: false, error: '스레드를 찾을 수 없습니다.' };
  const owner = { id: match[6], name: match[7], academy: match[8] };
  if (String(v.role) !== '관리자' && String(owner.id) !== String(userId)) {
    return { ok: false, error: '이 스레드에 답변할 권한이 없습니다.' };
  }

  const id = crypto.randomUUID();
  await appendRow(env, FEEDBACK_SHEET, [id, threadId, nowKST(), userId, v.name || userId, v.role || '', owner.id, owner.name, owner.academy, content]);
  return { ok: true };
}

// ── 학교 점유율 ────────────────────────────────────────────────
// userId로 school_share 시트에서 행 위치(2-based sheet row)를 찾음 — 없으면 null.
async function findSchoolShareRow(env, userId) {
  const rows = await getValues(env, SCHOOL_SHARE_SHEET + '!A2:C');
  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][1]) === String(userId)) return { rowNumber: i + 2, row: rows[i] };
  }
  return null;
}

async function loadSchoolShare(env, userId) {
  try {
    const found = await findSchoolShareRow(env, userId);
    return { ok: true, data: found ? found.row[2] : null };
  } catch (e) {
    return { ok: false, error: 'school_share 시트 접근 오류 (탭이 없거나 권한 문제)' };
  }
}

async function saveSchoolShare(env, userId, jsonData) {
  try {
    const found = await findSchoolShareRow(env, userId);
    if (found) {
      await updateRow(env, SCHOOL_SHARE_SHEET, found.rowNumber, [nowKST(), userId, jsonData]);
    } else {
      await appendRow(env, SCHOOL_SHARE_SHEET, [nowKST(), userId, jsonData]);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'school_share 시트 저장 오류' };
  }
}

// ── 학교알리미 OpenAPI (schoolinfo.go.kr) 프록시 ─────────────────────
// schoolinfo.go.kr가 Cloudflare 대역 트래픽을 차단해서(522, 실측 확인됨) Worker에서 직접 호출이
// 안 됨 — Anthropic/Google이 Workers를 막는 것과 같은 부류의 문제라, 여기서도 Cloudflare가 아닌
// 다른 네트워크(Vercel)를 한 번 더 거쳐 중계한다. 실제 schoolinfo.go.kr 호출·연도 폴백·apiType
// 0/09 병합 로직은 전부 marketingtool/vercel-schoolinfo-proxy/api/search.js 쪽에 있음.
async function schoolShareSearch(env, sidoCode, sggCode, schulKndCode) {
  if (!sidoCode || !sggCode || !schulKndCode) return { ok: false, error: '시/도, 시군구, 학교급을 모두 선택하세요.' };
  try {
    const url = env.SCHOOLINFO_PROXY_URL + '?token=' + encodeURIComponent(env.SCHOOLINFO_PROXY_TOKEN) +
      '&sidoCode=' + encodeURIComponent(sidoCode) + '&sggCode=' + encodeURIComponent(sggCode) + '&schulKndCode=' + encodeURIComponent(schulKndCode);
    const res = await fetch(url);
    return await res.json();
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// config 시트(A~C열: 설정/값/모델, E~F열: 프로바이더/모델 표) 조회 — gas/blog_tracker.gs의
// _getConfigValue/_getConfiguredModel/_getModelCatalogFromSheet/_getModelListForProvider/
// _getActiveProvider를 그대로 포팅. 매 호출마다 시트를 읽어서 관리자가 시트만 고치면
// 코드 재배포 없이 즉시 반영되는 기존 동작을 유지한다.
async function getConfigValue(env, key) {
  const rows = await getValues(env, CONFIG_SHEET + '!A2:C');
  for (const r of rows) {
    if (String(r[0]) === key && r[1]) return String(r[1]);
  }
  return '';
}

async function getConfiguredModel(env, provider) {
  const rows = await getValues(env, CONFIG_SHEET + '!A2:C');
  const keyRow = AI_KEY_PROP[provider];
  for (const r of rows) {
    if (String(r[0]) === keyRow && r[2]) return String(r[2]);
  }
  return AI_DEFAULT_MODEL[provider];
}

async function getModelListForProvider(env, provider) {
  const rows = await getValues(env, CONFIG_SHEET + '!E2:F');
  const list = [];
  rows.forEach((r) => {
    const p = String(r[0] || '').trim();
    const m = String(r[1] || '').trim();
    if (p === provider && m && list.indexOf(m) === -1) list.push(m);
  });
  return list.length ? list : (AI_MODEL_CATALOG[provider] || []);
}

async function getActiveProvider(env) {
  for (const p of AI_PROVIDERS) {
    if (await getConfigValue(env, AI_KEY_PROP[p])) return p;
  }
  return 'claude';
}

// Anthropic/Google이 Cloudflare Workers발 요청 자체를 차단·지역제한하는 문제가 있어(학교알리미 API도
// 같은 부류로 확인됨), 실제 AI 호출만은 Cloudflare가 아닌 Vercel(env.AI_RELAY_URL)로 중계한다.
// API 키는 여기서 매번 config 시트에서 조회해 함께 넘길 뿐, Vercel 쪽엔 저장하지 않는다 —
// "AI 키는 config 시트가 유일한 출처"라는 기존 설계 유지.
async function callAiRelay(env, body) {
  const res = await fetch(env.AI_RELAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: env.AI_RELAY_TOKEN, ...body })
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('AI 릴레이 응답 파싱 실패', res.status, text.slice(0, 300));
    return { ok: false, error: 'AI 릴레이 응답을 해석할 수 없습니다(HTTP ' + res.status + ')', upstreamError: true };
  }
}

// gas/blog_tracker.gs의 _aiProxy 포팅 — 활성 프로바이더(키가 채워진 첫 프로바이더)로 1회 호출.
// gemini가 활성인 경우에만 config 시트의 모델 목록 전체를 폴백용으로 함께 넘긴다.
async function claudeProxy(env, payload) {
  const provider = await getActiveProvider(env);
  const apiKey = await getConfigValue(env, AI_KEY_PROP[provider]);
  if (!apiKey) return { ok: false, error: 'config 시트에 ' + AI_KEY_PROP[provider] + ' 값이 아직 입력되지 않았습니다.' };
  const model = await getConfiguredModel(env, provider);
  const models = provider === 'gemini' ? [model, ...(await getModelListForProvider(env, provider)).filter((m) => m !== model)] : [model];
  return callAiRelay(env, {
    provider, apiKey, models,
    system: (payload && payload.system) || '',
    messages: (payload && payload.messages) || [],
    max_tokens: payload && payload.max_tokens
  });
}

// gas/blog_tracker.gs의 _geminiProxy 포팅 — 뉴스 소재추천/지역 트렌드 리포트 전용, 항상 Gemini만 사용.
async function geminiProxy(env, payload) {
  const apiKey = await getConfigValue(env, 'GEMINI_API_KEY');
  if (!apiKey) return { ok: false, error: 'config 시트에 GEMINI_API_KEY가 아직 설정되지 않았습니다.' };
  const preferred = await getConfiguredModel(env, 'gemini');
  const fallback = await getModelListForProvider(env, 'gemini');
  const models = [preferred, ...fallback.filter((m) => m !== preferred)];
  const result = await callAiRelay(env, {
    provider: 'gemini', apiKey, models,
    system: (payload && payload.system) || '',
    messages: [{ role: 'user', content: (payload && payload.content) || '' }],
    max_tokens: payload && payload.max_tokens
  });
  if (!result.ok) return result;
  return { ok: true, text: result.text, model: result.model };
}

// ── 네이버 블로그 본문 수집 (참고 URL 기능용) ──────────────────────
function normalizeNaverMobileUrl(url) {
  const raw = (url || '').trim();
  const m = raw.match(/blog\.naver\.com\/([^\/?#]+)\/(\d+)/);
  if (m) return 'https://m.blog.naver.com/PostView.naver?blogId=' + m[1] + '&logNo=' + m[2];
  const blogId = (raw.match(/[?&]blogId=([^&]+)/) || [])[1];
  const logNo = (raw.match(/[?&]logNo=([^&]+)/) || [])[1];
  if (blogId && logNo) return 'https://m.blog.naver.com/PostView.naver?blogId=' + blogId + '&logNo=' + logNo;
  return raw.replace('https://blog.naver.com', 'https://m.blog.naver.com').replace('http://blog.naver.com', 'https://m.blog.naver.com');
}

function extractNaverBlogText(html) {
  let body = html || '';
  let markerIdx = body.indexOf('class="se-main-container');
  if (markerIdx === -1) markerIdx = body.indexOf("class='se-main-container");
  if (markerIdx === -1) markerIdx = body.indexOf('id="postViewArea');
  if (markerIdx === -1) markerIdx = body.indexOf('se-main-container');
  if (markerIdx >= 0) {
    const start = Math.max(0, markerIdx - 50);
    body = body.substring(start, start + 150000);
  }
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .split('\n').map((l) => l.trim()).filter((l) => l.length > 1).join('\n');
}

async function fetchNaverBlogContent(url) {
  if (!url) return { ok: false, error: 'URL 없음' };
  try {
    const res = await fetch(normalizeNaverMobileUrl(url), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        Referer: 'https://m.blog.naver.com/'
      }
    });
    const html = await res.text();
    const text = extractNaverBlogText(html);
    if (!text) return { ok: false, error: '본문을 찾을 수 없습니다.' };
    return { ok: true, content: text.substring(0, 3000) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── 라우팅 ────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    try {
      if (request.method === 'GET') {
        const url = new URL(request.url);
        const p = url.searchParams;
        if (p.get('token') !== env.SHARED_TOKEN) return jsonResponse({ error: 'Unauthorized' }, 401);
        const action = p.get('action') || 'get';
        if (action === 'fetchNaverBlog') return jsonResponse(await fetchNaverBlogContent(p.get('url') || ''));

        const n = Math.min(parseInt(p.get('n') || '20', 10), 100);
        const rows = await getValues(env, BLOG_SHEET + '!A2:I');
        const posts = rows.slice(-n).reverse().map((r) => ({
          date: rowDateKST(r[0]), type: r[1] || '', mood: r[2] || '', topic: r[3] || '',
          keywords: r[4] || '', tags: r[5] || '', title: r[6] || '', body: r[7] || '', structure: r[8] || ''
        }));
        return jsonResponse({ posts });
      }

      const data = await request.json();

      if (data.action === 'register') {
        if (data.token !== env.SHARED_TOKEN) return jsonResponse({ ok: false, error: 'Unauthorized' });
        return jsonResponse(await registerUser(env, data.userId, data.userPw, data.name || '', data.academy || '', data.site));
      }

      if (AUTHED_ACTIONS.includes(data.action)) {
        if (data.token !== env.SHARED_TOKEN) return jsonResponse({ ok: false, error: 'Unauthorized' });
        const v = await verifyUser(env, data.userId, data.userPw, data.site);
        if (!v.valid) return jsonResponse({ ok: false, error: v.error });
        if (data.action === 'login') return jsonResponse({ ok: true, name: v.name, academy: v.academy, role: v.role || '' });
        if (data.action === 'myPosts') return jsonResponse({ ok: true, posts: await getMyPosts(env, data.userId, data.n || 100) });
        if (data.action === 'quotaStatus') return jsonResponse(await getQuotaStatus(env, data.userId));
        if (data.action === 'claudeProxy') return aiJsonResponse(await claudeProxy(env, data.payload));
        if (data.action === 'geminiProxy') return aiJsonResponse(await geminiProxy(env, data.payload));
        if (data.action === 'feedbackList') return jsonResponse(await getFeedbackThreads(env, data.userId, v.role || ''));
        if (data.action === 'feedbackPost') return jsonResponse(await postFeedback(env, data.userId, v, data.content || ''));
        if (data.action === 'feedbackReply') return jsonResponse(await replyFeedback(env, data.userId, v, data.threadId || '', data.content || ''));
        if (data.action === 'loadSchoolShare') return jsonResponse(await loadSchoolShare(env, data.userId));
        if (data.action === 'saveSchoolShare') return jsonResponse(await saveSchoolShare(env, data.userId, data.jsonData || ''));
        if (data.action === 'schoolShareSearch') return jsonResponse(await schoolShareSearch(env, data.sidoCode || '', data.sggCode || '', data.schulKndCode || ''));
      }

      if (data.token !== env.SHARED_TOKEN) return jsonResponse({ error: 'Unauthorized' });
      return jsonResponse(await savePost(env, data));
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  }
};
