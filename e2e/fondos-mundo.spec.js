'use strict';
// Pruebas de los fondos de las tres salas del mundo (plaza, parque, cafe).
// Los agentes no ven imágenes: se verifica que las escenas están registradas
// y que pintan algo (el canvas produce contenido medible).
const { test, expect } = require('@playwright/test');

const IDS = ['plaza', 'parque', 'cafe'];

// Falla el test si la página tira errores de JavaScript.
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  return errors;
}

test('las tres salas del mundo tienen fondo pixel art registrado y pintan contenido', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await page.addScriptTag({ url: '/js/bg/world.js' });

  // 1. Las tres escenas existen.
  for (const id of IDS) {
    expect(await page.evaluate((x) => globalThis.window.CatBG.has(x), id)).toBe(true);
  }

  // 2. Aparece en la lista de fondos.
  const listed = await page.evaluate(() => globalThis.window.CatBG.list().map((s) => s.id));
  for (const id of IDS) expect(listed).toContain(id);

  // 3. Pintan sin errores y producen un canvas con contenido.
  const sizes = await page.evaluate((ids) => {
    const cv = globalThis.document.createElement('canvas');
    cv.width = 96; cv.height = 72;
    const out = {};
    for (const id of ids) {
      globalThis.window.CatBG.paint(cv, id, 0);
      out[id] = cv.toDataURL().length;
    }
    return out;
  }, IDS);
  for (const id of IDS) {
    expect(sizes[id], `el fondo "${id}" no dibuja nada`).toBeGreaterThan(500);
  }

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});
