// 경쟁학원 온디맨드 모니터링 Worker (Phase 1)
//
// 프론트엔드(marketingtool js/monitor.js)는 다른 mtt-*-tracker와 동일하게
// POST + {token, action, ...} 패턴으로 이 Worker를 호출한다.
// action=createJob  : 조회 요청 접수 (캐시 있으면 즉시 반환, 없으면 GitHub Actions 트리거)
// action=getJob      : job 상태/결과 폴링
// 별도로 /callback 경로는 GitHub Actions(collect_job.py)가 결과를 보내는 콜백 —
// SHARED_TOKEN이 아니라 CALLBACK_SECRET(Authorization: Bearer)으로 인증한다.
//
// TODO(이후 정식화): 지금은 userId를 클라이언트가 그대로 보내는 프로토타입 인증 —
// 나중에 blog-tracker의 로그인 세션과 연동할 것. 조회기간(현재 이번달 고정)도 재검토 필요.

const CACHE_DAYS = 7;
const GITHUB_WORKFLOW_FILE = "monitor-collect.yml";
const GITHUB_REF = "main";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function nowIso() {
  return new Date().toISOString();
}

async function createJob(env, request, { userId, keyword, region }) {
  keyword = (keyword || "").trim();
  region = (region || "").trim();
  if (!userId) return jsonResponse({ ok: false, error: "userId가 필요합니다" }, 400);
  if (!keyword) return jsonResponse({ ok: false, error: "학원명(keyword)을 입력해주세요" }, 400);

  const cacheThreshold = new Date(Date.now() - CACHE_DAYS * 86400000).toISOString();
  const cached = await env.DB.prepare(
    `SELECT id FROM jobs
     WHERE user_id = ? AND keyword = ? AND status = 'done' AND created_at >= ?
     ORDER BY created_at DESC LIMIT 1`
  )
    .bind(userId, keyword, cacheThreshold)
    .first();

  if (cached) {
    return jsonResponse({ ok: true, job_id: cached.id, status: "done", cached: true });
  }

  const jobId = crypto.randomUUID();
  const timestamp = nowIso();

  await env.DB.prepare(
    `INSERT INTO jobs (id, user_id, keyword, region, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`
  )
    .bind(jobId, userId, keyword, region, timestamp, timestamp)
    .run();

  const callbackUrl = new URL("/callback", request.url).toString();

  const dispatchResp = await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "mtt-monitor-tracker",
      },
      body: JSON.stringify({
        ref: GITHUB_REF,
        inputs: { job_id: jobId, keyword, region, callback_url: callbackUrl },
      }),
    }
  );

  if (!dispatchResp.ok) {
    const errorText = await dispatchResp.text();
    await env.DB.prepare(`UPDATE jobs SET status = 'error', error = ?, updated_at = ? WHERE id = ?`)
      .bind(`GitHub Actions 트리거 실패: ${dispatchResp.status} ${errorText}`.slice(0, 500), nowIso(), jobId)
      .run();
    return jsonResponse({ ok: false, error: "수집 작업 트리거에 실패했습니다" }, 502);
  }

  await env.DB.prepare(`UPDATE jobs SET status = 'running', updated_at = ? WHERE id = ?`)
    .bind(nowIso(), jobId)
    .run();

  return jsonResponse({ ok: true, job_id: jobId, status: "running" });
}

async function getJob(env, jobId) {
  const job = await env.DB.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(jobId).first();
  if (!job) return jsonResponse({ ok: false, error: "job을 찾을 수 없습니다" }, 404);

  if (job.status !== "done") {
    return jsonResponse({ ok: true, job_id: job.id, status: job.status, error: job.error || undefined });
  }

  const { results } = await env.DB.prepare(
    `SELECT * FROM results WHERE job_id = ? ORDER BY write_date DESC`
  )
    .bind(jobId)
    .all();

  const parsed = results.map((row) => ({
    article_url: row.article_url,
    cafe_name: row.cafe_name,
    write_date: row.write_date,
    title: row.title,
    summary: row.summary,
    sentiment: row.sentiment,
    region: row.region,
    advantages: JSON.parse(row.advantages || "[]"),
    disadvantages: JSON.parse(row.disadvantages || "[]"),
    advantage_quotes: JSON.parse(row.advantage_quotes || "{}"),
    disadvantage_quotes: JSON.parse(row.disadvantage_quotes || "{}"),
    mentioned_academies: JSON.parse(row.mentioned_academies || "[]"),
    academy_evaluations: JSON.parse(row.academy_evaluations || "{}"),
    ai_model: row.ai_model,
  }));

  return jsonResponse({
    ok: true,
    job_id: job.id,
    status: job.status,
    keyword: job.keyword,
    region: job.region,
    results: parsed,
  });
}

async function handleCallback(env, request) {
  const authHeader = request.headers.get("Authorization") || "";
  if (!env.CALLBACK_SECRET || authHeader !== `Bearer ${env.CALLBACK_SECRET}`) {
    return jsonResponse({ ok: false, error: "인증 실패" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "잘못된 JSON 본문" }, 400);
  }

  const { job_id: jobId, status } = body;
  if (!jobId || !status) return jsonResponse({ ok: false, error: "job_id, status는 필수입니다" }, 400);

  const timestamp = nowIso();

  if (status === "error") {
    await env.DB.prepare(`UPDATE jobs SET status = 'error', error = ?, updated_at = ? WHERE id = ?`)
      .bind((body.error || "알 수 없는 오류").slice(0, 500), timestamp, jobId)
      .run();
    return jsonResponse({ ok: true });
  }

  const results = Array.isArray(body.results) ? body.results : [];

  const statements = results.map((r) =>
    env.DB.prepare(
      `INSERT INTO results (
        job_id, article_url, cafe_name, write_date, title, summary, sentiment, region,
        advantages, disadvantages, advantage_quotes, disadvantage_quotes,
        mentioned_academies, academy_evaluations, ai_model, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      jobId,
      r.article_url || "",
      r.cafe_name || "",
      r.write_date || "",
      r.title || "",
      r.summary || "",
      r.sentiment || "",
      r.region || "",
      JSON.stringify(r.advantages || []),
      JSON.stringify(r.disadvantages || []),
      JSON.stringify(r.advantage_quotes || {}),
      JSON.stringify(r.disadvantage_quotes || {}),
      JSON.stringify(r.mentioned_academies || []),
      JSON.stringify(r.academy_evaluations || {}),
      r.ai_model || "",
      timestamp
    )
  );

  statements.push(
    env.DB.prepare(`UPDATE jobs SET status = 'done', updated_at = ? WHERE id = ?`).bind(timestamp, jobId)
  );

  await env.DB.batch(statements);

  return jsonResponse({ ok: true, stored: results.length });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
      });
    }

    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/callback") {
      return handleCallback(env, request);
    }

    if (request.method === "POST") {
      let data;
      try {
        data = await request.json();
      } catch {
        return jsonResponse({ ok: false, error: "잘못된 JSON 본문" }, 400);
      }

      if (data.token !== env.SHARED_TOKEN) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);

      if (data.action === "createJob") {
        return createJob(env, request, { userId: data.userId, keyword: data.keyword, region: data.region });
      }
      if (data.action === "getJob") {
        return getJob(env, data.job_id);
      }
      return jsonResponse({ ok: false, error: "알 수 없는 action" }, 400);
    }

    return jsonResponse({ ok: false, error: "not found" }, 404);
  },
};
