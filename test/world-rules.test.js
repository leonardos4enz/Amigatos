'use strict';
// Tests de las reglas puras del mundo (server/world.js). No necesitan servidor.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const world = require('../server/world');

const { ROOMS, isValidRoom, getRoom, isInsideRoom, clampToRoom, exitAt, allowMove } = world;

// ------------------------------------------------------------------
// catálogo
// ------------------------------------------------------------------

test('ROOMS tiene exactamente las 3 salas del mundo', () => {
  assert.deepEqual(Object.keys(ROOMS).sort(), ['cafe', 'parque', 'plaza']);
});

test('plaza: nombre, fondo, tamaño, spawn y salidas', () => {
  const plaza = ROOMS.plaza;
  assert.equal(plaza.id, 'plaza');
  assert.equal(plaza.name, 'Plaza Bigotes');
  assert.equal(plaza.bg, 'plaza');
  assert.equal(plaza.width, 96);
  assert.equal(plaza.height, 72);
  assert.deepEqual(plaza.spawn, { x: 48, y: 60 });
  assert.equal(plaza.exits.length, 2);

  const aParque = plaza.exits.find((e) => e.to === 'parque');
  assert.deepEqual(
    { x: aParque.x, y: aParque.y, w: aParque.w, h: aParque.h },
    { x: 0, y: 30, w: 8, h: 14 }
  );
  assert.deepEqual(aParque.toSpawn, { x: 84, y: 56 });
  assert.equal(aParque.label, 'Parque Ronroneo');

  const aCafe = plaza.exits.find((e) => e.to === 'cafe');
  assert.deepEqual(
    { x: aCafe.x, y: aCafe.y, w: aCafe.w, h: aCafe.h },
    { x: 88, y: 30, w: 8, h: 14 }
  );
  assert.deepEqual(aCafe.toSpawn, { x: 12, y: 56 });
  assert.equal(aCafe.label, 'Café del Ovillo');
});

test('parque: nombre, fondo, tamaño, spawn y salida', () => {
  const parque = ROOMS.parque;
  assert.equal(parque.id, 'parque');
  assert.equal(parque.name, 'Parque Ronroneo');
  assert.equal(parque.bg, 'parque');
  assert.equal(parque.width, 96);
  assert.equal(parque.height, 72);
  assert.deepEqual(parque.spawn, { x: 48, y: 60 });
  assert.equal(parque.exits.length, 1);

  const salida = parque.exits[0];
  assert.deepEqual(
    { x: salida.x, y: salida.y, w: salida.w, h: salida.h },
    { x: 88, y: 30, w: 8, h: 14 }
  );
  assert.equal(salida.to, 'plaza');
  assert.deepEqual(salida.toSpawn, { x: 12, y: 37 });
  assert.equal(salida.label, 'Plaza Bigotes');
});

test('cafe: nombre, fondo, tamaño, spawn y salida', () => {
  const cafe = ROOMS.cafe;
  assert.equal(cafe.id, 'cafe');
  assert.equal(cafe.name, 'Café del Ovillo');
  assert.equal(cafe.bg, 'cafe');
  assert.equal(cafe.width, 96);
  assert.equal(cafe.height, 72);
  assert.deepEqual(cafe.spawn, { x: 48, y: 58 });
  assert.equal(cafe.exits.length, 1);

  const salida = cafe.exits[0];
  assert.deepEqual(
    { x: salida.x, y: salida.y, w: salida.w, h: salida.h },
    { x: 0, y: 30, w: 8, h: 14 }
  );
  assert.equal(salida.to, 'plaza');
  assert.deepEqual(salida.toSpawn, { x: 84, y: 37 });
  assert.equal(salida.label, 'Plaza Bigotes');
});

// ------------------------------------------------------------------
// salas válidas
// ------------------------------------------------------------------

test('isValidRoom y getRoom solo aceptan ids del catálogo', () => {
  assert.equal(isValidRoom('plaza'), true);
  assert.equal(isValidRoom('parque'), true);
  assert.equal(isValidRoom('cafe'), true);
  assert.equal(isValidRoom('nope'), false);
  assert.equal(isValidRoom(''), false);
  assert.equal(isValidRoom(undefined), false);

  assert.equal(getRoom('plaza'), ROOMS.plaza);
  assert.equal(getRoom('nope'), null);
});

// ------------------------------------------------------------------
// límites
// ------------------------------------------------------------------

test('isInsideRoom respeta los bordes de la sala', () => {
  const plaza = getRoom('plaza');
  assert.equal(isInsideRoom(plaza, 0, 0), true);
  assert.equal(isInsideRoom(plaza, 96, 72), true);
  assert.equal(isInsideRoom(plaza, 48, 60), true);
  assert.equal(isInsideRoom(plaza, -1, 0), false);
  assert.equal(isInsideRoom(plaza, 97, 0), false);
  assert.equal(isInsideRoom(plaza, 0, -1), false);
  assert.equal(isInsideRoom(plaza, 0, 73), false);
});

test('clampToRoom deja el punto dentro de la sala', () => {
  const plaza = getRoom('plaza');
  assert.deepEqual(clampToRoom(plaza, -5, -3), { x: 0, y: 0 });
  assert.deepEqual(clampToRoom(plaza, 200, 300), { x: 96, y: 72 });
  assert.deepEqual(clampToRoom(plaza, 48, 60), { x: 48, y: 60 });
  const dentro = clampToRoom(plaza, 120, -4);
  assert.ok(isInsideRoom(plaza, dentro.x, dentro.y));
});

// ------------------------------------------------------------------
// salidas
// ------------------------------------------------------------------

test('exitAt devuelve la salida que contiene el punto', () => {
  const plaza = getRoom('plaza');
  const aParque = exitAt(plaza, 4, 37);
  assert.ok(aParque);
  assert.equal(aParque.to, 'parque');

  const aCafe = exitAt(plaza, 92, 37);
  assert.ok(aCafe);
  assert.equal(aCafe.to, 'cafe');

  assert.equal(exitAt(plaza, 48, 60), null);
  assert.equal(exitAt(plaza, 4, 10), null);
  assert.equal(exitAt(getRoom('parque'), 4, 37), null);
});

// ------------------------------------------------------------------
// regla anti-bucle
// ------------------------------------------------------------------

test('ningún spawn ni toSpawn cae dentro de una salida de la sala destino', () => {
  for (const room of Object.values(ROOMS)) {
    for (const exit of room.exits) {
      const destino = getRoom(exit.to);
      assert.ok(destino, `la salida de "${room.id}" apunta a "${exit.to}"`);
      for (const salidaDestino of destino.exits) {
        const dentro = exit.toSpawn.x >= salidaDestino.x
          && exit.toSpawn.x < salidaDestino.x + salidaDestino.w
          && exit.toSpawn.y >= salidaDestino.y
          && exit.toSpawn.y < salidaDestino.y + salidaDestino.h;
        assert.equal(
          dentro,
          false,
          `toSpawn de "${room.id}"→"${exit.to}" cae dentro de una salida de "${exit.to}"`
        );
      }
    }
  }
});

test('el spawn de cada sala no cae dentro de una salida de esa misma sala', () => {
  for (const room of Object.values(ROOMS)) {
    for (const salida of room.exits) {
      const dentro = room.spawn.x >= salida.x
        && room.spawn.x < salida.x + salida.w
        && room.spawn.y >= salida.y
        && room.spawn.y < salida.y + salida.h;
      assert.equal(dentro, false, `spawn de "${room.id}" cae dentro de su salida`);
    }
  }
});

test('validateRooms no reporta problemas en el catálogo', () => {
  assert.deepEqual(world.validateRooms(), []);
});

// ------------------------------------------------------------------
// anti-abuso: ventana deslizante
// ------------------------------------------------------------------

test('allowMove permite 12 movimientos dentro de 1 s y rechaza el 13.º', () => {
  let times = [];
  for (let i = 0; i < 12; i++) {
    const res = allowMove(times, 1000 + i * 10, {});
    assert.equal(res.allowed, true, `movimiento ${i + 1} debería estar permitido`);
    times = res.times;
  }
  assert.equal(times.length, 12);

  const res = allowMove(times, 1000 + 12 * 10, {});
  assert.equal(res.allowed, false);
  assert.equal(res.times.length, 12);
});

test('allowMove vuelve a permitir cuando pasa la ventana', () => {
  let times = [];
  for (let i = 0; i < 12; i++) {
    times = allowMove(times, 1000 + i * 10, {}).times;
  }
  assert.equal(allowMove(times, 1000 + 12 * 10, {}).allowed, false);

  // 2 segundos después: las marcas viejas salen de la ventana.
  const res = allowMove(times, 3000, {});
  assert.equal(res.allowed, true);
  assert.deepEqual(res.times, [3000]);
});

test('allowMove filtra las marcas fuera de la ventana', () => {
  const res = allowMove([0, 100, 900], 1500, {});
  assert.equal(res.allowed, true);
  assert.deepEqual(res.times, [900, 1500]);
});

test('allowMove acepta opciones propias (ventana y máximo)', () => {
  let times = [];
  for (let i = 0; i < 3; i++) {
    const res = allowMove(times, 500 + i * 10, { windowMs: 100, max: 3 });
    assert.equal(res.allowed, true);
    times = res.times;
  }
  assert.equal(allowMove(times, 530, { windowMs: 100, max: 3 }).allowed, false);
});
