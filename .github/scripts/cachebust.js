// 배포 시 index.html의 로컬 자산 참조에 커밋 해시를 쿼리스트링으로 붙여서
// 브라우저가 새 배포 후에도 예전 CSS/JS를 캐시에서 계속 쓰는 문제를 막는다.
// 사용법: node cachebust.js <site-dir>  (site-dir 안에서 git rev-parse로 버전을 구함)
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dir = process.argv[2];
if (!dir) { console.error('usage: node cachebust.js <site-dir>'); process.exit(1); }

const version = execSync('git rev-parse --short HEAD', { cwd: dir }).toString().trim();
const indexPath = path.join(dir, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const localAssets = [
  'css/main.css',
  'js/flags.js',
  'config.js',
  'js/image.js',
  'js/monitor.js',
  'js/blog.js',
  'js/mapsearch.js',
  'js/news.js',
  'js/feedback.js',
  'js/common.js',
  'pages/image.html',
  'pages/blog.html',
  'pages/monitor.html',
  'pages/mapsearch.html',
  'pages/feedback.html',
  'pages/settings.html'
];

localAssets.forEach(function(asset) {
  html = html.split('"' + asset + '"').join('"' + asset + '?v=' + version + '"');
  html = html.split("'" + asset + "'").join("'" + asset + '?v=' + version + "'");
});

fs.writeFileSync(indexPath, html);
console.log('cachebust: ' + indexPath + ' -> v=' + version);
