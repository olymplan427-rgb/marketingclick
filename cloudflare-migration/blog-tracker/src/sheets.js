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

function pemToDer(pem) {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\\n/g, '\n')
    .replace(/\s+/g, '');
  const bin = atob(clean);
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

export async function getSheetRowCount(env, sheetName) {
  const json = await sheetsFetch(env, '?fields=' + encodeURIComponent('sheets.properties(title,gridProperties.rowCount)'));
  const sheet = (json.sheets || []).find((s) => s.properties.title === sheetName);
  return sheet ? sheet.properties.gridProperties.rowCount : 0;
}
