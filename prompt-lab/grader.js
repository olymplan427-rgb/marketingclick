// 기계적으로 판단하기 어려운 항목(문장 자연스러움, 제목-본문 일치, 홍보 과도 여부 등)을
// claude/codex 두 CLI에 각각 독립적으로 채점시켜 교차검증한다. 결과가 크게 엇갈리면
// 그 자체가 "판단이 애매한 글"이라는 신호이므로 사람이 직접 봐야 한다는 뜻이다.

const { runClaude, runCodex, HAS_CLAUDE, HAS_CODEX } = require('./local-ai');
const { fullBodyText } = require('./checks');

// 브랜드 톤 가이드(styleGuide)는 blog.js의 BLOG_DRAFT_STYLE_DEFAULT를 그대로 넘겨받아 쓴다 —
// "잘 쓴 글인지"의 기준이 매번 바뀌는 분량/구조 지시가 아니라 비교적 고정된 브랜드 톤이어야
// 한다는 앞선 논의에 따른 것.
function buildGradingPrompt(result, topic, styleGuide) {
  const body = fullBodyText(result);
  return [
    '너는 학원 블로그 원고를 검수하는 깐깐한 편집자다. 아래 글이 실제로 "잘 쓴 글"인지 평가해라.',
    '',
    '## [채점 기준 — 우리 학원 톤 가이드]',
    styleGuide,
    '',
    '## [평가 항목]',
    '1. 제목과 본문 내용이 실제로 일치하는가',
    '2. 문장이 자연스럽게 이어지는가 (번역투, AI 상투구, 어색한 어미 없이)',
    '3. 같은 설명이나 표현이 불필요하게 반복되지는 않는가',
    '4. 글 유형(' + topic.type + ')과 분위기(' + topic.mood + ')에 실제로 맞는가',
    '5. 학원 홍보가 과도하지 않고 자연스러운가',
    '6. 전반적으로 학부모가 읽었을 때 신뢰가 가는 글인가',
    '',
    '## [평가 대상 글]',
    '제목: ' + (result.title || ''),
    '',
    body,
    '',
    '## [출력 형식]',
    '반드시 아래 JSON 형식으로만 응답해라. 다른 텍스트를 포함하지 마라.',
    '{"score": 1~10 사이 정수, "issues": ["구체적으로 어디가 왜 문제인지 — 문장을 인용해서"], "summary": "한 줄 총평"}',
  ].join('\n');
}

function parseGradingJson(text) {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('채점 결과에서 JSON을 찾지 못함: ' + text.slice(0, 200));
  return JSON.parse(match[0]);
}

async function gradeWith(cliName, result, topic, styleGuide) {
  const prompt = buildGradingPrompt(result, topic, styleGuide);
  const runner = cliName === 'codex' ? runCodex : runClaude;
  try {
    const raw = runner(prompt);
    return parseGradingJson(raw);
  } catch (e) {
    return { score: null, issues: [], summary: '채점 실패: ' + e.message };
  }
}

// 둘 다 있으면 교차검증, claude만 있으면 claude만.
async function gradeCrossValidated(result, topic, styleGuide) {
  const graders = [{ name: 'claude', available: HAS_CLAUDE }, { name: 'codex', available: HAS_CODEX }];
  const out = {};
  for (const g of graders) {
    if (!g.available) { out[g.name] = { score: null, issues: [], summary: '(CLI 미설치)' }; continue; }
    out[g.name] = await gradeWith(g.name, result, topic, styleGuide);
  }
  return out;
}

module.exports = { gradeCrossValidated, buildGradingPrompt };
