'use strict';
// Pruebas de los fondos de las tres salas del mundo (plaza, parque, cafe).
// Los agentes no ven imágenes: se verifica que las escenas están registradas
// y que pintan algo (el canvas produce contenido medible) a 320x200.
const { test, expect } = require('@playwright/test');

const IDS = ['plaza', 'parque', 'cafe'];
const ROOM_FILES = ['js/bg/rooms/plaza.js', 'js/bg/rooms/parque.js', 'js/bg/rooms/cafe.js'];
const UTILS = ['R', 'P', 'disc', 'ellipse', 'rowDither', 'vgrad', 'cloud', 'sparkle', 'star5', 'heart5', 'hash', 'groundY'];

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

  // 1. Las tres escenas existen.
  for (const id of IDS) {
    expect(await page.evaluate((x) => globalThis.window.CatBG.has(x), id)).toBe(true);
  }

  // 2. Aparece en la lista de fondos.
  const listed = await page.evaluate(() => globalThis.window.CatBG.list().map((s) => s.id));
  for (const id of IDS) expect(listed).toContain(id);

  // 3. Pintan sin errores y producen un canvas con contenido (la base nueva del mundo: 320x200).
  const sizes = await page.evaluate((ids) => {
    const cv = globalThis.document.createElement('canvas');
    cv.width = 320; cv.height = 200;
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

test('las utilidades de dibujo son compartidas y cada sala tiene su archivo', async ({ page }) => {
  await page.goto('/');

  // 1. Las utilidades viven en window.CatBGPixels (no duplicadas en cada escena).
  const missing = await page.evaluate((names) => {
    const PX = globalThis.window.CatBGPixels;
    if (!PX) return names; // sin el módulo compartido no hay nada que usar
    return names.filter((n) => typeof PX[n] !== 'function');
  }, UTILS);
  expect(missing, 'window.CatBGPixels no expone las utilidades de dibujo').toEqual([]);

  // 2. index.html carga el módulo compartido y el archivo de cada sala.
  const html = await (await page.request.get('/')).text();
  expect(html).toContain('js/bg/pixels.js');
  for (const file of ROOM_FILES) expect(html).toContain(file);

  // 3. Cada archivo de sala se sirve, registra su escena y declara su ancho nativo.
  for (const file of ROOM_FILES) {
    const res = await page.request.get('/' + file);
    expect(res.status(), `${file} no se sirve`).toBe(200);
    const src = await res.text();
    expect(src, `${file} no registra su escena`).toContain('CatBG.register');
    expect(src, `${file} no declara su ancho nativo`).toContain('NATIVE_W');
    expect(src, `${file} no usa las utilidades compartidas`).toContain('window.CatBGPixels');
    // ninguna escena se dibuja con sus propias utilidades
    expect(src, `${file} duplica las utilidades de dibujo`).not.toMatch(/function (R|P|disc|ellipse|vgrad|rowDither)\(/);
  }

  // 4. El antiguo archivo común ya no define escenas.
  const old = await page.request.get('/js/bg/world.js');
  if (old.status() === 200) {
    expect(await old.text(), 'js/bg/world.js ya no debe definir escenas').not.toContain('CatBG.register');
  }
});
