'use strict';
// Lógica pura del cliente del mundo (public/js/world.js): orientación del gato
// y profundidad (docs/mundo.md §3). Son funciones puras, así que se prueban sin
// navegador: `world.js` se puede cargar en Node.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const world = require('../public/js/world.js');

test('la orientación cambia al invertir el sentido de la marcha', () => {
  // Avance horizontal acumulado hacia la derecha: el gato mira a la derecha.
  let paso = world.facingFromStep(0, 0.8, 'right');
  assert.equal(paso.facing, 'right');
  paso = world.facingFromStep(paso.accX, 0.8, paso.facing);
  assert.equal(paso.facing, 'right');

  // Hacia la izquierda: el gato mira a la izquierda.
  paso = world.facingFromStep(0, -0.8, 'right');
  assert.equal(paso.facing, 'right', 'un píxel no basta para cambiar de sentido');
  paso = world.facingFromStep(paso.accX, -0.8, paso.facing);
  assert.equal(paso.facing, 'left');
  assert.equal(paso.accX, 0, 'al cambiar de sentido el acumulado vuelve a cero');
});

test('caminar en vertical no cambia la orientación', () => {
  let paso = world.facingFromStep(0, 0, 'left');
  for (let i = 0; i < 10; i++) paso = world.facingFromStep(paso.accX, 0, paso.facing);
  assert.equal(paso.facing, 'left');
});

test('el z-index sale de la y: el gato de más abajo se dibuja encima', () => {
  assert.equal(world.depthZ(180), 180);
  assert.equal(world.depthZ(120.4), 120);
  assert.equal(world.depthZ('90'), 90);
  assert.ok(world.depthZ(180) > world.depthZ(120), 'la y mayor tiene el z-index mayor');
});

test('byDepth ordena los gatos de arriba abajo sin tocar la lista original', () => {
  const gatos = [{ id: 1, y: 180 }, { id: 2, y: 120 }, { id: 3, y: 150 }];
  const orden = world.byDepth(gatos);
  assert.deepEqual(orden.map((g) => g.id), [2, 3, 1]);
  assert.deepEqual(gatos.map((g) => g.id), [1, 2, 3], 'la lista original no se ordena');
  // El último del orden es el que se dibuja encima: su z-index es el mayor.
  const ultimo = orden[orden.length - 1];
  const primero = orden[0];
  assert.ok(world.depthZ(ultimo.y) > world.depthZ(primero.y));
});
