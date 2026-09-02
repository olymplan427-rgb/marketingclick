var blogState = { draft: null, result: null, step: 1, historyPosts: null, historySelected: -1 };
// 모델은 설정 페이지의 getModel('claude') 로 동적 참조

// 프롬프트를 고칠 때마다 이 값을 올려서, 시트에 저장된 글이 어떤 프롬프트 버전으로
// 나왔는지 나중에 추적할 수 있게 함 (분량 지시 등 프롬프트 변경 이력과 실제 결과물 대조용)
var BLOG_PROMPT_VERSION = 'v8-body-image-google-search-2026-09-01';

// ── 교육청 표시광고 심의 대상 금지어 (감지 시 대체 표현으로 필터링) ──
// 복합어(선행학습)를 먼저 검사해야 "사전학습학습" 같은 중복 치환을 피할 수 있음 — 순서 중요
var BLOG_BANNED_WORDS = ['선행학습', '선행', '예비'];
var BLOG_WORD_REPLACEMENTS = { '선행학습': '사전학습', '선행': '사전', '예비': '신입' };

// ── 유형별 특화 프롬프트 ──────────────────────────────────────────
var BLOG_TYPE_RULES = {
  '교육칼럼': '## [글 유형: 교육칼럼·학습법]\n제목 패턴: "[올림피아드교육 교육칼럼] [주제]" 또는 "[학습 키워드], [결과/효과]"\n권장 구조(하나 선택):\n- 고민해결형: 학부모·학생 고민 → 원인/배경 → 해결 방법 → 학원 철학 연결 → CTA\n- 비교설명형: 일반적 방식 → 놓치기 쉬운 점 → 더 나은 접근 → CTA\n- 스토리텔링형: 공감 상황 → 전환점 → 변화·성과 → 브랜드 메시지 → CTA\n특화 지시: 학원 주요 키워드·교육 철학을 자연스럽게 녹일 것. 교과서식 결론("열심히 하면 됩니다") 금지.',

  '입시정보': '## [글 유형: 입시정보·전형]\n제목 패턴: "[연도]학년도 [학교명] 입학 전형! [핵심 정보 2~3가지] 🔎"\n권장 구조: 핵심 요약(✅ 항목) → 모집인원·일정 → 지원자격 → 전형방법 → 최근 경쟁률 → CTA\n특화 지시: 정확한 숫자·날짜 우선. 핵심 요약 블록(✅)으로 한눈에 파악 가능하게. 학원 연결은 마지막에만.',

  '학원홍보': '## [글 유형: 학원홍보·캠퍼스]\n제목 패턴: "[지역명] 수학학원 [특징]! [혜택/이벤트] [이모지]"\n권장 구조: 캠퍼스 소개 → 초등 특징 → 중등 특징 → (고등 특징 또는 설명회 안내) → 재원생 후기(선택) → CTA\n특화 지시: 캠퍼스명·전화번호·셔틀버스 등 실무 정보 포함. 마무리는 "수학은 역시 {{학원명}}".',

  '합격인터뷰': '## [글 유형: 합격생 인터뷰]\n제목 패턴: "[학교명] 합격생 인터뷰! \\"[인터뷰 핵심 한마디]\\""\n권장 구조: 합격 기본 정보 → Q&A 3~5개 → 편집자 코멘트 → 응원 문구 → 관련 포스팅 유도 → CTA\n특화 지시: 학생 이름은 ♥♥♥ 처리. 답변은 직접 인용 느낌으로 자연스럽게. 마무리: "{{학원명}}은 ♥♥ 학생의 앞날을 응원합니다💚"',

  '수학정보': '## [글 유형: 수학 정보]\n제목 패턴: "[수학 개념/주제] 완벽 정리! [활용 포인트]" 또는 "생활 속 [주제]에서 찾는 수학 이야기"\n권장 구조: 흥미로운 도입(일상 상황 또는 질문) → 핵심 개념 설명 → 학년별 연관성 → 학습 포인트 → CTA\n특화 지시: 수학 개념은 정확하게. 어려운 용어는 쉽게 풀어쓸 것. 공식·계산은 구체적 예시와 함께.',

  '이벤트안내': '## [글 유형: 이벤트 안내]\n제목 패턴: "[이벤트명] 안내! [날짜 또는 혜택] [이모지]"\n권장 구조: 이벤트 핵심 요약 → 일시·장소·대상 세부 안내 → 참가 방법 → 주의사항(선택) → CTA(마감일 강조)\n특화 지시: 일시·장소·대상·신청 방법은 굵게 또는 목록으로 명확하게. 마감일은 반드시 포함.',

  '학원공지': '## [글 유형: 학원 공지]\n제목 패턴: "[공지 내용] 안내 [이모지]"\n권장 구조: 공지 핵심 요약(1~2문장) → 세부 내용 → 변경사항·일정 → 문의 방법\n특화 지시: 군더더기 없이 간결하게. 독자가 즉시 행동할 수 있도록 문의처(전화·링크)를 명확히. 인사말은 최소화.'
};

// ── 설정 페이지에서 원장님이 편집하는 글쓰기 스타일 (기본값) ────────
var BLOG_DRAFT_STYLE_DEFAULT = [
  '학부모와 학생에게 진심이 담긴 글을 씁니다.',
  '',
  '말투: 친근하면서도 신뢰감 있게 (너무 딱딱하지도, 너무 가볍지도 않게)',
  '이모지: 단락마다 1~2개 자연스럽게 사용',
  '광고 티가 나는 표현("지금 바로", "놓치지 마세요", "강력 추천" 등)은 반복하지 않기',
  '학부모가 공감할 상황에서 시작해서 학원의 해결책으로 자연스럽게 연결',
  '검색 키워드는 제목과 첫 단락에 자연스럽게 포함',
  '글마다 구체적인 상황, 사례, 시기를 달리해서 비슷한 글이 반복되지 않도록'
].join('\n');

// ── 코드 고정 기술 프롬프트 (편집 불가, 자동 조립) ──────────────
var BLOG_DRAFT_TECHNICAL = '당신은 {{학원명}} 공식 블로그 전문 에디터입니다.\n\n## [학원 정보]\n- 학원명: {{학원명}}\n- 주요 키워드: {{키워드}}\n- 과목: {{과목}}\n- 주요 대상: {{대상}}\n- 웹사이트: {{웹사이트}}\n\n## [분량 제약 — 최우선 준수]\n{{LENGTH_GUIDE}}\n이 분량 제약은 아래 유형별 권장 구조보다 우선한다. 목표 분량이 작으면 유형 구조의 일부 단계를 생략하거나 통합해서 섹션 개수를 반드시 지킬 것.\n\n{{TYPE_RULES}}\n\n## [원장님 글쓰기 스타일 지시]\n{{USER_STYLE}}\n\n## [출력 형식]\n반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.\n\n{"title":"포스팅 제목 (25~45자, SEO 키워드 앞부분 배치)","structure":"선택한 구조 유형명","intro":"도입부 (2~3문장)","sections":[{"heading":"소제목","summary":"이 섹션에서 다룰 내용 요약 — 문장 수와 구체성은 목표 분량에 맞출 것","role":"이 섹션이 글 전체에서 맡는 역할 (예: 공감 형성, 문제 제기, 원인 분석, 해결책 제시, 신뢰 근거, 학원 연결)"}],"conclusion":"마무리 멘트 (1~2문장)","ctaDirection":"결론 CTA 방향 — 반드시 아래 3가지 중 하나만 선택: 상담 신청 / 학력진단평가 신청 / 설명회 참석. 글의 주제·맥락에 가장 적합한 것 하나를 선택할 것","tags":["키워드태그1","키워드태그2","키워드태그3"]}\n\n{{LENGTH_GUIDE}}\n규칙: 학원 주요 키워드를 자연스럽게 녹여낼 것 / 각 섹션 role은 서로 달라야 하며 글의 논리 흐름을 만들 것';

// 하위 호환용
var BLOG_DRAFT_BASE = BLOG_DRAFT_STYLE_DEFAULT;
var BLOG_DRAFT_SYSTEM = BLOG_DRAFT_STYLE_DEFAULT;

function getBlogDraftSystem(type) {
  var userStyle = localStorage.getItem('mtt_blog_prompt') || BLOG_DRAFT_STYLE_DEFAULT;
  var typeRule = BLOG_TYPE_RULES[type] || '';

  // 목표 분량에 맞춰 섹션 개수·요약 깊이를 조절하는 지시 — 분량과 무관하게
  // 항상 섹션 2~4개/요약 3~5문장으로 고정돼 있으면, 최종 본문이 확장할 재료 자체가
  // 목표 분량과 상관없이 비슷해져서 긴 목표를 요청해도 짧게 나오는 문제가 있었음
  var targetLen = parseInt((blogState.inputs && blogState.inputs.length) || '1500', 10);
  var sectionGuide;
  if (targetLen <= 1000) {
    sectionGuide = '섹션은 정확히 2개만 만들 것(3개 이상 금지), 각 summary는 2~3문장으로 짧고 핵심만 담을 것. 사례는 1개 이상 만들지 말 것(여러 학생·여러 사례를 나열하면 분량이 넘친다)';
  } else if (targetLen <= 2000) {
    sectionGuide = '섹션 3개만 만들 것(4개 이상 금지), 각 summary는 3~5문장이며 구체적 사례는 최대 1개만 포함할 것';
  } else {
    sectionGuide = '섹션 4~6개, 각 summary는 4~6문장이며 구체적 사례·수치·전환 흐름까지 포함해 최종 본문 확장 시 충분한 분량이 나오도록 상세히 작성할 것';
  }
  var lengthGuide = '목표 분량은 ' + targetLen + '자(공백 제외, 최종 결과물 전체 기준)이다. ' + sectionGuide;

  // 저장 시(blogFinalize) 이 값을 시트에 같이 남기기 위해 blogState에 보관 —
  // 나중에 "이 글이 어떤 분량 지시로 나왔는지" 실제 결과물과 대조할 수 있게 함
  if (blogState.inputs) blogState.inputs._sectionGuide = sectionGuide;

  return BLOG_DRAFT_TECHNICAL
    .replace('{{TYPE_RULES}}', typeRule)
    .replace('{{USER_STYLE}}', userStyle)
    .replace(/\{\{LENGTH_GUIDE\}\}/g, lengthGuide);
}

var BLOG_FINAL_SYSTEM = '당신은 {{학원명}} 공식 블로그 전문 에디터입니다.\n제공된 초안과 변형 요소를 바탕으로 완성된 네이버 블로그 본문을 작성합니다.\n\n## [브랜드 정보]\n- 학원명: {{학원명}}\n- 주요 키워드: {{키워드}}\n- 과목: {{과목}}\n- 주요 대상: {{대상}}\n- 웹사이트: {{웹사이트}}\n\n## [분량 — 반드시 준수]\n- 목표 분량: {{목표분량}}자 (공백 제외 — title, intro, 모든 section의 heading+body, conclusion, tags, 연락처 블록까지 전부 합친 최종 결과물 전체 기준. 네이버 블로그에 그대로 붙여넣을 실제 글자수와 같아야 한다)\n- 반드시 목표 분량의 90~110% 범위 안에서 작성한다. 소제목·구분선·태그·연락처 블록도 전부 이 분량에 포함되므로, 본문(body)은 그만큼 줄여서 전체 합이 목표를 넘지 않게 조절한다.\n- 초안 설계도의 summary를 그대로 옮기지 말고, 각 섹션 body를 구체적 사례·설명·전환 문장으로 확장하되, 전체 분량 목표를 넘지 않는 선에서 조절한다.\n- 목표보다 짧게 끝내는 것도, 목표를 초과하는 것도 금지한다.\n\n## [말투 & 표현 규칙]\n- 경칭: 학부모 → "학부모님", 학생 → "학생들", "우리 학생들"\n- 어미: 기본은 "~해요/~예요" 계열, 문단 첫 문장·핵심 강조 문장에서만 "~합니다/~입니다" 예외 사용 (무작위 혼합 금지)\n- 이모지: 단락당 1~2개 자연스럽게 (💚💡📚✨ 등)\n- 줄바꿈: 모바일 가독성 위해 2~3문장 후 빈 줄\n- SEO 키워드: 원형 그대로 제목·첫 단락에 자연스럽게\n\n## [유사도 방지]\n- 초안에서 선택한 구조 유형을 유지합니다.\n- "주목해 주세요", "꼭 확인해 보세요", "적극 추천합니다", "지금 바로", "고민이신 학부모님이라면" 같은 표현은 한 글에 1회 이상 반복하지 않습니다.\n- 이번 글만의 구체적 상황·사례·포인트가 본문에 명확히 드러나야 합니다.\n\n## [AI 티 방지 규칙 — 반드시 준수]\nS1 절대 금지 (한 번이라도 나오면 수정):\n- 연결어미 뒤 쉼표 금지: "하지만," "그리고," "그러나," → 쉼표 삭제\n- AI 상투구 금지: "결론적으로", "혁신적인", "시대가 도래했다", "주목할 만하다", "~의 가능성을 열어준다", "새로운 패러다임"\n- 번역투 금지: "~에 대해" → "~를", "~를 통해" → "~로", "가지고 있다" → "있다", 이중 피동("~되어지다")\n\nS2 같은 패턴 3회 이상 금지:\n- 볼드(**) 사용 금지 — 네이버 블로그에는 서식 없는 텍스트로 복사되어 별표(**)가 그대로 노출되므로 어떤 경우에도 사용하지 않는다\n- 정도부사 반복 — "매우", "정말", "굉장히" 연속 사용 금지\n- 문두 접속사 남발 — "하지만", "그러나", "이는", "즉" 연속 금지\n- 기계적 나열 — "첫째/둘째/셋째" → 산문으로 녹이기\n- 헤징 과다 — "~할 수 있을 것으로 보인다", "~라고 할 수 있다" 반복 금지\n- "~것이다", "~할 필요가 있다" 반복 금지\n\n리듬: 단문(10자 이하)과 장문(30자 이상)을 섞어 단조로움 방지. 종결어미는 무작위로 섞지 않는다 — 기본 어미를 "~해요/~예요" 계열로 통일하고, 문단 첫 문장이나 핵심을 강조하는 문장에서만 예외적으로 "~합니다/~입니다"를 사용해 무게감을 준다.\n\n## [금지 표현 — 교육청 표시광고 심의 대상]\n아래 단어는 제목·본문·태그 어디에도 어떤 형태로도 사용하지 않습니다. 반드시 대체 표현으로 재구성합니다.\n- "선행" (선행학습 등 포함) → "사전학습" 등으로 대체\n- "예비" (예비중1 등 포함) → "신입" 또는 문맥에 맞게 자연스럽게 재구성\n\n## [글 마지막 연락처 블록]\n글 마지막에 아래 형식으로 연락처 블록을 반드시 포함합니다.\n{{학원명}}\n📞 {{연락처}}\n🗺️ 네이버지도: {{지도링크}}\n🌐 {{웹사이트}}\n연락처나 링크가 비어 있는 항목은 생략합니다.\n\n반드시 아래 JSON 형식으로만 응답하세요.\n\n{"title":"최종 포스팅 제목 (25~45자, SEO 키워드 앞부분)","intro":"도입부 본문 (초안 도입부 기반, 이번 글 방식으로 시작)","sections":[{"heading":"소제목","body":"완성된 본문 내용. 줄바꿈은 \\n\\n 사용"}],"conclusion":"마무리 본문 + CTA 블록 (CTA 유형에 따라 작성)","tags":["태그1","태그2","태그3","태그4","태그5"],"images":[{"section_index":0,"placement":"1번 섹션 본문 중간","search_query":"학생 공부 교실 (구글 이미지 검색에 넣을 한국어 검색어, 2~4단어)","description":"이 이미지가 표현하는 장면과 분위기를 한국어로 2~3문장으로 설명"}]}\n\n이미지 규칙: 썸네일은 만들지 않는다. 각 섹션(section)마다 그 내용과 어울리는 본문 삽입 이미지 1개씩을 images 배열에 추천한다 (section_index는 0부터 시작하는 sections 배열 인덱스). AI로 이미지를 생성하지 않고, 라이선스가 확보된 이미지를 사용자가 직접 찾아 쓸 것이므로 search_query에는 참고용 추천 검색어로 해당 섹션 내용에 어울리는 사진이 나올 만한 짧고 구체적인 한국어 검색어를 넣을 것 (예: "칠판 앞 선생님 학생", "책상 공부 노트북"). 추상적인 단어("성장", "미래") 대신 눈에 보이는 구체적 장면 위주로.\n글자 수: 위 [분량] 섹션의 목표({{목표분량}}자, 공백 제외)를 반드시 지킬 것';

// 목표 분량 숫자를 실제로 주입 — 기존 코드는 BLOG_FINAL_SYSTEM을 정적 문자열로만 썼는데,
// 그 안의 {{목표분량}} 자리표시자를 채워주지 않으면 분량 지시가 숫자 없이 뭉뚱그려져
// 모델이 유저 메시지 쪽 숫자를 다시 참조해야 하는 약한 지시가 됨
function getBlogFinalSystem() {
  var targetLen = (blogState.inputs && blogState.inputs.length) || '1500';
  return BLOG_FINAL_SYSTEM.replace(/\{\{목표분량\}\}/g, targetLen);
}

function autoResizeBlogTextarea(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function blogGoStep(n) {
  blogState.step = n;
  document.getElementById('blog-right-step1').classList.toggle('show', n === 1);
  document.getElementById('blog-right-step2').classList.toggle('show', n === 2);
  document.getElementById('blog-right-step3').classList.toggle('show', n === 3);
  if (n === 2) setTimeout(function() {
    document.querySelectorAll('#blog-right-step2 .auto-resize').forEach(function(el) { autoResizeBlogTextarea(el); });
  }, 0);
  if (n === 3) blogSwitchTab('post');
}

function blogSwitchTab(tab) {
  var isPost = tab === 'post';
  document.getElementById('blog-post-container').style.display = isPost ? '' : 'none';
  document.getElementById('blog-img-container').style.display = isPost ? 'none' : '';
  var pb = document.getElementById('blog-tab-post-btn');
  var ib = document.getElementById('blog-tab-img-btn');
  if (pb) { pb.style.cssText = isPost ? 'background:var(--acc);color:#fff;border-color:var(--acc);' : ''; }
  if (ib) { ib.style.cssText = !isPost ? 'background:var(--acc);color:#fff;border-color:var(--acc);' : ''; }
}

function blogSleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

// 504(릴레이 타임아웃)·일시적 서버 오류는 대부분 재시도하면 풀리는 것으로 확인됨(2026-09) —
// 화면에 "다시 시도해주세요" 문구를 바로 보여주지 말고, 백그라운드에서 조용히 여러 번
// 재시도한 뒤 그래도 안 되면 그때만 에러를 던진다. 사용자는 그동안 기존 "생성중..." 버튼
// 문구만 계속 보게 된다.
async function blogCallClaude(systemPrompt, userContent, maxTokens) {
  var maxAttempts = 4;
  var delay = 4000;
  var lastErr;
  for (var attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      var data = await claudeProxyCall({ model: getModel('claude'), max_tokens: maxTokens || 2048, system: systemPrompt, messages: [{ role: 'user', content: userContent }] });
      var text = data && data.content && data.content[0] && data.content[0].text;
      if (!text) throw new Error('AI로부터 빈 응답을 받았습니다.');
      return text;
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts - 1) {
        await blogSleep(delay);
        delay = Math.min(delay * 2, 20000);
      }
    }
  }
  throw new Error((lastErr && lastErr.message) || '생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
}

async function blogCall(systemPrompt, userContent, maxTokens) {
  return blogCallClaude(systemPrompt, userContent, maxTokens);
}

function blogCleanJson(text) {
  var s = text.trim().replace(/^```json\s*/,'').replace(/\s*```$/,'').replace(/^```\s*/,'').trim();
  var m = s.match(/\{[\s\S]*\}/);
  return m ? m[0] : s;
}

// 잘린 JSON 복구 — 미완성 문자열·배열·객체를 닫아 파싱 가능하게 만듦
function blogRepairJson(text) {
  var s = text.trim().replace(/^```json\s*/,'').replace(/^```\s*/,'').trim();
  var start = s.indexOf('{');
  if (start < 0) return null;
  s = s.slice(start);
  var out = '';
  var stack = [];      // 열린 괄호 추적: '{' 또는 '['
  var inStr = false;
  var esc = false;
  for (var i = 0; i < s.length; i++) {
    var ch = s[i];
    out += ch;
    if (inStr) {
      if (esc) { esc = false; }
      else if (ch === '\\') { esc = true; }
      else if (ch === '"') { inStr = false; }
      continue;
    }
    if (ch === '"') { inStr = true; }
    else if (ch === '{' || ch === '[') { stack.push(ch); }
    else if (ch === '}' || ch === ']') { stack.pop(); }
  }
  // 문자열이 열린 채로 끝났으면 닫기
  if (inStr) out += '"';
  // 트레일링 쉼표 제거
  out = out.replace(/,\s*$/, '');
  // 열린 괄호들 역순으로 닫기
  for (var j = stack.length - 1; j >= 0; j--) {
    out += (stack[j] === '{') ? '}' : ']';
  }
  try { return JSON.parse(out); } catch(e) { return null; }
}

function blogParseJson(text) {
  var cleaned = blogCleanJson(text);
  try { return JSON.parse(cleaned); } catch(e1) {}
  try { return JSON.parse(cleaned.replace(/\n/g,' ').replace(/\r/g,'')); } catch(e2) {}
  throw new Error('JSON 파싱 실패');
}

// 파싱 실패 시 더 큰 max_tokens로 재시도하기 전에, 추가 API 호출 없이 되는 blogRepairJson(잘린
// JSON 복구)을 먼저 시도한다 — 응답이 살짝 잘린 경우는 대부분 이걸로 복구되므로, 매번 두 배
// 큰 토큰으로 재호출하는 costly한 경로(생성 시간도 늘어나 Cloudflare 524 위험도 커짐)를 피한다.
async function blogGenerateWithRepair(systemPrompt, userText, initialTokens, retryTokens) {
  // blogCall 자체가 던지는 경우(예: "생각" 토큰이 max_tokens를 다 써서 텍스트가 하나도
  // 없는 빈 응답)도 파싱 실패와 동일하게 재시도 대상이어야 하므로, try 안으로 감싼다 —
  // 이전엔 이 호출이 try 밖에 있어서 빈 응답이면 재시도 없이 바로 에러가 던져졌었음.
  async function attempt(tokens) {
    try {
      return { raw: await blogCall(systemPrompt, userText, tokens), error: null };
    } catch (e) {
      return { raw: null, error: e };
    }
  }

  var first = await attempt(initialTokens);
  if (first.raw) {
    try { return blogParseJson(first.raw); }
    catch (e1) {
      var repaired = blogRepairJson(first.raw);
      if (repaired) return repaired;
    }
  }

  // 첫 시도가 빈 응답을 던졌거나 파싱/복구에 실패 — 더 큰 토큰으로 1회 재시도
  var second = await attempt(retryTokens);
  if (second.raw) {
    try { return blogParseJson(second.raw); }
    catch (e2) {
      var repaired2 = blogRepairJson(second.raw);
      if (repaired2) return repaired2;
      throw e2;
    }
  }
  throw second.error || first.error || new Error('AI 응답을 받지 못했습니다.');
}

var BLOG_PROFILE_FIELDS = ['name','subject','target','keywords','website','phone','map','address'];

function blogGenProfileId() {
  return 'p_' + Math.random().toString(36).slice(2, 10);
}

// ── 프로필 목록 관리 (다중 학원 지원) ──────────────────────────────
function loadAcademyProfiles() {
  var raw = localStorage.getItem('mtt_academy_profiles');
  if (raw) {
    try { var arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; } catch(e) {}
  }
  // 마이그레이션: 기존 단일 프로필(mtt_academy_profile)이 있으면 배열로 변환
  var legacy = null;
  try { legacy = JSON.parse(localStorage.getItem('mtt_academy_profile') || 'null'); } catch(e) {}
  // 구버전 필드(단축명 short, 슬로건 slogan) → 신규 필드로 이전 (슬로건 텍스트를 키워드로 승계)
  var profiles = (legacy && legacy.name) ? [Object.assign({ id: blogGenProfileId() }, legacy, { keywords: legacy.keywords || legacy.slogan || '' })] : [];
  profiles.forEach(function(p) { delete p.short; delete p.slogan; });
  localStorage.setItem('mtt_academy_profiles', JSON.stringify(profiles));
  return profiles;
}

function saveAcademyProfiles(profiles) {
  localStorage.setItem('mtt_academy_profiles', JSON.stringify(profiles));
}

function getActiveProfileId() {
  return localStorage.getItem('mtt_academy_active_id') || '';
}

function setActiveProfileId(id) {
  localStorage.setItem('mtt_academy_active_id', id);
}

// 현재 활성 프로필 반환 (applyAcademyVars 등 기존 코드 호환용 진입점)
function loadAcademyProfile() {
  var profiles = loadAcademyProfiles();
  if (!profiles.length) return {};
  var activeId = getActiveProfileId();
  var p = profiles.filter(function(x) { return x.id === activeId; })[0];
  return p || profiles[0];
}

function blogRenderProfileSelect(profiles, activeId) {
  var sel = document.getElementById('blog-profile-select');
  if (!sel) return;
  sel.innerHTML = profiles.map(function(p) {
    return '<option value="' + p.id + '"' + (p.id === activeId ? ' selected' : '') + '>' + blogEsc(p.name) + '</option>';
  }).join('');
}

function blogLoadProfileToForm(p) {
  BLOG_PROFILE_FIELDS.forEach(function(k) {
    var el = document.getElementById('acad-' + k);
    if (el) el.value = p[k] || '';
  });
  var statusEl = document.getElementById('blog-academy-status');
  if (statusEl) statusEl.textContent = p.name ? '✓ 설정됨' : '처음 한 번만 입력';
}

// 폼 입력 시 현재 활성 프로필에 저장
function saveAcademyProfile() {
  var profiles = loadAcademyProfiles();
  var activeId = getActiveProfileId();
  var idx = -1;
  for (var i = 0; i < profiles.length; i++) { if (profiles[i].id === activeId) { idx = i; break; } }
  var p = { id: activeId || blogGenProfileId() };
  BLOG_PROFILE_FIELDS.forEach(function(k) {
    p[k] = (document.getElementById('acad-' + k) || {}).value || '';
  });
  if (idx >= 0) profiles[idx] = p; else profiles.push(p);
  saveAcademyProfiles(profiles);
  setActiveProfileId(p.id);
  blogRenderProfileSelect(profiles, p.id);
  var statusEl = document.getElementById('blog-academy-status');
  if (statusEl) statusEl.textContent = p.name ? '✓ 설정됨' : '처음 한 번만 입력';
}

// 저장 버튼 클릭 — 즉시 저장 + 잠깐 피드백 표시 후 원래 상태 문구로 복귀
function blogSaveProfileClick() {
  saveAcademyProfile();
  var statusEl = document.getElementById('blog-academy-status');
  if (!statusEl) return;
  var restore = statusEl.textContent;
  statusEl.textContent = '✓ 저장되었습니다';
  setTimeout(function() { statusEl.textContent = restore; }, 1500);
}

function blogSelectProfile(id) {
  setActiveProfileId(id);
  blogLoadProfileToForm(loadAcademyProfile());
}

function blogAddProfile() {
  var profiles = loadAcademyProfiles();
  var p = { id: blogGenProfileId() };
  BLOG_PROFILE_FIELDS.forEach(function(k) { p[k] = ''; });
  profiles.push(p);
  saveAcademyProfiles(profiles);
  setActiveProfileId(p.id);
  blogRenderProfileSelect(profiles, p.id);
  blogLoadProfileToForm(p);
  var nameInput = document.getElementById('acad-name');
  if (nameInput) nameInput.focus();
}

function blogDeleteProfile() {
  var profiles = loadAcademyProfiles();
  if (profiles.length <= 1) { alert('최소 1개의 프로필은 유지해야 합니다.'); return; }
  var activeId = getActiveProfileId();
  var p = profiles.filter(function(x) { return x.id === activeId; })[0];
  if (!confirm((p && p.name ? p.name : '이 프로필') + '을(를) 삭제하시겠습니까?')) return;
  profiles = profiles.filter(function(x) { return x.id !== activeId; });
  saveAcademyProfiles(profiles);
  setActiveProfileId(profiles[0].id);
  blogRenderProfileSelect(profiles, profiles[0].id);
  blogLoadProfileToForm(profiles[0]);
}

function initAcademyProfile() {
  var profiles = loadAcademyProfiles();
  if (!profiles.length) {
    var p = { id: blogGenProfileId() };
    BLOG_PROFILE_FIELDS.forEach(function(k) { p[k] = ''; });
    profiles = [p];
    saveAcademyProfiles(profiles);
    setActiveProfileId(p.id);
  }
  if (!getActiveProfileId()) setActiveProfileId(profiles[0].id);
  blogRenderProfileSelect(profiles, getActiveProfileId());
  blogLoadProfileToForm(loadAcademyProfile());
  if (loadAcademyProfile().name) {
    var body = document.getElementById('blog-academy-body');
    if (body) body.style.display = 'none';
    var tog = document.getElementById('blog-academy-toggle');
    if (tog) tog.textContent = '▼';
  }
}

function toggleBlogAcademy() {
  var body = document.getElementById('blog-academy-body');
  var tog  = document.getElementById('blog-academy-toggle');
  if (!body) return;
  var isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'flex';
  if (tog) tog.textContent = isOpen ? '▼' : '▲';
}

function applyAcademyVars(template) {
  var p = loadAcademyProfile();
  return template
    .replace(/\{\{학원명\}\}/g,   p.name    || '학원')
    .replace(/\{\{운영사\}\}/g,   p.company || '')
    .replace(/\{\{키워드\}\}/g,   p.keywords || '')
    .replace(/\{\{과목\}\}/g,     p.subject || '수학')
    .replace(/\{\{대상\}\}/g,     p.target  || '학부모·학생')
    .replace(/\{\{웹사이트\}\}/g, p.website || '')
    .replace(/\{\{연락처\}\}/g,   p.phone   || '')
    .replace(/\{\{지도링크\}\}/g, p.map     || '');
}

function blogBuildInputText() {
  var inp = blogState.inputs || {};
  var parts = [];
  if (inp.type)  parts.push('글 유형: ' + inp.type);
  if (inp.mood)  parts.push('글의 분위기: ' + inp.mood);
  if (inp.refUrl) {
    var urls = inp.refUrl.split('\n').map(function(u){ return u.trim(); }).filter(function(u){ return u; });
    if (urls.length) {
      var refContents = inp.refContents || {};
      var refLines = urls.map(function(u, i) {
        var excerpt = refContents[u];
        if (excerpt) {
          return (i+1) + '. ' + u + '\n   [본문 발췌 — 참고용, 그대로 베끼지 말고 주제·스타일 참고만 할 것]\n   ' + excerpt.replace(/\n/g, '\n   ');
        }
        return (i+1) + '. ' + u;
      });
      parts.push('참고 URL:\n' + refLines.join('\n'));
    }
  }
  if (inp.point)   parts.push('피하고 싶은 것: ' + inp.point);
  parts.push('---');
  // 포스팅 정보
  if (inp.topic)     parts.push('주제: ' + inp.topic);
  if (inp.target)    parts.push('타겟 독자: ' + inp.target);
  if (inp.length)    parts.push('목표 분량: ' + inp.length + '자 (공백 제외)');
  if (inp.keywords)  parts.push('검색 키워드: ' + inp.keywords);
  if (inp.core)      parts.push('핵심 메시지: ' + inp.core);
  return parts.join('\n');
}

function blogShowFreeAlert(msg) {
  var el = document.getElementById('blog-free-alert');
  if (el) { el.textContent = msg; el.className = 'blog-alert err show'; }
}
function blogHideFreeAlert() {
  var el = document.getElementById('blog-free-alert');
  if (el) { el.className = 'blog-alert err'; el.textContent = ''; }
}

// 자유 서술 → AI 분석 (보조 기능) — 기존 주제/키워드 입력을 대체하지 않고 자동 채움만 수행
async function blogAnalyzeFreeText(btn) {
  var input = (document.getElementById('blog-free-desc') || {}).value || '';
  input = input.trim();
  if (!input) { blogShowFreeAlert('자유 서술 내용을 입력해주세요.'); return; }
  blogHideFreeAlert();
  var orig = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '분석 중...'; }
  try {
    await useCreditConfirm('blog_analyze', 'AI자율분석');
    var systemPrompt = '당신은 블로그 기획 보조 도구입니다. 사용자의 자유 서술을 분석해 블로그 글 작성에 필요한 핵심 정보를 추출합니다.\n\n반드시 아래 JSON 형식으로만 응답하세요.\n{"topic":"글의 핵심 주제 한 문장 (25~50자)","keywords":"검색 키워드 3~5개, 쉼표로 구분","type":"아래 중 하나만 선택: 교육칼럼, 입시정보, 학원홍보, 합격인터뷰, 수학정보, 이벤트안내, 학원공지","mood":"아래 중 하나만 선택: 차분하고 신뢰감 있는, 친근하고 공감가는, 전문적이고 정보 중심의, 설득력 있고 참여를 유도하는, 따뜻하고 응원하는","target":"타겟 독자층 한 문장 (예: 초등 고학년 자녀를 둔 학부모)"}';
    var raw = await blogCall(systemPrompt, input, 1024);
    var parsed = blogParseJson(raw);
    if (parsed.topic)    document.getElementById('blog-topic').value = parsed.topic;
    if (parsed.keywords) document.getElementById('blog-keywords').value = parsed.keywords;
    if (parsed.type)      document.getElementById('blog-type').value = parsed.type;
    if (parsed.mood)      document.getElementById('blog-mood').value = parsed.mood;
    if (parsed.target)    document.getElementById('blog-target').value = parsed.target;
    if (btn) { btn.textContent = '반영됨'; setTimeout(function() { btn.textContent = orig; }, 1500); }
  } catch(e) {
    if (!e.cancelled) blogShowFreeAlert(e.message || '분석 중 오류가 발생했습니다.');
    if (btn) btn.textContent = orig;
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function blogGenerateDraft() {
  var topic = document.getElementById('blog-topic').value.trim();
  if (!topic) { blogShowAlert('1', '주제를 입력해주세요.'); return; }
  try {
    await useCreditConfirm('blog_generate', '블로그 초안 생성');
  } catch(qe) { if (!qe.cancelled) blogShowAlert('1', qe.message || '크레딧 확인에 실패했습니다.'); return; }
  blogHideAlert('1');
  blogState.inputs = {
    type:     (document.getElementById('blog-type')     || {}).value || '',
    mood:     (document.getElementById('blog-mood')     || {}).value || '',
    refUrl:   ((document.getElementById('blog-ref-url')  || {}).value || '').trim(),
    point:    ((document.getElementById('blog-point')    || {}).value || '').trim(),
    topic:    topic,
    target:   ((document.getElementById('blog-target')   || {}).value || '').trim(),
    length:   (document.getElementById('blog-length')   || {}).value || '1500',
    keywords: ((document.getElementById('blog-keywords') || {}).value || '').trim(),
    core:     ((document.getElementById('blog-core')     || {}).value || '').trim()
  };
  var btn = document.getElementById('btn-draft');
  var btnOrig = btn.textContent;
  btn.disabled = true;
  btn.textContent = '초안 생성중...';
  try {
    // 참고 URL 중 네이버 블로그는 GAS 경유로 본문 발췌 수집 (실패 시 URL만 사용, 조용히 폴백)
    if (blogState.inputs.refUrl) {
      btn.textContent = '참고 URL 확인 중...';
      var refUrls = blogState.inputs.refUrl.split('\n').map(function(u){ return u.trim(); }).filter(function(u){ return u; });
      var refContents = {};
      await Promise.all(refUrls.map(async function(u) {
        var content = await gasFetchNaverBlogContent(u);
        if (content) refContents[u] = content.substring(0, 700);
      }));
      blogState.inputs.refContents = refContents;
      btn.textContent = '초안 생성중...';
    }
    // 구글 시트에서 유사 글 조회 → 유사 방지 지시 삽입
    var allPosts = await gasGetRecentPosts(50);
    var systemPrompt = applyAcademyVars(getBlogDraftSystem(blogState.inputs.type));
    if (allPosts && allPosts.length > 0) {
      var similarPosts = blogFindSimilar(allPosts, blogState.inputs, 5);
      if (similarPosts.length > 0) {
        var recentSummary = '\n\n[유사 글 목록 — 아래와 유사한 제목·구조·도입부·표현은 반드시 피할 것]\n';
        recentSummary += similarPosts.map(function(p, i) {
          return (i+1) + '. [' + p.type + '][구조: ' + (p.structure || '미기록') + '] ' + p.title + (p.keywords ? ' (키워드: ' + p.keywords + ')' : '');
        }).join('\n');
        var usedStructures = [];
        similarPosts.forEach(function(p) {
          if (p.structure && usedStructures.indexOf(p.structure) < 0) usedStructures.push(p.structure);
        });
        if (usedStructures.length > 0) {
          recentSummary += '\n\n이미 사용된 구조 유형: ' + usedStructures.join(', ') + '\n위 구조 유형은 이번 글에서 반드시 사용하지 말 것. structure 필드에 선택한 새 구조 유형명을 반드시 명시할 것.';
        }
        systemPrompt += recentSummary;
      }
    }
    var draft = await blogGenerateWithRepair(systemPrompt, blogBuildInputText(), 4096, 8192);
    blogState.draft = draft;
    blogRenderOutline(draft);
    blogGoStep(2);
  } catch(e) {
    blogShowAlert('1', e.message || '오류가 발생했습니다.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btnOrig; }
  }
}

function blogEsc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function blogEscNl(str) {
  return blogEsc(str).replace(/\n\n/g,'</p><p style="margin:0 0 10px">').replace(/\n/g,'<br>');
}

function blogRenderOutline(draft) {
  var ec = document.getElementById('blog-outline-edit-container');
  if (!ec) return;
  var eh = '';
  eh += '<div style="margin-bottom:14px;"><label class="blog-label" style="font-size:12px;color:var(--acc);">📌 포스팅 제목</label>';
  eh += '<input class="blog-input" id="bedit-title" type="text" value="' + blogEsc(draft.title) + '" style="font-size:15px;font-weight:800;color:#111827;" /></div>';
  eh += '<div style="margin-bottom:14px;"><label class="blog-label" style="font-size:12px;color:var(--acc);">도입부</label>';
  eh += '<textarea class="blog-input blog-textarea auto-resize" id="bedit-intro" oninput="autoResizeBlogTextarea(this)">' + blogEsc(draft.intro) + '</textarea></div>';
  (draft.sections || []).forEach(function(s, i) {
    eh += '<div style="border:1.5px solid var(--acc-border);border-radius:9px;padding:12px 14px;margin-bottom:10px;background:var(--acc-light);">';
    eh += '<div style="font-size:11px;font-weight:900;color:var(--acc);margin-bottom:8px;letter-spacing:.04em;">섹션 ' + (i+1) + '</div>';
    eh += '<label class="blog-label">소제목</label>';
    eh += '<input class="blog-input" id="bedit-s' + i + '-heading" type="text" value="' + blogEsc(s.heading) + '" style="font-weight:700;margin-bottom:8px;" />';
    eh += '<label class="blog-label">내용 요약</label>';
    eh += '<textarea class="blog-input blog-textarea auto-resize" id="bedit-s' + i + '-summary" oninput="autoResizeBlogTextarea(this)">' + blogEsc(s.summary) + '</textarea></div>';
  });
  eh += '<div style="margin-bottom:14px;"><label class="blog-label" style="font-size:12px;color:var(--acc);">마무리</label>';
  eh += '<textarea class="blog-input blog-textarea auto-resize" id="bedit-conclusion" oninput="autoResizeBlogTextarea(this)">' + blogEsc(draft.conclusion) + '</textarea></div>';
  eh += '<div style="margin-bottom:4px;"><label class="blog-label" style="font-size:12px;color:var(--acc);">태그</label>';
  eh += '<div style="display:flex;flex-wrap:wrap;gap:5px;">' + (draft.tags||[]).map(function(t) { return '<span style="background:var(--acc-light);color:var(--acc);border-radius:20px;padding:3px 9px;font-size:11px;font-weight:700;">#' + blogEsc(t) + '</span>'; }).join('') + '</div></div>';
  ec.innerHTML = eh;
}

function blogReadOutline() {
  var draft = blogState.draft || {};
  var origSections = draft.sections || [];
  var sections = [];
  var i = 0;
  while (document.getElementById('bedit-s' + i + '-heading')) {
    sections.push({
      heading: document.getElementById('bedit-s' + i + '-heading').value,
      summary: document.getElementById('bedit-s' + i + '-summary').value,
      role: (origSections[i] && origSections[i].role) || ''
    });
    i++;
  }
  return {
    title: document.getElementById('bedit-title') ? document.getElementById('bedit-title').value : draft.title,
    structure: draft.structure || '',
    intro: document.getElementById('bedit-intro') ? document.getElementById('bedit-intro').value : draft.intro,
    sections: sections.length ? sections : origSections,
    conclusion: document.getElementById('bedit-conclusion') ? document.getElementById('bedit-conclusion').value : draft.conclusion,
    ctaDirection: draft.ctaDirection || '',
    tags: draft.tags
  };
}

async function blogFinalize(triggerBtn) {
  blogHideAlert('2');
  var updatedDraft = blogReadOutline();
  var notes = document.getElementById('blog-notes') ? document.getElementById('blog-notes').value.trim() : '';
  var btn = triggerBtn || null;
  var btnOrig = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '최종 본문 작성중...'; }
  try {
    await useCreditConfirm('blog_finalize', '블로그 최종안 생성');
    var userMsg = '[최초 입력값]\n' + blogBuildInputText()
      + '\n\n[확정된 글 설계도]\n' + JSON.stringify(updatedDraft, null, 2)
      + '\n\n[추가 수정 요청]\n' + (notes || '없음')
      + '\n\n작성 지시:\n'
      + '- 각 section의 role을 따라 본문의 논리 흐름을 구성한다. summary를 단순히 늘리지 말고 role에 맞는 완성 글로 재작성한다.\n'
      + '- structure(구조 유형)를 유지한다.\n'
      + '- 결론은 ctaDirection 방향으로 마무리한다.\n'
      + '- 추가 수정 요청이 설계도와 충돌하지 않는 한 설계도를 유지한다.';
    var result = await blogGenerateWithRepair(applyAcademyVars(getBlogFinalSystem()), userMsg, 8192, 16000);
    var bannedFound = blogFilterBannedWords(result);
    blogStripBold(result);
    blogState.result = result;
    blogRenderPost(result);
    blogRenderImages(result.images || []);
    blogShowFilterNotice(bannedFound);
    blogGoStep(3);
    // 구글 시트에 저장 — 저장이 실제로 끝난 뒤에 오늘 작성 현황을 다시 조회해야
    // 화면 카운트가 이번 글을 포함해서 올라간다 (await 없이 바로 quotaStatus를
    // 조회하면 저장이 서버에 반영되기 전에 조회가 먼저 도착하는 경쟁 상태가 있었음)
    var bodyParts = [];
    if (result.intro) bodyParts.push(result.intro);
    (result.sections || []).forEach(function(s) {
      if (s.heading) bodyParts.push(s.heading);
      if (s.body) bodyParts.push(s.body);
    });
    if (result.conclusion) bodyParts.push(result.conclusion);
    await gasSavePost({
      type:         blogState.inputs.type                              || '',
      mood:         blogState.inputs.mood                             || '',
      title:        result.title                                      || '',
      topic:        blogState.inputs.topic                            || '',
      keywords:     blogState.inputs.keywords                         || '',
      tags:         (result.tags || []).join(', '),
      body:         bodyParts.join('\n\n'),
      structure:    updatedDraft.structure                            || '',
      targetLength: blogState.inputs.length                          || '',
      sectionGuide: blogState.inputs._sectionGuide                    || '',
      promptVersion: BLOG_PROMPT_VERSION
    });
  } catch(e) {
    if (!e.cancelled) blogShowAlert('2', e.message || '오류가 발생했습니다.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btnOrig; }
  }
}

// 금지어(선행/예비 등) 감지 및 대체 표현으로 치환 — 안전망 (프롬프트 지시가 새더라도 여기서 걸러짐)
function blogFilterBannedWords(result) {
  var found = [];
  function scan(str) {
    if (!str) return str;
    var out = str;
    BLOG_BANNED_WORDS.forEach(function(w) {
      if (out.indexOf(w) >= 0) {
        if (found.indexOf(w) < 0) found.push(w);
        var repl = BLOG_WORD_REPLACEMENTS[w] || '';
        out = out.split(w).join(repl);
      }
    });
    return out;
  }
  result.title = scan(result.title);
  result.intro = scan(result.intro);
  (result.sections || []).forEach(function(s) {
    s.heading = scan(s.heading);
    s.body = scan(s.body);
  });
  result.conclusion = scan(result.conclusion);
  result.tags = (result.tags || []).map(scan);
  return found;
}

// 마크다운 볼드(**) 제거 안전망 — 네이버 블로그는 서식 없는 텍스트라 별표가 그대로 노출됨
function blogStripBold(result) {
  function strip(str) {
    if (!str) return str;
    return str.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*\*/g, '');
  }
  result.title = strip(result.title);
  result.intro = strip(result.intro);
  (result.sections || []).forEach(function(s) {
    s.heading = strip(s.heading);
    s.body = strip(s.body);
  });
  result.conclusion = strip(result.conclusion);
  result.tags = (result.tags || []).map(strip);
}

function blogShowFilterNotice(words) {
  var el = document.getElementById('blog-filter-notice');
  if (!el) return;
  if (!words || !words.length) { el.style.display = 'none'; return; }
  el.textContent = '\'' + words.join('\', \'') + '\' 표현은 교육청 표시·광고 심의 대상이 될 수 있어 자동으로 대체 표현으로 필터링되었습니다.';
  el.style.display = 'block';
}

function blogRenderPost(result) {
  var c = document.getElementById('blog-post-container');
  if (!c) return;
  var html = '';
  html += '<div class="blog-copy-section"><div class="blog-copy-header"><span class="blog-copy-label">📌 제목</span><button class="blog-copy-btn" onclick="blogCopyText(this,\'bpost-title\')">복사</button></div><div class="blog-copy-content" id="bpost-title">' + blogEsc(result.title) + '</div></div>';
  html += '<div class="blog-copy-section"><div class="blog-copy-header"><span class="blog-copy-label">도입부</span><button class="blog-copy-btn" onclick="blogCopyText(this,\'bpost-intro\')">복사</button></div><div class="blog-copy-content" id="bpost-intro">' + blogEscNl(result.intro) + '</div></div>';
  (result.sections||[]).forEach(function(s, i) {
    html += '<div class="blog-copy-section"><div class="blog-copy-header"><span class="blog-copy-label">소제목 ' + (i+1) + '</span><button class="blog-copy-btn" onclick="blogCopyText(this,\'bsec-h-' + i + '\')">복사</button></div><div class="blog-copy-content" id="bsec-h-' + i + '">' + blogEsc(s.heading) + '</div></div>';
    html += '<div class="blog-copy-section"><div class="blog-copy-header"><span class="blog-copy-label">본문 ' + (i+1) + '</span><button class="blog-copy-btn" onclick="blogCopyText(this,\'bsec-b-' + i + '\')">복사</button></div><div class="blog-copy-content" id="bsec-b-' + i + '">' + blogEscNl(s.body) + '</div></div>';
  });
  html += '<div class="blog-copy-section"><div class="blog-copy-header"><span class="blog-copy-label">마무리</span><button class="blog-copy-btn" onclick="blogCopyText(this,\'bpost-conclusion\')">복사</button></div><div class="blog-copy-content" id="bpost-conclusion">' + blogEscNl(result.conclusion) + '</div></div>';
  html += '<div class="blog-copy-section"><div class="blog-copy-header"><span class="blog-copy-label">태그</span><button class="blog-copy-btn" onclick="blogCopyText(this,\'bpost-tags\')">복사</button></div><div class="blog-copy-content" id="bpost-tags">' + (result.tags||[]).map(function(t) { return '#' + blogEsc(t); }).join(' ') + '</div></div>';
  c.innerHTML = html;
}

function blogRenderImages(images) {
  var c = document.getElementById('blog-img-grid');
  if (!c) return;
  if (!images || !images.length) { c.innerHTML = '<p style="color:#9aa1ad;font-size:13px;">생성된 이미지 정보가 없습니다.</p>'; return; }
  var cards = images.map(function(img, i) {
    var secIdx = (typeof img.section_index === 'number') ? img.section_index : i;
    var sections = (blogState.result && blogState.result.sections) || [];
    var secHeading = sections[secIdx] ? sections[secIdx].heading : '';
    var placement = img.placement || (secHeading ? secHeading + ' 섹션 본문' : '본문 이미지');
    var query = img.search_query || '';
    return '<div class="bimg-card" id="bimg-card-' + i + '">'
      + '<div class="bimg-info">'
        + '<span class="bimg-badge body-img">본문 삽입</span>'
        + '<div class="bimg-placement">' + blogEsc(placement) + '</div>'
        + '<div class="bimg-description" id="bimg-desc-' + i + '">' + blogEsc(img.description || '') + '</div>'
        + '<div class="bimg-query" id="bimg-query-' + i + '">💡 추천 검색어: <strong>' + blogEsc(query) + '</strong></div>'
      + '</div>'
      + '</div>';
  }).join('');
  c.innerHTML = cards + '<div class="bimg-license-note">⚠️ 이미지는 반드시 라이선스가 확보된 이미지만 사용해야 합니다. 위 검색어는 참고용 추천일 뿐이며, 실제 사용 전 이미지의 상업적 사용 가능 여부와 출처 표시 필요 여부를 직접 확인하세요.</div>';
}

// 유사 글 찾기 — 주제·키워드·태그 토큰 매칭으로 점수 계산
function blogFindSimilar(posts, inputs, topN) {
  function tokenize(str) {
    return String(str || '').toLowerCase()
      .split(/[\s,·\/#]+/).filter(function(t) { return t.length > 1; });
  }
  var refTokens = tokenize(inputs.topic)
    .concat(tokenize(inputs.keywords))
    .concat(tokenize(inputs.type));
  if (!refTokens.length) return posts.slice(0, topN);

  var scored = posts.map(function(p) {
    var pTokens = tokenize(p.title)
      .concat(tokenize(p.keywords))
      .concat(tokenize(p.tags))
      .concat(tokenize(p.topic))
      .concat(tokenize(p.type));
    var score = refTokens.reduce(function(acc, t) {
      return acc + (pTokens.indexOf(t) >= 0 ? 1 : 0);
    }, 0);
    // 같은 글 유형이면 가산점
    if (p.type === inputs.type) score += 2;
    return { post: p, score: score };
  });

  return scored
    .filter(function(s) { return s.score > 0; })
    .sort(function(a, b) { return b.score - a.score; })
    .slice(0, topN)
    .map(function(s) { return s.post; });
}

function toggleBlogOptions() {
  var body = document.getElementById('blog-options-body');
  var arrow = document.getElementById('blog-option-arrow');
  if (!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'flex';
  if (arrow) arrow.textContent = open ? '▶' : '▼';
}

function blogCopyAll(btn) {
  if (!blogState.result) return;
  var r = blogState.result;
  var DIV = '─'.repeat(30);
  var parts = [];
  parts.push(r.title);
  parts.push('');
  parts.push(DIV);
  parts.push('');
  parts.push(r.intro || '');
  (r.sections||[]).forEach(function(s) {
    parts.push('');
    parts.push('■ ' + s.heading);
    parts.push('');
    parts.push(s.body || '');
  });
  parts.push('');
  parts.push(DIV);
  parts.push('');
  parts.push(r.conclusion || '');
  if (r.contact) { parts.push(''); parts.push(r.contact); }
  parts.push('');
  parts.push((r.tags||[]).map(function(t){ return '#'+t; }).join(' '));
  navigator.clipboard.writeText(parts.join('\n')).then(function() {
    if (btn) { var orig = btn.textContent; btn.textContent = '복사됨'; setTimeout(function(){ btn.textContent = orig; }, 2000); }
    var a3 = document.getElementById('blog-alert3');
    if (a3) { a3.textContent = '전체 본문이 복사되었습니다.'; a3.className = 'blog-alert ok show'; setTimeout(function(){ a3.classList.remove('show'); }, 3000); }
  });
}

function blogCopyText(btn, id) {
  var el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.innerText || el.textContent).then(function() { var orig = btn.textContent; btn.textContent = '복사됨'; setTimeout(function() { btn.textContent = orig; }, 1500); });
}

function blogShowAlert(num, msg) {
  var el = document.getElementById('blog-alert' + num);
  if (el) { el.textContent = msg; el.className = 'blog-alert err show'; }
}
function blogHideAlert(num) {
  var el = document.getElementById('blog-alert' + num);
  if (el) { el.className = 'blog-alert err'; el.textContent = ''; }
}

// ── 작성 히스토리 ────────────────────────────────────────────────
async function blogHistoryInit() {
  var alertEl = document.getElementById('bhist-alert');
  var listEl = document.getElementById('bhist-list');
  if (alertEl) { alertEl.className = 'blog-alert err'; alertEl.textContent = ''; }
  blogState.historySelected = -1;
  blogRenderHistoryDetail(null);
  if (listEl) listEl.innerHTML = '<p style="color:#9aa1ad;font-size:13px;">불러오는 중...</p>';
  try {
    var posts = await gasGetMyPosts(100);
    blogState.historyPosts = posts || [];
    if (!blogState.historyPosts.length && alertEl) {
      alertEl.textContent = '저장된 글이 없거나 구글 시트 연동이 설정되지 않았습니다. 설정 페이지에서 확인해주세요.';
      alertEl.className = 'blog-alert err show';
    }
    blogRenderHistoryList();
  } catch(e) {
    blogState.historyPosts = [];
    if (alertEl) { alertEl.textContent = e.message || '히스토리를 불러오지 못했습니다.'; alertEl.className = 'blog-alert err show'; }
    blogRenderHistoryList();
  }
}

function blogRenderHistoryList() {
  var listEl = document.getElementById('bhist-list');
  if (!listEl) return;
  var posts = blogState.historyPosts || [];
  var typeFilter = (document.getElementById('bhist-type-filter') || {}).value || '';
  var search = ((document.getElementById('bhist-search') || {}).value || '').trim().toLowerCase();

  var filtered = posts.filter(function(p) {
    if (typeFilter && p.type !== typeFilter) return false;
    if (search) {
      var haystack = [p.title, p.keywords, p.tags, p.topic].join(' ').toLowerCase();
      if (haystack.indexOf(search) < 0) return false;
    }
    return true;
  });

  if (!filtered.length) {
    listEl.innerHTML = '<p style="color:#9aa1ad;font-size:13px;">표시할 글이 없습니다.</p>';
    return;
  }

  listEl.innerHTML = filtered.map(function(p, i) {
    var origIdx = posts.indexOf(p);
    var isActive = origIdx === blogState.historySelected;
    var tagsPreview = p.tags ? blogEsc(p.tags) : '';
    return '<div class="blog-card' + (isActive ? ' is-thumb' : '') + '" style="cursor:pointer;padding:10px 12px;" onclick="blogShowHistoryDetail(' + origIdx + ')">'
      + '<div style="display:flex;justify-content:space-between;gap:8px;align-items:start;">'
        + '<div style="font-size:13px;font-weight:700;color:#172033;line-height:1.4;">' + blogEsc(p.title || '(제목 없음)') + '</div>'
        + '<div style="font-size:11px;color:#9aa1ad;white-space:nowrap;flex-shrink:0;">' + blogEsc(p.date) + '</div>'
      + '</div>'
      + (p.type ? '<div style="margin-top:4px;"><span class="bimg-badge body-img" style="font-size:10px;">' + blogEsc(p.type) + '</span></div>' : '')
      + (tagsPreview ? '<div style="margin-top:6px;font-size:11px;color:#657181;">' + tagsPreview + '</div>' : '')
      + '</div>';
  }).join('');
}

function blogShowHistoryDetail(idx) {
  blogState.historySelected = idx;
  blogRenderHistoryList();
  var p = (blogState.historyPosts || [])[idx];
  blogRenderHistoryDetail(p);
}

function blogRenderHistoryDetail(p) {
  var c = document.getElementById('bhist-detail');
  if (!c) return;
  if (!p) {
    c.innerHTML = '<div class="blog-card"><div style="font-size:13px;font-weight:900;color:var(--txt);margin-bottom:8px;">작성 히스토리</div><div style="font-size:12px;color:var(--mut);line-height:1.7;">왼쪽 목록에서 글 제목을 클릭하면<br>여기에 전체 본문이 표시됩니다.</div></div>';
    return;
  }
  var html = '';
  html += '<div class="blog-copy-section"><div class="blog-copy-header"><span class="blog-copy-label">제목</span><button class="blog-copy-btn" onclick="blogCopyText(this,\'bhist-d-title\')">복사</button></div><div class="blog-copy-content" id="bhist-d-title">' + blogEsc(p.title) + '</div></div>';
  html += '<div class="blog-copy-section"><div class="blog-copy-header"><span class="blog-copy-label">본문</span><button class="blog-copy-btn" onclick="blogCopyText(this,\'bhist-d-body\')">복사</button></div><div class="blog-copy-content" id="bhist-d-body">' + blogEscNl(p.body) + '</div></div>';
  if (p.tags) {
    html += '<div class="blog-copy-section"><div class="blog-copy-header"><span class="blog-copy-label">태그</span><button class="blog-copy-btn" onclick="blogCopyText(this,\'bhist-d-tags\')">복사</button></div><div class="blog-copy-content" id="bhist-d-tags">' + blogEsc(p.tags) + '</div></div>';
  }
  html += '<div style="font-size:11px;color:#9aa1ad;">작성일: ' + blogEsc(p.date) + (p.structure ? ' · 구조: ' + blogEsc(p.structure) : '') + '</div>';
  c.innerHTML = html;
}
