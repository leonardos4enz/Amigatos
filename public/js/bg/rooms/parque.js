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
  var hash = PX.hash, clamp = PX.clamp, groundY = PX.groundY, layer = PX.layer, INK = PX.INK;

  var NATIVE_W = 96;           // ancho nativo del arte de esta sala

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

  function drawParque(c, W, H, t) {
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

  window.CatBG.register({
    id: 'parque', label: 'Parque Ronroneo', emoji: '🌳', animated: true,
    draw: PX.scaled({ nativeW: NATIVE_W, draw: drawParque })
  });
})();
