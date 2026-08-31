// AI 없이 코드로 즉시 검사할 수 있는 항목들. 여기서 걸리는 문제는 프롬프트 문구를 더 강하게/
// 명확하게 쓰거나 규칙을 추가하면 되는, 판단이 필요 없는 기계적 위반이다.

const BANNED_WORDS = ['선행학습', '선행', '예비']; // js/blog.js BLOG_BANNED_WORDS와 동일하게 유지
const AI_CLICHES = ['결론적으로', '혁신적인', '시대가 도래했다', '주목할 만하다', '의 가능성을 열어준다', '새로운 패러다임'];
const OVERUSED_PHRASES = ['주목해 주세요', '꼭 확인해 보세요', '적극 추천합니다', '지금 바로', '고민이신 학부모님이라면'];

function fullNoSpaceLength(result) {
  const parts = [result.title || ''];
  parts.push(result.intro || '');
  (result.sections || []).forEach((s) => {
    parts.push(s.heading || '');
    parts.push(s.body || '');
  });
  parts.push(result.conclusion || '');
  parts.push((result.tags || []).join(' '));
  const full = parts.join('\n');
  return full.replace(/\s/g, '').length;
}

function fullBodyText(result) {
  const parts = [result.intro || ''];
  (result.sections || []).forEach((s) => parts.push(s.heading || '', s.body || ''));
  parts.push(result.conclusion || '');
  return parts.join('\n\n');
}

// 문장 끝(종결어미) 5글자만 뽑아서 반복 횟수를 센다 — 완벽한 형태소 분석은 아니지만
// "~해요"/"~습니다" 남발처럼 눈에 띄는 반복은 이 정도로도 잡힌다.
function endingRepetition(text) {
  const sentences = text.split(/(?<=[.!?요다])\s+/).map((s) => s.trim()).filter((s) => s.length > 3);
  const counts = {};
  sentences.forEach((s) => {
    const tail = s.slice(-3).replace(/[.!?"')\]]/g, '');
    if (!tail) return;
    counts[tail] = (counts[tail] || 0) + 1;
  });
  let maxTail = null, maxCount = 0;
  Object.entries(counts).forEach(([tail, c]) => { if (c > maxCount) { maxCount = c; maxTail = tail; } });
  return { totalSentences: sentences.length, maxTail, maxCount };
}

function countOccurrences(text, word) {
  return (text.match(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
}

function runChecks(result, topic) {
  const items = [];
  const add = (name, status, detail) => items.push({ name, status, detail });

  const targetLen = parseInt(topic.length, 10) || 1500;
  const actualLen = fullNoSpaceLength(result);
  const ratio = actualLen / targetLen;
  if (ratio >= 0.9 && ratio <= 1.1) {
    add('목표 분량 (90~110%)', 'pass', `${actualLen}자 / 목표 ${targetLen}자 (${Math.round(ratio * 100)}%)`);
  } else {
    add('목표 분량 (90~110%)', 'fail', `${actualLen}자 / 목표 ${targetLen}자 (${Math.round(ratio * 100)}%) — 범위 밖`);
  }

  const title = result.title || '';
  const titleLen = title.length;
  if (titleLen >= 20 && titleLen <= 50) {
    add('제목 길이 (20~50자)', 'pass', `${titleLen}자`);
  } else {
    add('제목 길이 (20~50자)', 'fail', `${titleLen}자 — "${title}"`);
  }

  const academyName = (topic.academyName || '테스트수학학원');
  const nameInTitleCount = countOccurrences(title, academyName.replace(/학원$/, ''));
  if (nameInTitleCount <= 1) {
    add('제목 내 학원명 남용', 'pass', `${nameInTitleCount}회 언급`);
  } else {
    add('제목 내 학원명 남용', 'warn', `${nameInTitleCount}회 언급 — 과도할 수 있음`);
  }

  const body = fullBodyText(result);
  const fullTextForBanned = title + '\n' + body + '\n' + (result.tags || []).join(' ');
  const foundBanned = BANNED_WORDS.filter((w) => fullTextForBanned.indexOf(w) >= 0);
  if (foundBanned.length === 0) {
    add('금지어(선행/예비)', 'pass', '없음');
  } else {
    add('금지어(선행/예비)', 'fail', foundBanned.join(', ') + ' 사용됨');
  }

  const htmlEntities = fullTextForBanned.match(/&(quot|amp|lt|gt|#39|nbsp);/g) || [];
  if (htmlEntities.length === 0) {
    add('HTML 엔티티 노출', 'pass', '없음');
  } else {
    add('HTML 엔티티 노출', 'fail', htmlEntities.slice(0, 5).join(', ') + (htmlEntities.length > 5 ? ' 외' : ''));
  }

  const boldMarks = fullTextForBanned.match(/\*\*/g) || [];
  if (boldMarks.length === 0) {
    add('마크다운(**) 노출', 'pass', '없음');
  } else {
    add('마크다운(**) 노출', 'fail', `${boldMarks.length}개 발견`);
  }

  const foundCliches = AI_CLICHES.filter((w) => body.indexOf(w) >= 0);
  if (foundCliches.length === 0) {
    add('AI 상투구', 'pass', '없음');
  } else {
    add('AI 상투구', 'fail', foundCliches.join(', '));
  }

  const foundOverused = OVERUSED_PHRASES.filter((w) => countOccurrences(body, w) > 1);
  if (foundOverused.length === 0) {
    add('반복 표현(2회 이상)', 'pass', '없음');
  } else {
    add('반복 표현(2회 이상)', 'warn', foundOverused.join(', '));
  }

  const ending = endingRepetition(body);
  if (ending.totalSentences === 0 || ending.maxCount <= Math.ceil(ending.totalSentences * 0.35)) {
    add('종결어미 반복', 'pass', ending.maxTail ? `최다 "${ending.maxTail}" ${ending.maxCount}/${ending.totalSentences}회` : '문장 없음');
  } else {
    add('종결어미 반복', 'warn', `"${ending.maxTail}" ${ending.maxCount}/${ending.totalSentences}회로 과다`);
  }

  const sectionCount = (result.sections || []).length;
  add('섹션 개수', sectionCount >= 1 ? 'pass' : 'fail', `${sectionCount}개`);

  const longestParagraph = body.split(/\n\n+/).reduce((max, p) => Math.max(max, p.replace(/\s/g, '').length), 0);
  if (longestParagraph <= 220) {
    add('문단 길이(모바일 가독성)', 'pass', `최장 문단 ${longestParagraph}자`);
  } else {
    add('문단 길이(모바일 가독성)', 'warn', `최장 문단 ${longestParagraph}자 — 너무 김`);
  }

  const hasContactBlock = /전화|연락처|📞|지도/.test(result.conclusion || '') || /전화|연락처|📞|지도/.test(body);
  add('연락처/CTA 블록 포함', hasContactBlock ? 'pass' : 'fail', hasContactBlock ? '포함' : '누락');

  const thumbnail = (result.images || []).find((i) => i.id === 'thumbnail');
  add('썸네일 프롬프트 존재', thumbnail ? 'pass' : 'fail', thumbnail ? '있음' : '없음');
  const bodyImages = (result.images || []).filter((i) => i.id !== 'thumbnail');
  add('본문 이미지 미생성 확인', bodyImages.length === 0 ? 'pass' : 'warn', `${bodyImages.length}개 (정책상 0개여야 함)`);

  const summary = items.reduce((acc, it) => { acc[it.status] = (acc[it.status] || 0) + 1; return acc; }, {});
  return { items, summary, actualLen, targetLen };
}

module.exports = { runChecks, fullNoSpaceLength, fullBodyText };
