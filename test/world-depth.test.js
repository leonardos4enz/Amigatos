'use strict';
// Lógica pura del cliente del mundo (public/js/world.js): orientación del gato
// y profundidad (docs/mundo.md §3). Son funciones puras, así que se prueban sin
// navegador: `world.js` se puede cargar en Node.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const world = require('../public/js/world.js');

test('la orientación cambia al invertir el sentido de la marcha', () => {
  // Avance horizontal hacia la derecha: el gato mira a la derecha.
  assert.equal(world.facingFromStep(0.8, 'right'), 'right');
  assert.equal(world.facingFromStep(1, 'left'), 'right', 'el avance manda sobre la orientación anterior');

  // Hacia la izquierda: el gato mira a la izquierda.
  assert.equal(world.facingFromStep(-0.8, 'right'), 'left');
  assert.equal(world.facingFromStep(-1, 'left'), 'left');
});

test('un avance de un solo píxel ya cambia el sentido', () => {
  // 60 px lógicos por segundo a 60 fps: el avance por cuadro es de 1 px.
  // El cambio de sentido no puede depender de un umbral que lo retrase.
  assert.equal(world.facingFromStep(1, 'left'), 'right');
  assert.equal(world.facingFromStep(-1, 'right'), 'left');
});

test('caminar en vertical no cambia la orientación', () => {
  assert.equal(world.facingFromStep(0, 'left'), 'left');
  assert.equal(world.facingFromStep(0, 'right'), 'right');
});

test('el z-index sale de la y: el gato de más abajo se dibuja encima', () => {
  assert.equal(world.depthZ(180), 180);
  assert.equal(world.depthZ(120.4), 120);
  assert.equal(world.depthZ('90'), 90);
  assert.ok(world.depthZ(180) > world.depthZ(120), 'la y mayor tiene el z-index mayor');
});
