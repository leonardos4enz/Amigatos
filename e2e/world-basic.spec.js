'use strict';
// Pruebas del mundo dentro de la app: el botón "Explorar el mundo", la pantalla
// con el piso, el nombre de la sala y el viaje de vuelta al lobby.
// Los agentes no ven imágenes: se verifica el estado publicado en globalThis.window.__amigatos.
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

test('una persona explora el mundo, camina por la plaza y vuelve al lobby', async ({ page }) => {
  const errors = trackErrors(page);
  await registerAndCreateCat(page);

  // 1. El botón abre la pantalla del mundo.
  await page.locator('#btn-explorar').click();
  await expect(visibleScreen(page)).toHaveAttribute('data-screen', 'world');

  // 2. El servidor manda la sala: la plaza y su nombre.
  await expect.poll(async () => page.evaluate(() => {
    const w = globalThis.window.__amigatos;
    return w ? w.room : null;
  })).toBe('plaza');
  await expect(page.locator('#world-room-name')).toHaveText('Plaza Bigotes');
  await expect(page.locator('#world-exits')).toContainText('Parque Ronroneo');
  await expect(page.locator('#world-exits')).toContainText('Café del Ovillo');

  // 3. El gato propio aparece en el spawn de la sala.
  await expect.poll(async () => page.evaluate(() => {
    const w = globalThis.window.__amigatos;
    return w && w.me ? w.me.x : null;
  })).not.toBeNull();
  const spawn = await page.evaluate(() => globalThis.window.__amigatos.me);
  await expect(page.locator('#world-stage .world-cat')).toHaveCount(1);

  // 4. Un clic en el piso mueve el gato (lo decide el servidor).
  const stage = page.locator('#world-stage');
  const box = await stage.boundingBox();
  const t0 = Date.now();
  await stage.click({ position: { x: Math.round(box.width * 0.3), y: Math.round(box.height * 0.3) } });

  // El servidor decide el destino: el punto caminable más cercano al clic (el
  // clic es en el cielo, así que el destino está en el suelo, no en el cielo).
  // Primero espera a que el gato tenga un destino nuevo (distinto del spawn).
  await expect.poll(async () => page.evaluate((s) => {
    const me = globalThis.window.__amigatos && globalThis.window.__amigatos.me;
    if (!me || !me.target) return false;
    return me.target.x !== s.x || me.target.y !== s.y;
  }, spawn)).toBe(true);
  const destino = await page.evaluate(() => globalThis.window.__amigatos.me.target);
  expect(destino.y).toBeGreaterThanOrEqual(110);

  // El gato camina hasta el destino (la posición la publica el servidor) y no
  // aparece de golpe en él.
  await expect.poll(async () => page.evaluate(() => {
    const me = globalThis.window.__amigatos && globalThis.window.__amigatos.me;
    if (!me || !me.target) return false;
    return me.x === me.target.x && me.y === me.target.y;
  })).toBe(true);
  expect(Date.now() - t0, 'el gato debería haber caminado hasta el destino').toBeGreaterThan(200);
  const llegada = await page.evaluate(() => globalThis.window.__amigatos.me);
  expect({ x: llegada.x, y: llegada.y }).toEqual({ x: destino.x, y: destino.y });

  // 5. "Volver al lobby" regresa a la sala y repinta la lista de conectados.
  await page.locator('#btn-world-back').click();
  await expect(visibleScreen(page)).toHaveAttribute('data-screen', 'lobby');
  await expect(page.locator('#player-list .player').first()).toBeVisible();

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});
