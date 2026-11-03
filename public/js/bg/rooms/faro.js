/* Amigatos — fondo de la Colina del Faro (pixel art procedural)
 * Una escena = un archivo. Se registra en window.CatBG:
 *   CatBG.register({ id, label, emoji, animated, draw(ctx, w, h, t), solids })
 * El arte se diseña sobre el ancho nativo (NATIVE_W) y se escala sin suavizado cuando el canvas
 * pide otra base (ver js/bg/pixels.js).
 *
 * La colina se dibuja a 320x200 lógicos (docs/mundo.md §1) con la misma geometría que define
 * server/world.js para la sala "faro": el suelo caminable empieza en y=120, el mirador de
 * detrás del faro (x 90..210, y 120..160) es transitable y la base de la colina
 * (x 91..209, y 161..199) no se pisa. La salida al mercado se ve como un camino de tierra que
 * sale del cuadro por la izquierda (x 0..15, y 130..169).
 *
 * Los objetos sólidos de la escena se declaran en `solids` (rectángulos en píxeles lógicos):
 * ninguno de ellos pisa un polígono caminable, y el test lo comprueba contra server/world.js.
 * Arte original de Amigatos: no se copia nada de otros juegos.
 */
(function () {
  'use strict';
  if (!window.CatBG || !window.CatBGPixels) return;

  var PX = window.CatBGPixels;
  var R = PX.R, P = PX.P, disc = PX.disc;
  var vgrad = PX.vgrad, cloud = PX.cloud, sparkle = PX.sparkle;
  var hash = PX.hash, clamp = PX.clamp, layer = PX.layer, INK = PX.INK;

  var NATIVE_W = 320;      // ancho nativo del arte (el mundo es 320x200)

  /* ------------------------------------------------------------------ */
  /* geometría de la sala (coincide con server/world.js, sala "faro")    */
  /* ------------------------------------------------------------------ */
  var DW = 320, DH = 200;  // lienzo de diseño
  var GROUND_Y = 120;      // el suelo caminable empieza aquí
  var SEA_Y0 = 64;         // el mar (al fondo) empieza aquí
  var SEA_Y1 = 92;         // el mar acaba aquí: encima va la orilla de enfrente
  var SHORE_Y1 = 120;      // la orilla lejana llega hasta la cresta de la colina

  // Objetos sólidos de la escena: rectángulos {x, y, w, h} en píxeles lógicos que cubren
  // x..x+w-1 e y..y+h-1 (como las salidas del servidor). Ninguno puede pisar el suelo
  // caminable: el test de navegador lo comprueba contra los polígonos de server/world.js.
  var SOLIDS = [
    { x: 0, y: SEA_Y0, w: DW, h: 18 },                // el mar (y64..81: siempre es agua)
    { x: 0, y: 82, w: DW, h: SHORE_Y1 - 82 },         // la orilla de enfrente (y82..119)
    { x: 136, y: 14, w: 28, h: 106 },                 // el faro (x136..163, y14..119)
    { x: 91, y: 161, w: 119, h: 39 }                  // la roca del mirador (x91..209, y161..199)
  ];

  /* ------------------------------------------------------------------ */
  /* piezas de la escena                                                  */
  /* ------------------------------------------------------------------ */

  // Cielo con degradado y sol.
  function sky(c) {
    vgrad(c, 0, 0, DW, SEA_Y0, ['#3f9fd4', '#6dc0e8', '#8ed4f0', '#b3e2f5']);
    var sx = 48, sy = 26, dx, dy;
    for (dx = -12; dx <= 12; dx++) {
      for (dy = -12; dy <= 12; dy++) {
        var dd = Math.sqrt(dx * dx + dy * dy);
        if (dd > 8 && dd < 12 && PX.th(sx + dx, sy + dy) < 0.5) P(c, '#ffeeb8', sx + dx, sy + dy);
      }
    }
    disc(c, sx, sy, 8, '#fff6cf');
    disc(c, sx - 1, sy - 1, 5, '#ffe28a');
    // nubes fijas al fondo
    cloud(c, 150, 16, 4, '#ffffff', '#dceef8');
    cloud(c, 250, 34, 3, '#ffffff', '#dceef8');
  }

  // El mar, al fondo: agua con rayas de espuma y un velero pequeño.
  function sea(c) {
    vgrad(c, 0, SEA_Y0, DW, SEA_Y1 - SEA_Y0, ['#2a6d9c', '#3d8ac0', '#57a6d4']);
    var i, x, y;
    for (i = 0; i < 46; i++) {
      x = Math.round(hash(i * 3.7) * (DW - 6));
      y = SEA_Y0 + 3 + Math.round(hash(i * 5.1) * (SEA_Y1 - SEA_Y0 - 5));
      R(c, '#a5d9f0', x, y, 2 + Math.floor(hash(i * 2.3) * 4), 1);
    }
    // el velero
    var bx = 244, by = SEA_Y0 + 16;
    R(c, '#3b2a40', bx, by, 9, 2);
    R(c, '#fff6ee', bx + 1, by, 7, 1);
    R(c, '#3b2a40', bx + 4, by - 7, 1, 7);
    R(c, '#fff6ee', bx + 5, by - 7, 4, 5);
    R(c, '#ff8fab', bx + 1, by - 6, 3, 3);
  }

  // La cresta de la loma de enfrente: sube y baja sobre el mar, pero nunca deja
  // un hueco entre el agua y la orilla.
  function shoreTop(x) {
    return SEA_Y1 - Math.round(5 + 3 * Math.sin(x * 0.031 + 0.7) + 2 * Math.sin(x * 0.083 + 2.1));
  }

  // La orilla de enfrente: una loma baja de roca y matorral detrás del mar.
  function shore(c) {
    var x, top;
    for (x = 0; x < DW; x++) {
      top = shoreTop(x);
      R(c, '#4f7d6a', x, top, 1, SHORE_Y1 - top);
      P(c, '#71a68a', x, top);
      R(c, '#3c6252', x, top + 5, 1, SHORE_Y1 - top - 5);
    }
    // rocas sueltas en la orilla
    var rocks = [28, 62, 188, 212, 286];
    for (var i = 0; i < rocks.length; i++) {
      var rx = rocks[i], ry = shoreTop(rx) + 1;
      R(c, '#5d5a6b', rx, ry, 6, 3);
      R(c, '#7b7789', rx, ry, 4, 1);
      R(c, '#474455', rx, ry + 2, 6, 1);
    }
  }

  // El suelo de la colina: hierba que sube desde el borde hasta la cresta.
  function ground(c) {
    var y, i, x;
    R(c, '#7cc06f', 0, GROUND_Y, DW, DH - GROUND_Y);
    R(c, '#9fdc86', 0, GROUND_Y, DW, 1);            // la cresta, un poco más clara
    // hacia abajo la hierba se apaga un poco (está más cerca)
    for (y = GROUND_Y + 18; y < DH; y++) {
      var k = (y - GROUND_Y - 18) / (DH - GROUND_Y - 18);
      c.globalAlpha = 0.12 * k;
      R(c, '#3f6b3a', 0, y, DW, 1);
    }
    c.globalAlpha = 1;
    // motas de hierba
    for (i = 0; i < 320; i++) {
      x = Math.round(hash(i * 3.1) * (DW - 1));
      y = GROUND_Y + 2 + Math.round(hash(i * 7.7) * (DH - GROUND_Y - 3));
      R(c, hash(i * 2.7) > 0.5 ? '#6aa85e' : '#93d383', x, y, 1, 1);
    }
  }

  // El camino de tierra: sube desde la salida del mercado (borde izquierdo) hasta la
  // cresta y sigue por lo alto de la colina, donde está el mirador del faro.
  function pathTop(x) {
    var k = clamp(1 - x / 80, 0, 1);
    return GROUND_Y + Math.round(10 * k * k * (3 - 2 * k));
  }
  function pathBottom(x) {
    var k = clamp(1 - x / 80, 0, 1);
    var w = 14 + 26 * k * k * (3 - 2 * k);
    if (x > 210) {
      // el camino se acaba antes de la roca: la hierba lo vuelve a cubrir
      var f = clamp((250 - x) / 40, 0, 1);
      w = w * f;
    }
    return pathTop(x) + Math.round(w);
  }

  function path(c) {
    var x, t, b, i;
    for (x = 0; x < DW; x++) {
      t = pathTop(x);
      b = pathBottom(x);
      if (b <= t) continue;
      R(c, '#d9c08a', x, t, 1, b - t + 1);
      R(c, '#ecd9ac', x, t, 1, 1);
      R(c, '#bfa06d', x, b, 1, 1);
    }
    // piedras sueltas del camino
    for (i = 0; i < 34; i++) {
      x = Math.round(hash(i * 4.9) * (DW - 1));
      t = pathTop(x);
      b = pathBottom(x);
      if (b - t < 4) continue;
      var y = t + 2 + Math.round(hash(i * 6.3) * (b - t - 3));
      P(c, '#c2a87c', x, y);
      if (i % 3 === 0) P(c, '#efdcb6', x + 1, y);
    }
  }

  // Flores y matitas de hierba sobre el césped.
  function flowers(c) {
    var cols = [['#ff8fab', '#e86a8e'], ['#ffd166', '#e9a93d'], ['#cdb8de', '#a991c9'],
      ['#ffffff', '#e0d6e0'], ['#8ecae6', '#6ba3c0']];
    var pos = [[16, 178], [26, 192], [38, 164], [48, 186], [60, 196], [72, 170], [82, 188],
      [226, 168], [238, 190], [250, 160], [262, 198], [274, 176], [286, 192], [300, 166],
      [306, 182], [16, 158], [300, 152]];
    for (var i = 0; i < pos.length; i++) {
      var x = pos[i][0], y = pos[i][1], cc = cols[i % cols.length];
      // la flor no se dibuja si el camino pasa por ahí
      if (y >= pathTop(x) && y <= pathBottom(x)) continue;
      P(c, '#4f9e57', x, y);
      P(c, '#4f9e57', x, y - 1);
      P(c, cc[0], x, y - 2);
      P(c, cc[1], x + 1, y - 2);
    }
    // matitas
    var tufts = [[8, 150], [34, 172], [58, 182], [76, 162], [232, 182], [256, 172],
      [280, 190], [294, 160], [310, 176]];
    for (var j = 0; j < tufts.length; j++) {
      var tx = tufts[j][0], ty = tufts[j][1];
      P(c, '#6fb06a', tx, ty); P(c, '#6fb06a', tx + 1, ty); P(c, '#6fb06a', tx, ty - 1);
    }
  }

  // La roca del mirador: el bloque de abajo no se puede pisar (server/world.js).
  function rock(c) {
    var x0 = 91, x1 = 209, y0 = 161, y1 = 199;
    var x, y, i;
    // silueta: los extremos se cortan en diagonal
    for (x = x0; x <= x1; x++) {
      var d = Math.min(x - x0, x1 - x);
      var dy = d < 16 ? 16 - d : 0;
      var top = y0 + dy;
      R(c, '#6f6a7d', x, top, 1, y1 - top + 1);
      R(c, '#8f89a0', x, top, 1, 2);
      R(c, '#514c5e', x, y1 - 7, 1, 7);
    }
    // grietas
    var cracks = [[112, 168, 6], [140, 174, 9], [176, 166, 5], [200, 180, 7], [124, 186, 8]];
    for (i = 0; i < cracks.length; i++) {
      var cx = cracks[i][0], cy = cracks[i][1], len = cracks[i][2];
      for (var k = 0; k < len; k++) P(c, '#413c4d', cx + k, cy + Math.round(k * 0.6));
    }
    // motas y musgo
    for (i = 0; i < 60; i++) {
      x = x0 + 2 + Math.round(hash(i * 2.9) * (x1 - x0 - 4));
      y = y0 + 4 + Math.round(hash(i * 5.3) * (y1 - y0 - 6));
      P(c, hash(i * 7.1) > 0.5 ? '#9a94a8' : '#5b5668', x, y);
    }
    for (i = 0; i < 26; i++) {
      x = x0 + 4 + Math.round(hash(i * 3.3) * (x1 - x0 - 8));
      var d2 = Math.min(x - x0, x1 - x);
      var top2 = y0 + (d2 < 16 ? 16 - d2 : 0);
      P(c, '#6aa85e', x, top2);
      if (i % 2 === 0) P(c, '#8bcd7c', x + 1, top2);
    }
  }

  // El faro: blanco y rojo, en la cresta de la colina, al fondo.
  function lighthouse(c) {
    var cx = 150;          // centro de la torre (x136..163)
    var baseY = 119;       // se apoya en la cresta
    var towerTop = 44;     // donde empieza la galería
    var bot = baseY - 8;   // donde empieza la torre
    var y, i;
    // zócalo de piedra
    R(c, '#8b8599', 138, baseY - 7, 24, 7);
    R(c, '#aaa4b8', 138, baseY - 7, 24, 2);
    R(c, '#6f6a7d', 138, baseY - 2, 24, 2);
    // torre con franjas rojas y blancas
    for (y = bot; y >= towerTop; y--) {
      var k = (bot - y) / Math.max(1, bot - towerTop);
      var half = Math.round(9 - 3 * k);
      var red = Math.floor((bot - y) / 7) % 2 === 1;
      R(c, red ? '#e0484a' : '#f4efe4', cx - half, y, half * 2 + 1, 1);
      R(c, red ? '#c23b3d' : '#dcd5c6', cx + half - 1, y, 1, 1);
    }
    // galería con barandilla
    R(c, '#5f5a70', cx - 12, towerTop - 3, 25, 3);
    R(c, '#8f89a0', cx - 12, towerTop - 3, 25, 1);
    for (i = -11; i <= 11; i += 3) P(c, '#3f3a4d', cx + i, towerTop - 1);
    // linterna
    R(c, '#5f5a70', cx - 8, towerTop - 17, 17, 14);
    R(c, '#ffe08a', cx - 6, towerTop - 15, 13, 11);
    R(c, '#fff6cf', cx - 5, towerTop - 14, 4, 9);
    R(c, '#5f5a70', cx - 1, towerTop - 15, 2, 11);
    // tejado rojo
    for (i = 0; i < 10; i++) {
      var h2 = Math.round(9 - i * 0.9);
      R(c, '#e0484a', cx - h2, towerTop - 27 + i, h2 * 2 + 1, 1);
      R(c, '#c23b3d', cx - h2, towerTop - 27 + i, 1, 1);
    }
    R(c, '#f4efe4', cx - 1, towerTop - 29, 3, 2);
    P(c, '#ffd166', cx, towerTop - 30);
  }

  /* ------------------------------------------------------------------ */
  /* escena completa                                                      */
  /* ------------------------------------------------------------------ */
  function faroBack(c) {
    sky(c);
    sea(c);
    shore(c);
    ground(c);
    path(c);
    flowers(c);
    lighthouse(c);
    rock(c);
  }

  function drawFaro(c, W, H, t) {
    var sx = W / DW, sy = H / DH, i;
    c.save();
    // todo el arte se diseña en 320x200 y se escala sin suavizado al lienzo que pida el canvas
    c.setTransform(sx, 0, 0, sy, 0, 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(layer('faro', DW, DH, faroBack), 0, 0);
    // nubes que pasan
    var cl = [[-60, 12, 4, 2.4], [90, 26, 3, 1.5], [210, 8, 3, 1.9]];
    for (i = 0; i < cl.length; i++) {
      var span = DW + 80;
      var cx = ((cl[i][0] + t * cl[i][3]) % span + span) % span - 40;
      cloud(c, cx, cl[i][1], cl[i][2], '#ffffff', '#e3eff8', '#bcd3e6');
    }
    // olas del mar
    for (i = 0; i < 7; i++) {
      var wx = Math.round(((i * 47 + t * 9) % (DW + 20)) - 10);
      var wy = SEA_Y0 + 4 + (i % 4) * 6;
      R(c, '#bfe6f7', wx, wy, 5, 1);
      R(c, '#7fc2e2', wx + 3, wy + 1, 3, 1);
    }
    // gaviotas
    for (i = 0; i < 3; i++) {
      var span2 = DW + 24;
      var bx = ((i * 90 + t * (7 + i * 2)) % span2 + span2) % span2 - 12;
      var by = 30 + i * 9 + Math.round(Math.sin(t * 2 + i) * 2);
      var up = Math.floor(t * 4 + i) % 2 === 0;
      P(c, '#4a5b74', bx, by);
      P(c, '#4a5b74', bx - 2, by - (up ? 1 : 0));
      P(c, '#4a5b74', bx + 2, by - (up ? 0 : 1));
    }
    // la linterna del faro se enciende y se apaga
    var glow = 0.10 + 0.07 * Math.sin(t * 1.6);
    c.fillStyle = 'rgba(255,224,138,' + glow.toFixed(3) + ')';
    c.fillRect(140, 26, 21, 20);
    c.fillStyle = 'rgba(255,246,207,' + (glow * 0.7).toFixed(3) + ')';
    c.fillRect(144, 29, 13, 14);
    if (Math.floor(t * 1.6) % 4 === 0) sparkle(c, 150, 33, false, '#ffffff', '#ffffff');
    // mariposas sobre la hierba
    for (i = 0; i < 2; i++) {
      var mx = 40 + i * 200 + Math.sin(t * 0.8 + i * 2.1) * 22;
      var my = 150 + Math.sin(t * 1.5 + i) * 14;
      if (my < 122) my = 122;
      var open = Math.floor(t * 8 + i) % 2 === 0;
      var mcol = i ? '#ff8fab' : '#fff6ee';
      if (open) { R(c, mcol, mx - 2, my - 1, 2, 2); R(c, mcol, mx + 1, my - 1, 2, 2); }
      else { R(c, mcol, mx - 1, my - 2, 1, 2); R(c, mcol, mx + 1, my - 2, 1, 2); }
      P(c, INK, mx, my - 1);
    }
    c.restore();
  }

  window.CatBG.register({
    id: 'faro', label: 'Colina del Faro', emoji: '🗼', animated: true,
    solids: SOLIDS,
    draw: PX.scaled({ nativeW: NATIVE_W, draw: drawFaro })
  });
})();
