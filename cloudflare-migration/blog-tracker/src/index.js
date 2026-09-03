// 구글시트(sheets.js) → D1(SQLite) 전환 (2026-09-01) — 매 요청마다 걸리던 Google OAuth 재인증 +
// Sheets API 왕복이 없어지고, Worker 내부에서 로컬 SQLite 쿼리로 끝나 응답 속도가 크게 개선됨.
// 클라이언트(js/common.js)는 전혀 수정 불필요 — 액션/응답 형태 100% 동일하게 유지.
import { sendMail } from './mail.js';
const ADMIN_ACTIONS = ['adminListUsers', 'adminUpdateUser', 'adminApproveUser', 'adminGetConfig', 'adminSetConfigValue', 'adminSetModels', 'adminSetCreditCost', 'adminAddAnnouncement', 'adminUpdateAnnouncement', 'adminDeleteAnnouncement', 'adminListPosts', 'adminDeletePost', 'adminValidatePostAI', 'adminGetPostValidations', 'adminSetValidationDecision'];
const AUTHED_ACTIONS = ['login', 'myPosts', 'claudeProxy', 'geminiProxy', 'feedbackList', 'feedbackPost', 'feedbackReply', 'loadSchoolShare', 'saveSchoolShare', 'schoolShareSearch', 'useCredit', 'creditStatus', 'creditHistory', 'creditQuote', 'getAnnouncements', ...ADMIN_ACTIONS];

// 액션키별 기본 크레딧 소모량 — config_credit_costs 테이블에 값이 있으면 그쪽이 우선(코드 재배포
// 없이 D1 값만 바꿔 조정 가능, 기존 구글시트 config 표와 동일한 우선순위 패턴). 없을 때만 기본값 사용.
// 2026-09-03: 뉴스 기반/지역 트렌드 기반 소재추천을 버튼 하나(topic_suggest_combined)로 통합 —
// 기존 news_search/region_topic_search 두 키는 더 이상 별도로 호출되지 않아 제거.
const CREDIT_COST_DEFAULTS = {
  blog_generate: 3, blog_analyze: 1, blog_finalize: 3, image_promo: 1, image_download: 1,
  mapsearch_nearby: 1, report_generate: 5, topic_suggest_combined: 4
};
// 크레딧 사용 내역(credit_log)에 표시할 한글 이름 — config 표에 관리자가 적어둔 이름과 통일.
const ACTION_LABELS = {
  blog_generate: '블로그 초안 생성', blog_analyze: 'AI자율분석', blog_finalize: '블로그 최종안 생성',
  image_promo: '이미지 홍보문구 생성', image_download: '이미지 다운로드',
  mapsearch_nearby: '주변 학원 검색', report_generate: '지역 트렌드 리포트 생성',
  topic_suggest_combined: 'AI 소재추천(뉴스+지역 트렌드)'
};

// ── AI 설정 — 활성 프로바이더를 따로 고르지 않음 — API 키가 채워진 행이 곧 쓰이는 AI다. 여러 개가
// 채워져 있으면 AI_PROVIDERS 선언 순서(claude → gemini → openai)대로 가장 먼저 키가 있는 걸 사용한다.
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

function monthKST() {
  return todayKST().substring(0, 7); // 'YYYY-MM'
}

// ── users 테이블 ──────────────────────────────────────────────────
async function findUser(env, id) {
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!row) return null;
  return {
    id: row.id, password: row.password, name: row.name, academy: row.academy, status: row.status, role: row.role,
    monthlyCredit: row.monthly_credit, remainingCredit: row.remaining_credit, creditResetMonth: row.credit_reset_month
  };
}

const SIGNUP_CREDIT = 500;

// 2026-09-02: 관리자 승인제 기능은 구현해뒀지만(adminApproveUser 등) 당장은 끄고 즉시 가입 승인으로
// 되돌림 — false로 두면 예전처럼 가입 즉시 status='사용' + 크레딧 지급. 다시 켜려면 true로만 바꾸면 됨.
const REQUIRE_SIGNUP_APPROVAL = false;

async function registerUser(env, id, password, name, academy, site) {
  if (!id || !password || !name || !academy) return { ok: false, error: '모든 항목을 입력하세요.' };
  if (site === 'dev') return { ok: false, error: '이 주소는 개발용입니다. 정식 주소에서 가입해주세요.' };
  const existing = await findUser(env, id);
  if (existing) return { ok: false, error: '이미 사용 중인 아이디입니다.' };

  if (REQUIRE_SIGNUP_APPROVAL) {
    await env.DB.prepare(
      'INSERT INTO users (id,password,name,academy,status,role,monthly_credit,remaining_credit,credit_reset_month) VALUES (?,?,?,?,?,?,?,?,?)'
    ).bind(id, password, name, academy, '대기', '', null, null, null).run();
    await notifyAdminOfSignup(env, id, name, academy).catch((e) => console.error('가입 알림 메일 실패', e.message));
    return { ok: true, pending: true };
  }

  const currentMonth = monthKST();
  await env.DB.prepare(
    'INSERT INTO users (id,password,name,academy,status,role,monthly_credit,remaining_credit,credit_reset_month) VALUES (?,?,?,?,?,?,?,?,?)'
  ).bind(id, password, name, academy, '사용', '', SIGNUP_CREDIT, SIGNUP_CREDIT, currentMonth).run();
  await logCreditEvent(env, id, '충전', '신규 가입 지급', SIGNUP_CREDIT, SIGNUP_CREDIT);
  return { ok: true };
}

async function notifyAdminOfSignup(env, id, name, academy) {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD || !env.ADMIN_EMAIL) return;
  await sendMail(env, {
    to: env.ADMIN_EMAIL,
    subject: '[마케팅딸깍] 신규 가입 승인 대기 — ' + academy,
    html: '<p><b>' + name + '</b>(' + academy + ')님이 가입 신청했습니다.</p>'
      + '<p>아이디: ' + id + '</p>'
      + '<p>관리자 페이지 → 사용자 관리에서 승인해주세요.</p>'
  });
}

async function verifyUser(env, id, password, site) {
  const u = await findUser(env, id);
  if (!u) return { valid: false, error: '존재하지 않는 아이디입니다.' };
  if (String(u.status) === '대기') return { valid: false, error: '관리자 승인 대기 중인 계정입니다. 승인 후 이용해주세요.' };
  if (String(u.status) !== '사용') return { valid: false, error: '비활성화된 계정입니다. 관리자에게 문의하세요.' };
  if (String(u.password) !== String(password)) return { valid: false, error: '비밀번호가 일치하지 않습니다.' };
  if (site === 'dev' && String(u.role) !== '관리자') return { valid: false, error: '이 주소는 개발용입니다.' };
  return { valid: true, name: u.name, academy: u.academy, role: u.role };
}

// 관리자가 가입 승인 — 상태를 '사용'으로 바꾸고, 아직 크레딧을 받은 적 없는 계정에 한해 신규가입 크레딧 지급.
async function adminApproveUser(env, id) {
  if (!id) return { ok: false, error: 'id가 필요합니다.' };
  const u = await findUser(env, id);
  if (!u) return { ok: false, error: '사용자를 찾을 수 없습니다.' };
  const currentMonth = monthKST();
  const alreadyCredited = u.monthlyCredit !== null && u.monthlyCredit !== undefined;
  const monthlyCredit = alreadyCredited ? u.monthlyCredit : SIGNUP_CREDIT;
  const remainingCredit = alreadyCredited ? u.remainingCredit : SIGNUP_CREDIT;
  const resetMonth = alreadyCredited ? u.creditResetMonth : currentMonth;
  await env.DB.prepare('UPDATE users SET status=?, monthly_credit=?, remaining_credit=?, credit_reset_month=? WHERE id=?')
    .bind('사용', monthlyCredit, remainingCredit, resetMonth, id).run();
  if (!alreadyCredited) await logCreditEvent(env, id, '충전', '신규 가입 지급', SIGNUP_CREDIT, SIGNUP_CREDIT);
  return { ok: true };
}

// ── blog_posts 테이블 ─────────────────────────────────────────────
async function getMyPosts(env, userId, n) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM blog_posts WHERE user_id = ? ORDER BY id DESC LIMIT ?'
  ).bind(userId, Math.min(n || 100, 100)).all();
  return results.map((r) => ({
    date: rowDateKST(r.created_at), type: r.type || '', mood: r.mood || '', topic: r.topic || '',
    keywords: r.keywords || '', tags: r.tags || '', title: r.title || '', body: r.body || '', structure: r.structure || ''
  }));
}

// ── 크레딧 시스템 (2026-09) ─────────────────────────────────────
async function getCreditCost(env, actionKey) {
  const row = await env.DB.prepare('SELECT cost FROM config_credit_costs WHERE action_key = ?').bind(actionKey).first();
  if (row && row.cost !== null && row.cost !== undefined) return row.cost;
  return CREDIT_COST_DEFAULTS[actionKey] || 1;
}

// credit_log 테이블(append-only 로그) — blog_posts/feedback과 동일 패턴(school_share의 upsert와는 다름).
async function logCreditEvent(env, userId, type, item, delta, remaining) {
  await env.DB.prepare(
    'INSERT INTO credit_log (created_at,user_id,type,item,delta,remaining) VALUES (?,?,?,?,?,?)'
  ).bind(nowKST(), userId, type, item, delta, remaining).run();
}

// users.monthly_credit이 비어있으면 무제한 취급 — 관리자가 아직 값을 채우지 않은 기존 계정도
// 이번 변경으로 갑자기 막히지 않도록 하는 안전한 기본값.
async function useCredit(env, userId, actionKey) {
  if (!actionKey) return { ok: false, error: 'actionKey가 필요합니다.' };
  const u = await findUser(env, userId);
  if (!u) return { ok: false, error: '사용자를 찾을 수 없습니다.' };
  if (String(u.role) === '관리자') return { ok: true, unlimited: true };

  const monthlyCredit = parseInt(u.monthlyCredit, 10);
  if (isNaN(monthlyCredit) || monthlyCredit <= 0) return { ok: true, unlimited: true };

  const cost = await getCreditCost(env, actionKey);
  const currentMonth = monthKST();
  let remaining = parseInt(u.remainingCredit, 10);
  const needsReset = String(u.creditResetMonth || '') !== currentMonth || isNaN(remaining);
  if (needsReset) remaining = monthlyCredit; // lazy reset

  if (remaining < cost) {
    return { ok: false, error: '이번 달 크레딧이 부족합니다 (잔여 ' + remaining + ' / 필요 ' + cost + ').', remaining, monthlyCredit };
  }

  if (needsReset) await logCreditEvent(env, userId, '충전', '월 크레딧 리셋', monthlyCredit, monthlyCredit);
  remaining -= cost;
  await env.DB.prepare('UPDATE users SET remaining_credit = ?, credit_reset_month = ? WHERE id = ?')
    .bind(remaining, currentMonth, userId).run();
  await logCreditEvent(env, userId, '사용', ACTION_LABELS[actionKey] || actionKey, -cost, remaining);
  return { ok: true, remaining, monthlyCredit, cost };
}

// 사용 내역 조회(크레딧 페이지) — 본인 것만, 최신순.
async function getCreditHistory(env, userId, n) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM credit_log WHERE user_id = ? ORDER BY id DESC LIMIT ?'
  ).bind(userId, Math.min(n || 50, 100)).all();
  return { ok: true, items: results.map((r) => ({ date: r.created_at || '', type: r.type || '', item: r.item || '', delta: r.delta, remaining: r.remaining })) };
}

// 실제 차감 없이 "이 액션을 하면 얼마가 나가는지" 미리보기(사용 전 확인 팝업용).
async function getCreditQuote(env, userId, actionKey) {
  if (!actionKey) return { ok: false, error: 'actionKey가 필요합니다.' };
  const u = await findUser(env, userId);
  if (!u) return { ok: false, error: '사용자를 찾을 수 없습니다.' };
  if (String(u.role) === '관리자') return { ok: true, unlimited: true };
  const monthlyCredit = parseInt(u.monthlyCredit, 10);
  if (isNaN(monthlyCredit) || monthlyCredit <= 0) return { ok: true, unlimited: true };
  const cost = await getCreditCost(env, actionKey);
  const currentMonth = monthKST();
  let remaining = parseInt(u.remainingCredit, 10);
  if (String(u.creditResetMonth || '') !== currentMonth || isNaN(remaining)) remaining = monthlyCredit;
  return { ok: true, unlimited: false, cost, remaining, monthlyCredit };
}

// 차감 없이 현재 잔여 크레딧만 조회(설정 화면 표시용) — lazy reset 여부만 계산해서 보여주고 DB는 안 건드림.
async function getCreditStatus(env, userId) {
  const u = await findUser(env, userId);
  if (!u) return { ok: false, error: '사용자를 찾을 수 없습니다.' };
  if (String(u.role) === '관리자') return { ok: true, unlimited: true };
  const monthlyCredit = parseInt(u.monthlyCredit, 10);
  if (isNaN(monthlyCredit) || monthlyCredit <= 0) return { ok: true, unlimited: true };
  const currentMonth = monthKST();
  let remaining = parseInt(u.remainingCredit, 10);
  if (String(u.creditResetMonth || '') !== currentMonth || isNaN(remaining)) remaining = monthlyCredit;
  return { ok: true, unlimited: false, remaining, monthlyCredit };
}

async function savePost(env, data) {
  if (data.userId) {
    const v = await verifyUser(env, data.userId, data.userPw, data.site);
    if (!v.valid) return { ok: false, error: v.error };
    // 일일한도 차단은 크레딧 시스템으로 대체됨(2026-09) — 실제 차단은 blog_generate
    // 액션 호출 직전 useCredit()에서 처리. 여기선 더 이상 재검사하지 않는다.
  }
  await env.DB.prepare(
    `INSERT INTO blog_posts (created_at,type,mood,topic,keywords,tags,title,body,structure,target_length,section_guide,prompt_version,user_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    nowKST(), data.type || '', data.mood || '', data.topic || '', data.keywords || '',
    data.tags || '', data.title || '', data.body || '', data.structure || '',
    data.targetLength || '', data.sectionGuide || '', data.promptVersion || '', data.userId || ''
  ).run();
  return { ok: true };
}

// ── 피드백/문의 (게시판 형태, 스레드별로 본인+관리자만 조회 가능) ─────
async function getFeedbackThreads(env, userId, role) {
  const isAdmin = String(role) === '관리자';
  const { results } = isAdmin
    ? await env.DB.prepare('SELECT * FROM feedback ORDER BY created_at ASC').all()
    : await env.DB.prepare('SELECT * FROM feedback WHERE owner_id = ? ORDER BY created_at ASC').bind(userId).all();

  const byThread = {};
  const order = [];
  results.forEach((row) => {
    const threadId = row.thread_id;
    if (!byThread[threadId]) {
      byThread[threadId] = { threadId, ownerId: row.owner_id, ownerName: row.owner_name || '', ownerAcademy: row.owner_academy || '', messages: [] };
      order.push(threadId);
    }
    byThread[threadId].messages.push({
      id: row.id, date: row.created_at, authorId: row.author_id, authorName: row.author_name || '', authorRole: row.author_role || '', content: row.content || ''
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
  await env.DB.prepare(
    'INSERT INTO feedback (id,thread_id,created_at,author_id,author_name,author_role,owner_id,owner_name,owner_academy,content) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).bind(id, id, nowKST(), userId, v.name || userId, v.role || '', userId, v.name || userId, v.academy || '', content).run();
  return { ok: true, threadId: id };
}

async function replyFeedback(env, userId, v, threadId, content) {
  if (!content) return { ok: false, error: '내용을 입력해주세요.' };
  if (!threadId) return { ok: false, error: '스레드 정보가 없습니다.' };

  const match = await env.DB.prepare('SELECT owner_id, owner_name, owner_academy FROM feedback WHERE thread_id = ? LIMIT 1').bind(threadId).first();
  if (!match) return { ok: false, error: '스레드를 찾을 수 없습니다.' };
  const owner = { id: match.owner_id, name: match.owner_name, academy: match.owner_academy };
  if (String(v.role) !== '관리자' && String(owner.id) !== String(userId)) {
    return { ok: false, error: '이 스레드에 답변할 권한이 없습니다.' };
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO feedback (id,thread_id,created_at,author_id,author_name,author_role,owner_id,owner_name,owner_academy,content) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).bind(id, threadId, nowKST(), userId, v.name || userId, v.role || '', owner.id, owner.name, owner.academy, content).run();
  return { ok: true };
}

// ── 학교 점유율 ────────────────────────────────────────────────
async function loadSchoolShare(env, userId) {
  const row = await env.DB.prepare('SELECT data FROM school_share WHERE user_id = ?').bind(userId).first();
  return { ok: true, data: row ? row.data : null };
}

async function saveSchoolShare(env, userId, jsonData) {
  await env.DB.prepare(
    'INSERT INTO school_share (user_id,updated_at,data) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET updated_at=excluded.updated_at, data=excluded.data'
  ).bind(userId, nowKST(), jsonData).run();
  return { ok: true };
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

// config 테이블(key/value/model) + config_models(provider/model 목록) 조회 — 구글시트 config
// 탭의 A~C열/E~F열을 그대로 옮긴 구조. 관리자가 D1 값만 고치면 코드 재배포 없이 즉시 반영되는
// 동작은 그대로 유지(값 변경은 `wrangler d1 execute mtt-blog-tracker --remote --command=...`로 수행).
async function getConfigRow(env, key) {
  return env.DB.prepare('SELECT value, model FROM config WHERE key = ?').bind(key).first();
}

function pickActiveProviderRows(configRows) {
  for (const p of AI_PROVIDERS) {
    const row = configRows[AI_KEY_PROP[p]];
    if (row && row.value) return p;
  }
  return 'claude';
}

async function getAllConfigRows(env) {
  const { results } = await env.DB.prepare('SELECT key, value, model FROM config').all();
  const map = {};
  results.forEach((r) => { map[r.key] = { value: r.value, model: r.model }; });
  return map;
}

async function getModelListForProvider(env, provider) {
  const { results } = await env.DB.prepare('SELECT model FROM config_models WHERE provider = ? ORDER BY ord ASC').bind(provider).all();
  const list = results.map((r) => r.model).filter(Boolean);
  return list.length ? list : (AI_MODEL_CATALOG[provider] || []);
}

// Anthropic/Google이 Cloudflare Workers발 요청 자체를 차단·지역제한하는 문제가 있어(학교알리미 API도
// 같은 부류로 확인됨), 실제 AI 호출만은 Cloudflare가 아닌 Vercel(env.AI_RELAY_URL)로 중계한다.
// API 키는 여기서 매번 config 테이블에서 조회해 함께 넘길 뿐, Vercel 쪽엔 저장하지 않는다 —
// "AI 키는 config가 유일한 출처"라는 기존 설계 유지.
// ── 생성 요청 직렬화(2026-09) ────────────────────────────────────────────
// 여러 학원이 동시에 "생성" 버튼을 눌러도 Vercel 릴레이/AI API로는 한 번에 하나씩만
// 나가도록 D1의 gen_lock 행 하나로 뮤텍스를 구현한다(Durable Object 없이 무료 티어로 구현).
// UPDATE ... WHERE holder IS NULL 조건부 갱신이 원자적이라 두 요청이 동시에 시도해도
// 하나만 성공한다. 잠금을 오래 쥔 채로 죽은 요청(예: Worker 재시작)에 다른 사용자가
// 영원히 막히지 않도록, GEN_LOCK_STALE_MS보다 오래된 잠금은 남의 것이어도 새로 뺏어올 수 있게 한다.
const GEN_LOCK_STALE_MS = 120000; // 이 시간이 지난 잠금은 죽은 것으로 간주하고 뺏어옴
const GEN_LOCK_POLL_MS = 2000;    // 잠금 재시도 간격
const GEN_LOCK_MAX_WAIT_MS = 240000; // 최대 4분까지는 화면에 에러 없이 대기(그 이후만 진짜 실패로 처리)

async function tryAcquireGenLock(env, holderId) {
  const now = Date.now();
  const res = await env.DB.prepare(
    'UPDATE gen_lock SET holder = ?, acquired_at = ? WHERE id = 1 AND (holder IS NULL OR acquired_at < ?)'
  ).bind(holderId, now, now - GEN_LOCK_STALE_MS).run();
  return (res.meta && res.meta.changes) > 0;
}

async function releaseGenLock(env, holderId) {
  await env.DB.prepare('UPDATE gen_lock SET holder = NULL, acquired_at = NULL WHERE id = 1 AND holder = ?').bind(holderId).run();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 잠금을 얻을 때까지(또는 최대 대기시간까지) 조용히 기다린다 — 실패해도 사용자에게 바로
// 에러를 보여주지 않고 뒤에서 계속 재시도하길 원한다는 요구사항(2026-09)에 맞춘 설계.
async function runWithGenLock(env, task) {
  const holderId = crypto.randomUUID();
  const deadline = Date.now() + GEN_LOCK_MAX_WAIT_MS;
  let acquired = false;
  while (Date.now() < deadline) {
    if (await tryAcquireGenLock(env, holderId)) { acquired = true; break; }
    await sleep(GEN_LOCK_POLL_MS);
  }
  if (!acquired) {
    return { ok: false, error: '지금 다른 요청이 많아 처리가 지연되고 있습니다. 잠시 후 다시 시도해 주세요.' };
  }
  try {
    return await task();
  } finally {
    await releaseGenLock(env, holderId);
  }
}

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

// claudeProxy/adminValidatePostAI가 공유하는 "지금 활성 프로바이더가 뭔지" 조회 로직.
async function getActiveProviderConfig(env) {
  const configRows = await getAllConfigRows(env);
  const provider = pickActiveProviderRows(configRows);
  const apiKey = (configRows[AI_KEY_PROP[provider]] || {}).value;
  if (!apiKey) return { ok: false, error: 'config에 ' + AI_KEY_PROP[provider] + ' 값이 아직 입력되지 않았습니다.' };
  const model = (configRows[AI_KEY_PROP[provider]] || {}).model || AI_DEFAULT_MODEL[provider];
  const models = provider === 'gemini' ? [model, ...(await getModelListForProvider(env, provider)).filter((m) => m !== model)] : [model];
  return { ok: true, provider, apiKey, models };
}

// 활성 프로바이더(키가 채워진 첫 프로바이더)로 1회 호출.
// gemini가 활성인 경우에만 config의 모델 목록 전체를 폴백용으로 함께 넘긴다.
async function claudeProxy(env, payload) {
  const cfg = await getActiveProviderConfig(env);
  if (!cfg.ok) return cfg;
  return runWithGenLock(env, () => callAiRelay(env, {
    provider: cfg.provider, apiKey: cfg.apiKey, models: cfg.models,
    system: (payload && payload.system) || '',
    messages: (payload && payload.messages) || [],
    max_tokens: payload && payload.max_tokens
  }));
}

// 뉴스 소재추천/지역 트렌드 리포트 전용, 항상 Gemini만 사용.
async function geminiProxy(env, payload) {
  const row = await getConfigRow(env, 'GEMINI_API_KEY');
  const apiKey = row && row.value;
  if (!apiKey) return { ok: false, error: 'config에 GEMINI_API_KEY가 아직 설정되지 않았습니다.' };
  const preferred = (row && row.model) || AI_DEFAULT_MODEL.gemini;
  const fallback = await getModelListForProvider(env, 'gemini');
  const models = [preferred, ...fallback.filter((m) => m !== preferred)];
  const result = await runWithGenLock(env, () => callAiRelay(env, {
    provider: 'gemini', apiKey, models,
    system: (payload && payload.system) || '',
    messages: [{ role: 'user', content: (payload && payload.content) || '' }],
    max_tokens: payload && payload.max_tokens
  }));
  if (!result.ok) return result;
  return { ok: true, text: result.text, model: result.model };
}

// ── 관리자 페이지 (2026-09-01, D1 전환 후 시트 대신 여기서 설정 관리) ──────
// API 키는 클라이언트로 마스킹해서만 내려주고(앞 4자+뒤 4자), 저장 시 빈 값이면 기존 값을 유지한다
// — 화면에 평문 키를 그대로 노출하지 않으면서도 관리자가 값 존재 여부/일부는 확인 가능하게 함.
function maskSecret(v) {
  const s = String(v || '');
  if (s.length <= 8) return s ? '••••' : '';
  return s.slice(0, 4) + '••••' + s.slice(-4);
}

async function adminListUsers(env) {
  const { results } = await env.DB.prepare('SELECT id,name,academy,status,role,monthly_credit,remaining_credit,credit_reset_month FROM users ORDER BY id ASC').all();
  return { ok: true, users: results };
}

async function adminUpdateUser(env, id, patch) {
  if (!id) return { ok: false, error: 'id가 필요합니다.' };
  const u = await findUser(env, id);
  if (!u) return { ok: false, error: '사용자를 찾을 수 없습니다.' };
  const status = patch.status !== undefined ? patch.status : u.status;
  const role = patch.role !== undefined ? patch.role : u.role;
  const monthlyCredit = patch.monthlyCredit !== undefined && patch.monthlyCredit !== '' ? parseInt(patch.monthlyCredit, 10) : u.monthlyCredit;
  const remainingCredit = patch.remainingCredit !== undefined && patch.remainingCredit !== '' ? parseInt(patch.remainingCredit, 10) : u.remainingCredit;
  await env.DB.prepare('UPDATE users SET status=?, role=?, monthly_credit=?, remaining_credit=? WHERE id=?')
    .bind(status, role, monthlyCredit, remainingCredit, id).run();
  return { ok: true };
}

async function adminGetConfig(env) {
  const configMap = await getAllConfigRows(env);
  const keys = AI_PROVIDERS.map((p) => {
    const row = configMap[AI_KEY_PROP[p]] || {};
    return { key: AI_KEY_PROP[p], provider: p, hasValue: !!row.value, maskedValue: maskSecret(row.value), model: row.model || AI_DEFAULT_MODEL[p] };
  });
  const models = {};
  for (const p of AI_PROVIDERS) models[p] = await getModelListForProvider(env, p);
  const { results: costRows } = await env.DB.prepare('SELECT action_key, cost FROM config_credit_costs').all();
  const costMap = {};
  costRows.forEach((r) => { costMap[r.action_key] = r.cost; });
  const creditCosts = Object.keys(CREDIT_COST_DEFAULTS).map((actionKey) => ({
    actionKey, label: ACTION_LABELS[actionKey] || actionKey,
    cost: costMap[actionKey] !== undefined ? costMap[actionKey] : CREDIT_COST_DEFAULTS[actionKey]
  }));
  return { ok: true, keys, models, creditCosts };
}

async function adminSetConfigValue(env, key, value, model) {
  if (!key) return { ok: false, error: 'key가 필요합니다.' };
  const existing = await getConfigRow(env, key);
  const finalValue = (value === undefined || value === '') ? (existing ? existing.value : '') : value;
  const finalModel = (model === undefined || model === '') ? (existing ? existing.model : '') : model;
  await env.DB.prepare('INSERT INTO config (key,value,model) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, model=excluded.model')
    .bind(key, finalValue, finalModel).run();
  return { ok: true };
}

async function adminSetModels(env, provider, modelList) {
  if (!provider || !Array.isArray(modelList)) return { ok: false, error: 'provider/models가 필요합니다.' };
  await env.DB.prepare('DELETE FROM config_models WHERE provider = ?').bind(provider).run();
  const stmts = modelList.filter(Boolean).map((m, i) =>
    env.DB.prepare('INSERT INTO config_models (provider,model,ord) VALUES (?,?,?)').bind(provider, m, i)
  );
  if (stmts.length) await env.DB.batch(stmts);
  return { ok: true };
}

async function adminSetCreditCost(env, actionKey, cost) {
  if (!actionKey) return { ok: false, error: 'actionKey가 필요합니다.' };
  const n = parseInt(cost, 10);
  if (isNaN(n)) return { ok: false, error: 'cost가 숫자가 아닙니다.' };
  await env.DB.prepare('INSERT INTO config_credit_costs (action_key,cost) VALUES (?,?) ON CONFLICT(action_key) DO UPDATE SET cost=excluded.cost')
    .bind(actionKey, n).run();
  return { ok: true };
}

// ── 공지사항 (홈 페이지) ──────────────────────────────────────────
async function getAnnouncements(env) {
  const { results } = await env.DB.prepare('SELECT id, date, title, body FROM announcements ORDER BY id DESC LIMIT 20').all();
  return { ok: true, items: results };
}

async function adminAddAnnouncement(env, date, title, body) {
  if (!title) return { ok: false, error: '제목이 필요합니다.' };
  await env.DB.prepare('INSERT INTO announcements (date,title,body,created_at) VALUES (?,?,?,?)')
    .bind(date || todayKST(), title, body || '', nowKST()).run();
  return { ok: true };
}

async function adminUpdateAnnouncement(env, id, date, title, body) {
  if (!id) return { ok: false, error: 'id가 필요합니다.' };
  await env.DB.prepare('UPDATE announcements SET date=?, title=?, body=? WHERE id=?')
    .bind(date || todayKST(), title || '', body || '', id).run();
  return { ok: true };
}

async function adminDeleteAnnouncement(env, id) {
  if (!id) return { ok: false, error: 'id가 필요합니다.' };
  await env.DB.prepare('DELETE FROM announcements WHERE id=?').bind(id).run();
  return { ok: true };
}

// ── 블로그 글 검증 1계층: 코드 기반 규칙 검사 (AI 호출 없음, 즉시 판정) ──────
// U2M 블로그 글 검증 시스템 기준서 v1.0(2026-09-03) 4장 기준. 여기서는 저장된 글
// 하나만으로 확인 가능한 항목만 다룬다(캠퍼스 마스터 데이터 대조·외부 사실 확인은
// 별도 인프라가 필요해 후속 단계로 미룸 — adminListPosts 응답의 note 참고).
//
// 최종 목적은 "검증하고 끝"이 아니라 "이 결과를 보고 blog.js 프롬프트를 계속 고쳐나가는
// 것"이므로, 각 글의 prompt_version을 그대로 결과에 남기고 버전별로 문제를 집계해서
// "이 프롬프트 버전에서 어떤 문제가 반복되는지"를 admin.js가 바로 보여줄 수 있게 한다.
const VALIDATION_RULESET_VERSION = 'u2m-rule-tier-1.0';
const VALIDATION_BANNED_WORDS = ['선행학습', '선행', '예비'];
const VALIDATION_CLICHE_PHRASES = ['결론적으로', '혁신적인', '놀라운', '획기적인', '완전히 달라집니다', '중요한 포인트가 있어요', '진짜 시작점'];

function countOccurrences(text, needle) {
  if (!needle) return 0;
  return text.split(needle).length - 1;
}

// 분량 판정은 blog.js의 실제 생성 지시(90~110%)와 맞춰야 "프롬프트대로 잘 쓴 글"이
// 검증에서 억울하게 걸리는 일이 없다(2026-09-03 합의). 80~89%/111~120%는 경고,
// 그 밖은 차단.
function ruleCheckPost(p) {
  const issues = [];
  const body = p.body || '';
  const bodyLen = body.replace(/\s/g, '').length;
  const target = parseInt(p.targetLength, 10);

  if (!body.trim()) {
    issues.push({ severity: 'BLOCKER', category: 'FORMAT', message: '본문이 비어 있습니다.' });
  }

  if (target > 0) {
    const ratio = Math.round((bodyLen / target) * 100);
    if (ratio < 80 || ratio > 120) {
      issues.push({ severity: 'BLOCKER', category: 'FORMAT', message: '분량이 목표(' + target + '자)의 ' + ratio + '%로 허용 범위를 크게 벗어났습니다.' });
    } else if (ratio < 90 || ratio > 110) {
      issues.push({ severity: 'MAJOR', category: 'FORMAT', message: '분량이 목표의 ' + ratio + '%로 권장 범위(90~110%)를 벗어났습니다.' });
    }
  } else {
    issues.push({ severity: 'INFO', category: 'FORMAT', message: '목표 분량 정보가 없어 분량 검사를 건너뜁니다.' });
  }

  const title = p.title || '';
  if (title.length > 0 && (title.length < 20 || title.length > 50)) {
    issues.push({ severity: 'MINOR', category: 'TITLE', message: '제목 길이(' + title.length + '자)가 권장 범위(25~45자)를 벗어났습니다.' });
  }

  VALIDATION_BANNED_WORDS.forEach((w) => {
    if (body.indexOf(w) !== -1 || title.indexOf(w) !== -1) {
      issues.push({ severity: 'MAJOR', category: 'FORMAT', message: '금지 표현 "' + w + '"이(가) 본문 또는 제목에 남아있습니다.' });
    }
  });

  if (body.indexOf('**') !== -1) {
    issues.push({ severity: 'MAJOR', category: 'FORMAT', message: '마크다운 볼드(**)가 본문에 그대로 노출되어 있습니다.' });
  }
  if (/&(amp|lt|gt|quot|nbsp);/.test(body)) {
    issues.push({ severity: 'MINOR', category: 'FORMAT', message: '변환되지 않은 HTML 엔티티가 본문에 남아있습니다.' });
  }

  const tags = (p.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  if (!tags.length) {
    issues.push({ severity: 'MINOR', category: 'FORMAT', message: '태그가 없습니다.' });
  } else {
    if (tags.length > 7) issues.push({ severity: 'MINOR', category: 'FORMAT', message: '태그가 ' + tags.length + '개로 너무 많습니다.' });
    if (new Set(tags).size !== tags.length) issues.push({ severity: 'MINOR', category: 'FORMAT', message: '중복된 태그가 있습니다.' });
  }

  VALIDATION_CLICHE_PHRASES.forEach((ph) => {
    const count = countOccurrences(body, ph);
    if (count >= 1) issues.push({ severity: count >= 2 ? 'MAJOR' : 'MINOR', category: 'STYLE', message: '상투적 표현 "' + ph + '"이(가) ' + count + '회 사용되었습니다.' });
  });

  const emojiCount = (body.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;
  if (emojiCount > 15) issues.push({ severity: 'MINOR', category: 'STYLE', message: '이모지가 ' + emojiCount + '개로 과다합니다.' });

  if (body.indexOf('📞') === -1 && body.indexOf('전화') === -1) {
    issues.push({ severity: 'INFO', category: 'CONTACT', message: '연락처 블록을 찾지 못했습니다 — 실제 연락처가 비어있어 생략된 것인지 확인이 필요합니다.' });
  }

  let maxSeverity = 'INFO';
  issues.forEach((i) => {
    if (i.severity === 'BLOCKER') maxSeverity = 'BLOCKER';
    else if (i.severity === 'MAJOR' && maxSeverity !== 'BLOCKER') maxSeverity = 'MAJOR';
    else if (i.severity === 'MINOR' && maxSeverity !== 'BLOCKER' && maxSeverity !== 'MAJOR') maxSeverity = 'MINOR';
  });
  const status = maxSeverity === 'BLOCKER' ? 'HOLD' : maxSeverity === 'MAJOR' ? 'REVISE' : 'PASS';
  return { rulesetVersion: VALIDATION_RULESET_VERSION, status, issues };
}

// 프롬프트 버전별로 어떤 문제가 몇 번 반복되는지 집계 — "검증하고 끝"이 아니라
// "이 결과를 보고 blog.js 프롬프트를 계속 고쳐나간다"는 목적을 위한 핵심 데이터.
// 예: v6-length-priority에서 분량 경고가 자주 나오면 그 버전의 분량 지시를 다시 손봐야 한다는 신호.
function summarizeByPromptVersion(postsWithValidation) {
  const byVersion = {};
  postsWithValidation.forEach((p) => {
    const v = p.promptVersion || '(미기록)';
    if (!byVersion[v]) byVersion[v] = { promptVersion: v, total: 0, statusCounts: { PASS: 0, REVISE: 0, HOLD: 0 }, categoryCounts: {} };
    const bucket = byVersion[v];
    bucket.total++;
    bucket.statusCounts[p.validation.status] = (bucket.statusCounts[p.validation.status] || 0) + 1;
    p.validation.issues.forEach((i) => {
      if (i.severity === 'INFO') return; // 정보성 항목은 집계에서 제외(연락처 미확인 등 잡음 방지)
      bucket.categoryCounts[i.category] = (bucket.categoryCounts[i.category] || 0) + 1;
    });
  });
  return Object.values(byVersion).sort((a, b) => (a.promptVersion < b.promptVersion ? 1 : -1));
}

// ── 관리자: 전체 사용자 블로그 글 조회/삭제 ──────────────────────
async function adminListPosts(env, n) {
  const { results } = await env.DB.prepare(
    'SELECT id, created_at, type, title, body, tags, target_length, prompt_version, user_id FROM blog_posts ORDER BY id DESC LIMIT ?'
  ).bind(Math.min(n || 200, 500)).all();
  const posts = results.map((r) => {
    const post = { id: r.id, date: rowDateKST(r.created_at), type: r.type || '', title: r.title || '(제목 없음)', body: r.body || '', tags: r.tags || '', targetLength: r.target_length || '', promptVersion: r.prompt_version || '', userId: r.user_id || '' };
    post.validation = ruleCheckPost(post);
    return post;
  });
  return { ok: true, posts, validationSummary: summarizeByPromptVersion(posts), validationNote: '1계층(분량·금지어·서식·상투구) 규칙 검사는 자동 실행됩니다. 2계층(AI 내용 검증)은 글마다 "AI 검증" 버튼을 눌러 수동으로 실행하세요(크레딧과 무관하게 AI 호출 비용이 듭니다). 캠퍼스 정보 대조·외부 사실 확인(3계층)은 아직 미구현입니다.' };
}

// ── 블로그 글 검증 2계층: AI 내용·품질 검증 ─────────────────────────
// U2M 블로그 글 검증 기준서 v1.0 5장·9장·10장 기준. 관리자가 글 하나를 선택해
// "AI 검증" 버튼을 누를 때만 실행(전체 자동 실행은 비용이 계속 쌓이므로 배제).
// 결과는 post_ai_validations에 매번 새 행으로 쌓아 이력을 남긴다(기존 결과를 덮어쓰지 않음).
const AI_VALIDATION_STANDARD_VERSION = 'u2m-review-1.0';
const AI_VALIDATION_SYSTEM_PROMPT = `당신은 올림피아드교육 유투엠(U2M) 수학학원 블로그의 발행 전 검수자다.

목표는 글을 칭찬하거나 막연한 인상을 말하는 것이 아니라, 독자에게 오해를 줄 수 있는 사실·수학·교육과정 오류를 먼저 찾고 U2M 작성 기준에 따라 발행 가능 여부를 일관되게 판정하는 것이다.

우선순위는 다음과 같다.
1. 사실성, 최신성, 법적·광고상 안전
2. 수학 및 교육과정 정확성
3. 사용자가 지정한 글 유형, 독자, 분위기, 핵심 메시지
4. 제목–본문 일치와 실행 가능한 정보
5. U2M 브랜드와 한국어 문체
6. SEO, 이모지, 형식 규칙

제공되지 않은 학생 사례, 대사, 후기, 성과, 수치, 일정, 연구, 기관 정보를 사실처럼 승인하지 마라. 이 검증에는 실시간 웹 검색 도구가 없으므로, 최신 정보의 사실 여부를 직접 확인했다고 표현하지 말고 claims 배열에 SOURCE_REQUIRED 또는 UNVERIFIABLE로 표시하라. VERIFIED는 절대 사용하지 마라(외부 검색 없이는 확인 불가능하다).

수학 글에서는 정의·기호·공식·예시 계산을 검토하고, 교육과정 글에서는 적용 연도와 학년, 교과서별 단원 배열 차이를 확인하라. 사실 오류, 수학 오류, 잘못된 캠퍼스·연락처, 허위 사례, 중대한 제목 오도는 BLOCKER다.

U2M 문체는 친근하지만 신뢰감 있는 존댓말이다. 모든 문장을 같은 어미로 끝내지 않는다. 모바일에서 읽기 쉽게 문단을 나누고 반복·번역투·AI 상투구를 점검한다. 말하는 수학, 하브루타, 플립러닝, 메타인지 중 글의 주제와 직접 연결되는 요소가 있을 때만 하나를 선택해 언급하는 것을 허용한다.

각 문제는 severity, category, original_text, reason, suggested_revision을 포함해야 한다. 원문에 없는 문제를 추측하여 만들지 마라. 점수가 높아도 BLOCKER가 있으면 final_status는 HOLD다. 문제가 거의 없으면 억지로 항목을 채우지 마라. 캠퍼스 공식 정보 등 입력받지 못한 항목은 missing_inputs에 기록하고 그 항목에 대한 판단은 하지 마라.

출력은 반드시 아래 JSON 스키마만 사용하고 다른 텍스트는 포함하지 마라.

{
  "final_status": "PASS | REVISE | HOLD | NEEDS_VERIFICATION | NOT_EVALUATED",
  "total_score": 0,
  "summary": "핵심 진단 2~4문장",
  "scores": { "factual_safety": 0, "math_curriculum": 0, "title_search_intent": 0, "logic_practicality": 0, "style_readability": 0, "brand_fit": 0, "cta": 0 },
  "issues": [ { "severity": "BLOCKER | MAJOR | MINOR | INFO", "category": "FACT | MATH | CURRICULUM | TITLE | LOGIC | STYLE | BRAND | CTA | FORMAT | CONTACT", "original_text": "", "reason": "", "suggested_revision": "", "requires_external_verification": false } ],
  "claims": [ { "claim": "", "verification_status": "SOURCE_REQUIRED | UNVERIFIABLE | NOT_REQUIRED", "note": "" } ],
  "strengths": ["실제로 확인되는 장점"],
  "missing_inputs": []
}

점수 필드의 최대값은 각각 25, 20, 15, 15, 10, 10, 5이며 합계는 100점이다.`;

function extractJson(text) {
  const cleaned = String(text || '').trim().replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : cleaned);
}

async function adminValidatePostAI(env, postId) {
  if (!postId) return { ok: false, error: 'id가 필요합니다.' };
  const row = await env.DB.prepare(
    'SELECT id, created_at, type, mood, topic, keywords, tags, title, body, structure, target_length, prompt_version FROM blog_posts WHERE id = ?'
  ).bind(postId).first();
  if (!row) return { ok: false, error: '글을 찾을 수 없습니다.' };

  const cfg = await getActiveProviderConfig(env);
  if (!cfg.ok) return cfg;

  const userContent = [
    '## 글 메타 정보',
    '글 ID: ' + row.id,
    '작성일: ' + (row.created_at || ''),
    '글 유형: ' + (row.type || ''),
    '분위기: ' + (row.mood || ''),
    '주제: ' + (row.topic || ''),
    '검색 키워드: ' + (row.keywords || ''),
    '목표 분량: ' + (row.target_length || '') + '자 (공백 제외)',
    '구조 유형: ' + (row.structure || ''),
    '캠퍼스 공식 정보(주소/전화/URL/운영 프로그램), 참고자료·공식 출처, 기준 연도·적용 교육과정: 제공되지 않음 — 판단하지 말고 missing_inputs에 기록할 것',
    '',
    '## 제목',
    row.title || '',
    '',
    '## 본문',
    row.body || '',
    '',
    '## 태그',
    row.tags || ''
  ].join('\n');

  // 검증 응답은 7개 항목 점수 + 이슈마다 원문/이유/수정안까지 포함해서 blog_finalize보다도
  // 훨씬 길다. "생각" 토큰이 max_tokens를 다 써버려 텍스트가 하나도 안 나오는 경우(2026-09
  // 실측)가 있어, 빈 응답이면 토큰을 늘려 한 번 더 시도한다(blog.js의 blogGenerateWithRepair와
  // 같은 패턴, 서버 쪽에서 재현).
  async function attempt(maxTokens) {
    const r = await runWithGenLock(env, () => callAiRelay(env, {
      provider: cfg.provider, apiKey: cfg.apiKey, models: cfg.models,
      system: AI_VALIDATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
      max_tokens: maxTokens
    }));
    if (!r.ok) return { text: '', raw: r };
    const t = (r.data && r.data.content && r.data.content[0] && r.data.content[0].text) || r.text || '';
    return { text: t, raw: r };
  }

  // Vercel 릴레이의 60초 실행시간 제한에 걸리면(HTTP 504) 릴레이가 자기 게이트웨이가
  // 만든 HTML 오류 페이지를 돌려주는데, 이건 실제 AI 오류가 아니라 응답이 늦어서 잘린
  // 것뿐이라 대부분 재시도하면 풀린다(blog.js 쪽과 동일한 원인·해법, 2026-09 실측).
  // 화면에 바로 에러를 보여주지 않고 백오프하며 최대 3회까지 조용히 재시도한다.
  // 두 실패 원인은 반대 방향 처방이 필요하다 — 토큰(생각 토큰이 다 써서 텍스트가 빈 경우)은
  // 키워서 재시도해야 하고, 릴레이 타임아웃(504, 응답이 오래 걸려서 생기는 문제)은 토큰을
  // 더 키우면 오히려 악화되므로 같은 토큰으로 잠시 대기 후 재시도해야 한다.
  let tokens = 6000;
  let text = '', raw = { ok: false };
  const maxAttempts = 3;
  for (let i = 0; i < maxAttempts; i++) {
    ({ text, raw } = await attempt(tokens));
    if (text) break; // 성공
    if (!raw.ok) {
      if (i < maxAttempts - 1) await sleep(3000 * (i + 1)); // 504 등 → 같은 토큰으로 대기 후 재시도
    } else {
      tokens = Math.min(tokens * 2, 16000); // ok인데 텍스트가 없음 → 토큰을 키워 즉시 재시도
    }
  }
  if (!raw.ok) return raw;
  if (!text) return { ok: false, error: 'AI로부터 빈 응답을 받았습니다(재시도 후에도 실패) — max_tokens을 더 늘려야 할 수 있습니다.' };

  let parsed;
  try {
    parsed = extractJson(text);
  } catch (e) {
    return { ok: false, error: 'AI 응답 JSON 파싱 실패 — 원문 앞부분: ' + text.slice(0, 300) };
  }

  parsed.standard_version = AI_VALIDATION_STANDARD_VERSION;
  parsed.post_id = row.id;
  parsed.prompt_version = row.prompt_version || '';
  parsed.reviewed_at = nowKST();
  parsed.model = cfg.models[0];

  await env.DB.prepare(
    'INSERT INTO post_ai_validations (post_id, created_at, model, standard_version, final_status, total_score, result_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(row.id, nowKST(), cfg.models[0], AI_VALIDATION_STANDARD_VERSION, parsed.final_status || '', parsed.total_score || 0, JSON.stringify(parsed)).run();

  return { ok: true, result: parsed };
}

async function adminGetPostValidations(env, postId) {
  if (!postId) return { ok: false, error: 'id가 필요합니다.' };
  const { results } = await env.DB.prepare(
    'SELECT id, created_at, model, standard_version, final_status, total_score, result_json, admin_decision, admin_note FROM post_ai_validations WHERE post_id = ? ORDER BY id DESC LIMIT 20'
  ).bind(postId).all();
  return {
    ok: true,
    items: results.map((r) => {
      let result = {};
      try { result = JSON.parse(r.result_json || '{}'); } catch (e) {}
      return { id: r.id, createdAt: rowDateKST(r.created_at), model: r.model, standardVersion: r.standard_version, finalStatus: r.final_status, totalScore: r.total_score, result, adminDecision: r.admin_decision || '', adminNote: r.admin_note || '' };
    })
  };
}

async function adminSetValidationDecision(env, id, decision, note) {
  if (!id) return { ok: false, error: 'id가 필요합니다.' };
  await env.DB.prepare('UPDATE post_ai_validations SET admin_decision = ?, admin_note = ? WHERE id = ?').bind(decision || '', note || '', id).run();
  return { ok: true };
}

async function adminDeletePost(env, id) {
  if (!id) return { ok: false, error: 'id가 필요합니다.' };
  await env.DB.prepare('DELETE FROM blog_posts WHERE id=?').bind(id).run();
  return { ok: true };
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
        const { results } = await env.DB.prepare('SELECT * FROM blog_posts ORDER BY id DESC LIMIT ?').bind(n).all();
        const posts = results.map((r) => ({
          date: rowDateKST(r.created_at), type: r.type || '', mood: r.mood || '', topic: r.topic || '',
          keywords: r.keywords || '', tags: r.tags || '', title: r.title || '', body: r.body || '', structure: r.structure || ''
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
        if (ADMIN_ACTIONS.includes(data.action) && String(v.role) !== '관리자') {
          return jsonResponse({ ok: false, error: '관리자만 접근할 수 있습니다.' });
        }
        if (data.action === 'login') return jsonResponse({ ok: true, name: v.name, academy: v.academy, role: v.role || '' });
        if (data.action === 'getAnnouncements') return jsonResponse(await getAnnouncements(env));
        if (data.action === 'adminAddAnnouncement') return jsonResponse(await adminAddAnnouncement(env, data.date || '', data.title || '', data.body || ''));
        if (data.action === 'adminUpdateAnnouncement') return jsonResponse(await adminUpdateAnnouncement(env, data.targetId || '', data.date || '', data.title || '', data.body || ''));
        if (data.action === 'adminDeleteAnnouncement') return jsonResponse(await adminDeleteAnnouncement(env, data.targetId || ''));
        if (data.action === 'adminListPosts') return jsonResponse(await adminListPosts(env, data.n || 200));
        if (data.action === 'adminDeletePost') return jsonResponse(await adminDeletePost(env, data.targetId || ''));
        if (data.action === 'adminValidatePostAI') return aiJsonResponse(await adminValidatePostAI(env, data.targetId || ''));
        if (data.action === 'adminGetPostValidations') return jsonResponse(await adminGetPostValidations(env, data.targetId || ''));
        if (data.action === 'adminSetValidationDecision') return jsonResponse(await adminSetValidationDecision(env, data.targetId || '', data.decision || '', data.note || ''));
        if (data.action === 'adminListUsers') return jsonResponse(await adminListUsers(env));
        if (data.action === 'adminUpdateUser') return jsonResponse(await adminUpdateUser(env, data.targetId || '', data.patch || {}));
        if (data.action === 'adminApproveUser') return jsonResponse(await adminApproveUser(env, data.targetId || ''));
        if (data.action === 'adminGetConfig') return jsonResponse(await adminGetConfig(env));
        if (data.action === 'adminSetConfigValue') return jsonResponse(await adminSetConfigValue(env, data.key || '', data.value, data.model));
        if (data.action === 'adminSetModels') return jsonResponse(await adminSetModels(env, data.provider || '', data.models || []));
        if (data.action === 'adminSetCreditCost') return jsonResponse(await adminSetCreditCost(env, data.actionKey || '', data.cost));
        if (data.action === 'myPosts') return jsonResponse({ ok: true, posts: await getMyPosts(env, data.userId, data.n || 100) });
        if (data.action === 'claudeProxy') return aiJsonResponse(await claudeProxy(env, data.payload));
        if (data.action === 'geminiProxy') return aiJsonResponse(await geminiProxy(env, data.payload));
        if (data.action === 'feedbackList') return jsonResponse(await getFeedbackThreads(env, data.userId, v.role || ''));
        if (data.action === 'feedbackPost') return jsonResponse(await postFeedback(env, data.userId, v, data.content || ''));
        if (data.action === 'feedbackReply') return jsonResponse(await replyFeedback(env, data.userId, v, data.threadId || '', data.content || ''));
        if (data.action === 'loadSchoolShare') return jsonResponse(await loadSchoolShare(env, data.userId));
        if (data.action === 'saveSchoolShare') return jsonResponse(await saveSchoolShare(env, data.userId, data.jsonData || ''));
        if (data.action === 'schoolShareSearch') return jsonResponse(await schoolShareSearch(env, data.sidoCode || '', data.sggCode || '', data.schulKndCode || ''));
        if (data.action === 'useCredit') return jsonResponse(await useCredit(env, data.userId, data.actionKey || ''));
        if (data.action === 'creditStatus') return jsonResponse(await getCreditStatus(env, data.userId));
        if (data.action === 'creditHistory') return jsonResponse(await getCreditHistory(env, data.userId, data.n || 50));
        if (data.action === 'creditQuote') return jsonResponse(await getCreditQuote(env, data.userId, data.actionKey || ''));
      }

      if (data.token !== env.SHARED_TOKEN) return jsonResponse({ error: 'Unauthorized' });
      return jsonResponse(await savePost(env, data));
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  }
};
