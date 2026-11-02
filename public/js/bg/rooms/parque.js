/* Amigatos — fondo del Parque Ronroneo (pixel art procedural)
 * Una escena = un archivo. Se registra en window.CatBG:
 *   CatBG.register({ id, label, emoji, animated, draw(ctx, w, h, t) })
 * El arte se diseña sobre el ancho nativo (NATIVE_W) y se escala sin suavizado cuando el canvas
 * pide otra base (ver js/bg/pixels.js).
 * Arte original de Amigatos: no se copia nada de otros juegos.
 */
(function () {
  'use strict';
  if (!window.CatBG || !window.CatBGPixels) return;

  var PX = window.CatBGPixels;
  var R = PX.R, P = PX.P, disc = PX.disc, ellipse = PX.ellipse;
  var rowDither = PX.rowDither, vgrad = PX.vgrad, cloud = PX.cloud;
  var hash = PX.hash, clamp = PX.clamp, layer = PX.layer, INK = PX.INK;

  var NATIVE_W = 320;          // ancho nativo del arte de esta sala (el mundo es 320x200)

  /* ------------------------------------------------------------------ */
  /* geometría del piso                                                  */
  /* ------------------------------------------------------------------ */
  // Es la misma que usa el servidor (server/world.js, sala "parque"): el piso caminable
  // empieza en y=110 y el estanque (x 100..220, y 145..200) no se puede pisar.
  // El fondo dibuja exactamente esas zonas: el césped, el caminito y el estanque.
  var DESIGN_H = 200;          // alto de diseño (el ancho nativo siempre es 320)
  var GROUND_Y = 110;          // línea de suelo
  var POND_X0 = 100, POND_X1 = 220;   // estanque (zona no caminable)
  var POND_Y0 = 145;
  var PATH_Y0 = 114, PATH_Y1 = 128;   // caminito de tierra, detrás del estanque
  var GATE_X = 244;            // desde aquí el caminito se ensancha hacia la salida

  function parqueGeo(H) {
    var s = H / DESIGN_H;      // solo cambia el alto: el ancho nativo es siempre 320
    return {
      s: s,
      gy: Math.round(GROUND_Y * s),
      pondY0: Math.round(POND_Y0 * s),
      pathY0: Math.round(PATH_Y0 * s),
      pathY1: Math.round(PATH_Y1 * s)
    };
  }
  function sy(v, s) { return Math.round(v * s); }
  function sd(v, s) { return Math.max(1, Math.round(v * s)); }

  // El caminito va recto por detrás del estanque y se ensancha hacia la salida
  // (a la derecha, hacia la Plaza Bigotes).
  function pathBottom(x) {
    var k = clamp((x - GATE_X) / (320 - GATE_X), 0, 1);
    return PATH_Y1 + Math.round(42 * k * k * (3 - 2 * k));
  }

  // Árbol grande: tronco con ramas, raíces y copa de lóbulos.
  function bigTree(c, x, by, h, seed, s) {
    var u = h / 30;             // unidad: un árbol de 30 px de alto mide 1 unidad
    var base = sy(by, s);
    var trunkH = sd(h * 0.55, s);
    var trunkW = Math.max(3, sd(4 * u, s));
    var top = base - trunkH;
    var i, r;
    // raíces
    R(c, '#6b432b', x - trunkW - 1, base - 1, trunkW + 2, 1);
    R(c, '#6b432b', x + trunkW - 1, base - 1, trunkW + 2, 1);
    // ramas
    R(c, '#7d4f33', x - Math.round(trunkW * 1.7), top + Math.round(trunkH * 0.4), Math.round(trunkW * 1.8), Math.max(1, sd(2 * u, s)));
    R(c, '#7d4f33', x + Math.round(trunkW * 0.3), top + Math.round(trunkH * 0.22), Math.round(trunkW * 1.7), Math.max(1, sd(2 * u, s)));
    // tronco
    R(c, '#7d4f33', x - Math.floor(trunkW / 2), top, trunkW, trunkH);
    R(c, '#a9714a', x - Math.floor(trunkW / 2), top, 1, trunkH);
    R(c, '#5f3a26', x + Math.floor(trunkW / 2) - 1, top, 1, trunkH);
    // copa
    var cy = base - sy(h * 0.78, s);
    var parts = [[0, 0, 9], [-9, 3, 7], [9, 3, 7], [-4, -7, 7], [5, -7, 6], [-13, 7, 4], [13, 7, 4], [0, 9, 7], [-2, -1, 5]];
    for (i = 0; i < parts.length; i++) {
      r = sd(parts[i][2] * u, s);
      disc(c, x + Math.round(parts[i][0] * u), cy + sy(parts[i][1] * u, s), r, '#4f9e57');
    }
    for (i = 0; i < parts.length; i++) {
      r = Math.max(1, sd(parts[i][2] * u * 0.75, s));
      disc(c, x + Math.round(parts[i][0] * u), cy + sy(parts[i][1] * u, s) - Math.max(1, sd(u * 0.5, s)), r, '#6fc46e');
    }
    // hojitas sueltas
    for (i = 0; i < 5; i++) {
      P(c, '#9bdc93', x + Math.round((hash(seed + i * 3.7) - 0.5) * 22 * u), cy + sy((hash(seed + i * 5.1) - 0.6) * 14 * u, s));
    }
  }

  function parqueBack(c, W, H) {
    var g = parqueGeo(H), s = g.s, gy = g.gy, x, y, i;
    // cielo
    vgrad(c, 0, 0, W, gy, ['#79c4ec', '#9ad9f2', '#bfebf7', '#e6f7ef']);
    // sol
    disc(c, 48, sy(26, s), sd(10, s), '#fff8d6');
    disc(c, 47, sy(25, s), sd(7, s), '#ffe89a');
    disc(c, 46, sy(24, s), sd(4, s), '#fffbe8');
    // colinas lejanas
    var hb = sy(24, s);
    for (x = 0; x < W; x++) {
      y = gy - Math.round(hb + hb * 0.5 * Math.sin(x * 0.021 + 0.6) + hb * 0.22 * Math.sin(x * 0.055 + 2));
      R(c, '#a8dca0', x, y, 1, gy - y);
      P(c, '#c8ecc0', x, y);
    }
    // colinas cercanas
    var hb2 = sy(15, s);
    for (x = 0; x < W; x++) {
      y = gy - Math.round(hb2 + hb2 * 0.42 * Math.sin(x * 0.034 + 2.4));
      R(c, '#8fcc88', x, y, 1, gy - y);
      P(c, '#b6e6aa', x, y);
    }
    // césped
    R(c, '#96d38d', 0, gy, W, H - gy);
    R(c, '#b9e8aa', 0, gy, W, 1);
    var mid = gy + Math.round((H - gy) * 0.45);
    for (y = mid; y < H; y++) rowDither(c, 0, y, W, '#96d38d', '#7fc07c', (y - mid) / Math.max(1, H - mid) * 0.9);
    // matitas de hierba (fuera del caminito y del estanque)
    var tufts = [[8, 168], [18, 186], [30, 160], [40, 176], [52, 194], [64, 168], [76, 186], [88, 162],
      [228, 164], [240, 182], [252, 158], [264, 194], [276, 172], [288, 186], [300, 160]];
    for (i = 0; i < tufts.length; i++) {
      x = tufts[i][0]; y = sy(tufts[i][1], s);
      P(c, '#6fb06a', x, y); P(c, '#6fb06a', x + 1, y); P(c, '#6fb06a', x, y - 1);
    }
    // caminito de tierra: recto detrás del estanque, ancho hacia la salida
    for (x = 0; x < W; x++) {
      var p0 = g.pathY0, p1 = sy(pathBottom(x), s);
      R(c, '#e0c69a', x, p0, 1, p1 - p0 + 1);
      R(c, '#efdcb6', x, p0, 1, 1);
      R(c, '#c8a97c', x, p1, 1, 1);
    }
    // piedras sueltas del caminito
    for (i = 0; i < 26; i++) {
      x = Math.round(hash(i * 5.3) * (W - 1));
      var bot = sy(pathBottom(x), s);
      y = g.pathY0 + 2 + Math.round(hash(i * 2.9) * Math.max(1, bot - g.pathY0 - 4));
      P(c, '#cdb287', x, y);
      if (i % 3 === 0) P(c, '#d6bd93', x + 1, y);
    }
    // estanque (x 100..220, y 145..200): aquí no se puede caminar
    var pw = POND_X1 - POND_X0 + 1;
    vgrad(c, POND_X0, g.pondY0, pw, H - g.pondY0, ['#5aa8d8', '#3f86bd', '#33699c']);
    R(c, '#7cc0e6', POND_X0, g.pondY0, pw, 1);
    for (x = POND_X0; x <= POND_X1; x += 3) P(c, '#d6c9ae', x, g.pondY0);
    // juncos en la orilla
    var rx = [104, 108, 112, 116, 204, 208, 212, 216];
    for (i = 0; i < rx.length; i++) {
      var rh = sd(7 + hash(rx[i] * 3.3) * 6, s);
      R(c, '#4f9e57', rx[i], g.pondY0 - rh, 1, rh);
      P(c, '#3f8f5a', rx[i] + 1, g.pondY0 - rh + 2);
      R(c, '#8d5c3d', rx[i] - 1, g.pondY0 - rh - 2, 2, 3);
    }
    // nenúfares
    ellipse(c, 126, sy(172, s), 7, sd(3, s), '#3f8f5a');
    ellipse(c, 125, sy(171, s), 5, sd(2, s), '#59b06d');
    R(c, '#ff8fab', 124, sy(168, s), 3, 2);
    P(c, '#ffe08a', 125, sy(168, s));
    ellipse(c, 196, sy(188, s), 6, sd(2, s), '#357f4e');
    ellipse(c, 185, sy(160, s), 5, sd(2, s), '#3f8f5a');
    // árboles grandes
    bigTree(c, 26, 158, 78, 3, s);
    bigTree(c, 252, 140, 66, 11, s);
    // columpios: el marco es fijo, los asientos se balancean en la capa animada
    var swx0 = 132, swx1 = 198, swtop = sy(100, s), swfoot = sy(142, s);
    R(c, '#8d5c3d', swx0, swtop, 3, swfoot - swtop);
    R(c, '#a9714a', swx0, swtop, 1, swfoot - swtop);
    R(c, '#8d5c3d', swx1 - 2, swtop, 3, swfoot - swtop);
    R(c, '#a9714a', swx1 - 2, swtop, 1, swfoot - swtop);
    R(c, '#8d5c3d', swx0 - 4, swtop, (swx1 - swx0) + 8, 3);
    R(c, '#a9714a', swx0 - 4, swtop, (swx1 - swx0) + 8, 1);
    R(c, '#6b432b', swx0 - 2, swfoot - 1, 8, 2);
    R(c, '#6b432b', swx1 - 5, swfoot - 1, 8, 2);
    // flores
    var fcols = [['#ff8fab', '#e86a8e'], ['#ffd166', '#e9a93d'], ['#cdb8de', '#a991c9'], ['#ffffff', '#e0d6e0'], ['#8ecae6', '#6ba3c0']];
    var fpos = [[12, 176], [21, 190], [33, 162], [44, 182], [58, 196], [70, 168], [82, 186], [92, 160],
      [228, 170], [238, 188], [250, 158], [262, 196], [276, 178], [288, 190], [300, 162]];
    for (i = 0; i < fpos.length; i++) {
      x = fpos[i][0]; y = sy(fpos[i][1], s);
      var cc = fcols[i % fcols.length];
      P(c, '#4f9e57', x, y); P(c, '#4f9e57', x, y - 1);
      P(c, cc[0], x, y - 2); P(c, cc[1], x + 1, y - 2);
    }
    // setas
    var mpos = [[16, 196], [88, 172], [232, 158], [296, 196], [66, 190]];
    for (i = 0; i < mpos.length; i++) {
      x = mpos[i][0]; y = sy(mpos[i][1], s);
      if (y >= H - 1) continue;
      R(c, '#f7f0e2', x, y - 1, 1, 2);
      R(c, '#e26a6a', x - 1, y - 2, 3, 1);
      P(c, '#fff3e0', x, y - 2);
    }
    // cartel con flecha hacia la plaza, al borde del camino
    R(c, '#6b432b', 302, sy(110, s) - 14, 2, 14);
    R(c, '#a9714a', 290, sy(110, s) - 20, 20, 10);
    R(c, '#8d5c3d', 290, sy(110, s) - 20, 20, 1);
    R(c, '#fff6ee', 293, sy(110, s) - 17, 14, 1);
    R(c, '#fff6ee', 300, sy(110, s) - 16, 2, 1);
    P(c, '#fff6ee', 301, sy(110, s) - 17);
    P(c, '#fff6ee', 301, sy(110, s) - 15);
    R(c, '#fff6ee', 296, sy(110, s) - 14, 5, 1);
  }

  function drawParque(c, W, H, t) {
    var g = parqueGeo(H), s = g.s, x, y, i;
    c.drawImage(layer('parque', W, H, parqueBack), 0, 0);
    // nubes que pasan
    var cl = [[-40, 18, 3, 3.0], [120, 34, 2, 1.6], [200, 22, 2, 2.2]];
    for (i = 0; i < cl.length; i++) {
      var span = W + 60;
      var cx = ((cl[i][0] + t * cl[i][3]) % span + span) % span - 30;
      cloud(c, cx, sy(cl[i][1], s), sd(cl[i][2], s), '#ffffff', '#e3eff8', '#bcd3e6');
    }
    // ondas del estanque
    for (i = 0; i < 4; i++) {
      var wx = POND_X0 + ((i * 27 + Math.floor(t * 6)) % (POND_X1 - POND_X0 - 6));
      var wy = g.pondY0 + sy(12 + i * 9, s);
      R(c, '#9fd8f2', wx, wy, 4, 1);
    }
    // columpios que se balancean
    var top = sy(103, s), len = sy(18, s);
    var seats = [{ x: 150, ph: 0 }, { x: 184, ph: 1.6 }];
    for (i = 0; i < seats.length; i++) {
      var ang = Math.sin(t * 1.7 + seats[i].ph) * 0.42;
      var seatX = seats[i].x + Math.round(Math.sin(ang) * len);
      var seatY = top + Math.round(Math.cos(ang) * len);
      for (var r2 = 1; r2 < len; r2++) {
        var rx2 = seats[i].x + Math.round(Math.sin(ang) * r2);
        var ry2 = top + Math.round(Math.cos(ang) * r2);
        P(c, '#6f452c', rx2, ry2);
        P(c, '#6f452c', rx2 + 1, ry2);
      }
      R(c, '#e0637f', seatX - 3, seatY, 7, 2);
      R(c, '#ff8fab', seatX - 3, seatY, 7, 1);
    }
    // mariposas
    for (i = 0; i < 4; i++) {
      var bx = 26 + i * 74 + Math.sin(t * 0.9 + i * 2.2) * 18;
      var by = sy(64, s) - Math.abs(Math.sin(t * 1.4 + i)) * Math.min(20, sy(30, s));
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
    for (i = 0; i < 16; i++) {
      var sp = 4 + hash(i * 2.7) * 6;
      y = (hash(i * 3.9) * (H + 10) + t * sp) % (H + 10) - 5;
      x = ((hash(i * 6.1) * (W + 8) + t * 2 + Math.sin(t * 1.4 + i) * 4) % (W + 8)) - 4;
      var lc = i % 3 ? '#8fd07d' : '#ffd166';
      R(c, lc, x, y, 2, 1);
    }
    // pajaritos
    for (i = 0; i < 2; i++) {
      var span2 = W + 12;
      var px2 = ((i * 60 + t * (2 + i)) % span2 + span2) % span2 - 6;
      var py2 = sy(24 + i * 6, s) + Math.round(Math.sin(t * 2 + i) * 1);
      var up = (Math.floor(t * 6) + i) % 6 < 3;
      P(c, '#5d5a74', px2, py2); P(c, '#5d5a74', px2 - 1, py2 - (up ? 1 : 0)); P(c, '#5d5a74', px2 + 1, py2 - (up ? 1 : 0));
    }
  }

  window.CatBG.register({
    id: 'parque', label: 'Parque Ronroneo', emoji: '🌳', animated: true,
    draw: PX.scaled({ nativeW: NATIVE_W, draw: drawParque })
  });
})();
