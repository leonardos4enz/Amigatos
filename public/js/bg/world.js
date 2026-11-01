/* Amigatos — fondos de las tres salas del mundo (pixel art procedural)
 * Registra en window.CatBG: plaza (Plaza Bigotes), parque (Parque Ronroneo) y cafe (Café del Ovillo).
 * Todo se dibuja con fillRect en pixeles lógicos sobre un ancho de 96; el alto se adapta a h.
 * Arte original de Amigatos: no se copia nada de otros juegos.
 */
(function () {
  'use strict';
  if (!window.CatBG) return;

  var BW = 96;                 // ancho logico de diseno
  var INK = '#2b1a33';         // tinta ciruela (igual que cat-art)
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var PI = Math.PI;

  /* ------------------------------------------------------------------ */
  /* utilidades                                                          */
  /* ------------------------------------------------------------------ */
  function th(x, y) { return (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function R(c, col, x, y, w, h) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    if (w <= 0 || h <= 0) return;
    c.fillStyle = col; c.fillRect(x, y, w, h);
  }
  function P(c, col, x, y) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), 1, 1); }

  // disco pixelado (r entero), opcionalmente en damero (parity 0/1)
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
  // fila con tramado ordenado entre a y b (k = proporcion de b)
  function rowDither(c, x0, y, w, a, b, k) {
    if (k <= 1 / 32) { R(c, a, x0, y, w, 1); return; }
    if (k >= 31 / 32) { R(c, b, x0, y, w, 1); return; }
    R(c, a, x0, y, w, 1);
    c.fillStyle = b;
    for (var x = x0; x < x0 + w; x++) if (th(x, y) < k) c.fillRect(x, y, 1, 1);
  }
  // degradado vertical por bandas con transicion tramada
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
      R(c, col, x + s - g, y + dy, s * 2.6 + g * 2 + 1, s + 1 + g);
    }
    if (line) blob(1, line, 0);
    blob(0, shade, 0);
    blob(0, fill, -1);
  }
  // estrella de 4 puntas
  function sparkle(c, x, y, big, col, core) {
    P(c, core || col, x, y);
    P(c, col, x - 1, y); P(c, col, x + 1, y); P(c, col, x, y - 1); P(c, col, x, y + 1);
    if (big) { P(c, col, x - 2, y); P(c, col, x + 2, y); P(c, col, x, y - 2); P(c, col, x, y + 2); }
  }
  // estrella de 5 puntas (pequena) para carteles y premios
  function star5(c, x, y, col, bright) {
    R(c, col, x - 1, y - 3, 3, 1); R(c, col, x - 1, y - 2, 3, 1);
    R(c, col, x - 2, y - 1, 5, 1); R(c, col, x - 2, y, 5, 1);
    R(c, col, x - 1, y + 1, 3, 1); R(c, col, x, y + 2, 1, 1);
    P(c, bright || col, x, y - 1);
  }
  // corazon 5x4
  function heart5(c, x, y, col) {
    R(c, col, x, y, 2, 1); R(c, col, x + 3, y, 2, 1);
    R(c, col, x, y + 1, 5, 1); R(c, col, x + 1, y + 2, 3, 1); P(c, col, x + 2, y + 3);
  }
  function groundY(H) { return H - clamp(Math.round(H * 0.3), 10, 46); }

  /* capas estaticas en cache (por escena y tamano) */
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

  // bufer para re-escalar cuando el canvas no mide 96 de ancho (miniaturas, etc.)
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
  /* 🏛️ Plaza Bigotes                                                   */
  /* ================================================================== */
  var PLAZA_WALLS = ['#f4d9c4', '#e9cad8', '#d9e2f2', '#f7e4bd', '#d8e8dd'];
  var PLAZA_ROOFS = ['#c9736b', '#a8705f', '#7f8fbf', '#c08a52'];
  var PLAZA_FLAGS = ['#ff8fab', '#ffd166', '#8ecae6', '#b9f0c9', '#cdb8de'];

  function plazaGeo(H) {
    var gy = groundY(H);
    return { gy: gy, fx: 46, fy: gy + 1, bx: 68, bw: 24, btop: gy - 22 };
  }
  function plazaBack(c, W, H) {
    var g = plazaGeo(H), gy = g.gy, x, y, i, r;
    // cielo
    vgrad(c, 0, 0, W, gy, ['#8fd2ee', '#a9ddf3', '#cbeaf6', '#e8f7ee']);
    // sol
    var sy = clamp(Math.round(gy * 0.2), 6, 26);
    disc(c, 15, sy, 8, '#fff6cf'); disc(c, 14, sy - 1, 5, '#ffe89a');
    // casas del pueblo
    var hx = -3;
    while (hx < W + 3) {
      var bw = 10 + Math.floor(hash(hx * 1.7 + 3) * 8);
      var bh = Math.round(clamp(gy * 0.2 + hash(hx * 2.3 + 1) * gy * 0.14, 9, 44));
      var by = gy - bh;
      var wall = PLAZA_WALLS[Math.floor(hash(hx * 3.1 + 2) * PLAZA_WALLS.length)];
      var roof = PLAZA_ROOFS[Math.floor(hash(hx * 5.3 + 7) * PLAZA_ROOFS.length)];
      R(c, wall, hx, by, bw, bh);
      var roofH = Math.ceil(bw / 2) + 1;
      for (r = 0; r < roofH; r++) R(c, roof, hx + Math.floor(bw / 2) - r, by - r - 1, r * 2 + 1, 1);
      R(c, roof, hx + Math.floor(bw / 2) - roofH + 1, by - roofH, 3, 1);
      // ventanas
      R(c, '#5f6c86', hx + 2, by + 4, 3, 3); R(c, '#ffd98a', hx + 3, by + 5, 2, 2);
      if (bw > 12) { R(c, '#5f6c86', hx + bw - 5, by + 4, 3, 3); R(c, '#ffd98a', hx + bw - 4, by + 5, 2, 2); }
      // puerta
      R(c, '#8d5c3d', hx + Math.floor(bw / 2) - 2, gy - 6, 4, 6);
      R(c, '#a9714a', hx + Math.floor(bw / 2) - 1, gy - 5, 2, 5);
      hx += bw + 1;
    }
    // suelo de adoquines
    R(c, '#e6dac9', 0, gy, W, H - gy);
    R(c, '#f3ebdd', 0, gy, W, 1);
    var rowH = 3;
    for (y = gy; y < H; y += rowH) {
      var off = ((y - gy) / rowH) % 2 ? 4 : 0;
      for (x = -8 + off; x < W; x += 8) {
        R(c, '#d3c5b1', x, y, 7, 2);
        R(c, '#f4ecdd', x, y, 7, 1);
      }
    }
    var mid = gy + Math.round((H - gy) * 0.5);
    for (y = mid; y < H; y++) rowDither(c, 0, y, W, '#e6dac9', '#d3c5b1', (y - mid) / Math.max(1, H - mid) * 0.7);
    // fuente (piedra)
    var fx = g.fx, fy = g.fy;
    R(c, '#cfc4bb', fx - 2, fy - 9, 5, 9);
    R(c, '#e6dcd3', fx - 2, fy - 9, 2, 9);
    ellipse(c, fx, fy - 9, 8, 2, '#b9ada4');
    ellipse(c, fx, fy - 9, 7, 1, '#dcd1c8');
    ellipse(c, fx, fy - 8, 6, 1, '#8fd0e6');
    ellipse(c, fx, fy, 15, 3, '#b9ada4');
    ellipse(c, fx, fy - 1, 14, 2, '#ded3cb');
    ellipse(c, fx, fy - 1, 12, 1, '#8fd0e6');
    // bancos
    function bench(bx, by) {
      R(c, '#a9714a', bx - 7, by - 9, 14, 2);
      R(c, '#c58a5c', bx - 7, by - 9, 14, 1);
      R(c, '#a9714a', bx - 7, by - 6, 14, 1);
      R(c, '#c58a5c', bx - 6, by - 4, 12, 2);
      R(c, '#d8a06d', bx - 6, by - 4, 12, 1);
      R(c, '#8d5c3d', bx - 5, by - 2, 2, 4);
      R(c, '#8d5c3d', bx + 3, by - 2, 2, 4);
    }
    bench(13, gy + 4);
    bench(25, gy + 7);
    // puesto de premios
    var bx = g.bx, bw2 = g.bw, btop = g.btop;
    R(c, '#a9714a', bx, btop + 5, 2, 24);
    R(c, '#a9714a', bx + bw2 - 2, btop + 5, 2, 24);
    R(c, '#c58a5c', bx - 1, gy - 3, bw2 + 2, 6);
    R(c, '#d8a06d', bx - 1, gy - 3, bw2 + 2, 1);
    R(c, '#8d5c3d', bx, gy + 3, bw2, 1);
    for (i = 0; i < bw2; i++) R(c, i % 4 < 2 ? '#ff8fab' : '#fff6ee', bx + i, btop + 3, 1, 5);
    R(c, '#e0637f', bx - 1, btop + 2, bw2 + 2, 1);
    // cartel del puesto
    R(c, '#a9714a', bx + 3, btop - 7, 18, 9);
    R(c, '#fff6ee', bx + 4, btop - 6, 16, 7);
    star5(c, bx + 12, btop - 2, '#ffd166', '#fff3c4');
    heart5(c, bx + 6, btop - 4, '#ff8fab');
    heart5(c, bx + 15, btop - 4, '#ff8fab');
    // farola
    var lx = 62, ly = gy - 26;
    R(c, '#6b5470', lx, ly, 1, 26);
    R(c, '#4a3d52', lx, gy, 3, 1);
    R(c, '#4a3d52', lx - 3, ly - 5, 7, 1);
    R(c, '#4a3d52', lx - 2, ly - 4, 5, 4);
    R(c, '#ffe7a8', lx - 1, ly - 3, 3, 2);
    // cuerda de banderines
    var by0 = 6, sag = 7;
    for (x = 0; x < W; x++) {
      var u = x / (W - 1);
      P(c, '#6b5470', x, by0 + Math.round(sag * 4 * u * (1 - u)));
    }
  }
  // perrito de peluche del puesto
  function plush(c, x, y, col, t, seed) {
    var bob = Math.round(Math.sin(t * 2 + seed) * 1);
    var yy = y + bob;
    R(c, col, x - 3, yy - 3, 6, 5);
    R(c, col, x - 3, yy - 5, 2, 2);
    R(c, col, x + 1, yy - 5, 2, 2);
    P(c, INK, x - 1, yy - 2); P(c, INK, x + 1, yy - 2);
    P(c, '#ff8fab', x, yy);
  }
  scene({
    id: 'plaza', label: 'Plaza Bigotes', emoji: '🏛️',
    draw: function (c, W, H, t) {
      var g = plazaGeo(H), gy = g.gy, fx = g.fx, fy = g.fy, x, y, i;
      c.drawImage(layer('plaza', W, H, plazaBack), 0, 0);
      // banderines que ondean
      var by0 = 6, sag = 7;
      for (i = 0, x = 4; x < W - 4; x += 8, i++) {
        var uu = (x + 2) / (W - 1);
        var fy0 = by0 + Math.round(sag * 4 * uu * (1 - uu)) + 1;
        var col = PLAZA_FLAGS[i % PLAZA_FLAGS.length];
        var sw = Math.round(Math.sin(t * 2 + i * 0.8) * 1);
        for (var r = 0; r < 5; r++) {
          var half = Math.max(0, 2 - Math.floor(r / 2));
          var cx = x + 2 + (r > 2 ? sw : 0);
          R(c, col, cx - half, fy0 + r, half * 2 + 1, 1);
        }
        P(c, '#ffffff', x + 2, fy0 + 1);
      }
      // agua de la fuente
      var jy = fy - 9;
      R(c, '#bfeaff', fx, jy - 5, 1, 5);
      disc(c, fx, jy - 6, 2, '#d9f4ff');
      disc(c, fx, jy - 7, 1, '#ffffff');
      for (i = 0; i < 7; i++) {
        var ph = (t * 0.9 + i / 7) % 1;
        var dx = fx + Math.round(Math.sin(ph * 7 + i * 1.3) * 7);
        var dy = jy - 6 + ph * 7;
        P(c, '#cdeeff', dx, dy);
        if (i % 3 === 0) P(c, '#ffffff', dx, dy - 1);
      }
      if ((Math.floor(t * 8) % 6) < 3) sparkle(c, fx - 3 + Math.round(Math.sin(t * 2) * 2), fy - 1, false, '#ffffff', '#ffffff');
      // banderín del puesto
      var flagx = g.bx + 12, flagy = g.btop - 7;
      R(c, '#8d5c3d', flagx, flagy - 9, 1, 9);
      for (i = 0; i < 5; i++) {
        var w2 = 7 - i;
        var off = Math.round(Math.sin(t * 3 - i * 0.6) * 1.5);
        R(c, i % 2 ? '#ff8fab' : '#ffd166', flagx + 1 + off, flagy - 9 + i, w2, 1);
      }
      // peluches
      plush(c, g.bx + 6, gy - 6, '#ffd166', t, 0);
      plush(c, g.bx + 14, gy - 6, '#c9b6ec', t, 1);
      plush(c, g.bx + 20, gy - 6, '#8ecae6', t, 2);
      // luz de la farola
      var lx = 62, ly = gy - 26;
      c.fillStyle = 'rgba(255,226,150,0.16)';
      c.fillRect(lx - 4, ly - 2, 9, 3);
      c.fillStyle = 'rgba(255,226,150,0.08)';
      c.fillRect(lx - 7, ly - 1, 15, 2);
      // pajaritos
      for (i = 0; i < 2; i++) {
        var bx = ((i * 52 + t * (2 + i)) % (W + 12)) - 6;
        var by = clamp(Math.round(gy * (0.26 + i * 0.13)), 4, Math.max(6, gy - 6)) + Math.round(Math.sin(t * 2 + i) * 1);
        var up = (Math.floor(t * 6) + i) % 6 < 3;
        P(c, '#5d5a74', bx, by); P(c, '#5d5a74', bx - 1, by - (up ? 1 : 0)); P(c, '#5d5a74', bx + 1, by - (up ? 1 : 0));
      }
      // confeti flotante
      for (i = 0; i < 12; i++) {
        var sp = 2 + hash(i * 3.7) * 3;
        var kx = (hash(i * 5.1) * (W + 10) + t * sp) % (W + 10) - 5;
        var ky = (hash(i * 7.3) * (H + 10) + t * sp * 0.6) % (H + 10) - 5;
        var ccol = PLAZA_FLAGS[i % PLAZA_FLAGS.length];
        if ((Math.floor(t * 4) + i) % 2) R(c, ccol, kx, ky, 1, 1); else P(c, ccol, kx, ky);
      }
    }
  });

  /* ================================================================== */
  /* 🌳 Parque Ronroneo                                                 */
  /* ================================================================== */
  function parqueGeo(H) {
    var gy = groundY(H);
    return { gy: gy, sx: 58, top: gy - 24 };
  }
  function bigTree(c, x, by, h, seed) {
    var s = h / 30, i;
    // tronco
    var tw = Math.max(2, Math.round(3 * s));
    R(c, '#8d5c3d', x - Math.floor(tw / 2), by - Math.round(h * 0.5), tw, Math.round(h * 0.5));
    R(c, '#a9714a', x - Math.floor(tw / 2), by - Math.round(h * 0.5), 1, Math.round(h * 0.5));
    R(c, '#6f452c', x - Math.round(tw / 2) - 2, by - Math.round(h * 0.34), 2, 2);
    R(c, '#6f452c', x + Math.round(tw / 2), by - Math.round(h * 0.3), 2, 2);
    // copa
    var cy = by - Math.round(h * 0.72);
    var parts = [[0, 0, 8], [-7, 3, 6], [7, 3, 6], [-3, -6, 6], [4, -6, 5], [-11, 6, 3], [11, 6, 3], [0, 7, 6]];
    for (i = 0; i < parts.length; i++) {
      disc(c, x + Math.round(parts[i][0] * s), cy + Math.round(parts[i][1] * s), Math.max(2, Math.round(parts[i][2] * s)), '#4f9e57');
    }
    for (i = 0; i < parts.length; i++) {
      disc(c, x + Math.round(parts[i][0] * s), cy + Math.round(parts[i][1] * s) - 1, Math.max(1, Math.round(parts[i][2] * s * 0.8)), '#6fc46e');
    }
    for (i = 0; i < 4; i++) {
      var lx = x + Math.round((hash(seed + i * 3.7) - 0.5) * 12 * s);
      var ly = cy + Math.round((hash(seed + i * 5.1) - 0.6) * 10 * s);
      P(c, '#9bdc93', lx, ly);
    }
  }
  function parqueBack(c, W, H) {
    var g = parqueGeo(H), gy = g.gy, x, y, i;
    // cielo
    vgrad(c, 0, 0, W, gy, ['#8fd4f2', '#a7e0f4', '#c6ecf7', '#e9f8ec']);
    // sol
    var sy = clamp(Math.round(gy * 0.18), 6, 24);
    disc(c, 80, sy, 8, '#fff6cf'); disc(c, 79, sy - 1, 5, '#ffe89a');
    // colinas
    var hb = clamp(Math.round(gy * 0.16), 4, 16);
    for (x = 0; x < W; x++) {
      y = gy - Math.round(hb + hb * 0.45 * Math.sin(x * 0.08 + 0.6) + hb * 0.2 * Math.sin(x * 0.19 + 2));
      R(c, '#a8dca0', x, y, 1, gy - y); P(c, '#c8ecc0', x, y);
    }
    for (x = 0; x < W; x++) {
      y = gy - Math.round(hb * 0.5 + hb * 0.28 * Math.sin(x * 0.13 + 2.4));
      R(c, '#8fcc88', x, y, 1, gy - y); P(c, '#b6e6aa', x, y);
    }
    // cesped
    R(c, '#96d38d', 0, gy, W, H - gy);
    R(c, '#b9e8aa', 0, gy, W, 1);
    var mid = gy + Math.round((H - gy) * 0.45);
    for (y = mid; y < H; y++) rowDither(c, 0, y, W, '#96d38d', '#7fc07c', (y - mid) / Math.max(1, H - mid) * 0.9);
    // caminito de tierra
    for (y = gy + 1; y < H; y++) {
      var k = (y - gy) / Math.max(1, H - gy);
      var hw = Math.round(5 + k * 9);
      R(c, '#e3c99c', 44 - hw, y, hw * 2, 1);
      P(c, '#cfb083', 44 - hw, y);
      P(c, '#cfb083', 44 + hw - 1, y);
      if ((y - gy) % 4 === 0) R(c, '#d6b987', 44 - hw + 2, y, hw * 2 - 4, 1);
    }
    // arboles grandes a los lados
    bigTree(c, 12, gy + 2, clamp(Math.round(gy * 0.85), 22, 70), 3);
    bigTree(c, 86, gy + 3, clamp(Math.round(gy * 0.72), 18, 62), 11);
    // portico del columpio
    var sx = g.sx, top = g.top, sph = Math.max(6, gy - (top + 2));
    R(c, '#8d5c3d', sx - 11, top + 2, 2, sph);
    R(c, '#8d5c3d', sx + 10, top + 2, 2, sph);
    R(c, '#a9714a', sx - 11, top + 2, 1, sph);
    R(c, '#a9714a', sx + 10, top + 2, 1, sph);
    R(c, '#8d5c3d', sx - 12, top, 25, 2);
    R(c, '#a9714a', sx - 12, top, 25, 1);
    // flores
    var fcols = [['#ff8fab', '#e86a8e'], ['#ffd166', '#e9a93d'], ['#cdb8de', '#a991c9'], ['#ffffff', '#e0d6e0']];
    var xs = [5, 9, 19, 26, 33, 38, 68, 72, 78, 92];
    for (i = 0; i < xs.length; i++) {
      x = xs[i]; y = gy + 3 + Math.round(hash(i * 4.3) * Math.max(1, H - gy - 5));
      if (y >= H) continue;
      var cc = fcols[i % fcols.length];
      P(c, '#4f9e57', x, y); P(c, '#4f9e57', x, y - 1);
      P(c, cc[0], x, y - 2); P(c, cc[1], x + 1, y - 2);
    }
    // setas
    for (i = 0; i < 3; i++) {
      var mx = 20 + i * 3 + Math.round(hash(i * 7.7) * 3);
      var my = gy + 4 + Math.round(hash(i * 3.1) * Math.max(1, H - gy - 8));
      if (my >= H - 1) continue;
      R(c, '#f7f0e2', mx, my - 1, 1, 2);
      R(c, '#e26a6a', mx - 1, my - 2, 3, 1);
      P(c, '#fff3e0', mx, my - 2);
    }
  }
  scene({
    id: 'parque', label: 'Parque Ronroneo', emoji: '🌳',
    draw: function (c, W, H, t) {
      var g = parqueGeo(H), gy = g.gy, sx = g.sx, top = g.top, x, y, i;
      c.drawImage(layer('parque', W, H, parqueBack), 0, 0);
      // nubes que pasan
      var cy0 = clamp(Math.round(gy * 0.18), 4, 30);
      var cl = [[0, cy0, 3, 1.5], [42, cy0 + Math.max(4, Math.round(gy * 0.16)), 2, 1.0], [76, Math.max(3, cy0 - 3), 2, 2.2]];
      for (i = 0; i < cl.length; i++) {
        var cx = ((cl[i][0] + t * cl[i][3]) % (W + 30)) - 22;
        if (cl[i][1] + cl[i][2] + 2 < gy - 4) cloud(c, cx, cl[i][1], cl[i][2], '#ffffff', '#e3eff8', '#bcd3e6');
      }
      // columpios que se balancean
      for (i = 0; i < 2; i++) {
        var base = sx - 5 + i * 10;
        var ang = Math.sin(t * 1.7 + i * 1.6) * 0.42;
        var ropeLen = 12;
        var seatX = base + Math.round(Math.sin(ang) * ropeLen);
        var seatY = top + 2 + Math.round(Math.cos(ang) * ropeLen);
        P(c, '#6f452c', base, top + 2); P(c, '#6f452c', seatX, seatY - 1);
        for (var r2 = 1; r2 < ropeLen; r2++) {
          var px = base + Math.round(Math.sin(ang) * r2);
          var py = top + 2 + Math.round(Math.cos(ang) * r2);
          P(c, '#6f452c', px, py);
        }
        R(c, '#e0637f', seatX - 2, seatY, 5, 2);
        R(c, '#ff8fab', seatX - 2, seatY, 5, 1);
      }
      // mariposas
      for (i = 0; i < 3; i++) {
        var bx = 18 + i * 24 + Math.sin(t * 0.9 + i * 2.2) * 12;
        var by = gy - 8 - Math.abs(Math.sin(t * 1.4 + i)) * Math.min(12, gy * 0.3);
        if (by < 4) continue;
        var open = (Math.floor(t * 8) + i) % 2 === 0;
        var col = i === 1 ? '#b49be0' : '#ff8fab';
        if (open) {
          R(c, col, bx - 2, by - 1, 2, 2); R(c, col, bx + 1, by - 1, 2, 2);
        } else {
          R(c, col, bx - 1, by - 2, 1, 2); R(c, col, bx + 1, by - 2, 1, 2);
        }
        R(c, INK, bx, by - 1, 1, 3);
      }
      // hojas que caen
      var N = clamp(Math.round(W * H / 320), 8, 40);
      for (i = 0; i < N; i++) {
        var sp = 3 + hash(i * 2.7) * 5;
        y = (hash(i * 3.9) * (H + 10) + t * sp) % (H + 10) - 5;
        x = ((hash(i * 6.1) * (W + 8) + t * 2 + Math.sin(t * 1.4 + i) * 3) % (W + 8)) - 4;
        var lc = i % 3 ? '#8fd07d' : '#ffd166';
        R(c, lc, x, y, 2, 1);
      }
      // pajaritos
      for (i = 0; i < 2; i++) {
        var px2 = ((i * 44 + t * (2 + i)) % (W + 12)) - 6;
        var py2 = clamp(Math.round(gy * (0.24 + i * 0.1)), 4, Math.max(6, gy - 6)) + Math.round(Math.sin(t * 2 + i) * 1);
        var up = (Math.floor(t * 6) + i) % 6 < 3;
        P(c, '#5d5a74', px2, py2); P(c, '#5d5a74', px2 - 1, py2 - (up ? 1 : 0)); P(c, '#5d5a74', px2 + 1, py2 - (up ? 1 : 0));
      }
    }
  });

  /* ================================================================== */
  /* ☕ Café del Ovillo                                                  */
  /* ================================================================== */
  var CAFE_BOOKS = ['#ff8fab', '#8ecae6', '#90be6d', '#f6bd60', '#cdb8de', '#f4a261', '#b8e0d2'];
  function cafeGeo(H) {
    var fy = clamp(Math.round(H * 0.64), 16, H - 10);
    return { fy: fy, wx: 6, wy: fy - 30 };
  }
  function woodFloor(c, W, H, fy) {
    R(c, '#d9a77b', 0, fy, W, H - fy);
    var y = fy, ph = 2, row = 0;
    while (y < H) {
      var nh = Math.max(2, Math.round(ph));
      R(c, '#e7bb92', 0, y, W, 1);
      var len = 14 + row * 3, off = Math.floor(hash(row * 17 + 3) * len);
      for (var x = -off; x < W; x += len) R(c, '#c08d63', x, y, 1, nh);
      y += nh + 1;
      ph *= 1.35; row++;
    }
    R(c, '#9b6a45', 0, fy, W, 1);
  }
  function cafeCup(c, x, y, col, t, seed, steamOn) {
    var O = '#3b2a40';
    R(c, O, x - 1, y - 5, 8, 6);
    R(c, col, x, y - 4, 6, 4);
    R(c, '#ffffff', x + 1, y - 4, 1, 2);
    R(c, O, x + 6, y - 4, 2, 1); R(c, O, x + 7, y - 4, 1, 3); R(c, O, x + 6, y - 2, 2, 1);
    R(c, O, x - 1, y, 8, 1);
    R(c, '#ffffff', x - 1, y - 1, 1, 1); R(c, '#ffffff', x + 6, y - 1, 1, 1);
    R(c, '#8a5a3b', x + 1, y - 4, 4, 1);
    if (steamOn) {
      for (var k = 0; k < 3; k++) {
        var sp = 5 + k;
        for (var n = 0; n < 3; n++) {
          var d = ((t * sp + n * 4 + k * 3.7 + (seed || 0)) % 10);
          var py = y - 5 - d;
          var px = x + 3 + k * 2 - 2 + Math.round(Math.sin(d / 2.4 + k) * 1.2);
          c.fillStyle = 'rgba(255,255,255,0.8)';
          c.fillRect(Math.round(px), Math.round(py), 1, 2);
        }
      }
    }
  }
  function cafeBack(c, W, H) {
    var g = cafeGeo(H), fy = g.fy, x, y, i;
    // pared
    R(c, '#f7e6d0', 0, 0, W, fy);
    for (x = 0; x < W; x += 8) R(c, '#f2dcbf', x, 0, 3, fy);
    // zocalo de madera
    var wy = fy - 12;
    R(c, '#7a4f33', 0, wy - 1, W, 1); R(c, '#e7b98f', 0, wy, W, 1);
    R(c, '#d29a6b', 0, wy + 1, W, fy - wy - 1);
    for (x = 2; x < W; x += 12) { R(c, '#c08657', x, wy + 3, 9, fy - wy - 6); R(c, '#dfac7e', x, wy + 3, 9, 1); }
    // ventana con cielo
    var ww = 26, wh = clamp(fy - 22, 8, 26), wx = g.wx, wy0 = g.wy;
    R(c, INK, wx - 2, wy0 - 2, ww + 4, wh + 4);
    R(c, '#fffaf5', wx - 1, wy0 - 1, ww + 2, wh + 2);
    R(c, '#bfe4ff', wx, wy0, ww, wh);
    R(c, '#d3edff', wx, wy0 + Math.round(wh * 0.5), ww, wh - Math.round(wh * 0.5));
    R(c, '#ffe9b8', wx + ww - 8, wy0 + 3, 4, 4);
    R(c, '#ffd98a', wx + ww - 7, wy0 + 4, 2, 2);
    R(c, '#ffffff', wx + 3, wy0 + Math.round(wh * 0.35), 6, 2);
    R(c, '#ffffff', wx + 5, wy0 + Math.round(wh * 0.35) - 1, 3, 1);
    R(c, '#fffaf5', wx + Math.floor(ww / 2) - 1, wy0, 2, wh);
    R(c, '#fffaf5', wx, wy0 + Math.floor(wh / 2), ww, 1);
    // alféizar y plantita
    R(c, INK, wx - 4, wy0 + wh + 2, ww + 8, 3);
    R(c, '#fffaf5', wx - 3, wy0 + wh + 2, ww + 6, 1);
    R(c, '#f1dfe4', wx - 3, wy0 + wh + 3, ww + 6, 1);
    var px = wx + ww - 8, py = wy0 + wh + 2;
    R(c, INK, px, py - 4, 5, 4); R(c, '#ef9a76', px + 1, py - 3, 3, 2);
    R(c, INK, px + 1, py - 8, 3, 4); R(c, '#9fd8a8', px + 2, py - 7, 1, 3);
    P(c, '#ff8fab', px + 2, py - 8);
    // estanteria con libros
    var sx = W - 30, sy = Math.max(2, fy - 46);
    R(c, INK, sx, sy, 29, fy + 2 - sy);
    R(c, '#9b6a45', sx + 1, sy + 1, 27, fy - sy);
    for (i = 0; i < 3; i++) {
      var shy = sy + 6 + i * 13;
      if (shy > fy - 6) break;
      R(c, '#5e3b28', sx + 2, shy, 25, 10);
      var bx = sx + 3, n = 0;
      while (bx < sx + 25) {
        var bwid = 2 + Math.floor(hash(i * 13 + n * 7) * 2);
        var bhei = 6 + Math.floor(hash(i * 5 + n * 3) * 3);
        var bcol = CAFE_BOOKS[Math.floor(hash(i * 7 + n * 11) * CAFE_BOOKS.length)];
        R(c, bcol, bx, shy + 10 - bhei, bwid, bhei);
        R(c, '#ffffff', bx, shy + 10 - bhei, bwid, 1);
        bx += bwid + 1; n++;
      }
      R(c, '#b98257', sx + 1, shy + 10, 27, 2);
      R(c, '#d29a6b', sx + 1, shy + 10, 27, 1);
    }
    // lamparas colgantes
    var ly = Math.max(4, Math.round(fy * 0.2));
    for (i = 0; i < 2; i++) {
      var lx2 = 22 + i * 48;
      R(c, '#6b5470', lx2, 0, 1, ly);
      R(c, INK, lx2 - 4, ly, 9, 2); R(c, INK, lx2 - 5, ly + 2, 11, 2); R(c, INK, lx2 - 6, ly + 4, 13, 2);
      R(c, '#ffd27a', lx2 - 3, ly + 1, 7, 1); R(c, '#ffd27a', lx2 - 4, ly + 3, 9, 1); R(c, '#ffc15a', lx2 - 5, ly + 5, 11, 1);
      R(c, '#ffe7a8', lx2 - 2, ly + 1, 1, 3);
    }
    // suelo
    woodFloor(c, W, H, fy);
    // alfombra
    var rcy = fy + Math.round((H - fy) * 0.6);
    var rry = clamp(Math.round((H - fy) * 0.26), 3, 13);
    var rcx = Math.round(W / 2);
    ellipse(c, rcx, rcy, 30, rry + 1, '#8a4f5f');
    ellipse(c, rcx, rcy - 1, 29, rry, '#d77a8f');
    ellipse(c, rcx, rcy - 1, 26, Math.max(1, rry - 1), '#f2b8a0');
    ellipse(c, rcx, rcy - 1, 23, Math.max(1, rry - 2), '#d77a8f');
    // mesas redondas con tazas
    function table(tx, ty) {
      ellipse(c, tx + 1, ty + 2, 9, 1, '#b98257');
      R(c, INK, tx - 1, ty - 10, 3, 11); R(c, '#9b6a45', tx, ty - 9, 1, 10);
      R(c, INK, tx - 8, ty - 11, 17, 3); R(c, '#fff8ee', tx - 7, ty - 10, 15, 1);
      R(c, '#e8d6c0', tx - 7, ty - 9, 15, 1);
      return ty - 11;
    }
    var t1 = table(18, fy + Math.max(4, Math.round((H - fy) * 0.28)));
    cafeCup(c, 14, t1, '#ffc6d6', 0, 0, false);
    cafeCup(c, 21, t1, '#c9f0e1', 0, 1, false);
    var t2 = table(72, fy + Math.max(4, Math.round((H - fy) * 0.22)));
    cafeCup(c, 68, t2, '#ffffff', 0, 2, false);
    // pastel sobre la segunda mesa
    R(c, INK, 75, t2 - 6, 9, 6); R(c, '#ffe0b8', 76, t2 - 5, 7, 4);
    R(c, INK, 77, t2 - 9, 7, 4); R(c, '#ffc6d6', 78, t2 - 8, 5, 3);
    P(c, '#e63946', 80, t2 - 9);
    // ovillo de lana en el suelo
    var oy = Math.min(H - 3, fy + Math.max(4, Math.round((H - fy) * 0.5)));
    ellipse(c, 66, oy, 4, 3, INK);
    ellipse(c, 66, oy, 3, 2, '#c9b6ec');
    R(c, '#e0d0f6', 65, oy - 1, 3, 1);
    P(c, '#a893cf', 64, oy);
  }
  scene({
    id: 'cafe', label: 'Café del Ovillo', emoji: '☕',
    draw: function (c, W, H, t) {
      var g = cafeGeo(H), fy = g.fy, i;
      c.drawImage(layer('cafe', W, H, cafeBack), 0, 0);
      // vapor de las tazas
      var t1 = fy + Math.max(4, Math.round((H - fy) * 0.28)) - 11;
      cafeCup(c, 14, t1, '#ffc6d6', t, 0, true);
      var t2 = fy + Math.max(4, Math.round((H - fy) * 0.22)) - 11;
      cafeCup(c, 68, t2, '#ffffff', t, 2, true);
      // destello de las lamparas
      for (i = 0; i < 2; i++) {
        var lx = 22 + i * 48;
        var ly = Math.max(4, Math.round(fy * 0.2));
        var fl = 0.16 + 0.03 * Math.sin(t * 3 + i * 2);
        c.fillStyle = 'rgba(255,214,140,' + fl.toFixed(3) + ')';
        c.fillRect(lx - 8, ly + 6, 17, 2);
        c.fillStyle = 'rgba(255,214,140,' + (fl * 0.5).toFixed(3) + ')';
        c.fillRect(lx - 11, ly + 8, 23, 3);
      }
      // el ovillo de lana rueda un poquito y su hilo se estira
      var oy = Math.min(H - 3, fy + Math.max(4, Math.round((H - fy) * 0.5)));
      var roll = Math.round(Math.sin(t * 0.7) * 3);
      var ox = 66 + roll;
      R(c, '#a893cf', ox - 6, oy, 4, 1);
      R(c, '#c9b6ec', ox - 3, oy + 1, 3, 1);
      P(c, '#a893cf', ox - 5, oy - 1);
      // motas de polvo en el haz de luz
      for (i = 0; i < 6; i++) {
        var dx = 14 + Math.round(hash(i * 3.3) * 16);
        var dy = (hash(i * 5.7) * (H - fy) + t * 2) % Math.max(1, H - fy);
        P(c, '#fff3d0', dx, fy + dy);
      }
    }
  });
})();
