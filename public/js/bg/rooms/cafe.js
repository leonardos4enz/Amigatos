/* Amigatos — fondo del Café del Ovillo (pixel art procedural)
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
  var R = PX.R, P = PX.P, ellipse = PX.ellipse;
  var hash = PX.hash, clamp = PX.clamp, layer = PX.layer, INK = PX.INK;

  var NATIVE_W = 96;           // ancho nativo del arte de esta sala

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

  function drawCafe(c, W, H, t) {
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

  window.CatBG.register({
    id: 'cafe', label: 'Café del Ovillo', emoji: '☕', animated: true,
    draw: PX.scaled({ nativeW: NATIVE_W, draw: drawCafe })
  });
})();
