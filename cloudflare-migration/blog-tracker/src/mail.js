import { connect } from 'cloudflare:sockets';

/**
 * Gmail SMTP로 메일을 직접 보낸다 (Cloudflare TCP Sockets 이용, 별도 이메일 서비스 불필요).
 * Instagram_uploader/worker/src/mail.js 포팅 (2026-09-02, 회원가입 승인 알림용).
 * env.GMAIL_USER / env.GMAIL_APP_PASSWORD 필요 (앱 비밀번호, 일반 로그인 비밀번호 아님).
 */
export async function sendMail(env, { to, subject, html }) {
  const socket = connect({ hostname: 'smtp.gmail.com', port: 587 }, { secureTransport: 'starttls' });
  await socket.opened;

  let reader = socket.readable.getReader();
  let writer = socket.writable.getWriter();

  await readResponse(reader); // 220 그리팅
  await command(writer, reader, 'EHLO workers.dev', 250);
  await command(writer, reader, 'STARTTLS', 220);

  // TLS로 업그레이드 — 이 시점부터는 새로 반환된 socket을 써야 한다.
  reader.releaseLock();
  writer.releaseLock();
  const secureSocket = socket.startTls();
  reader = secureSocket.readable.getReader();
  writer = secureSocket.writable.getWriter();

  await command(writer, reader, 'EHLO workers.dev', 250);
  await command(writer, reader, 'AUTH LOGIN', 334);
  await command(writer, reader, utf8ToBase64(env.GMAIL_USER), 334);
  await command(writer, reader, utf8ToBase64(env.GMAIL_APP_PASSWORD), 235);
  await command(writer, reader, `MAIL FROM:<${env.GMAIL_USER}>`, 250);
  await command(writer, reader, `RCPT TO:<${to}>`, 250);
  await command(writer, reader, 'DATA', 354);

  const encodedSubject = `=?UTF-8?B?${utf8ToBase64(subject)}?=`;
  const message =
    `From: ${env.GMAIL_USER}\r\n` +
    `To: ${to}\r\n` +
    `Subject: ${encodedSubject}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: text/html; charset=UTF-8\r\n` +
    `Content-Transfer-Encoding: base64\r\n` +
    `\r\n` +
    utf8ToBase64(html).replace(/(.{76})/g, '$1\r\n') +
    `\r\n.\r\n`;

  await command(writer, reader, message, 250);
  await writer.write(new TextEncoder().encode('QUIT\r\n'));

  reader.releaseLock();
  writer.releaseLock();
  await secureSocket.close();
}

async function command(writer, reader, line, expectedCode) {
  await writer.write(new TextEncoder().encode(line + '\r\n'));
  const res = await readResponse(reader);
  if (Number(res.code) !== expectedCode) {
    throw new Error(`SMTP 오류 (기대: ${expectedCode}, 응답: ${res.code}): ${res.text}`);
  }
  return res;
}

async function readResponse(reader) {
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += new TextDecoder().decode(value);
    const lines = buffer.split('\r\n').filter(Boolean);
    const last = lines[lines.length - 1];
    // SMTP 다중 라인 응답은 "250-..." 형태로 이어지다가 "250 ..."(공백)으로 끝난다.
    if (last && /^\d{3} /.test(last)) {
      return { code: last.slice(0, 3), text: buffer };
    }
  }
  return { code: '000', text: buffer };
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
