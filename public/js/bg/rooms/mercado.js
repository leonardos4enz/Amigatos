/* Amigatos — fondo del Mercado del Cascabel (pixel art procedural)
 * Una escena = un archivo. Se registra en window.CatBG:
 *   CatBG.register({ id, label, emoji, animated, solids, draw(ctx, w, h, t) })
 * El arte se diseña sobre el ancho nativo (NATIVE_W) y se escala sin suavizado cuando el canvas
 * pide otra base (ver js/bg/pixels.js).
 *
 * La escena es nativa de 320x200 (docs/mundo.md, §1). Su geometría es la que declara
 * server/world.js para la sala "mercado": el empedrado caminable empieza en y=110 y el puesto
 * central (x 120..200, y 150..200) no se puede pisar. Los objetos sólidos se dibujan desde la
 * lista SOLIDS, que la escena publica con CatBG.solids('mercado'): ninguno de ellos se cruza
 * con los polígonos caminables de la sala.
 * Arte original de Amigatos: no se copia nada de otros juegos.
 */
(function () {
  'use strict';
  if (!window.CatBG || !window.CatBGPixels) return;

  var PX = window.CatBGPixels;
  var R = PX.R, P = PX.P, disc = PX.disc, ellipse = PX.ellipse;
  var vgrad = PX.vgrad, cloud = PX.cloud, sparkle = PX.sparkle;
  var layer = PX.layer, mix = PX.mix, INK = PX.INK;

  var NATIVE_W = 320;   // el mercado se dibuja a 320x200 lógicos (docs/mundo.md, §1)

  // Lienzo de diseño: 320x200, la misma resolución lógica que usa el servidor.
  var DW = 320, DH = 200;

  /* ------------------------------------------------------------------ */
  /* geometría (coincide con los walkable de server/world.js)           */
  /* ------------------------------------------------------------------ */
  var GY = 110;        // la línea de suelo: por debajo está el empedrado caminable
  var ROOF_Y = 30;     // el tejado de la fila de puestos del fondo
  var STALL_Y = 44;    // donde empiezan los toldos de la fila del fondo
  var STALL_H = 66;    // alto de esa fila: los puestos se apoyan en la línea de suelo
  var ALLEY_X0 = 104;  // el paso de piedra entre los puestos del fondo
  var ALLEY_X1 = 216;

  /* ------------------------------------------------------------------ */
  /* paleta                                                              */
  /* ------------------------------------------------------------------ */
  var SKY = ['#5eb4df', '#84cdee', '#a9def2', '#cbeaf7'];
  var PAVE = '#b0a08b';   // el empedrado: gris cálido, nunca igual al azul del cielo
  var STONE = '#c9bca5';
  var DIRT = '#c7a673';   // el camino de las salidas
  var WOOD = '#8d5c3d';
  var WOOD_L = '#a9714a';
  var WOOD_D = '#6b452c';
  var WALL = '#c3b39c';
  var SHADOW = '#5a3f2c'; // el interior en penumbra de los puestos

  /* ------------------------------------------------------------------ */
  /* sólidos: los objetos que no se pueden pisar                          */
  /* ------------------------------------------------------------------ */
  // Cada puesto se dibuja desde su rectángulo. La lista es la que se publica con
  // CatBG.solids('mercado') y la que garantiza que ningún objeto se cruza con el
  // piso caminable de la sala (server/world.js).
  var STALL_FRUTA = { x: 0, y: STALL_Y, w: 104, h: STALL_H, awn: ['#e0576b', '#fff2df'], kind: 'fruta' };
  var STALL_PESCADO = { x: 216, y: STALL_Y, w: 52, h: STALL_H, awn: ['#3f8fb0', '#e9f6fb'], kind: 'pescado' };
  var STALL_FLORES = { x: 268, y: STALL_Y, w: 52, h: STALL_H, awn: ['#6aa84f', '#f2fbec'], kind: 'flores' };
  // El puesto central del primer plano: ocupa justo la zona que el servidor no deja pisar.
  var PUESTO_CENTRAL = { x: 122, y: 152, w: 76, h: 48, awn: ['#f0a03c', '#fff2df'], kind: 'mixto', big: true };
  var SOLIDS = [STALL_FRUTA, STALL_PESCADO, STALL_FLORES, PUESTO_CENTRAL];

  /* ------------------------------------------------------------------ */
  /* banderines: la cuerda entre los dos postes                          */
  /* ------------------------------------------------------------------ */
  var POLE_L = 6, POLE_R = 314, CORD_Y = 16, CORD_SAG = 14;
  var FLAG_COLORS = ['#ff8fab', '#ffd166', '#8ecae6', '#b9f0c9', '#cdb8de'];
  // La altura de la cuerda en una x dada (cuelga en el centro).
  function cordY(x) {
    var u = (x - POLE_L) / (POLE_R - POLE_L);
    return CORD_Y + Math.round(CORD_SAG * 4 * u * (1 - u));
  }

  /* ------------------------------------------------------------------ */
  /* piezas del escenario                                                 */
  /* ------------------------------------------------------------------ */

  // Cielo con sol y nubes.
  function drawSky(c) {
    vgrad(c, 0, 0, DW, ROOF_Y + 2, SKY);
    disc(c, 268, 13, 7, '#ffeeb8');
    disc(c, 268, 13, 5, '#fff8d8');
    cloud(c, 16, 4, 5, '#ffffff', '#d8ecf8');
    cloud(c, 118, 0, 4, '#ffffff', '#d8ecf8');
    cloud(c, 206, 8, 3, '#ffffff', '#d8ecf8');
  }

  // El tejado de tejas que corona la fila de puestos del fondo.
  function drawRoof(c) {
    R(c, WOOD_D, 0, ROOF_Y, DW, 14);
    for (var x = 0; x < DW; x += 8) {
      R(c, WOOD, x + 1, ROOF_Y + 1, 6, 12);
      R(c, WOOD_L, x + 1, ROOF_Y + 1, 6, 1);
    }
    R(c, INK, 0, ROOF_Y, DW, 1);
    R(c, '#553726', 0, ROOF_Y + 13, DW, 1);
  }

  // El paso de piedra entre dos puestos: al fondo se ve la calle del pueblo.
  function drawAlley(c) {
    var x0 = ALLEY_X0, x1 = ALLEY_X1;
    var ix0 = x0 + 14, ix1 = x1 - 14, iy0 = 58;
    var iw = ix1 - ix0;
    // el muro del paso
    R(c, WALL, x0, STALL_Y, x1 - x0, GY - STALL_Y);
    for (var y = STALL_Y + 4; y < GY; y += 6) {
      R(c, mix(WALL, '#8a7a63', 0.18), x0, y, x1 - x0, 1);
    }
    // el hueco del paso
    R(c, '#3a2f47', ix0, iy0, iw, GY - iy0);
    // el cielo del fondo
    R(c, '#a9d8ef', ix0, iy0, iw, 12);
    // las fachadas del fondo
    R(c, '#cbb69b', ix0, iy0 + 12, iw, 20);
    for (var i = 0; i < 6; i++) {
      var fx = ix0 + 4 + i * 14;
      R(c, '#ab9a80', fx, iy0 + 16, 10, 15);
      R(c, '#8fa6b5', fx + 2, iy0 + 18, 3, 5);
    }
    // la calle del fondo
    R(c, '#c9b190', ix0, iy0 + 32, iw, GY - iy0 - 32);
    for (i = 0; i < 6; i++) P(c, '#b09a7c', ix0 + 6 + i * 14, iy0 + 38 + (i % 2) * 3);
    // el dintel de piedra y sus dovelas
    R(c, '#a89578', ix0 - 5, iy0 - 6, iw + 10, 6);
    R(c, '#c6b394', ix0 - 5, iy0 - 6, iw + 10, 2);
    for (i = 0; i < 8; i++) R(c, '#8f7d62', ix0 - 4 + i * 12, iy0 - 5, 1, 5);
  }

  // Cesta de fruta. x,y = esquina inferior izquierda (y = la base).
  function basket(c, x, y, w, h, cols) {
    R(c, '#c08b4f', x, y - h, w, h);
    R(c, '#a06f3c', x, y - h, w, 1);
    R(c, '#d8a566', x, y - h, 1, h);
    R(c, '#8a5a2e', x, y - 1, w, 1);
    var paso = Math.max(3, Math.floor((w - 6) / 4));
    for (var i = 0; i < 4; i++) {
      var fx = x + 4 + i * paso;
      var fy = y - h + 2 + (i % 2);
      var col = cols[i % cols.length];
      disc(c, fx, fy, 2, col);
      P(c, mix(col, '#ffffff', 0.5), fx - 1, fy - 1);
    }
  }

  // Caja de pescado. x,y = esquina inferior izquierda.
  function fishCrate(c, x, y, w, h) {
    R(c, WOOD_L, x, y - h, w, h);
    R(c, WOOD, x, y - h, w, 1);
    R(c, WOOD_D, x, y - 2, w, 2);
    R(c, '#5f92ad', x + 2, y - h + 2, w - 4, h - 4);
    var i;
    for (i = 0; i < 3; i++) {
      var fx = x + 5 + i * Math.max(6, Math.floor((w - 10) / 3));
      var fy = y - h + 4;
      ellipse(c, fx, fy, 3, 2, '#cfe6f0');
      R(c, '#7fb2c8', fx - 4, fy - 2, 2, 4);
      P(c, INK, fx + 1, fy - 1);
    }
  }

  // Poto de flores. x,y = la base.
  function flowerPot(c, x, y) {
    R(c, '#c1714f', x, y - 6, 8, 6);
    R(c, '#a55a3c', x, y - 2, 8, 2);
    R(c, '#4f9e57', x + 3, y - 12, 2, 7);
    P(c, '#ff8fab', x + 4, y - 13);
    P(c, '#ffd166', x + 2, y - 12);
    P(c, '#cdb8de', x + 5, y - 11);
  }

  // Barril de madera. x,y = la base.
  function barrel(c, x, y) {
    R(c, WOOD, x, y - 12, 10, 12);
    R(c, WOOD_L, x + 1, y - 11, 3, 10);
    R(c, WOOD_D, x + 7, y - 11, 3, 10);
    R(c, '#5a5a66', x, y - 9, 10, 2);
    R(c, '#5a5a66', x, y - 4, 10, 2);
    ellipse(c, x + 5, y - 12, 5, 2, '#b9834f');
  }

  // Lo que vende cada puesto, encima del mostrador.
  function drawGoods(c, s, topY) {
    var x = s.x;
    if (s.kind === 'fruta') {
      basket(c, x + 6, topY, 26, 14, ['#e0576b', '#f0a03c', '#7ab648']);
      basket(c, x + 36, topY, 24, 13, ['#e0576b', '#f0a03c', '#7ab648']);
      basket(c, x + 64, topY, 24, 12, ['#e0576b', '#f0a03c', '#7ab648']);
      barrel(c, x + 90, topY);
    } else if (s.kind === 'pescado') {
      fishCrate(c, x + 4, topY, 26, 12);
      fishCrate(c, x + 32, topY, 18, 10);
    } else if (s.kind === 'flores') {
      flowerPot(c, x + 4, topY);
      flowerPot(c, x + 14, topY);
      flowerPot(c, x + 24, topY);
      basket(c, x + 33, topY, 18, 10, ['#ff8fab', '#ffd166', '#cdb8de']);
    } else {
      basket(c, x + 4, topY, 30, 15, ['#e0576b', '#f0a03c', '#7ab648']);
      fishCrate(c, x + 38, topY, 32, 13);
    }
  }

  // El cartelito que cuelga del toldo: dice qué vende el puesto (sin letras, con dibujos).
  function drawSign(c, s, y) {
    var cx = s.x + Math.floor(s.w / 2);
    var x0 = cx - 8;
    R(c, INK, x0, y, 16, 11);
    R(c, '#fff6ee', x0 + 1, y + 1, 14, 9);
    if (s.kind === 'fruta') {
      disc(c, cx, y + 5, 3, '#e0576b');
      P(c, '#4f9e57', cx, y + 1);
    } else if (s.kind === 'pescado') {
      ellipse(c, cx + 1, y + 5, 4, 2, '#3f8fb0');
      R(c, '#2f6b88', cx - 4, y + 3, 2, 4);
    } else if (s.kind === 'flores') {
      P(c, '#ffd166', cx, y + 4);
      P(c, '#ffd166', cx - 1, y + 5); P(c, '#ffd166', cx + 1, y + 5);
      P(c, '#ffd166', cx, y + 6);
      R(c, '#4f9e57', cx, y + 7, 1, 2);
    } else {
      P(c, '#e0576b', cx - 3, y + 5);
      P(c, '#3f8fb0', cx + 3, y + 5);
    }
  }

  // La estantería del fondo del puesto: una tabla con botes de cristal.
  // Se salta la zona del cartelito (sx0..sx1) para que no se tapen.
  function shelf(c, s, y, sx0, sx1) {
    var x = s.x + 3, w = s.w - 6;
    R(c, WOOD_D, x, y, w, 3);
    R(c, WOOD, x, y, w, 1);
    var i, jx;
    for (i = 0; i < 5; i++) {
      jx = x + 5 + i * Math.max(7, Math.floor((w - 10) / 5));
      if (jx > sx0 - 7 && jx < sx1 + 1) continue;
      var jh = 6 + (i % 2) * 2;
      R(c, '#cfe6f2', jx, y - jh, 5, jh);
      R(c, '#ffffff', jx, y - jh, 1, jh);
      R(c, WOOD_D, jx, y - jh - 1, 5, 1);
      P(c, '#f0a03c', jx + 2, y - jh + 2);
    }
  }

  // Un puesto del mercado: toldo a rayas, postes, mostrador y género.
  function drawStall(c, s) {
    var x = s.x, y = s.y, w = s.w, h = s.h;
    var awnH = s.big ? Math.round(h * 0.30) : Math.round(h * 0.21);  // el toldo
    var counterH = s.big ? Math.round(h * 0.28) : Math.round(h * 0.34); // el mostrador
    var base = y + h;                                     // donde se apoya el puesto
    var i;

    // el interior en penumbra del puesto: más oscuro cuanto más arriba
    R(c, SHADOW, x, y, w, h);
    for (i = 0; i < h; i++) {
      c.fillStyle = 'rgba(0,0,0,' + (0.30 - i / h * 0.24).toFixed(3) + ')';
      c.fillRect(x, y + i, w, 1);
    }
    // la estantería del fondo del puesto (solo en los puestos del fondo de la sala)
    var signX0 = x + Math.floor(w / 2) - 8, signX1 = signX0 + 15;
    if (!s.big) shelf(c, s, y + awnH + 16, signX0, signX1);
    // el género sobre el mostrador
    drawGoods(c, s, base - counterH);
    // el mostrador
    R(c, WOOD, x, base - counterH, w, counterH);
    R(c, WOOD_L, x, base - counterH, w, 2);
    R(c, WOOD_D, x, base - 3, w, 3);
    for (i = 0; i < w; i += 12) R(c, mix(WOOD, '#5a3a26', 0.35), x + i, base - counterH + 3, 1, counterH - 6);
    R(c, INK, x, base - counterH, w, 1);
    // el cartelito: colgado del toldo en los puestos del fondo, en el mostrador en el grande
    drawSign(c, s, s.big ? base - counterH + 2 : y + awnH + 2);
    // los postes que sostienen el toldo
    R(c, WOOD, x + 1, y + awnH, 3, base - y - awnH);
    R(c, WOOD_L, x + 1, y + awnH, 1, base - y - awnH);
    R(c, WOOD, x + w - 4, y + awnH, 3, base - y - awnH);
    R(c, WOOD_L, x + w - 4, y + awnH, 1, base - y - awnH);
    // el toldo: franjas de dos colores con el festón colgando
    for (i = 0; i < w; i++) {
      var col = (Math.floor(i / 6) % 2 === 0) ? s.awn[0] : s.awn[1];
      R(c, col, x + i, y, 1, awnH);
      R(c, mix(col, '#ffffff', 0.3), x + i, y, 1, 1);
    }
    for (i = 0; i < w; i += 6) {
      var scol = (Math.floor(i / 6) % 2 === 0) ? s.awn[0] : s.awn[1];
      ellipse(c, x + i + 3, y + awnH + 1, 3, 2, scol);
      P(c, mix(scol, '#2b1a33', 0.3), x + i + 3, y + awnH + 3);
    }
    R(c, INK, x, y, w, 1);
    R(c, mix(s.awn[0], '#2b1a33', 0.35), x, y + awnH - 1, w, 1);
  }

  // El empedrado del suelo: filas de losas que crecen un poco (perspectiva).
  function drawGround(c) {
    R(c, PAVE, 0, GY, DW, DH - GY);
    var ry = GY, row = 0;
    while (ry < DH) {
      var rh = 5 + Math.floor(row * 1.2);
      if (ry + rh > DH) rh = DH - ry;
      var sw = 15 + Math.floor(row * 2.4);
      var off = (row % 2) ? Math.floor(sw / 2) : 0;
      for (var st = -sw + off; st < DW; st += sw) {
        R(c, STONE, st + 1, ry + 1, sw - 2, rh - 2);
        R(c, mix(STONE, '#ffffff', 0.35), st + 1, ry + 1, sw - 2, 1);
        R(c, mix(STONE, '#6b5a4a', 0.28), st + 1, ry + rh - 2, sw - 2, 1);
      }
      ry += rh; row++;
    }
    // el bordillo del fondo
    R(c, mix(PAVE, '#ffffff', 0.4), 0, GY, DW, 3);
    R(c, mix(PAVE, '#4a3d52', 0.3), 0, GY + 3, DW, 1);
    // la sombra que echa la fila de puestos sobre el empedrado
    for (var k = 0; k < 12; k++) {
      c.fillStyle = 'rgba(70,58,48,' + (0.26 - k * 0.02).toFixed(3) + ')';
      c.fillRect(0, GY + k, DW, 1);
    }
  }

  // El camino de tierra que se sale del cuadro por las dos salidas.
  function drawExitPath(c, edgeX, dir) {
    for (var i = 0; i < 48; i++) {
      var x = edgeX + dir * i;
      var half = Math.round(20 * (1 - i / 48)) + 1;
      R(c, DIRT, x, 150 - half, 1, half * 2);
      if (i % 3 === 0) P(c, mix(DIRT, '#ffffff', 0.25), x, 150 - half + 2);
      if (i % 4 === 0) P(c, mix(DIRT, '#2b1a33', 0.22), x, 150 + half - 3);
    }
  }

  // Cartel con flecha al borde del mercado: marca por dónde se sale (las dos salidas).
  function drawSignpost(c, x, dir) {
    R(c, WOOD_D, x - 1, 92, 3, 16);
    R(c, WOOD, x - 1, 92, 1, 16);
    R(c, WOOD_L, x - 10, 80, 20, 12);
    R(c, WOOD_D, x - 10, 80, 20, 1);
    R(c, WOOD_D, x - 10, 91, 20, 1);
    var ax = dir < 0 ? x - 8 : x + 2;
    R(c, '#fff6ee', ax, 84, 7, 1);
    for (var i = 0; i < 4; i++) P(c, '#fff6ee', ax + (dir < 0 ? i : 6 - i), 85 + i);
    for (i = 0; i < 4; i++) P(c, '#fff6ee', ax + (dir < 0 ? i : 6 - i), 88 - i);
    R(c, '#fff6ee', ax + 2, 84, 5, 1);
  }

  // Los postes y la cuerda de banderines del fondo.
  function drawPoles(c) {
    R(c, WOOD_D, POLE_L, 8, 4, 100);
    R(c, WOOD, POLE_L, 8, 1, 100);
    R(c, WOOD_D, POLE_R, 8, 4, 100);
    R(c, WOOD, POLE_R, 8, 1, 100);
    disc(c, POLE_L + 1, 7, 3, WOOD_L);
    disc(c, POLE_R + 1, 7, 3, WOOD_L);
    for (var x = POLE_L + 2; x <= POLE_R + 1; x++) P(c, '#6b5470', x, cordY(x));
  }

  /* ------------------------------------------------------------------ */
  /* escena completa                                                      */
  /* ------------------------------------------------------------------ */
  function mercadoBack(c) {
    var i;
    drawSky(c);
    drawRoof(c);
    drawAlley(c);
    for (i = 0; i < SOLIDS.length; i++) drawStall(c, SOLIDS[i]);
    drawPoles(c);
    drawGround(c);
    drawExitPath(c, 0, 1);
    drawExitPath(c, DW - 1, -1);
    drawSignpost(c, 26, -1);
    drawSignpost(c, 294, 1);
    // el puesto central va al final: está en primer plano
    drawStall(c, PUESTO_CENTRAL);
  }

  function drawMercado(c, W, H, t) {
    var sx = W / DW, sy = H / DH, i, x;
    c.save();
    // todo el arte se diseña en 320x200 y se escala sin suavizado al lienzo que pida el canvas
    c.setTransform(sx, 0, 0, sy, 0, 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(layer('mercado', DW, DH, mercadoBack), 0, 0);

    // ---- banderines que ondean ----
    for (i = 0, x = POLE_L + 8; x < POLE_R - 6; x += 13, i++) {
      var fy = cordY(x) + 1;
      var col = FLAG_COLORS[i % FLAG_COLORS.length];
      var sw = Math.round(Math.sin(t * 2 + i * 0.8) * 1);
      for (var r = 0; r < 6; r++) {
        var half = Math.max(0, 2 - Math.floor(r / 2));
        R(c, col, x - half + (r > 2 ? sw : 0), fy + r, half * 2 + 1, 1);
      }
      P(c, '#ffffff', x, fy + 1);
    }

    // ---- el farol del paso se mece ----
    var lx = ALLEY_X0 + 14 + Math.floor((ALLEY_X1 - ALLEY_X0 - 28) / 2);
    var ly = 63 + Math.round(Math.sin(t * 1.6) * 1);
    R(c, '#4a3d52', lx, 58, 1, ly - 58);
    R(c, INK, lx - 3, ly, 7, 6);
    R(c, '#ffe7a8', lx - 2, ly + 1, 5, 4);
    R(c, '#fff6cf', lx - 1, ly + 2, 3, 2);

    // ---- el sol brilla ----
    for (i = 0; i < 6; i++) {
      var ang = t * 0.6 + i;
      if (Math.floor(t * 4) % 3 === 0) sparkle(c, 268 + Math.round(Math.cos(ang) * 10), 13 + Math.round(Math.sin(ang) * 8), false, '#fff6cf', '#ffffff');
    }

    // ---- pajaritos ----
    for (i = 0; i < 2; i++) {
      var bx = ((i * 90 + t * (4 + i)) % (DW + 20)) - 10;
      var by = 8 + i * 6 + Math.round(Math.sin(t * 2 + i) * 1);
      var up = (Math.floor(t * 6) + i) % 6 < 3;
      P(c, '#5d5a74', bx, by);
      P(c, '#5d5a74', bx - 1, by - (up ? 1 : 0));
      P(c, '#5d5a74', bx + 1, by - (up ? 1 : 0));
    }

    // ---- el humo del barril del puesto de fruta ----
    for (i = 0; i < 3; i++) {
      var d = ((t * 5 + i * 4) % 14);
      var px = 95 + Math.round(Math.sin(d / 2 + i) * 2);
      c.fillStyle = 'rgba(255,255,255,' + (0.5 - d * 0.03).toFixed(3) + ')';
      c.fillRect(px, 90 - d, 1, 2);
    }

    c.restore();
  }

  window.CatBG.register({
    id: 'mercado', label: 'Mercado del Cascabel', emoji: '🧺', animated: true,
    solids: SOLIDS,
    draw: PX.scaled({ nativeW: NATIVE_W, draw: drawMercado })
  });
})();
