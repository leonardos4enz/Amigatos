'use strict';
// El fondo de la Colina del Faro (pixel art procedural a 320x200).
// Los agentes NO ven imágenes: se comprueban los píxeles del canvas, la geometría que
// declara el servidor (server/world.js) y que la escena se dibuja a su ancho nativo.
const { test, expect } = require('@playwright/test');
const { ROOMS, isWalkable } = require('../server/world');

const W = 320;
const H = 200;

// El faro es blanco y rojo: es la seña de la escena.
const FARO_RED = '#e0484a';
const FARO_WHITE = '#f4efe4';

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
  const username = `e2ff${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20);
  await page.goto('/');
  await expect(visibleScreen(page)).toHaveAttribute('data-screen', 'auth');
  await page.locator('[data-tab="register"]').click();
  await page.locator('#auth-username').fill(username);
  await page.locator('#auth-password').fill('secreto123');
  await page.locator('#auth-submit').click();
  await expect(visibleScreen(page)).toHaveAttribute('data-screen', 'creator');
  await page.locator('#creator-save').click();
  await expect(visibleScreen(page)).toHaveAttribute('data-screen', 'lobby');
  return username;
}

// Entra al mundo y espera a que el servidor mande la sala.
async function explore(page, room) {
  await expect(page.locator('#player-list .player').first()).toBeVisible();
  await page.locator('#btn-explorar').click();
  await expect(visibleScreen(page)).toHaveAttribute('data-screen', 'world');
  await expect.poll(async () => page.evaluate(() => {
    const w = globalThis.window.__amigatos;
    return w && w.me ? w.room : null;
  }), { timeout: 15000 }).toBe(room);
}

// Pinta una escena en un lienzo de 320x200 y devuelve datos comprobables sobre sus píxeles.
async function paintScene(page, id) {
  return page.evaluate(({ id, w, h }) => {
    function paint(cw, ch) {
      const cv = globalThis.document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      globalThis.window.CatBG.paint(cv, id, 0);
      return cv;
    }
    const big = paint(w, h);
    const data = big.getContext('2d').getImageData(0, 0, w, h).data;
    const key = (i) => [data[i], data[i + 1], data[i + 2]].join(',');
    const colors = new Set();
    for (let i = 0; i < data.length; i += 4) {
      colors.add('#' + [data[i], data[i + 1], data[i + 2]]
        .map((n) => n.toString(16).padStart(2, '0')).join(''));
    }
    // Promedio de una franja: el suelo caminable (abajo a la izquierda) y el cielo (arriba).
    function strip(x0, x1, y0, y1) {
      let r = 0; let g = 0; let b = 0; let n = 0;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = (y * w + x) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
      }
      return [r / n, g / n, b / n];
    }
    // "Sin escalado": pintada a la mitad sale en bloques de 2x2.
    const small = paint(w / 2, h / 2);
    const sdata = small.getContext('2d').getImageData(0, 0, w / 2, h / 2).data;
    let blockOk = 0;
    let blockBad = 0;
    for (let y = 0; y < h / 2; y++) {
      for (let x = 0; x < w / 2; x++) {
        const s = [sdata[(y * (w / 2) + x) * 4], sdata[(y * (w / 2) + x) * 4 + 1], sdata[(y * (w / 2) + x) * 4 + 2]].join(',');
        const block = [
          key((2 * y * w + 2 * x) * 4),
          key((2 * y * w + 2 * x + 1) * 4),
          key(((2 * y + 1) * w + 2 * x) * 4),
          key(((2 * y + 1) * w + 2 * x + 1) * 4),
        ];
        if (block.includes(s)) blockOk++; else blockBad++;
      }
    }
    return {
      urlLen: big.toDataURL().length,
      colors: [...colors],
      ground: strip(20, 80, 172, 194),
      top: strip(0, w - 1, 0, 12),
      blockOk,
      blockBad,
    };
  }, { id, w: W, h: H });
}

test('la colina del faro se pinta a 320x200 y es distinta del fondo por defecto', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');

  // 1. La escena existe, se sirve y declara su ancho nativo.
  const res = await page.request.get('/js/bg/rooms/faro.js');
  expect(res.status(), 'no se sirve js/bg/rooms/faro.js').toBe(200);
  const src = await res.text();
  expect(src, 'la escena no declara su ancho nativo').toMatch(/NATIVE_W\s*=\s*320/);
  expect(src, 'la escena no usa las utilidades compartidas').toContain('window.CatBGPixels');
  expect(src, 'la escena no se registra').toContain('CatBG.register');

  const html = await (await page.request.get('/')).text();
  expect(html, 'index.html no carga el fondo del faro').toContain('js/bg/rooms/faro.js');

  // 2. La escena está registrada y sale en la lista de fondos.
  expect(await page.evaluate(() => globalThis.window.CatBG.has('faro'))).toBe(true);
  const listed = await page.evaluate(() => globalThis.window.CatBG.list().map((s) => s.id));
  expect(listed).toContain('faro');

  // 3. Pinta contenido a 320x200 y es distinta del fondo por defecto.
  const shot = await paintScene(page, 'faro');
  expect(shot.urlLen, 'el fondo del faro no dibuja nada').toBeGreaterThan(500);
  const def = await paintScene(page, 'cuarto');
  expect(def.urlLen, 'el fondo por defecto no dibuja nada').toBeGreaterThan(500);
  const same = await page.evaluate(({ w, h }) => {
    function paint(id) {
      const cv = globalThis.document.createElement('canvas');
      cv.width = w; cv.height = h;
      globalThis.window.CatBG.paint(cv, id, 0);
      return cv.toDataURL();
    }
    return paint('faro') === paint(globalThis.window.CatBG.DEFAULT);
  }, { w: W, h: H });
  expect(same, 'el fondo del faro es el mismo que el fondo por defecto').toBe(false);

  // 4. La escena conserva su identidad: el faro blanco y rojo está pintado.
  expect(shot.colors, 'el fondo del faro no tiene el faro rojo').toContain(FARO_RED);
  expect(shot.colors, 'el fondo del faro no tiene el faro blanco').toContain(FARO_WHITE);

  // 5. La escena es nativa a 320: pintada a la mitad sale en bloques de 2x2.
  expect(shot.blockBad, 'la escena no se pinta a 320x200 sin escalado').toBe(0);

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});

test('el suelo caminable del faro se distingue del cielo', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');

  const shot = await paintScene(page, 'faro');

  // El cielo de arriba es azul: si no, la comparación de abajo no vale.
  expect(shot.top[2], `la parte de arriba no es azul: ${shot.top.map(Math.round)}`)
    .toBeGreaterThan(shot.top[0]);

  // La franja del suelo caminable (ladera de la izquierda) es verde y no azul.
  expect(shot.ground[1], `el suelo no es verde: ${shot.ground.map(Math.round)}`)
    .toBeGreaterThan(shot.ground[2]);

  // Y el color medio del suelo es distinto del de la parte de arriba del escenario.
  const d = Math.hypot(
    shot.ground[0] - shot.top[0],
    shot.ground[1] - shot.top[1],
    shot.ground[2] - shot.top[2]
  );
  expect(d, 'el suelo se ve igual que la parte de arriba del escenario').toBeGreaterThan(40);

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});

test('los objetos sólidos del faro no pisan el suelo caminable', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');

  const solids = await page.evaluate(() => globalThis.window.CatBG.solids('faro'));
  expect(Array.isArray(solids), 'CatBG.solids no devuelve una lista').toBe(true);
  expect(solids.length, 'la escena del faro no declara objetos sólidos').toBeGreaterThan(0);

  // Cada píxel de cada sólido tiene que estar fuera de los polígonos caminables
  // que declara el servidor para la sala "faro".
  const room = ROOMS.faro;
  const pisados = [];
  for (const s of solids) {
    expect(Number.isFinite(s.x) && Number.isFinite(s.y)
      && Number.isFinite(s.w) && Number.isFinite(s.h), `el sólido ${JSON.stringify(s)} no es un rectángulo`).toBe(true);
    expect(s.w, `el sólido ${JSON.stringify(s)} no tiene anchura`).toBeGreaterThan(0);
    expect(s.h, `el sólido ${JSON.stringify(s)} no tiene altura`).toBeGreaterThan(0);
    for (let y = s.y; y < s.y + s.h; y++) {
      for (let x = s.x; x < s.x + s.w; x++) {
        if (isWalkable(room, x, y)) pisados.push(`${JSON.stringify(s)} pisa (${x},${y})`);
      }
    }
  }
  expect(pisados.slice(0, 10), 'un objeto sólido pisa el suelo caminable').toEqual([]);

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});

test('entrar en la colina del faro dibuja su fondo', async ({ page }) => {
  const errors = trackErrors(page);
  await registerAndCreateCat(page);
  await explore(page, 'plaza');

  // Viaje a la colina: lo decide el servidor (solo deja viajar a salas exteriores).
  await page.evaluate(async () => {
    const token = globalThis.localStorage.getItem('amigatos_token');
    const sock = globalThis.window.io({ auth: { token } });
    await new Promise((resolve, reject) => {
      sock.on('connect', resolve);
      sock.on('connect_error', reject);
    });
    sock.emit('world:travel', { room: 'faro' });
    globalThis.__faroSock = sock;
  });

  await expect.poll(async () => page.evaluate(() => {
    const w = globalThis.window.__amigatos;
    return w ? w.room : null;
  }), { timeout: 15000 }).toBe('faro');

  // El fondo que hay montado en el escenario es el de la colina. El fondo se repinta
  // a 8 fps, así que se espera a que aparezca el faro rojo.
  await expect.poll(async () => page.evaluate(() => {
    const cv = globalThis.document.querySelector('#world-stage canvas.catbg-canvas');
    if (!cv) return false;
    const data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === 0xe0 && data[i + 1] === 0x48 && data[i + 2] === 0x4a) return true;
    }
    return false;
  }), { timeout: 10000 }).toBe(true);

  const shot = await page.evaluate(() => {
    const cv = globalThis.document.querySelector('#world-stage canvas.catbg-canvas');
    if (!cv) return null;
    const data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    const colors = new Set();
    for (let i = 0; i < data.length; i += 4) {
      colors.add('#' + [data[i], data[i + 1], data[i + 2]]
        .map((n) => n.toString(16).padStart(2, '0')).join(''));
    }
    return { w: cv.width, h: cv.height, urlLen: cv.toDataURL().length, colors: [...colors] };
  });

  expect(shot, 'el mundo no ha montado el fondo de la sala').not.toBeNull();
  expect(shot.w, 'el fondo no se pinta a 320 de ancho').toBe(320);
  expect(shot.h, 'el fondo no se pinta a 200 de alto').toBe(200);
  expect(shot.urlLen, 'el fondo del faro no dibuja nada').toBeGreaterThan(500);
  expect(shot.colors, 'el fondo montado no es el de la colina').toContain(FARO_RED);

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});
