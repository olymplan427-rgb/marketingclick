// api/relay.js
// Anthropic/Gemini/OpenAI 호출 릴레이.
//
// 왜 필요한가: Anthropic/Google이 Cloudflare Workers발 요청을 차단·지역제한해서, blog-tracker
// Worker에서 직접 호출이 안 됨(gas/blog_tracker.gs로 중계하던 것과 같은 문제). Vercel(비-Cloudflare
// 네트워크)에서는 정상 응답하는 것을 확인해서, 이 함수가 실제 AI API 호출만 대신 해준다.
//
// 무상태 릴레이 — API 키를 여기 저장하지 않고 매 요청마다 호출자(Worker)가 함께 넘긴다.
// config 시트가 키의 유일한 출처라는 기존 설계를 유지하기 위함. 여기 저장하는 값은 PROXY_TOKEN
// (Worker만 호출하도록 막는 공유 비밀값) 하나뿐.
//
// 계약: POST { token, provider: 'claude'|'gemini'|'openai', apiKey, models: [주모델, ...폴백],
//              system, messages: [{role,content}], max_tokens }
// provider별 매칭 상세는 함수 하단 참고. Gemini만 models 배열을 순서대로 폴백 시도.
//
// maxDuration 미설정 시 Vercel 기본 실행시간 제한(플랜별 10초 안팎)에 걸려 지역 트렌드 리포트처럼
// 응답이 오래 걸리는 호출이 타임아웃되는 문제가 실측으로 확인되어 60초로 늘림(2026-08-28).
export const config = { maxDuration: 60 };

function toGeminiParts(content) {
  if (typeof content === 'string') return [{ text: content }];
  return (content || []).map((block) => {
    if (block.type === 'image') return { inlineData: { mimeType: block.source.media_type, data: block.source.data } };
    return { text: block.text || '' };
  });
}

function toOpenAiContent(content) {
  if (typeof content === 'string') return content;
  return (content || []).map((block) => {
    if (block.type === 'image') return { type: 'image_url', image_url: { url: 'data:' + block.source.media_type + ';base64,' + block.source.data } };
    return { type: 'text', text: block.text || '' };
  });
}

async function callClaude(apiKey, model, system, messages, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens || 2048, system: system || '', messages: messages || [] })
  });
  const json = await res.json();
  if (res.status !== 200) return { ok: false, error: (json.error && json.error.message) || ('Claude API 오류 ' + res.status) };
  const textBlock = (json.content || []).find((b) => b && b.text);
  if (!textBlock) return { ok: false, error: 'Claude 빈 응답(텍스트 블록 없음) — max_tokens을 늘려보세요.' };
  return { ok: true, data: { content: [textBlock] } };
}

async function callGeminiOnce(apiKey, model, system, messages, maxTokens, timeoutMs) {
  const lastUser = (messages && messages[messages.length - 1]) || {};
  const body = {
    contents: [{ role: 'user', parts: toGeminiParts(lastUser.content) }],
    generationConfig: { maxOutputTokens: maxTokens || 3500, temperature: 0.7 }
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'Gemini 응답 지연(' + Math.round(timeoutMs / 1000) + '초 초과)' : e.message };
  } finally {
    clearTimeout(timer);
  }
  const json = await res.json();
  if (res.status !== 200) return { ok: false, error: (json.error && json.error.message) || ('Gemini API 오류 ' + res.status) };
  const text = json.candidates && json.candidates[0] && json.candidates[0].content &&
    json.candidates[0].content.parts && json.candidates[0].content.parts[0] && json.candidates[0].content.parts[0].text;
  if (!text) return { ok: false, error: 'Gemini 빈 응답(안전 필터에 걸렸을 수 있습니다)' };
  return { ok: true, text };
}

// 429/오류/빈응답이면 다음 모델로 순서대로 폴백 — 기존 GAS _callGeminiGeneral/_geminiProxy와 동일 동작.
// Vercel 함수 실행시간 제한(vercel.json의 maxDuration, Hobby플랜 최대 60초)에 걸리지 않도록
// 모델 1개당 타임아웃을 두고, 남은 예산이 얼마 안 남으면 더 이상 폴백을 시도하지 않고 바로 반환한다
// (전부 시도하다 60초를 넘겨 Vercel에 강제 종료당하면 클라이언트엔 아무 응답도 못 주고 524만 뜬다 — 2026-09-01 실측).
const GEMINI_BUDGET_MS = 50000; // maxDuration 60초 중 여유 10초를 남김
const GEMINI_MIN_ATTEMPT_MS = 15000; // 이 시간도 못 줄 만큼 예산이 없으면 재시도 포기
async function callGemini(apiKey, models, system, messages, maxTokens) {
  const deadline = Date.now() + GEMINI_BUDGET_MS;
  let lastErr = null;
  for (const model of models) {
    const remaining = deadline - Date.now();
    if (remaining < GEMINI_MIN_ATTEMPT_MS) break;
    const r = await callGeminiOnce(apiKey, model, system, messages, maxTokens, remaining);
    if (r.ok) return { ok: true, data: { content: [{ text: r.text }] }, text: r.text, model };
    lastErr = r.error;
  }
  return { ok: false, error: lastErr || 'Gemini 모든 모델 실패' };
}

async function callOpenAi(apiKey, model, system, messages, maxTokens) {
  const oaMessages = [];
  if (system) oaMessages.push({ role: 'system', content: system });
  (messages || []).forEach((m) => oaMessages.push({ role: m.role || 'user', content: toOpenAiContent(m.content) }));
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens || 2048, messages: oaMessages })
  });
  const json = await res.json();
  if (res.status !== 200) return { ok: false, error: (json.error && json.error.message) || ('OpenAI API 오류 ' + res.status) };
  const text = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  if (!text) return { ok: false, error: 'OpenAI 빈 응답' };
  return { ok: true, data: { content: [{ text }] } };
}

export default async function handler(req, res) {
  const { token, provider, apiKey, models, system, messages, max_tokens } = req.body || {};

  if (!process.env.PROXY_TOKEN || token !== process.env.PROXY_TOKEN) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }
  if (!apiKey || !Array.isArray(models) || models.length === 0) {
    res.status(400).json({ ok: false, error: 'apiKey/models가 필요합니다.' });
    return;
  }

  try {
    let result;
    if (provider === 'gemini') result = await callGemini(apiKey, models, system, messages, max_tokens);
    else if (provider === 'openai') result = await callOpenAi(apiKey, models[0], system, messages, max_tokens);
    else result = await callClaude(apiKey, models[0], system, messages, max_tokens);
    res.status(200).json(result);
  } catch (e) {
    res.status(200).json({ ok: false, error: e.message });
  }
}
