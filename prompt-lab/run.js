#!/usr/bin/env node
// 사용법:
//   node run.js                 → topics.json 전체 실행, 규칙 검사만
//   node run.js edu-column       → 특정 주제(id)만 실행
//   node run.js --grade          → 규칙 검사 + claude/codex 정성평가까지
//   node run.js edu-column --grade
//
// 실제 구글시트/사용량에는 전혀 기록되지 않는다 — 로컬 claude/codex CLI만 사용.

const fs = require('fs');
const path = require('path');
const { loadBlogSandbox } = require('./sandbox');
const { blogCallViaCli, HAS_CLAUDE, HAS_CODEX } = require('./local-ai');
const { runChecks } = require('./checks');
const { gradeCrossValidated } = require('./grader');

const args = process.argv.slice(2);
const doGrade = args.includes('--grade');
const topicFilter = args.find((a) => !a.startsWith('--'));

const allTopics = JSON.parse(fs.readFileSync(path.join(__dirname, 'topics.json'), 'utf8'));
const topics = topicFilter ? allTopics.filter((t) => t.id === topicFilter) : allTopics;

if (topics.length === 0) {
  console.error('해당 id의 주제를 찾을 수 없습니다:', topicFilter);
  process.exit(1);
}

if (!HAS_CLAUDE) {
  console.error('claude CLI를 찾을 수 없습니다. 설치 후 다시 시도하세요.');
  process.exit(1);
}
if (doGrade && !HAS_CODEX) {
  console.warn('⚠️ codex CLI가 없어 정성평가는 claude만 단독으로 진행합니다 (교차검증 아님).');
}

function statusMark(s) {
  return s === 'pass' ? '✅' : s === 'warn' ? '⚠️' : '❌';
}

async function runOneTopic(topic) {
  console.log(`\n=== [${topic.id}] ${topic.type} — "${topic.topic}" (목표 ${topic.length}자) ===`);

  const ctx = loadBlogSandbox();
  ctx.blogCall = blogCallViaCli;
  ctx.blogCallClaude = blogCallViaCli;
  ctx.blogState.inputs = {
    type: topic.type, mood: topic.mood, topic: topic.topic, target: topic.target,
    length: topic.length, keywords: topic.keywords, core: topic.core, point: topic.point,
    refUrl: '', refContents: {},
  };

  console.log('  초안 생성 중...');
  const draftSystem = ctx.getBlogDraftSystem(topic.type);
  const draft = await ctx.blogGenerateWithRepair(draftSystem, ctx.blogBuildInputText(), 4096, 8192);

  console.log('  최종 본문 생성 중...');
  const userMsg = '[최초 입력값]\n' + ctx.blogBuildInputText()
    + '\n\n[확정된 글 설계도]\n' + JSON.stringify(draft, null, 2)
    + '\n\n[추가 수정 요청]\n없음'
    + '\n\n작성 지시:\n'
    + '- 각 section의 role을 따라 본문의 논리 흐름을 구성한다. summary를 단순히 늘리지 말고 role에 맞는 완성 글로 재작성한다.\n'
    + '- structure(구조 유형)를 유지한다.\n'
    + '- 결론은 ctaDirection 방향으로 마무리한다.\n'
    + '- 추가 수정 요청이 설계도와 충돌하지 않는 한 설계도를 유지한다.';
  const finalSystem = ctx.applyAcademyVars(ctx.getBlogFinalSystem());
  const result = await ctx.blogGenerateWithRepair(finalSystem, userMsg, 8192, 16000);

  const bannedFound = ctx.blogFilterBannedWords(result);
  ctx.blogStripBold(result);

  const checkResult = runChecks(result, topic);
  console.log(`  규칙 검사: ${checkResult.summary.pass || 0}통과 / ${checkResult.summary.warn || 0}경고 / ${checkResult.summary.fail || 0}실패`);
  checkResult.items.forEach((it) => console.log(`    ${statusMark(it.status)} ${it.name}: ${it.detail}`));
  if (bannedFound.length) console.log(`    (참고) 금지어 필터가 자동 치환한 표현: ${bannedFound.join(', ')}`);

  let grading = null;
  if (doGrade) {
    console.log('  정성평가 중 (claude' + (HAS_CODEX ? ' + codex' : '') + ')...');
    grading = await gradeCrossValidated(result, topic, ctx.BLOG_DRAFT_STYLE_DEFAULT);
    Object.entries(grading).forEach(([name, g]) => {
      console.log(`    [${name}] 점수: ${g.score ?? '-'} — ${g.summary || ''}`);
      (g.issues || []).forEach((i) => console.log(`       - ${i}`));
    });
  }

  return { topic, draft, result, checkResult, grading };
}

(async () => {
  const runResults = [];
  for (const topic of topics) {
    try {
      runResults.push(await runOneTopic(topic));
    } catch (e) {
      console.error(`  ❌ [${topic.id}] 실행 실패: ${e.message}`);
      runResults.push({ topic, error: e.message });
    }
  }

  const resultsDir = path.join(__dirname, 'results');
  fs.mkdirSync(resultsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(resultsDir, `run-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(runResults, null, 2), 'utf8');

  console.log(`\n결과 저장: ${outPath}`);

  const totalFail = runResults.reduce((n, r) => n + (r.checkResult ? r.checkResult.summary.fail || 0 : 0), 0);
  console.log(`\n총 ${runResults.length}개 주제 실행, 규칙 검사 실패 총 ${totalFail}건.`);
})();
