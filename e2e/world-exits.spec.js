'use strict';
// Las salidas que se listan debajo del mapa son botones: al pulsarlos el gato
// camina hasta esa salida y cambia de sala (lo decide el servidor, como cuando
// se camina hasta el borde a mano). Los agentes no ven imágenes: se verifica el
// estado publicado en globalThis.window.__amigatos.
const { test, expect } = require('@playwright/test');

let counter = 0;
const uniqueName = () => `e2ex${Date.now().toString(36)}${counter++}`.slice(0, 20);

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
  // La lista de conectados del lobby se pinta cuando llega la presencia:
  // eso demuestra que el socket ya está conectado.
  await expect(page.locator('#player-list .player').first()).toBeVisible();
  await page.locator('#btn-explorar').click();
  await expect(visibleScreen(page)).toHaveAttribute('data-screen', 'world');
  await expect.poll(() => roomOf(page), { timeout: 15000 }).toBe(room);
}

test('las salidas de la sala son botones que llevan al gato a otra sala', async ({ page }) => {
  const errors = trackErrors(page);
  await registerAndCreateCat(page);

  // 1. Entra al mundo: el servidor lo pone en la plaza.
  await explore(page, 'plaza');
  await expect(page.locator('#world-room-name')).toHaveText('Plaza Bigotes');

  // 2. Las salidas de la lista son botones con el nombre de la sala de destino.
  const exits = page.locator('#world-exits button');
  await expect(exits).toHaveCount(2);
  const cafe = page.locator('#world-exits button', { hasText: 'Café del Ovillo' });
  await expect(cafe).toHaveCount(1);
  await expect(cafe).toHaveText('Café del Ovillo');
  await expect(cafe).toHaveJSProperty('tagName', 'BUTTON');
  await expect(page.getByRole('button', { name: 'Café del Ovillo' })).toHaveCount(1);

  // 3. Con el teclado: la salida está enfocada y con Enter el gato cambia de sala.
  await cafe.focus();
  await expect(cafe).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => roomOf(page), { timeout: 15000 }).toBe('cafe');
  await expect(page.locator('#world-room-name')).toHaveText('Café del Ovillo');

  // 4. La lista se repinta con las salidas de la sala nueva: se vuelve a la plaza.
  await expect(page.locator('#world-exits button', { hasText: 'Plaza Bigotes' })).toHaveCount(1);
  await page.locator('#world-exits button', { hasText: 'Plaza Bigotes' }).click();
  await expect.poll(() => roomOf(page), { timeout: 15000 }).toBe('plaza');

  // 5. Con el ratón: pulsar la salida del parque cambia de sala igual que caminar.
  await page.locator('#world-exits button', { hasText: 'Parque Ronroneo' }).click();
  await expect.poll(() => roomOf(page), { timeout: 15000 }).toBe('parque');
  await expect(page.locator('#world-room-name')).toHaveText('Parque Ronroneo');

  // 6. El servidor coloca al gato en la sala nueva (nadie se lo inventa).
  await expect.poll(async () => page.evaluate(() => {
    const w = globalThis.window.__amigatos;
    return w && w.me ? `${w.me.x},${w.me.y}` : null;
  })).toBe('290,180');

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});
