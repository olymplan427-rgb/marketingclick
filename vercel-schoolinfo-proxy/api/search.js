// api/search.js
// 학교알리미 OpenAPI(schoolinfo.go.kr) 프록시.
//
// 왜 필요한가: schoolinfo.go.kr가 Cloudflare 대역 트래픽을 막아서(522), 같은 요청을
// blog-tracker Cloudflare Worker에서 직접 보내면 실패한다. Vercel(비-Cloudflare 네트워크)에서는
// 정상 응답하는 것을 확인해서, 이 함수가 그 사이를 중계한다.
//
// 필요한 환경변수(Vercel 프로젝트 설정 > Environment Variables):
//   SCHOOLINFO_API_KEY - schoolinfo.go.kr에서 발급받은 인증키
//   PROXY_TOKEN         - blog-tracker Worker만 호출하도록 막는 공유 토큰(무작위 문자열)

const SCHOOL_KND_MAX_GRADE = { '02': 6, '03': 3, '04': 3 };

function schoolinfoUrl(apiType, sidoCode, sggCode, schulKndCode, pbanYr) {
  return 'https://www.schoolinfo.go.kr/openApi.do?apiKey=' + encodeURIComponent(process.env.SCHOOLINFO_API_KEY) +
    '&apiType=' + encodeURIComponent(apiType) +
    '&pbanYr=' + pbanYr +
    '&sidoCode=' + encodeURIComponent(sidoCode) +
    '&sggCode=' + encodeURIComponent(sggCode) +
    '&schulKndCode=' + encodeURIComponent(schulKndCode);
}

async function fetchYear(apiType, sidoCode, sggCode, schulKndCode, pbanYr) {
  const res = await fetch(schoolinfoUrl(apiType, sidoCode, sggCode, schulKndCode, pbanYr));
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return { resultCode: 'error', resultMsg: '학교알리미 API 응답 오류(HTTP ' + res.status + '): ' + text.slice(0, 100) };
  }
}

// pbanYr(공시연도)는 필수 파라미터인데 매년 상반기 공시 전에는 당해 연도 데이터가 없을 수 있어
// 실패하면 전년도로 한 번 더 시도한다.
async function fetchSchoolinfo(apiType, sidoCode, sggCode, schulKndCode) {
  const thisYear = new Date().getUTCFullYear();
  let json = await fetchYear(apiType, sidoCode, sggCode, schulKndCode, thisYear);
  if (json.resultCode !== 'success') {
    json = await fetchYear(apiType, sidoCode, sggCode, schulKndCode, thisYear - 1);
  }
  if (json.resultCode !== 'success') throw new Error(json.resultMsg || '학교알리미 API 오류');
  return json.list || [];
}

export default async function handler(req, res) {
  const { token, sidoCode, sggCode, schulKndCode } = req.query;

  if (!process.env.PROXY_TOKEN || token !== process.env.PROXY_TOKEN) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }
  if (!sidoCode || !sggCode || !schulKndCode) {
    res.status(400).json({ ok: false, error: '시/도, 시군구, 학교급을 모두 선택하세요.' });
    return;
  }

  try {
    const [basicList, gradeList] = await Promise.all([
      fetchSchoolinfo('0', sidoCode, sggCode, schulKndCode),
      fetchSchoolinfo('09', sidoCode, sggCode, schulKndCode)
    ]);
    const gradeByCode = {};
    gradeList.forEach((g) => { gradeByCode[g.SCHUL_CODE] = g; });
    const maxGrade = SCHOOL_KND_MAX_GRADE[schulKndCode] || 3;

    const schools = basicList.map((s) => {
      const g = gradeByCode[s.SCHUL_CODE] || {};
      const grades = {};
      for (let i = 1; i <= maxGrade; i++) {
        const n = parseInt(g['COL_S' + i], 10);
        grades[i] = isNaN(n) ? 0 : n;
      }
      return { code: s.SCHUL_CODE, name: s.SCHUL_NM, kindCode: s.SCHUL_KND_SC_CODE, address: s.SCHUL_RDNMA || s.ADRES_BRKDN || '', grades };
    });
    res.status(200).json({ ok: true, schools });
  } catch (e) {
    res.status(200).json({ ok: false, error: e.message });
  }
}
