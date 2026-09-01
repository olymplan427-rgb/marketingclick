var FONTS = [
  {f:'Noto Sans KR', l:'Noto Sans KR', g:'KR_BASIC', w:700, weights:[400,700,900]},
  {f:'Noto Serif KR', l:'Noto Serif KR', g:'KR_BASIC', w:700, weights:[400,700,900]},
  {f:'Nanum Gothic', l:'나눔고딕', g:'KR_BASIC', w:800, weights:[400,700,800]},
  {f:'Nanum Myeongjo', l:'나눔명조', g:'KR_BASIC', w:800, weights:[400,700,800]},
  {f:'Nanum Gothic Coding', l:'나눔고딕코딩', g:'KR_BASIC', w:700, weights:[400,700]},
  {f:'Gothic A1', l:'고딕 A1', g:'KR_BASIC', w:700, weights:[400,700,900]},
  {f:'IBM Plex Sans KR', l:'IBM Plex Sans KR', g:'KR_BASIC', w:700, weights:[400,700]},
  {f:'Hahmlet', l:'함렛', g:'KR_BASIC', w:700, weights:[400,700,900]},
  {f:'Gowun Dodum', l:'고운돋움', g:'KR_BASIC', w:400, weights:[400]},
  {f:'Gowun Batang', l:'고운바탕', g:'KR_BASIC', w:700, weights:[400,700]},

  {f:'Black Han Sans', l:'검은고딕', g:'KR_TITLE', w:400, weights:[400]},
  {f:'Bagel Fat One', l:'베이글 팻 원', g:'KR_TITLE', w:400, weights:[400]},
  {f:'Do Hyeon', l:'도현', g:'KR_TITLE', w:400, weights:[400]},
  {f:'Jua', l:'주아', g:'KR_TITLE', w:400, weights:[400]},
  {f:'Gugi', l:'구기', g:'KR_TITLE', w:400, weights:[400]},
  {f:'Dongle', l:'동글', g:'KR_TITLE', w:700, weights:[300,400,700]},
  {f:'Sunflower', l:'해바라기', g:'KR_TITLE', w:700, weights:[300,500,700]},
  {f:'Stylish', l:'스타일리쉬', g:'KR_TITLE', w:400, weights:[400]},
  {f:'Orbit', l:'오빗', g:'KR_TITLE', w:400, weights:[400]},
  {f:'Black And White Picture', l:'흑백사진', g:'KR_TITLE', w:400, weights:[400]},
  {f:'Moirai One', l:'모이라이 원', g:'KR_TITLE', w:400, weights:[400]},

  {f:'Grandiflora One', l:'그랜디플로라 원', g:'KR_SERIF', w:400, weights:[400]},
  {f:'Diphylleia', l:'디필리아', g:'KR_SERIF', w:400, weights:[400]},
  {f:'Song Myung', l:'송명', g:'KR_SERIF', w:400, weights:[400]},

  {f:'Gaegu', l:'개구', g:'KR_HAND', w:700, weights:[400,700]},
  {f:'Gamja Flower', l:'감자꽃', g:'KR_HAND', w:400, weights:[400]},
  {f:'Single Day', l:'싱글데이', g:'KR_HAND', w:400, weights:[400]},
  {f:'Poor Story', l:'푸어스토리', g:'KR_HAND', w:400, weights:[400]},
  {f:'Hi Melody', l:'하이멜로디', g:'KR_HAND', w:400, weights:[400]},
  {f:'Yeon Sung', l:'연성', g:'KR_HAND', w:400, weights:[400]},
  {f:'Cute Font', l:'귀여운폰트', g:'KR_HAND', w:400, weights:[400]},
  {f:'Kirang Haerang', l:'키랑해랑', g:'KR_HAND', w:400, weights:[400]},
  {f:'Dokdo', l:'독도', g:'KR_HAND', w:400, weights:[400]},
  {f:'East Sea Dokdo', l:'동해독도', g:'KR_HAND', w:400, weights:[400]},
  {f:'Nanum Pen Script', l:'나눔펜스크립트', g:'KR_HAND', w:400, weights:[400]},
  {f:'Nanum Brush Script', l:'나눔붓스크립트', g:'KR_HAND', w:400, weights:[400]},

  {f:'Montserrat', l:'Montserrat', g:'EN', w:700, weights:[400,700,900]},
  {f:'Poppins', l:'Poppins', g:'EN', w:700, weights:[400,700,900]},
  {f:'Raleway', l:'Raleway', g:'EN', w:700, weights:[400,700,900]},
  {f:'Roboto', l:'Roboto', g:'EN', w:700, weights:[400,700,900]},
  {f:'Oswald', l:'Oswald', g:'EN', w:700, weights:[400,700]},
  {f:'Lora', l:'Lora', g:'EN', w:700, weights:[400,700]},
  {f:'Playfair Display', l:'Playfair Display', g:'EN', w:700, weights:[400,700,900]},
  {f:'Cinzel', l:'Cinzel', g:'EN', w:700, weights:[400,700,900]},
  {f:'Dancing Script', l:'Dancing Script', g:'EN', w:700, weights:[400,700]},
  {f:'Abril Fatface', l:'Abril Fatface', g:'EN', w:400, weights:[400]},
  {f:'Anton', l:'Anton', g:'EN', w:400, weights:[400]},
  {f:'Bebas Neue', l:'Bebas Neue', g:'EN', w:400, weights:[400]},
  {f:'Pacifico', l:'Pacifico', g:'EN', w:400, weights:[400]},
  {f:'Lobster', l:'Lobster', g:'EN', w:400, weights:[400]},
  {f:'Great Vibes', l:'Great Vibes', g:'EN', w:400, weights:[400]},
  {f:'Satisfy', l:'Satisfy', g:'EN', w:400, weights:[400]},
  {f:'Permanent Marker', l:'Permanent Marker', g:'EN', w:400, weights:[400]}
];

function buildFontSelect(el) {
  [
    ['KR_BASIC', '한국어 기본/본문'],
    ['KR_TITLE', '한국어 제목/강조'],
    ['KR_SERIF', '한국어 명조/감성'],
    ['KR_HAND', '한국어 손글씨/장식'],
    ['EN', 'English']
  ].forEach(function(group) {
    var g = group[0];
    var og = document.createElement('optgroup');
    og.label = group[1];
    FONTS.filter(function(f){ return f.g === g; }).forEach(function(f) {
      var o = document.createElement('option');
      o.value = f.f;
      o.textContent = f.l;
      og.appendChild(o);
    });
    el.appendChild(og);
  });
}

function wrapText(ctx, text, maxW) {
  var lines = [];
  var paras = text.split('\n');
  for (var pi = 0; pi < paras.length; pi++) {
    var para = paras[pi];
    if (!para.trim()) { lines.push(''); continue; }
    var line = '';
    for (var ci = 0; ci < para.length; ci++) {
      var ch = para[ci];
      var t = line + ch;
      if (ctx.measureText(t).width > maxW && line) {
        lines.push(line);
        line = ch;
      } else {
        line = t;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function resetBgTransform(state) {
  state.bgTransform = {scale: 100, posX: 0, posY: 0, cropL: 0, cropR: 0, cropT: 0, cropB: 0};
}

function updateBgControls(prefix, state) {
  var t = state.bgTransform || {scale: 100, posX: 0, posY: 0, cropL: 0, cropR: 0, cropT: 0, cropB: 0};
  var scale = document.getElementById(prefix + '-bg-scale');
  var x = document.getElementById(prefix + '-bg-x');
  var y = document.getElementById(prefix + '-bg-y');
  var cropL = document.getElementById(prefix + '-bg-crop-l');
  var cropR = document.getElementById(prefix + '-bg-crop-r');
  var cropT = document.getElementById(prefix + '-bg-crop-t');
  var cropB = document.getElementById(prefix + '-bg-crop-b');
  if (!scale || !x || !y) return;
  scale.value = t.scale;
  x.value = Math.round(t.posX);
  y.value = Math.round(t.posY);
  document.getElementById(prefix + '-bg-scale-v').textContent = Math.round(t.scale);
  document.getElementById(prefix + '-bg-x-v').textContent = Math.round(t.posX);
  document.getElementById(prefix + '-bg-y-v').textContent = Math.round(t.posY);
  if (cropL && cropR && cropT && cropB) {
    cropL.value = Math.round(t.cropL || 0);
    cropR.value = Math.round(t.cropR || 0);
    cropT.value = Math.round(t.cropT || 0);
    cropB.value = Math.round(t.cropB || 0);
    document.getElementById(prefix + '-bg-crop-l-v').textContent = Math.round(t.cropL || 0);
    document.getElementById(prefix + '-bg-crop-r-v').textContent = Math.round(t.cropR || 0);
    document.getElementById(prefix + '-bg-crop-t-v').textContent = Math.round(t.cropT || 0);
    document.getElementById(prefix + '-bg-crop-b-v').textContent = Math.round(t.cropB || 0);
  }
}

function normalizeCrop(t) {
  var minRemain = 3;
  var l = Math.max(0, Math.min(97, t.cropL || 0));
  var r = Math.max(0, Math.min(97, t.cropR || 0));
  var top = Math.max(0, Math.min(97, t.cropT || 0));
  var b = Math.max(0, Math.min(97, t.cropB || 0));
  if (l + r > 100 - minRemain) r = 100 - minRemain - l;
  if (top + b > 100 - minRemain) b = 100 - minRemain - top;
  return {cropL: l, cropR: r, cropT: top, cropB: b};
}

function getBgGeometry(state, W, H) {
  if (!state.bgImg) return null;
  var t = state.bgTransform || {scale: 100, posX: 0, posY: 0, cropL: 0, cropR: 0, cropT: 0, cropB: 0};
  var crop = normalizeCrop(t);
  var baseScale = Math.max(W / state.bgImg.naturalWidth, H / state.bgImg.naturalHeight);
  var scale = baseScale * ((t.scale || 100) / 100);
  var full = {
    x: (W - state.bgImg.naturalWidth * scale) / 2 + ((t.posX || 0) / 100) * W,
    y: (H - state.bgImg.naturalHeight * scale) / 2 + ((t.posY || 0) / 100) * H,
    w: state.bgImg.naturalWidth * scale,
    h: state.bgImg.naturalHeight * scale
  };
  var sx = state.bgImg.naturalWidth * (crop.cropL / 100);
  var sy = state.bgImg.naturalHeight * (crop.cropT / 100);
  var sw = state.bgImg.naturalWidth * ((100 - crop.cropL - crop.cropR) / 100);
  var sh = state.bgImg.naturalHeight * ((100 - crop.cropT - crop.cropB) / 100);
  var cropRect = {
    x: full.x + full.w * (crop.cropL / 100),
    y: full.y + full.h * (crop.cropT / 100),
    w: full.w * ((100 - crop.cropL - crop.cropR) / 100),
    h: full.h * ((100 - crop.cropT - crop.cropB) / 100)
  };
  return {full: full, cropRect: cropRect, crop: crop, sx: sx, sy: sy, sw: Math.max(1, sw), sh: Math.max(1, sh), scale: scale};
}

function drawBackground(ctx, state, W, H) {
  if (!state.bgImg) {
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, W, H);
    return;
  }
  var g = getBgGeometry(state, W, H);
  if (state.cropMode) {
    // 전체 이미지를 흐리게 (ghost)
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.drawImage(state.bgImg, g.full.x, g.full.y, g.full.w, g.full.h);
    ctx.restore();
    // 자른 영역만 선명하게
    ctx.drawImage(state.bgImg, g.sx, g.sy, g.sw, g.sh, g.cropRect.x, g.cropRect.y, g.cropRect.w, g.cropRect.h);
  } else {
    ctx.drawImage(state.bgImg, g.sx, g.sy, g.sw, g.sh, g.cropRect.x, g.cropRect.y, g.cropRect.w, g.cropRect.h);
  }
  state._bgFullRect = g.full;
  state._bgRect = g.cropRect;
}

function drawHandleBox(ctx, r) {
  ctx.save();
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 4;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#22d3ee';
  var pts = [
    [r.x, r.y], [r.x + r.w / 2, r.y], [r.x + r.w, r.y],
    [r.x, r.y + r.h / 2], [r.x + r.w, r.y + r.h / 2],
    [r.x, r.y + r.h], [r.x + r.w / 2, r.y + r.h], [r.x + r.w, r.y + r.h]
  ];
  pts.forEach(function(p) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

function drawCropOverlay(ctx, state, W, H) {
  if (!state.bgImg) return;
  var g = getBgGeometry(state, W, H);
  if (state.cropMode) {
    var r = g.cropRect;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.42)';
    ctx.fillRect(0, 0, W, r.y);
    ctx.fillRect(0, r.y + r.h, W, H - r.y - r.h);
    ctx.fillRect(0, r.y, r.x, r.h);
    ctx.fillRect(r.x + r.w, r.y, W - r.x - r.w, r.h);
    ctx.restore();
    drawHandleBox(ctx, r);
  } else if (state.bgSelected) {
    drawHandleBox(ctx, g.cropRect);
  }
}

function hitRectHandle(rect, x, y) {
  if (!rect) return null;
  var pad = 28;
  function near(px, py) { return Math.abs(x - px) <= pad && Math.abs(y - py) <= pad; }
  if (near(rect.x, rect.y)) return 'tl';
  if (near(rect.x + rect.w, rect.y)) return 'tr';
  if (near(rect.x, rect.y + rect.h)) return 'bl';
  if (near(rect.x + rect.w, rect.y + rect.h)) return 'br';
  if (near(rect.x + rect.w / 2, rect.y)) return 't';
  if (near(rect.x + rect.w / 2, rect.y + rect.h)) return 'b';
  if (near(rect.x, rect.y + rect.h / 2)) return 'l';
  if (near(rect.x + rect.w, rect.y + rect.h / 2)) return 'r';
  if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) return 'move';
  return null;
}

function hitBgHandle(state, W, H, x, y) {
  if (!state.bgImg) return null;
  var g = getBgGeometry(state, W, H);
  var hit = hitRectHandle(state.cropMode ? g.cropRect : g.cropRect, x, y);
  if (!hit && !state.cropMode && !state.bgSelected) return hitRectHandle(g.cropRect, x, y);
  return hit;
}

function hitLogoHandle(logoItems, selLogoFile, x, y) {
  if (!selLogoFile) return null;
  var item = null;
  for (var i = 0; i < logoItems.length; i++) {
    if (logoItems[i].file === selLogoFile && logoItems[i]._rect) { item = logoItems[i]; break; }
  }
  if (!item) return null;
  var p = 8;
  var r = {x: item._rect.x - p, y: item._rect.y - p, w: item._rect.w + p * 2, h: item._rect.h + p * 2};
  return hitRectHandle(r, x, y);
}

function hitTextHandle(boxes, selId, x, y) {
  if (!selId) return null;
  var b = boxes.find(function(box) { return box.id === selId; });
  if (!b || !b._rect) return null;
  var p = 12;
  var r = {x: b._rect.x - p, y: b._rect.y - p, w: b._rect.w + p * 2, h: b._rect.h + p * 2};
  var h = hitRectHandle(r, x, y);
  return (h && h !== 'move') ? h : null;
}

function cursorForHandle(handle) {
  if (!handle) return 'default';
  if (handle === 'move') return 'pointer';
  if (handle === 'l' || handle === 'r') return 'ew-resize';
  if (handle === 't' || handle === 'b') return 'ns-resize';
  if (handle === 'tl' || handle === 'br') return 'nwse-resize';
  if (handle === 'tr' || handle === 'bl') return 'nesw-resize';
  return 'default';
}

function applyBgResize(state, handle, start, current) {
  var dx = current.x - start.x;
  var dy = current.y - start.y;
  var delta = 0;
  if (handle.indexOf('r') >= 0) delta = dx;
  if (handle.indexOf('l') >= 0) delta = -dx;
  if (handle.indexOf('b') >= 0) delta = Math.abs(dy) > Math.abs(delta) ? dy : delta;
  if (handle.indexOf('t') >= 0) delta = Math.abs(dy) > Math.abs(delta) ? -dy : delta;
  var base = Math.max(40, start.rect.w);
  var next = start.scale * Math.max(0.1, (base + delta) / base);
  state.bgTransform.scale = Math.max(20, Math.min(500, next));
}

function applyCropDrag(state, handle, start, current, W, H) {
  var full = start.full;
  var orig = start.crop;
  var minRemain = 3;
  function clamp(v) { return Math.max(0, Math.min(97, v)); }
  var next = {cropL: orig.cropL, cropR: orig.cropR, cropT: orig.cropT, cropB: orig.cropB};
  if (handle === 'move') {
    var dxp = ((current.x - start.x) / full.w) * 100;
    var dyp = ((current.y - start.y) / full.h) * 100;
    var cropW = 100 - orig.cropL - orig.cropR;
    var cropH = 100 - orig.cropT - orig.cropB;
    next.cropL = Math.max(0, Math.min(100 - cropW, orig.cropL + dxp));
    next.cropT = Math.max(0, Math.min(100 - cropH, orig.cropT + dyp));
    next.cropR = 100 - cropW - next.cropL;
    next.cropB = 100 - cropH - next.cropT;
  } else {
    var px = ((current.x - full.x) / full.w) * 100;
    var py = ((current.y - full.y) / full.h) * 100;
    if (handle.indexOf('l') >= 0) next.cropL = Math.max(0, Math.min(100 - minRemain - next.cropR, px));
    if (handle.indexOf('r') >= 0) next.cropR = Math.max(0, Math.min(100 - minRemain - next.cropL, 100 - px));
    if (handle.indexOf('t') >= 0) next.cropT = Math.max(0, Math.min(100 - minRemain - next.cropB, py));
    if (handle.indexOf('b') >= 0) next.cropB = Math.max(0, Math.min(100 - minRemain - next.cropT, 100 - py));
  }
  state.bgTransform.cropL = clamp(next.cropL);
  state.bgTransform.cropR = clamp(next.cropR);
  state.bgTransform.cropT = clamp(next.cropT);
  state.bgTransform.cropB = clamp(next.cropB);
}

function setBackground(state, img, prefix, render, name) {
  state.bgImg = img;
  resetBgTransform(state);
  updateBgControls(prefix, state);
  var nameEl = document.getElementById(prefix + '-bg-file-name');
  if (nameEl) nameEl.textContent = name || '기본 배경';
  render();
}

async function loadImgManifest(gridId, onSelect, uploadInputId) {
  var grid = document.getElementById(gridId);
  if (!grid) return;
  var imgList = [];
  var selFile = null;
  var uploadInput = uploadInputId ? document.getElementById(uploadInputId) : null;

  function renderGrid() {
    grid.innerHTML = '';
    if (!imgList.length) {
      grid.innerHTML = '<div style="font-size:12px;color:#888;grid-column:1/-1;padding:8px 0">manifest.json을 찾을 수 없습니다.<br>로컬: python -m http.server 후 localhost:8000</div>';
      return;
    }
    imgList.forEach(function(img) {
      var wrap = document.createElement('div');
      wrap.className = 'img-thumb-wrap' + (img.file === selFile ? ' sel' : '');
      var el = document.createElement('img');
      el.src = img.url;
      el.alt = img.name;
      var lbl = document.createElement('div');
      lbl.className = 'img-name-label';
      lbl.textContent = img.name;
      wrap.appendChild(el);
      wrap.appendChild(lbl);
      function selectThisImage() {
        selFile = img.file;
        var bgImg = new Image();
        bgImg.onload = function() { onSelect(bgImg, img.name); };
        bgImg.src = img.url;
        renderGrid();
      }
      wrap.addEventListener('click', selectThisImage);
      img._select = selectThisImage;
      grid.appendChild(wrap);
    });
    if (uploadInput) {
      var add = document.createElement('button');
      add.type = 'button';
      add.className = 'img-add-tile';
      add.innerHTML = '<strong>+</strong><span>이미지</span><span>추가</span>';
      add.addEventListener('click', function() { uploadInput.click(); });
      grid.appendChild(add);
    }
  }

  try {
    var r = await fetch('images/manifest.json?v=' + Date.now());
    if (!r.ok) throw new Error('no manifest');
    var manifest = await r.json();
    var loadedImages = await Promise.all(manifest.map(async function(entry) {
      try {
        var ir = await fetch('images/' + entry.file);
        console.log('[BG]', entry.file, ir.status);
        if (!ir.ok) { console.warn('[BG FAIL]', entry.file, ir.status); return null; }
        var blob = await ir.blob();
        console.log('[BG blob]', entry.file, blob.type, blob.size);
        var url = URL.createObjectURL(blob);
        return {file: entry.file, name: entry.name || entry.file, url: url};
      } catch(e) { console.error('[BG ERR]', entry.file, e); return null; }
    }));
    imgList = loadedImages.filter(function(img) { return img; });
    window.__bgManifestPickers = window.__bgManifestPickers || {};
    window.__bgManifestPickers[gridId] = function(fileName) {
      var target = imgList.find(function(img) { return img.file === fileName || img.name === fileName; });
      if (!target) return false;
      selFile = target.file;
      var bgImg = new Image();
      bgImg.onload = function() { onSelect(bgImg, target.name); };
      bgImg.src = target.url;
      renderGrid();
      return true;
    };
    if (imgList.length) {
      selFile = imgList[0].file;
      var bgImg0 = new Image();
      bgImg0.onload = function() { onSelect(bgImg0, imgList[0].name); };
      bgImg0.src = imgList[0].url;
    }
    renderGrid();
  } catch(e) {
    renderGrid();
  }

  if (uploadInput) {
    uploadInput.addEventListener('change', function(e) {
      var file = e.target.files && e.target.files[0];
      if (!file || !file.type || file.type.indexOf('image/') !== 0) return;
      var url = URL.createObjectURL(file);
      var uploaded = {file: 'upload-' + Date.now(), name: file.name, url: url};
      imgList.unshift(uploaded);
      selFile = uploaded.file;
      var bgImg = new Image();
      bgImg.onload = function() { onSelect(bgImg, file.name); };
      bgImg.src = url;
      renderGrid();
      uploadInput.value = '';
    });
  }
}

async function initLogoSection(rowsId, logoItems, onChange) {
  var container = document.getElementById(rowsId);
  if (!container) return;
  try {
    var r = await fetch('images/logo/manifest.json');
    if (!r.ok) throw new Error('no logo manifest');
    var manifest = await r.json();
    await Promise.all(manifest.map(async function(entry) {
      try {
        var ir = await fetch('images/logo/' + entry.file);
        if (!ir.ok) return;
        var url = URL.createObjectURL(await ir.blob());
        logoItems.push({
          file: entry.file,
          name: entry.name || entry.file,
          url: url,
          active: false,
          size: 20,
          posX: 50,
          posY: 88,
          _imgEl: null,
          _rect: null
        });
      } catch(e) {}
    }));
    renderLogoRows(container, logoItems, onChange);
  } catch(e) {}
}

function renderLogoRows(container, logoItems, onChange) {
  container.innerHTML = '';
  var activeType = container.dataset.logoType || 'white';
  var tabs = document.createElement('div');
  tabs.className = 'logo-tabs';
  [
    {key: 'white', title: '흰색'},
    {key: 'color', title: '컬러'}
  ].forEach(function(tabInfo) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'logo-tab' + (activeType === tabInfo.key ? ' on' : '');
    btn.textContent = tabInfo.title;
    btn.addEventListener('click', function() {
      container.dataset.logoType = tabInfo.key;
      renderLogoRows(container, logoItems, onChange);
    });
    tabs.appendChild(btn);
  });
  container.appendChild(tabs);
  var groups = [
    {key: 'white', title: '흰색 로고', items: logoItems.filter(function(item) { return item.name.indexOf('(흰색)') >= 0; })},
    {key: 'color', title: '컬러 로고', items: logoItems.filter(function(item) { return item.name.indexOf('(흰색)') < 0; })}
  ];
  groups.filter(function(group) { return group.key === activeType; }).forEach(function(group) {
    if (!group.items.length) return;
    var title = document.createElement('div');
    title.className = 'logo-group-title';
    title.textContent = group.title;
    container.appendChild(title);
    group.items.forEach(function(item) {
      var displayName = item.name.replace('(흰색)', '').trim();
      var row = document.createElement('div');
      row.className = 'logo-row' + (item.active ? ' on' : '');
      row.innerHTML = '<div class="logo-chk">' + (item.active ? '&#10003;' : '') + '</div><div class="logo-row-name">' + displayName + '</div>';
      row.addEventListener('click', function() {
        item.active = !item.active;
        if (item.active && !item._imgEl) {
          var el = new Image();
          el.onload = function() { item._imgEl = el; onChange(); };
          el.src = item.url;
        }
        if (!item.active) item._rect = null;
        renderLogoRows(container, logoItems, onChange);
        onChange();
      });
      container.appendChild(row);
    });
  });
}

function drawLogoItems(ctx, logoItems, selLogoFile, W, H) {
  logoItems.forEach(function(item) {
    if (!item.active || !item._imgEl) return;
    var img = item._imgEl;
    var w = (item.size / 100) * W;
    var h = w * (img.naturalHeight / img.naturalWidth);
    var x = (item.posX / 100) * W - w / 2;
    var y = (item.posY / 100) * H - h / 2;
    ctx.drawImage(img, x, y, w, h);
    item._rect = {x: x, y: y, w: w, h: h};
    if (item.file === selLogoFile) {
      var p = 8;
      drawHandleBox(ctx, {x: x - p, y: y - p, w: w + p * 2, h: h + p * 2});
    }
  });
}

function drawTextBox(ctx, b, isSelected, W, H) {
  if (!b.text.trim()) { b._rect = null; return; }
  var fd = FONTS.find(function(f) { return f.f === b.font; });
  var fw = b.bold ? (fd ? fd.w : 700) : 400;
  ctx.font = fw + ' ' + b.size + 'px "' + b.font + '", "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  var maxW = W * 0.85;
  var lines = wrapText(ctx, b.text, maxW);
  if (!lines.length) { b._rect = null; return; }
  var lh = b.size * 1.4;
  var totalH = lines.length * lh;
  var ax = (b.posX / 100) * W;
  var ay = (b.posY / 100) * H;
  var sy = ay - totalH / 2 + lh / 2;
  var measuredWidths = lines.map(function(l) { return ctx.measureText(l).width || 0; });
  var tw = Math.min(maxW, Math.max.apply(null, measuredWidths));
  b._rect = {x: ax - tw / 2, y: ay - totalH / 2, w: tw, h: totalH};
  if (b.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,.65)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
  }
  ctx.fillStyle = b.color;
  for (var i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], ax, sy + i * lh);
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  if (isSelected && b._rect) {
    drawHandleBox(ctx, {x: b._rect.x - 12, y: b._rect.y - 12, w: b._rect.w + 24, h: b._rect.h + 24});
  }
}

function hitTestBoxes(boxes, px, py) {
  var pad = 20;
  for (var i = boxes.length - 1; i >= 0; i--) {
    var r = boxes[i]._rect;
    if (r && px >= r.x - pad && px <= r.x + r.w + pad && py >= r.y - pad && py <= r.y + r.h + pad) {
      return boxes[i];
    }
  }
  return null;
}

var loadedFontCss = {};

function googleFontFamilyParam(font) {
  var family = font.f.replace(/ /g, '+');
  var weights = font.weights || [400, font.w || 700];
  weights = weights.filter(function(v, i, arr) { return arr.indexOf(v) === i; }).sort(function(a, b) { return a - b; });
  return family + ':wght@' + weights.join(';');
}

function ensureFontCss(family) {
  var font = FONTS.find(function(f) { return f.f === family; });
  if (!font || loadedFontCss[family]) return loadedFontCss[family] || Promise.resolve();

  loadedFontCss[family] = new Promise(function(resolve) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + googleFontFamilyParam(font) + '&display=swap';
    link.onload = function() { resolve(); };
    link.onerror = function() { resolve(); };
    document.head.appendChild(link);
  });

  return loadedFontCss[family];
}

async function forceLoadFont(family, weight, size) {
  await ensureFontCss(family);
  var el = document.createElement('span');
  el.style.fontFamily = '"' + family + '"';
  el.style.fontWeight = weight;
  el.style.fontSize = size + 'px';
  el.style.position = 'absolute';
  el.style.visibility = 'hidden';
  el.textContent = '가나다AaBb';
  document.body.appendChild(el);
  try {
    await document.fonts.load(weight + ' ' + size + 'px "' + family + '"', el.textContent);
    await document.fonts.ready;
  } catch(e) {}
  document.body.removeChild(el);
}


var P2_TEMPLATES = {
  free: {label: '자유 편집', list: null, logo: {posX: 50, posY: 88, size: 20}, boxes: []},
  list: {
    label: '성적명단형',
    logo: {posX: 50, posY: 91, size: 18},
    list: {
      open: true,
      y: 45,
      gap: 66,
      cols: 3,
      sample: '광양중3 김OO\n전동중2 이OO\n건대부중3 박OO\n가람중3 노OO\n구의중3 문OO\n신양중3 최OO',
      schoolSize: 22,
      nameSize: 38,
      schoolColor: '#c9c2b5',
      nameColor: '#ffffff',
      schoolBold: false,
      nameBold: true
    },
    boxes: [
      {text: '2026 내신 우수자 명단', font: 'Noto Sans KR', size: 66, color: '#ffffff', bold: true, shadow: true, posX: 50, posY: 19},
      {text: '노력의 결과를 함께 축하합니다', font: 'Noto Sans KR', size: 30, color: '#d7b76b', bold: true, shadow: true, posX: 50, posY: 25}
    ]
  }
};

function initBgControls(prefix, state, render) {
  var uploadBtn = document.getElementById(prefix + '-bg-upload');
  var uploadInput = document.getElementById(prefix + '-bg-file');
  var scale = document.getElementById(prefix + '-bg-scale');
  var x = document.getElementById(prefix + '-bg-x');
  var y = document.getElementById(prefix + '-bg-y');
  var cropL = document.getElementById(prefix + '-bg-crop-l');
  var cropR = document.getElementById(prefix + '-bg-crop-r');
  var cropT = document.getElementById(prefix + '-bg-crop-t');
  var cropB = document.getElementById(prefix + '-bg-crop-b');
  var moveMode = document.getElementById(prefix + '-bg-move-mode');
  var cropMode = document.getElementById(prefix + '-bg-crop-mode');
  var reset = document.getElementById(prefix + '-bg-reset');
  if (!scale || !x || !y) return;

  if (uploadBtn && uploadInput) {
    uploadBtn.addEventListener('click', function() { uploadInput.click(); });
  }
  if (moveMode) {
    moveMode.addEventListener('click', function() {
      state.moveMode = !state.moveMode;
      if (state.moveMode) state.cropMode = false;
      moveMode.textContent = state.moveMode ? '이동 완료' : '위치 이동';
      moveMode.classList.toggle('move-mode-on', !!state.moveMode);
      if (cropMode) {
        cropMode.textContent = '자르기';
        cropMode.classList.remove('crop-mode-on');
      }
      render();
    });
  }
  if (cropMode) {
    cropMode.addEventListener('click', function() {
      state.cropMode = !state.cropMode;
      state.bgSelected = !!state.cropMode;
      if (state.cropMode) state.moveMode = false;
      cropMode.textContent = state.cropMode ? '자르기 완료' : '자르기';
      cropMode.classList.toggle('crop-mode-on', !!state.cropMode);
      if (moveMode) {
        moveMode.textContent = '위치 이동';
        moveMode.classList.remove('move-mode-on');
      }
      render();
    });
  }

  function syncFromControls() {
    state.bgTransform.scale = +scale.value;
    state.bgTransform.posX = +x.value;
    state.bgTransform.posY = +y.value;
    state.bgTransform.cropL = cropL ? +cropL.value : 0;
    state.bgTransform.cropR = cropR ? +cropR.value : 0;
    state.bgTransform.cropT = cropT ? +cropT.value : 0;
    state.bgTransform.cropB = cropB ? +cropB.value : 0;
    updateBgControls(prefix, state);
    render();
  }

  scale.addEventListener('input', syncFromControls);
  x.addEventListener('input', syncFromControls);
  y.addEventListener('input', syncFromControls);
  if (cropL) cropL.addEventListener('input', syncFromControls);
  if (cropR) cropR.addEventListener('input', syncFromControls);
  if (cropT) cropT.addEventListener('input', syncFromControls);
  if (cropB) cropB.addEventListener('input', syncFromControls);
  if (reset) {
    reset.addEventListener('click', function() {
      resetBgTransform(state);
      state.cropMode = false;
      state.moveMode = false;
      if (moveMode) {
        moveMode.textContent = '위치 이동';
        moveMode.classList.remove('move-mode-on');
      }
      if (cropMode) {
        cropMode.textContent = '자르기';
        cropMode.classList.remove('crop-mode-on');
      }
      updateBgControls(prefix, state);
      render();
    });
  }
}

function todayStamp() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return '' + y + m + day;
}

function downloadFileName(prefix) {
  return prefix + '_' + todayStamp() + '.png';
}

function canvasToBlob(canvas) {
  return new Promise(function(resolve) {
    canvas.toBlob(function(blob) { resolve(blob); }, 'image/png', 1);
  });
}

function downloadCanvasImage(canvas, fileName) {
  var link = document.createElement('a');
  link.download = fileName;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

async function shareCanvasImage(canvas, fileName) {
  var blob = await canvasToBlob(canvas);
  if (!blob) return false;
  var file = new File([blob], fileName, {type: 'image/png'});
  if (navigator.canShare && navigator.canShare({files: [file]}) && navigator.share) {
    await navigator.share({files: [file], title: '이미지만들기', text: '제작한 이미지를 공유합니다.'});
    return true;
  }
  return false;
}

async function sharePreparedImage(canvas, fileName, prepare, restore) {
  prepare();
  try {
    var shared = await shareCanvasImage(canvas, fileName);
    if (!shared) {
      downloadCanvasImage(canvas, fileName);
      window.open('https://www.instagram.com/', '_blank', 'noopener');
      alert('이 브라우저에서는 직접 공유가 지원되지 않아 PNG를 저장했습니다. 열린 인스타그램에서 저장된 이미지를 업로드하세요.');
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    downloadCanvasImage(canvas, fileName);
    window.open('https://www.instagram.com/', '_blank', 'noopener');
    alert('인스타그램 공유를 바로 실행하지 못해 PNG를 저장했습니다. 저장된 이미지를 인스타그램에서 업로드하세요.');
  } finally {
    restore();
  }
}
// PAGE 2
// ============================================================
var p2State = {
  bgImg: null,
  bgTransform: {scale: 100, posX: 0, posY: 0, cropL: 0, cropR: 0, cropT: 0, cropB: 0},
  logoItems: [],
  selLogoFile: null,
  boxes: [],
  selId: null,
  nextNum: 1
};

var p2Canvas = document.getElementById('cv2');
var p2Ctx = p2Canvas.getContext('2d');

function parseListData(raw) {
  var rows = [];
  var normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  var lines = normalized.split('\n').filter(function(l) { return l.trim(); });
  lines.forEach(function(line) {
    var parts;
    if (line.indexOf('\t') >= 0) {
      parts = line.split('\t');
    } else if (/\s{2,}/.test(line)) {
      parts = line.split(/\s{2,}/);
    } else {
      var spIdx = line.indexOf(' ');
      if (spIdx >= 0) {
        parts = [line.slice(0, spIdx), line.slice(spIdx + 1)];
      } else {
        parts = [line, ''];
      }
    }
    rows.push({school: (parts[0] || '').trim(), name: (parts[1] || '').trim()});
  });
  return rows;
}

function setRangeValue(id, value) {
  var el = document.getElementById(id);
  var val = document.getElementById(id + '-v');
  if (el) el.value = value;
  if (val) val.textContent = value;
}

function applyListAutoSettings(rowCount) {
  if (!rowCount) return;
  var cols = rowCount <= 10 ? 2 : 3;
  var nameSize = rowCount <= 6 ? 42 : rowCount <= 12 ? 36 : rowCount <= 18 ? 32 : 28;
  var schoolSize = rowCount <= 6 ? 24 : rowCount <= 12 ? 22 : rowCount <= 18 ? 20 : 18;
  var rowGap = rowCount <= 6 ? 82 : rowCount <= 12 ? 72 : rowCount <= 18 ? 62 : 54;
  p2setCol(cols, true);
  setRangeValue('p2-name-size', nameSize);
  setRangeValue('p2-school-size', schoolSize);
  setRangeValue('p2-row-gap', rowGap);
}

function autoTuneListFromCurrentInput() {
  var data = document.getElementById('p2-list-data');
  if (!data) return;
  applyListAutoSettings(parseListData(data.value).length);
}

function fillRoundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    return;
  }
  var rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.fill();
}

function drawTemplateDecor(ctx, state, W, H) {
  var key = state.templateKey || 'free';
  if (key === 'free') return;

  ctx.save();
  if (key === 'list') {
    // 성적명단형은 선택한 배경 이미지를 그대로 사용합니다.
  }
  ctx.restore();
}
function p2render() {
  p2snapshot();
  var W = p2Canvas.width;
  var H = p2Canvas.height;
  p2Ctx.clearRect(0, 0, W, H);
  drawBackground(p2Ctx, p2State, W, H);
  drawTemplateDecor(p2Ctx, p2State, W, H);

  var selBox2 = null;
  p2State.boxes.forEach(function(b) {
    if (b.id === p2State.selId) { selBox2 = b; return; }
    drawTextBox(p2Ctx, b, false, W, H);
  });
  if (selBox2) drawTextBox(p2Ctx, selBox2, true, W, H);

  var listPanel = document.getElementById('p2-list-panel');
  var leftPanel = document.querySelector('#page-2 .left-panel');
  var listEnabled = (listPanel && listPanel.classList.contains('on')) || (leftPanel && leftPanel.classList.contains('mode-list'));
  var raw = listEnabled ? document.getElementById('p2-list-data').value : '';
  var rows = parseListData(raw);
  if (rows.length) {
    var listY = (+document.getElementById('p2-list-y').value / 100) * H;
    var cols = +document.getElementById('p2-col-count').value;
    var rowGap = +document.getElementById('p2-row-gap').value;
    var marginX = 80;
    var colW = (W - marginX * 2) / cols;
    var rowsPerCol = Math.ceil(rows.length / cols);

    var schoolFont = document.getElementById('p2-school-font').value || 'Noto Sans KR';
    var schoolSize = +document.getElementById('p2-school-size').value;
    var schoolColor = document.getElementById('p2-school-color').value;
    var schoolBold = document.getElementById('p2-school-bold').classList.contains('on');
    var schoolShadow = document.getElementById('p2-school-shadow').classList.contains('on');

    var nameFont = document.getElementById('p2-name-font').value || 'Noto Sans KR';
    var nameSize = +document.getElementById('p2-name-size').value;
    var nameColor = document.getElementById('p2-name-color').value;
    var nameBold = document.getElementById('p2-name-bold').classList.contains('on');
    var nameShadow = document.getElementById('p2-name-shadow').classList.contains('on');

    var schoolFd = FONTS.find(function(f) { return f.f === schoolFont; });
    var schoolFw = schoolBold ? (schoolFd ? schoolFd.w : 700) : 400;
    var nameFd = FONTS.find(function(f) { return f.f === nameFont; });
    var nameFw = nameBold ? (nameFd ? nameFd.w : 700) : 400;

    // 컬럼 구분선 먼저 그리기
    var lastRowY = listY + (rowsPerCol - 1) * rowGap;
    var linePad = Math.max(schoolSize, nameSize) / 2;
    for (var ci = 1; ci < cols; ci++) {
      var sepX = marginX + ci * colW;
      p2Ctx.save();
      p2Ctx.strokeStyle = 'rgba(255,255,255,.38)';
      p2Ctx.lineWidth = 1;
      p2Ctx.beginPath();
      p2Ctx.moveTo(sepX, listY - linePad);
      p2Ctx.lineTo(sepX, lastRowY + linePad);
      p2Ctx.stroke();
      p2Ctx.restore();
    }

    // 행 우선(row-major) 순서로 렌더링: 1행(col1,col2,col3) → 2행 → 3행
    for (var r = 0; r < rowsPerCol; r++) {
      for (var ci = 0; ci < cols; ci++) {
        var dataIdx = r * cols + ci;
        if (dataIdx >= rows.length) continue;
        var row = rows[dataIdx];
        var colX = marginX + ci * colW;
        var rowY = listY + r * rowGap;

        var itemPad = 22;
        var itemMaxW = colW - itemPad * 2;
        var textGap = 18;
        var schoolMaxW = itemMaxW * 0.38;
        var nameMaxW = itemMaxW * 0.52;
        var schoolW, nameW, groupW, groupX;

        p2Ctx.save();
        p2Ctx.font = schoolFw + ' ' + schoolSize + 'px "' + schoolFont + '", "Noto Sans KR", sans-serif';
        schoolW = Math.min(p2Ctx.measureText(row.school).width, schoolMaxW);
        p2Ctx.restore();

        p2Ctx.save();
        p2Ctx.font = nameFw + ' ' + nameSize + 'px "' + nameFont + '", "Noto Sans KR", sans-serif';
        nameW = Math.min(p2Ctx.measureText(row.name).width, nameMaxW);
        p2Ctx.restore();

        groupW = Math.min(itemMaxW, schoolW + textGap + nameW);
        groupX = colX + (colW - groupW) / 2;

        p2Ctx.save();
        p2Ctx.font = schoolFw + ' ' + schoolSize + 'px "' + schoolFont + '", "Noto Sans KR", sans-serif';
        p2Ctx.textAlign = 'left';
        p2Ctx.textBaseline = 'middle';
        if (schoolShadow) { p2Ctx.shadowColor='rgba(0,0,0,.65)'; p2Ctx.shadowBlur=12; p2Ctx.shadowOffsetY=2; }
        p2Ctx.fillStyle = schoolColor;
        p2Ctx.fillText(row.school, groupX, rowY, schoolMaxW);
        p2Ctx.shadowColor='transparent'; p2Ctx.shadowBlur=0; p2Ctx.shadowOffsetY=0;
        p2Ctx.restore();

        p2Ctx.save();
        p2Ctx.font = nameFw + ' ' + nameSize + 'px "' + nameFont + '", "Noto Sans KR", sans-serif';
        p2Ctx.textAlign = 'left';
        p2Ctx.textBaseline = 'middle';
        if (nameShadow) { p2Ctx.shadowColor='rgba(0,0,0,.65)'; p2Ctx.shadowBlur=14; p2Ctx.shadowOffsetY=3; }
        p2Ctx.fillStyle = nameColor;
        p2Ctx.fillText(row.name, groupX + schoolW + textGap, rowY, nameMaxW);
        p2Ctx.shadowColor='transparent'; p2Ctx.shadowBlur=0; p2Ctx.shadowOffsetY=0;
        p2Ctx.restore();
      }
    }
  }

  drawLogoItems(p2Ctx, p2State.logoItems, p2State.selLogoFile, W, H);
  drawCropOverlay(p2Ctx, p2State, W, H);
  p2autosave();
}

function p2updatePanel() {
  var bl = document.getElementById('p2-box-list');
  bl.innerHTML = '';
  p2State.boxes.forEach(function(b) {
    var item = document.createElement('div');
    item.className = 'box-item' + (b.id === p2State.selId ? ' sel' : '');
    item.innerHTML = '<div class="box-preview">' + (b.text || '(빈 텍스트)') + '</div>';
    item.addEventListener('click', function() {
      p2State.selId = b.id;
      p2updatePanel();
      p2render();
    });
    bl.appendChild(item);
  });
  var ed = document.getElementById('p2-editor');
  var selBox = p2State.boxes.find(function(b) { return b.id === p2State.selId; });
  if (selBox) {
    ed.style.display = 'flex';
    document.getElementById('p2-ed-text').value = selBox.text;
    document.getElementById('p2-ed-font').value = selBox.font;
    document.getElementById('p2-ed-size').value = selBox.size;
    document.getElementById('p2-ed-size-v').textContent = selBox.size;
    document.getElementById('p2-ed-color').value = selBox.color;
    document.getElementById('p2-ed-bold').className = 'toggle-btn' + (selBox.bold ? ' on' : '');
    document.getElementById('p2-ed-shadow').className = 'toggle-btn' + (selBox.shadow ? ' on' : '');
    // 에디터로 부드럽게 스크롤
    setTimeout(function() {
      ed.scrollIntoView({behavior: 'smooth', block: 'nearest'});
    }, 60);
  } else {
    ed.style.display = 'none';
  }
}

function createP2Box(num, data) {
  return {
    id: 'p2b' + num,
    text: data.text || ('텍스트 ' + num),
    font: data.font || 'Noto Sans KR',
    size: data.size || 72,
    color: data.color || '#ffffff',
    bold: data.bold !== false,
    shadow: data.shadow !== false,
    posX: data.posX == null ? 50 : data.posX,
    posY: data.posY == null ? 50 : data.posY,
    _rect: null
  };
}

function p2addBox() {
  var num = p2State.nextNum++;
  var box = {
    id: 'p2b' + num,
    text: '텍스트 ' + num,
    font: 'Noto Sans KR',
    size: 72,
    color: '#ffffff',
    bold: true,
    shadow: true,
    posX: 50,
    posY: 50,
    _rect: null
  };
  p2State.boxes.push(box);
  p2State.selId = box.id;
  p2updatePanel();
  p2render();
}

function setToggleOn(id, on) {
  var el = document.getElementById(id);
  if (el) el.classList.toggle('on', !!on);
}

function setListPanelOpen(open) {
  var panel = document.getElementById('p2-list-panel');
  var btn = document.getElementById('p2-list-toggle');
  if (!panel || !btn) return;
  panel.classList.toggle('on', !!open);
  btn.textContent = open ? '명단입력 닫기' : '명단입력하기';
}

function selectP2BackgroundByFile(fileName) {
  if (window.__bgManifestPickers && window.__bgManifestPickers['p2-img-grid']) {
    return window.__bgManifestPickers['p2-img-grid'](fileName);
  }
  return false;
}

function resetP2DefaultsForTemplate() {
  p2State.boxes = [];
  p2State.selId = null;
  p2State.nextNum = 1;
  p2State.bgSelected = false;
  p2State.cropMode = false;
  p2State.selLogoFile = null;
  setListPanelOpen(false);
  var listY = document.getElementById('p2-list-y');
  if (listY) {
    listY.value = 45;
    document.getElementById('p2-list-y-v').textContent = 45;
  }
  var rowGap = document.getElementById('p2-row-gap');
  if (rowGap) {
    rowGap.value = 65;
    document.getElementById('p2-row-gap-v').textContent = 65;
  }
  p2setCol(3);
  document.getElementById('p2-school-size').value = 18;
  document.getElementById('p2-school-size-v').textContent = 18;
  document.getElementById('p2-name-size').value = 30;
  document.getElementById('p2-name-size-v').textContent = 30;
  document.getElementById('p2-school-color').value = '#aaaaaa';
  document.getElementById('p2-name-color').value = '#ffffff';
  setToggleOn('p2-school-bold', false);
  setToggleOn('p2-school-shadow', false);
  setToggleOn('p2-name-bold', true);
  setToggleOn('p2-name-shadow', true);
}

function applyTemplateLogoPreset(tpl) {
  if (!tpl.logo) return;
  p2State.logoItems.forEach(function(item) {
    if (!item.active) return;
    item.posX = tpl.logo.posX;
    item.posY = tpl.logo.posY;
    item.size = tpl.logo.size;
  });
}

async function p2applyTemplate(key) {
  var tpl = P2_TEMPLATES[key] || P2_TEMPLATES.free;
  p2State.templateKey = key;
  resetP2DefaultsForTemplate();

  if (key === 'list') {
    selectP2BackgroundByFile('bg3.jpg');
    p2State.boxes = tpl.boxes.map(function(box, idx) { return createP2Box(idx + 1, box); });
    p2State.nextNum = p2State.boxes.length + 1;
    p2State.selId = p2State.boxes.length ? p2State.boxes[0].id : null;
  }

  if (tpl.list) {
    setListPanelOpen(!!tpl.list.open);
    if (tpl.list.open) {
      var data = document.getElementById('p2-list-data');
      if (data && tpl.list.sample) data.value = tpl.list.sample;
      if (tpl.list.y != null) {
        document.getElementById('p2-list-y').value = tpl.list.y;
        document.getElementById('p2-list-y-v').textContent = tpl.list.y;
      }
      if (tpl.list.gap != null) {
        document.getElementById('p2-row-gap').value = tpl.list.gap;
        document.getElementById('p2-row-gap-v').textContent = tpl.list.gap;
      }
      if (tpl.list.cols) p2setCol(tpl.list.cols);
      if (tpl.list.schoolSize) {
        document.getElementById('p2-school-size').value = tpl.list.schoolSize;
        document.getElementById('p2-school-size-v').textContent = tpl.list.schoolSize;
      }
      if (tpl.list.nameSize) {
        document.getElementById('p2-name-size').value = tpl.list.nameSize;
        document.getElementById('p2-name-size-v').textContent = tpl.list.nameSize;
      }
      if (tpl.list.schoolColor) document.getElementById('p2-school-color').value = tpl.list.schoolColor;
      if (tpl.list.nameColor) document.getElementById('p2-name-color').value = tpl.list.nameColor;
      setToggleOn('p2-school-bold', tpl.list.schoolBold);
      setToggleOn('p2-name-bold', tpl.list.nameBold);
      setToggleOn('p2-school-shadow', true);
      setToggleOn('p2-name-shadow', true);
      autoTuneListFromCurrentInput();
    }
  }

  applyTemplateLogoPreset(tpl);
  document.querySelectorAll('.template-card').forEach(function(btn) {
    btn.classList.toggle('on', btn.dataset.template === key);
  });
  await Promise.all(p2State.boxes.map(function(b) {
    var fd = FONTS.find(function(f) { return f.f === b.font; });
    var fw = b.bold ? (fd ? fd.w : 700) : 400;
    return forceLoadFont(b.font, fw, b.size);
  }));
  p2updatePanel();
  renderLogoRows(document.getElementById('p2-logo-rows'), p2State.logoItems, p2render);
  p2render();
}

function p2removeBox(id) {
  p2State.boxes = p2State.boxes.filter(function(b) { return b.id !== id; });
  if (p2State.selId === id) p2State.selId = null;
  p2updatePanel();
  p2render();
}

document.getElementById('p2-ed-text').addEventListener('input', function(e) {
  var b = p2State.boxes.find(function(b) { return b.id === p2State.selId; });
  if (!b) return;
  b.text = e.target.value;
  p2updatePanel();
  p2render();
});

document.getElementById('p2-ed-font').addEventListener('change', async function(e) {
  var b = p2State.boxes.find(function(b) { return b.id === p2State.selId; });
  if (!b) return;
  b.font = e.target.value;
  var fd = FONTS.find(function(f) { return f.f === b.font; });
  var fw = b.bold ? (fd ? fd.w : 700) : 400;
  await forceLoadFont(b.font, fw, b.size);
  p2render();
});

document.getElementById('p2-ed-size').addEventListener('input', function(e) {
  var b = p2State.boxes.find(function(b) { return b.id === p2State.selId; });
  if (!b) return;
  b.size = +e.target.value;
  document.getElementById('p2-ed-size-v').textContent = b.size;
  p2render();
});

document.getElementById('p2-ed-color').addEventListener('input', function(e) {
  var b = p2State.boxes.find(function(b) { return b.id === p2State.selId; });
  if (!b) return;
  b.color = e.target.value;
  p2render();
});

document.getElementById('p2-ed-bold').addEventListener('click', async function() {
  var b = p2State.boxes.find(function(b) { return b.id === p2State.selId; });
  if (!b) return;
  b.bold = !b.bold;
  this.className = 'toggle-btn' + (b.bold ? ' on' : '');
  var fd = FONTS.find(function(f) { return f.f === b.font; });
  var fw = b.bold ? (fd ? fd.w : 700) : 400;
  await forceLoadFont(b.font, fw, b.size);
  p2render();
});

document.getElementById('p2-ed-shadow').addEventListener('click', function() {
  var b = p2State.boxes.find(function(b) { return b.id === p2State.selId; });
  if (!b) return;
  b.shadow = !b.shadow;
  this.className = 'toggle-btn' + (b.shadow ? ' on' : '');
  p2render();
});

document.getElementById('p2-del-btn').addEventListener('click', function() {
  if (p2State.selId) p2removeBox(p2State.selId);
});


document.getElementById('p2-list-data').addEventListener('input', function() {
  autoTuneListFromCurrentInput();
  p2render();
});

document.getElementById('p2-list-y').addEventListener('input', function(e) {
  document.getElementById('p2-list-y-v').textContent = e.target.value;
  p2render();
});

document.getElementById('p2-school-font').addEventListener('change', async function(e) {
  var fd = FONTS.find(function(f) { return f.f === e.target.value; });
  var fw = document.getElementById('p2-school-bold').classList.contains('on') ? (fd ? fd.w : 700) : 400;
  await forceLoadFont(e.target.value, fw, +document.getElementById('p2-school-size').value);
  p2render();
});

document.getElementById('p2-school-size').addEventListener('input', function(e) {
  document.getElementById('p2-school-size-v').textContent = e.target.value;
  p2render();
});

document.getElementById('p2-school-color').addEventListener('input', function() { p2render(); });

document.getElementById('p2-school-bold').addEventListener('click', async function() {
  this.classList.toggle('on');
  var family = document.getElementById('p2-school-font').value;
  var fd = FONTS.find(function(f) { return f.f === family; });
  var fw = this.classList.contains('on') ? (fd ? fd.w : 700) : 400;
  await forceLoadFont(family, fw, +document.getElementById('p2-school-size').value);
  p2render();
});

document.getElementById('p2-school-shadow').addEventListener('click', function() {
  this.classList.toggle('on');
  p2render();
});

document.getElementById('p2-name-font').addEventListener('change', async function(e) {
  var fd = FONTS.find(function(f) { return f.f === e.target.value; });
  var fw = document.getElementById('p2-name-bold').classList.contains('on') ? (fd ? fd.w : 700) : 400;
  await forceLoadFont(e.target.value, fw, +document.getElementById('p2-name-size').value);
  p2render();
});

document.getElementById('p2-name-size').addEventListener('input', function(e) {
  document.getElementById('p2-name-size-v').textContent = e.target.value;
  p2render();
});

document.getElementById('p2-name-color').addEventListener('input', function() { p2render(); });

document.getElementById('p2-name-bold').addEventListener('click', async function() {
  this.classList.toggle('on');
  var family = document.getElementById('p2-name-font').value;
  var fd = FONTS.find(function(f) { return f.f === family; });
  var fw = this.classList.contains('on') ? (fd ? fd.w : 700) : 400;
  await forceLoadFont(family, fw, +document.getElementById('p2-name-size').value);
  p2render();
});

document.getElementById('p2-name-shadow').addEventListener('click', function() {
  this.classList.toggle('on');
  p2render();
});

document.getElementById('p2-row-gap').addEventListener('input', function(e) {
  document.getElementById('p2-row-gap-v').textContent = e.target.value;
  p2render();
});

function p2setCol(n, skipRender) {
  document.getElementById('p2-col-count').value = n;
  document.getElementById('p2-col-2').className = 'col-btn' + (n === 2 ? ' active' : '');
  document.getElementById('p2-col-3').className = 'col-btn' + (n === 3 ? ' active' : '');
  if (!skipRender) p2render();
}

(function() {
  var dragging = null;
  var dragStartX, dragStartY, dragOrigX, dragOrigY, cropDragStart;

  function getCanvasPos(e) {
    var rect = p2Canvas.getBoundingClientRect();
    var scaleX = p2Canvas.width / rect.width;
    var scaleY = p2Canvas.height / rect.height;
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY};
  }

  function onDown(e) {
    var pos = getCanvasPos(e);
    var pad = 20;
    var bgHandle = hitBgHandle(p2State, p2Canvas.width, p2Canvas.height, pos.x, pos.y);
    if (p2State.cropMode && bgHandle) {
      var g = getBgGeometry(p2State, p2Canvas.width, p2Canvas.height);
      dragging = {type: 'bg-crop', handle: bgHandle};
      cropDragStart = {x: pos.x, y: pos.y, crop: g.crop, full: g.full};
      e.preventDefault();
      return;
    }
    var logoResizeHandle = hitLogoHandle(p2State.logoItems, p2State.selLogoFile, pos.x, pos.y);
    if (logoResizeHandle && logoResizeHandle !== 'move') {
      var selItem = p2State.logoItems.find(function(it) { return it.file === p2State.selLogoFile; });
      if (selItem) {
        var p = 8;
        var lr = selItem._rect;
        var cx = lr.x + lr.w / 2;
        var cy = lr.y + lr.h / 2;
        var hx = logoResizeHandle === 'l' || logoResizeHandle === 'tl' || logoResizeHandle === 'bl' ? lr.x - p : (logoResizeHandle === 'r' || logoResizeHandle === 'tr' || logoResizeHandle === 'br' ? lr.x + lr.w + p : cx);
        var hy = logoResizeHandle === 't' || logoResizeHandle === 'tl' || logoResizeHandle === 'tr' ? lr.y - p : (logoResizeHandle === 'b' || logoResizeHandle === 'bl' || logoResizeHandle === 'br' ? lr.y + lr.h + p : cy);
        dragging = {type: 'logo-resize', item: selItem, handle: logoResizeHandle, origSize: selItem.size, origW: lr.w, origH: lr.h, centerX: cx, centerY: cy, origHandleDist: Math.sqrt(Math.pow(hx - cx, 2) + Math.pow(hy - cy, 2))};
        e.preventDefault();
        return;
      }
    }
    var textResizeHandle = hitTextHandle(p2State.boxes, p2State.selId, pos.x, pos.y);
    if (textResizeHandle) {
      var selBox = p2State.boxes.find(function(b) { return b.id === p2State.selId; });
      if (selBox && selBox._rect) {
        var tr = selBox._rect;
        var tcx = tr.x + tr.w / 2;
        var tcy = tr.y + tr.h / 2;
        var thx = textResizeHandle === 'l' || textResizeHandle === 'tl' || textResizeHandle === 'bl' ? tr.x - 12 : (textResizeHandle === 'r' || textResizeHandle === 'tr' || textResizeHandle === 'br' ? tr.x + tr.w + 12 : tcx);
        var thy = textResizeHandle === 't' || textResizeHandle === 'tl' || textResizeHandle === 'tr' ? tr.y - 12 : (textResizeHandle === 'b' || textResizeHandle === 'bl' || textResizeHandle === 'br' ? tr.y + tr.h + 12 : tcy);
        dragging = {type: 'text-resize', box: selBox, handle: textResizeHandle, origSize: selBox.size, origHandleDist: Math.sqrt(Math.pow(thx - tcx, 2) + Math.pow(thy - tcy, 2)), centerX: tcx, centerY: tcy};
        e.preventDefault();
        return;
      }
    }
    for (var i = p2State.logoItems.length - 1; i >= 0; i--) {
      var item = p2State.logoItems[i];
      if (!item.active || !item._rect) continue;
      var r = item._rect;
      if (pos.x >= r.x - pad && pos.x <= r.x + r.w + pad && pos.y >= r.y - pad && pos.y <= r.y + r.h + pad) {
        dragging = item;
        dragStartX = pos.x; dragStartY = pos.y;
        dragOrigX = item.posX; dragOrigY = item.posY;
        p2State.selLogoFile = item.file;
        p2render();
        e.preventDefault();
        return;
      }
    }
    var hit = hitTestBoxes(p2State.boxes, pos.x, pos.y);
    if (hit) {
      dragging = hit;
      dragStartX = pos.x; dragStartY = pos.y;
      dragOrigX = hit.posX; dragOrigY = hit.posY;
      p2State.selId = hit.id;
      p2State.bgSelected = false;
      p2updatePanel();
      p2render();
      e.preventDefault();
      return;
    }
    if (bgHandle) {
      p2State.bgSelected = true;
      p2State.selId = null;
      p2State.selLogoFile = null;
      p2updatePanel();
      // 배경 세부 조정 패널 자동 열기
      var detailEl = document.getElementById('p2-bg-detail');
      if (detailEl && detailEl.style.display === 'none') {
        toggleCollapse('p2-bg-detail', 'p2-bg-detail-toggle');
      }
      // 이미지 위치는 슬라이더로만 조정 — 클릭+드래그로 옮기는 기능은 제거됨
      if (bgHandle !== 'move') {
        p2State.cropMode = true;
        var g2 = getBgGeometry(p2State, p2Canvas.width, p2Canvas.height);
        dragging = {type: 'bg-resize', handle: bgHandle};
        cropDragStart = {x: pos.x, y: pos.y, scale: p2State.bgTransform.scale || 100, posX: p2State.bgTransform.posX || 0, posY: p2State.bgTransform.posY || 0, rect: g2.cropRect};
      }
      p2render();
      e.preventDefault();
      return;
    }
    p2State.selId = null;
    p2State.selLogoFile = null;
    p2State.bgSelected = false;
    p2State.cropMode = false;
    p2updatePanel();
    p2render();
  }

  function onMove(e) {
    if (!dragging) return;
    var pos = getCanvasPos(e);
    var W = p2Canvas.width, H = p2Canvas.height;
    if (dragging.type === 'logo-resize') {
      var dx = pos.x - dragging.centerX;
      var dy = pos.y - dragging.centerY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var ratio = dragging.origHandleDist > 0 ? dist / dragging.origHandleDist : 1;
      dragging.item.size = Math.max(2, Math.min(60, dragging.origSize * ratio));
      renderLogoRows(document.getElementById('p2-logo-rows'), p2State.logoItems, p2render);
      p2render();
      e.preventDefault();
      return;
    }
    if (dragging.type === 'text-resize') {
      var dx = pos.x - dragging.centerX;
      var dy = pos.y - dragging.centerY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var ratio = dragging.origHandleDist > 0 ? dist / dragging.origHandleDist : 1;
      dragging.box.size = Math.max(8, Math.min(200, Math.round(dragging.origSize * ratio)));
      p2updatePanel();
      p2render();
      e.preventDefault();
      return;
    }
    if (dragging.type === 'bg-crop') {
      applyCropDrag(p2State, dragging.handle, cropDragStart, pos, W, H);
      updateBgControls('p2', p2State);
    } else if (dragging.type === 'bg-resize') {
      applyBgResize(p2State, dragging.handle, cropDragStart, pos);
      updateBgControls('p2', p2State);
    } else {
      dragging.posX = Math.max(0, Math.min(100, dragOrigX + ((pos.x - dragStartX) / W) * 100));
      dragging.posY = Math.max(0, Math.min(100, dragOrigY + ((pos.y - dragStartY) / H) * 100));
    }
    p2render();
    e.preventDefault();
  }

  function onUp() { dragging = null; cropDragStart = null; }

  function onHover(e) {
    if (dragging) return;
    var pos = getCanvasPos(e);
    var logoHandle = hitLogoHandle(p2State.logoItems, p2State.selLogoFile, pos.x, pos.y);
    if (logoHandle) { p2Canvas.style.cursor = cursorForHandle(logoHandle); return; }
    var textHandle = hitTextHandle(p2State.boxes, p2State.selId, pos.x, pos.y);
    if (textHandle) { p2Canvas.style.cursor = cursorForHandle(textHandle); return; }
    var handle = hitBgHandle(p2State, p2Canvas.width, p2Canvas.height, pos.x, pos.y);
    p2Canvas.style.cursor = cursorForHandle(handle);
  }

  p2Canvas.addEventListener('mousedown', onDown);
  p2Canvas.addEventListener('mousemove', function(e) { onHover(e); onMove(e); });
  p2Canvas.addEventListener('mouseup', onUp);
  p2Canvas.addEventListener('touchstart', onDown, {passive: false});
  p2Canvas.addEventListener('touchmove', onMove, {passive: false});
  p2Canvas.addEventListener('touchend', onUp);
})();

document.getElementById('p2-dl').addEventListener('click', function() {
  var prevSel = p2State.selId;
  var prevLogo = p2State.selLogoFile;
  var prevCrop = p2State.cropMode;
  var prevBgSel = p2State.bgSelected;
  p2State.selId = null;
  p2State.selLogoFile = null;
  p2State.cropMode = false;
  p2State.bgSelected = false;
  p2render();
  var link = document.createElement('a');
  var _lp2 = document.getElementById('p2-list-panel');
  var _lm2 = document.querySelector('#page-2 .left-panel');
  var _listActive = (_lp2 && _lp2.classList.contains('on')) || (_lm2 && _lm2.classList.contains('mode-list'));
  link.download = downloadFileName((_listActive && parseListData(document.getElementById('p2-list-data').value).length) ? '성적명단' : '이미지만들기');
  link.href = p2Canvas.toDataURL('image/png');
  link.click();
  p2State.selId = prevSel;
  p2State.selLogoFile = prevLogo;
  p2State.cropMode = prevCrop;
  p2State.bgSelected = prevBgSel;
  p2render();
});
document.getElementById('p2-ig').addEventListener('click', function() {
  var prevSel = p2State.selId;
  var prevLogo = p2State.selLogoFile;
  var prevCrop = p2State.cropMode;
  var prevBgSel = p2State.bgSelected;
  p2State.selId = null;
  p2State.selLogoFile = null;
  p2State.cropMode = false;
  p2State.bgSelected = false;
  p2render();
  var dataUrl = getCleanP2ImageDataUrl('image/jpeg', 0.92);
  var link = document.createElement('a');
  link.download = downloadFileName('이미지만들기') + '.jpg';
  link.href = dataUrl;
  link.click();
  p2State.selId = prevSel;
  p2State.selLogoFile = prevLogo;
  p2State.cropMode = prevCrop;
  p2State.bgSelected = prevBgSel;
  p2render();
});

function toggleMobileMenu() {
  var sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

function switchPage(num) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById('page-' + num).classList.add('active');
  document.querySelectorAll('.sidebar-item').forEach(function(n) { n.classList.remove('active'); });
  var nav = document.getElementById('nav-p' + num);
  if (nav) nav.classList.add('active');
  var sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');
  if (num === 2) p2render();
}

function togglePanel(type) {
  var panel = document.getElementById(type === 'blog' ? 'blog-left-panel' : 'image-left-panel');
  var btn   = document.getElementById(type === 'blog' ? 'blog-panel-toggle' : 'image-panel-toggle');
  var collapsed = panel.classList.toggle('collapsed');
  btn.textContent = collapsed ? '▶' : '◀';
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.sidebar-item').forEach(function(i) { i.classList.remove('active'); });
  if (id === 'list' || id === 2) {
    document.getElementById('page-2').classList.add('active');
    var nav = document.getElementById('nav-list');
    if (nav) nav.classList.add('active');
    var lp = document.querySelector('#page-2 .left-panel');
    if (lp) { lp.classList.remove('mode-free'); lp.classList.add('mode-list'); }
    p2State.templateKey = 'list';
    p2render();
  } else if (id === 'free') {
    document.getElementById('page-2').classList.add('active');
    var nav = document.getElementById('nav-free');
    if (nav) nav.classList.add('active');
    var lp = document.querySelector('#page-2 .left-panel');
    if (lp) { lp.classList.remove('mode-list'); lp.classList.add('mode-free'); }
    p2State.templateKey = 'free';
    p2render();
  } else if (id === 'blog') {
    document.getElementById('page-blog').classList.add('active');
    var navBlog = document.getElementById('nav-blog');
    if (navBlog) navBlog.classList.add('active');
    initAcademyProfile();
    blogGoStep(blogState.step || 1);
  } else if (id === 'monitor') {
    document.getElementById('page-monitor').classList.add('active');
    var navMon = document.getElementById('nav-monitor');
    if (navMon) navMon.classList.add('active');
    monRenderList();
  }
}

function initListToggle() {
  var btn = document.getElementById('p2-list-toggle');
  var panel = document.getElementById('p2-list-panel');
  if (!btn || !panel) return;
  btn.addEventListener('click', function() {
    var on = !panel.classList.contains('on');
    panel.classList.toggle('on', on);
    btn.textContent = on ? '명단입력 닫기' : '명단입력하기';
    p2render();
  });
}

function initTemplateControls() {
  var grid = document.getElementById('p2-template-grid');
  if (!grid) return;
  grid.querySelectorAll('.template-card').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var key = btn.dataset.template || 'free';
      var lp = document.querySelector('#page-2 .left-panel');
      if (lp) { lp.classList.toggle('mode-list', key === 'list'); lp.classList.toggle('mode-free', key === 'free'); }
      p2applyTemplate(key);
    });
  });
}

function initExamplePanel() {
  var btn = document.getElementById('example-toggle');
  var panel = document.getElementById('example-panel');
  if (!btn || !panel) return;
  btn.addEventListener('click', function() {
    var on = !panel.classList.contains('on');
    panel.classList.toggle('on', on);
    btn.classList.toggle('on', on);
    btn.textContent = on ? '예시 닫기' : '결과 예시 보기';
  });
}

function initCanvasSelectionClear() {
  document.addEventListener('mousedown', function(e) {
    if (!p2Canvas || e.target === p2Canvas) return;
    if (p2State.bgSelected || p2State.cropMode) {
      p2State.bgSelected = false;
      p2State.cropMode = false;
      p2Canvas.style.cursor = 'default';
      p2render();
    }
  });
}


function setAiStatus(msg, type) {
  var el = document.getElementById('ai-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'ai-status' + (type ? ' ' + type : '');
}


function getCleanP2ImageDataUrl(mimeType, quality) {
  if (!p2Canvas) return null;
  var prevSel = p2State.selId;
  var prevBgSel = p2State.bgSelected;
  p2State.selId = null;
  p2State.bgSelected = false;
  p2render();
  var url = p2Canvas.toDataURL(mimeType || 'image/jpeg', quality || 0.92);
  p2State.selId = prevSel;
  p2State.bgSelected = prevBgSel;
  p2render();
  return url;
}

// ── 설정 페이지에서 편집하는 인스타그램 스타일 지시 (기본값) ────────
var DEFAULT_PROMO_TEMPLATE = [
  '학원 성과(합격·성적우수)를 인스타그램에 자연스럽게 홍보하는 문구를 작성합니다.',
  '',
  '말투: 학부모가 신뢰할 수 있는 차분하고 진중한 톤 유지',
  '성과는 과장 없이 사실 그대로 전달',
  '"대박", "놀라운", "충격" 같은 자극적인 표현은 사용하지 않기',
  '상담 유도 문구는 자연스럽게 마지막에 한 번만',
  '실명이나 내용과 관계없는 지역명 나열 금지'
].join('\n');

// ── 코드 고정 기술 프롬프트 (자동 조립) ──────────────────────────
var PROMO_TECHNICAL = '이 이미지는 학원의 성적우수자·합격자 명단을 담은 인스타그램 게시물용 이미지입니다.\n이미지를 분석하여 학원 인스타그램 홍보 게시물 문구를 작성해주세요.\n\n이미지에서 파악할 내용: 학원명, 합격/성적우수 학생 정보, 시험 종류·시즌\n톤: {{tone}}\n{{extra}}\n## [원장님 스타일 지시]\n{{USER_STYLE}}\n\n아래 형식을 정확히 따르세요:\n\n[훅]\n첫 눈에 멈추는 강렬한 한두 문장 (이모지 1~2개 활용 가능, 50자 이내)\n\n[본문]\n학원 성과를 자연스럽게 드러내고 학부모·학생의 신뢰를 얻는 내용\n(200자 이내, 줄바꿈 활용, 상담 유도 문구 포함)\n\n[해시태그]\n관련 해시태그 5~8개 (학원명, 지역, 과목, 성과 관련 키워드)\n\n반드시 한국어로 작성하고 위 형식 라벨([훅], [본문], [해시태그])을 그대로 사용하세요.';

function buildPromoPrompt() {
  var tone = document.getElementById('ai-tone') ? document.getElementById('ai-tone').value : '학부모가 신뢰할 수 있는 차분한 톤';
  var extra = document.getElementById('ai-extra') ? document.getElementById('ai-extra').value.trim() : '';
  var userStyle = localStorage.getItem('mtt_promo_prompt') || DEFAULT_PROMO_TEMPLATE;
  return PROMO_TECHNICAL
    .replace('{{tone}}', tone)
    .replace('{{extra}}', extra ? '추가 요청: ' + extra + '\n' : '')
    .replace('{{USER_STYLE}}', userStyle);
}

function promoCharLength(text) {
  return Array.from(String(text || '')).length;
}

function stripPromoLabels(text) {
  return (text || '')
    .replace(/^\s*[\[【\(]?(훅|Hook|HOOK)[\]】\)]?\s*[:\-]?\s*/gm, '')
    .replace(/^\s*[\[【\(]?(본문|Body|BODY)[\]】\)]?\s*[:\-]?\s*/gm, '')
    .replace(/^\s*[\[【\(]?(해시태그|Hashtag|HASHTAG)[\]】\)]?\s*[:\-]?\s*/gm, '')
    .replace(/^(Step|STEP)\s*\d+[:\-\s]*/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\*\*/g, '').replace(/^#+\s*/gm, '')
    .trim();
}

function splitPromoText(text) {
  var hook = '', body = '', tags = '';
  var hookMatch = text.match(/[\[【\(]?훅[\]】\)]?\s*[:\-]?\s*([\s\S]*?)(?=[\[【\(]?본문[\]】\)]?|[\[【\(]?해시태그[\]】\)]?|$)/i);
  var bodyMatch = text.match(/[\[【\(]?본문[\]】\)]?\s*[:\-]?\s*([\s\S]*?)(?=[\[【\(]?해시태그[\]】\)]?|$)/i);
  var tagsMatch = text.match(/[\[【\(]?해시태그[\]】\)]?\s*[:\-]?\s*([\s\S]*?)$/i);
  if (hookMatch) hook = hookMatch[1].trim();
  if (bodyMatch) body = bodyMatch[1].trim();
  if (tagsMatch) tags = tagsMatch[1].trim();
  return { hook: hook, body: body, tags: tags };
}

function sentenceEndIndex(text, maxLen) {
  var endings = /[.!?。！？\n]/g;
  var last = -1;
  var m;
  while ((m = endings.exec(text)) !== null) {
    if (m.index + 1 <= maxLen) last = m.index + 1;
    else break;
  }
  return last;
}

function shortenHookBySentence(text) {
  if (promoCharLength(text) <= 30) return text;
  var idx = sentenceEndIndex(text, 30);
  if (idx > 0) return text.substring(0, idx).trim();
  var chars = Array.from(text);
  return chars.slice(0, 30).join('');
}

function keepCompleteBody(text) {
  if (promoCharLength(text) <= 150) return text;
  var idx = sentenceEndIndex(text, 150);
  if (idx > 0) return text.substring(0, idx).trim();
  var chars = Array.from(text);
  return chars.slice(0, 150).join('') + '…';
}

function normalizePromoParts(text) {
  var parts = splitPromoText(text);
  if (!parts.hook && !parts.body) {
    var lines = text.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
    parts.hook = lines[0] || '';
    parts.body = lines.slice(1, -1).join('\n') || '';
    parts.tags = lines[lines.length - 1] || '';
  }
  parts.hook = shortenHookBySentence(parts.hook);
  parts.body = keepCompleteBody(parts.body);
  return parts;
}

function formatPromoResult(text) {
  var parts = normalizePromoParts(text);
  var result = '';
  if (parts.hook) result += parts.hook + '\n\n';
  if (parts.body) result += parts.body + '\n\n';
  if (parts.tags) result += parts.tags;
  return result.trim();
}

function hasBrokenEnding(text) {
  var t = text.trim();
  if (!t) return true;
  return !/[.!?。！？…\w가-힣]$/.test(t);
}

function getPromoValidation(text) {
  var parts = normalizePromoParts(text);
  return {
    hookOk: promoCharLength(parts.hook) <= 30 && parts.hook.length > 0,
    bodyOk: promoCharLength(parts.body) <= 150 && parts.body.length > 0,
    tagsOk: parts.tags.includes('#'),
    hookLen: promoCharLength(parts.hook),
    bodyLen: promoCharLength(parts.body)
  };
}

function isUsablePromoText(text) {
  var v = getPromoValidation(text);
  return v.hookOk && v.bodyOk && v.tagsOk;
}

async function callClaudePromo(imageDataUrl, prompt) {
  var b64 = imageDataUrl.split(',')[1];
  var mimeType = imageDataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
  try {
    var data = await claudeProxyCall({
      model: getModel('claude'),
      max_tokens: 800,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: b64 } },
        { type: 'text', text: prompt }
      ]}]
    });
    var text = data.content && data.content[0] && data.content[0].text;
    if (text && text.trim()) return { ok: true, text: text, model: getModel('claude') };
    return { ok: false, error: '빈 응답' };
  } catch(e) { return { ok: false, error: e.message }; }
}

async function callAiPromo(imageDataUrl, prompt) {
  return callClaudePromo(imageDataUrl, prompt);
}

function initAiPromoControls() {
  var genBtn = document.getElementById('ai-generate');
  var copyBtn = document.getElementById('ai-copy');
  var resultEl = document.getElementById('ai-result');
  if (!genBtn) return;

  genBtn.addEventListener('click', async function() {
    setAiStatus('API 키 로딩 중…');
    genBtn.disabled = true;
    try {
      setAiStatus('이미지 캡처 중…');
      var imageDataUrl = getCleanP2ImageDataUrl('image/jpeg', 0.92);
      if (!imageDataUrl) {
        setAiStatus('이미지를 먼저 로드해주세요.', 'err');
        return;
      }
      await useCredit('image_promo');
      var prompt = buildPromoPrompt();
      setAiStatus('홍보문구 생성 중… (최대 30초 소요)');
      var result = await callAiPromo(imageDataUrl, prompt);
      if (!result.ok) {
        setAiStatus('오류: ' + result.error, 'err');
        return;
      }
      var formatted = formatPromoResult(result.text);
      if (resultEl) resultEl.value = formatted;
      setAiStatus('생성 완료', 'ok');
    } catch(e) {
      setAiStatus('오류: ' + e.message, 'err');
    } finally {
      genBtn.disabled = false;
    }
  });

  if (copyBtn && resultEl) {
    copyBtn.addEventListener('click', function() {
      var text = resultEl.value;
      if (!text) { setAiStatus('복사할 내용이 없습니다.', 'err'); return; }
      navigator.clipboard.writeText(text).then(function() {
        setAiStatus('클립보드에 복사되었습니다.', 'ok');
      }).catch(function() {
        resultEl.select();
        document.execCommand('copy');
        setAiStatus('클립보드에 복사되었습니다.', 'ok');
      });
    });
  }
}

// ── INIT ──
buildFontSelect(document.getElementById('p2-ed-font'));
buildFontSelect(document.getElementById('p2-school-font'));
buildFontSelect(document.getElementById('p2-name-font'));
p2updatePanel();
initBgControls('p2', p2State, p2render);
initListToggle();
initTemplateControls();
initExamplePanel();
initCanvasSelectionClear();
initAiPromoControls();

loadImgManifest('p2-img-grid', function(img, name) { setBackground(p2State, img, 'p2', p2render, name); }, 'p2-bg-file');
initLogoSection('p2-logo-rows', p2State.logoItems, p2render);

document.fonts.ready.then(function() { p2render(); });
showPage('list');

/* ── 경쟁학원 모니터링 ── */
function toggleCollapse(contentId, btnId) {
  var el = document.getElementById(contentId);
  var btn = document.getElementById(btnId);
  if (!el) return;
  var open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  if (btn) btn.textContent = btn.textContent.replace(open ? '▴' : '▾', open ? '▾' : '▴');
}

function showToast(msg, duration) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(function() { t.style.display = 'none'; }, duration || 2000);
}


// Undo/Redo
var p2History = [];
var p2HistoryIdx = -1;
var p2HistoryPause = false;

function p2snapshot() {
  if (!p2History || p2HistoryPause) return;
  var snap = {
    boxes: JSON.parse(JSON.stringify(p2State.boxes)),
    bgTransform: JSON.parse(JSON.stringify(p2State.bgTransform)),
    selId: p2State.selId,
    templateKey: p2State.templateKey
  };
  if (p2HistoryIdx < p2History.length - 1) {
    p2History = p2History.slice(0, p2HistoryIdx + 1);
  }
  p2History.push(snap);
  if (p2History.length > 30) p2History.shift();
  p2HistoryIdx = p2History.length - 1;
}

function p2undo() {
  if (p2HistoryIdx <= 0) return;
  p2HistoryIdx--;
  var snap = p2History[p2HistoryIdx];
  p2HistoryPause = true;
  p2State.boxes = JSON.parse(JSON.stringify(snap.boxes));
  p2State.bgTransform = JSON.parse(JSON.stringify(snap.bgTransform));
  p2State.selId = snap.selId;
  p2HistoryPause = false;
  p2updatePanel && p2updatePanel();
  p2render();
  showToast('실행 취소');
}

function p2redo() {
  if (p2HistoryIdx >= p2History.length - 1) return;
  p2HistoryIdx++;
  var snap = p2History[p2HistoryIdx];
  p2HistoryPause = true;
  p2State.boxes = JSON.parse(JSON.stringify(snap.boxes));
  p2State.bgTransform = JSON.parse(JSON.stringify(snap.bgTransform));
  p2State.selId = snap.selId;
  p2HistoryPause = false;
  p2updatePanel && p2updatePanel();
  p2render();
  showToast('다시 실행');
}

document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); p2undo(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); p2redo(); }
});

document.getElementById('p2-undo-btn').addEventListener('click', p2undo);
document.getElementById('p2-redo-btn').addEventListener('click', p2redo);

// Autosave
// dev/beta가 같은 도메인 하위경로라 localStorage가 공유되므로, site별로 키를 분리한다 (common.js의 _authKey와 동일 패턴)
var AUTO_SAVE_KEY = 'mtt_p2_autosave_' + ((typeof window.SITE_ID === 'string' && window.SITE_ID) ? window.SITE_ID : 'local');

function p2autosave() {
  try {
    var data = {
      boxes: p2State.boxes.map(function(b) {
        return {id:b.id,text:b.text,font:b.font,size:b.size,color:b.color,bold:b.bold,shadow:b.shadow,posX:b.posX,posY:b.posY};
      }),
      bgTransform: p2State.bgTransform,
      templateKey: p2State.templateKey,
      ts: Date.now()
    };
    localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(data));
  } catch(e) {}
}

function p2loadAutosave() {
  try {
    var raw = localStorage.getItem(AUTO_SAVE_KEY);
    if (!raw) return;
    var data = JSON.parse(raw);
    var age = (Date.now() - (data.ts || 0)) / 1000 / 60;
    if (age > 60 * 24) return;
    if (data.boxes && data.boxes.length) {
      p2State.boxes = data.boxes.map(function(b) { return Object.assign({_rect: null}, b); });
      p2State.nextNum = Math.max.apply(null, p2State.boxes.map(function(b) { return parseInt(b.id.replace(/\D/g,'')) || 0; })) + 1;
    }
    if (data.bgTransform) p2State.bgTransform = data.bgTransform;
  } catch(e) {}
}

p2loadAutosave();
p2render();

// Quick guide visibility
(function() {
  var cards = document.querySelectorAll('.template-card');
  var guide = document.getElementById('quick-guide');
  cards.forEach(function(card) {
    card.addEventListener('click', function() {
      if (guide) guide.style.display = card.dataset.template === 'list' ? 'block' : 'none';
    });
  });
})();

// ── 인스타그램 게시 ──────────────────────────────────────────────────

var IG_GITHUB_OWNER = 'Olympiadedu';
var IG_GITHUB_REPO  = 'MarketingTool';
var IG_GITHUB_BRANCH = 'main';

function igGetCreds() {
  return {
    userId:      localStorage.getItem('mtt_ig_user_id')    || '',
    token:       localStorage.getItem('mtt_ig_token')      || '',
    githubToken: localStorage.getItem('mtt_github_token')  || ''
  };
}

function igSetStatus(msg, type) {
  var el = document.getElementById('ig-post-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'ai-status' + (type ? ' ' + type : '');
}

function igShowSection() {
  var sec = document.getElementById('ig-post-section');
  if (!sec) return;
  if (window.FEATURE_FLAGS && window.FEATURE_FLAGS.instagram === false) { sec.style.display = 'none'; return; }
  var creds = igGetCreds();
  sec.style.display = (creds.userId && creds.token && creds.githubToken) ? '' : 'none';
}

async function igUploadToGitHub(blob) {
  var creds = igGetCreds();
  var fileName = 'temp/ig_' + Date.now() + '.jpg';
  var apiUrl = 'https://api.github.com/repos/' + IG_GITHUB_OWNER + '/' + IG_GITHUB_REPO + '/contents/' + fileName;

  // Blob → base64
  var base64 = await new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() { resolve(reader.result.split(',')[1]); };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  var res = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + creds.githubToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: 'temp: instagram upload',
      content: base64,
      branch: IG_GITHUB_BRANCH
    })
  });
  if (!res.ok) {
    var err = await res.json().catch(function() { return {}; });
    throw new Error('GitHub 업로드 실패: ' + (err.message || res.status));
  }
  var data = await res.json();
  var sha = data.content && data.content.sha;
  var rawUrl = 'https://raw.githubusercontent.com/' + IG_GITHUB_OWNER + '/' + IG_GITHUB_REPO + '/' + IG_GITHUB_BRANCH + '/' + fileName;
  return { url: rawUrl, sha: sha, path: fileName };
}

async function igDeleteFromGitHub(path, sha) {
  var creds = igGetCreds();
  var apiUrl = 'https://api.github.com/repos/' + IG_GITHUB_OWNER + '/' + IG_GITHUB_REPO + '/contents/' + path;
  await fetch(apiUrl, {
    method: 'DELETE',
    headers: {
      'Authorization': 'Bearer ' + creds.githubToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: 'temp: cleanup instagram upload',
      sha: sha,
      branch: IG_GITHUB_BRANCH
    })
  });
}

async function igCreateContainer(userId, token, imageUrl, caption) {
  var params = new URLSearchParams({
    image_url: imageUrl,
    caption: caption || '',
    access_token: token
  });
  var res = await fetch('https://graph.instagram.com/v19.0/' + userId + '/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  var data = await res.json();
  if (!res.ok || data.error) throw new Error('컨테이너 생성 실패: ' + (data.error && data.error.message || res.status));
  return data.id;
}

async function igPublishContainer(userId, token, creationId) {
  var params = new URLSearchParams({
    creation_id: creationId,
    access_token: token
  });
  var res = await fetch('https://graph.instagram.com/v19.0/' + userId + '/media_publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  var data = await res.json();
  if (!res.ok || data.error) throw new Error('게시 실패: ' + (data.error && data.error.message || res.status));
  return data.id;
}

async function igPostCurrentImage() {
  var creds = igGetCreds();
  if (!creds.userId || !creds.token || !creds.githubToken) {
    igSetStatus('⚠️ 설정 → 인스타그램 연동에서 토큰/ID/GitHub 토큰을 먼저 입력하세요.', 'err');
    return;
  }

  var btn = document.getElementById('ig-post-btn');
  if (btn) btn.disabled = true;
  var ghFile = null;

  try {
    igSetStatus('이미지 캡처 중…');
    var prevSel = p2State.selId;
    var prevLogo = p2State.selLogoFile;
    var prevCrop = p2State.cropMode;
    var prevBgSel = p2State.bgSelected;
    p2State.selId = null; p2State.selLogoFile = null;
    p2State.cropMode = false; p2State.bgSelected = false;
    p2render();
    var blob = await canvasToBlob(p2Canvas);
    p2State.selId = prevSel; p2State.selLogoFile = prevLogo;
    p2State.cropMode = prevCrop; p2State.bgSelected = prevBgSel;
    p2render();

    igSetStatus('GitHub에 이미지 업로드 중…');
    ghFile = await igUploadToGitHub(blob);

    // GitHub CDN 캐시 반영 대기
    await new Promise(function(r) { setTimeout(r, 4000); });

    var caption = (document.getElementById('ai-result') || {}).value || '';
    igSetStatus('인스타그램 미디어 컨테이너 생성 중…');
    var creationId = await igCreateContainer(creds.userId, creds.token, ghFile.url, caption);

    // Instagram이 이미지 처리 완료할 때까지 대기 (최대 30초)
    igSetStatus('인스타그램 이미지 처리 중… (최대 30초)');
    var ready = false;
    for (var i = 0; i < 10; i++) {
      await new Promise(function(r) { setTimeout(r, 3000); });
      var statusRes = await fetch('https://graph.instagram.com/v19.0/' + creationId + '?fields=status_code&access_token=' + creds.token);
      var statusData = await statusRes.json();
      var statusCode = statusData.status_code;
      if (statusCode === 'FINISHED') { ready = true; break; }
      if (statusCode === 'ERROR') throw new Error('Instagram 이미지 처리 실패 (ERROR)');
      igSetStatus('인스타그램 이미지 처리 중… (' + (i + 1) * 3 + '초)');
    }
    if (!ready) throw new Error('Instagram 이미지 처리 시간 초과. 잠시 후 다시 시도하세요.');

    igSetStatus('게시 중…');
    var postId = await igPublishContainer(creds.userId, creds.token, creationId);

    igSetStatus('✅ 게시 완료! 임시 파일 정리 중…', 'ok');
    await igDeleteFromGitHub(ghFile.path, ghFile.sha);
    igSetStatus('✅ 게시 완료!', 'ok');
  } catch(e) {
    // 게시 실패해도 임시 파일 정리 시도
    if (ghFile) igDeleteFromGitHub(ghFile.path, ghFile.sha).catch(function() {});
    igSetStatus('❌ ' + e.message, 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

(function() {
  igShowSection();

  var postBtn = document.getElementById('ig-post-btn');
  if (postBtn) postBtn.addEventListener('click', igPostCurrentImage);

})();

