/* Amigatos — utilidades de pixel art compartidas por los fondos (window.CatBGPixels)
 * Aquí viven las primitivas de dibujo (rectángulos, discos, degradados, nubes, estrellas...) y el
 * envoltorio que escala una escena a la base que pida el canvas.
 *
 * Cada escena del mundo vive en su propio archivo (public/js/bg/rooms/*.js) y usa estas
 * utilidades: no se duplican. Para pintar a otra base (por ejemplo 320×200) la escena se dibuja a
 * su ancho nativo (NATIVE_W) en un búfer y se escala con imageSmoothingEnabled = false, así el
 * pixel art se ve nítido, nunca borroso.
 */
(function () {
  'use strict';

  var INK = '#2b1a33';         // tinta ciruela (igual que cat-art)
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  /* ------------------------------------------------------------------ */
  /* utilidades                                                          */
  /* ------------------------------------------------------------------ */
  function th(x, y) { return (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  // rectangulo de pixeles (col primero, como en las escenas del mundo)
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
  // mezcla dos colores hex (#rrggbb) con k=0 (a) .. 1 (b)
  function mix(a, b, k) {
    function p(h, i) { return parseInt(h.substr(i, 2), 16); }
    function toHex(v) {
      var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length < 2 ? '0' + s : s;
    }
    return '#' + toHex(p(a, 1) + (p(b, 1) - p(a, 1)) * k)
      + toHex(p(a, 3) + (p(b, 3) - p(a, 3)) * k)
      + toHex(p(a, 5) + (p(b, 5) - p(a, 5)) * k);
  }

  /* ------------------------------------------------------------------ */
  /* capas estaticas en cache (por escena y tamano)                    */
  /* ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------ */
  /* envoltorio de escena                                                */
  /* ------------------------------------------------------------------ */
  // bufer para re-escalar cuando el canvas no mide el ancho nativo (miniaturas, 320x200, etc.)
  var bufs = {};
  function buffer(nw, H) {
    var k = nw + 'x' + H, b = bufs[k];
    if (!b) { b = bufs[k] = document.createElement('canvas'); b.width = nw; b.height = H; }
    return b;
  }

  // Envuelve el draw nativo de una escena: si el canvas pide otra base, la escena se pinta a su
  // ancho nativo y se escala SIN suavizado (nítido, nunca borroso).
  function scaled(def) {
    var nw = def.nativeW || 96;
    function draw(ctx, w, h, t) {
      if (w === nw) { def.draw(ctx, nw, h, t); return; }
      var H = Math.max(16, Math.round(h * nw / w));
      var off = buffer(nw, H), oc = off.getContext('2d');
      oc.imageSmoothingEnabled = false;
      oc.clearRect(0, 0, nw, H);
      def.draw(oc, nw, H, t);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, nw, H, 0, 0, w, h);
    }
    draw.nativeW = nw;
    return draw;
  }

  window.CatBGPixels = {
    INK: INK,
    BAYER: BAYER,
    th: th,
    clamp: clamp,
    hash: hash,
    R: R,
    P: P,
    disc: disc,
    ellipse: ellipse,
    rowDither: rowDither,
    vgrad: vgrad,
    cloud: cloud,
    sparkle: sparkle,
    star5: star5,
    heart5: heart5,
    groundY: groundY,
    mix: mix,
    layer: layer,
    scaled: scaled
  };
})();
