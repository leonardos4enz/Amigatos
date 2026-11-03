'use strict';
// El fondo del Mercado del Cascabel (pixel art procedural a 320x200).
// Los agentes NO ven imágenes: se comprueban los píxeles del canvas, la geometría que
// declara el servidor (server/world.js) y que los objetos sólidos de la escena no se
// cruzan con el piso caminable de la sala.
const { test, expect } = require('@playwright/test');
const { io } = require('socket.io-client');
const { ROOMS } = require('../server/world');

const W = 320;
const H = 200;
const BASE = `http://localhost:${process.env.E2E_PORT || 4173}`;

// La parte de arriba del escenario (cielo) y una franja del suelo caminable (empedrado).
// El cielo es frío (azul > rojo) y el empedrado es cálido (rojo > azul).
const SKY_STRIP = { x0: 40, x1: 280, y0: 2, y1: 14 };
const FLOOR_STRIP = { x0: 30, x1: 110, y0: 178, y1: 194 };

let counter = 0;
const uniqueName = () => `e2em${Date.now().toString(36)}${counter++}`.slice(0, 20);

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
  const username = uniqueName();
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

// La sala en la que está la página (null si todavía no está en el mundo).
async function roomOf(page) {
  return page.evaluate(() => {
    const w = globalThis.window.__amigatos;
    return w ? w.room : null;
  });
}

// Entra al mundo y espera a que el servidor mande la sala.
async function explore(page, room) {
  await expect(page.locator('#player-list .player').first()).toBeVisible();
  await page.locator('#btn-explorar').click();
  await expect(visibleScreen(page)).toHaveAttribute('data-screen', 'world');
  await expect.poll(() => roomOf(page), { timeout: 15000 }).toBe(room);
}

// Entra en otra sala con el mismo token de la página: el servidor decide el destino.
// Se usa un socket aparte para no tocar el estado del navegador (el socket de la página
// recibe el 'world:state' igual que si se viajara desde el mapa).
async function travelTo(page, room) {
  const token = await page.evaluate(() => globalThis.window.localStorage.getItem('amigatos_token'));
  const socket = io(BASE, { auth: { token } });
  await new Promise((resolve, reject) => {
    socket.on('connect', () => { socket.emit('world:enter', { room }); resolve(); });
    socket.on('connect_error', (err) => reject(err));
  });
  return socket;
}

// Pinta la escena del mercado en un lienzo de 320x200 y devuelve datos sobre sus píxeles.
async function paintMercado(page) {
  return page.evaluate(({ w, h, sky, floor, exits }) => {
    const cv = globalThis.document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    globalThis.window.CatBG.paint(cv, 'mercado', 0);
    const data = cv.getContext('2d').getImageData(0, 0, w, h).data;
    const at = (x, y) => {
      const i = (y * w + x) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    };
    function mean(box) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let y = box.y0; y < box.y1; y++) {
        for (let x = box.x0; x < box.x1; x++) {
          const p = at(x, y);
          r += p[0]; g += p[1]; b += p[2]; n++;
        }
      }
      return [r / n, g / n, b / n];
    }
    return {
      urlLen: cv.toDataURL().length,
      sky: mean(sky),
      floor: mean(floor),
      exits: exits.map((e) => ({
        to: e.to,
        center: at(e.x + Math.floor(e.w / 2), e.y + Math.floor(e.h / 2)),
      })),
      // un punto de empedrado lejos de las salidas, para compararlo con el camino
      pavement: at(100, 149),
    };
  }, { w: W, h: H, sky: SKY_STRIP, floor: FLOOR_STRIP, exits: ROOMS.mercado.exits });
}

// Caja de un polígono rectangular (x0, y0, x1, y1) en coordenadas lógicas.
function bbox(poly) {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

test('al entrar en el mercado se dibuja su fondo, no el fondo por defecto', async ({ page }) => {
  const errors = trackErrors(page);
  await registerAndCreateCat(page);
  await explore(page, 'plaza');

  const socket = await travelTo(page, 'mercado');
  try {
    // 1. El gato entra en la sala del mercado.
    await expect.poll(() => roomOf(page), { timeout: 15000 }).toBe('mercado');
    await expect(page.locator('#world-room-name')).toHaveText('Mercado del Cascabel');

    // 2. El escenario pinta el fondo de la sala con contenido...
    const shot = await page.evaluate(() => {
      const cv = globalThis.document.querySelector('#world-stage canvas.catbg-canvas');
      if (!cv) return null;
      const url = cv.toDataURL();
      // el fondo por defecto, pintado con el mismo tamaño
      const def = globalThis.document.createElement('canvas');
      def.width = cv.width;
      def.height = cv.height;
      globalThis.window.CatBG.paint(def, globalThis.window.CatBG.DEFAULT, 0);
      return { w: cv.width, h: cv.height, len: url.length, sameAsDefault: url === def.toDataURL() };
    });
    expect(shot, 'el mercado no monta ningún fondo').not.toBeNull();
    expect(shot.len, 'el fondo del mercado no dibuja nada').toBeGreaterThan(500);
    // 3. ...y es distinto del fondo por defecto.
    expect(shot.sameAsDefault, 'el mercado se ve igual que el fondo por defecto').toBe(false);
  } finally {
    socket.close();
  }

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});

test('el suelo caminable del mercado se distingue del cielo', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');

  const shot = await paintMercado(page);

  // 1. La escena produce contenido.
  expect(shot.urlLen, 'el fondo del mercado no dibuja nada').toBeGreaterThan(500);

  // 2. Arriba hay cielo (frío: el azul manda) y abajo empedrado (cálido: el rojo manda).
  expect(shot.sky[2], `la parte de arriba no es cielo: ${shot.sky.join(',')}`).toBeGreaterThan(shot.sky[0]);
  expect(shot.floor[0], `el suelo no es empedrado: ${shot.floor.join(',')}`).toBeGreaterThan(shot.floor[2]);

  // 3. Los dos promedios son claramente distintos.
  const diff = Math.abs(shot.sky[0] - shot.floor[0])
    + Math.abs(shot.sky[1] - shot.floor[1])
    + Math.abs(shot.sky[2] - shot.floor[2]);
  expect(diff, 'el suelo se ve igual que el cielo').toBeGreaterThan(60);

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});

test('las salidas del mercado se ven como un camino', async ({ page }) => {
  await page.goto('/');
  const shot = await paintMercado(page);

  expect(shot.exits.length, 'el mercado no tiene salidas').toBe(2);
  for (const exit of shot.exits) {
    // el centro de la salida es un camino de tierra: cálido y distinto del empedrado
    expect(exit.center.join(','), `la salida hacia "${exit.to}" no se ve como un camino`)
      .not.toBe(shot.pavement.join(','));
    expect(exit.center[0], `la salida hacia "${exit.to}" no es cálida`).toBeGreaterThan(exit.center[2]);

  }
});

test('los objetos sólidos del mercado no se cruzan con el piso caminable', async ({ page }) => {
  await page.goto('/');

  // 1. La escena publica sus sólidos.
  const solids = await page.evaluate(() => globalThis.window.CatBG.solids('mercado'));
  expect(solids.length, 'el mercado no declara objetos sólidos').toBeGreaterThan(0);

  // 2. Ninguno se cruza con los polígonos caminables que declara el servidor.
  for (const solid of solids) {
    const sx1 = solid.x + solid.w - 1;
    const sy1 = solid.y + solid.h - 1;
    for (const poly of ROOMS.mercado.walkable) {
      const [x0, y0, x1, y1] = bbox(poly);
      const seCruza = solid.x <= x1 && sx1 >= x0 && solid.y <= y1 && sy1 >= y0;
      expect(seCruza, `el sólido ${JSON.stringify(solid)} se cruza con el piso caminable ${JSON.stringify(poly)}`)
        .toBe(false);
    }
  }
});

test('la escena del mercado declara su ancho nativo y sus sólidos', async ({ page }) => {
  await page.goto('/');
  const res = await page.request.get('/js/bg/rooms/mercado.js');
  expect(res.status()).toBe(200);
  const src = await res.text();
  expect(src, 'el mercado no declara NATIVE_W = 320').toMatch(/NATIVE_W\s*=\s*320/);
  expect(src, 'el mercado no usa las utilidades compartidas').toContain('window.CatBGPixels');
  expect(src, 'el mercado no se registra').toContain('CatBG.register');
  expect(src, 'el mercado no dibuja sus objetos desde una lista de rectángulos').toMatch(/solids:\s*SOLIDS/);
});
