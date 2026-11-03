'use strict';
// La caminata del gato propio: recorre la ruta que manda el servidor a 60 px
// lógicos por segundo, con la animación `walk` mientras camina y `idle` al
// llegar (docs/mundo.md §3).
// Los agentes no ven imágenes: se mide el estado publicado en
// globalThis.window.__amigatos desde dentro de la página.
const { test, expect } = require('@playwright/test');

// Este fichero se ejecuta en paralelo con los demás: el prefijo propio y la
// parte aleatoria evitan que dos pruebas registren el mismo nombre de usuario.
let counter = 0;
const uniqueName = () => `e2ewalk${Date.now().toString(36)}${counter++}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20);

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

// Estado del gato propio que publica el cliente (o null si no hay mundo).
function me(page) {
  return page.evaluate(() => {
    const w = globalThis.window.__amigatos;
    return w && w.me ? { x: w.me.x, y: w.me.y, target: w.me.target, anim: w.me.anim } : null;
  });
}

// Convierte un punto lógico de la sala a píxeles del escenario y hace clic ahí.
async function clickLogical(page, lx, ly) {
  const box = await page.locator('#world-stage').boundingBox();
  if (!box) throw new Error('#world-stage no está visible');
  const px = Math.round((lx / 320) * box.width);
  const py = Math.round((ly / 200) * box.height);
  await page.locator('#world-stage').click({ position: { x: px, y: py } });
}

test('el gato camina a 60 px lógicos por segundo y al llegar vuelve a idle', async ({ page }) => {
  const errors = trackErrors(page);
  await registerAndCreateCat(page);

  // 1. Entra al mundo: el gato aparece en el spawn de la plaza, quieto.
  await page.locator('#btn-explorar').click();
  await expect(visibleScreen(page)).toHaveAttribute('data-screen', 'world');
  await expect.poll(async () => (await me(page)) ? (await me(page)).anim : null).toBe('idle');
  const quieto = await me(page);
  expect(quieto.target, 'en reposo el gato no tiene destino').toBeNull();

  // 2. Un vigilante dentro de la página anota cada cambio de animación con su
  //    instante: así el tiempo de la caminata se mide en la página, no fuera.
  await page.evaluate(() => {
    globalThis.__animLog = [];
    let last = null;
    const tick = () => {
      const me = globalThis.window.__amigatos && globalThis.window.__amigatos.me;
      const anim = me ? me.anim : null;
      if (anim && anim !== last) {
        globalThis.__animLog.push({
          anim: anim,
          t: performance.now(),
          x: me.x,
          y: me.y,
          target: me.target ? { x: me.target.x, y: me.target.y } : null
        });
        last = anim;
      }
      globalThis.requestAnimationFrame(tick);
    };
    globalThis.requestAnimationFrame(tick);
  });

  // 3. Un clic en un punto lejano del piso: los adoquines de la izquierda.
  const destino = { x: 20, y: 180 };
  const inicio = await me(page);
  await clickLogical(page, destino.x, destino.y);

  // 4. Mientras camina: la animación es `walk` y el destino está publicado.
  await expect.poll(async () => (await me(page)) ? (await me(page)).anim : null, { timeout: 15000 }).toBe('walk');
  const andando = await me(page);
  expect(andando.anim).toBe('walk');
  expect(andando.target, 'mientras camina el gato tiene destino').not.toBeNull();
  expect(Math.abs(andando.target.x - destino.x), 'el destino es el punto del clic').toBeLessThanOrEqual(1);
  expect(Math.abs(andando.target.y - destino.y), 'el destino es el punto del clic').toBeLessThanOrEqual(1);

  // 5. Al llegar: la animación vuelve a `idle` y el destino desaparece.
  await expect.poll(async () => (await me(page)) ? (await me(page)).anim : null, { timeout: 15000 }).toBe('idle');
  const llegada = await me(page);
  expect(llegada.target, 'al llegar el gato no tiene destino').toBeNull();
  expect(Math.abs(llegada.x - destino.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(llegada.y - destino.y)).toBeLessThanOrEqual(1);

  // 6. El tiempo de la caminata: entre 0.75 y 1.25 × (distancia lógica ÷ 60).
  const log = await page.evaluate(() => globalThis.__animLog);
  const empieza = log.find((e) => e.anim === 'walk');
  const termina = log.find((e) => e.anim === 'idle' && empieza && e.t > empieza.t);
  expect(empieza, 'el gato debería ponerse a caminar').toBeTruthy();
  expect(termina, 'el gato debería dejar de caminar').toBeTruthy();
  expect(empieza.target, 'mientras camina el gato tiene destino').not.toBeNull();

  const distancia = Math.hypot(llegada.x - inicio.x, llegada.y - inicio.y);
  const esperado = distancia / 60;
  const medido = (termina.t - empieza.t) / 1000;
  expect(medido / esperado, 'el gato debería caminar a 60 px lógicos por segundo')
    .toBeGreaterThan(0.75);
  expect(medido / esperado, 'el gato debería caminar a 60 px lógicos por segundo')
    .toBeLessThan(1.25);

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});
