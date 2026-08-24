// js/schoolRegionCodes.js
// 학교알리미 OpenAPI(schoolinfo.go.kr) 요청인자 sidoCode/sggCode 매핑표.
// 코드 값은 표준 법정동코드 앞자리와 동일(안정적, 개편 드묾).
// 시군구코드(SGG_CODES_BY_SIDO)는 서울특별시만 우선 채워뒀고, 나머지 시/도는
// "시도시군구코드.xlsx"(학교알리미 API 이용안내에서 다운로드) 확보 후 채울 것.

const SIDO_CODES = [
  { code: '11', name: '서울특별시' },
  { code: '26', name: '부산광역시' },
  { code: '27', name: '대구광역시' },
  { code: '28', name: '인천광역시' },
  { code: '29', name: '광주광역시' },
  { code: '30', name: '대전광역시' },
  { code: '31', name: '울산광역시' },
  { code: '36', name: '세종특별자치시' },
  { code: '41', name: '경기도' },
  { code: '42', name: '강원도' },
  { code: '43', name: '충청북도' },
  { code: '44', name: '충청남도' },
  { code: '45', name: '전라북도' },
  { code: '46', name: '전라남도' },
  { code: '47', name: '경상북도' },
  { code: '48', name: '경상남도' },
  { code: '50', name: '제주특별자치도' }
];

// TODO: 서울 외 시/도는 시도시군구코드.xlsx 확보 후 여기에 추가
const SGG_CODES_BY_SIDO = {
  '11': [
    { code: '11110', name: '종로구' },
    { code: '11140', name: '중구' },
    { code: '11170', name: '용산구' },
    { code: '11200', name: '성동구' },
    { code: '11215', name: '광진구' },
    { code: '11230', name: '동대문구' },
    { code: '11260', name: '중랑구' },
    { code: '11290', name: '성북구' },
    { code: '11305', name: '강북구' },
    { code: '11320', name: '도봉구' },
    { code: '11350', name: '노원구' },
    { code: '11380', name: '은평구' },
    { code: '11410', name: '서대문구' },
    { code: '11440', name: '마포구' },
    { code: '11470', name: '양천구' },
    { code: '11500', name: '강서구' },
    { code: '11530', name: '구로구' },
    { code: '11545', name: '금천구' },
    { code: '11560', name: '영등포구' },
    { code: '11590', name: '동작구' },
    { code: '11620', name: '관악구' },
    { code: '11650', name: '서초구' },
    { code: '11680', name: '강남구' },
    { code: '11710', name: '송파구' },
    { code: '11740', name: '강동구' }
  ]
};

// 학교급 select에 쓰는 값 — 학교알리미 API 명세와 동일한 코드.
const SCHUL_KND_CODES = [
  { code: '02', name: '초등학교' },
  { code: '03', name: '중학교' },
  { code: '04', name: '고등학교' }
];
