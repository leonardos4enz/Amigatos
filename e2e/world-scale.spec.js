'use strict';
// Escala del mundo: la sala es de 320×200 lógicos, el escenario se dibuja con una
// escala ENTERA (nada de escalado fraccionario) y el cliente publica el estado de
// docs/mundo.md §6 en window.__amigatos.
// Los agentes no ven imágenes: se verifica el DOM y el estado publicado.
const { test, expect } = require('@playwright/test');

// La geometría la manda el servidor: se compara con el mismo catálogo que usa.
const worldRules = require('../server/world');

let counter = 0;
const uniqueName = () => `e2ews${Date.now().toString(36)}${counter++}`.slice(0, 20);

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

// Estado del mundo publicado por el cliente.
async function worldState(page) {
  return page.evaluate(() => {
    const w = globalThis.window.__amigatos;
    if (!w) return null;
    return {
      room: w.room,
      roomName: w.roomName,
      roomWidth: w.roomWidth,
      roomHeight: w.roomHeight,
      catHeight: w.catHeight,
      walkable: w.walkable,
      scale: w.scale,
      mapOpen: w.mapOpen,
      transition: w.transition
    };
  });
}

// Tamaño en CSS del escenario, del gato y del canvas del fondo.
async function sizes(page) {
  return page.evaluate(() => {
    const stage = globalThis.document.querySelector('#world-stage');
    const cat = globalThis.document.querySelector('#world-stage .world-cat-canvas');
    const bg = globalThis.document.querySelector('#world-stage canvas.catbg-canvas');
    return {
      stageW: stage ? stage.getBoundingClientRect().width : 0,
      stageH: stage ? stage.getBoundingClientRect().height : 0,
      catW: cat ? cat.getBoundingClientRect().width : 0,
      bgW: bg ? bg.width : 0,
      bgH: bg ? bg.height : 0
    };
  });
}

// Entra al mundo y espera a que el servidor mande la sala.
async function explore(page, room) {
  await expect(page.locator('#player-list .player').first()).toBeVisible();
  await page.locator('#btn-explorar').click();
  await expect(visibleScreen(page)).toHaveAttribute('data-screen', 'world');
  await expect.poll(async () => {
    const w = await worldState(page);
    return w && w.room;
  }, { timeout: 15000 }).toBe(room);
}

// Camina hasta la salida que lleva a otra sala (el gato cruza por la puerta).
async function travelTo(page, label, room) {
  await page.locator('#world-exits button', { hasText: label }).click();
  await expect.poll(async () => {
    const w = await worldState(page);
    return w ? w.room : null;
  }, { timeout: 15000 }).toBe(room);
}

// Comprueba la sala que hay en pantalla: resolución, escala y contrato publicado.
async function expectRoom(page, room) {
  await expect.poll(async () => {
    const w = await worldState(page);
    return w ? w.room : null;
  }, { timeout: 15000 }).toBe(room);

  const w = await worldState(page);

  // 1. La sala mide 320×200 lógicos.
  expect(w.roomWidth, `la sala "${room}" no mide 320 de ancho`).toBe(320);
  expect(w.roomHeight, `la sala "${room}" no mide 200 de alto`).toBe(200);

  // 2. El gato mide unos 30 px lógicos de alto (26..34).
  expect(w.catHeight, `el gato de "${room}" no mide 32 px lógicos`).toBeGreaterThanOrEqual(26);
  expect(w.catHeight, `el gato de "${room}" no mide 32 px lógicos`).toBeLessThanOrEqual(34);

  // 3. El piso caminable es el mismo que manda el servidor.
  expect(w.walkable, `el piso caminable de "${room}" no es el del servidor`)
    .toEqual(worldRules.walkablePolygons(worldRules.ROOMS[room]));

  // 4. La escala es entera (y el escenario y el gato, múltiplos exactos).
  expect(Number.isInteger(w.scale), 'la escala no es un número entero').toBe(true);
  expect(w.scale).toBeGreaterThanOrEqual(1);
  expect(w.scale).toBeLessThanOrEqual(3);

  const s = await sizes(page);
  expect(s.stageW % 320, 'el ancho del escenario no es múltiplo de 320').toBe(0);
  expect(s.stageH % 200, 'el alto del escenario no es múltiplo de 200').toBe(0);
  expect(s.stageW).toBe(320 * w.scale);
  expect(s.stageH).toBe(200 * w.scale);
  expect(s.catW % 32, 'el ancho del gato no es múltiplo de 32').toBe(0);
  expect(s.catW).toBe(32 * w.scale);

  // 5. El fondo se pinta a 320×200 px lógicos.
  expect(s.bgW, 'el canvas del fondo no mide 320 px lógicos').toBe(320);
  expect(s.bgH, 'el canvas del fondo no mide 200 px lógicos').toBe(200);

  // 6. En reposo el mapa está cerrado y no hay transición.
  expect(w.mapOpen).toBe(false);
  expect(w.transition).toBe(false);
}

test('las tres salas se ven a 320×200 con escala entera y el contrato de __amigatos', async ({ page }) => {
  const errors = trackErrors(page);
  await registerAndCreateCat(page);

  // 1. La plaza: el servidor la pone en 320×200 con su piso caminable.
  await explore(page, 'plaza');
  await expectRoom(page, 'plaza');

  // 2. El parque: misma resolución y mismo contrato.
  await travelTo(page, 'Parque Ronroneo', 'parque');
  await expectRoom(page, 'parque');

  // 3. De vuelta a la plaza y al café.
  await travelTo(page, 'Plaza Bigotes', 'plaza');
  await expectRoom(page, 'plaza');
  await travelTo(page, 'Café del Ovillo', 'cafe');
  await expectRoom(page, 'cafe');

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});
