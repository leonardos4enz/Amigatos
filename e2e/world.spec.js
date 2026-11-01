'use strict';
// Prueba del mundo con dos navegadores: dos cuentas se encuentran en la plaza,
// se ven, caminan y cambian de sala. Los agentes no ven imágenes: se verifica
// el estado publicado en globalThis.window.__amigatos y los errores de consola.
const { test, expect } = require('@playwright/test');

let counter = 0;
const uniqueName = () => `e2ew${Date.now().toString(36)}${counter++}`.slice(0, 20);

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

// Estado del mundo que publica el cliente (window.__amigatos), o null.
async function worldState(page) {
  return page.evaluate(() => {
    const w = globalThis.window.__amigatos;
    if (!w) return null;
    return {
      room: w.room,
      roomWidth: w.roomWidth,
      roomHeight: w.roomHeight,
      exits: w.exits.map((e) => ({ x: e.x, y: e.y, w: e.w, h: e.h, to: e.to, label: e.label })),
      me: w.me ? { x: w.me.x, y: w.me.y } : null,
      players: w.players.map((p) => ({ id: String(p.id), username: p.username, x: p.x, y: p.y }))
    };
  });
}

// La sala en la que está la página.
async function roomOf(page) {
  const w = await worldState(page);
  return w ? w.room : null;
}

// El id (como texto) del gato con ese nombre en la lista de la página.
async function idOf(page, username) {
  const w = await worldState(page);
  if (!w) return null;
  const found = w.players.find((p) => p.username === username);
  return found ? found.id : null;
}

// ¿Está el gato con ese id en la lista de gatos de la página?
async function hasPlayer(page, id) {
  const w = await worldState(page);
  if (!w) return false;
  return w.players.some((p) => p.id === String(id));
}

// Abre la pantalla del mundo y espera a que el servidor mande la sala.
// Reintenta el clic mientras el socket del navegador todavía no está conectado.
async function explore(page, room) {
  await expect.poll(async () => {
    const screen = await page.evaluate(() => {
      const el = globalThis.document.querySelector('.screen:not(.hidden)');
      return el ? el.getAttribute('data-screen') : null;
    });
    if (screen === 'world') return 'world';
    await page.locator('#btn-explorar').click();
    return 'lobby';
  }, { timeout: 15000 }).toBe('world');
  await expect.poll(() => roomOf(page), { timeout: 15000 }).toBe(room);
}

// Convierte un punto lógico de la sala a píxeles del escenario y hace clic ahí.
async function clickLogical(page, lx, ly) {
  const w = await worldState(page);
  const box = await page.locator('#world-stage').boundingBox();
  const px = Math.round((lx / w.roomWidth) * box.width);
  const py = Math.round((ly / w.roomHeight) * box.height);
  await page.locator('#world-stage').click({ position: { x: px, y: py } });
}

// Hace clic en la salida que lleva a otra sala (el rectángulo está en la lista
// de salidas que publica el cliente).
async function clickExit(page, to) {
  const w = await worldState(page);
  const exit = w.exits.find((e) => e.to === to);
  if (!exit) throw new Error(`la sala "${w.room}" no tiene salida hacia "${to}"`);
  await clickLogical(page, exit.x + exit.w / 2, exit.y + exit.h / 2);
}

test('dos personas se ven en la plaza, caminan y cambian de sala', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  const errors = [...trackErrors(pageA), ...trackErrors(pageB)];

  try {
    const nameA = await registerAndCreateCat(pageA);
    const nameB = await registerAndCreateCat(pageB);

    // 1. Las dos entran al mundo y el servidor las pone en la plaza.
    await explore(pageA, 'plaza');
    await explore(pageB, 'plaza');
    await expect(visibleScreen(pageA)).toHaveAttribute('data-screen', 'world');
    await expect(visibleScreen(pageB)).toHaveAttribute('data-screen', 'world');

    // 2. Cada una ve a la otra en su lista de gatos.
    await expect.poll(() => idOf(pageA, nameB)).not.toBeNull();
    await expect.poll(() => idOf(pageB, nameA)).not.toBeNull();
    const idB = await idOf(pageA, nameB);
    const idA = await idOf(pageB, nameA);
    await expect.poll(() => hasPlayer(pageA, idB)).toBe(true);
    await expect.poll(() => hasPlayer(pageB, idA)).toBe(true);

    // 3. A hace clic en el piso: su gato camina hasta ahí (±1 por el redondeo).
    const spawn = await worldState(pageA);
    const target = { x: 20, y: 20 };
    await clickLogical(pageA, target.x, target.y);
    await expect.poll(async () => {
      const w = await worldState(pageA);
      if (!w || !w.me) return 99;
      return Math.abs(w.me.x - target.x);
    }).toBeLessThanOrEqual(1);
    await expect.poll(async () => {
      const w = await worldState(pageA);
      if (!w || !w.me) return 99;
      return Math.abs(w.me.y - target.y);
    }).toBeLessThanOrEqual(1);
    await expect.poll(async () => {
      const w = await worldState(pageA);
      return w && w.me ? w.me.x : null;
    }).not.toBe(spawn.me ? spawn.me.x : null);

    // 4. B ve la nueva posición de A.
    await expect.poll(async () => {
      const mine = await worldState(pageA);
      const other = await worldState(pageB);
      if (!mine || !other || !mine.me) return false;
      const seen = other.players.find((p) => p.username === nameA);
      return !!seen && seen.x === mine.me.x && seen.y === mine.me.y;
    }).toBe(true);

    // 5. A cruza la salida hacia el Parque: se va de la plaza y B lo ve.
    await clickExit(pageA, 'parque');
    await expect.poll(() => roomOf(pageA)).toBe('parque');
    await expect.poll(() => hasPlayer(pageB, idA)).toBe(false);

    // 6. B entra también en el Parque y ahí se ven los dos.
    await clickExit(pageB, 'parque');
    await expect.poll(() => roomOf(pageB)).toBe('parque');
    await expect.poll(() => hasPlayer(pageB, idA)).toBe(true);

    expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
