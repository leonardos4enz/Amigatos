'use strict';
// Pruebas del motor del mundo en el cliente (public/js/world.js).
// Los agentes no ven imágenes: se verifica el estado publicado en globalThis.window.__amigatos,
// las coordenadas lógicas que llegan al manejador de movimiento y los errores de consola.
const { test, expect } = require('@playwright/test');

// Falla el test si la página tira errores de JavaScript.
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  return errors;
}

// Tamaño del escenario del laboratorio (public/world-lab.html).
const STAGE_W = 640;
const STAGE_H = 480;

test('el laboratorio del mundo monta la plaza, traduce los clics y sigue al servidor', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/world-lab.html');

  // 1. Estado publicado: sala, sus dos salidas y los dos gatos.
  const info = await page.evaluate(() => ({
    room: globalThis.window.__amigatos.room,
    roomName: globalThis.window.__amigatos.roomName,
    roomWidth: globalThis.window.__amigatos.roomWidth,
    roomHeight: globalThis.window.__amigatos.roomHeight,
    exits: globalThis.window.__amigatos.exits.length,
    players: globalThis.window.__amigatos.players.length,
    me: globalThis.window.__amigatos.me
  }));
  expect(info.room).toBe('plaza');
  expect(info.roomName).toBe('Plaza Bigotes');
  expect(info.roomWidth).toBe(96);
  expect(info.roomHeight).toBe(72);
  expect(info.exits).toBe(2);
  expect(info.players).toBe(2);
  expect(info.me).toEqual({ x: 24, y: 20 });

  // 2. Clic en el piso → coordenadas lógicas (tolerancia de ±1 por el redondeo).
  const clickX = 160;
  const clickY = 120;
  await page.locator('#world-stage').click({ position: { x: clickX, y: clickY } });

  const moves = await page.evaluate(() => globalThis.window.__labMoves);
  expect(moves.length).toBe(1);
  const expectedX = Math.round((clickX / STAGE_W) * 96);
  const expectedY = Math.round((clickY / STAGE_H) * 72);
  expect(Math.abs(moves[0].x - expectedX)).toBeLessThanOrEqual(1);
  expect(Math.abs(moves[0].y - expectedY)).toBeLessThanOrEqual(1);

  // 3. El servidor manda: applyMoved mueve al gato y el estado publicado lo refleja.
  await page.evaluate(() => globalThis.window.WorldUI.applyMoved({ id: 2, x: 40, y: 30 }));
  const moved = await page.evaluate(() => globalThis.window.__amigatos.players.find((p) => p.id === 2));
  expect(moved.x).toBe(40);
  expect(moved.y).toBe(30);

  // 4. applyLeft saca al gato de la sala.
  await page.evaluate(() => globalThis.window.WorldUI.applyLeft({ id: 2 }));
  const left = await page.evaluate(() => globalThis.window.__amigatos.players.length);
  expect(left).toBe(1);

  expect(errors, `errores de JavaScript: ${errors.join(' | ')}`).toEqual([]);
});
