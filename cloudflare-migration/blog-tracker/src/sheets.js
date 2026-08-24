// Google Sheets API v4 클라이언트 (서비스 계정 JWT 인증) — GAS의 SpreadsheetApp 대체.
// env.GOOGLE_SERVICE_ACCOUNT_EMAIL / env.GOOGLE_PRIVATE_KEY / env.SHEET_ID 필요 (wrangler secret).

function base64url(input) {
  let bin;
  if (typeof input === 'string') {
    bin = unescape(encodeURIComponent(input));
  } else {
    const bytes = new Uint8Array(input);
    bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// PEM 헤더/푸터는 먼저 통째로 제거해야 함 — "BEGIN"/"PRIVATE"/"KEY" 같은 글자 자체가
// base64 알파벳에 포함되어 있어서, 하이픈/공백만 걸러내는 문자 필터만으로는 헤더 텍스트가
// 그대로 남아 실제 키 내용 앞뒤에 잘못 붙는다. 헤더 제거 후에만 나머지 잡문자(리터럴 \n,
// 따옴표, 쉼표 등 수동 복사 시 섞이기 쉬운 것들)를 base64 알파벳 기준으로 걸러낸다.
function pemToDer(pem) {
  const withoutHeaders = pem.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '');
  const base64 = withoutHeaders.replace(/[^A-Za-z0-9+/=]/g, '');
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

let cachedToken = null; // { token, exp } — Worker 인스턴스가 살아있는 동안 재사용

async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp > now + 60) return cachedToken.token;

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  const signingInput = base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(claim));

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(env.GOOGLE_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const jwt = signingInput + '.' + base64url(sig);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + jwt
  });
  const json = await res.json();
  if (!res.ok) throw new Error('Google OAuth 실패: ' + (json.error_description || json.error || res.status));

  cachedToken = { token: json.access_token, exp: now + (json.expires_in || 3600) };
  return cachedToken.token;
}

async function sheetsFetch(env, path, options) {
  const token = await getAccessToken(env);
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + env.SHEET_ID + path;
  const res = await fetch(url, {
    ...options,
    headers: { ...(options && options.headers), Authorization: 'Bearer ' + token }
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json.error && json.error.message) || ('Sheets API 오류 ' + res.status));
  return json;
}

export async function getValues(env, range) {
  const json = await sheetsFetch(env, '/values/' + encodeURIComponent(range));
  return json.values || [];
}

// valueInputOption=RAW — GAS(appendRow)가 겪던 "문자열을 자동으로 날짜로 변환" 문제를
// 원천적으로 피하기 위해 항상 원문 그대로 저장한다.
export async function appendRow(env, sheetName, row) {
  const range = encodeURIComponent(sheetName + '!A1');
  await sheetsFetch(env, '/values/' + range + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [row] })
  });
}

// appendRow와 동일하게 valueInputOption=RAW — 이미 존재하는 특정 행을 그대로 덮어쓴다(upsert의 update 절반).
export async function updateRow(env, sheetName, rowNumber, row) {
  const lastCol = String.fromCharCode(65 + row.length - 1); // A, B, C, ...
  const range = encodeURIComponent(sheetName + '!A' + rowNumber + ':' + lastCol + rowNumber);
  await sheetsFetch(env, '/values/' + range + '?valueInputOption=RAW', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [row] })
  });
}

export async function getSheetRowCount(env, sheetName) {
  const json = await sheetsFetch(env, '?fields=' + encodeURIComponent('sheets.properties(title,gridProperties.rowCount)'));
  const sheet = (json.sheets || []).find((s) => s.properties.title === sheetName);
  return sheet ? sheet.properties.gridProperties.rowCount : 0;
}
