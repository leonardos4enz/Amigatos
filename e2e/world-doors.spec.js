'use strict';
// Las salidas de la sala son objetos visibles del fondo (docs/mundo.md §4):
// por cada salida hay un elemento [data-exit="<destino>"] encima de la puerta,
// con su etiqueta y su resaltado. Al pulsarlo, el gato camina hasta la puerta
// y cruza: el cambio de sala lo decide el servidor, no el cliente.
// Los agentes no ven imágenes: se verifica el DOM y el estado publicado.
const { test, expect } = require('@playwright/test');

// La geometría la manda el servidor: se compara con el mismo catálogo que usa.
const worldRules = require('../server/world');

let counter = 0;
const uniqueName = () => `e2ed${Date.now().toString(36)}${counter++}`.slice(0, 20);

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

// Estado del gato propio: sala, animación y posición.
async function meOf(page) {
  return page.evaluate(() => {
    const w = globalThis.window.__amigatos;
    if (!w || !w.me) return null;
    return { room: w.room, anim: w.me.anim, x: w.me.x, y: w.me.y };
  });
}

// Entra al mundo y espera a que el servidor mande la sala.
async function explore(page, room) {
  await expect(page.locator('#player-list .player').first()).toBeVisible();
  await page.locator('#btn-explorar').click();
  await expect(visibleScreen(page)).toHaveAttribute('data-screen', 'world');
  await expect.poll(() => roomOf(page), { timeout: 15000 }).toBe(room);
}

// Comprueba que la puerta está colocada encima del rectángulo de la salida
// que define el servidor (dentro de un píxel de diferencia). Las dos cajas se
// miden en el mismo momento: si la página se mueve entre Measurements, la
// comparación no valdría.
async function expectDoorOverRect(page, roomId, to) {
  const room = worldRules.getRoom(roomId);
  const exit = room.exits.find((e) => e.to === to);
  const medidas = await page.evaluate((sel) => {
    const stage = globalThis.document.querySelector('#world-stage');
    const door = globalThis.document.querySelector(sel);
    const s = stage.getBoundingClientRect();
    const d = door.getBoundingClientRect();
    return {
      x: d.x - s.x, y: d.y - s.y, w: d.width, h: d.height,
      stageW: s.width, stageH: s.height,
    };
  }, `[data-exit="${to}"]`);
  const esperado = {
    x: (exit.x / room.width) * medidas.stageW,
    y: (exit.y / room.height) * medidas.stageH,
    w: (exit.w / room.width) * medidas.stageW,
    h: (exit.h / room.height) * medidas.stageH,
  };
  expect(Math.abs(medidas.x - esperado.x), 'la puerta no está en la x de la salida').toBeLessThan(1);
  expect(Math.abs(medidas.y - esperado.y), 'la puerta no está en la y de la salida').toBeLessThan(1);
  expect(Math.abs(medidas.w - esperado.w), 'la puerta no tiene el ancho de la salida').toBeLessThan(1);
  expect(Math.abs(medidas.h - esperado.h), 'la puerta no tiene el alto de la salida').toBeLessThan(1);
}

test('cada salida es una puerta visible con etiqueta, resaltado y cruce', async ({ page }) => {
  const errors = trackErrors(page);
  await registerAndCreateCat(page);

  // 1. En la plaza hay una puerta por salida, con su texto y con cursor de mano.
  await explore(page, 'plaza');
  const parque = page.locator('[data-exit="parque"]');
  const cafe = page.locator('[data-exit="cafe"]');
  await expect(parque).toHaveCount(1);
  await expect(cafe).toHaveCount(1);
  await expect(parque).toHaveText('Parque Ronroneo');
  await expect(cafe).toHaveText('Café del Ovillo');
  await expect(cafe).toHaveCSS('cursor', 'pointer');
  await expect(parque).toHaveCSS('cursor', 'pointer');
  await expectDoorOverRect(page, 'plaza', 'cafe');
  await expectDoorOverRect(page, 'plaza', 'parque');

  // 2. Al pasar el mouse, la puerta se resalta y su etiqueta se hace visible.
  const etiqueta = cafe.locator('.world-exit-label');
  await expect(etiqueta).toBeHidden();
  await cafe.hover();
  await expect(cafe).toHaveClass(/is-hover/);
  await expect(etiqueta).toBeVisible();

  // 3. Al pulsar la puerta, el gato camina hasta ella: no cambia de sala antes
  //    de llegar al umbral (eso lo decide el servidor).
  await cafe.click();
  await expect.poll(async () => (await meOf(page)) ? (await meOf(page)).anim : null,
    { timeout: 10000 }).toBe('walk');
  expect((await meOf(page)).room, 'la sala no cambia mientras el gato camina').toBe('plaza');

  // 4. Cuando llega al umbral, el servidor lo pasa a la sala de destino.
  await expect.poll(() => roomOf(page), { timeout: 15000 }).toBe('cafe');
  await expect(page.locator('#world-room-name')).toHaveText('Café del Ovillo');

  // 5. En la sala nueva las puertas se repintan: la del café vuelve a la plaza.
  await expect(page.locator('[data-exit="plaza"]')).toHaveCount(1);
  await expect(page.locator('[data-exit="cafe"]')).toHaveCount(0);
  await expect(page.locator('[data-exit="plaza"]')).toHaveText('Plaza Bigotes');
  await expect(page.locator('[data-exit="plaza"]')).toHaveCSS('cursor', 'pointer');
  await expectDoorOverRect(page, 'cafe', 'plaza');

  // 6. La lista de botones sigue siendo la alternativa accesible.
  await expect(page.locator('#world-exits button')).toHaveCount(1);
  await expect(page.locator('#world-exits button', { hasText: 'Plaza Bigotes' })).toHaveCount(1);

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});
