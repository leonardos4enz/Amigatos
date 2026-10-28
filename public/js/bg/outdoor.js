/* Amigatos — fondos de exteriores (pixel art procedural)
 * Registra escenas en window.CatBG: jardin, playa, noche, cerezos, nieve, espacio, solyluna.
 * Todo se diseña sobre un ancho lógico de 96 px; el alto (H) varía y la composición se ancla a
 * una línea de suelo (gy) proporcional. El gato va abajo al centro: ahí el suelo es tranquilo.
 */
(function () {
  'use strict';
  if (!window.CatBG) return;

  var BW = 96;                 // ancho lógico de diseño
  var INK = '#2b1a33';         // tinta ciruela (igual que cat-art)
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var PI = Math.PI;

  /* ------------------------------------------------------------------ */
  /* utilidades                                                          */
  /* ------------------------------------------------------------------ */
  function th(x, y) { return (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function R(c, x, y, w, h, col) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    if (w <= 0 || h <= 0) return;
    c.fillStyle = col; c.fillRect(x, y, w, h);
  }
  function P(c, x, y, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), 1, 1); }

  var rgbCache = {};
  function rgb(h) {
    var r = rgbCache[h]; if (r) return r;
    var n = parseInt(h.slice(1), 16);
    return (rgbCache[h] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  }
  function hex(r, g, b) {
    return '#' + ((1 << 24) | (clamp(Math.round(r), 0, 255) << 16) | (clamp(Math.round(g), 0, 255) << 8) |
      clamp(Math.round(b), 0, 255)).toString(16).slice(1);
  }
  function mix(a, b, k) {
    var A = rgb(a), B = rgb(b);
    return hex(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k);
  }
  function mixRGB(A, B, k) { return [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]; }
  function stopsRGB(stops, f) {
    var n = stops.length, p = clamp(f, 0, 1) * (n - 1), i = Math.min(n - 2, Math.floor(p));
    return mixRGB(rgb(stops[i]), rgb(stops[i + 1]), p - i);
  }

  // disco pixelado (r entero), opcionalmente solo en patrón de damero (parity 0/1)
  function disc(c, cx, cy, r, col, parity) {
    cx = Math.round(cx); cy = Math.round(cy);
    c.fillStyle = col;
    for (var dy = -r; dy <= r; dy++) {
      var hw = Math.floor(Math.sqrt((r + 0.5) * (r + 0.5) - dy * dy));
      if (parity === undefined) c.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
      else for (var x = -hw; x <= hw; x++) if (((cx + x + cy + dy) & 1) === parity) c.fillRect(cx + x, cy + dy, 1, 1);
    }
  }
  function ellipse(c, cx, cy, rx, ry, col) {
    cx = Math.round(cx); cy = Math.round(cy);
    c.fillStyle = col;
    for (var dy = -ry; dy <= ry; dy++) {
      var q = 1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5));
      var hw = Math.floor((rx + 0.5) * Math.sqrt(Math.max(0, q)));
      c.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
    }
  }
  // fila con dither ordenado entre a y b (k = proporción de b)
  function rowDither(c, x0, y, w, a, b, k) {
    if (k <= 1 / 32) { R(c, x0, y, w, 1, a); return; }
    if (k >= 31 / 32) { R(c, x0, y, w, 1, b); return; }
    R(c, x0, y, w, 1, a);
    c.fillStyle = b;
    for (var x = x0; x < x0 + w; x++) if (th(x, y) < k) c.fillRect(x, y, 1, 1);
  }
  // degradado vertical por bandas con transición tramada
  function vgrad(c, x0, y0, w, h, stops, soft) {
    var n = stops.length;
    soft = soft || 0.7;
    for (var y = 0; y < h; y++) {
      var f = h > 1 ? y / (h - 1) : 0, p = f * (n - 1);
      var i = Math.min(n - 2, Math.floor(p)), u = p - i;
      rowDither(c, x0, y0 + y, w, stops[i], stops[i + 1], clamp((u - 0.5) / soft + 0.5, 0, 1));
    }
  }
  // nube esponjosa: contorno, sombra y relleno desplazado hacia arriba
  function cloud(c, x, y, s, fill, shade, line) {
    function blob(g, col, dy) {
      disc(c, x + s, y + dy, s + g, col);
      disc(c, x + s * 2.3, y - Math.round(s * 0.6) + dy, Math.round(s * 1.25) + g, col);
      disc(c, x + s * 3.6, y + dy, s + g, col);
      R(c, x + s - g, y + dy, s * 2.6 + g * 2 + 1, s + 1 + g, col);
    }
    if (line) blob(1, line, 0);
    blob(0, shade, 0);
    blob(0, fill, -1);
  }
  // estrella de 4 puntas
  function sparkle(c, x, y, big, col, core) {
    P(c, x, y, core || col);
    P(c, x - 1, y, col); P(c, x + 1, y, col); P(c, x, y - 1, col); P(c, x, y + 1, col);
    if (big) { P(c, x - 2, y, col); P(c, x + 2, y, col); P(c, x, y - 2, col); P(c, x, y + 2, col); }
  }
  function groundY(H) { return H - clamp(Math.round(H * 0.3), 8, 44); }

  /* capas estáticas en caché (por escena y tamaño) */
  var cache = {}, cacheN = 0;
  function layer(key, W, H, fn) {
    var k = key + ':' + W + 'x' + H, cv = cache[k];
    if (!cv) {
      if (cacheN > 90) { cache = {}; cacheN = 0; }
      cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      var c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      fn(c, W, H);
      cache[k] = cv; cacheN++;
    }
    return cv;
  }

  // búfer para re-escalar cuando el canvas no mide 96 de ancho (miniaturas, etc.)
  var bufs = {};
  function buffer(H) {
    var b = bufs[H];
    if (!b) { b = bufs[H] = document.createElement('canvas'); b.width = BW; b.height = H; }
    return b;
  }

  function scene(def) {
    window.CatBG.register({
      id: def.id, label: def.label, emoji: def.emoji, animated: true,
      draw: function (ctx, w, h, t) {
        if (w === BW) { def.draw(ctx, BW, h, t); return; }
        var H = Math.max(16, Math.round(h * BW / w));
        var off = buffer(H), oc = off.getContext('2d');
        oc.imageSmoothingEnabled = false;
        oc.clearRect(0, 0, BW, H);
        def.draw(oc, BW, H, t);
        ctx.imageSmoothingEnabled = w < BW;
        ctx.drawImage(off, 0, 0, BW, H, 0, 0, w, h);
      }
    });
  }

  /* ================================================================== */
  /* 🌷 Jardín                                                           */
  /* ================================================================== */
  function jardinBack(c, W, H) {
    var gy = groundY(H);
    vgrad(c, 0, 0, W, gy, ['#8ccdec', '#a6dbf2', '#c6eaf6', '#e4f6f2']);
    var hb = clamp(Math.round(gy * 0.2), 3, 14), x, y;
    for (x = 0; x < W; x++) {               // colinas lejanas
      y = gy - Math.round(hb + hb * 0.45 * Math.sin(x * 0.07 + 0.5) + hb * 0.25 * Math.sin(x * 0.19 + 1.3));
      R(c, x, y, 1, gy - y, '#bfe5b5'); P(c, x, y, '#d6f0cc');
    }
    for (var i = 0; i < 6; i++) {           // arbolitos redondos lejanos
      var bx = Math.round(6 + hash(i + 40) * 84);
      if (bx > 34 && bx < 62) continue;
      var by = gy - Math.round(hb * 0.9 + hb * 0.45 * Math.sin(bx * 0.07 + 0.5) + hb * 0.25 * Math.sin(bx * 0.19 + 1.3));
      R(c, bx, by - 1, 1, 3, '#8f7a6a');
      disc(c, bx, by - 3, 2, '#93cf8e'); P(c, bx - 1, by - 4, '#b5e3a8');
    }
    for (x = 0; x < W; x++) {               // colinas cercanas
      y = gy - Math.round(hb * 0.45 + hb * 0.3 * Math.sin(x * 0.11 + 2.1));
      R(c, x, y, 1, gy - y, '#a6d99c'); P(c, x, y, '#c0e7b2');
    }
    // césped
    R(c, 0, gy, W, H - gy, '#98d48f');
    R(c, 0, gy, W, 1, '#b9e8aa');
    var mid = gy + Math.round((H - gy) * 0.45);
    for (y = mid; y < H; y++) rowDither(c, 0, y, W, '#98d48f', '#86c886', (y - mid) / Math.max(1, H - mid) * 0.9);
    for (i = 0; i < 26; i++) {
      x = Math.round(hash(i * 3.1) * W); y = gy + 3 + Math.round(hash(i * 7.7) * (H - gy - 4));
      if (y >= H) continue;
      P(c, x, y, '#72b874'); P(c, x - 1, y - 1, '#72b874'); P(c, x + 1, y - 1, '#7fc27e');
    }
    // cerca de madera
    var fh = clamp(Math.round(gy * 0.2), 5, 9), top = gy - fh, OUT = '#9c8290';
    R(c, 0, top + 1, W, 1, OUT); R(c, 0, top + 2, W, 1, '#f6ead6'); R(c, 0, top + 3, W, 1, '#dccab0');
    R(c, 0, gy - 3, W, 1, OUT); R(c, 0, gy - 2, W, 1, '#f6ead6'); R(c, 0, gy - 1, W, 1, '#dccab0');
    for (x = 1; x < W; x += 7) {
      R(c, x - 1, top, 1, fh + 2, OUT); R(c, x + 3, top, 1, fh + 2, OUT);
      P(c, x, top - 1, OUT); P(c, x + 2, top - 1, OUT); P(c, x + 1, top - 2, OUT);
      R(c, x, top, 3, fh + 2, '#fff8ec'); P(c, x + 1, top - 1, '#fff8ec');
      R(c, x + 2, top + 1, 1, fh + 1, '#eadcc4');
      P(c, x, gy + 1, '#7fc27e');
    }
    R(c, 0, gy + 1, W, 1, '#a9de9c');
  }
  function flower(c, x, by, L, dx, type, col, dark) {
    var STEM = '#4f9e57';
    for (var j = 0; j < L; j++) P(c, x + (j > L * 0.6 ? dx : 0), by - j, STEM);
    P(c, x + (type % 2 ? 1 : -1), by - 1, '#74c06f');
    var hx = x + dx, hy = by - L;
    if (type === 0) {          // tulipán
      R(c, hx - 1, hy - 2, 3, 3, col); P(c, hx - 1, hy - 3, col); P(c, hx + 1, hy - 3, col);
      R(c, hx - 1, hy - 2, 1, 3, dark); P(c, hx, hy - 1, mix(col, '#ffffff', 0.4));
    } else if (type === 1) {   // margarita
      P(c, hx, hy - 2, '#fffaf2'); P(c, hx - 1, hy - 1, '#fffaf2'); P(c, hx + 1, hy - 1, '#fffaf2'); P(c, hx, hy, '#f1e4ea');
      P(c, hx, hy - 1, '#ffc94d');
    } else {                   // flor redonda
      disc(c, hx, hy - 1, 1, col); P(c, hx - 1, hy, dark); P(c, hx, hy - 1, '#fff3c4');
    }
  }
  function butterfly(c, x, y, open, col, col2) {
    x = Math.round(x); y = Math.round(y);
    if (open) {
      R(c, x - 2, y - 1, 2, 2, col); R(c, x + 1, y - 1, 2, 2, col);
      P(c, x - 1, y + 1, col2); P(c, x + 1, y + 1, col2);
    } else {
      R(c, x - 1, y - 2, 1, 2, col); R(c, x + 1, y - 2, 1, 2, col);
    }
    R(c, x, y - 1, 1, 3, INK);
  }
  scene({
    id: 'jardin', label: 'Jardín', emoji: '🌷',
    draw: function (c, W, H, t) {
      var gy = groundY(H), f = Math.floor(t * 8);
      c.drawImage(layer('jardin', W, H, jardinBack), 0, 0);
      // sol sonriente
      var sx = 13, sy = clamp(Math.round(gy * 0.28), 7, 30);
      disc(c, sx, sy, 9, '#fff6cf', f % 4 < 2 ? 0 : 1);
      var ra = (f % 2) * PI / 8;
      for (var k = 0; k < 8; k++) {
        var a = ra + k * PI / 4;
        P(c, sx + Math.round(Math.cos(a) * 9), sy + Math.round(Math.sin(a) * 9), '#ffd66b');
      }
      disc(c, sx, sy, 6, '#f2a65a'); disc(c, sx, sy, 5, '#ffd966');
      disc(c, sx - 1, sy - 1, 3, '#ffe68f'); P(c, sx - 2, sy - 3, '#fff6cf');
      P(c, sx - 2, sy, '#b8693f'); P(c, sx + 2, sy, '#b8693f'); P(c, sx, sy + 2, '#d07a4a');
      P(c, sx - 3, sy + 1, '#ffad8a'); P(c, sx + 3, sy + 1, '#ffad8a');
      // nubes que pasan
      var cy0 = clamp(Math.round(gy * 0.2), 4, 40);
      var cl = [[0, cy0, 3, 1.6], [45, cy0 + Math.max(4, Math.round(gy * 0.18)), 2, 1.0], [80, Math.max(3, cy0 - 3), 2, 2.3]];
      for (k = 0; k < cl.length; k++) {
        var cx = ((cl[k][0] + t * cl[k][3]) % (W + 30)) - 22;
        if (cl[k][1] + cl[k][2] + 2 < gy - 4) cloud(c, cx, cl[k][1], cl[k][2], '#ffffff', '#dfe9f6', '#b7c6e0');
      }
      // flores
      var xs = [2, 7, 12, 17, 23, 28, 70, 75, 80, 85, 90, 94];
      var cols = [['#ff8fab', '#e86a8e'], ['#ffd166', '#e9a93d'], ['#cdb8de', '#a991c9'], ['#ffffff', '#e0d6e0'], ['#ff9e7a', '#e2775a']];
      for (k = 0; k < xs.length; k++) {
        var by = Math.min(H - 2, gy + 2 + (k % 3)), L = 3 + Math.floor(hash(k + 5) * 4);
        var dx = Math.round(Math.sin(t * 2.2 + k * 1.7) * 0.9);
        var type = Math.floor(hash(k + 9) * 3), cc = cols[k % cols.length];
        flower(c, xs[k], by, L, dx, type === 1 ? 1 : type, cc[0], cc[1]);
      }
      // mariposas
      for (k = 0; k < 2; k++) {
        var bx = (k ? 76 : 20) + Math.sin(t * 0.6 + k * 2) * 14 + Math.sin(t * 1.7 + k) * 3;
        var byy = Math.max(4, gy - 12 - Math.abs(Math.sin(t * 1.3 + k)) * Math.min(10, gy * 0.25));
        butterfly(c, bx, byy, (f + k) % 2 === 0, k ? '#b49be0' : '#ff8fab', k ? '#8f74c9' : '#ffd166');
      }
    }
  });

  /* ================================================================== */
  /* 🏖️ Playa                                                            */
  /* ================================================================== */
  function playaGeo(H) {
    var gy = groundY(H), seaH = clamp(Math.round(H * 0.2), 5, 40);
    return { gy: gy, hz: gy - seaH, sunY: clamp(Math.round((gy - seaH) * 0.42), 6, 34) };
  }
  function palmBase(H) {
    var gy = groundY(H), by = gy + Math.max(2, Math.round((H - gy) * 0.5));
    var ph = clamp(Math.round(by * 0.62), 10, 64);
    return { bx: 8, by: by, ph: ph, tx: 8 + 7, ty: by - ph };
  }
  function playaBack(c, W, H) {
    var g = playaGeo(H), gy = g.gy, hz = g.hz, x, y, i;
    vgrad(c, 0, 0, W, hz, ['#7cc8ee', '#a2daf3', '#c9edf8', '#e8f8fa']);
    disc(c, 76, g.sunY, 10, '#fdf5d8', 0);
    disc(c, 76, g.sunY, 7, '#fff3c8');
    disc(c, 76, g.sunY, 6, '#ffe28a'); disc(c, 75, g.sunY - 1, 3, '#fff0b5');
    // islita lejana
    for (x = 20; x < 36; x++) {
      var ih = Math.round(Math.sin((x - 20) / 16 * PI) * 3);
      if (ih > 0) R(c, x, hz - ih, 1, ih, '#8fc7b4');
    }
    P(c, 27, hz - 5, '#7aa894'); P(c, 27, hz - 4, '#7aa894'); P(c, 26, hz - 6, '#6fb89a'); P(c, 28, hz - 6, '#6fb89a');
    // mar
    vgrad(c, 0, hz, W, gy - hz, ['#4fb0dc', '#66c0e4', '#86d3ea', '#a6e2ee']);
    R(c, 0, hz, W, 1, '#3f9fcf');
    // arena
    R(c, 0, gy, W, H - gy, '#f8e3b2');
    var mid = gy + Math.round((H - gy) * 0.35);
    for (y = mid; y < H; y++) rowDither(c, 0, y, W, '#f8e3b2', '#efd29c', (y - mid) / Math.max(1, H - mid) * 0.85);
    for (i = 0; i < 30; i++) {
      x = Math.round(hash(i * 2.3 + 1) * W); y = gy + 3 + Math.round(hash(i * 5.1) * (H - gy - 3));
      if (y < H) P(c, x, y, '#e6c58c');
    }
    // conchita y estrella de mar en los lados
    y = Math.min(H - 3, gy + Math.round((H - gy) * 0.75));
    P(c, 28, y, '#f7a8b0'); P(c, 29, y, '#f7a8b0'); P(c, 28, y + 1, '#e98a96'); P(c, 29, y + 1, '#f7c4c8');
    sparkle(c, 70, y - 1, false, '#f4a261', '#ffd29a');
    // palmera (tronco)
    var p = palmBase(H);
    ellipse(c, p.bx + 4, p.by + 1, 7, 1, '#ead1a0');
    for (i = 0; i <= p.ph; i++) {
      y = p.by - i; x = p.bx + Math.round(Math.pow(i / p.ph, 1.6) * 7);
      P(c, x - 2, y, '#7a4f3a'); P(c, x + 2, y, '#7a4f3a');
      R(c, x - 1, y, 3, 1, i % 3 === 0 ? '#a8774c' : '#c99665');
      P(c, x + 1, y, i % 3 === 0 ? '#8f6340' : '#b3804f');
    }
    // sombrilla
    var ux = 85, uy = gy + Math.max(2, Math.round((H - gy) * 0.6)), uh = clamp(Math.round(H * 0.34), 8, 30), rr = 11;
    var ct = uy - uh;
    ellipse(c, ux - 2, uy + 1, 9, 1, '#ead1a0');
    R(c, ux, ct, 1, uh + 1, '#fff8ee'); R(c, ux + 1, ct + 1, 1, uh, '#d8c3a0');
    for (var dy = -rr; dy <= 0; dy++) {
      var hw = Math.floor(Math.sqrt((rr + 0.5) * (rr + 0.5) - dy * dy) * (dy < -rr * 0.5 ? 1 : 1));
      var rowY = ct + Math.round(dy * 0.6);
      for (var dx = -hw; dx <= hw; dx++) {
        var st = Math.floor((dx + rr + 1) / 4) % 2;
        var col = st ? '#fff6f0' : '#ff8fab';
        if (dy === 0) col = st ? '#e9d9dc' : '#e86a8e';
        P(c, ux + dx, rowY, col);
      }
      P(c, ux - hw - 1, rowY, '#b9506e'); P(c, ux + hw + 1, rowY, '#b9506e');
    }
    for (dx = -rr; dx <= rr; dx++) if (Math.abs(dx) % 4 === 1) P(c, ux + dx, ct + 1, '#b9506e');
    for (dx = -3; dx <= 3; dx++) P(c, ux + dx, ct - Math.round(rr * 0.6) - 1, '#b9506e');
    P(c, ux, ct - Math.round(rr * 0.6) - 2, INK);
  }
  function crab(c, x, y, f) {
    x = Math.round(x); y = Math.round(y);
    var O = '#a8433f', B = '#f2776b';
    R(c, x - 3, y - 2, 7, 3, O); R(c, x - 2, y - 3, 5, 1, O);
    R(c, x - 2, y - 2, 5, 2, B); P(c, x - 1, y - 2, '#ffa59a');
    P(c, x - 1, y - 4, INK); P(c, x + 1, y - 4, INK);       // ojos
    var open = f % 4 < 2;
    P(c, x - 4, y - 3, B); P(c, x + 4, y - 3, B);            // pinzas
    if (open) { P(c, x - 5, y - 4, B); P(c, x + 5, y - 4, B); } else { P(c, x - 4, y - 4, B); P(c, x + 4, y - 4, B); }
    var l = f % 2;
    P(c, x - 3 - l, y + 1, O); P(c, x + 3 + l, y + 1, O); P(c, x - 1, y + 1, O); P(c, x + 1, y + 1, O);
  }
  scene({
    id: 'playa', label: 'Playa', emoji: '🏖️',
    draw: function (c, W, H, t) {
      var g = playaGeo(H), gy = g.gy, hz = g.hz, f = Math.floor(t * 8), k, x, y;
      c.drawImage(layer('playa', W, H, playaBack), 0, 0);
      // nube y gaviotas
      var cx = ((10 + t * 1.2) % (W + 34)) - 26;
      if (hz > 14) cloud(c, cx, clamp(Math.round(hz * 0.25), 3, 30), 2, '#ffffff', '#dceef8', '#b9d4ea');
      for (k = 0; k < 2; k++) {
        var gx = ((k * 50 + t * (3 + k)) % (W + 10)) - 5, gyy = clamp(Math.round(hz * (0.3 + k * 0.25)), 3, hz - 3) + Math.round(Math.sin(t * 2 + k));
        var up = (f + k * 3) % 6 < 3;
        P(c, gx, gyy, '#5d5a74'); P(c, gx - 1, gyy - (up ? 1 : 0), '#5d5a74'); P(c, gx + 1, gyy - (up ? 1 : 0), '#5d5a74');
        P(c, gx - 2, gyy - (up ? 1 : 0), '#5d5a74'); P(c, gx + 2, gyy - (up ? 1 : 0), '#5d5a74');
      }
      // olas: líneas que se deslizan
      var seaH = gy - hz;
      for (y = hz + 2; y < gy - 1; y += 2) {
        var depth = (y - hz) / seaH, sp = 1.5 + depth * 4;
        var n = 3 + Math.round(depth * 3);
        for (k = 0; k < n; k++) {
          var len = 2 + Math.round(depth * 3);
          x = Math.round(((hash(y * 7 + k) * W + t * sp * (y % 4 ? 1 : -1)) % W + W) % W);
          R(c, x, y, len, 1, depth > 0.5 ? '#e8fafc' : '#bfe8f3');
        }
      }
      // brillo del sol en el agua
      for (y = hz + 1; y < gy - 1; y += 2) {
        var wv = Math.round(hash(y + f * 0.37) * 3);
        R(c, 74 + Math.round(Math.sin(t * 3 + y) * 1) - wv, y, 2 + wv, 1, '#fff6cf');
      }
      for (k = 0; k < 3; k++) {
        var ph = (t * 0.9 + hash(k + 3)) % 1.6;
        if (ph < 0.35) sparkle(c, Math.round(8 + hash(k * 11) * 60), Math.round(hz + 2 + hash(k * 5 + 1) * Math.max(1, seaH - 4)), ph > 0.12 && ph < 0.24, '#ffffff', '#ffffff');
      }
      // espuma de la orilla
      var sw = Math.sin(t * 1.1);
      for (x = 0; x < W; x++) {
        var fy = gy + Math.round(0.6 + Math.sin(x * 0.28 + t * 1.8) * 0.7 + sw * 1.1);
        if (fy > gy) R(c, x, gy, 1, fy - gy, '#bfe6ee');
        P(c, x, fy, '#ffffff');
        if ((x + f) % 5 === 0) P(c, x, fy - 1, '#ffffff');
        P(c, x, fy + 1, '#e7cf9b');
      }
      // hojas de la palmera
      var p = palmBase(H), sway = Math.sin(t * 1.4) * 0.08;
      var fr = [-2.9, -2.3, -1.6, -0.9, -0.3, 0.2];
      for (k = 0; k < fr.length; k++) {
        var a = fr[k] + sway * (k % 2 ? 1 : -1), Lf = k === 2 ? 9 : 12;
        for (var s = 1; s <= Lf; s++) {
          var px = p.tx + Math.cos(a) * s, py = p.ty + Math.sin(a) * s + s * s * 0.07;
          P(c, px, py, '#3fa77c'); P(c, px, py - 1, '#64cf98');
          if (s % 2 === 0 && s > 2) P(c, px, py + 1, '#2f8a68');
        }
      }
      disc(c, p.tx - 1, p.ty + 1, 1, '#8b5a3c'); disc(c, p.tx + 2, p.ty + 2, 1, '#7a4c33'); P(c, p.tx - 2, p.ty, '#b07a52');
      // cangrejito
      crab(c, 21 + Math.sin(t * 0.8) * 4, Math.min(H - 2, gy + Math.max(4, Math.round((H - gy) * 0.8))), f);
    }
  });

  /* ================================================================== */
  /* 🌙 Noche estrellada                                                 */
  /* ================================================================== */
  function nocheGeo(H) {
    var gy = groundY(H);
    return { gy: gy, mx: 72, my: clamp(Math.round(gy * 0.3), 10, 44) };
  }
  function nocheHouses(W, H) {
    var gy = groundY(H), list = [], x = -3, i = 0;
    while (x < W) {
      var w = 10 + Math.floor(hash(i * 3.3 + 1) * 7);
      var mid = x + w / 2, center = Math.abs(mid - 48) < 18;
      var hh = Math.round(clamp(gy * (center ? 0.16 : 0.22) + hash(i * 1.9) * gy * 0.14, 5, 60));
      list.push({ x: x, w: w, h: hh, i: i });
      x += w + (hash(i + 7) > 0.6 ? 1 : 0); i++;
    }
    return list;
  }
  function nocheBack(c, W, H) {
    var g = nocheGeo(H), gy = g.gy, x, y, i;
    vgrad(c, 0, 0, W, gy, ['#14173a', '#1b2050', '#252c66', '#323d7e', '#465394'], 0.55);
    // halo de luna
    disc(c, g.mx, g.my, 15, '#2c3878', 0);
    disc(c, g.mx, g.my, 12, '#38448a', 1);
    disc(c, g.mx, g.my, 11, '#323f84');
    // luna
    disc(c, g.mx, g.my, 9, '#f6e7b4');
    disc(c, g.mx - 1, g.my - 1, 8, '#fff6d2');
    disc(c, g.mx - 3, g.my - 2, 2, '#f1e1aa'); disc(c, g.mx + 3, g.my + 3, 1, '#efdca4'); P(c, g.mx + 2, g.my - 4, '#f1e1aa');
    disc(c, g.mx - 2, g.my + 4, 1, '#f3e4b2'); P(c, g.mx - 5, g.my - 4, '#ffffff'); P(c, g.mx - 4, g.my - 5, '#ffffff');
    // edificios lejanos
    for (x = 0; x < W;) {
      var bw = 6 + Math.floor(hash(x * 0.7 + 2) * 6), bh = Math.round(clamp(gy * 0.3 + hash(x + 3.3) * gy * 0.15, 6, 80));
      R(c, x, gy - bh, bw, bh, '#2a2f63');
      if (hash(x + 9) > 0.6) R(c, x + Math.floor(bw / 2), gy - bh - 3, 1, 3, '#2a2f63');
      for (y = gy - bh + 2; y < gy - 2; y += 3) for (i = x + 1; i < x + bw - 1; i += 2) if (hash(i * 13 + y) > 0.78) P(c, i, y, '#5a64a6');
      x += bw;
    }
    // casitas cercanas con tejados
    var hs = nocheHouses(W, H), SIL = '#1f1a3f', EDGE = '#3c3a78';
    for (i = 0; i < hs.length; i++) {
      var h = hs[i], top = gy - h.h, half = Math.ceil(h.w / 2);
      R(c, h.x, top, h.w, h.h, SIL);
      for (var r = 0; r < half; r++) {             // tejado a dos aguas
        R(c, h.x - 1 + r, top - r, h.w + 2 - r * 2, 1, SIL);
        P(c, h.x + h.w - r, top - r, EDGE);
      }
      if (hash(h.i + 20) > 0.4) {                    // chimenea
        var chx = h.x + Math.round(h.w * 0.7);
        R(c, chx, top - half + 1, 2, half, SIL); P(c, chx + 1, top - half + 1, EDGE);
      }
      for (var wy = top + 2; wy < gy - 3; wy += 4) {
        for (var wx = h.x + 2; wx < h.x + h.w - 3; wx += 4) {
          var lit = hash(h.i * 31 + wx * 3 + wy) > 0.55;
          R(c, wx, wy, 2, 2, lit ? '#ffd98a' : '#332d5c');
          if (lit) P(c, wx, wy, '#fff0bf');
        }
      }
    }
    // tejado en primer plano (donde está el gato)
    R(c, 0, gy, W, H - gy, '#3a3063');
    R(c, 0, gy, W, 1, '#6a5aa0'); R(c, 0, gy + 1, W, 1, '#4c3f7c');
    for (y = gy + 4; y < H; y += 3) {
      R(c, 0, y, W, 1, '#2d2551');
      for (x = ((y / 3) % 2 ? 0 : 3); x < W; x += 6) P(c, x, y + 1, '#2d2551');
    }
    var mid = gy + Math.round((H - gy) * 0.5);
    for (y = mid; y < H; y++) if ((y - gy) % 3 !== 1) rowDither(c, 0, y, W, '#3a3063', '#30285a', (y - mid) / Math.max(1, H - mid));
  }
  scene({
    id: 'noche', label: 'Noche estrellada', emoji: '🌙',
    draw: function (c, W, H, t) {
      var g = nocheGeo(H), gy = g.gy, k;
      c.drawImage(layer('noche', W, H, nocheBack), 0, 0);
      // estrellas titilando (detrás de los tejados no importa: la capa es el cielo)
      var N = clamp(Math.round(W * gy / 110), 12, 120), skyH = Math.max(6, gy - Math.round(gy * 0.35));
      for (k = 0; k < N; k++) {
        var sx = Math.floor(hash(k * 1.37) * W), sy = Math.floor(hash(k * 2.71 + 4) * skyH);
        var dx = sx - g.mx, dy = sy - g.my;
        if (dx * dx + dy * dy < 15 * 15) continue;
        var b = Math.sin(t * (1.2 + hash(k) * 2.5) + k * 1.9);
        if (k % 9 === 0) {
          if (b > 0.3) sparkle(c, sx, sy, b > 0.85, '#aab4ee', '#ffffff');
          else P(c, sx, sy, '#c9cff5');
        } else P(c, sx, sy, b > 0.4 ? '#ffffff' : b > -0.3 ? '#b9c0ec' : '#5a64a6');
      }
      // estrella fugaz cada ~6 s
      var per = 6, ph = t % per, seed = Math.floor(t / per);
      if (ph < 1) {
        var q = ph, x0 = 6 + hash(seed) * 40, y0 = 3 + hash(seed + 1) * Math.min(14, skyH * 0.4);
        var hx = x0 + q * 34, hy = y0 + q * 14, trail = ['#ffffff', '#fff2b8', '#d8dcff', '#a7b0ea', '#7480c8', '#4f5aa0'];
        for (var i = trail.length - 1; i >= 0; i--) P(c, hx - i * 2.4, hy - i, trail[i]);
        P(c, hx + 1, hy, '#fff2b8'); P(c, hx, hy + 1, '#fff2b8');
      }
      // ventanas que parpadean
      var hs = nocheHouses(W, H);
      for (k = 0; k < hs.length; k += 2) {
        var h = hs[k], on = Math.sin(t * 0.5 + k * 2.1) > -0.2;
        var wx = h.x + 2, wy = gy - h.h + 2;
        if (wy < gy - 3 && wx < h.x + h.w - 3) { R(c, wx, wy, 2, 2, on ? '#ffd98a' : '#332d5c'); if (on) P(c, wx, wy, '#fff0bf'); }
      }
    }
  });

  /* ================================================================== */
  /* 🌸 Cerezos                                                          */
  /* ================================================================== */
  function sakura(c, x, baseY, height, dir) {
    var s = height / 30, TR = '#7b4f5d', TRD = '#5a3646';
    var topY = baseY - Math.round(height * 0.62), y, i;
    for (y = baseY; y >= topY; y--) {
      var k = (baseY - y) / Math.max(1, baseY - topY);
      var xx = x + Math.round(Math.sin(k * 2.2) * 2 * dir);
      R(c, xx - 2, y, 1, 1, INK); R(c, xx - 1, y, 3, 1, TR); P(c, xx + (dir > 0 ? 1 : -1), y, TRD); P(c, xx + 2, y, INK);
    }
    R(c, x - 3, baseY, 7, 1, TRD);
    var cx = x + Math.round(2 * dir * s), cy = topY - Math.round(3 * s);
    // ramas
    for (i = 1; i < 8 * s; i++) { P(c, cx + i * dir, cy + 2 + Math.round(i * 0.4), TRD); P(c, cx - i * dir * 0.8, cy + 3 + Math.round(i * 0.3), TRD); }
    var parts = [[0, 0, 7], [-8, 3, 5], [8, 3, 6], [-4, -5, 5], [5, -5, 5], [0, -8, 4], [-11, 6, 3], [12, 6, 3], [2, 4, 5]];
    function pass(g, col, ox, oy, shrink) {
      for (var j = 0; j < parts.length; j++) {
        var r = Math.max(1, Math.round(parts[j][2] * s) + g - (shrink || 0));
        disc(c, cx + Math.round(parts[j][0] * s * dir) + ox, cy + Math.round(parts[j][1] * s) + oy, r, col);
      }
    }
    pass(1, '#d77f9d', 0, 0);
    pass(0, '#f59ab4', 0, 0);
    pass(0, '#ffb6c9', -1, -1, 1);
    pass(0, '#ffd0dc', -2, -2, 3);
    for (i = 0; i < 40 * s; i++) {
      var px = cx + Math.round((hash(i * 1.3 + x) - 0.5) * 26 * s), py = cy + Math.round((hash(i * 2.9 + x) - 0.6) * 18 * s);
      P(c, px, py, i % 3 ? '#ffe6ee' : '#ef8fae');
    }
    return { cx: cx, cy: cy, s: s };
  }
  function cerezoGeo(H) {
    var gy = groundY(H);
    var th = clamp(Math.round(gy * 0.75), 12, 64);
    return { gy: gy, th: th };
  }
  function stoneLantern(c, x, by) {
    var S = '#d6ccd2', D = '#aa9ba6', O = '#7d6878';
    R(c, x - 3, by - 1, 7, 1, O); R(c, x - 2, by - 1, 5, 1, D);
    R(c, x - 1, by - 4, 3, 3, S); P(c, x + 1, by - 3, D); P(c, x + 1, by - 2, D);
    R(c, x - 3, by - 8, 7, 4, O); R(c, x - 2, by - 7, 5, 3, S); R(c, x - 1, by - 7, 3, 2, '#ffd98a'); P(c, x, by - 7, '#fff2c4');
    R(c, x - 4, by - 9, 9, 1, O); R(c, x - 3, by - 10, 7, 1, S); R(c, x - 2, by - 11, 5, 1, S); P(c, x, by - 12, D);
  }
  function cerezosBack(c, W, H) {
    var g = cerezoGeo(H), gy = g.gy, x, y, i;
    vgrad(c, 0, 0, W, gy, ['#ffc4d6', '#ffd5e1', '#ffe5ec', '#fff2ea']);
    disc(c, 22, clamp(Math.round(gy * 0.25), 6, 30), 6, '#fff6f2');
    disc(c, 22, clamp(Math.round(gy * 0.25), 6, 30), 9, '#fff0f0', 1);
    // montañas lejanas
    var mh = clamp(Math.round(gy * 0.45), 6, 60), peaks = [[66, mh, '#e4cfe9', '#d4bce0'], [24, Math.round(mh * 0.7), '#eddff1', '#e0cfe8']];
    for (i = 0; i < peaks.length; i++) {
      var px = peaks[i][0], ph = peaks[i][1];
      for (x = 0; x < W; x++) {
        y = gy - ph + Math.round(Math.abs(x - px) * 0.8);
        if (y >= gy) continue;
        R(c, x, y, 1, gy - y, x > px ? peaks[i][3] : peaks[i][2]);
        if (i === 0 && y - (gy - ph) < 3 + (x % 3 === 0 ? 1 : 0)) R(c, x, y, 1, 1 + (x % 2), x > px ? '#efe4f4' : '#fffafd');
      }
    }
    // suelo
    R(c, 0, gy, W, H - gy, '#cfe9bd'); R(c, 0, gy, W, 1, '#e2f3d2');
    var mid = gy + Math.round((H - gy) * 0.4);
    for (y = mid; y < H; y++) rowDither(c, 0, y, W, '#cfe9bd', '#bfe0ad', (y - mid) / Math.max(1, H - mid));
    // caminito de piedra hacia el torii
    for (y = gy + 1; y < H; y++) {
      var k = (y - gy) / Math.max(1, H - gy), hw = Math.round(7 + k * 10);
      R(c, 48 - hw, y, hw * 2, 1, '#f1e6d8');
      P(c, 48 - hw, y, '#ddcbbd'); P(c, 48 + hw - 1, y, '#ddcbbd');
      if ((y - gy) % 4 === 0) R(c, 48 - hw + 1, y, hw * 2 - 2, 1, '#e6d6c6');
    }
    // torii detrás del gato
    var tH = clamp(Math.round(gy * 0.62), 10, 40), ty = gy - tH, RED = '#ec6a6a', RDD = '#c4474f';
    R(c, 37, ty + 1, 3, tH, RDD); R(c, 37, ty + 1, 2, tH, RED); R(c, 57, ty + 1, 3, tH, RDD); R(c, 57, ty + 1, 2, tH, RED);
    R(c, 36, gy - 1, 5, 2, INK); R(c, 56, gy - 1, 5, 2, INK);
    R(c, 32, ty - 1, 33, 2, INK); P(c, 31, ty - 2, INK); P(c, 65, ty - 2, INK); R(c, 33, ty - 2, 31, 1, INK);
    R(c, 33, ty + 1, 31, 2, RED); R(c, 33, ty + 2, 31, 1, RDD);
    var ny = ty + Math.max(4, Math.round(tH * 0.25));
    R(c, 34, ny, 29, 2, RED); R(c, 34, ny + 1, 29, 1, RDD);
    R(c, 47, ty + 3, 3, ny - ty - 3, RED); P(c, 48, ty + 4, '#ffd98a');
    // pétalos caídos en el pasto
    for (i = 0; i < 26; i++) {
      x = Math.round(hash(i * 4.1) * W); y = gy + 2 + Math.round(hash(i * 6.3) * (H - gy - 2));
      if (y < H && Math.abs(x - 48) > 9) P(c, x, y, i % 2 ? '#ffb6c9' : '#ffd0dc');
    }
    // árboles y faroles
    stoneLantern(c, 24, gy + 1);
    stoneLantern(c, 73, gy + 1);
    sakura(c, 7, gy + 1, g.th, 1);
    sakura(c, 89, gy + 1, g.th, -1);
  }
  scene({
    id: 'cerezos', label: 'Cerezos', emoji: '🌸',
    draw: function (c, W, H, t) {
      var g = cerezoGeo(H), gy = g.gy, f = Math.floor(t * 8);
      c.drawImage(layer('cerezos', W, H, cerezosBack), 0, 0);
      // farolitos de papel colgando de los árboles
      var tops = [[16, 1], [80, -1]];
      for (var k = 0; k < 2; k++) {
        var s = g.th / 30, lx = tops[k][0], ly = gy + 1 - Math.round(g.th * 0.62) + Math.round(4 * s);
        var sw = Math.round(Math.sin(t * 1.6 + k * 2) * 1);
        R(c, lx, ly, 1, 3, '#7b4f5d');
        var bx = lx + sw, by = ly + 3;
        disc(c, bx, by + 2, 4, k ? '#ffe7b0' : '#ffe0cf', (f + k) % 2);
        R(c, bx - 1, by, 3, 1, INK); R(c, bx - 2, by + 1, 5, 3, '#ff7a7a'); R(c, bx - 1, by + 1, 3, 3, '#ff9a8a');
        P(c, bx, by + 2, '#ffe08a'); R(c, bx - 1, by + 4, 3, 1, INK); P(c, bx, by + 5, '#ffd166');
      }
      // pétalos que caen
      var N = clamp(Math.round(W * H / 330), 10, 60);
      for (var i = 0; i < N; i++) {
        var sp = 4 + hash(i * 1.7) * 6;
        var y = ((hash(i * 3.3) * (H + 10) + t * sp) % (H + 10)) - 5;
        var x = ((hash(i * 5.9) * (W + 8) + t * (3 + hash(i) * 3) + Math.sin(t * 1.5 + i) * 3) % (W + 8)) - 4;
        var col = i % 3 ? '#ff9fbe' : '#ffd6e2', ph = (f + i) % 4;
        if (ph === 0) R(c, x, y, 2, 1, col);
        else if (ph === 2) R(c, x, y, 1, 2, col);
        else { P(c, x, y, col); P(c, x + 1, y + 1, col); }
      }
    }
  });

  /* ================================================================== */
  /* ❄️ Nieve                                                            */
  /* ================================================================== */
  function pine(c, x, baseY, h, col, dark, snow, line) {
    var fh = h - 2, n = h > 18 ? 4 : 3, top = baseY - h;
    R(c, x - 1, baseY - 2, 3, 3, '#6e4a3c');
    for (var pass = 0; pass < 2; pass++) {
      for (var y = 0; y < fh; y++) {
        var local = y / fh, tier = Math.min(n - 1, Math.floor(local * n)), tt = local * n - tier;
        var hw = Math.round((1 + tier * h * 0.09) + tt * (1.5 + h * 0.07));
        if (pass === 0) { R(c, x - hw - 1, top + y, hw * 2 + 3, 1, line); if (y === 0) P(c, x, top - 1, line); continue; }
        R(c, x - hw, top + y, hw * 2 + 1, 1, col);
        R(c, x + 1, top + y, hw, 1, dark);
        if (tt < 0.3) R(c, x - hw, top + y, hw + Math.max(1, Math.round(hw * 0.6)), 1, snow);
        else if (tt > 0.85) { P(c, x - hw, top + y, snow); if (hw > 3) P(c, x - hw + 2, top + y, snow); }
      }
    }
  }
  function nieveGeo(H) { return { gy: groundY(H) }; }
  function cabinGeo(H) {
    var gy = groundY(H), wh = clamp(Math.round(gy * 0.3), 7, 16), x0 = 3, ww = 22;
    return { x0: x0, ww: ww, wh: wh, base: gy + 1, roofH: Math.round(ww / 2) - 2, chx: x0 + 16 };
  }
  function nieveBack(c, W, H) {
    var gy = groundY(H), x, y, i;
    vgrad(c, 0, 0, W, gy, ['#5a66a6', '#7a87c2', '#a3aedb', '#ccd3ef']);
    for (i = 0; i < 14; i++) {
      x = Math.round(hash(i * 9.1) * W); y = Math.round(hash(i * 3.7) * gy * 0.35);
      P(c, x, y, i % 3 ? '#c9d0f2' : '#ffffff');
    }
    disc(c, 80, clamp(Math.round(gy * 0.18), 4, 26), 3, '#eef0ff'); P(c, 79, clamp(Math.round(gy * 0.18), 4, 26) - 1, '#ffffff');
    // colinas nevadas lejanas con pinitos
    var hb = clamp(Math.round(gy * 0.22), 3, 16);
    for (x = 0; x < W; x++) {
      y = gy - Math.round(hb + hb * 0.4 * Math.sin(x * 0.06 + 1) + hb * 0.2 * Math.sin(x * 0.17));
      R(c, x, y, 1, gy - y, '#dfe5f6'); P(c, x, y, '#f4f7ff');
      if (x % 7 === 3 && (x < 30 || x > 62)) { R(c, x, y - 3, 1, 3, '#8a9cc4'); P(c, x - 1, y - 1, '#8a9cc4'); P(c, x + 1, y - 1, '#8a9cc4'); }
    }
    for (x = 0; x < W; x++) {
      y = gy - Math.round(hb * 0.4 + hb * 0.25 * Math.sin(x * 0.1 + 3));
      R(c, x, y, 1, gy - y, '#ccd5ef'); P(c, x, y, '#e8edfb');
    }
    // pinos traseros
    var ph = clamp(Math.round(gy * 0.55), 10, 60);
    pine(c, 70, gy + 1, Math.round(ph * 0.8), '#5f9488', '#4f8075', '#f2f6ff', '#3d5e66');
    pine(c, 33, gy + 1, Math.round(ph * 0.55), '#6aa092', '#5a8a7f', '#f2f6ff', '#3d5e66');
    // suelo nevado
    R(c, 0, gy, W, H - gy, '#f3f6fd'); R(c, 0, gy, W, 1, '#ffffff');
    var mid = gy + Math.round((H - gy) * 0.4);
    for (y = mid; y < H; y++) rowDither(c, 0, y, W, '#f3f6fd', '#dde4f5', (y - mid) / Math.max(1, H - mid) * 0.9);
    for (i = 0; i < 12; i++) {
      x = Math.round(hash(i * 2.2 + 5) * W); y = gy + 2 + Math.round(hash(i * 8.8) * (H - gy - 3));
      if (y < H) { P(c, x, y, '#cdd6ee'); P(c, x + 1, y, '#cdd6ee'); }
    }
    // cabaña
    var cb = cabinGeo(H), x0 = cb.x0, ww = cb.ww, wt = cb.base - cb.wh;
    R(c, x0 - 1, wt, ww + 2, cb.wh, INK);
    for (y = wt; y < cb.base; y++) R(c, x0, y, ww, 1, (y - wt) % 2 ? '#8e5a42' : '#a8704f');
    for (y = wt + 1; y < cb.base; y += 2) { P(c, x0 + 1, y, '#c48a62'); P(c, x0 + ww - 2, y, '#c48a62'); }
    // puerta
    R(c, x0 + 3, cb.base - 7, 5, 7, INK); R(c, x0 + 4, cb.base - 6, 3, 6, '#6e4433'); P(c, x0 + 6, cb.base - 3, '#ffd27a');
    // halo de la ventana sobre la nieve
    var wx = x0 + 12, wy = wt + Math.max(2, Math.round(cb.wh * 0.25));
    ellipse(c, wx + 3, cb.base + 1, 5, 1, '#fff1cf');
    // chimenea
    R(c, cb.chx - 1, wt - cb.roofH + 1, 5, cb.roofH, INK); R(c, cb.chx, wt - cb.roofH + 2, 3, cb.roofH, '#9b7b8c');
    R(c, cb.chx - 1, wt - cb.roofH, 5, 2, '#ffffff');
    // techo nevado
    for (i = 0; i <= cb.roofH; i++) {
      var ry = wt - i, rw = ww + 6 - i * 2;
      R(c, x0 - 3 + i, ry, rw, 1, INK);
      R(c, x0 - 2 + i, ry, rw - 2, 1, i < 2 ? '#7a4f45' : '#ffffff');
      if (i >= 2) P(c, x0 - 2 + i + rw - 3, ry, '#dfe6f7');
    }
    R(c, x0 - 3, wt + 1, ww + 6, 1, '#ffffff');
    for (i = 0; i < ww + 6; i += 3) P(c, x0 - 3 + i, wt + 2, '#ffffff');
  }
  function snowman(c, x, base, s) {
    var r1 = Math.max(2, Math.round(5 * s)), r2 = Math.max(2, Math.round(4 * s)), r3 = Math.max(2, Math.round(3 * s));
    var y1 = base - r1, y2 = y1 - r1 - r2 + 1, y3 = y2 - r2 - r3 + 1, O = '#6c6f99', i;
    ellipse(c, x + 1, base, r1 + 2, 1, '#d6deef');
    disc(c, x, y1, r1 + 1, O); disc(c, x, y2, r2 + 1, O); disc(c, x, y3, r3 + 1, O);
    disc(c, x, y1, r1, '#d5ddf2'); disc(c, x - 1, y1 - 1, r1 - 1, '#fbfcff');
    disc(c, x, y2, r2, '#d5ddf2'); disc(c, x - 1, y2 - 1, r2 - 1, '#fbfcff');
    disc(c, x, y3, r3, '#d5ddf2'); disc(c, x - 1, y3 - 1, r3 - 1, '#fbfcff');
    P(c, x - 1, y3 - 1, INK); P(c, x + 1, y3 - 1, INK); P(c, x + 1, y3, '#f4a261'); P(c, x + 2, y3, '#f4a261');
    R(c, x - r3, y3 + r3, r3 * 2 + 1, 1, '#e63946'); P(c, x + r3 - 1, y3 + r3 + 1, '#e63946'); P(c, x + r3 - 1, y3 + r3 + 2, '#c22f3c');
    P(c, x, y2, INK); P(c, x, y2 + 2, INK);
    for (i = 1; i <= 3; i++) { P(c, x - r2 - i, y2 - i + 1, '#7a5442'); P(c, x + r2 + i, y2 - i + 1, '#7a5442'); }
    R(c, x - r3 - 1, y3 - r3, r3 * 2 + 3, 1, INK); R(c, x - r3 + 1, y3 - r3 - 3, r3 * 2 - 1, 3, INK); R(c, x - r3 + 1, y3 - r3 - 1, r3 * 2 - 1, 1, '#c22f3c');
  }
  scene({
    id: 'nieve', label: 'Nieve', emoji: '❄️',
    draw: function (c, W, H, t) {
      var gy = groundY(H), f = Math.floor(t * 8), k, i;
      c.drawImage(layer('nieve', W, H, nieveBack), 0, 0);
      var cb = cabinGeo(H), wt = cb.base - cb.wh;
      // ventana cálida
      var wx = cb.x0 + 12, wy = wt + Math.max(1, Math.round(cb.wh * 0.2)), fl = Math.sin(t * 5) + Math.sin(t * 7.3);
      R(c, wx - 1, wy - 1, 8, 6, INK);
      R(c, wx, wy, 6, 4, fl > 0.6 ? '#ffe39a' : '#ffd27a');
      R(c, wx, wy + 2, 6, 2, fl > -0.8 ? '#ffc65e' : '#ffb84a');
      R(c, wx + 3, wy, 1, 4, '#8e5a42'); R(c, wx, wy + 2, 6, 1, '#8e5a42');
      R(c, wx - 1, wy + 4, 8, 1, '#ffffff');
      // humo de la chimenea
      for (k = 0; k < 4; k++) {
        var ph = (t * 0.35 + k / 4) % 1, sy = wt - cb.roofH - ph * 18 - 1;
        if (sy < 1) continue;
        disc(c, cb.chx + 1 + Math.sin(ph * 6 + k) * 2 + ph * 5, sy, Math.round(ph * 2), mix('#eef1fb', '#a3aedb', ph));
      }
      // pinos delanteros y muñeco de nieve
      var ph2 = clamp(Math.round(gy * 0.55), 10, 60);
      pine(c, 90, gy + 2, ph2, '#3f7d6e', '#336a5d', '#ffffff', INK);
      snowman(c, 76, Math.min(H - 2, gy + Math.max(3, Math.round((H - gy) * 0.45))), clamp(gy / 44, 0.5, 1));
      // destellos en la nieve
      for (k = 0; k < 4; k++) if ((f + k * 3) % 12 < 2) P(c, Math.round(hash(k * 7.7) * W), gy + 2 + Math.round(hash(k * 3.1) * (H - gy - 3)), '#ffffff');
      // nevada (dos capas)
      var N = clamp(Math.round(W * H / 90), 20, 140);
      for (i = 0; i < N; i++) {
        var near = i % 4 === 0, sp = near ? 9 + hash(i) * 5 : 4 + hash(i) * 3;
        var y = (hash(i * 2.3) * (H + 4) + t * sp) % (H + 4) - 2;
        var x = ((hash(i * 4.7) * W + Math.sin(t * 1.2 + i) * (near ? 2.5 : 1.2) + t * 1.5) % W + W) % W;
        if (near) R(c, x, y, 2, 2, '#ffffff'); else P(c, x, y, '#e6ebfa');
      }
    }
  });

  /* ================================================================== */
  /* 🚀 Espacio                                                          */
  /* ================================================================== */
  function surfY(x, gy) { var u = (x - 48) / 48; return gy + Math.round(u * u * 6) - 2; }
  function espacioBack(c, W, H) {
    var gy = groundY(H), x, y;
    vgrad(c, 0, 0, W, H, ['#130a28', '#1c1140', '#281853', '#361f66'], 0.6);
    // nebulosa tramada
    for (y = 0; y < gy; y++) for (x = 0; x < W; x++) {
      var n = Math.sin(x * 0.11 + y * 0.05) + Math.sin(y * 0.09 - x * 0.045 + 2) + Math.sin((x + y) * 0.03 + 1) * 0.8;
      var v = n - 1.1;
      if (v > 0) {
        var tt = th(x, y);
        if (v > 0.9 && tt < (v - 0.9) * 1.5) P(c, x, y, '#6a3a8e');
        else if (tt < v * 0.9) P(c, x, y, v > 0.5 ? '#4b2a78' : '#3c2268');
      }
    }
  }
  function espacioMid(c, W, H) {
    var gy = groundY(H), x, y, i;
    // planeta con anillos
    var px = 20, py = clamp(Math.round(gy * 0.38), 9, 64), r = 7;
    function ring(front) {
      for (var a = 0; a < PI * 2; a += 0.02) {
        var sn = Math.sin(a);
        if ((sn > 0) !== front) continue;
        for (var rr = 12; rr <= 14; rr++) {
          var rx = Math.cos(a) * rr, ry = sn * rr * 0.28 - rx * 0.22;
          P(c, px + rx, py + ry, rr === 14 ? '#c79bd8' : rr === 13 ? '#ffe3a3' : '#f6c87a');
        }
      }
    }
    ring(false);
    disc(c, px, py, r + 1, INK);
    disc(c, px, py, r, '#e98aa6');
    for (y = -r; y <= r; y++) {
      var hw = Math.floor(Math.sqrt((r + 0.5) * (r + 0.5) - y * y));
      if ((y + 7) % 4 === 0) R(c, px - hw, py + y, hw * 2 + 1, 1, '#f6b2c4');
      if ((y + 7) % 4 === 2) R(c, px - hw, py + y, hw * 2 + 1, 1, '#d9708f');
    }
    disc(c, px - 2, py - 3, 2, '#ffd3de'); P(c, px - 3, py - 4, '#ffffff');
    for (y = -r; y <= r; y++) { var h2 = Math.floor(Math.sqrt((r + 0.5) * (r + 0.5) - y * y)); P(c, px + h2, py + y, '#b85a7c'); }
    ring(true);
    // planetita azul con lunita
    var qx = 84, qy = clamp(Math.round(gy * 0.18), 5, 34);
    disc(c, qx, qy, 5, INK); disc(c, qx, qy, 4, '#8ecae6'); disc(c, qx - 1, qy - 1, 3, '#b5e3f3');
    P(c, qx + 1, qy + 1, '#5fa8cc'); P(c, qx + 2, qy, '#5fa8cc'); P(c, qx - 2, qy + 2, '#6fb4d6'); P(c, qx - 2, qy - 2, '#ffffff');
    disc(c, qx - 8, qy + 5, 1, '#e8e2f4'); P(c, qx - 9, qy + 4, '#ffffff');
    // superficie lunar
    for (x = 0; x < W; x++) {
      y = surfY(x, gy);
      R(c, x, y, 1, H - y, '#cbc1de');
      P(c, x, y - 1, INK); P(c, x, y, '#efe9f8'); P(c, x, y + 1, '#ddd4ec');
    }
    var mid = gy + Math.round((H - gy) * 0.4);
    for (y = mid; y < H; y++) for (x = 0; x < W; x++) if (y > surfY(x, gy) + 1 && th(x, y) < (y - mid) / Math.max(1, H - mid) * 0.8) P(c, x, y, '#b3a7cb');
    // cráteres
    var cr = [[11, 4, 5, 2], [86, 3, 4, 2], [26, 8, 2, 1], [72, 7, 3, 1], [4, 10, 2, 1]];
    for (i = 0; i < cr.length; i++) {
      var cx = cr[i][0], cy = surfY(cx, gy) + Math.min(cr[i][1], Math.max(2, H - surfY(cx, gy) - 3));
      if (cy >= H - 1) continue;
      ellipse(c, cx, cy, cr[i][2], cr[i][3], '#a497bf');
      ellipse(c, cx, cy + 1, cr[i][2] - 1, Math.max(0, cr[i][3] - 1), '#bcb1d3');
      R(c, cx - cr[i][2] + 1, cy + cr[i][3] + 1, cr[i][2] * 2 - 1, 1, '#e6dff2');
    }
    // banderita con pescado
    var fx = 92, fy = surfY(fx, gy);
    R(c, fx, fy - 9, 1, 9, '#e9eef5');
    R(c, fx - 6, fy - 9, 6, 4, '#ff8fab'); R(c, fx - 5, fy - 8, 3, 2, '#fff6f0'); P(c, fx - 6, fy - 7, '#fff6f0');
  }
  function fishRocket(c, fx, fy, f) {
    fx = Math.round(fx); fy = Math.round(fy);
    var B = '#ffab5e', BL = '#ffd29a', FIN = '#ff8fab', FD = '#e86a8e';
    // llama
    var fl = 2 + (f % 3);
    R(c, fx - 12 - fl, fy - 1, fl, 3, '#ff7b54'); R(c, fx - 12 - fl + 1, fy, fl, 1, '#ffd166'); P(c, fx - 13 - fl, fy, '#ff7b54');
    // cola (V) con contorno
    for (var i = 0; i < 4; i++) {
      R(c, fx - 8 - i, fy - 2 - i, 1, 5 + i * 2, INK);
    }
    for (i = 0; i < 3; i++) R(c, fx - 8 - i, fy - 1 - i, 1, 3 + i * 2, i === 2 ? FD : FIN);
    R(c, fx - 11, fy - 1, 2, 3, INK); R(c, fx - 12, fy - 2, 1, 5, INK);
    // aletas
    R(c, fx - 3, fy - 6, 4, 2, INK); R(c, fx - 2, fy - 7, 2, 1, INK); R(c, fx - 2, fy - 6, 2, 1, FIN); P(c, fx, fy - 5, FIN);
    R(c, fx - 1, fy + 5, 3, 2, INK); P(c, fx, fy + 5, FD);
    // cuerpo
    ellipse(c, fx, fy, 9, 5, INK);
    ellipse(c, fx, fy, 8, 4, B);
    ellipse(c, fx + 1, fy + 2, 6, 1, BL);
    R(c, fx - 6, fy - 3, 6, 1, '#ffc78a');
    P(c, fx - 4, fy, '#f08a45'); P(c, fx - 3, fy - 1, '#f08a45'); P(c, fx - 2, fy + 1, '#f08a45'); P(c, fx - 1, fy, '#f08a45');
    // ventanita con gatito
    disc(c, fx + 3, fy - 1, 2, '#e9eef5');
    R(c, fx + 2, fy - 2, 3, 3, '#7fc8e8'); P(c, fx + 2, fy - 2, '#ffffff');
    P(c, fx + 3, fy, '#3b2a3f'); P(c, fx + 4, fy - 1, '#3b2a3f');
    // boca
    P(c, fx + 8, fy + 1, INK); P(c, fx + 7, fy + 1, '#ff8fab');
  }
  scene({
    id: 'espacio', label: 'Espacio', emoji: '🚀',
    draw: function (c, W, H, t) {
      var gy = groundY(H), f = Math.floor(t * 8), k;
      c.drawImage(layer('espacio', W, H, espacioBack), 0, 0);
      var N = clamp(Math.round(W * gy / 80), 14, 140);
      for (k = 0; k < N; k++) {
        var sx = Math.floor(hash(k * 1.91 + 3) * W), sy = Math.floor(hash(k * 3.07 + 1) * (gy - 2));
        var b = Math.sin(t * (1 + hash(k + 2) * 3) + k);
        if (k % 11 === 0) { if (b > 0.2) sparkle(c, sx, sy, b > 0.8, k % 2 ? '#ffd6f0' : '#c9d6ff', '#ffffff'); else P(c, sx, sy, '#c9b8f0'); }
        else if (b > -0.4) P(c, sx, sy, b > 0.5 ? '#ffffff' : k % 3 ? '#b8a8e8' : '#ffd6f0');
      }
      // cometa ocasional
      var ph = t % 9;
      if (ph < 1.2) {
        var cx = 96 - ph * 40, cy = 4 + ph * 6;
        P(c, cx, cy, '#ffffff'); P(c, cx + 1, cy - 0.2, '#ffd6f0'); P(c, cx + 2, cy - 0.4, '#d9b6ff'); P(c, cx + 3, cy - 0.6, '#9a7ad6'); P(c, cx + 4, cy - 0.8, '#6a4aa6');
      }
      c.drawImage(layer('espacio-mid', W, H, espacioMid), 0, 0);
      var ry = clamp(Math.round(gy * 0.58), 10, 120);
      fishRocket(c, W * 0.72 + Math.sin(t * 0.35) * 5, ry + Math.sin(t * 1.2) * 1.5, f);
    }
  });

  /* ================================================================== */
  /* 🌗 Sol y Luna — homenaje a la leyenda de la gata carey              */
  /* ================================================================== */
  var SL_L = ['#ff9e7d', '#ffb98d', '#ffd19c', '#ffe6b4'];          // atardecer
  var SL_M = ['#8a5fa8', '#c278a6', '#ee95a6', '#f8bba8'];          // crepúsculo
  var SL_R = ['#17163f', '#25235c', '#3a347a', '#5a4f98'];          // noche
  function slGeo(H) {
    var gy = groundY(H);
    return { gy: gy, sx: 20, sy: clamp(Math.round(gy * 0.4), 9, 70), mx: 76, my: clamp(Math.round(gy * 0.3), 8, 56) };
  }
  function slK(x, y) {   // 0 = día, 1 = noche (costura ondulada en el centro)
    var seam = 48 + Math.sin(y * 0.13) * 3;
    return clamp((x - seam) / 30 + 0.5, 0, 1);
  }
  function slPick(x, y, k, L, M, Rr) {
    var a, b, kk;
    if (k < 0.5) { a = L; b = M; kk = k * 2; } else { a = M; b = Rr; kk = k * 2 - 1; }
    return kk > th(x, y) ? b : a;
  }
  function solylunaBack(c, W, H) {
    var g = slGeo(H), gy = g.gy, x, y, i, STEP = 13;
    // cielo: mezcla RGB continua + cuantización con dither ordenado
    for (y = 0; y < gy; y++) {
      var f = y / Math.max(1, gy - 1);
      var L = stopsRGB(SL_L, f), M = stopsRGB(SL_M, f), Rr = stopsRGB(SL_R, f);
      var runCol = null, runX = 0;
      for (x = 0; x <= W; x++) {
        var col = null;
        if (x < W) {
          var k = slK(x, y), C = k < 0.5 ? mixRGB(L, M, k * 2) : mixRGB(M, Rr, k * 2 - 1), tt = th(x, y);
          col = hex(Math.min(255, Math.floor(C[0] / STEP + tt) * STEP), Math.min(255, Math.floor(C[1] / STEP + tt) * STEP), Math.min(255, Math.floor(C[2] / STEP + tt) * STEP));
        }
        if (col !== runCol) { if (runCol) R(c, runX, y, x - runX, 1, runCol); runCol = col; runX = x; }
      }
    }
    // halos
    disc(c, g.sx, g.sy, 15, '#ffe7b0', 0);
    disc(c, g.sx, g.sy, 12, '#ffe2a6');
    disc(c, g.mx, g.my, 13, '#3f3a82', 1);
    disc(c, g.mx, g.my, 10, '#3a3680');
    // luna creciente mirando al sol
    var mr = 7;
    for (y = -mr - 1; y <= mr + 1; y++) for (x = -mr - 1; x <= mr + 1; x++) {
      var d1 = x * x + y * y, d2 = (x - 4) * (x - 4) + (y + 2) * (y + 2);
      var inA = d1 <= (mr + 0.5) * (mr + 0.5), inB = d2 <= (mr - 0.5) * (mr - 0.5);
      var inAo = d1 <= (mr + 1.5) * (mr + 1.5), inBo = d2 <= (mr - 1.5) * (mr - 1.5);
      if (inA && !inB) P(c, g.mx + x, g.my + y, d2 <= (mr + 0.7) * (mr + 0.7) ? '#f1dc9c' : '#fff4c9');
      else if (inAo && !inBo && !inA) P(c, g.mx + x, g.my + y, '#7c6fb8');
    }
    P(c, g.mx - 5, g.my - 1, '#ead08e'); P(c, g.mx - 4, g.my + 3, '#ead08e'); P(c, g.mx - 3, g.my - 5, '#ffffff');
    // nubes alargadas: cálidas a la izquierda, violetas a la derecha
    var cy = Math.round(gy * 0.72);
    var streaks = [[2, cy, 22, '#ffd9bd', '#f7a98f'], [12, cy + 3, 16, '#ffe4c8', '#f4b39a'], [64, cy - 1, 20, '#4b4590', '#3a347a'], [74, cy + 3, 18, '#5a5299', '#433c86']];
    for (i = 0; i < streaks.length; i++) {
      var s = streaks[i];
      if (s[1] + 2 >= gy - 3) continue;
      R(c, s[0] + 2, s[1], s[2] - 4, 1, s[3]); R(c, s[0], s[1] + 1, s[2], 1, s[3]); R(c, s[0] + 1, s[1] + 2, s[2] - 2, 1, s[4]);
    }
    // colinas lejanas y suelo (mezclados día/noche)
    var hb = clamp(Math.round(gy * 0.16), 3, 12);
    for (x = 0; x < W; x++) {
      var hy = gy - Math.round(hb + hb * 0.5 * Math.sin(x * 0.075 + 0.8) + hb * 0.25 * Math.sin(x * 0.2));
      for (y = hy; y < gy; y++) P(c, x, y, slPick(x, y, slK(x, y), y === hy ? '#ffc0a0' : '#f2a48e', y === hy ? '#d08aa8' : '#b77a9f', y === hy ? '#4c4890' : '#3d3a78'));
    }
    for (y = gy; y < H; y++) {
      var top = y === gy, sh = (y - gy) / Math.max(1, H - gy);
      for (x = 0; x < W; x++) {
        var kk = slK(x, gy);
        var Lc = top ? '#e9eb9c' : sh > 0.55 && th(x, y) < (sh - 0.55) * 2 ? '#a9be72' : '#bed27f';
        var Rc = top ? '#4c5a96' : sh > 0.55 && th(x, y) < (sh - 0.55) * 2 ? '#26305a' : '#2f3b68';
        P(c, x, y, slPick(x, y, kk, Lc, top ? '#a8a0b8' : '#7f8a98', Rc));
      }
    }
    // florecitas al sol, hongos que brillan de noche
    for (i = 0; i < 6; i++) {
      x = 3 + i * 4 + Math.round(hash(i + 70) * 2); y = gy + 2 + Math.round(hash(i + 80) * Math.max(1, H - gy - 4));
      if (y >= H) continue;
      P(c, x, y, '#5d9a52'); P(c, x, y - 1, i % 2 ? '#ff8fab' : '#ffd166');
    }
    for (i = 0; i < 4; i++) {
      x = 74 + i * 5 + Math.round(hash(i + 90) * 2); y = gy + 3 + Math.round(hash(i + 95) * Math.max(1, H - gy - 5));
      if (y >= H) continue;
      P(c, x, y, '#cfd4f5'); R(c, x - 1, y - 1, 3, 1, '#8ee3e0'); P(c, x, y - 2, '#c5fbf6');
    }
  }
  var HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
  scene({
    id: 'solyluna', label: 'Sol y Luna', emoji: '🌗',
    draw: function (c, W, H, t) {
      var g = slGeo(H), gy = g.gy, f = Math.floor(t * 8), k, i, x, y;
      c.drawImage(layer('solyluna', W, H, solylunaBack), 0, 0);
      // estrellas solo del lado de la noche
      var N = clamp(Math.round(gy * 0.9), 10, 90);
      for (k = 0; k < N; k++) {
        x = Math.floor(52 + hash(k * 1.33 + 8) * 44); y = Math.floor(hash(k * 2.17 + 3) * gy * 0.78);
        if (slK(x, y) < 0.62) continue;
        var dx = x - g.mx, dy = y - g.my;
        if (dx * dx + dy * dy < 12 * 12) continue;
        var b = Math.sin(t * (1.1 + hash(k) * 2.4) + k * 2.3);
        if (k % 7 === 0 && b > 0.3) sparkle(c, x, y, b > 0.85, '#b7b4f0', '#ffffff');
        else if (b > -0.2) P(c, x, y, b > 0.5 ? '#ffffff' : '#c3c0f4');
      }
      // rayos del sol que giran
      var rot = (f % 4) * PI / 16;
      for (k = 0; k < 8; k++) {
        var a = rot + k * PI / 4, len = k % 2 ? 2 : 3;
        for (var s = 0; s < len; s++) P(c, g.sx + Math.cos(a) * (11 + s), g.sy + Math.sin(a) * (11 + s), s === 0 ? '#ffd66b' : '#ffe6a0');
      }
      // sol
      disc(c, g.sx, g.sy, 9, '#f08a5d');
      disc(c, g.sx, g.sy, 8, '#ffcf5e');
      disc(c, g.sx - 1, g.sy - 1, 6, '#ffdb73');
      disc(c, g.sx - 2, g.sy - 3, 2, '#fff1b5'); P(c, g.sx - 4, g.sy - 4, '#ffffff');
      // pajaritos al atardecer
      for (k = 0; k < 2; k++) {
        var bx = ((30 - t * (2 + k) + k * 17) % 46 + 46) % 46, by = Math.round(g.sy + 10 + k * 4 + Math.sin(t + k) * 1);
        if (by >= gy - 2) continue;
        var up = (f + k * 2) % 4 < 2;
        P(c, bx, by, '#a55a5a'); P(c, bx - 1, by - (up ? 1 : 0), '#a55a5a'); P(c, bx + 1, by - (up ? 1 : 0), '#a55a5a');
      }
      // polvo de estrellas: el sol y la luna se buscan
      var arcH = clamp(Math.round(gy * 0.28), 4, 26);
      var hx = 48, hy = Math.max(3, Math.round((g.sy + g.my) / 2 - arcH) - 1);
      function mote(pp, back, gold) {
        var e = Math.sin(pp * PI), xa, ya;
        if (!back) { xa = g.sx + 8 + (g.mx - 6 - g.sx - 8) * pp; ya = g.sy + (g.my - g.sy) * pp - e * arcH; }
        else { xa = g.mx - 6 + (g.sx + 8 - g.mx + 6) * pp; ya = g.my + (g.sy - g.my) * pp - e * arcH * 0.55 + Math.sin(pp * PI * 2) * 2; }
        return [xa, ya];
      }
      for (i = 0; i < 10; i++) {
        var p = (t * 0.1 + i / 10) % 1, q = (t * 0.085 + i / 10 + 0.05) % 1;
        for (var tr = 3; tr >= 0; tr--) {
          var a1 = mote(Math.max(0, p - tr * 0.012), false), a2 = mote(Math.max(0, q - tr * 0.012), true);
          var fade = tr / 4;
          P(c, a1[0], a1[1] + Math.sin(t * 2 + i) * 0.6, mix(mix('#ffd166', '#f1eeff', p), tr ? (slK(Math.round(a1[0]), Math.round(a1[1])) > 0.5 ? '#3a347a' : '#ffc99a') : '#ffffff', tr ? 0.25 + fade * 0.5 : 0.15));
          P(c, a2[0], a2[1], mix(mix('#e6e9ff', '#ffe08a', q), tr ? (slK(Math.round(a2[0]), Math.round(a2[1])) > 0.5 ? '#3a347a' : '#ffc99a') : '#ffffff', tr ? 0.3 + fade * 0.5 : 0.1));
        }
      }
      // corazón carey (mitad naranja, mitad negra) que late
      var beat = (t % 2.4) < 0.25;
      if (beat) { sparkle(c, hx - 6, hy - 1, false, '#fff1d6', '#ffffff'); sparkle(c, hx + 6, hy + 4, false, '#fff1d6', '#ffffff'); }
      var ox = hx - 3, oy = hy - (beat ? 1 : 0);
      for (y = 0; y < HEART.length; y++) for (x = 0; x < 7; x++) {
        if (HEART[y][x] !== 'X') continue;
        for (var oy2 = -1; oy2 <= 1; oy2++) for (var ox2 = -1; ox2 <= 1; ox2++) {
          if (Math.abs(ox2) + Math.abs(oy2) !== 1) continue;
          var nx = x + ox2, ny = y + oy2;
          if (ny < 0 || ny >= HEART.length || nx < 0 || nx >= 7 || HEART[ny][nx] !== 'X') P(c, ox + nx, oy + ny, '#fff1d6');
        }
      }
      for (y = 0; y < HEART.length; y++) for (x = 0; x < 7; x++) {
        if (HEART[y][x] !== 'X') continue;
        var colH = x < 3 ? '#e07a3f' : x > 3 ? '#2f2a36' : ((y & 1) ? '#e07a3f' : '#2f2a36');
        P(c, ox + x, oy + y, colH);
      }
      P(c, ox + 1, oy + 1, '#ffb27a'); P(c, ox + 5, oy + 1, '#5a5266');
      // luciérnagas del lado nocturno
      for (k = 0; k < 5; k++) {
        x = 66 + hash(k * 3.9) * 28 + Math.sin(t * 0.7 + k * 2) * 3;
        y = gy - 3 - hash(k * 5.3) * Math.min(14, gy * 0.35) + Math.sin(t * 1.1 + k) * 2;
        var on = Math.sin(t * 2.2 + k * 1.7);
        if (on > 0) { P(c, x, y, '#f4ff9a'); if (on > 0.7) { P(c, x + 1, y, '#9fb86a'); P(c, x - 1, y, '#9fb86a'); P(c, x, y - 1, '#9fb86a'); P(c, x, y + 1, '#9fb86a'); P(c, x, y, '#ffffe0'); } }
      }
      // brillitos dorados del lado del día
      for (k = 0; k < 3; k++) {
        var ph = (t * 0.7 + hash(k + 50) * 3) % 3;
        if (ph < 0.4) sparkle(c, Math.round(6 + hash(k * 9.1) * 34), Math.round(gy * 0.15 + hash(k * 4.4) * gy * 0.55), ph > 0.15 && ph < 0.28, '#fff3c4', '#ffffff');
      }
    }
  });
})();
