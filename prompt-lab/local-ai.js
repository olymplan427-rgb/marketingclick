// 로컬 CLI(claude / codex)로 텍스트를 생성·채점한다. API 키 불필요 — 로그인된 CLI 세션을 그대로 씀.
// blog.js가 원래 쓰는 claudeProxyCall(구글시트 사용량 소진, 로그인 필요)은 전혀 거치지 않는다.

const { execFileSync } = require('child_process');
const os = require('os');

function which(bin) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [bin], { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

const HAS_CLAUDE = which('claude');
const HAS_CODEX = which('codex');

// system+user를 하나로 합쳐 claude -p에 stdin으로 넘긴다(blog_cc/server.py와 동일한 방식).
// cwd를 프로젝트 밖(임시 폴더)으로 둬서 이 저장소의 CLAUDE.md/메모리를 안 불러오게 함 —
// 안 그러면 프롬프트 테스트에 프로젝트 관례 설명이 섞여 들어가 결과가 오염된다.
function runClaude(prompt, { maxTokens } = {}) {
  if (!HAS_CLAUDE) throw new Error('claude CLI를 찾을 수 없습니다. `claude`가 PATH에 있는지 확인하세요.');
  // Windows에서는 npm 글로벌 설치가 claude.cmd 실행 셰임이라 shell:true 없이는 spawn이 ENOENT로
  // 실패한다(cmd/ps1은 CreateProcess가 직접 못 띄움 — cmd.exe를 거쳐야 함).
  const out = execFileSync('claude', ['-p'], {
    input: prompt,
    cwd: os.tmpdir(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
    timeout: 180000,
    shell: true,
  });
  return out.trim();
}

function runCodex(prompt) {
  if (!HAS_CODEX) throw new Error('codex CLI를 찾을 수 없습니다.');
  // codex exec는 비대화형 1회 실행 모드 — 정확한 플래그는 codex 버전에 따라 다를 수 있으니
  // 설치 후 `codex exec --help`로 한 번 확인해서 필요하면 아래 인자만 맞추면 됨.
  const out = execFileSync('codex', ['exec', prompt], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
    timeout: 180000,
    shell: true,
  });
  return out.trim();
}

// blog.js의 blogCall(systemPrompt, userContent, maxTokens) 대체 구현.
// blog.js 쪽 blogGenerateWithRepair가 이 함수를 그대로 재시도 로직에 태우므로, 여기선
// 순수하게 "텍스트 생성"만 책임지면 된다(파싱/복구는 원본 blog.js 코드가 그대로 처리).
async function blogCallViaCli(systemPrompt, userContent, maxTokens) {
  const combined = '<system_instructions>\n' + systemPrompt + '\n</system_instructions>\n\n' + userContent;
  return runClaude(combined, { maxTokens });
}

module.exports = { HAS_CLAUDE, HAS_CODEX, runClaude, runCodex, blogCallViaCli };
