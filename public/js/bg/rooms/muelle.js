/* Amigatos — fondo del Muelle de las Sardinas (pixel art procedural)
 * Una escena = un archivo. Se registra en window.CatBG:
 *   CatBG.register({ id, label, emoji, animated, solids, draw(ctx, w, h, t) })
 * El arte se diseña sobre el ancho nativo (NATIVE_W) y se escala sin suavizado cuando el canvas
 * pide otra base (ver js/bg/pixels.js).
 *
 * La escena respeta el suelo caminable que define server/world.js para la sala "muelle":
 *   - el camino que baja de la plaza: x 150..170, y 0..120;
 *   - las tablas del muelle: x 0..320, y 120..200.
 * Todo lo que no se puede pisar (el mar, la barca, la balsa con las cajas de sardinas, las
 * rocas y las pilas de madera) está en la lista SOLIDS, que se exporta con la escena para
 * poder comprobar que ningún objeto sólido invade el suelo caminable.
 * Arte original de Amigatos: no se copia nada de otros juegos.
 */
(function () {
  'use strict';
  if (!window.CatBG || !window.CatBGPixels) return;

  var PX = window.CatBGPixels;
  var R = PX.R, P = PX.P, disc = PX.disc, ellipse = PX.ellipse;
  var vgrad = PX.vgrad, cloud = PX.cloud, hash = PX.hash, layer = PX.layer, INK = PX.INK;

  var NATIVE_W = 320;    // el muelle se dibuja a 320x200 lógicos (docs/mundo.md, §1)

  // Lienzo de diseño: 320x200, la misma resolución lógica que usa el servidor.
  var DW = 320, DH = 200;

  // Geometría de la sala. Coincide con la del servidor (server/world.js, sala "muelle"):
  // el mar ocupa la parte de arriba y las tablas del muelle son el suelo de abajo.
  var HORIZON_Y = 34;    // el mar empieza aquí
  var DOCK_Y = 120;      // debajo de esta línea están las tablas (suelo caminable)
  var PATH_X0 = 150;     // el camino que baja de la plaza (suelo caminable)
  var PATH_X1 = 170;

  // Paleta
  var SKY = ['#4fb3e6', '#8ed3f0', '#c9ebfa'];
  var SEA = ['#5cb2d6', '#3d90ba', '#26759f', '#175a80'];
  var WOOD = '#b3814d', WOOD_L = '#c9975f', WOOD_D = '#8a5f38', WOOD_DD = '#6e4726';
  var FISH = '#d8e8ee', FISH_D = '#a9c4d0';

  /* ------------------------------------------------------------------ */
  /* los objetos sólidos de la escena                                     */
  /* ------------------------------------------------------------------ */

  /* Cada rectángulo es un objeto que NO se puede pisar: agua, piedra, madera.
   * Las posiciones salen de aquí, así el dibujo y la lista no se pueden separar.
   * Ninguno puede cruzar los polígonos caminables de server/world.js:
   *   - mar-izq / mar-der: el mar a un lado y a otro del camino;
   *   - isla: la isla del horizonte, al fondo a la izquierda;
   *   - barca: la barca amarrada, a la derecha;
   *   - balsa / cajas: la balsa flotante con las cajas de sardinas, a la izquierda;
   *   - roca: las rocas que asoman del agua;
   *   - pila-*: las pilingas de madera que sujetan el camino.
   */
  var SOLIDS = [
    { id: 'mar-izq', x: 0, y: HORIZON_Y, w: PATH_X0, h: DOCK_Y - HORIZON_Y },
    { id: 'mar-der', x: PATH_X1, y: HORIZON_Y, w: DW - PATH_X1, h: DOCK_Y - HORIZON_Y },
    { id: 'isla', x: 10, y: 20, w: 64, h: 14 },
    { id: 'barca', x: 190, y: 56, w: 100, h: 62 },
    { id: 'balsa', x: 88, y: 94, w: 60, h: 24 },
    { id: 'cajas', x: 94, y: 64, w: 50, h: 32 },
    { id: 'roca', x: 16, y: 100, w: 40, h: 18 },
    { id: 'pila-izq', x: 142, y: 92, w: 8, h: 28 },
    { id: 'pila-der', x: 170, y: 92, w: 8, h: 28 }
  ];

  // La posición de un sólido de la lista.
  function S(id) {
    for (var i = 0; i < SOLIDS.length; i++) if (SOLIDS[i].id === id) return SOLIDS[i];
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* piezas del escenario                                                 */
  /* ------------------------------------------------------------------ */

  // Cielo con sol y nubes.
  function sky(c) {
    vgrad(c, 0, 0, DW, HORIZON_Y, SKY);
    // sol con halo tramado
    var sx = 44, sy = 12;
    for (var dx = -12; dx <= 12; dx++) {
      for (var dy = -12; dy <= 12; dy++) {
        var dd = Math.sqrt(dx * dx + dy * dy);
        if (dd > 7 && dd < 12.5 && PX.th(sx + dx, sy + dy) < 0.5) P(c, '#ffeeb8', sx + dx, sy + dy);
      }
    }
    disc(c, sx, sy, 7, '#fff6cf');
    disc(c, sx - 1, sy - 1, 4, '#ffe28a');
    // nubes
    cloud(c, 92, 5, 4, '#ffffff', '#d9eefb');
    cloud(c, 220, 3, 5, '#ffffff', '#d9eefb');
    cloud(c, 262, 18, 3, '#ffffff', '#d9eefb');
  }

  // Mar: degradado, horizonte, olas y el reflejo del sol. El agua se pinta
  // dentro de los rectángulos sólidos de la lista (a un lado y a otro del camino).
  function sea(c) {
    var rts = [S('mar-izq'), S('mar-der')];
    for (var r = 0; r < rts.length; r++) {
      var mr = rts[r];
      vgrad(c, mr.x, mr.y, mr.w, mr.h, SEA);
      // la línea del horizonte
      R(c, '#e2f4fc', mr.x, mr.y, mr.w, 1);
      R(c, '#8ec6e0', mr.x, mr.y + 1, mr.w, 1);
      // olas: trazos horizontales, más juntos y largos cerca de la orilla
      var y = mr.y + 4, row = 0;
      while (y < mr.y + mr.h) {
        var n = 3 + Math.floor(hash(row * 3.1 + r * 11) * 5);
        for (var i = 0; i < n; i++) {
          var x = mr.x + Math.floor(hash(row * 5.7 + i * 2.3 + r * 3) * mr.w);
          var w = 3 + Math.floor(hash(row * 7.3 + i) * (4 + row));
          if (x + w > mr.x + mr.w) w = mr.x + mr.w - x;
          R(c, row % 2 ? '#8fd3ef' : '#74c1de', x, y, w, 1);
        }
        y += 3 + Math.floor(row * 0.7); row++;
      }
    }
    // el sol se refleja en el agua
    for (var ry = HORIZON_Y + 3; ry < 96; ry += 3) {
      var rw = 5 + Math.floor(hash(ry * 1.7) * 14);
      var rx = 44 - Math.floor(rw / 2) + Math.floor((hash(ry * 3.3) - 0.5) * 6);
      R(c, '#bfe9f8', rx, ry, rw, 1);
    }
  }

  // Isla lejana en el horizonte, con dos palmeras.
  function island(c) {
    var isl = S('isla');
    var x0 = isl.x, x1 = isl.x + isl.w, yb = HORIZON_Y;
    for (var x = x0; x < x1; x++) {
      var u = (x - x0) / isl.w;
      var h = 2 + Math.round(7 * Math.sin(Math.PI * Math.min(1, Math.max(0, u))));
      R(c, '#5d8296', x, yb - h, 1, h);
      R(c, '#7ba1ae', x, yb - h, 1, 1);
    }
    palm(c, x0 + 15, yb - 5);
    palm(c, x0 + 44, yb - 4);
  }

  // Palmera de la isla.
  function palm(c, x, y) {
    R(c, '#6b5334', x, y - 6, 1, 6);
    R(c, '#3f7a5a', x - 3, y - 7, 3, 1);
    R(c, '#4e9168', x + 1, y - 7, 3, 1);
    P(c, '#2f6047', x - 4, y - 8);
    P(c, '#2f6047', x + 4, y - 8);
  }

  // Rocas que asoman del agua, con espuma en la base.
  function rocks(c) {
    var r = S('roca');
    // primera roca
    ellipse(c, r.x + 12, r.y + 10, 11, 8, '#7d7972');
    ellipse(c, r.x + 11, r.y + 9, 9, 6, '#9a958e');
    ellipse(c, r.x + 9, r.y + 7, 5, 3, '#b3aea6');
    // segunda roca, más pequeña
    ellipse(c, r.x + 30, r.y + 13, 8, 5, '#6f6b65');
    ellipse(c, r.x + 29, r.y + 12, 6, 4, '#8d8880');
    // espuma
    for (var x = r.x; x < r.x + r.w; x += 3) {
      P(c, '#e8f6fb', x + Math.floor(hash(x) * 2), r.y + r.h - 1);
    }
  }

  // Sardina: la silueta de un pez-plateado.
  function sardine(c, x, y) {
    R(c, FISH, x, y, 6, 2);
    R(c, FISH_D, x + 1, y + 2, 4, 1);
    R(c, FISH, x + 6, y - 1, 2, 4);
    P(c, INK, x, y);
  }

  // Caja de madera con sardinas pintadas en el costado.
  function crate(c, x, y, w, h, open) {
    R(c, INK, x, y, w, h);
    R(c, '#b3803f', x + 1, y + 1, w - 2, h - 2);
    R(c, '#c9975f', x + 1, y + 1, w - 2, 2);
    R(c, '#8a5f38', x + 1, y + h - 3, w - 2, 2);
    R(c, INK, x + 1, y + Math.floor(h / 2), w - 2, 1);
    if (open) {
      // caja abierta: se ven las sardinas dentro
      R(c, '#6e4726', x + 2, y + 2, w - 4, h - 4);
      sardine(c, x + 4, y + 4);
      sardine(c, x + 4, y + 7);
      sardine(c, x + 12, y + 5);
    } else {
      // sardina estampada en el costado
      R(c, FISH, x + 4, y + Math.floor(h / 2) - 3, 6, 2);
      R(c, FISH, x + 10, y + Math.floor(h / 2) - 4, 2, 4);
    }
  }

  // Balsa de troncos amarrada al muelle.
  function raft(c) {
    var r = S('balsa');
    for (var i = 0; i < 3; i++) {
      var y = r.y + 2 + i * 6;
      R(c, INK, r.x + 2, y, r.w - 4, 6);
      R(c, i % 2 ? '#9c6d40' : '#8a5f38', r.x + 3, y + 1, r.w - 6, 4);
      R(c, '#6e4726', r.x + 3, y + 4, r.w - 6, 1);
    }
    // amarres de cuerda
    for (var k = r.x + 8; k < r.x + r.w - 6; k += 14) {
      R(c, '#c9b089', k, r.y + 1, 2, r.h - 3);
    }
    // reflejo en el agua
    for (var j = 0; j < 5; j++) {
      R(c, '#8fd3ef', r.x + 6 + j * 11, r.y + r.h, 7, 1);
    }
  }

  // Cajas de sardinas apiladas en la balsa.
  function crates(c) {
    var k = S('cajas');
    crate(c, k.x + 2, k.y + 12, 26, 20, false);   // caja grande
    crate(c, k.x + 30, k.y + 20, 18, 12, false);  // caja pequeña
    crate(c, k.x + 6, k.y, 24, 12, true);         // caja abierta
  }

  // Barca amarrada: casco, cabina, mástil y tela.
  function boat(c) {
    var b = S('barca');
    var x0 = b.x, x1 = b.x + b.w;
    // casco: filas que se estrechan hacia los extremos
    var rows = [
      { y: 94, i: 12, col: null },
      { y: 96, i: 8, col: '#a85340' },
      { y: 99, i: 5, col: '#f0e0cc' },
      { y: 102, i: 4, col: '#a85340' },
      { y: 105, i: 3, col: '#a85340' },
      { y: 108, i: 2, col: '#7b4034' },
      { y: 111, i: 3, col: '#5e3a2c' },
      { y: 114, i: 7, col: '#5e3a2c' },
      { y: 116, i: 12, col: null }
    ];
    for (var i = 0; i < rows.length; i++) {
      var rr = rows[i];
      R(c, INK, x0 + rr.i, rr.y, x1 - x0 - rr.i * 2, 1);
      if (rr.col) R(c, rr.col, x0 + rr.i + 1, rr.y, x1 - x0 - rr.i * 2 - 2, 1);
    }
    // borde de la cubierta
    R(c, '#f0e0cc', x0 + 13, 93, x1 - x0 - 26, 1);
    // cabina
    R(c, INK, x0 + 22, 78, 28, 16);
    R(c, '#efe2c8', x0 + 23, 79, 26, 14);
    R(c, '#d6c8ad', x0 + 23, 90, 26, 3);
    R(c, '#5fb9e6', x0 + 26, 82, 8, 6);
    R(c, '#5fb9e6', x0 + 38, 82, 8, 6);
    R(c, '#bfe4ff', x0 + 26, 82, 8, 2);
    R(c, '#bfe4ff', x0 + 38, 82, 8, 2);
    // mástil, botavara y vela aferrada
    R(c, '#6e4726', x0 + 56, 56, 2, 38);
    R(c, '#8a5f38', x0 + 48, 66, 18, 2);
    R(c, '#f3e3cf', x0 + 49, 68, 15, 4);
    R(c, '#d8c7ae', x0 + 49, 71, 15, 1);
    // reflejo de la barca en el agua
    for (var j = 0; j < 4; j++) {
      R(c, '#8fd3ef', x0 + 8 + j * 22, 118, 12, 1);
    }
  }

  // Pila de madera con su cabo enrollado.
  function pile(c, id) {
    var p = S(id);
    R(c, INK, p.x, p.y, p.w, p.h);
    R(c, WOOD_D, p.x + 1, p.y + 1, p.w - 2, p.h - 1);
    R(c, WOOD, p.x + 2, p.y + 1, 2, p.h - 1);
    R(c, '#5c3a20', p.x + p.w - 3, p.y + 1, 2, p.h - 1);
    R(c, WOOD_L, p.x + 1, p.y, p.w - 2, 1);
    R(c, '#c9b089', p.x + 1, p.y + 4, p.w - 2, 1);
    R(c, '#c9b089', p.x + 1, p.y + 6, p.w - 2, 1);
  }

  // Cuerda entre dos puntos: se descuelga (hacia abajo o hacia un lado).
  function rope(c, x0, y0, x1, y1, sag, side) {
    for (var i = 0; i <= 40; i++) {
      var u = i / 40;
      var s = Math.round(Math.sin(Math.PI * u) * sag);
      var x = Math.round(x0 + (x1 - x0) * u + (side ? s : 0));
      var y = Math.round(y0 + (y1 - y0) * u + (side ? 0 : s));
      P(c, '#c9b089', x, y);
    }
  }

  // Gaviota quieta sobre una pila.
  function perchedGull(c, x, baseY) {
    R(c, INK, x - 4, baseY - 6, 9, 6);
    R(c, '#f4f6f8', x - 3, baseY - 5, 7, 4);
    R(c, '#d7dde4', x - 3, baseY - 2, 7, 1);
    R(c, '#f4f6f8', x - 6, baseY - 4, 3, 2);
    R(c, '#f4f6f8', x + 2, baseY - 10, 5, 5);
    R(c, '#f4f6f8', x + 4, baseY - 12, 3, 3);
    R(c, '#f4f6f8', x + 6, baseY - 9, 3, 2);
    P(c, '#ffd166', x + 8, baseY - 8);
    P(c, INK, x + 5, baseY - 8);
  }

  /* ------------------------------------------------------------------ */
  /* el camino y el muelle                                                */
  /* ------------------------------------------------------------------ */

  /* El camino que baja de la plaza (x 150..170) es una pasarela de madera que
   * entra en el muelle por arriba. Su extremo lejano se pierde en la bruma del
   * horizonte, así que el camino "sube" hacia el pueblo y se sale del cuadro.
   */
  function walkway(c) {
    var w = PATH_X1 - PATH_X0;
    R(c, WOOD_DD, PATH_X0, 0, w, DOCK_Y);
    for (var bx = PATH_X0; bx < PATH_X1; bx += 5) {
      R(c, (bx - PATH_X0) % 10 === 0 ? WOOD : WOOD_L, bx, 0, 4, DOCK_Y);
      R(c, '#5c3a20', bx + 4, 0, 1, DOCK_Y);
    }
    // cantos laterales
    R(c, '#d9ab73', PATH_X0, 0, 1, DOCK_Y);
    R(c, '#5c3a20', PATH_X1 - 1, 0, 1, DOCK_Y);
    // el agua bajo el camino se ve más oscura
    R(c, 'rgba(23,58,80,0.45)', PATH_X0 - 2, 0, 2, DOCK_Y);
    R(c, 'rgba(23,58,80,0.45)', PATH_X1, 0, 2, DOCK_Y);
    // la bruma: el extremo del camino se pierde en la distancia
    for (var y = 0; y < 26; y++) {
      c.fillStyle = 'rgba(143,211,239,' + (0.74 - y * 0.028).toFixed(3) + ')';
      c.fillRect(PATH_X0, y, w, 1);
    }
  }

  // Las tablas del muelle: el suelo caminable de la sala.
  function dock(c) {
    R(c, WOOD, 0, DOCK_Y, DW, DH - DOCK_Y);
    for (var x = 0; x < DW; x += 13) {
      var w = Math.min(12, DW - x);
      R(c, (x / 13) % 2 ? '#bb854f' : '#c9975f', x, DOCK_Y, w, DH - DOCK_Y);
      R(c, '#d9ab73', x, DOCK_Y, 1, DH - DOCK_Y);
      R(c, '#8a5f38', x + w, DOCK_Y, 1, DH - DOCK_Y);
      P(c, '#6e4726', x + 5, DOCK_Y + 14);
      P(c, '#6e4726', x + 5, DH - 16);
    }
    // vigas del muelle
    R(c, '#8a5f38', 0, DOCK_Y + 8, DW, 4);
    R(c, '#a9714a', 0, DOCK_Y + 8, DW, 1);
    R(c, '#8a5f38', 0, DH - 9, DW, 5);
    R(c, '#a9714a', 0, DH - 9, DW, 1);
    // el canto del muelle contra el agua
    R(c, '#6e4726', 0, DOCK_Y, DW, 2);
    R(c, '#c9975f', 0, DOCK_Y + 2, DW, 1);
    // el borde está mojado
    for (var k = 0; k < 8; k++) {
      c.fillStyle = 'rgba(60,110,140,' + (0.22 - k * 0.025).toFixed(3) + ')';
      c.fillRect(0, DOCK_Y + 3 + k, DW, 1);
    }
  }

  // El camino de piedra que sigue hacia el mercado, a la derecha.
  function marketPath(c) {
    var x0 = 296, y0 = 128, y1 = 172;
    R(c, '#a49d95', x0, y0, DW - x0, y1 - y0);
    for (var y = y0; y < y1; y += 11) {
      R(c, '#c4bdb4', x0 + 1, y + 1, DW - x0 - 1, 9);
      R(c, '#8f8880', x0, y, DW - x0, 1);
    }
    R(c, '#6e4726', x0 - 1, y0, 1, y1 - y0);
  }

  /* ------------------------------------------------------------------ */
  /* escena completa                                                      */
  /* ------------------------------------------------------------------ */

  function muelleBack(c) {
    sky(c);
    sea(c);
    island(c);
    // sombra del muelle en el agua
    for (var k = 0; k < 8; k++) {
      c.fillStyle = 'rgba(23,58,80,' + (0.30 - k * 0.035).toFixed(3) + ')';
      c.fillRect(0, DOCK_Y - 8 + k, DW, 1);
    }
    rocks(c);
    raft(c);
    crates(c);
    boat(c);
    walkway(c);
    pile(c, 'pila-izq');
    pile(c, 'pila-der');
    // las cuerdas que sujetan las tablas y la barca
    rope(c, 145, 92, 145, 30, 4, true);
    rope(c, 175, 92, 175, 30, -4, true);
    rope(c, 178, 102, 195, 102, 3, false);
    perchedGull(c, 146, 92);
    dock(c);
    marketPath(c);
  }

  /* ------------------------------------------------------------------ */
  /* escena animada                                                       */
  /* ------------------------------------------------------------------ */

  function drawMuelle(c, W, H, t) {
    var sx = W / DW, sy = H / DH, i;
    c.save();
    // todo el arte se diseña en 320x200 y se escala sin suavizado al lienzo que pida el canvas
    c.setTransform(sx, 0, 0, sy, 0, 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(layer('muelle', DW, DH, muelleBack), 0, 0);

    // la bandera de la barca ondea
    var b = S('barca');
    for (i = 0; i < 5; i++) {
      var fw = 9 - i;
      var off = Math.round(Math.sin(t * 4 - i * 0.7) * 1.5);
      R(c, i % 2 ? '#ffd166' : '#e76f51', b.x + 58 + i, 56 + i, fw, 1);
      if (i > 1) P(c, '#b8503a', b.x + 58 + i + fw - 1 + off, 56 + i);
    }

    // gaviotas volando por el cielo
    for (i = 0; i < 3; i++) {
      var gx = ((i * 78 + t * (7 + i * 3)) % (DW + 16)) - 8;
      var gy = 6 + i * 4 + Math.round(Math.sin(t * 2 + i) * 1);
      var up = (Math.floor(t * 5) + i) % 4 < 2;
      P(c, '#5d5a74', gx, gy + 1);
      P(c, '#ffffff', gx - 1, gy + (up ? -1 : 0));
      P(c, '#ffffff', gx, gy);
      P(c, '#ffffff', gx + 1, gy + (up ? -1 : 0));
    }

    // destellos en el agua
    for (i = 0; i < 6; i++) {
      var wx = (i * 61 + Math.floor(t * 9)) % DW;
      var wy = HORIZON_Y + 8 + ((i * 17 + Math.floor(t * 5)) % (DOCK_Y - HORIZON_Y - 12));
      P(c, '#dff3fb', wx, wy);
    }

    // una sardina salta del agua
    var p = (t % 6) / 1.4;
    if (p < 1) {
      var fx = 58 + Math.round(p * 18);
      var fy = 104 - Math.round(22 * Math.sin(Math.PI * p));
      sardine(c, fx, fy);
      P(c, '#ffffff', fx - 2, fy + 4);
      P(c, '#ffffff', fx + 7, fy + 4);
    }

    c.restore();
  }

  window.CatBG.register({
    id: 'muelle', label: 'Muelle de las Sardinas', emoji: '🐟', animated: true,
    // los rectángulos de los objetos sólidos: se comprueban contra el suelo caminable
    solids: SOLIDS,
    draw: PX.scaled({ nativeW: NATIVE_W, draw: drawMuelle })
  });
})();
