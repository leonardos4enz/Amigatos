/* Amigatos — fondo de la Plaza Bigotes (pixel art procedural)
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
  var rowDither = PX.rowDither, vgrad = PX.vgrad, sparkle = PX.sparkle;
  var star5 = PX.star5, heart5 = PX.heart5, hash = PX.hash, clamp = PX.clamp;
  var groundY = PX.groundY, layer = PX.layer, INK = PX.INK;

  var NATIVE_W = 96;           // ancho nativo del arte de esta sala

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

  function drawPlaza(c, W, H, t) {
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

  window.CatBG.register({
    id: 'plaza', label: 'Plaza Bigotes', emoji: '🏛️', animated: true,
    draw: PX.scaled({ nativeW: NATIVE_W, draw: drawPlaza })
  });
})();
