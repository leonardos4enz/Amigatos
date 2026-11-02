/* Amigatos — fondo de la Plaza Bigotes (pixel art procedural)
 * Una escena = un archivo. Se registra en window.CatBG:
 *   CatBG.register({ id, label, emoji, animated, draw(ctx, w, h, t) })
 * El arte se diseña sobre el ancho nativo (NATIVE_W) y se escala sin suavizado cuando el canvas
 * pide otra base (ver js/bg/pixels.js).
 *
 * La plaza se dibuja a 320x200 lógicos (docs/mundo.md §1). La geometría de la escena es la misma
 * que define server/world.js para esta sala: la línea de suelo en y=110 y el bloque de la fuente
 * en x 140..180, y 145..200. Así el suelo dibujado coincide con los polígonos caminables:
 * los adoquines llegan hasta y=110 y la fuente ocupa exactamente la zona que no se puede pisar.
 * Arte original de Amigatos: no se copia nada de otros juegos.
 */
(function () {
  'use strict';
  if (!window.CatBG || !window.CatBGPixels) return;

  var PX = window.CatBGPixels;
  var R = PX.R, P = PX.P, disc = PX.disc, ellipse = PX.ellipse;
  var vgrad = PX.vgrad, cloud = PX.cloud, sparkle = PX.sparkle;
  var star5 = PX.star5, heart5 = PX.heart5, hash = PX.hash, clamp = PX.clamp;
  var th = PX.th, layer = PX.layer, INK = PX.INK;

  var NATIVE_W = 320;           // ancho nativo del arte de esta sala (320x200 lógico)

  var PLAZA_WALLS = ['#f4d9c4', '#e9cad8', '#d9e2f2', '#f7e4bd', '#d8e8dd'];
  var PLAZA_ROOFS = ['#c9736b', '#a8705f', '#7f8fbf', '#c08a52'];
  var PLAZA_FLAGS = ['#ff8fab', '#ffd166', '#8ecae6', '#b9f0c9', '#cdb8de'];

  var SKY = ['#5fb9e6', '#86d0ee', '#aee2f5', '#d8f2ee'];
  var SOIL = '#d9c6a3';         // color del suelo: cálido, nunca igual al azul del cielo
  var STONE = '#e8d8b6';
  var DIRT = '#c9a06d';

  // ------------------------------------------------------------------
  // color
  // ------------------------------------------------------------------
  function toHex(v) {
    var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
    return s.length < 2 ? '0' + s : s;
  }
  // mezcla dos colores hex (#rrggbb) con k=0 (a) .. 1 (b)
  function mix(a, b, k) {
    function p(h, i) { return parseInt(h.substr(i, 2), 16); }
    return '#' + toHex(p(a, 1) + (p(b, 1) - p(a, 1)) * k)
      + toHex(p(a, 3) + (p(b, 3) - p(a, 3)) * k)
      + toHex(p(a, 5) + (p(b, 5) - p(a, 5)) * k);
  }

  // ------------------------------------------------------------------
  // geometría (coincide con los walkable de server/world.js)
  // ------------------------------------------------------------------
  function plazaGeo(W, H) {
    var gy = Math.round(H * 0.55);                 // 110 en 320x200: la línea de suelo
    return {
      gy: gy,                                      // arriba del suelo (cielo y casas)
      fx: Math.round(W * 0.5),                     // 160: centro de la fuente
      fw: Math.round(W * 0.125),                   // 40: ancho del bloque de la fuente
      ftop: gy + Math.round((H - gy) * 0.389),     // 145: donde empieza la fuente (no caminable)
      fbot: H                                      // 200: borde inferior de la fuente
    };
  }

  // ------------------------------------------------------------------
  // piezas del escenario
  // ------------------------------------------------------------------
  function houseWindow(c, x, y, lit) {
    R(c, '#5f6c86', x, y, 8, 8);
    R(c, lit ? '#ffd98a' : '#a8d8ea', x + 1, y + 1, 6, 6);
    R(c, '#5f6c86', x + 3, y + 1, 1, 6);
    R(c, '#5f6c86', x + 1, y + 3, 6, 1);
    R(c, '#fff6ee', x - 1, y + 8, 10, 1);          // alféizar
    if (lit) P(c, '#fff6cf', x + 2, y + 2);
  }

  function flowerBox(c, x, y) {
    R(c, '#8d5c3d', x, y, 10, 2);
    var cols = ['#ff8fab', '#ffd166', '#cdb8de'];
    for (var i = 0; i < 5; i++) {
      P(c, '#4f9e57', x + 1 + i * 2, y - 1);
      P(c, cols[i % cols.length], x + 1 + i * 2, y - 2);
    }
  }

  // casa del pueblo: cuerpo, tejado a dos aguas, chimenea, ventanas y puerta
  function house(c, hx, by, bw, bh, gy, wall, roof, seed) {
    var i, r;
    R(c, wall, hx, by, bw, bh);
    R(c, mix(wall, '#8f7fa8', 0.22), hx, by, bw, 3);        // sombra bajo el alero
    R(c, mix(wall, '#ffffff', 0.35), hx, by + 3, 2, bh - 3); // luz en la esquina
    R(c, mix(wall, '#6b5470', 0.18), hx + bw - 2, by + 3, 2, bh - 3);
    // enlucido: líneas de ladrillo
    for (i = by + 6; i < gy; i += 7) {
      R(c, mix(wall, '#8f7fa8', 0.12), hx, i, bw, 1);
      var bx = hx + ((i - by) % 14 === 0 ? 5 : 11);
      R(c, mix(wall, '#8f7fa8', 0.1), bx, i - 6, 1, 6);
    }

    // tejado a dos aguas, en escalones de 2 píxeles
    var roofH = Math.ceil(bw / 8) + 4;
    for (r = 0; r < roofH; r++) {
      var inset = (roofH - 1 - r) * 2;
      var yy = by - 1 - r;
      R(c, roof, hx + inset, yy, bw - inset * 2, 1);
      if (r % 3 === 0) R(c, mix(roof, '#2b1a33', 0.2), hx + inset, yy, bw - inset * 2, 1);
    }
    var topInset = (roofH - 1) * 2;
    R(c, mix(roof, '#ffffff', 0.35), hx + topInset, by - roofH, bw - topInset * 2, 1);

    // chimenea
    if (seed > 0.45) {
      var chx = hx + bw - 12;
      R(c, '#8d5c3d', chx, by - roofH + 1, 4, 8);
      R(c, '#a9714a', chx, by - roofH + 1, 4, 1);
      R(c, '#c58a5c', chx, by - roofH + 1, 1, 8);
    }

    // ventanas
    var winY = by + 8;
    houseWindow(c, hx + 5, winY, seed > 0.5);
    houseWindow(c, hx + bw - 13, winY, seed < 0.6);
    if (seed > 0.35) flowerBox(c, hx + 4, winY + 10);
    if (bw > 40) {
      houseWindow(c, hx + Math.floor(bw / 2) - 4, winY + 12, seed < 0.4);
      flowerBox(c, hx + Math.floor(bw / 2) - 5, winY + 22);
    }

    // puerta con su tejadillo
    var dx0 = hx + Math.floor(bw / 2) - 4;
    R(c, '#8d5c3d', dx0, gy - 16, 8, 16);
    R(c, '#a9714a', dx0 + 1, gy - 15, 6, 14);
    R(c, '#6f452c', dx0 + 1, gy - 15, 6, 1);
    P(c, '#ffd166', dx0 + 6, gy - 8);
    R(c, '#ff8fab', dx0 - 2, gy - 20, 12, 2);
    R(c, '#fff6ee', dx0 - 2, gy - 18, 12, 2);
    for (i = 0; i < 6; i++) P(c, i % 2 ? '#ff8fab' : '#fff6ee', dx0 - 2 + i * 2, gy - 17);
  }

  // árbol del fondo de la plaza
  function tree(c, x, by, h, seed) {
    var tw = Math.max(2, Math.round(h / 12));
    R(c, '#8d5c3d', x - Math.floor(tw / 2), by - Math.round(h * 0.45), tw, Math.round(h * 0.45));
    R(c, '#a9714a', x - Math.floor(tw / 2), by - Math.round(h * 0.45), 1, Math.round(h * 0.45));
    var cy = by - Math.round(h * 0.68);
    var r = Math.round(h / 4);
    disc(c, x, cy, r, '#4f9e57');
    disc(c, x - r + 2, cy + 3, Math.max(2, r - 2), '#4f9e57');
    disc(c, x + r - 2, cy + 3, Math.max(2, r - 2), '#4f9e57');
    disc(c, x - 1, cy - 2, Math.max(2, r - 2), '#6fc46e');
    disc(c, x + 2, cy + 1, Math.max(2, r - 3), '#6fc46e');
    for (var i = 0; i < 4; i++) {
      P(c, '#9bdc93', x + Math.round((hash(seed + i * 3.7) - 0.5) * r * 1.6),
        cy - 1 + Math.round((hash(seed + i * 5.1) - 0.5) * r));
    }
  }

  // banco de la plaza
  function bench(c, cx, base) {
    R(c, '#a9714a', cx - 16, base - 16, 32, 3);   // respaldo
    R(c, '#c58a5c', cx - 16, base - 16, 32, 1);
    R(c, '#8d5c3d', cx - 16, base - 14, 32, 1);
    R(c, '#a9714a', cx - 16, base - 11, 32, 3);   // asiento
    R(c, '#d8a06d', cx - 16, base - 11, 32, 1);
    R(c, '#8d5c3d', cx - 13, base - 8, 3, 8);      // patas
    R(c, '#8d5c3d', cx + 10, base - 8, 3, 8);
  }

  // farola de hierro con su luz
  function lamp(c, x, gy) {
    R(c, '#4a3d52', x - 1, 44, 3, gy - 44);        // poste
    R(c, '#6b5470', x - 1, 44, 1, gy - 44);
    R(c, '#3f3348', x - 4, 41, 9, 3);              // base
    R(c, '#3f3348', x - 5, 32, 11, 3);             // remate
    R(c, '#4a3d52', x - 4, 35, 9, 6);              // farol
    R(c, '#ffe7a8', x - 3, 36, 7, 4);
    R(c, '#fff6cf', x - 2, 37, 5, 2);
    R(c, '#3f3348', x - 2, 29, 5, 3);              // punta
    P(c, '#3f3348', x, 28);
  }

  // cartel con flecha: marca la salida de la plaza
  function signpost(c, x, gy, dir) {
    R(c, '#8d5c3d', x - 1, gy - 14, 3, 14);
    R(c, '#a9714a', x - 1, gy - 14, 1, 14);
    R(c, '#c58a5c', x - 9, gy - 24, 18, 10);
    R(c, '#8d5c3d', x - 9, gy - 24, 18, 1);
    R(c, '#8d5c3d', x - 9, gy - 15, 18, 1);
    var ax = dir < 0 ? x - 7 : x + 1;
    R(c, '#fff6ee', ax, gy - 20, 7, 1);
    for (var i = 0; i < 4; i++) P(c, '#fff6ee', ax + (dir < 0 ? i : 6 - i), gy - 19 + i);
    for (i = 0; i < 4; i++) P(c, '#fff6ee', ax + (dir < 0 ? i : 6 - i), gy - 16 - i);
    R(c, '#fff6ee', ax + 2, gy - 20, 5, 1);
  }

  // camino de tierra que se sale del cuadro por un borde (las dos salidas)
  function dirtPath(c, edgeX, cy, half0, len, dir) {
    for (var i = 0; i < len; i++) {
      var x = edgeX + dir * i;
      var half = Math.round(half0 * (1 - i / len)) + 1;
      R(c, DIRT, x, cy - half, 1, half * 2);
      if (i % 3 === 0) P(c, mix(DIRT, '#ffffff', 0.25), x, cy - half + 2);
      if (i % 5 === 0) P(c, mix(DIRT, '#2b1a33', 0.25), x, cy + half - 3);
    }
  }

  // ------------------------------------------------------------------
  // escena estática (se cachea)
  // ------------------------------------------------------------------
  function plazaBack(c, W, H) {
    var g = plazaGeo(W, H), gy = g.gy;
    var x, y, i, r;

    // ---- cielo con degradado ----
    vgrad(c, 0, 0, W, gy, SKY);

    // sol con halo tramado
    var sx = W - 26, sy = 20;
    for (var dx = -13; dx <= 13; dx++) {
      for (var dy = -13; dy <= 13; dy++) {
        var dd = Math.sqrt(dx * dx + dy * dy);
        if (dd > 9 && dd < 13.5 && th(sx + dx, sy + dy) < 0.5) P(c, '#ffeeb8', sx + dx, sy + dy);
      }
    }
    disc(c, sx, sy, 9, '#fff6cf');
    disc(c, sx - 1, sy - 1, 5, '#ffe28a');

    // nubes
    cloud(c, 12, 26, 7, '#ffffff', '#d6ecf8');
    cloud(c, 136, 12, 5, '#ffffff', '#d6ecf8');
    cloud(c, 224, 42, 4, '#ffffff', '#d6ecf8');

    // ---- colinas detrás de las casas ----
    for (x = 0; x < W; x++) {
      y = gy - 22 - Math.round(5 * Math.sin(x * 0.026 + 1.1) + 3 * Math.sin(x * 0.061 + 0.4));
      R(c, '#a9dfa8', x, y, 1, gy - y);
      R(c, '#8ecb92', x, y + 8, 1, gy - y - 8);
      P(c, '#c4ecc0', x, y);
    }

    // ---- casas del pueblo ----
    var hx = -10;
    while (hx < W + 8) {
      var bw = 26 + Math.floor(hash(hx * 1.7 + 3) * 22);
      var bh = 30 + Math.floor(hash(hx * 2.3 + 1) * 28);
      var by = gy - bh;
      var wall = PLAZA_WALLS[Math.floor(hash(hx * 3.1 + 2) * PLAZA_WALLS.length)];
      var roof = PLAZA_ROOFS[Math.floor(hash(hx * 5.3 + 7) * PLAZA_ROOFS.length)];
      house(c, hx, by, bw, bh, gy, wall, roof, hash(hx * 7.7 + 5));
      hx += bw + 1;
    }

    // ---- árboles al fondo de la plaza ----
    tree(c, 120, gy, 34, 3);
    tree(c, 188, gy, 28, 11);

    // ---- suelo de adoquines (empieza justo en y = 110) ----
    R(c, SOIL, 0, gy, W, H - gy);
    R(c, mix(SOIL, '#ffffff', 0.45), 0, gy, W, 6);      // acera
    R(c, mix(SOIL, '#2b1a33', 0.18), 0, gy + 6, W, 1);   // bordillo
    var ry = gy + 7, row = 0;
    while (ry < H) {
      var rh = 3 + Math.floor(row * 0.8);
      var sw = 12 + Math.floor(row * 1.6);
      var off = (row % 2) ? Math.floor(sw / 2) : 0;
      for (var st = -sw + off; st < W; st += sw) {
        R(c, STONE, st + 1, ry + 1, sw - 2, rh - 2);
        R(c, mix(STONE, '#ffffff', 0.4), st + 1, ry + 1, sw - 2, 1);
        R(c, mix(STONE, '#8a7550', 0.3), st + 1, ry + rh - 2, sw - 2, 1);
      }
      ry += rh; row++;
    }
    // sombra de fondo: los adoquines del fondo quedan más apagados
    var mid = gy + Math.round((H - gy) * 0.35);
    for (y = mid; y < H; y++) {
      c.globalAlpha = 0.04 + 0.22 * ((y - mid) / Math.max(1, H - mid));
      R(c, '#3a2a4a', 0, y, W, 1);
    }
    c.globalAlpha = 1;

    // ---- caminos de tierra que salen del cuadro (las dos salidas) ----
    dirtPath(c, 0, 150, 22, 56, 1);
    dirtPath(c, W - 1, 150, 22, 56, -1);

    // ---- fuente: ocupa el bloque que no se puede pisar (x 140..180, y 145..200) ----
    var fx = g.fx, ftop = g.ftop, fbot = g.fbot, fr = g.fw / 2;
    ellipse(c, fx, fbot - 4, fr + 1, 4, '#bda57c');         // sombra
    R(c, '#b7a99d', fx - 9, fbot - 30, 18, 30);            // pedestal
    R(c, '#d5c9bd', fx - 9, fbot - 30, 6, 30);
    R(c, '#9c8e82', fx + 4, fbot - 30, 5, 30);
    R(c, '#e2d8ce', fx - 12, fbot - 33, 24, 3);             // capitel
    R(c, '#cfc4bb', fx - 4, ftop + 10, 9, 13);              // columna
    R(c, '#e6dcd3', fx - 4, ftop + 10, 3, 13);
    ellipse(c, fx, fbot - 37, fr, 8, '#a99b90');            // cuenco
    ellipse(c, fx, fbot - 38, fr - 1, 7, '#cfc4bb');
    ellipse(c, fx, fbot - 38, fr - 4, 5, '#4f9fc9');        // agua
    ellipse(c, fx, fbot - 39, fr - 7, 3, '#7fc9e8');
    R(c, '#e6dcd3', fx - 5, ftop + 3, 11, 10);              // gatito de piedra
    R(c, '#e6dcd3', fx - 5, ftop, 3, 3);                    // orejas
    R(c, '#e6dcd3', fx + 3, ftop, 3, 3);
    R(c, '#cfc4bb', fx - 5, ftop, 3, 1);
    P(c, '#4a3d52', fx - 2, ftop + 6);
    P(c, '#4a3d52', fx + 2, ftop + 6);
    P(c, '#ff8fab', fx, ftop + 8);

    // ---- bancos ----
    bench(c, 76, 132);
    bench(c, 206, 132);

    // ---- farolas ----
    lamp(c, 108, gy);
    lamp(c, 234, gy);

    // ---- puesto de premios con banderines ----
    var stx = 244, stw = 40;
    R(c, '#8d5c3d', stx, gy - 38, 3, 38);                 // postes
    R(c, '#8d5c3d', stx + stw - 3, gy - 38, 3, 38);
    R(c, '#a9714a', stx, gy - 16, stw, 16);               // mostrador
    R(c, '#c58a5c', stx, gy - 16, stw, 3);
    R(c, '#8d5c3d', stx, gy - 5, stw, 5);
    for (i = 0; i < stw + 6; i++) {                        // toldo a rayas
      R(c, i % 6 < 3 ? '#ff8fab' : '#fff6ee', stx - 3 + i, gy - 45, 1, 8);
    }
    for (i = 0; i < stw + 6; i += 6) {                     // festón del toldo
      var scx = stx - 3 + i + 3;
      R(c, '#fff6ee', scx - 2, gy - 37, 5, 2);
      R(c, '#ff8fab', scx - 1, gy - 37, 3, 1);
    }
    R(c, '#a9714a', stx + 4, gy - 60, 32, 14);            // cartel
    R(c, '#fff6ee', stx + 6, gy - 58, 28, 10);
    star5(c, stx + 20, gy - 52, '#ffd166', '#fff3c4');
    heart5(c, stx + 12, gy - 55, '#ff8fab');
    heart5(c, stx + 27, gy - 55, '#ff8fab');
    R(c, '#8d5c3d', stx + 19, gy - 70, 2, 10);            // mástil del banderín

    // ---- postes y cuerda de banderines ----
    R(c, '#8d5c3d', 47, 20, 3, gy - 20);
    R(c, '#a9714a', 47, 20, 1, gy - 20);
    disc(c, 48, 18, 2, '#c58a5c');
    R(c, '#8d5c3d', 271, 20, 3, gy - 20);
    R(c, '#a9714a', 271, 20, 1, gy - 20);
    disc(c, 272, 18, 2, '#c58a5c');
    for (x = 48; x <= 272; x++) {
      var u = (x - 48) / 224;
      P(c, '#6b5470', x, 20 + Math.round(18 * 4 * u * (1 - u)));
    }

    // ---- carteles de las salidas ----
    signpost(c, 24, gy, -1);
    signpost(c, 300, gy, 1);
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

  // ------------------------------------------------------------------
  // escena animada
  // ------------------------------------------------------------------
  function drawPlaza(c, W, H, t) {
    var g = plazaGeo(W, H), gy = g.gy, fx = g.fx, ftop = g.ftop, fbot = g.fbot;
    var x, y, i;
    c.drawImage(layer('plaza', W, H, plazaBack), 0, 0);

    // ---- banderines que ondean ----
    for (i = 0, x = 50; x < 272; x += 13, i++) {
      var u = (x - 48) / 224;
      var fy0 = 20 + Math.round(18 * 4 * u * (1 - u)) + 1;
      var col = PLAZA_FLAGS[i % PLAZA_FLAGS.length];
      var sw = Math.round(Math.sin(t * 2 + i * 0.8) * 1);
      for (var r = 0; r < 6; r++) {
        var half = Math.max(0, 2 - Math.floor(r / 2));
        R(c, col, x - half + (r > 2 ? sw : 0), fy0 + r, half * 2 + 1, 1);
      }
      P(c, '#ffffff', x, fy0 + 1);
    }

    // ---- agua de la fuente ----
    var mouthY = ftop + 8;
    for (i = 0; i < 6; i++) {
      var ph = (t * 0.9 + i / 6) % 1;
      var dx = fx + 5 + Math.round(ph * 9);
      var dy = mouthY + Math.round(ph * ph * 13);
      P(c, '#cdeeff', dx, dy);
      if (i % 2 === 0) P(c, '#ffffff', dx, dy - 1);
    }
    for (i = 0; i < 3; i++) {
      var rp = (t * 0.6 + i / 3) % 1;
      ellipse(c, fx + 5, fbot - 38, 3 + rp * 11, 1 + rp * 3, '#a2dcf5');
    }
    if ((Math.floor(t * 8) % 6) < 3) sparkle(c, fx - 7, fbot - 39, false, '#ffffff', '#ffffff');

    // ---- banderín del puesto ----
    var flagx = 244 + 19, flagy = gy - 70;
    for (i = 0; i < 6; i++) {
      var w2 = 8 - i;
      var off = Math.round(Math.sin(t * 3 - i * 0.6) * 1.5);
      R(c, i % 2 ? '#ff8fab' : '#ffd166', flagx + 1 + off, flagy + i, w2, 1);
    }

    // ---- peluches del puesto ----
    plush(c, 252, gy - 18, '#ffd166', t, 0);
    plush(c, 264, gy - 18, '#c9b6ec', t, 1);
    plush(c, 276, gy - 18, '#8ecae6', t, 2);

    // ---- luz de las farolas ----
    c.fillStyle = 'rgba(255,226,150,0.16)';
    c.fillRect(104, 35, 9, 5);
    c.fillStyle = 'rgba(255,226,150,0.08)';
    c.fillRect(101, 34, 15, 7);
    c.fillStyle = 'rgba(255,226,150,0.16)';
    c.fillRect(230, 35, 9, 5);
    c.fillStyle = 'rgba(255,226,150,0.08)';
    c.fillRect(227, 34, 15, 7);

    // ---- pajaritos ----
    for (i = 0; i < 3; i++) {
      var bx = ((i * 46 + t * (3 + i)) % (W + 12)) - 6;
      var by = clamp(Math.round(gy * (0.16 + i * 0.08)), 4, Math.max(6, gy - 10))
        + Math.round(Math.sin(t * 2 + i) * 1);
      var up = (Math.floor(t * 6) + i) % 6 < 3;
      P(c, '#5d5a74', bx, by);
      P(c, '#5d5a74', bx - 1, by - (up ? 1 : 0));
      P(c, '#5d5a74', bx + 1, by - (up ? 1 : 0));
    }

    // ---- confeti flotando en el aire de la plaza ----
    for (i = 0; i < 14; i++) {
      var sp = 2 + hash(i * 3.7) * 3;
      var kx = (hash(i * 5.1) * (W + 10) + t * sp) % (W + 10) - 5;
      var ky = (hash(i * 7.3) * (gy - 10) + t * sp * 0.6) % (gy - 8) - 2;
      var ccol = PLAZA_FLAGS[i % PLAZA_FLAGS.length];
      if ((Math.floor(t * 4) + i) % 2) R(c, ccol, kx, ky, 1, 1); else P(c, ccol, kx, ky);
    }
  }

  window.CatBG.register({
    id: 'plaza', label: 'Plaza Bigotes', emoji: '🏛️', animated: true,
    draw: PX.scaled({ nativeW: NATIVE_W, draw: drawPlaza })
  });
})();
