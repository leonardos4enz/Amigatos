'use strict';
// Los demás jugadores caminan como el propio (docs/mundo.md §3): al recibir
// `world:moved` con su ruta, el cliente los interpola desde la posición
// renderizada actual a 60 px lógicos por segundo, con la animación `walk`
// mientras caminan y `idle` al llegar. Nunca aparecen de golpe en el destino.
//
// La primera prueba usa dos navegadores (dos cuentas): uno camina y el otro lo
// ve. La segunda usa el laboratorio del mundo (public/world-lab.html) para
// comprobar, sin red y sin esperas, que el gato sigue la ruta desde donde
// está dibujado.
const { test, expect } = require('@playwright/test');

// Este fichero se ejecuta en paralelo con los demás: el prefijo propio y la
// parte aleatoria evitan que dos pruebas registren el mismo nombre de usuario.
let counter = 0;
const uniqueName = () => `e2eoth${Date.now().toString(36)}${counter++}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20);

// Falla el test si la página tira errores de JavaScript.
function trackErrors(page, errors) {
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

// Estado del mundo que publica el cliente (window.__amigatos).
async function worldState(page) {
  return page.evaluate(() => {
    const w = globalThis.window.__amigatos;
    if (!w) return null;
    return {
      room: w.room,
      roomWidth: w.roomWidth,
      roomHeight: w.roomHeight,
      me: w.me ? { x: w.me.x, y: w.me.y, anim: w.me.anim } : null,
      players: w.players.map((p) => ({
        id: String(p.id), username: p.username, x: p.x, y: p.y,
        anim: p.anim, facing: p.facing, target: p.target
      }))
    };
  });
}

// Como worldState, pero falla con un mensaje claro si el mundo no está montado.
async function requireWorldState(page) {
  const w = await worldState(page);
  if (!w) throw new Error('la página no ha publicado window.__amigatos');
  return w;
}

// El id (como texto) del gato con ese nombre en la lista de la página.
async function idOf(page, username) {
  const w = await worldState(page);
  if (!w) return null;
  const found = w.players.find((p) => p.username === username);
  return found ? found.id : null;
}

// Abre la pantalla del mundo y espera a que el servidor mande la sala.
async function explore(page, room) {
  await expect(page.locator('#player-list .player').first()).toBeVisible();
  await page.locator('#btn-explorar').click();
  await expect(visibleScreen(page)).toHaveAttribute('data-screen', 'world');
  await expect.poll(async () => {
    const w = await worldState(page);
    return w && w.me ? w.room : null;
  }, { timeout: 15000 }).toBe(room);
}

// Convierte un punto lógico de la sala a píxeles del escenario y hace clic ahí.
async function clickLogical(page, lx, ly) {
  const w = await requireWorldState(page);
  const box = await page.locator('#world-stage').boundingBox();
  if (!box) throw new Error('#world-stage no está visible');
  const px = Math.round((lx / w.roomWidth) * box.width);
  const py = Math.round((ly / w.roomHeight) * box.height);
  await page.locator('#world-stage').click({ position: { x: px, y: py } });
}

// Un vigilante dentro de la página anota la posición de un gato en cada cuadro:
// así la progresión se mide dentro del navegador que lo ve, no fuera.
async function watchPlayer(page, username) {
  await page.evaluate((name) => {
    globalThis.__watch = { name: name, samples: [] };
    const tick = () => {
      const w = globalThis.window.__amigatos;
      if (w) {
        const p = w.players.find((q) => q.username === name);
        if (p) {
          globalThis.__watch.samples.push({
            x: p.x, y: p.y, anim: p.anim, facing: p.facing,
            t: globalThis.performance.now()
          });
        }
      }
      globalThis.requestAnimationFrame(tick);
    };
    globalThis.requestAnimationFrame(tick);
  }, username);
}

// Las muestras del gato vigilado.
async function samplesOf(page) {
  return page.evaluate(() => globalThis.__watch.samples);
}

test('en el otro navegador el gato camina poco a poco, con walk y luego idle', async ({ browser }) => {
  test.setTimeout(90000);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  // Un solo array para las dos páginas: los errores de cualquiera de las dos
  // se acumulan aquí hasta el final del test.
  const errors = trackErrors(pageA, trackErrors(pageB, []));

  try {
    const nameA = await registerAndCreateCat(pageA);
    const nameB = await registerAndCreateCat(pageB);

    // 1. Las dos entran al mundo: el servidor las pone en la plaza.
    await explore(pageA, 'plaza');
    await explore(pageB, 'plaza');
    await expect.poll(() => idOf(pageB, nameA)).not.toBeNull();
    // B también se ve a sí mismo en la sala.
    await expect.poll(() => idOf(pageB, nameB)).not.toBeNull();

    // 2. B empieza a vigilar a A (cada cuadro anota su posición).
    await watchPlayer(pageB, nameA);

    // 3. A camina hacia la izquierda (los adoquines de la izquierda de la fuente).
    const destino = { x: 20, y: 180 };
    await clickLogical(pageA, destino.x, destino.y);

    // 4. En B, A camina: la posición cambia de forma progresiva y la animación
    //    pasa por `walk` antes de volver a `idle`.
    await expect.poll(async () => {
      const muestras = await samplesOf(pageB);
      return muestras.some((s) => s.anim === 'walk');
    }, { timeout: 15000 }).toBe(true);

    await expect.poll(async () => {
      const muestras = await samplesOf(pageB);
      const andando = muestras.filter((s) => s.anim === 'walk');
      const quieto = muestras.filter((s) => s.anim === 'idle');
      return quieto.length > 0 && quieto[quieto.length - 1].t > (andando[andando.length - 1] || { t: 0 }).t;
    }, { timeout: 20000 }).toBe(true);

    const muestras = await samplesOf(pageB);
    const quieto = muestras.filter((s) => s.anim === 'idle');
    const final = quieto[quieto.length - 1];

    // 5. La posición se mueve por pasos: al menos tres valores intermedios
    //    distintos, y no aparece de golpe en el destino.
    const distintas = new Set(muestras.map((s) => `${Math.round(s.x * 10)},${Math.round(s.y * 10)}`));
    expect(distintas.size, 'la posición de A cambia de forma progresiva en B')
      .toBeGreaterThanOrEqual(4);

    // Y ningún salto grande entre dos cuadros: el gato no se teletransporta.
    const distancia = Math.hypot(destino.x - muestras[0].x, destino.y - muestras[0].y);
    for (let i = 1; i < muestras.length; i++) {
      const salto = Math.hypot(muestras[i].x - muestras[i - 1].x, muestras[i].y - muestras[i - 1].y);
      expect(salto, `A no aparece de golpe entre dos cuadros (${salto.toFixed(1)} px)`)
        .toBeLessThan(distancia / 2);
    }

    // 6. Al final A está en el destino de A (±1 por el redondeo) y quieto.
    expect(Math.abs(final.x - destino.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(final.y - destino.y)).toBeLessThanOrEqual(1);

    // 7. La orientación de A en B coincide con el sentido de su marcha: A camina
    //    hacia la izquierda, así que mira a la izquierda mientras camina.
    const andando = muestras.filter((s) => s.anim === 'walk');
    const pasos = [];
    for (let i = 1; i < andando.length; i++) {
      const dx = andando[i].x - andando[i - 1].x;
      if (Math.abs(dx) > 0.01) pasos.push({ dx: dx, facing: andando[i].facing });
    }
    expect(pasos.length, 'A avanza horizontalmente mientras camina').toBeGreaterThan(0);
    for (const paso of pasos) {
      expect(paso.facing, `A mira hacia donde camina (paso ${paso.dx.toFixed(2)})`)
        .toBe(paso.dx < 0 ? 'left' : 'right');
    }

    expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

// En el laboratorio del mundo: cuando el servidor manda una ruta, el gato
// sigue desde donde está DIBUJADO. No salta a la posición que dice el
// servidor: la caminata continúa donde estaba (docs/mundo.md §3).
test('el gato sigue la ruta desde donde está dibujado, sin saltar de sitio', async ({ page }) => {
  const errors = trackErrors(page, []);
  await page.goto('/world-lab.html');

  // Nube (el gato de otro jugador de la plaza) empieza a caminar a la izquierda.
  await page.evaluate(() => globalThis.window.WorldUI.applyMoved({
    id: 2,
    x: 250,
    y: 180,
    facing: 'left',
    path: [{ x: 250, y: 180 }, { x: 150, y: 180 }]
  }));

  const r = await page.evaluate(async () => {
    const esperar = (ms) => new Promise((res) => setTimeout(res, ms));
    // Deja que el gato ande un poco (a 60 px lógicos por segundo).
    await esperar(120);
    const gato = () => globalThis.window.__amigatos.players.find((p) => p.id === 2);
    const antes = { x: gato().x, y: gato().y, anim: gato().anim };
    // El servidor manda la misma ruta con la posición del servidor (250): el
    // gato dibujado ya va por esa ruta, así que sigue donde está.
    globalThis.window.WorldUI.applyMoved({
      id: 2,
      x: 250,
      y: 180,
      facing: 'left',
      path: [{ x: 250, y: 180 }, { x: 150, y: 180 }]
    });
    const despues = { x: gato().x, y: gato().y, anim: gato().anim };
    return { antes, despues };
  });

  // El gato estaba caminando (la animación es `walk`).
  expect(r.antes.anim, 'el gato de otro jugador camina con la animación walk').toBe('walk');
  // Y al llegar la ruta no salta a la posición del servidor (250): sigue
  // desde donde estaba dibujado.
  expect(r.despues.x, 'el gato no salta a la posición del servidor')
    .toBeLessThan(249);
  expect(Math.abs(r.despues.x - r.antes.x), 'el gato sigue donde estaba dibujado')
    .toBeLessThan(3);

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});
