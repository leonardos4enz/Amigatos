'use strict';
// Pruebas del fondo del Parque Ronroneo (pixel art procedural a 320x200).
// Los agentes NO ven imágenes: se comprueban los píxeles del canvas, la geometría que
// usa el servidor (server/world.js) y que la escena se dibuja a su ancho nativo.
const { test, expect } = require('@playwright/test');
const { ROOMS } = require('../server/world');

const W = 320;
const H = 200;
// Punto de cielo: arriba del todo, donde la escena no dibuja nada.
const SKY = { x: 160, y: 8 };
// El estanque no se puede pisar (server/world.js): tiene que verse como agua.
const POND = { x0: 100, x1: 220, y0: 145, y1: 199, cx: 160, cy: 175 };

// Falla el test si la página tira errores de JavaScript.
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  return errors;
}

// Centro de un polígono (el promedio de sus vértices: los del parque son rectángulos).
function centerOf(poly) {
  let sx = 0;
  let sy = 0;
  for (const p of poly) {
    sx += p.x;
    sy += p.y;
  }
  return { x: Math.round(sx / poly.length), y: Math.round(sy / poly.length) };
}

// ¿El pixel es de césped (verde dominante)?
function isGrass(px) {
  return px[1] > px[0] && px[1] > px[2];
}

test('el fondo del parque se pinta a 320x200 y su piso caminable no es cielo', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');

  // 1. La escena declara su ancho nativo (320) y usa las utilidades compartidas.
  const src = await (await page.request.get('/js/bg/rooms/parque.js')).text();
  expect(src, 'la escena no declara su ancho nativo').toMatch(/NATIVE_W\s*=\s*320/);
  expect(src, 'la escena no usa las utilidades compartidas').toContain('window.CatBGPixels');
  expect(src, 'la escena no se registra').toContain('CatBG.register');

  // 2. Se pinta a 320x200 (sin escalado) y produce contenido.
  const centers = ROOMS.parque.walkable.map(centerOf);
  const shot = await page.evaluate(({ w, h, sky, centers, pond }) => {
    const cv = globalThis.document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    globalThis.window.CatBG.paint(cv, 'parque', 0);
    const ctx = cv.getContext('2d');
    const at = (x, y) => {
      const d = ctx.getImageData(x, y, 1, 1).data;
      return [d[0], d[1], d[2], d[3]];
    };
    const colors = new Set();
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let i = 0; i < data.length; i += 4) {
      colors.add('#' + [data[i], data[i + 1], data[i + 2]]
        .map((n) => n.toString(16).padStart(2, '0')).join(''));
    }
    return {
      url: cv.toDataURL(),
      colors: [...colors],
      sky: at(sky.x, sky.y),
      ground: centers.map((c) => at(c.x, c.y)),
      pondMiddle: at(pond.cx, pond.cy),
      pondLeft: at(pond.x0, pond.cy),
      pondRight: at(pond.x1, pond.cy),
      outsideLeft: at(pond.x0 - 1, pond.cy),
      outsideRight: at(pond.x1 + 1, pond.cy),
      abovePond: at(pond.cx, pond.y0 - 1),
      belowPond: at(pond.cx, pond.y0),
      pondBottom: at(pond.cx, pond.y1),
    };
  }, { w: W, h: H, sky: SKY, centers, pond: POND });

  expect(shot.url.length, 'el fondo del parque no dibuja nada').toBeGreaterThan(500);

  // 3. El cielo es cielo de verdad (azul arriba): si no, la comparación de abajo no vale.
  expect(shot.sky[2], `el punto de cielo ${SKY.x},${SKY.y} no es azul`).toBeGreaterThan(shot.sky[0]);

  // 4. El centro de cada polígono caminable se ve distinto del cielo.
  for (let i = 0; i < centers.length; i++) {
    const c = centers[i];
    expect(shot.ground[i], `el centro del polígono ${JSON.stringify(c)} se ve como el cielo`)
      .not.toEqual(shot.sky);
    expect(shot.ground[i][2], `el centro del polígono ${JSON.stringify(c)} es azul como el cielo`)
      .toBeLessThanOrEqual(shot.ground[i][0]);
  }

  // 5. El estanque está dibujado donde el servidor dice que no se puede pisar.
  expect(shot.pondMiddle, 'el estanque no está dibujado en su sitio').not.toEqual(shot.sky);
  expect(shot.pondLeft, 'el borde izquierdo del estanque no cuadra').toEqual(shot.pondMiddle);
  expect(shot.pondRight, 'el borde derecho del estanque no cuadra').toEqual(shot.pondMiddle);
  expect(shot.outsideLeft, 'a la izquierda del estanque no hay césped').not.toEqual(shot.pondMiddle);
  expect(shot.outsideRight, 'a la derecha del estanque no hay césped').not.toEqual(shot.pondMiddle);
  // justo encima del estanque hay césped caminable; el estanque ya no empieza más arriba.
  expect(isGrass(shot.abovePond), 'encima del estanque no hay césped').toBe(true);
  expect(isGrass(shot.belowPond), 'el estanque no empieza en su borde superior').toBe(false);
  // el estanque llega hasta el borde de abajo de la sala (y=199)
  expect(shot.pondBottom[2], 'el estanque no llega al final de la sala').toBeGreaterThan(shot.pondBottom[0]);

  // 6. La escena conserva su identidad: sol, columpios y estanque están pintados.
  for (const color of ['#ffe89a', '#e0637f', '#3f86bd']) {
    expect(shot.colors, `el fondo del parque no tiene el color ${color}`).toContain(color);
  }

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});
