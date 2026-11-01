'use strict';
// Pruebas de navegador. Verifican lo que vería una persona, pero en texto:
// pantalla visible, contenido de elementos y errores de consola. Sin capturas.
const { test, expect } = require('@playwright/test');

let counter = 0;
const uniqueName = () => `e2e${Date.now().toString(36)}${counter++}`.slice(0, 20);

// Falla el test si la página tira errores de JavaScript.
// Varias páginas pueden compartir el mismo array: los errores de todas se van
// guardando ahí, así que los que llegan al final del test también se ven.
function trackErrors(page, errors = []) {
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  return errors;
}

// La comprobación final de errores: si hay alguno, el test falla diciendo cuáles.
function expectNoErrors(errors) {
  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
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

test('una persona nueva crea su cuenta y su gato y llega al lobby', async ({ page }) => {
  const errors = trackErrors(page);
  const username = await registerAndCreateCat(page);
  await expect(page.locator('#me-username')).toHaveText(`@${username}`);
  await expect(page.locator('#stat-wins')).toHaveText('0');
  expectNoErrors(errors);
});

test('dos jugadores conectados se ven en la lista del otro', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  // Un solo array para las dos páginas: los errores de cualquiera de las dos
  // se acumulan aquí hasta el final del test.
  const errors = trackErrors(pageA, trackErrors(pageB, []));
  const nameA = await registerAndCreateCat(pageA);
  const nameB = await registerAndCreateCat(pageB);
  await expect(pageA.locator('#player-list')).toContainText(nameB);
  await expect(pageB.locator('#player-list')).toContainText(nameA);
  expectNoErrors(errors);
  await ctxA.close();
  await ctxB.close();
});

test('la comprobación de errores detecta un fallo en cualquiera de las dos páginas', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  const errors = trackErrors(pageA, trackErrors(pageB, []));

  await pageA.goto('about:blank');
  await pageB.goto('about:blank');

  // A escribe en la consola; B lanza una excepción sin capturar.
  await pageA.evaluate(() => { console.error('error de consola en A'); });
  await pageB.evaluate(() => { setTimeout(() => { throw new Error('fallo en B'); }); });

  // Los dos errores llegan al mismo array, aunque lleguen después de empezar.
  await expect.poll(() => errors.length).toBeGreaterThanOrEqual(2);
  expect(errors.join(' | ')).toContain('error de consola en A');
  expect(errors.join(' | ')).toContain('fallo en B');

  // Y por eso la comprobación del test de dos jugadores fallaría.
  expect(() => expectNoErrors(errors)).toThrow();

  await ctxA.close();
  await ctxB.close();
});
