'use strict';
// El fondo de la Plaza Bigotes, redibujado a la resolución nueva del mundo (320x200 lógicos).
// Los agentes no ven imágenes: se comprueban los píxeles del canvas y la geometría que el
// servidor declara para la plaza (server/world.js). El suelo dibujado tiene que coincidir con
// los polígonos caminables de la sala: los adoquines empiezan en y=110 y la fuente ocupa
// el bloque x 140..180, y 145..200, que no se puede pisar.
const { test, expect } = require('@playwright/test');
const { ROOMS } = require('../server/world.js');

const W = 320;
const H = 200;

// Centro de un polígono en coordenadas lógicas.
function center(poly) {
  let sx = 0;
  let sy = 0;
  for (const p of poly) { sx += p.x; sy += p.y; }
  return { x: Math.round(sx / poly.length), y: Math.round(sy / poly.length) };
}

// Pinta la escena de la plaza y devuelve datos comprobables sobre los píxeles.
async function paintPlaza(page, points) {
  return page.evaluate((opts) => {
    const { w, h, pts } = opts;
    function paint(cw, ch) {
      const cv = globalThis.document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      globalThis.window.CatBG.paint(cv, 'plaza', 0);
      return cv;
    }
    const big = paint(w, h);
    const bctx = big.getContext('2d');
    const data = bctx.getImageData(0, 0, w, h).data;
    function at(src, sw, x, y) {
      const i = (y * sw + x) * 4;
      return [src[i], src[i + 1], src[i + 2]];
    }
    // El color del cielo: el más frecuente de las tres primeras filas.
    const counts = new Map();
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < w; x++) {
        const key = at(data, w, x, y).join(',');
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    let sky = null;
    let best = 0;
    for (const [key, n] of counts) if (n > best) { best = n; sky = key; }
    // "Sin escalado": la pintura a la mitad tiene que ser la de 320x200 reducida en bloques
    // de 2x2. Si la escena no fuera nativa a 320, sus píxeles no encajarían en esos bloques.
    const small = paint(w / 2, h / 2);
    const sdata = small.getContext('2d').getImageData(0, 0, w / 2, h / 2).data;
    let ok = 0;
    let bad = 0;
    for (let y = 0; y < h / 2; y++) {
      for (let x = 0; x < w / 2; x++) {
        const s = at(sdata, w / 2, x, y).join(',');
        const block = [
          at(data, w, 2 * x, 2 * y).join(','),
          at(data, w, 2 * x + 1, 2 * y).join(','),
          at(data, w, 2 * x, 2 * y + 1).join(','),
          at(data, w, 2 * x + 1, 2 * y + 1).join(','),
        ];
        if (block.includes(s)) ok++; else bad++;
      }
    }
    return {
      urlLen: big.toDataURL().length,
      sky: sky.split(',').map(Number),
      points: pts.map((p) => at(data, w, p[0], p[1])),
      row: Array.from({ length: w }, (_, x) => at(data, w, x, 110)),
      // columna x=156: pasa por la franja caminable que queda detrás de la fuente (y 110..144)
      // y por la fuente, que empieza en y=145.
      col: Array.from({ length: h }, (_, y) => at(data, w, 156, y)),
      blockOk: ok,
      blockBad: bad,
    };
  }, { w: W, h: H, pts: points.map((p) => [p.x, p.y]) });
}

// ¿El píxel es de suelo? El suelo de la plaza es cálido (rojo > azul) y el cielo es frío.
const warm = (px) => px[0] > px[2];

// Falla el test si la página tira errores de JavaScript.
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  return errors;
}

test('la plaza se pinta a 320x200 y su suelo se distingue del cielo', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');

  const plaza = ROOMS.plaza;
  const centers = plaza.walkable.map(center);
  const res = await paintPlaza(page, centers);

  // 1. La escena produce contenido.
  expect(res.urlLen, 'el fondo de la plaza no dibuja nada').toBeGreaterThan(500);

  // 2. El cielo es frío y el suelo es cálido: se distinguen a simple vista.
  expect(res.sky[2], `el cielo no es azul: ${res.sky.join(',')}`).toBeGreaterThan(res.sky[0]);

  // 3. El centro de cada polígono caminable cae en suelo, no en cielo.
  for (let i = 0; i < centers.length; i++) {
    const px = res.points[i];
    expect(px.join(','), `el centro del polígono ${i} no es suelo`).not.toBe(res.sky.join(','));
    expect(warm(px), `el centro del polígono ${i} (${centers[i].x},${centers[i].y}) no es suelo: ${px.join(',')}`).toBe(true);
  }

  // 4. El suelo dibujado empieza en y=110, la línea de suelo que declara el servidor:
  //    toda esa fila es suelo, y detrás de la fuente hay suelo hasta y=144.
  for (const px of res.row) expect(warm(px), 'la fila y=110 no es todo suelo').toBe(true);
  for (let y = 110; y <= 144; y++) expect(warm(res.col[y]), `y=${y} no es suelo`).toBe(true);
  expect(res.col[145].join(','), 'la fuente no empieza en y=145').not.toBe(res.col[144].join(','));

  // 5. La escena es nativa a 320: pintada a la mitad sale en bloques de 2x2.
  expect(res.blockBad, 'la escena no se pinta a 320x200 sin escalado').toBe(0);

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});

test('la escena de la plaza declara su ancho nativo de 320', async ({ page }) => {
  await page.goto('/');
  const res = await page.request.get('/js/bg/rooms/plaza.js');
  expect(res.status()).toBe(200);
  const src = await res.text();
  expect(src, 'la plaza no declara NATIVE_W = 320').toMatch(/NATIVE_W\s*=\s*320/);
  expect(src, 'la plaza no usa las utilidades compartidas').toContain('window.CatBGPixels');
});
