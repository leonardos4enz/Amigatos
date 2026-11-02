'use strict';
// El fondo del Café del Ovillo, redibujado a la resolución nueva del mundo (320x200 lógicos).
// Los agentes no ven imágenes: se comprueban los píxeles del canvas y la geometría que el
// servidor declara para el café (server/world.js). El suelo dibujado tiene que coincidir con
// los polígonos caminables de la sala: el piso de madera empieza en y=110, el mostrador
// (x 60..180, y 110..150) y las mesas redondas no se pueden pisar.
const { test, expect } = require('@playwright/test');
const { ROOMS } = require('../server/world.js');

const W = 320;
const H = 200;

// Tinta de los contornos (INK de window.CatBGPixels): '#2b1a33'.
const INK = '43,26,51';
// Tablero de las mesas (el mismo mármol que la encimera del mostrador): '#e8d6c0'.
const TABLE_TOP = '232,214,192';
// Línea de madera oscura con la que el suelo dibuja su borde de pared (y=110).
const FLOOR_EDGE = '107,70,48';

// Centro de un polígono en coordenadas lógicas.
function center(poly) {
  let sx = 0;
  let sy = 0;
  for (const p of poly) { sx += p.x; sy += p.y; }
  return { x: Math.round(sx / poly.length), y: Math.round(sy / poly.length) };
}

// Caja de un polígono rectangular (x0, y0, x1, y1) en coordenadas lógicas.
function bbox(poly) {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

// ¿El píxel es de suelo? El suelo del café es madera cálida (rojo > azul, azul bajo) y el papel
// pintado de la pared es crema claro (azul alto). La diferencia se nota a simple vista.
const floorish = (px) => px[0] > px[2] && px[2] < 150;

// Pinta la escena del café y devuelve datos comprobables sobre los píxeles.
async function paintCafe(page, opts) {
  return page.evaluate((o) => {
    const { w, h, pts, boxes, cols, inkCol, tableCol } = o;
    function paint(cw, ch) {
      const cv = globalThis.document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      globalThis.window.CatBG.paint(cv, 'cafe', 0);
      return cv;
    }
    const big = paint(w, h);
    const bctx = big.getContext('2d');
    const data = bctx.getImageData(0, 0, w, h).data;
    function at(src, sw, x, y) {
      const i = (y * sw + x) * 4;
      return [src[i], src[i + 1], src[i + 2]];
    }
    const key = (px) => px.join(',');
    // El color de la pared: el más frecuente de las tres primeras filas (el papel pintado).
    const counts = new Map();
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < w; x++) {
        const k = key(at(data, w, x, y));
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
    let wall = null;
    let best = 0;
    for (const [k, n] of counts) if (n > best) { best = n; wall = k; }
    // Píxeles de tinta dentro de cada caja: un mueble con contorno oscuro no puede invadir
    // un polígono caminable (ni la mesa grande ni la pequeña).
    const ink = boxes.map((b) => {
      let n = 0;
      for (let y = b[1]; y < b[3]; y++) {
        for (let x = b[0]; x < b[2]; x++) if (key(at(data, w, x, y)) === inkCol) n++;
      }
      return n;
    });
    // Primera fila con píxeles de mesa (contorno o tablero) de cada columna: dice por dónde
    // arranca el mueble de delante.
    const firstTable = cols.map((x) => {
      for (let y = 110; y < h; y++) {
        const k = key(at(data, w, x, y));
        if (k === inkCol || k === tableCol) return y;
      }
      return -1;
    });
    // "Sin escalado": la pintura a la mitad tiene que ser la de 320x200 reducida en bloques
    // de 2x2. Si la escena no fuera nativa a 320, sus píxeles no encajarían en esos bloques.
    const small = paint(w / 2, h / 2);
    const sdata = small.getContext('2d').getImageData(0, 0, w / 2, h / 2).data;
    let ok = 0;
    let bad = 0;
    for (let y = 0; y < h / 2; y++) {
      for (let x = 0; x < w / 2; x++) {
        const s = key(at(sdata, w / 2, x, y));
        const block = [
          key(at(data, w, 2 * x, 2 * y)),
          key(at(data, w, 2 * x + 1, 2 * y)),
          key(at(data, w, 2 * x, 2 * y + 1)),
          key(at(data, w, 2 * x + 1, 2 * y + 1)),
        ];
        if (block.includes(s)) ok++; else bad++;
      }
    }
    return {
      urlLen: big.toDataURL().length,
      wall: wall.split(',').map(Number),
      points: pts.map((p) => at(data, w, p[0], p[1])),
      ink,
      firstTable,
      // Fila y=110: el borde de madera entre la pared y el suelo.
      row110: Array.from({ length: w }, (_, x) => at(data, w, x, 110)),
      blockOk: ok,
      blockBad: bad,
    };
  }, {
    w: W,
    h: H,
    pts: opts.points.map((p) => [p.x, p.y]),
    boxes: opts.boxes,
    cols: opts.cols,
    inkCol: INK,
    tableCol: TABLE_TOP,
  });
}

// Falla el test si la página tira errores de JavaScript.
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  return errors;
}

test('el café se pinta a 320x200 y su suelo se distingue de la pared', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');

  const cafe = ROOMS.cafe;
  const centers = cafe.walkable.map(center);
  const boxes = cafe.walkable.map(bbox);
  const res = await paintCafe(page, {
    points: centers,
    boxes,
    cols: [240, 260, 280, 300, 319],
  });

  // 1. La escena produce contenido.
  expect(res.urlLen, 'el fondo del café no dibuja nada').toBeGreaterThan(500);

  // 2. La pared es el papel pintado de arriba (crema claro, azul alto): no es suelo.
  expect(res.wall[2], `la pared no es crema: ${res.wall.join(',')}`).toBeGreaterThanOrEqual(150);

  // 3. El centro de cada polígono caminable cae en suelo de madera, no en la pared.
  for (let i = 0; i < centers.length; i++) {
    const px = res.points[i];
    expect(px.join(','), `el centro del polígono ${i} no es suelo`).not.toBe(res.wall.join(','));
    expect(floorish(px), `el centro del polígono ${i} (${centers[i].x},${centers[i].y}) no es suelo: ${px.join(',')}`).toBe(true);
  }

  // 4. El suelo dibujado arranca en y=110, la línea que declara el servidor: en el tramo de
  //    la puerta (x 0..60) y en el central y el derecho (x 180..320) el borde de la pared es
  //    una línea limpia de madera, sin muebles encima.
  for (let x = 0; x < 60; x++) {
    expect(res.row110[x].join(','), `x=${x} de la fila y=110 no es el borde del suelo`).toBe(FLOOR_EDGE);
  }
  for (let x = 180; x < 320; x++) {
    expect(res.row110[x].join(','), `x=${x} de la fila y=110 no es el borde del suelo`).toBe(FLOOR_EDGE);
  }

  // 5. La mesa grande no pisa el suelo que hay detrás de ella (x 240..320, y 110..155):
  //    su tablero tiene que empezar en y=155, y ningún contorno oscuro entra en ese rectángulo.
  const cols = [240, 260, 280, 300, 319];
  for (let i = 0; i < cols.length; i++) {
    expect(res.firstTable[i], `en x=${cols[i]} la mesa empieza por encima de y=155`).toBeGreaterThanOrEqual(155);
  }
  expect(res.ink[3], 'la mesa grande invade el suelo caminable de detrás').toBe(0);

  // 6. La mesa pequeña del fondo tampoco pisa el suelo de la puerta (x 0..60, y 110..200).
  expect(res.ink[0], 'la mesa pequeña invade el suelo caminable de la puerta').toBe(0);

  // 7. La escena es nativa a 320: pintada a la mitad sale en bloques de 2x2.
  expect(res.blockBad, 'la escena no se pinta a 320x200 sin escalado').toBe(0);

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});

test('la escena del café declara su ancho nativo de 320', async ({ page }) => {
  await page.goto('/');
  const res = await page.request.get('/js/bg/rooms/cafe.js');
  expect(res.status()).toBe(200);
  const src = await res.text();
  expect(src, 'el café no declara NATIVE_W = 320').toMatch(/NATIVE_W\s*=\s*320/);
  expect(src, 'el café no usa las utilidades compartidas').toContain('window.CatBGPixels');
});
