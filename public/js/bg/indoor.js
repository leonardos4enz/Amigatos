/* Amigatos — fondos de interior (pixel art procedural)
 * Se registran en window.CatBG (ver js/backgrounds.js). Todo se pinta con fillRect en pixeles lógicos.
 * El gato se para en el centro de abajo: el centro inferior es "suelo" tranquilo y el detalle va a los lados.
 */
(function () {
  'use strict';
  if (!window.CatBG) return;

  var O = '#3b2a40';      // contorno ciruela
  var WHITE = '#fffaf5';

  /* ------------------------------------------------------------------ */
  /* utilidades de pixel                                                 */
  /* ------------------------------------------------------------------ */
  function R(c, col, x, y, w, h) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    if (w <= 0 || h <= 0) return;
    c.fillStyle = col;
    c.fillRect(x, y, w, h);
  }
  function P(c, col, x, y) { R(c, col, x, y, 1, 1); }
  // caja con contorno de 1px
  function box(c, x, y, w, h, fill, ol) { R(c, ol || O, x, y, w, h); R(c, fill, x + 1, y + 1, w - 2, h - 2); }
  // caja con esquinas redondeadas (sin pixel de esquina)
  function rbox(c, x, y, w, h, fill, ol) {
    R(c, ol || O, x + 1, y, w - 2, h);
    R(c, ol || O, x, y + 1, w, h - 2);
    R(c, fill, x + 1, y + 1, w - 2, h - 2);
  }
  // tramado 50%
  function dith(c, col, x, y, w, h, ph) {
    x = Math.round(x); y = Math.round(y);
    c.fillStyle = col;
    for (var j = 0; j < h; j++) for (var i = (j + (ph || 0)) & 1; i < w; i += 2) c.fillRect(x + i, y + j, 1, 1);
  }
  // tramado 25%
  function dith4(c, col, x, y, w, h, ph) {
    x = Math.round(x); y = Math.round(y);
    c.fillStyle = col;
    for (var j = 0; j < h; j++) {
      if ((j + (ph || 0)) & 1) continue;
      for (var i = ((j >> 1) & 1) * 2; i < w; i += 4) c.fillRect(x + i, y + j, 1, 1);
    }
  }
  // elipse rellena (centro entero)
  function ell(c, col, cx, cy, rx, ry) {
    for (var j = -ry; j <= ry; j++) {
      var dx = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j * j) / ((ry + 0.5) * (ry + 0.5)))));
      R(c, col, cx - dx, cy + j, dx * 2 + 1, 1);
    }
  }
  // elipse con contorno
  function oell(c, fill, cx, cy, rx, ry, ol) { ell(c, ol || O, cx, cy, rx + 1, ry + 1); ell(c, fill, cx, cy, rx, ry); }
  function line(c, col, x0, y0, x1, y1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy;
    c.fillStyle = col;
    for (var n = 0; n < 400; n++) {
      c.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function hash(a) {
    a |= 0;
    a = Math.imul(a ^ (a >>> 16), 0x45d9f3b);
    a = Math.imul(a ^ (a >>> 16), 0x45d9f3b);
    a ^= a >>> 16;
    return (a >>> 0) / 4294967296;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // línea del suelo: proporción del alto, con un mínimo de suelo visible
  function floorY(h) { return clamp(Math.round(h * 0.64), 14, h - 8); }

  // suelo de tablones con perspectiva (tablones más altos hacia abajo)
  function woodFloor(c, w, h, fy, base, light, dark, seam) {
    R(c, base, 0, fy, w, h - fy);
    var y = fy, ph = 2, row = 0;
    while (y < h) {
      var nh = Math.max(2, Math.round(ph));
      R(c, light, 0, y, w, 1);
      var len = 16 + row * 4, off = Math.floor(hash(row * 31 + 7) * len);
      for (var x = -off; x < w; x += len) R(c, seam, x, y, 1, nh);
      y += nh;
      R(c, dark, 0, y, w, 1);
      y += 1;
      ph *= 1.4; row++;
    }
  }
  // zócalo
  function baseboard(c, w, fy, top, col, shade) {
    R(c, top, 0, fy - 4, w, 1);
    R(c, col, 0, fy - 3, w, 3);
    R(c, shade, 0, fy - 1, w, 1);
  }
  // sombra suave sobre el suelo
  function shadow(c, col, cx, cy, rx) {
    dith(c, col, cx - rx, cy, rx * 2 + 1, 1, 0);
    dith(c, col, cx - rx + 2, cy + 1, rx * 2 - 3, 1, 1);
  }

  /* ---------- piezas reutilizables ---------- */
  function heartTiny(c, col, x, y) { P(c, col, x, y); P(c, col, x + 2, y); R(c, col, x, y + 1, 3, 1); P(c, col, x + 1, y + 2); }
  function heart5(c, col, x, y) {
    R(c, col, x, y, 2, 1); R(c, col, x + 3, y, 2, 1);
    R(c, col, x, y + 1, 5, 1); R(c, col, x + 1, y + 2, 3, 1); P(c, col, x + 2, y + 3);
  }

  // pez pequeño mirando a la derecha (cuerpo 7×4)
  function fish(c, x, y, body, dark) {
    // cola
    R(c, O, x - 1, y - 1, 1, 6);
    R(c, O, x, y, 2, 4);
    R(c, dark, x, y + 1, 1, 2);
    // cuerpo
    R(c, O, x + 3, y - 1, 6, 6);
    R(c, O, x + 2, y, 8, 4);
    R(c, body, x + 3, y, 6, 4);
    R(c, dark, x + 3, y + 3, 6, 1);
    R(c, '#ffffff', x + 4, y, 3, 1);
    P(c, O, x + 7, y + 1);
    P(c, dark, x + 5, y + 1); P(c, dark, x + 5, y + 2);
  }

  // vapor que sube (columnas de pixeles con ondita)
  function steam(c, x, y, height, t, seed) {
    for (var k = 0; k < 3; k++) {
      var sp = 5 + k;
      for (var n = 0; n < 3; n++) {
        var d = ((t * sp + n * height / 3 + k * 3.7 + seed) % height);
        var py = y - d;
        var px = x + k * 2 - 2 + Math.round(Math.sin(d / 2.4 + k + seed) * 1.2);
        var a = 1 - d / height;
        c.fillStyle = 'rgba(214,200,226,' + (0.75 * a).toFixed(2) + ')';
        c.fillRect(Math.round(px) + 1, Math.round(py) + 1, 1, 2);
        c.fillStyle = 'rgba(255,255,255,' + (0.95 * a).toFixed(2) + ')';
        c.fillRect(Math.round(px), Math.round(py), 1, 2);
      }
    }
  }

  // planta en maceta (x = izquierda de la maceta, by = base)
  function plant(c, x, by, t, pot, potD, potL) {
    var sw = Math.sin(t * 1.4);
    var g = '#8fd19e', gd = '#5fae7b', gl = '#c3ecc8';
    var leaves = [[-4, -15, 1], [5, -17, 0], [11, -13, 1], [1, -21, 0], [-1, -10, 1], [9, -8, 0]];
    for (var i = 0; i < leaves.length; i++) {
      var L = leaves[i];
      var dx = i % 2 ? Math.round(sw * 0.7) : Math.round(-sw * 0.6);
      if (L[1] > -12) dx = 0;
      var lx = x + 4 + L[0] + dx, ly = by - 6 + L[1] + 6;
      line(c, gd, x + 5, by - 8, lx, ly + 2);
      oell(c, g, lx, ly, 3, 2);
      R(c, gl, lx - 2, ly - 1, 2, 1);
      R(c, gd, lx - 1 + (L[2] ? -1 : 1), ly + 1, 3, 1);
    }
    // maceta
    R(c, O, x, by - 9, 11, 3);
    R(c, potL, x + 1, by - 8, 9, 1);
    R(c, O, x + 1, by - 6, 9, 6);
    R(c, pot, x + 2, by - 6, 7, 5);
    R(c, potD, x + 7, by - 6, 2, 5);
    R(c, potL, x + 2, by - 6, 1, 4);
  }

  // marco de cuadro
  function frame(c, x, y, w, h, wood, bg) {
    box(c, x, y, w, h, wood);
    box(c, x + 2, y + 2, w - 4, h - 4, bg);
    P(c, '#fff3e0', x + 1, y + 1);
  }

  // guirnalda de lucecitas
  function fairyLights(c, w, y0, sag, t, step) {
    var cols = ['#ff8fab', '#ffd166', '#8ecae6', '#b9f0c9', '#cdb8de'];
    for (var x = 0; x < w; x++) {
      var u = x / (w - 1);
      P(c, '#7a6370', x, y0 + Math.round(sag * 4 * u * (1 - u)));
    }
    for (var i = 0, xx = 3; xx < w; xx += step, i++) {
      var uu = xx / (w - 1);
      var yy = y0 + Math.round(sag * 4 * uu * (1 - uu)) + 1;
      var on = hash(i * 13 + Math.floor(t * 2.5)) > 0.25;
      var col = cols[i % cols.length];
      if (on) { c.fillStyle = 'rgba(255,245,200,0.45)'; c.fillRect(xx - 1, yy - 1, 3, 4); }
      R(c, O, xx, yy, 1, 1);
      R(c, on ? col : '#d9c9d3', xx, yy + 1, 1, 2);
      if (on) P(c, '#ffffff', xx, yy + 1);
    }
  }

  /* ------------------------------------------------------------------ */
  /* 🛏️ Mi cuartito (por defecto)                                        */
  /* ------------------------------------------------------------------ */
  function cuarto(c, w, h, t) {
    var fy = floorY(h);
    // pared con rayas y corazoncitos
    R(c, '#ffe7ee', 0, 0, w, fy);
    for (var x = 0; x < w; x += 12) R(c, '#ffdde8', x, 0, 6, fy);
    for (var y = 5, r = 0; y < fy - 6; y += 9, r++) {
      for (var x2 = (r % 2 ? 7 : 1); x2 < w; x2 += 12) heartTiny(c, '#ffc8d7', x2, y);
    }
    R(c, '#f8cdda', 0, 0, w, 2);
    R(c, '#fff4f7', 0, 2, w, 1);

    // ventana con nubes
    var ww = 26, wh = clamp(fy - 18, 8, 28), wx = 7, wy = fy - 13 - wh;
    R(c, O, wx - 2, wy - 2, ww + 4, wh + 4);
    R(c, WHITE, wx - 1, wy - 1, ww + 2, wh + 2);
    R(c, '#bfe4ff', wx, wy, ww, wh);
    R(c, '#d3edff', wx, wy + Math.round(wh * 0.45), ww, wh);
    R(c, '#e6f6ff', wx, wy + Math.round(wh * 0.75), ww, wh - Math.round(wh * 0.75));
    dith(c, '#d3edff', wx, wy + Math.round(wh * 0.45) - 1, ww, 1, 0);
    dith(c, '#e6f6ff', wx, wy + Math.round(wh * 0.75) - 1, ww, 1, 1);
    c.save();
    c.beginPath(); c.rect(wx, wy, ww, wh); c.clip();
    // sol
    oell(c, '#fff1a8', wx + ww - 7, wy + 4, 3, 3, '#ffe28a');
    for (var k = 0; k < 3; k++) {
      var span = ww + 16;
      var cxp = wx - 10 + ((t * (1.2 + k * 0.5) + k * 11) % span);
      var cyp = wy + 3 + k * Math.max(3, Math.round(wh / 4));
      R(c, '#ffffff', cxp, cyp + 1, 9, 2);
      R(c, '#ffffff', cxp + 2, cyp, 4, 1);
      R(c, '#ffffff', cxp + 1, cyp + 3, 7, 1);
      R(c, '#dcefff', cxp + 2, cyp + 3, 6, 1);
    }
    c.restore();
    // cruceta
    R(c, WHITE, wx + Math.floor(ww / 2) - 1, wy, 2, wh);
    R(c, WHITE, wx, wy + Math.floor(wh / 2), ww, 1);
    R(c, 'rgba(255,255,255,0.7)', wx + 2, wy + 2, 1, 3);
    R(c, 'rgba(255,255,255,0.7)', wx + 3, wy + 2, 1, 1);
    // alféizar
    R(c, O, wx - 4, wy + wh + 2, ww + 8, 3);
    R(c, WHITE, wx - 3, wy + wh + 2, ww + 6, 1);
    R(c, '#f1dfe4', wx - 3, wy + wh + 3, ww + 6, 1);
    // cactus en el alféizar
    var kx = wx + ww - 7, ky = wy + wh + 1;
    R(c, O, kx, ky - 3, 5, 4); R(c, '#f4a98a', kx + 1, ky - 2, 3, 2);
    R(c, O, kx + 1, ky - 8, 3, 5); R(c, '#9fd8a8', kx + 2, ky - 7, 1, 4);
    P(c, '#ff8fab', kx + 2, ky - 8);
    // cortinas
    var cy0 = wy - 4, ch = wh + 7;
    R(c, '#b0896b', wx - 6, cy0, ww + 12, 1);
    R(c, O, wx - 7, cy0 - 1, 2, 3); R(c, O, wx + ww + 5, cy0 - 1, 2, 3);
    for (var s = 0; s < 2; s++) {
      for (var j = 0; j < ch; j++) {
        var tie = Math.round(ch * 0.62);
        var cw = j < tie ? 6 - Math.round(3 * j / tie) : 3 + Math.round((j - tie) / 2);
        cw = Math.min(cw, 6);
        var xL = s === 0 ? wx - 5 : wx + ww + 5 - cw;
        R(c, O, xL - 1, cy0 + 1 + j, cw + 2, 1);
        R(c, '#ffb3c7', xL, cy0 + 1 + j, cw, 1);
        P(c, '#f590ad', s === 0 ? xL + 1 : xL + cw - 2, cy0 + 1 + j);
        if (cw > 3) P(c, '#ffd3df', s === 0 ? xL + 3 : xL + cw - 4, cy0 + 1 + j);
      }
      var tx = s === 0 ? wx - 5 : wx + ww + 2;
      R(c, '#ffd166', tx, cy0 + 1 + Math.round(ch * 0.62), 3, 1);
      R(c, O, s === 0 ? wx - 6 : wx + ww + 1, cy0 + 1 + ch, 1, 0);
    }

    // cuadro con corazón
    var fw = 15, fh = 12, fx = w - 22, fry = Math.max(4, fy - 28);
    frame(c, fx, fry, fw, fh, '#e0a96d', '#c9f0e1');
    heart5(c, '#ff8fab', fx + 5, fry + 4);
    P(c, '#ffd3df', fx + 5, fry + 4);
    line(c, '#9b6a45', fx + 3, fry - 1, fx + 7, fry - 4); line(c, '#9b6a45', fx + 11, fry - 1, fx + 7, fry - 4);
    P(c, O, fx + 7, fry - 4);
    // repisita con libros en paredes altas
    if (fy >= 62) {
      var sy = fy - 50, sx = w - 30;
      R(c, O, sx, sy, 26, 3); R(c, '#e0a96d', sx + 1, sy + 1, 24, 1);
      var bc = ['#8ecae6', '#ffd166', '#cdb8de', '#90be6d'];
      for (var b = 0; b < 4; b++) { box(c, sx + 2 + b * 4, sy - 7 + (b % 2), 4, 7 - (b % 2), bc[b]); }
      oell(c, '#f7f3ee', sx + 20, sy - 3, 3, 2); P(c, O, sx + 19, sy - 4); P(c, O, sx + 21, sy - 4);
      R(c, '#f6c1cc', sx + 17, sy - 6, 1, 1); R(c, '#f6c1cc', sx + 23, sy - 6, 1, 1);
      // otro cuadrito
      if (fy >= 76) { frame(c, 12, fy - 62, 12, 14, '#cdb8de', '#fff1dc');
      R(c, '#ffd166', 17, fy - 57, 2, 2); R(c, '#90be6d', 15, fy - 54, 6, 2); }
    }

    // suelo de madera
    woodFloor(c, w, h, fy, '#f0c9a0', '#f7dbbb', '#dcac7d', '#d29e6f');
    baseboard(c, w, fy, '#e7b9c6', WHITE, '#f0dde2');
    R(c, '#d6a273', 0, fy, w, 1);
    // luz de la ventana sobre el suelo
    var fd = h - fy;
    for (var j2 = 1; j2 < fd; j2++) {
      var lx0 = wx + 2 + j2 * 0.9, lw = ww - 6 + j2 * 0.3;
      dith(c, '#fbe6cc', lx0, fy + j2, lw, 1, j2);
    }

    // alfombra redonda bajo el gato
    var rcy = fy + Math.round(fd * 0.56), rry = clamp(Math.round(fd * 0.28), 3, 14), rrx = 31;
    ell(c, '#d9a0b4', w / 2, rcy + 1, rrx + 1, rry + 1);
    oell(c, '#ffc6d6', w / 2, rcy, rrx, rry, '#d987a6');
    ell(c, '#fff0f4', w / 2, rcy, rrx - 3, Math.max(1, rry - 1));
    ell(c, '#ffd6e1', w / 2, rcy, rrx - 5, Math.max(1, rry - 2));
    for (var fz = -rry + 1; fz < rry; fz += 2) { P(c, '#f3a6bd', w / 2 - rrx - 2, rcy + fz); P(c, '#f3a6bd', w / 2 + rrx + 2, rcy + fz); }

    // camita del gato (derecha)
    var bx = w - 27, by = fy + Math.max(1, Math.round(fd * 0.18));
    shadow(c, '#d6a273', bx + 12, by + 5, 12);
    rbox(c, bx, by - 8, 26, 13, '#c9b6ec');
    R(c, '#a993d6', bx + 1, by + 1, 24, 3);
    R(c, '#ddd0f6', bx + 2, by - 7, 22, 1);
    rbox(c, bx + 3, by - 5, 20, 6, '#fff1dc', '#8f78bf');
    R(c, '#f7dcc0', bx + 4, by - 1, 18, 1);
    for (var d2 = 0; d2 < 4; d2++) P(c, '#ffffff', bx + 4 + d2 * 6, by - 7);
    // ratoncito de juguete
    R(c, O, bx + 14, by - 6, 6, 4); R(c, '#cfc6d6', bx + 15, by - 5, 4, 2);
    P(c, '#ff8fab', bx + 15, by - 7); P(c, O, bx + 18, by - 5); line(c, '#ff8fab', bx + 13, by - 4, bx + 11, by - 3);

    // planta (izquierda)
    plant(c, 2, fy + Math.max(2, Math.round(fd * 0.2)), t, '#ef9a76', '#cf7656', '#f8b998');

    // lucecitas arriba
    if (fy >= 38) fairyLights(c, w, 4, Math.min(8, Math.round(fy / 8)), t, 8);
  }

  /* ------------------------------------------------------------------ */
  /* 🍳 Cocina                                                           */
  /* ------------------------------------------------------------------ */
  function counter(c, x, w, fy, h, body, bodyD, top) {
    var y0 = fy - 9, bot = fy + Math.max(3, Math.round((h - fy) * 0.18));
    R(c, O, x - 1, y0, w + 2, bot - y0 + 1);
    R(c, body, x, y0 + 3, w, bot - y0 - 3);
    R(c, bodyD, x, bot - 2, w, 2);
    R(c, top, x - 1, y0 + 1, w + 2, 2);
    R(c, '#ffffff', x - 1, y0 + 1, w + 2, 1);
    R(c, O, x - 1, y0 + 3, w + 2, 1);
    // puertas
    var n = Math.max(1, Math.round(w / 13)), dw = Math.floor(w / n);
    for (var i = 0; i < n; i++) {
      var dx = x + i * dw;
      R(c, bodyD, dx, y0 + 4, 1, bot - y0 - 6);
      R(c, '#ffffff', dx + 2, y0 + 5, dw - 4, 1);
      P(c, O, dx + (i % 2 ? 2 : dw - 3), y0 + 7);
    }
    return y0;
  }
  function jar(c, x, y, w, h, lid, fill, fillD) {
    box(c, x, y - h, w, h, '#eef8ff');
    R(c, fill, x + 1, y - h + 3, w - 2, h - 4);
    dith(c, fillD, x + 1, y - h + 3, w - 2, h - 4, 0);
    R(c, '#ffffff', x + 1, y - h + 2, 1, h - 3);
    R(c, O, x, y - h - 2, w, 2); R(c, lid, x + 1, y - h - 1, w - 2, 1);
    R(c, '#fff8e7', x + 1, y - Math.round(h / 2) - 1, w - 2, 2);
  }
  function cocina(c, w, h, t) {
    var fy = floorY(h);
    // pared crema con florecitas
    R(c, '#fff4e3', 0, 0, w, fy);
    for (var y = 4, r = 0; y < fy - 22; y += 10, r++) {
      for (var x = (r % 2 ? 9 : 3); x < w; x += 12) { P(c, '#ffd6c2', x, y); P(c, '#ffd6c2', x - 1, y + 1); P(c, '#ffd6c2', x + 1, y + 1); P(c, '#ffd6c2', x, y + 2); P(c, '#ffe9a8', x, y + 1); }
    }
    // azulejos menta
    var ty = Math.max(0, fy - 22);
    R(c, '#d3f1e4', 0, ty, w, fy - ty);
    for (var yy = ty; yy < fy; yy += 6) {
      R(c, '#b5e0cf', 0, yy, w, 1);
      for (var xx = ((yy - ty) / 6 % 2 ? 3 : 0); xx < w; xx += 7) { R(c, '#b5e0cf', xx, yy, 1, 6); P(c, '#effbf6', xx + 1, yy + 1); P(c, '#effbf6', xx + 2, yy + 1); }
    }
    R(c, '#9ccfbb', 0, ty, w, 1);

    // reloj en la pared
    if (fy >= 34) {
      var kx = Math.round(w / 2), ky = Math.max(6, Math.round(fy * 0.22));
      if (ky + 5 < ty) {
        oell(c, '#fffdf7', kx, ky, 4, 4, O);
        ell(c, '#ffb3c7', kx, ky, 5, 5); oell(c, '#fffdf7', kx, ky, 4, 4, O);
        R(c, '#ffffff', kx, ky - 4, 1, 1);
        var ang = t * 0.5, ax = Math.round(Math.sin(ang) * 3), ay = Math.round(-Math.cos(ang) * 3);
        line(c, O, kx, ky, kx + ax, ky + ay); line(c, '#e63946', kx, ky, kx + 2, ky - 1);
        P(c, O, kx, ky);
      }
    }

    // repisas con frascos
    var sh = Math.max(3, fy - 31);
    function shelf(x0, wd, sy) {
      R(c, O, x0, sy, wd, 3); R(c, '#f0b98c', x0 + 1, sy + 1, wd - 2, 1);
      R(c, O, x0 + 2, sy + 3, 1, 2); R(c, O, x0 + wd - 3, sy + 3, 1, 2);
    }
    shelf(1, 28, sh);
    jar(c, 3, sh, 7, 9, '#ff8fab', '#f6d29a', '#e9b464');
    jar(c, 11, sh, 6, 7, '#8ecae6', '#ffffff', '#e8e3dc');
    jar(c, 19, sh, 8, 10, '#90be6d', '#c98d62', '#9b6a45');
    shelf(w - 29, 28, sh);
    // taza colgando de la repisa y frascos
    jar(c, w - 26, sh, 7, 8, '#ffd166', '#ff9aa2', '#f07a87');
    box(c, w - 17, sh - 6, 6, 6, '#c9b6ec'); R(c, O, w - 11, sh - 5, 2, 1); R(c, O, w - 10, sh - 5, 1, 3); R(c, O, w - 11, sh - 3, 2, 1);
    heartTiny(c, '#ffffff', w - 16, sh - 4);
    jar(c, w - 8, sh, 5, 6, '#ff8fab', '#b8e0d2', '#8ecbb5');
    // segunda repisa en paredes altas
    if (fy >= 60) {
      var sh2 = sh - 22;
      shelf(1, 28, sh2);
      jar(c, 4, sh2, 6, 8, '#cdb8de', '#ffd166', '#e9b464');
      oell(c, '#ffffff', 18, sh2 - 3, 5, 2); R(c, '#e8e3dc', 14, sh2 - 2, 9, 1);
      shelf(w - 29, 28, sh2);
      for (var u = 0; u < 3; u++) { line(c, O, w - 22 + u * 6, sh2 + 3, w - 22 + u * 6, sh2 + 9); }
      oell(c, '#ff8fab', w - 22, sh2 + 10, 1, 1); R(c, O, w - 17, sh2 + 9, 3, 3); R(c, '#ffd166', w - 11, sh2 + 9, 2, 4);
    }

    // suelo a cuadros
    var fd = h - fy;
    R(c, '#fff3f4', 0, fy, w, fd);
    var ry = fy, rh = 2, row = 0;
    while (ry < h) {
      var hh = Math.max(2, Math.round(rh));
      for (var cx = (row % 2) * 8 - 4; cx < w; cx += 16) { R(c, '#ffd3de', cx, ry, 8, hh); R(c, '#ffe3ea', cx, ry, 8, 1); }
      ry += hh; rh *= 1.35; row++;
    }
    R(c, '#e8b3c2', 0, fy, w, 1);

    // encimeras
    var y0 = counter(c, 0, 26, fy, h, '#a8e0cc', '#86c9b2', '#fff8ee');
    counter(c, w - 26, 26, fy, h, '#a8e0cc', '#86c9b2', '#fff8ee');
    // olla con vapor (izquierda)
    var px = 4;
    R(c, O, px - 1, y0 - 2, 18, 3); R(c, '#4a4553', px, y0 - 1, 16, 1); // hornilla
    box(c, px, y0 - 9, 16, 8, '#9fb8e0');
    R(c, '#7f9ccc', px + 1, y0 - 4, 14, 2);
    R(c, '#c8d8f2', px + 2, y0 - 8, 2, 4);
    R(c, O, px - 2, y0 - 7, 2, 1); R(c, O, px + 16, y0 - 7, 2, 1);
    R(c, O, px + 1, y0 - 10, 14, 1); R(c, O, px + 7, y0 - 12, 2, 2);
    steam(c, px + 8, y0 - 12, 14, t, 0);
    // plato con pescado (derecha)
    var plx = w - 13, ply = y0 - 1;
    ell(c, O, plx, ply, 10, 2); ell(c, '#ffffff', plx, ply, 9, 1); R(c, '#e8e3dc', plx - 8, ply + 1, 17, 1);
    fish(c, plx - 6, ply - 5, '#8ecae6', '#5fa8cc');
    // ramita de perejil
    P(c, '#90be6d', plx + 6, ply - 1); P(c, '#90be6d', plx + 7, ply - 2);
  }

  /* ------------------------------------------------------------------ */
  /* ☕ Cafetería gatuna                                                  */
  /* ------------------------------------------------------------------ */
  function cup(c, x, y, col, t, smoke, seed) {
    box(c, x, y - 5, 6, 5, col);
    R(c, '#ffffff', x + 1, y - 4, 1, 2);
    R(c, O, x + 6, y - 4, 2, 1); R(c, O, x + 7, y - 4, 1, 3); R(c, O, x + 6, y - 2, 2, 1);
    R(c, O, x - 1, y, 8, 1); R(c, '#ffffff', x - 1, y - 1, 1, 1); R(c, '#ffffff', x + 6, y - 1, 1, 1);
    R(c, '#8a5a3b', x + 1, y - 5, 4, 1);
    if (smoke) steam(c, x + 3, y - 6, 10, t, seed || 0);
  }
  function lamp(c, x, y, t, i) {
    var fl = 0.2 + 0.05 * Math.sin(t * 3 + i * 2) + (hash(Math.floor(t * 8) + i * 99) > 0.93 ? -0.06 : 0);
    for (var r = 12; r > 3; r -= 3) {
      c.fillStyle = 'rgba(255,226,150,' + (fl * (1 - r / 14)).toFixed(3) + ')';
      ell(c, c.fillStyle, x, y + 5, r, Math.round(r * 0.8));
    }
    line(c, '#6b5470', x, 0, x, y - 1);
    R(c, O, x - 1, y - 1, 3, 1);
    R(c, O, x - 3, y, 7, 1); R(c, O, x - 4, y + 1, 9, 2); R(c, O, x - 5, y + 3, 11, 2);
    R(c, '#ffd27a', x - 2, y + 1, 5, 1); R(c, '#ffd27a', x - 3, y + 2, 7, 1); R(c, '#ffc15a', x - 4, y + 3, 9, 1);
    R(c, '#ffe7a8', x - 2, y + 1, 1, 2);
    R(c, '#fff7d1', x - 1, y + 5, 3, 1); R(c, O, x - 2, y + 5, 1, 1); R(c, O, x + 2, y + 5, 1, 1); R(c, O, x - 1, y + 6, 3, 1);
  }
  function cafeteria(c, w, h, t) {
    var fy = floorY(h);
    // pared: rayas crema
    R(c, '#fcefdc', 0, 0, w, fy);
    for (var x = 2; x < w; x += 8) R(c, '#f6e2c6', x, 0, 3, fy);
    // friso de madera abajo
    var wy = fy - 12;
    R(c, '#7a4f33', 0, wy - 1, w, 1); R(c, '#e7b98f', 0, wy, w, 1);
    R(c, '#d29a6b', 0, wy + 1, w, fy - wy - 1);
    for (var px = 2; px < w; px += 12) { R(c, '#c08657', px, wy + 3, 9, fy - wy - 6); R(c, '#dfac7e', px, wy + 3, 9, 1); }

    // pizarra con menú y pescado
    var bw = 28, bh = clamp(fy - 20, 10, 24), bx = 3, by = wy - 4 - bh;
    R(c, O, bx - 1, by - 1, bw + 2, bh + 2);
    R(c, '#c98d62', bx, by, bw, bh);
    R(c, '#556f68', bx + 2, by + 2, bw - 4, bh - 4);
    dith4(c, '#5e7a72', bx + 2, by + 2, bw - 4, bh - 4, 0);
    // "MENÚ" en tiza: rayitas
    R(c, '#fff8ee', bx + 5, by + 4, 12, 1); P(c, '#ffc6d6', bx + 19, by + 4); P(c, '#ffc6d6', bx + 21, by + 4);
    if (bh >= 14) {
      // pescadito de tiza
      var fx = bx + 6, fy2 = by + 7;
      R(c, '#ffc6d6', fx + 2, fy2, 6, 1); R(c, '#ffc6d6', fx + 1, fy2 + 1, 1, 2); R(c, '#ffc6d6', fx + 2, fy2 + 3, 6, 1);
      P(c, '#ffc6d6', fx + 8, fy2 + 1); P(c, '#ffc6d6', fx + 8, fy2 + 2); P(c, '#ffc6d6', fx + 6, fy2 + 1);
      P(c, '#ffc6d6', fx, fy2); P(c, '#ffc6d6', fx, fy2 + 3); P(c, '#ffc6d6', fx - 1, fy2 - 1); P(c, '#ffc6d6', fx - 1, fy2 + 4);
      R(c, '#fff8ee', bx + 17, by + 8, 6, 1); R(c, '#fff8ee', bx + 17, by + 10, 4, 1);
      for (var ln = by + 13; ln < by + bh - 3; ln += 3) { R(c, '#e8efe9', bx + 5, ln, 10 + (ln % 4), 1); P(c, '#ffd166', bx + bw - 6, ln); }
    }
    R(c, O, bx + 4, by + bh, bw - 8, 2); R(c, '#ffffff', bx + 6, by + bh, 2, 1);

    // lámparas colgantes
    var ly = Math.max(2, Math.round(fy * 0.22));
    lamp(c, 16, ly, t, 0);
    lamp(c, Math.round(w / 2), Math.max(2, ly - 3), t, 1);
    lamp(c, w - 16, ly, t, 2);

    // suelo de madera cálida
    woodFloor(c, w, h, fy, '#d9a77b', '#e7bb92', '#c08d63', '#b98257');
    R(c, '#9b6a45', 0, fy, w, 1);

    // barra (derecha) con cafetera
    var fd = h - fy;
    var cx0 = w - 32, ctop = fy - 12, cbot = fy + Math.max(3, Math.round(fd * 0.22));
    R(c, O, cx0 - 1, ctop, 34, cbot - ctop + 1);
    R(c, '#ffb3c7', cx0, ctop + 3, 33, cbot - ctop - 3);
    for (var sx = cx0 + 1; sx < w; sx += 4) R(c, '#ffd3df', sx, ctop + 4, 2, cbot - ctop - 6);
    R(c, '#f590ad', cx0, cbot - 2, 33, 2);
    R(c, '#f3d9b8', cx0 - 1, ctop + 1, 34, 2); R(c, '#fff3e0', cx0 - 1, ctop + 1, 34, 1); R(c, O, cx0 - 1, ctop + 3, 34, 1);
    // cafetera
    var mx = w - 15;
    box(c, mx, ctop - 15, 13, 16, '#ff9fb8');
    R(c, '#dfe6ee', mx + 1, ctop - 14, 11, 3); R(c, '#ffffff', mx + 2, ctop - 14, 3, 1);
    R(c, '#f17f9d', mx + 1, ctop - 3, 11, 2);
    R(c, O, mx + 5, ctop - 11, 4, 2); P(c, '#ffd166', mx + 2, ctop - 10); P(c, '#90be6d', mx + 10, ctop - 10);
    R(c, '#f7f3ee', mx + 3, ctop - 8, 7, 4); cup(c, mx + 4, ctop - 2, '#ffffff', t, false);
    R(c, O, mx + 6, ctop - 8, 1, 1);
    steam(c, mx + 7, ctop - 9, 6, t, 4);
    // tazas apiladas y una con vapor
    cup(c, cx0 + 2, ctop, '#c9f0e1', t, true, 1);
    cup(c, cx0 + 11, ctop, '#cdb8de', t, false);
    cup(c, cx0 + 11, ctop - 5, '#ffd166', t, false);

    // mesita redonda (izquierda) con taza
    var tx = 11, tyy = fy + Math.max(1, Math.round(fd * 0.25));
    shadow(c, '#b98257', tx, tyy + 1, 7);
    R(c, O, tx - 1, tyy - 9, 3, 10); R(c, '#9b6a45', tx, tyy - 9, 1, 9);
    R(c, O, tx - 4, tyy, 9, 1);
    oell(c, '#fff8ee', tx, tyy - 10, 9, 1); R(c, '#e8d6c0', tx - 8, tyy - 9, 17, 1);
    cup(c, tx - 3, tyy - 11, '#ffc6d6', t, true, 2);
  }

  /* ------------------------------------------------------------------ */
  /* 📚 Biblioteca                                                       */
  /* ------------------------------------------------------------------ */
  var BOOKS = ['#ff8fab', '#8ecae6', '#90be6d', '#f6bd60', '#cdb8de', '#f4a261', '#b8e0d2', '#e98a9e', '#7fa7d9', '#ffd166'];
  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function f(v) { return Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k); }
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }
  function bookcase(c, x, w, top, bot, seed) {
    R(c, O, x, top, w, bot - top);
    R(c, '#9b6a45', x + 1, top, w - 2, bot - top - 1);
    R(c, '#b98257', x + 1, top, 1, bot - top - 1);
    var sh = 12;
    for (var sy = bot - 3, row = 0; sy - sh + 3 > top; sy -= sh, row++) {
      // hueco
      R(c, '#5e3b28', x + 3, sy - sh + 3, w - 6, sh - 3);
      R(c, '#4a2e20', x + 3, sy - sh + 3, w - 6, 1);
      // libros
      var bx = x + 3, n = 0;
      while (bx < x + w - 4) {
        var hsh = hash(seed * 101 + row * 17 + n * 7);
        var bw = 2 + Math.floor(hsh * 2.2);
        var bh = 6 + Math.floor(hash(seed + row * 5 + n * 13) * 3);
        if (bx + bw > x + w - 3) bw = x + w - 3 - bx;
        if (hash(seed * 3 + row * 11 + n) < 0.1 && bw > 1) {
          // hueco con estrellita/planta
          bx += 2; n++; continue;
        }
        var col = BOOKS[Math.floor(hash(seed * 7 + row * 29 + n * 3) * BOOKS.length)];
        R(c, col, bx, sy - bh, bw, bh);
        R(c, shade(col, -0.25), bx + bw - 1, sy - bh, 1, bh);
        R(c, shade(col, 0.45), bx, sy - bh + 2, bw - (bw > 2 ? 1 : 0), 1);
        P(c, shade(col, -0.35), bx, sy - bh);
        bx += bw; n++;
      }
      // tabla
      R(c, '#b98257', x + 1, sy, w - 2, 2); R(c, '#d29a6b', x + 1, sy, w - 2, 1);
      R(c, O, x + 1, sy + 2, w - 2, 1);
    }
  }
  function biblioteca(c, w, h, t) {
    var fy = floorY(h);
    // pared cálida con papel de rombos
    R(c, '#f5dfc7', 0, 0, w, fy);
    for (var y = 3, r = 0; y < fy; y += 6, r++) for (var x = (r % 2 ? 3 : 0); x < w; x += 6) P(c, '#ecceb0', x, y);
    // ventana arqueada nocturna al centro
    var aw = 22, ax = Math.round(w / 2 - aw / 2), atop = Math.max(3, fy - 44), abot = fy - 8;
    var ah = abot - atop;
    for (var j = -1; j <= ah + 1; j++) {
      var yy = atop + j, half = aw / 2 + 1;
      var arc = j < half ? Math.round(half - Math.sqrt(Math.max(0, half * half - (half - j) * (half - j)))) : 0;
      R(c, O, ax - 1 + arc, yy, aw + 2 - arc * 2, 1);
    }
    for (var j2 = 0; j2 <= ah; j2++) {
      var half2 = aw / 2;
      var arc2 = j2 < half2 ? Math.round(half2 - Math.sqrt(Math.max(0, half2 * half2 - (half2 - j2) * (half2 - j2)))) : 0;
      var col = j2 < ah * 0.4 ? '#4b3f78' : j2 < ah * 0.75 ? '#5b4f8c' : '#7466a6';
      R(c, '#d29a6b', ax + arc2, atop + j2, aw - arc2 * 2, 1);
      R(c, col, ax + arc2 + 1, atop + j2, aw - arc2 * 2 - 2, 1);
    }
    // luna y estrellas
    oell(c, '#fff4c2', ax + 15, atop + 6, 3, 3, '#fff4c2');
    ell(c, '#5b4f8c', ax + 17, atop + 5, 2, 2);
    ell(c, '#4b3f78', ax + 17, atop + 5, 2, 2);
    for (var s = 0; s < 6; s++) {
      var sxp = ax + 3 + Math.floor(hash(s * 7 + 1) * (aw - 6)), syp = atop + 4 + Math.floor(hash(s * 5 + 3) * Math.max(1, ah - 10));
      if (Math.abs(sxp - (ax + 15)) < 4 && syp < atop + 10) continue;
      var tw = hash(s * 31 + Math.floor(t * 2)) > 0.3;
      P(c, tw ? '#ffffff' : '#bfb4e8', sxp, syp);
      if (tw && s % 2 === 0) { P(c, '#bfb4e8', sxp - 1, syp); P(c, '#bfb4e8', sxp + 1, syp); P(c, '#bfb4e8', sxp, syp - 1); P(c, '#bfb4e8', sxp, syp + 1); }
    }
    R(c, '#d29a6b', ax + Math.floor(aw / 2) - 1, atop + 2, 2, ah);
    R(c, '#d29a6b', ax + 1, atop + Math.round(ah * 0.55), aw - 2, 1);
    R(c, O, ax - 3, abot + 1, aw + 6, 3); R(c, '#e7b98f', ax - 2, abot + 1, aw + 4, 1);

    // estanterías a los lados
    bookcase(c, -1, 31, Math.max(0, fy - 70), fy + 2, 3);
    bookcase(c, w - 30, 31, Math.max(0, fy - 70), fy + 2, 9);

    // suelo oscuro de madera + alfombra
    woodFloor(c, w, h, fy + 2, '#b98257', '#c99467', '#a06c47', '#94603f');
    R(c, '#7a4f33', 0, fy + 2, w, 1);
    var fd = h - fy;
    var rcy = fy + 2 + Math.round((fd - 2) * 0.55), rry = clamp(Math.round(fd * 0.27), 3, 13);
    ell(c, '#8a4f5f', w / 2, rcy + 1, 33, rry + 1);
    oell(c, '#d77a8f', w / 2, rcy, 32, rry, '#8a4f5f');
    ell(c, '#f2b8a0', w / 2, rcy, 29, Math.max(1, rry - 1));
    ell(c, '#c4677e', w / 2, rcy, 27, Math.max(1, rry - 2));
    for (var d = -24; d <= 24; d += 6) P(c, '#f6d29a', w / 2 + d, rcy);

    // sillón (izquierda)
    var cx = 1, cb = fy + Math.max(3, Math.round(fd * 0.35));
    shadow(c, '#94603f', cx + 12, cb + 1, 12);
    rbox(c, cx + 2, cb - 22, 21, 16, '#e58fa8');           // respaldo
    R(c, '#f4b3c5', cx + 4, cb - 20, 17, 2);
    R(c, '#cf7390', cx + 12, cb - 19, 1, 11);
    P(c, '#ffd166', cx + 7, cb - 15); P(c, '#ffd166', cx + 17, cb - 15);
    rbox(c, cx + 2, cb - 9, 21, 7, '#f0a6bd');            // cojín
    R(c, '#cf7390', cx + 3, cb - 4, 19, 1);
    rbox(c, cx - 1, cb - 13, 6, 12, '#d9849f');           // brazos
    rbox(c, cx + 20, cb - 13, 6, 12, '#d9849f');
    R(c, '#f4b3c5', cx, cb - 12, 4, 1); R(c, '#f4b3c5', cx + 21, cb - 12, 4, 1);
    R(c, O, cx + 1, cb - 2, 2, 3); R(c, O, cx + 22, cb - 2, 2, 3);
    // mantita
    R(c, O, cx + 5, cb - 10, 9, 6); R(c, '#b8e0d2', cx + 6, cb - 10, 7, 5);
    R(c, '#90cbb5', cx + 6, cb - 8, 7, 1); R(c, '#ffffff', cx + 7, cb - 10, 1, 4);

    // mesita con vela (derecha)
    var tx = w - 14, tb = fy + Math.max(3, Math.round(fd * 0.3));
    shadow(c, '#94603f', tx, tb + 1, 8);
    R(c, O, tx - 8, tb - 10, 17, 3); R(c, '#c08657', tx - 7, tb - 9, 15, 1);
    R(c, O, tx - 6, tb - 7, 2, 8); R(c, O, tx + 5, tb - 7, 2, 8);
    // pila de libros
    box(c, tx + 1, tb - 13, 8, 3, '#8ecae6'); box(c, tx + 2, tb - 15, 6, 3, '#ffd166');
    // vela
    var vx = tx - 4, vy = tb - 10;
    var fl = Math.sin(t * 9) * 0.5 + Math.sin(t * 5.3) * 0.5;
    for (var g = 14; g > 2; g -= 3) {
      ell(c, 'rgba(255,214,140,' + (0.12 + 0.03 * fl).toFixed(3) + ')', vx + 1, vy - 7, g + Math.round(fl), g + Math.round(fl));
    }
    box(c, vx - 1, vy - 6, 5, 6, '#fff3e0'); R(c, '#f2dcc0', vx + 2, vy - 5, 1, 5);
    P(c, O, vx + 1, vy - 7);
    var fh = 3 + (fl > 0.3 ? 1 : 0);
    R(c, '#ffb703', vx, vy - 7 - fh, 3, fh - 1); R(c, '#fff1a8', vx + 1, vy - 7 - fh + 1, 1, fh - 2);
    P(c, '#ff8f3d', vx + 1 + (fl < -0.4 ? -1 : 0), vy - 8 - fh);
    // luz cálida general
    c.fillStyle = 'rgba(255,190,120,0.07)'; c.fillRect(0, 0, w, h);
  }

  /* ------------------------------------------------------------------ */
  /* 📦 Cajita de cartón                                                 */
  /* ------------------------------------------------------------------ */
  function caja(c, w, h, t) {
    var fy = floorY(h) + 2;
    var x0 = 13, x1 = w - 13, y0 = clamp(Math.round(h * 0.12), 3, 18), y1 = fy;
    var cBack = '#c7905a', cTop = '#a9743f', cSide = '#d6a46c', cSideR = '#cf9a62', cBot = '#e8bf88';
    // paneles por filas
    for (var y = 0; y < h; y++) {
      var l, r;
      if (y < y0) { l = Math.round(x0 * y / y0); r = w - l; R(c, cTop, 0, y, w, 1); R(c, cSide, 0, y, l, 1); R(c, cSideR, r, y, w - r, 1); }
      else if (y <= y1) { R(c, cSide, 0, y, x0, 1); R(c, cBack, x0, y, x1 - x0, 1); R(c, cSideR, x1, y, w - x1, 1); }
      else { l = Math.round(x0 * (h - y) / (h - y1)); r = w - l; R(c, cBot, 0, y, w, 1); R(c, cSide, 0, y, l, 1); R(c, cSideR, r, y, w - r, 1); }
    }
    // sombra hacia el fondo (tramado)
    dith(c, '#b98250', x0, y0, x1 - x0, 3, 0);
    dith4(c, '#b98250', x0, y0 + 3, x1 - x0, 4, 0);
    dith(c, '#c08a55', 0, 0, w, 2, 1);
    // aristas
    line(c, '#9b6a45', 0, 0, x0, y0); line(c, '#9b6a45', w - 1, 0, x1, y0);
    line(c, '#b07c4a', 0, h - 1, x0, y1); line(c, '#b07c4a', w - 1, h - 1, x1, y1);
    R(c, '#9b6a45', x0, y0, x1 - x0, 1); R(c, '#a9743f', x0, y1, x1 - x0 + 1, 1);
    R(c, '#9b6a45', x0, y0, 1, y1 - y0); R(c, '#9b6a45', x1, y0, 1, y1 - y0);
    // corrugado en los lados
    for (var k = 3; k < y1; k += 4) { var a = Math.round(x0 * Math.min(1, k / y0)); if (a > 2) dith(c, '#c99560', 1, k, a - 2, 1, k); }
    // vetas de cartón y luz cálida que entra
    for (var vx = x0 + 4; vx < x1 - 2; vx += 7) dith4(c, '#bd8752', vx, y0 + 8, 1, y1 - y0 - 10, vx);
    for (var by0 = y1 + 1; by0 < h; by0++) if ((by0 - y1) > (h - y1) * 0.5) dith4(c, '#f2d3a3', 0, by0, w, 1, by0);
    // estampados: flechas "este lado arriba" y huellita (izquierda)
    var ax = x0 + 5, ay = y0 + 6;
    if (y1 - y0 > 18) {
      for (var i = 0; i < 2; i++) {
        var bx = ax + i * 5;
        R(c, '#a06c47', bx + 1, ay + 1, 1, 5); R(c, '#a06c47', bx, ay + 1, 3, 1); P(c, '#a06c47', bx + 1, ay);
      }
      R(c, '#a06c47', ax - 1, ay + 7, 11, 1);
      var hx = ax + 1, hy = ay + 11;
      if (hy + 7 < y1 - 4) {
        R(c, '#b07c4a', hx + 1, hy + 3, 4, 3); R(c, '#b07c4a', hx + 2, hy + 6, 2, 1);
        P(c, '#b07c4a', hx, hy + 1); P(c, '#b07c4a', hx + 2, hy); P(c, '#b07c4a', hx + 4, hy); P(c, '#b07c4a', hx + 6, hy + 1);
      }
    }
    // ventanita en forma de corazón (paredes altas): se ve el cielo
    if (y1 - y0 > 44) {
      var hcx = Math.round(w / 2), hcy = y0 + 8;
      var HM = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
      for (var hj = 0; hj < HM.length; hj++) for (var hi = 0; hi < 7; hi++) {
        if (HM[hj][hi] !== '#') continue;
        R(c, '#8f5f38', hcx - 8 + hi * 2, hcy - 1 + hj * 2, 4, 4);
      }
      for (var hj2 = 0; hj2 < HM.length; hj2++) for (var hi2 = 0; hi2 < 7; hi2++) {
        if (HM[hj2][hi2] !== '#') continue;
        R(c, hj2 < 2 ? '#bfe4ff' : hj2 < 4 ? '#d3edff' : '#ffe0ea', hcx - 7 + hi2 * 2, hcy + hj2 * 2, 2, 2);
      }
      R(c, '#ffffff', hcx - 5, hcy + 2, 2, 1); P(c, '#ffffff', hcx - 5, hcy + 3);
      // nubecita que pasa
      var nx = hcx - 10 + Math.round((t * 2) % 22);
      c.save(); c.beginPath(); c.rect(hcx - 7, hcy, 14, 4); c.clip(); R(c, '#ffffff', nx, hcy + 1, 5, 2); R(c, '#ffffff', nx + 1, hcy, 2, 1); c.restore();
    }
    // etiqueta de envío (derecha, bajita)
    if (y1 - y0 > 22) {
      var lx = x1 - 14, ly = y1 - 12;
      box(c, lx, ly, 11, 7, '#fff8ee', '#a06c47'); R(c, '#e6d3bf', lx + 2, ly + 2, 7, 1); R(c, '#ff8fab', lx + 2, ly + 4, 4, 1);
    }
    // borde de la abertura (cartón cortado)
    R(c, '#f2d3a3', 0, 0, w, 1); R(c, '#f2d3a3', 0, 0, 1, h); R(c, '#f2d3a3', w - 1, 0, 1, h);
    for (var cx = 1; cx < w; cx += 2) P(c, '#d9ac74', cx, 1);
    // solapa colgando arriba-izq con cinta
    R(c, O, 0, 0, 22, 5); R(c, '#e3b47b', 0, 0, 21, 4); R(c, '#f2d3a3', 0, 0, 21, 1);
    R(c, 'rgba(250,240,200,0.85)', 9, 0, 6, 7); R(c, 'rgba(255,255,255,0.6)', 10, 0, 1, 7);
    R(c, O, w - 18, 0, 18, 4); R(c, '#e3b47b', w - 17, 0, 17, 3); R(c, '#f2d3a3', w - 17, 0, 17, 1);
    // mantita doblada (abajo-izq)
    var fd = h - y1, by = y1 + Math.max(2, Math.round(fd * 0.35));
    rbox(c, 6, by - 6, 18, 7, '#cdb8de'); R(c, '#e3d7f2', 7, by - 5, 16, 1); R(c, '#b39ad1', 7, by - 2, 16, 1);
    for (var q = 8; q < 23; q += 4) P(c, '#ffffff', q, by - 4);
    // pelotita (abajo-der)
    var bx2 = w - 14, by2 = y1 + Math.max(3, Math.round(fd * 0.5));
    dith(c, '#d6a46c', bx2 - 4, by2 + 3, 9, 1, 0);
    oell(c, '#90be6d', bx2, by2, 3, 3); R(c, '#ffffff', bx2 - 3, by2, 7, 1); P(c, '#c8e8b0', bx2 - 1, by2 - 2);
    // juguete de lana colgando y balanceándose
    var px = Math.round(w * 0.74), py = y0 - 2;
    var len = clamp(Math.round((y1 - y0) * 0.45), 8, 50);
    var ang = Math.sin(t * 2.2) * 0.38;
    var ex = px + Math.sin(ang) * len, ey = py + Math.cos(ang) * len;
    line(c, '#e85d8a', px, py, ex, ey);
    R(c, O, px - 2, py - 1, 5, 2);
    var yx = Math.round(ex), yy = Math.round(ey) + 3;
    oell(c, '#ff8fab', yx, yy, 3, 3);
    R(c, '#ffc6d6', yx - 2, yy - 1, 1, 2); line(c, '#e85d8a', yx - 2, yy + 2, yx + 2, yy - 2); line(c, '#e85d8a', yx - 1, yy + 3, yx + 3, yy - 1);
    // pluma
    P(c, '#ffd166', yx, yy + 5); P(c, '#ffd166', yx + 1, yy + 6); P(c, '#8ecae6', yx - 1, yy + 6);
    // sombrita interior en el fondo
    dith4(c, '#a9743f', x0, y1 - 2, x1 - x0, 2, 0);
  }

  /* ------------------------------------------------------------------ */
  /* 🎉 Fiesta                                                           */
  /* ------------------------------------------------------------------ */
  var PARTY = ['#ff8fab', '#ffd166', '#8ecae6', '#90be6d', '#cdb8de', '#f4a261'];
  function bunting(c, w, y0, sag, t, off) {
    for (var x = 0; x < w; x++) { var u = x / (w - 1); P(c, '#6b5470', x, y0 + Math.round(sag * 4 * u * (1 - u))); }
    for (var i = 0, fx = 2 + off; fx < w - 2; fx += 8, i++) {
      var uu = (fx + 2) / (w - 1);
      var fy = y0 + Math.round(sag * 4 * uu * (1 - uu)) + 1;
      var col = PARTY[(i + off) % PARTY.length];
      var sw = Math.round(Math.sin(t * 2 + i) * 0.6);
      for (var r = 0; r < 6; r++) {
        var half = Math.max(0, 3 - Math.floor(r / 2));
        var cx = fx + 2 + (r > 3 ? sw : 0);
        R(c, O, cx - half - 1, fy + r, half * 2 + 3, 1);
        if (half > 0 || r < 5) R(c, col, cx - half, fy + r, half * 2 + 1, 1);
      }
      R(c, O, fx + 2 + sw, fy + 6, 1, 1);
      P(c, '#ffffff', fx + 1, fy + 1);
    }
  }
  function balloon(c, x, y, col, ax, ay) {
    // cordel ondulado
    for (var yy = y + 7; yy < ay; yy++) P(c, '#8a7590', Math.round(x + (ax - x) * (yy - y) / Math.max(1, ay - y) + Math.sin(yy / 2.5)), yy);
    oell(c, col, x, y, 4, 5);
    R(c, shade(col, -0.18), x + 1, y + 2, 3, 2); P(c, shade(col, -0.18), x + 3, y + 1);
    R(c, '#ffffff', x - 2, y - 3, 1, 2); P(c, '#ffffff', x - 1, y - 4);
    R(c, O, x - 1, y + 6, 3, 1); P(c, col, x, y + 6);
  }
  function fiesta(c, w, h, t) {
    var fy = floorY(h);
    // pared lila con lunares
    R(c, '#efe6ff', 0, 0, w, fy);
    for (var y = 3, r = 0; y < fy - 4; y += 8, r++) for (var x = (r % 2 ? 6 : 2); x < w; x += 8) { R(c, '#e2d5fb', x, y, 2, 2); }
    // banderines
    bunting(c, w, 1, Math.min(8, Math.round(fy / 6)), t, 0);
    if (fy > 64) bunting(c, w, Math.round(fy * 0.32), 6, t, 3);
    // suelo rosado
    woodFloor(c, w, h, fy, '#ffd6e0', '#ffe6ec', '#f3b9c8', '#efadbe');
    baseboard(c, w, fy, '#c9b6ec', '#ffffff', '#e8e0f7');
    var fd = h - fy;

    // globos (bobbing)
    var bob = function (i) { return Math.round(Math.sin(t * 1.6 + i * 1.7) * 1.2); };
    var gby = fy + Math.max(2, Math.round(fd * 0.28));
    var gbX = 12;
    var top = Math.max(10, fy - 26);
    balloon(c, 6, top + 4 + bob(0), '#8ecae6', gbX, gby - 6);
    balloon(c, 15, top + bob(1), '#ff8fab', gbX, gby - 6);
    balloon(c, 11, top + 11 + bob(2), '#ffd166', gbX, gby - 6);
    balloon(c, w - 30, top + 2 + bob(3), '#cdb8de', w - 24, fy - 2);
    // regalo (izquierda)
    shadow(c, '#efadbe', gbX + 1, gby + 1, 9);
    box(c, gbX - 8, gby - 9, 18, 10, '#90be6d'); R(c, '#76a65a', gbX - 7, gby - 3, 16, 2);
    R(c, '#ff8fab', gbX, gby - 9, 3, 10); R(c, '#ff8fab', gbX - 7, gby - 6, 16, 2);
    box(c, gbX - 9, gby - 11, 20, 3, '#a8d48a'); R(c, '#ff8fab', gbX, gby - 11, 3, 3);
    R(c, O, gbX - 3, gby - 15, 4, 4); R(c, O, gbX + 3, gby - 15, 4, 4); R(c, '#ff8fab', gbX - 2, gby - 14, 2, 2); R(c, '#ff8fab', gbX + 4, gby - 14, 2, 2);
    box(c, gbX + 9, gby - 6, 8, 7, '#8ecae6'); R(c, '#ffd166', gbX + 12, gby - 6, 2, 7);

    // mesa con pastel (derecha)
    var tx = w - 18, tb = fy + Math.max(3, Math.round(fd * 0.3));
    shadow(c, '#efadbe', tx, tb + 1, 12);
    R(c, O, tx - 13, tb - 10, 27, 3); R(c, '#ffffff', tx - 12, tb - 9, 25, 1);
    // mantel con picos
    for (var m = 0; m < 25; m++) { var dd = 2 + ((m % 4) < 2 ? 1 : 0); R(c, '#ffb3c7', tx - 12 + m, tb - 8, 1, dd); }
    R(c, O, tx - 10, tb - 5, 2, 6); R(c, O, tx + 9, tb - 5, 2, 6);
    // pastel
    var kx = tx - 7, ky = tb - 10;
    box(c, kx, ky - 7, 15, 7, '#ffe0b8'); R(c, '#f6c08f', kx + 1, ky - 3, 13, 1);
    box(c, kx + 2, ky - 12, 11, 6, '#ffc6d6');
    R(c, '#ffffff', kx + 1, ky - 7, 13, 1); for (var dpp = 0; dpp < 13; dpp += 3) P(c, '#ffffff', kx + 1 + dpp, ky - 6);
    R(c, '#ffffff', kx + 3, ky - 12, 9, 1); P(c, '#ffffff', kx + 4, ky - 11); P(c, '#ffffff', kx + 8, ky - 11);
    P(c, '#e63946', kx + 7, ky - 13);
    for (var cd = 0; cd < 3; cd++) {
      var vx = kx + 4 + cd * 3;
      R(c, O, vx - 1, ky - 16, 3, 4); R(c, PARTY[cd + 1], vx, ky - 16, 1, 3);
      var on = Math.sin(t * 10 + cd * 2) > -0.3;
      P(c, '#ffb703', vx, ky - 17); if (on) P(c, '#fff1a8', vx, ky - 18);
    }
    // confeti cayendo
    for (var i = 0; i < 26; i++) {
      var sp = 3 + hash(i * 3 + 1) * 4;
      var cxp = hash(i * 7 + 2) * w;
      var cyp = (hash(i * 11 + 5) * (h + 10) + t * sp) % (h + 10) - 5;
      cxp += Math.sin(t * 2 + i) * 1.5;
      var col = PARTY[i % PARTY.length];
      var flip = Math.floor(t * 4 + i) % 2;
      R(c, col, cxp, cyp, flip ? 2 : 1, flip ? 1 : 2);
    }
    // confeti en el suelo
    for (var j = 0; j < 14; j++) {
      var gx = Math.floor(hash(j * 13 + 9) * w), gy = fy + 2 + Math.floor(hash(j * 17 + 3) * (fd - 3));
      R(c, PARTY[j % PARTY.length], gx, gy, j % 2 ? 2 : 1, 1);
    }
  }

  /* ------------------------------------------------------------------ */
  var reg = window.CatBG.register;
  reg({ id: 'cuarto', label: 'Mi cuartito', emoji: '🛏️', animated: true, draw: cuarto });
  reg({ id: 'cocina', label: 'Cocina', emoji: '🍳', animated: true, draw: cocina });
  reg({ id: 'cafeteria', label: 'Cafetería gatuna', emoji: '☕', animated: true, draw: cafeteria });
  reg({ id: 'biblioteca', label: 'Biblioteca', emoji: '📚', animated: true, draw: biblioteca });
  reg({ id: 'caja', label: 'Cajita de cartón', emoji: '📦', animated: true, draw: caja });
  reg({ id: 'fiesta', label: 'Fiesta', emoji: '🎉', animated: true, draw: fiesta });
})();
