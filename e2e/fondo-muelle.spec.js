'use strict';
// Pruebas del fondo del Muelle de las Sardinas (pixel art procedural a 320x200).
// Los agentes NO ven imágenes: se comprueban los píxeles del canvas, la geometría que
// usa el servidor (server/world.js) y que ningún objeto sólido pisa el suelo caminable.
const { test, expect } = require('@playwright/test');
const { ROOMS } = require('../server/world');

const W = 320;
const H = 200;
// Franja de cielo (arriba del todo, a la derecha, sin sol ni nubes) y franja de suelo
// caminable (las tablas del muelle). El suelo tiene que verse distinto del cielo.
const SKY_STRIP = { x0: 285, x1: 318, y0: 2, y1: 14 };
const FLOOR_STRIP = { x0: 20, x1: 120, y0: 150, y1: 170 };

let counter = 0;
const uniqueName = () => `emue${Date.now().toString(36)}${counter++}`.slice(0, 20);

// Falla el test si la página tira errores de JavaScript.
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  return errors;
}

const visibleScreen = (page) => page.locator('.screen:not(.hidden)');

// Crea una cuenta desde la UI y guarda el gato por defecto. Termina en el lobby.
async function registerAndCreateCat(page) {
  await page.goto('/');
  await expect(visibleScreen(page)).toHaveAttribute('data-screen', 'auth');
  await page.locator('[data-tab="register"]').click();
  await page.locator('#auth-username').fill(uniqueName());
  await page.locator('#auth-password').fill('secreto123');
  await page.locator('#auth-submit').click();
  await expect(visibleScreen(page)).toHaveAttribute('data-screen', 'creator');
  await page.locator('#creator-save').click();
  await expect(visibleScreen(page)).toHaveAttribute('data-screen', 'lobby');
}

// Entra al mundo y espera a que el servidor mande la sala.
async function explore(page, room) {
  await expect(page.locator('#player-list .player').first()).toBeVisible();
  await page.locator('#btn-explorar').click();
  await expect(visibleScreen(page)).toHaveAttribute('data-screen', 'world');
  await expect.poll(() => page.evaluate(() => globalThis.window.__amigatos.room),
    { timeout: 15000 }).toBe(room);
}

// Rectángulo sólido como polígono (para compararlo con los polígonos caminables).
function rectPoly(r) {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

// Proyección de un polígono sobre un eje.
function project(poly, nx, ny) {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const d = p.x * nx + p.y * ny;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return { min, max };
}

// ¿Se solapan por dentro dos polígonos convexos? (eje separador: método SAT)
// Tocarse en un borde no es solaparse: un objeto puede apoyarse justo en el borde
// del suelo caminable sin invadirlo.
function overlaps(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      const nx = -(p2.y - p1.y);
      const ny = p2.x - p1.x;
      const ra = project(a, nx, ny);
      const rb = project(b, nx, ny);
      if (rb.max <= ra.min || ra.max <= rb.min) return false;
    }
  }
  return true;
}

test('el fondo del muelle se pinta a 320x200, con contenido y distinto del de por defecto', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');

  // 1. La escena declara su ancho nativo (320), usa las utilidades compartidas y se registra.
  const src = await (await page.request.get('/js/bg/rooms/muelle.js')).text();
  expect(src, 'la escena no declara su ancho nativo').toMatch(/NATIVE_W\s*=\s*320/);
  expect(src, 'la escena no usa las utilidades compartidas').toContain('window.CatBGPixels');
  expect(src, 'la escena no se registra').toContain('CatBG.register');
  expect(await page.evaluate(() => globalThis.window.CatBG.has('muelle'))).toBe(true);

  // 2. Pintada a 320x200 produce contenido y no es el fondo por defecto.
  const shot = await page.evaluate(({ w, h }) => {
    const cv = globalThis.document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    globalThis.window.CatBG.paint(cv, 'muelle', 0);
    const muelle = cv.toDataURL();
    const df = globalThis.document.createElement('canvas');
    df.width = w;
    df.height = h;
    globalThis.window.CatBG.paint(df, globalThis.window.CatBG.DEFAULT, 0);
    return { muelle, porDefecto: df.toDataURL() };
  }, { w: W, h: H });

  expect(shot.muelle.length, 'el fondo del muelle no dibuja nada').toBeGreaterThan(500);
  expect(shot.muelle, 'el fondo del muelle es el mismo que el fondo por defecto')
    .not.toBe(shot.porDefecto);

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});

test('el suelo caminable del muelle se distingue del cielo y ningún sólido lo pisa', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');

  // 1. El suelo caminable se ve distinto del cielo (el color medio de una franja).
  const pixeles = await page.evaluate(({ w, h, sky, floor }) => {
    const cv = globalThis.document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    globalThis.window.CatBG.paint(cv, 'muelle', 0);
    const ctx = cv.getContext('2d');
    const medio = (s) => {
      const d = ctx.getImageData(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0).data;
      let r = 0; let g = 0; let b = 0;
      const n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      return [r / n, g / n, b / n];
    };
    const at = (x, y) => {
      const d = ctx.getImageData(x, y, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    return {
      cielo: medio(sky),
      suelo: medio(floor),
      camino: at(160, 60),
      aguaIzq: at(140, 60),
      aguaDer: at(180, 60),
    };
  }, { w: W, h: H, sky: SKY_STRIP, floor: FLOOR_STRIP });

  // El cielo es azul y el suelo es madera: los dos colores medios tienen que separarse.
  expect(pixeles.cielo[2], 'la franja de arriba no es cielo').toBeGreaterThan(pixeles.cielo[0]);
  expect(pixeles.suelo[0], 'la franja del suelo no es madera').toBeGreaterThan(pixeles.suelo[2]);
  const distancia = Math.hypot(
    pixeles.cielo[0] - pixeles.suelo[0],
    pixeles.cielo[1] - pixeles.suelo[1],
    pixeles.cielo[2] - pixeles.suelo[2],
  );
  expect(distancia, 'el suelo caminable se ve igual que el cielo').toBeGreaterThan(30);

  // El camino que baja de la plaza está pintado como suelo, no como mar.
  expect(pixeles.camino[0], 'el camino de la plaza no se ve como madera').toBeGreaterThan(pixeles.camino[2]);
  expect(pixeles.aguaIzq[2], 'a la izquierda del camino no hay mar').toBeGreaterThan(pixeles.aguaIzq[0]);
  expect(pixeles.aguaDer[2], 'a la derecha del camino no hay mar').toBeGreaterThan(pixeles.aguaDer[0]);

  // 2. Los objetos sólidos de la escena están en una lista y no invaden el suelo caminable.
  const solids = await page.evaluate(() => {
    const escena = globalThis.window.CatBG.get('muelle');
    return escena && escena.solids ? escena.solids : null;
  });
  expect(solids, 'la escena del muelle no expone la lista de sólidos').not.toBeNull();
  expect(solids.length, 'la lista de sólidos del muelle está vacía').toBeGreaterThan(0);
  for (const s of solids) {
    expect(s.w, `el sólido ${s.id} no tiene tamaño`).toBeGreaterThan(0);
    expect(s.h, `el sólido ${s.id} no tiene tamaño`).toBeGreaterThan(0);
    const poly = rectPoly(s);
    for (const walk of ROOMS.muelle.walkable) {
      expect(overlaps(poly, walk),
        `el sólido "${s.id}" pisa el suelo caminable ${JSON.stringify(walk)}`).toBe(false);
    }
  }

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});

test('al entrar en el muelle se ve el fondo de la sala y sus dos salidas', async ({ page }) => {
  const errors = trackErrors(page);
  await registerAndCreateCat(page);

  // 1. Desde la plaza se baja por la puerta del muelle.
  await explore(page, 'plaza');
  const puerta = page.locator('[data-exit="muelle"]');
  await expect(puerta).toHaveCount(1);
  await puerta.click();
  await expect.poll(() => page.evaluate(() => globalThis.window.__amigatos.room),
    { timeout: 15000 }).toBe('muelle');
  await expect(page.locator('#world-room-name')).toHaveText('Muelle de las Sardinas');

  // 2. El fondo que hay montado es el de la sala, y no el fondo por defecto.
  const lienzos = await page.evaluate(({ w, h }) => {
    const cv = globalThis.document.querySelector('#world-stage canvas.catbg-canvas');
    const df = globalThis.document.createElement('canvas');
    df.width = w;
    df.height = h;
    globalThis.window.CatBG.paint(df, globalThis.window.CatBG.DEFAULT, 0);
    return {
      hayLienzo: !!cv,
      ancho: cv ? cv.width : 0,
      alto: cv ? cv.height : 0,
      uri: cv ? cv.toDataURL() : '',
      porDefecto: df.toDataURL(),
    };
  }, { w: W, h: H });

  expect(lienzos.hayLienzo, 'la sala no monta ningún fondo').toBe(true);
  expect(lienzos.ancho, 'el fondo no se pinta a 320 de ancho').toBe(W);
  expect(lienzos.alto, 'el fondo no se pinta a 200 de alto').toBe(H);
  expect(lienzos.uri.length, 'el fondo del muelle no dibuja nada').toBeGreaterThan(500);
  expect(lienzos.uri, 'el fondo del muelle es el mismo que el fondo por defecto')
    .not.toBe(lienzos.porDefecto);

  // 3. Las dos salidas del muelle son puertas visibles: a la plaza y al mercado.
  await expect(page.locator('[data-exit="plaza"]')).toHaveCount(1);
  await expect(page.locator('[data-exit="mercado"]')).toHaveCount(1);
  await expect(page.locator('[data-exit="plaza"]')).toHaveText('Plaza Bigotes');
  await expect(page.locator('[data-exit="mercado"]')).toHaveText('Mercado del Cascabel');

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});
