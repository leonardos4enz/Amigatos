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

    // 2. El mundo voltea el sprite del gato cuando cambia de orientación.
    //    Se congela el reloj para que las dos capturas salgan del mismo
    //    cuadro: así la única diferencia posible entre ellas es el volteo.
    const realNow = globalThis.performance.now.bind(globalThis.performance);
    globalThis.performance.now = () => 1000;
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
    globalThis.performance.now = realNow;

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

  // Tres gatos en la misma columna: el PROPIO (id 10) va primero en el DOM,
  // el otro (id 20) tiene mayor `y` y el tercero (id 30) menor `y` que el
  // propio. El orden de pintado lo decide la profundidad: el de mayor `y`
  // encima, sin importar el orden en el DOM ni que el gato sea "nuestro".
  await page.evaluate(() => {
    const cat = globalThis.CatArt.defaultCat();
    globalThis.window.WorldUI.applyState({
      room: { id: 'plaza', name: 'Plaza Bigotes', bg: 'plaza', width: 320, height: 200, walkable: [], exits: [] },
      players: [
        { id: 10, username: 'Michi', cat, x: 100, y: 170 },
        { id: 20, username: 'Nube', cat, x: 100, y: 180 },
        { id: 30, username: 'Pelusa', cat, x: 100, y: 160 }
      ],
      me: { id: 10, username: 'Michi', cat, x: 100, y: 170 }
    });
  });

  const r = await page.evaluate(() => {
    const gato = (id) => globalThis.document.querySelector(`.world-cat[data-player-id="${id}"]`);
    const propio = gato('10');
    const otro = gato('20');
    const tercero = gato('30');

    // Los gatos tienen que estar en la misma capa: si cada uno en la suya,
    // sus `z-index` no se comparan entre sí y el que esté en la última capa
    // siempre tapa a los demás.
    const mismaCapa = propio.parentElement === otro.parentElement &&
      propio.parentElement === tercero.parentElement;
    const z = (el) => globalThis.getComputedStyle(el).zIndex;

    // Para comprobar el orden REAL de pintado hay que poder tocar los gatos
    // (el mundo los pone con pointer-events: none para no estorbar al clic).
    [propio, otro, tercero].forEach((el) => { el.style.pointerEvents = 'auto'; });

    const stage = globalThis.document.getElementById('world-stage').getBoundingClientRect();
    const k = stage.width / 320;
    const css = (lx, ly) => ({ x: stage.left + lx * k, y: stage.top + ly * k });
    const caja = (el) => el.getBoundingClientRect();
    const dentro = (rect, p) => p.x >= rect.left && p.x <= rect.right &&
      p.y >= rect.top && p.y <= rect.bottom;

    // Punto 1: donde se solapan el propio (y = 170) y el tercero (y = 160),
    // sin el otro (y = 180): tiene que verse el propio.
    const p1 = css(100, 159);
    // Punto 2: donde se solapan el propio (y = 170) y el otro (y = 180), sin
    // el tercero (y = 160): tiene que verse el otro.
    const p2 = css(100, 181);

    // ¿Qué se ve en ese punto? El que está más abajo en la pantalla.
    const encima = (p) => {
      const el = globalThis.document.elementFromPoint(p.x, p.y);
      const g = el ? el.closest('.world-cat') : null;
      return g ? g.getAttribute('data-player-id') : null;
    };

    return {
      mismaCapa,
      zPropio: z(propio),
      zOtro: z(otro),
      zTercero: z(tercero),
      p1Ok: dentro(caja(propio), p1) && dentro(caja(tercero), p1) && !dentro(caja(otro), p1),
      p2Ok: dentro(caja(propio), p2) && dentro(caja(otro), p2) && !dentro(caja(tercero), p2),
      idEncima1: encima(p1),
      idEncima2: encima(p2)
    };
  });

  expect(r.p1Ok, 'el punto 1 está en el solape del propio y el tercero').toBe(true);
  expect(r.p2Ok, 'el punto 2 está en el solape del propio y el otro').toBe(true);
  expect(r.mismaCapa, 'los gatos comparten la misma capa (el mismo contexto de apilamiento)').toBe(true);
  expect(Number(r.zOtro), 'el gato de mayor y tiene mayor z-index').toBeGreaterThan(Number(r.zPropio));
  expect(Number(r.zPropio), 'el gato de mayor y tiene mayor z-index').toBeGreaterThan(Number(r.zTercero));
  // La prueba de verdad: en la zona de solape se ve el gato de mayor y.
  expect(r.idEncima1, 'encima se dibuja el gato de mayor y, aunque sea el primero del DOM').toBe('10');
  expect(r.idEncima2, 'encima se dibuja el gato de mayor y, aunque no sea el propio').toBe('20');

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});
