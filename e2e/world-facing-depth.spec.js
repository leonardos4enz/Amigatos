'use strict';
// Orientación (facing) y profundidad (z-index) de los gatos del mundo
// (docs/mundo.md §3). Los agentes no ven imágenes: se verifica el estado
// publicado en globalThis.window.__amigatos, los atributos del DOM y los
// píxeles del canvas del sprite.
const { test, expect } = require('@playwright/test');

// Este fichero se ejecuta en paralelo con los demás: el prefijo propio y la
// parte aleatoria evitan que dos pruebas registren el mismo nombre de usuario.
let counter = 0;
const uniqueName = () => `e2eface${Date.now().toString(36)}${counter++}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20);

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

// Convierte un punto lógico de la sala a píxeles del escenario y hace clic ahí.
async function clickLogical(page, lx, ly) {
  const box = await page.locator('#world-stage').boundingBox();
  if (!box) throw new Error('#world-stage no está visible');
  const px = Math.round((lx / 320) * box.width);
  const py = Math.round((ly / 200) * box.height);
  await page.locator('#world-stage').click({ position: { x: px, y: py } });
}

// La orientación que publica el cliente.
function facing(page) {
  return page.evaluate(() => {
    const w = globalThis.window.__amigatos;
    return w && w.me ? w.me.facing : null;
  });
}

test('el gato mira a la izquierda o a la derecha según el sentido de la marcha', async ({ page }) => {
  const errors = trackErrors(page);
  await registerAndCreateCat(page);

  await page.locator('#btn-explorar').click();
  await expect(visibleScreen(page)).toHaveAttribute('data-screen', 'world');
  await expect.poll(async () => (await facing(page)) ? (await facing(page)) : null).toBe('right');

  // 1. Caminar a la izquierda: el gato mira a la izquierda.
  await clickLogical(page, 20, 180);
  await expect.poll(async () => (await facing(page)) ? (await facing(page)) : null, { timeout: 15000 }).toBe('left');

  // 2. Invertir la dirección: el gato pasa a mirar a la derecha.
  await clickLogical(page, 130, 180);
  await expect.poll(async () => (await facing(page)) ? (await facing(page)) : null, { timeout: 15000 }).toBe('right');

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});

test('el gato cambia de orientación al invertir el sentido dentro del mismo camino', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/world-lab.html');

  // El gato camina a la derecha y luego da media vuelta: el camino va a la
  // derecha (100 → 160) y luego vuelve a la izquierda (160 → 120).
  await page.evaluate(() => globalThis.window.WorldUI.applyMoved({
    id: 1,
    x: 100,
    y: 180,
    facing: 'right',
    path: [{ x: 100, y: 180 }, { x: 160, y: 180 }, { x: 120, y: 180 }]
  }));

  // Al salir mira a la derecha...
  expect(await facing(page)).toBe('right');

  // ...y al dar la vuelta, a la izquierda.
  await expect.poll(async () => (await facing(page)) ? (await facing(page)) : null, { timeout: 15000 }).toBe('left');

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});

test('el sprite del gato se voltea al cambiar de orientación', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/world-lab.html');

  const r = await page.evaluate(() => {
    const W = 32;
    const el = globalThis.document.querySelector('.world-cat[data-player-id="1"]');
    const ctx = el.querySelector('canvas').getContext('2d');

    // 1. El volteo de CatArt es un espejo exacto del mismo cuadro.
    const cat = globalThis.CatArt.defaultCat();
    const normal = globalThis.CatArt._renderFrame(cat, 'idle', 1000, false);
    const volteado = globalThis.CatArt._renderFrame(cat, 'idle', 1000, true);
    let espejo = 0;
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const a = (y * W + x) * 4;
        const b = (y * W + (W - 1 - x)) * 4;
        if (volteado[a] !== normal[b] || volteado[a + 1] !== normal[b + 1] || volteado[a + 2] !== normal[b + 2]) espejo++;
      }
    }

    // 2. El mundo voltea el sprite del gato cuando cambia la orientación.
    //    Las dos capturas salen del mismo cuadro (t = 0), así que la única
    //    diferencia posible es el volteo.
    const captura = (dir) => {
      globalThis.window.WorldUI.applyMoved({
        id: 1,
        x: 100,
        y: 180,
        facing: dir,
        path: [{ x: 100, y: 180 }, { x: 100, y: 180 }]
      });
      return ctx.getImageData(0, 0, W, W).data;
    };
    const derecha = captura('right');
    const izquierda = captura('left');
    let distintos = 0;
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const a = (y * W + x) * 4;
        const b = (y * W + (W - 1 - x)) * 4;
        if (izquierda[a] !== derecha[b] || izquierda[a + 1] !== derecha[b + 1] || izquierda[a + 2] !== derecha[b + 2]) distintos++;
      }
    }

    return {
      espejo,
      distintos,
      facing: globalThis.window.__amigatos.me.facing,
      attr: el.getAttribute('data-facing')
    };
  });

  expect(r.espejo, 'el sprite volteado es el espejo del sprite normal').toBe(0);
  expect(r.distintos, 'el sprite del mundo está volteado').toBe(0);
  expect(r.facing).toBe('left');
  expect(r.attr).toBe('left');

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});

test('los gatos se ordenan por profundidad: el de mayor y se dibuja encima', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/world-lab.html');

  // Los dos gatos del laboratorio empiezan en la misma altura (y = 180).
  const inicio = await page.evaluate(() => {
    const z = (id) => globalThis.getComputedStyle(
      globalThis.document.querySelector(`.world-cat[data-player-id="${id}"]`)
    ).zIndex;
    return { uno: z('1'), dos: z('2') };
  });
  expect(inicio.uno).toBe('180');
  expect(inicio.dos).toBe('180');

  // El gato 2 sube: su y es menor, así que se dibuja debajo del gato 1.
  await page.evaluate(() => globalThis.window.WorldUI.applyMoved({ id: 2, x: 250, y: 120 }));

  const fin = await page.evaluate(() => {
    const z = (id) => globalThis.getComputedStyle(
      globalThis.document.querySelector(`.world-cat[data-player-id="${id}"]`)
    ).zIndex;
    const y = (id) => globalThis.window.__amigatos.players.find((p) => String(p.id) === id).y;
    return { uno: z('1'), dos: z('2'), yUno: y('1'), yDos: y('2') };
  });

  expect(fin.yDos).toBe(120);
  expect(Number(fin.dos), 'el gato de menor y tiene menor z-index').toBeLessThan(Number(fin.uno));
  expect(Number(fin.dos)).toBe(120);
  expect(Number(fin.uno)).toBe(180);

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});
