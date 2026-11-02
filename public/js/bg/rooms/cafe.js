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

  var NATIVE_W = 320;   // el café se dibuja a 320x200 lógicos (docs/mundo.md, §1)

  // Lienzo de diseño: 320x200, la misma resolución lógica que usa el servidor.
  var DW = 320, DH = 200;

  // Geometría de la sala. Coincide con la del servidor (server/world.js, sala "cafe"):
  // la pared baja hasta y=110 y el suelo caminable empieza ahí.
  var FLOOR_Y = 110;      // debajo de esta línea está el piso caminable
  var SKIRT_Y = 99;       // el zócalo de madera ocupa los últimos píxeles de la pared
  var COUNTER_X0 = 60, COUNTER_X1 = 180, COUNTER_Y1 = 150;   // el mostrador no se pisa
  var SMALL_CX = 56;      // mesa redonda pegada a la pared (al fondo: no pisa el suelo)

  var CAFE_BOOKS = ['#ff8fab', '#8ecae6', '#90be6d', '#f6bd60', '#cdb8de', '#f4a261', '#b8e0d2'];

  // Lámparas colgantes (x de cada una).
  var LAMPS = [56, 152, 226];
  // Tazas humeantes: x,y = esquina inferior izquierda de cada taza.
  var CUPS = [
    { x: 44, y: 94, col: '#ffc6d6', seed: 0 },
    { x: 62, y: 94, col: '#c9f0e1', seed: 1 },
    { x: 254, y: 158, col: '#ffffff', seed: 2 },
    { x: 286, y: 158, col: '#f7d9c4', seed: 3 }
  ];
  var YARN = { x: 100, y: 157 };

  /* ------------------------------------------------------------------ */
  /* piezas de la escena                                                  */
  /* ------------------------------------------------------------------ */

  // Pared: papel pintado con rayas muy suaves.
  function wallpaper(c) {
    R(c, '#f7e6d0', 0, 0, DW, SKIRT_Y);
    for (var x = 0; x < DW; x += 16) R(c, '#f2dcbf', x, 0, 4, SKIRT_Y);
    // hacia el zócalo la pared se ensucia un poco
    for (var y = SKIRT_Y - 12; y < SKIRT_Y; y++) {
      c.fillStyle = 'rgba(122,79,51,' + (0.035 * (SKIRT_Y - y)).toFixed(3) + ')';
      c.fillRect(0, y, DW, 1);
    }
  }

  // Zócalo de madera al pie de la pared.
  function skirting(c) {
    R(c, '#6b4630', 0, SKIRT_Y, DW, 1);
    R(c, '#dfac7e', 0, SKIRT_Y + 1, DW, 1);
    R(c, '#c08657', 0, SKIRT_Y + 2, DW, FLOOR_Y - SKIRT_Y - 2);
    for (var x = 4; x < DW; x += 16) R(c, '#a06f47', x, SKIRT_Y + 3, 1, FLOOR_Y - SKIRT_Y - 4);
    R(c, '#8a5a3b', 0, FLOOR_Y - 2, DW, 2);
  }

  // Suelo de tablas de madera: cada fila es una fila de tablas y crece un poco (perspectiva).
  function floorWood(c) {
    R(c, '#d9a77b', 0, FLOOR_Y, DW, DH - FLOOR_Y);
    var y = FLOOR_Y, row = 0;
    while (y < DH) {
      var nh = Math.min(16, 5 + Math.floor(row * 1.15));
      if (y + nh > DH) nh = DH - y;
      R(c, '#e7bb92', 0, y, DW, 1);
      var len = 24 + row * 7, off = Math.floor(hash(row * 17 + 3) * len);
      for (var x = -off; x < DW; x += len) R(c, '#c08d63', x, y + 1, 1, nh - 1);
      R(c, '#b98257', 0, y + nh - 1, DW, 1);
      y += nh; row++;
    }
    // la pared proyecta una sombra sobre las primeras tablas
    for (var k = 0; k < 12; k++) {
      c.fillStyle = 'rgba(107,70,48,' + (0.30 - k * 0.025).toFixed(3) + ')';
      c.fillRect(0, FLOOR_Y + k, DW, 1);
    }
    R(c, '#6b4630', 0, FLOOR_Y, DW, 1);
  }

  // Ventana con cielo, sol y nubes.
  function windowSky(c) {
    var x0 = 88, y0 = 22, w = 56, h = 50;
    R(c, INK, x0 - 3, y0 - 3, w + 6, h + 6);
    R(c, '#fffaf5', x0 - 1, y0 - 1, w + 2, h + 2);
    R(c, '#bfe4ff', x0, y0, w, h);
    R(c, '#d3edff', x0, y0 + 28, w, h - 28);
    R(c, '#ffe9b8', x0 + w - 14, y0 + 7, 6, 6);
    R(c, '#ffd98a', x0 + w - 13, y0 + 8, 4, 4);
    PX.cloud(c, x0 + 4, y0 + 10, 3, '#ffffff', '#d3edff', '#bfe4ff');
    PX.cloud(c, x0 + 26, y0 + 24, 2, '#ffffff', '#d3edff', null);
    R(c, '#fffaf5', x0 + Math.floor(w / 2) - 1, y0, 2, h);
    R(c, '#fffaf5', x0, y0 + Math.floor(h / 2), w, 1);
    // alféizar
    R(c, INK, x0 - 6, y0 + h + 2, w + 12, 3);
    R(c, '#fffaf5', x0 - 5, y0 + h + 2, w + 10, 1);
    R(c, '#f1dfe4', x0 - 5, y0 + h + 3, w + 10, 2);
    // plantita en el alféizar
    var px = x0 + w - 10, py = y0 + h + 2;
    R(c, INK, px, py - 5, 6, 5);
    R(c, '#ef9a76', px + 1, py - 4, 4, 3);
    R(c, INK, px + 1, py - 10, 4, 6);
    R(c, '#9fd8a8', px + 2, py - 9, 2, 5);
    P(c, '#ff8fab', px + 3, py - 10);
  }

  // Cuadro con un ovillo de lana.
  function picture(c) {
    var x0 = 8, y0 = 30, w = 32, h = 30;
    R(c, '#7a4f33', x0, y0, w, h);
    R(c, INK, x0 + 1, y0 + 1, w - 2, h - 2);
    R(c, '#fffaf5', x0 + 3, y0 + 3, w - 6, h - 6);
    ellipse(c, x0 + 16, y0 + 16, 8, 7, '#c9b6ec');
    ellipse(c, x0 + 16, y0 + 16, 6, 5, '#e0d0f6');
    R(c, '#a893cf', x0 + 10, y0 + 11, 12, 1);
  }

  // Pastel: tarta con icing y cereja, apoyada en y (la base).
  function cake(c, x, y, w, h, icing, cherry) {
    R(c, INK, x, y - h, w, h);
    R(c, '#ffe0b8', x + 1, y - h + 1, w - 2, h - 1);
    R(c, icing, x + 1, y - h + 1, w - 2, 3);
    R(c, '#f2b8a0', x + 1, y - 2, w - 2, 1);
    P(c, cherry, x + Math.floor(w / 2), y - h - 1);
  }

  // Vitrina de pasteles colgada de la pared.
  function pastryCase(c) {
    var x0 = 162, y0 = 24, w = 50, h = 46;
    R(c, INK, x0, y0, w, h);
    R(c, '#8a5a3b', x0 + 1, y0 + 1, w - 2, h - 2);
    R(c, '#cfe6f2', x0 + 3, y0 + 3, w - 6, h - 6);
    R(c, '#8a5a3b', x0 + 3, y0 + 23, w - 6, 2);
    cake(c, x0 + 8, y0 + 22, 16, 12, '#ffc6d6', '#e63946');
    cake(c, x0 + 29, y0 + 22, 14, 10, '#ffe0b8', '#f6bd60');
    cake(c, x0 + 14, y0 + 43, 18, 12, '#cdb8de', '#e63946');
    // reflejo del cristal
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(x0 + 5, y0 + 5, 6, h - 12);
    c.fillRect(x0 + 5, y0 + 5, w - 10, 3);
  }

  // Estantería con libros.
  function bookshelf(c) {
    var x0 = 236, y0 = 16, w = 64, h = 84;
    R(c, INK, x0, y0, w, h);
    R(c, '#9b6a45', x0 + 1, y0 + 1, w - 2, h - 2);
    R(c, '#7a4f33', x0 + 4, y0 + 4, w - 8, h - 8);
    for (var i = 0; i < 3; i++) {
      var board = y0 + 18 + i * 26;
      var bx = x0 + 6, n = 0;
      while (bx < x0 + w - 8) {
        var bw = 3 + Math.floor(hash(i * 13 + n * 7) * 3);
        if (bx + bw > x0 + w - 8) bw = x0 + w - 8 - bx;
        if (bw < 1) break;
        var bh = 10 + Math.floor(hash(i * 5 + n * 3) * 4);
        var col = CAFE_BOOKS[Math.floor(hash(i * 7 + n * 11) * CAFE_BOOKS.length)];
        R(c, col, bx, board - bh, bw, bh);
        R(c, '#ffffff', bx, board - bh, bw, 1);
        R(c, INK, bx, board - bh, 1, bh);
        bx += bw + 1; n++;
      }
      R(c, '#b98257', x0 + 4, board, w - 8, 2);
      R(c, '#d29a6b', x0 + 4, board, w - 8, 1);
    }
    // un par de libros tumbados en el hueco de abajo
    R(c, '#b8e0d2', x0 + 8, y0 + h - 12, 16, 3);
    R(c, '#f4a261', x0 + 11, y0 + h - 9, 13, 3);
  }

  // Lámpara colgante: cable y pantalla.
  function lamp(c, x, topY) {
    R(c, '#6b5470', x, 0, 1, topY);
    R(c, INK, x - 5, topY, 11, 2);
    R(c, INK, x - 6, topY + 2, 13, 2);
    R(c, INK, x - 7, topY + 4, 15, 2);
    R(c, '#ffd27a', x - 4, topY, 9, 1);
    R(c, '#ffd27a', x - 5, topY + 2, 11, 1);
    R(c, '#ffc15a', x - 6, topY + 4, 13, 1);
    R(c, '#ffe7a8', x - 2, topY + 1, 5, 3);
  }

  // Mostrador: encimera de mármol y frente de madera. Ocupa justo la zona que no se pisa.
  function counter(c) {
    var w = COUNTER_X1 - COUNTER_X0;
    R(c, '#e8d6c0', COUNTER_X0, FLOOR_Y, w, 8);
    R(c, '#fff8ee', COUNTER_X0, FLOOR_Y, w, 2);
    R(c, '#b98257', COUNTER_X0, FLOOR_Y + 7, w, 1);
    R(c, '#a9744c', COUNTER_X0, FLOOR_Y + 8, w, COUNTER_Y1 - FLOOR_Y - 8);
    for (var x = COUNTER_X0 + 20; x < COUNTER_X1; x += 20) {
      R(c, '#8a5a3b', x, FLOOR_Y + 8, 1, COUNTER_Y1 - FLOOR_Y - 8);
    }
    R(c, '#6b4630', COUNTER_X0, COUNTER_Y1 - 3, w, 3);
    R(c, INK, COUNTER_X0, FLOOR_Y, 1, COUNTER_Y1 - FLOOR_Y);
    R(c, INK, COUNTER_X1 - 1, FLOOR_Y, 1, COUNTER_Y1 - FLOOR_Y);
    // la sombra que el mostrador echa sobre el suelo de delante
    for (var k = 0; k < 6; k++) {
      c.fillStyle = 'rgba(107,70,48,' + (0.22 - k * 0.035).toFixed(3) + ')';
      c.fillRect(COUNTER_X0, COUNTER_Y1 + k, w, 1);
    }
  }

  // Mesa redonda: el pie se apoya en baseY y el tablero queda a `height` de altura.
  function roundTable(c, cx, baseY, rx, height) {
    var topY = baseY - height;
    ellipse(c, cx, baseY + 1, rx * 0.6, 4, '#b98257');
    R(c, '#9b6a45', cx - 3, topY + 4, 7, baseY - topY - 4);
    R(c, '#7a4f33', cx - 2, topY + 4, 2, baseY - topY - 4);
    ellipse(c, cx, baseY - 1, 11, 4, '#7a4f33');
    ellipse(c, cx, topY + 2, rx, 6, INK);
    ellipse(c, cx, topY + 1, rx - 1, 5, '#e8d6c0');
    ellipse(c, cx, topY, rx - 4, 3, '#fff8ee');
    return topY;
  }

  // Taza humeante. x,y = esquina inferior izquierda de la taza.
  function cafeCup(c, x, y, col, t, seed, steamOn) {
    var O = '#3b2a40';
    R(c, O, x, y - 7, 10, 8);
    R(c, col, x + 1, y - 6, 8, 5);
    R(c, '#ffffff', x + 2, y - 6, 1, 3);
    R(c, '#8a5a3b', x + 2, y - 6, 6, 1);
    R(c, O, x + 9, y - 6, 2, 2);
    R(c, O, x + 10, y - 5, 1, 3);
    R(c, O, x + 9, y - 3, 2, 1);
    R(c, O, x, y - 1, 10, 1);
    ellipse(c, x + 5, y, 7, 2, '#fff8ee');
    if (steamOn) steam(c, x + 5, y - 6, t, seed);
  }

  // Vapor que sube de una taza.
  function steam(c, x, y, t, seed) {
    for (var k = 0; k < 3; k++) {
      var sp = 4 + k * 0.6;
      for (var n = 0; n < 4; n++) {
        var d = ((t * sp + n * 3.2 + k * 2.7 + (seed || 0)) % 12);
        var py = y - d;
        var px = x + k * 1.6 - 1.5 + Math.round(Math.sin(d / 2.2 + k) * 1.3);
        c.fillStyle = 'rgba(255,255,255,' + (0.75 - d * 0.045).toFixed(3) + ')';
        c.fillRect(Math.round(px), Math.round(py), 1, 2);
      }
    }
  }

  // Alfombra redonda del centro del café.
  function rug(c) {
    var cx = 165, cy = 186, rx = 34, ry = 11;
    ellipse(c, cx, cy, rx, ry, '#8a4f5f');
    ellipse(c, cx, cy - 1, rx - 2, ry - 1, '#d77a8f');
    ellipse(c, cx, cy - 1, rx - 6, ry - 3, '#f2b8a0');
    ellipse(c, cx, cy - 1, rx - 10, ry - 5, '#d77a8f');
    for (var x = cx - rx + 3; x < cx + rx - 3; x += 6) {
      R(c, '#8a4f5f', x, cy + ry - 1, 2, 2);
      R(c, '#8a4f5f', x, cy - ry - 1, 2, 2);
    }
  }

  // Ovillo de lana en el suelo.
  function yarnBall(c, x, y) {
    ellipse(c, x, y, 5, 4, INK);
    ellipse(c, x, y, 4, 3, '#c9b6ec');
    R(c, '#e0d0f6', x - 2, y - 2, 3, 1);
    P(c, '#a893cf', x - 3, y);
  }

  /* ------------------------------------------------------------------ */
  /* escena completa                                                      */
  /* ------------------------------------------------------------------ */

  function cafeBack(c) {
    var i;
    wallpaper(c);
    picture(c);
    windowSky(c);
    pastryCase(c);
    bookshelf(c);
    for (i = 0; i < LAMPS.length; i++) lamp(c, LAMPS[i], 26);
    skirting(c);
    floorWood(c);
    // el mostrador con lo que hay encima
    counter(c);
    cake(c, 132, 112, 16, 13, '#ffc6d6', '#e63946');
    R(c, '#fff8ee', 68, 108, 14, 2);
    R(c, '#f1dfe4', 70, 106, 10, 2);
    R(c, '#fff8ee', 69, 104, 12, 2);
    R(c, '#7a4f33', 98, 99, 16, 13);
    R(c, '#fffaf5', 100, 101, 12, 9);
    R(c, '#8a5a3b', 103, 104, 6, 5);
    R(c, '#8a5a3b', 108, 105, 2, 3);
    // la mesa pequeña del fondo y sus tazas
    roundTable(c, SMALL_CX, 108, 20, 13);
    // la mesa grande de la derecha
    roundTable(c, 280, 194, 40, 36);
    cake(c, 262, 162, 14, 14, '#ffc6d6', '#e63946');
    for (i = 0; i < CUPS.length; i++) cafeCup(c, CUPS[i].x, CUPS[i].y, CUPS[i].col, 0, CUPS[i].seed, false);
    rug(c);
    yarnBall(c, YARN.x, YARN.y);
  }

  function drawCafe(c, W, H, t) {
    var sx = W / DW, sy = H / DH, i;
    c.save();
    // todo el arte se diseña en 320x200 y se escala sin suavizado al lienzo que pida el canvas
    c.setTransform(sx, 0, 0, sy, 0, 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(layer('cafe', DW, DH, cafeBack), 0, 0);
    // vapor de las tazas
    for (i = 0; i < CUPS.length; i++) steam(c, CUPS[i].x + 5, CUPS[i].y - 6, t, CUPS[i].seed);
    // destello de las lámparas
    for (i = 0; i < LAMPS.length; i++) {
      var lx = LAMPS[i], ly = 26;
      var fl = 0.14 + 0.03 * Math.sin(t * 3 + i * 2);
      c.fillStyle = 'rgba(255,214,140,' + fl.toFixed(3) + ')';
      c.fillRect(lx - 9, ly + 6, 19, 3);
      c.fillStyle = 'rgba(255,214,140,' + (fl * 0.5).toFixed(3) + ')';
      c.fillRect(lx - 13, ly + 9, 27, 4);
    }
    // el ovillo de lana rueda un poquito y su hilo se estira
    var roll = Math.round(Math.sin(t * 0.7) * 3);
    var ox = YARN.x + roll;
    R(c, '#a893cf', ox - 7, YARN.y, 5, 1);
    R(c, '#c9b6ec', ox - 3, YARN.y + 1, 4, 1);
    P(c, '#a893cf', ox - 6, YARN.y - 1);
    // motas de polvo en el haz de luz de la ventana
    for (i = 0; i < 8; i++) {
      var dx = 96 + Math.round(hash(i * 3.3) * 44);
      var dy = (hash(i * 5.7) * 60 + t * 2) % 60;
      P(c, '#fff3d0', dx, 40 + Math.round(dy));
    }
    c.restore();
  }

  window.CatBG.register({
    id: 'cafe', label: 'Café del Ovillo', emoji: '☕', animated: true,
    draw: PX.scaled({ nativeW: NATIVE_W, draw: drawCafe })
  });
})();
