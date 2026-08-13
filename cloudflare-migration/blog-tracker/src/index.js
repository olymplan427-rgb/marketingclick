// gas/blog_tracker.gs 이전 — 블로그 저장/조회 + 로그인/사용량 제한 + Claude·Gemini·OpenAI 프록시.
// 클라이언트(js/common.js)는 전혀 수정 불필요 — GAS 웹앱 URL 자리에 이 워커의 URL만 넣으면 됨.
import { getValues, appendRow, getSheetRowCount } from './sheets.js';

const USERS_SHEET = 'users';
const BLOG_SHEET = 'blog_posts';
const CONFIG_SHEET = 'config';
const FEEDBACK_SHEET = 'feedback';
const DAILY_BLOG_LIMIT = 5;
const RECENT_SCAN_ROWS = 500;

const AI_PROVIDERS = ['claude', 'gemini', 'openai'];
const AI_KEY_PROP = { claude: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY', openai: 'OPENAI_API_KEY' };
const AI_DEFAULT_MODEL = { claude: 'claude-sonnet-5', gemini: 'gemini-3.6-flash', openai: 'gpt-5.6-terra' };
const GEMINI_MODEL_FALLBACK = [
  'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash', 'gemini-2.5-flash',
  'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'
];
const AUTHED_ACTIONS = ['login', 'myPosts', 'quotaStatus', 'claudeProxy', 'geminiProxy', 'feedbackList', 'feedbackPost', 'feedbackReply'];

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
  });
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

// ── config 시트 (AI 프로바이더/모델) ────────────────────────────
async function getConfigRows(env) {
  return getValues(env, CONFIG_SHEET + '!A1:C');
}

async function getConfigValue(env, key) {
  const rows = await getConfigRows(env);
  for (const r of rows) {
    if (String(r[0]) === key && r[1]) return String(r[1]);
  }
  return '';
}

async function getConfiguredModel(env, provider) {
  const rows = await getConfigRows(env);
  const keyRow = AI_KEY_PROP[provider];
  for (const r of rows) {
    if (String(r[0]) === keyRow && r[2]) return String(r[2]);
  }
  return AI_DEFAULT_MODEL[provider];
}

async function getActiveProvider(env) {
  for (const p of AI_PROVIDERS) {
    if (await getConfigValue(env, AI_KEY_PROP[p])) return p;
  }
  return 'claude';
}

// ── AI 프록시 ────────────────────────────────────────────────────
async function callClaude(apiKey, model, payload) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model, max_tokens: (payload && payload.max_tokens) || 2048,
      system: (payload && payload.system) || '', messages: (payload && payload.messages) || []
    })
  });
  const json = await res.json();
  if (!res.ok) return { ok: false, error: (json.error && json.error.message) || ('Claude API 오류 ' + res.status) };
  const textBlock = (json.content || []).find((b) => b && b.text);
  if (!textBlock) return { ok: false, error: 'Claude 빈 응답(텍스트 블록 없음) — max_tokens을 늘려보세요.' };
  return { ok: true, data: { content: [textBlock] } };
}

function toGeminiParts(content) {
  if (typeof content === 'string') return [{ text: content }];
  return (content || []).map((b) =>
    b.type === 'image' ? { inlineData: { mimeType: b.source.media_type, data: b.source.data } } : { text: b.text || '' }
  );
}

async function callGeminiGeneral(apiKey, model, payload) {
  const messages = (payload && payload.messages) || [];
  const lastUser = messages[messages.length - 1] || {};
  const parts = toGeminiParts(lastUser.content);
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { maxOutputTokens: (payload && payload.max_tokens) || 3500, temperature: 0.7 }
  };
  if (payload && payload.system) body.systemInstruction = { parts: [{ text: payload.system }] };

  const models = model ? [model, ...GEMINI_MODEL_FALLBACK.filter((m) => m !== model)] : GEMINI_MODEL_FALLBACK;
  let lastErr = null;
  for (const m of models) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + apiKey;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) { lastErr = (json.error && json.error.message) || ('Gemini API 오류 ' + res.status); continue; }
    const text = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0] && json.candidates[0].content.parts[0].text;
    if (!text) { lastErr = 'Gemini 빈 응답(안전 필터에 걸렸을 수 있습니다)'; continue; }
    return { ok: true, data: { content: [{ text }] }, modelUsed: m };
  }
  return { ok: false, error: lastErr || 'Gemini 모든 모델 실패' };
}

function toOpenAiContent(content) {
  if (typeof content === 'string') return content;
  return (content || []).map((b) =>
    b.type === 'image' ? { type: 'image_url', image_url: { url: 'data:' + b.source.media_type + ';base64,' + b.source.data } } : { type: 'text', text: b.text || '' }
  );
}

async function callOpenAiGeneral(apiKey, model, payload) {
  const messages = (payload && payload.messages) || [];
  const oaMessages = [];
  if (payload && payload.system) oaMessages.push({ role: 'system', content: payload.system });
  messages.forEach((m) => oaMessages.push({ role: m.role || 'user', content: toOpenAiContent(m.content) }));
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
    body: JSON.stringify({ model, max_tokens: (payload && payload.max_tokens) || 2048, messages: oaMessages })
  });
  const json = await res.json();
  if (!res.ok) return { ok: false, error: (json.error && json.error.message) || ('OpenAI API 오류 ' + res.status) };
  const text = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  if (!text) return { ok: false, error: 'OpenAI 빈 응답' };
  return { ok: true, data: { content: [{ text }] } };
}

async function aiProxy(env, payload) {
  const provider = await getActiveProvider(env);
  const model = await getConfiguredModel(env, provider);
  const apiKey = await getConfigValue(env, AI_KEY_PROP[provider]);
  if (!apiKey) return { ok: false, error: 'config 시트에 ' + AI_KEY_PROP[provider] + ' 값이 아직 입력되지 않았습니다.' };
  try {
    if (provider === 'gemini') return await callGeminiGeneral(apiKey, model, payload);
    if (provider === 'openai') return await callOpenAiGeneral(apiKey, model, payload);
    return await callClaude(apiKey, model, payload);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function geminiProxy(env, payload) {
  const apiKey = await getConfigValue(env, 'GEMINI_API_KEY');
  if (!apiKey) return { ok: false, error: 'config 시트에 GEMINI_API_KEY가 아직 설정되지 않았습니다.' };
  const preferred = (await getConfiguredModel(env, 'gemini')) || (payload && payload.model);
  const models = preferred ? [preferred, ...GEMINI_MODEL_FALLBACK.filter((m) => m !== preferred)] : GEMINI_MODEL_FALLBACK;

  let lastErr = null;
  try {
    for (const model of models) {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: (payload && payload.system) || '' }] },
          contents: [{ role: 'user', parts: [{ text: (payload && payload.content) || '' }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: (payload && payload.max_tokens) || 3500 }
        })
      });
      const json = await res.json();
      if (!res.ok) { lastErr = (json.error && json.error.message) || ('Gemini API 오류 ' + res.status); continue; }
      const text = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0] && json.candidates[0].content.parts[0].text;
      if (!text) { lastErr = 'Gemini 빈 응답 (안전 필터에 걸렸을 수 있습니다)'; continue; }
      return { ok: true, text, model };
    }
    return { ok: false, error: lastErr || '모든 모델 실패' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
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

      if (AUTHED_ACTIONS.includes(data.action)) {
        if (data.token !== env.SHARED_TOKEN) return jsonResponse({ ok: false, error: 'Unauthorized' });
        const v = await verifyUser(env, data.userId, data.userPw, data.site);
        if (!v.valid) return jsonResponse({ ok: false, error: v.error });
        if (data.action === 'login') return jsonResponse({ ok: true, name: v.name, academy: v.academy, role: v.role || '' });
        if (data.action === 'myPosts') return jsonResponse({ ok: true, posts: await getMyPosts(env, data.userId, data.n || 100) });
        if (data.action === 'quotaStatus') return jsonResponse(await getQuotaStatus(env, data.userId));
        if (data.action === 'claudeProxy') return jsonResponse(await aiProxy(env, data.payload));
        if (data.action === 'geminiProxy') return jsonResponse(await geminiProxy(env, data.payload));
        if (data.action === 'feedbackList') return jsonResponse(await getFeedbackThreads(env, data.userId, v.role || ''));
        if (data.action === 'feedbackPost') return jsonResponse(await postFeedback(env, data.userId, v, data.content || ''));
        if (data.action === 'feedbackReply') return jsonResponse(await replyFeedback(env, data.userId, v, data.threadId || '', data.content || ''));
      }

      if (data.token !== env.SHARED_TOKEN) return jsonResponse({ error: 'Unauthorized' });
      return jsonResponse(await savePost(env, data));
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  }
};
