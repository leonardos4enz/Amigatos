'use strict';
// Tests de las reglas puras del mundo (server/world.js). No necesitan servidor.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const world = require('../server/world');

const {
  ROOMS,
  SPEED,
  isValidRoom,
  getRoom,
  addRoom,
  removeRoom,
  isInsideRoom,
  clampToRoom,
  exitAt,
  isWalkable,
  nearestWalkable,
  walkablePolygons,
  findPath,
  pathIsWalkable,
  pathLength,
  pointAlongPath,
  pathFacing,
  segmentWalkable,
  exitThreshold,
  allowMove,
} = world;

// ------------------------------------------------------------------
// catálogo
// ------------------------------------------------------------------

test('ROOMS tiene exactamente las 3 salas del mundo', () => {
  assert.deepEqual(Object.keys(ROOMS).sort(), ['cafe', 'parque', 'plaza']);
});

test('las tres salas miden 320×200', () => {
  for (const room of Object.values(ROOMS)) {
    assert.equal(room.width, 320, `ancho de "${room.id}"`);
    assert.equal(room.height, 200, `alto de "${room.id}"`);
  }
});

test('plaza: nombre, fondo, tamaño, spawn y salidas', () => {
  const plaza = ROOMS.plaza;
  assert.equal(plaza.id, 'plaza');
  assert.equal(plaza.name, 'Plaza Bigotes');
  assert.equal(plaza.bg, 'plaza');
  assert.equal(plaza.width, 320);
  assert.equal(plaza.height, 200);
  assert.deepEqual(plaza.spawn, { x: 100, y: 180 });
  assert.equal(plaza.exits.length, 2);

  const aParque = plaza.exits.find((e) => e.to === 'parque');
  assert.deepEqual(
    { x: aParque.x, y: aParque.y, w: aParque.w, h: aParque.h },
    { x: 0, y: 130, w: 16, h: 40 }
  );
  assert.deepEqual(aParque.toSpawn, { x: 290, y: 180 });
  assert.equal(aParque.label, 'Parque Ronroneo');

  const aCafe = plaza.exits.find((e) => e.to === 'cafe');
  assert.deepEqual(
    { x: aCafe.x, y: aCafe.y, w: aCafe.w, h: aCafe.h },
    { x: 304, y: 130, w: 16, h: 40 }
  );
  assert.deepEqual(aCafe.toSpawn, { x: 30, y: 180 });
  assert.equal(aCafe.label, 'Café del Ovillo');
});

test('parque: nombre, fondo, tamaño, spawn y salida', () => {
  const parque = ROOMS.parque;
  assert.equal(parque.id, 'parque');
  assert.equal(parque.name, 'Parque Ronroneo');
  assert.equal(parque.bg, 'parque');
  assert.equal(parque.width, 320);
  assert.equal(parque.height, 200);
  assert.deepEqual(parque.spawn, { x: 240, y: 180 });
  assert.equal(parque.exits.length, 1);

  const salida = parque.exits[0];
  assert.deepEqual(
    { x: salida.x, y: salida.y, w: salida.w, h: salida.h },
    { x: 304, y: 130, w: 16, h: 40 }
  );
  assert.equal(salida.to, 'plaza');
  assert.deepEqual(salida.toSpawn, { x: 30, y: 180 });
  assert.equal(salida.label, 'Plaza Bigotes');
});

test('cafe: nombre, fondo, tamaño, spawn y salida', () => {
  const cafe = ROOMS.cafe;
  assert.equal(cafe.id, 'cafe');
  assert.equal(cafe.name, 'Café del Ovillo');
  assert.equal(cafe.bg, 'cafe');
  assert.equal(cafe.width, 320);
  assert.equal(cafe.height, 200);
  assert.deepEqual(cafe.spawn, { x: 200, y: 180 });
  assert.equal(cafe.exits.length, 1);

  const salida = cafe.exits[0];
  assert.deepEqual(
    { x: salida.x, y: salida.y, w: salida.w, h: salida.h },
    { x: 0, y: 130, w: 16, h: 40 }
  );
  assert.equal(salida.to, 'plaza');
  assert.deepEqual(salida.toSpawn, { x: 290, y: 180 });
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

test('addRoom registra una sala aislada y removeRoom la quita', () => {
  const sala = salaDePrueba([rect(0, 110, 320, 200)], { id: 'salaAislada' });
  addRoom(sala);
  try {
    assert.equal(getRoom('salaAislada'), sala);
    assert.equal(isValidRoom('salaAislada'), true);
    assert.deepEqual(walkablePolygons(getRoom('salaAislada')), sala.walkable);
  } finally {
    removeRoom('salaAislada');
  }
  assert.equal(getRoom('salaAislada'), null);
  assert.equal(isValidRoom('salaAislada'), false);
});

test('addRoom no registra una sala con la geometría rota', () => {
  const mala = {
    id: 'salaRota',
    name: 'Sala rota',
    bg: 'plaza',
    width: 320,
    height: 200,
    spawn: { x: 160, y: 10 }, // en el cielo: no es caminable
    walkable: [rect(0, 110, 320, 200)],
    exits: [],
  };
  assert.throws(() => addRoom(mala), /Geometría del mundo inválida/);
  assert.equal(getRoom('salaRota'), null);
});

// ------------------------------------------------------------------
// límites
// ------------------------------------------------------------------

test('isInsideRoom respeta los bordes de la sala', () => {
  const plaza = getRoom('plaza');
  assert.equal(isInsideRoom(plaza, 0, 0), true);
  assert.equal(isInsideRoom(plaza, 320, 200), true);
  assert.equal(isInsideRoom(plaza, 160, 100), true);
  assert.equal(isInsideRoom(plaza, -1, 0), false);
  assert.equal(isInsideRoom(plaza, 321, 0), false);
  assert.equal(isInsideRoom(plaza, 0, -1), false);
  assert.equal(isInsideRoom(plaza, 0, 201), false);
});

test('clampToRoom deja el punto dentro de la sala', () => {
  const plaza = getRoom('plaza');
  assert.deepEqual(clampToRoom(plaza, -5, -3), { x: 0, y: 0 });
  assert.deepEqual(clampToRoom(plaza, 900, 800), { x: 320, y: 200 });
  assert.deepEqual(clampToRoom(plaza, 160, 100), { x: 160, y: 100 });
  const dentro = clampToRoom(plaza, 500, -4);
  assert.ok(isInsideRoom(plaza, dentro.x, dentro.y));
});

// ------------------------------------------------------------------
// salidas
// ------------------------------------------------------------------

test('exitAt devuelve la salida que contiene el punto', () => {
  const plaza = getRoom('plaza');
  const aParque = exitAt(plaza, 8, 150);
  assert.ok(aParque);
  assert.equal(aParque.to, 'parque');

  const aCafe = exitAt(plaza, 312, 150);
  assert.ok(aCafe);
  assert.equal(aCafe.to, 'cafe');

  assert.equal(exitAt(plaza, 160, 150), null);
  assert.equal(exitAt(plaza, 8, 40), null);
  assert.equal(exitAt(getRoom('parque'), 8, 150), null);
});

// ------------------------------------------------------------------
// piso caminable
// ------------------------------------------------------------------

test('cada sala define polígonos caminables con vértices enteros', () => {
  for (const room of Object.values(ROOMS)) {
    const polys = walkablePolygons(room);
    assert.ok(polys.length >= 1, `la sala "${room.id}" necesita polígonos`);
    for (const poly of polys) {
      assert.ok(poly.length >= 3, `polígono con menos de 3 vértices en "${room.id}"`);
      for (const p of poly) {
        assert.equal(Number.isInteger(p.x), true, 'x entero');
        assert.equal(Number.isInteger(p.y), true, 'y entero');
        assert.ok(p.x >= 0 && p.x <= room.width, 'x dentro de la sala');
        assert.ok(p.y >= 0 && p.y <= room.height, 'y dentro de la sala');
      }
    }
  }
});

test('el spawn de cada sala está sobre su piso caminable', () => {
  for (const room of Object.values(ROOMS)) {
    assert.equal(
      isWalkable(room, room.spawn.x, room.spawn.y),
      true,
      `el spawn de "${room.id}" no es caminable`
    );
  }
});

// Puntos de muestra de cada sala: dentro del piso y fuera (cielo, por encima de la
// línea de suelo y huecos entre los edificios).
const MUESTRAS = {
  plaza: {
    dentro: [{ x: 100, y: 180 }, { x: 20, y: 130 }, { x: 300, y: 190 }, { x: 160, y: 130 }],
    fuera: [
      { x: 160, y: 20, motivo: 'cielo' },
      { x: 100, y: 105, motivo: 'por encima de la línea de suelo' },
      { x: 60, y: 95, motivo: 'hueco entre los edificios del fondo' },
      { x: 160, y: 160, motivo: 'la fuente' },
    ],
  },
  parque: {
    dentro: [{ x: 240, y: 180 }, { x: 10, y: 190 }, { x: 300, y: 130 }, { x: 150, y: 130 }],
    fuera: [
      { x: 160, y: 30, motivo: 'cielo' },
      { x: 200, y: 105, motivo: 'por encima de la línea de suelo' },
      { x: 40, y: 95, motivo: 'hueco entre los árboles del fondo' },
      { x: 160, y: 170, motivo: 'el estanque' },
    ],
  },
  cafe: {
    dentro: [{ x: 200, y: 180 }, { x: 30, y: 120 }, { x: 100, y: 190 }, { x: 300, y: 120 }],
    fuera: [
      { x: 160, y: 30, motivo: 'cielo (la pared)' },
      { x: 170, y: 105, motivo: 'por encima de la línea de suelo' },
      { x: 60, y: 60, motivo: 'hueco entre los muebles de la pared' },
      { x: 120, y: 130, motivo: 'el mostrador' },
      { x: 280, y: 175, motivo: 'el mueble grande (la mesa)' },
    ],
  },
};

// Puntos de muestra dentro de un polígono: el centro y un punto a medio camino
// hacia cada vértice (así se recorre todo el polígono).
function muestrasDe(poly) {
  const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
  const puntos = [{ x: Math.round(cx), y: Math.round(cy) }];
  for (const p of poly) {
    puntos.push({
      x: Math.round((p.x + cx) / 2),
      y: Math.round((p.y + cy) / 2),
    });
  }
  return puntos;
}

test('dentro de cada polígono de cada sala es caminable', () => {
  for (const room of Object.values(ROOMS)) {
    for (const poly of walkablePolygons(room)) {
      for (const p of muestrasDe(poly)) {
        assert.equal(
          isWalkable(room, p.x, p.y),
          true,
          `(${p.x}, ${p.y}) debería ser caminable en "${room.id}"`
        );
      }
    }
  }
});

test('fuera del piso caminable no se puede caminar', () => {
  for (const room of Object.values(ROOMS)) {
    const muestras = MUESTRAS[room.id];
    for (const p of muestras.dentro) {
      assert.equal(
        isWalkable(room, p.x, p.y),
        true,
        `(${p.x}, ${p.y}) debería ser caminable en "${room.id}"`
      );
    }
    for (const p of muestras.fuera) {
      assert.equal(
        isWalkable(room, p.x, p.y),
        false,
        `(${p.x}, ${p.y}) no debería ser caminable en "${room.id}" (${p.motivo})`
      );
    }
  }
});

test('el borde de un polígono cuenta como dentro del piso', () => {
  const plaza = getRoom('plaza');
  // La fuente va de x 140..180, y 145..200: sus bordes pertenecen al suelo.
  assert.equal(isWalkable(plaza, 140, 160), true);
  assert.equal(isWalkable(plaza, 141, 160), false);
  assert.equal(isWalkable(plaza, 160, 145), true);
  assert.equal(isWalkable(plaza, 160, 146), false);
});

test('isWalkable no acepta una sala inexistente ni coordenadas raras', () => {
  assert.equal(isWalkable(getRoom('nope'), 10, 10), false);
  assert.equal(isWalkable(null, 10, 10), false);
  assert.equal(isWalkable(getRoom('plaza'), NaN, 10), false);
  assert.equal(isWalkable(getRoom('plaza'), 10, undefined), false);
});

test('nearestWalkable de un punto del cielo devuelve el punto caminable más cercano', () => {
  for (const room of Object.values(ROOMS)) {
    const desde = { x: Math.round(room.width / 2), y: 10 };
    const cercano = nearestWalkable(room, desde.x, desde.y);
    assert.ok(cercano, `"${room.id}" no encontró un punto caminable`);
    assert.equal(
      isWalkable(room, cercano.x, cercano.y),
      true,
      `el punto devuelto en "${room.id}" no es caminable`
    );

    // Búsqueda exhaustiva: ningún otro punto caminable está más cerca.
    let mejor = Infinity;
    for (let y = 0; y <= room.height; y++) {
      for (let x = 0; x <= room.width; x++) {
        if (!isWalkable(room, x, y)) continue;
        const d = (x - desde.x) ** 2 + (y - desde.y) ** 2;
        if (d < mejor) mejor = d;
      }
    }
    const d = (cercano.x - desde.x) ** 2 + (cercano.y - desde.y) ** 2;
    assert.equal(d, mejor, `en "${room.id}" hay un punto caminable más cerca`);
  }
});

test('nearestWalkable de un punto ya caminable devuelve ese mismo punto', () => {
  for (const room of Object.values(ROOMS)) {
    const p = room.spawn;
    assert.deepEqual(nearestWalkable(room, p.x, p.y), { x: p.x, y: p.y });
  }
});

test('walkablePolygons devuelve una copia: el catálogo no se puede tocar', () => {
  const polys = walkablePolygons(ROOMS.plaza);
  assert.deepEqual(polys, ROOMS.plaza.walkable);
  polys[0][0].x = -999;
  assert.notEqual(ROOMS.plaza.walkable[0][0].x, -999);
  assert.equal(walkablePolygons(getRoom('nope')).length, 0);
});

// ------------------------------------------------------------------
// rutas: A* sobre la cuadrícula de celdas de 4 px
// ------------------------------------------------------------------

// Una sala de prueba AISLADA: no toca el catálogo global (ROOMS), así que
// cada test puede inventar la geometría que necesita.
function salaDePrueba(walkable, extra = {}) {
  return {
    id: 'salaDePrueba',
    name: 'Sala de prueba',
    bg: 'plaza',
    width: 320,
    height: 200,
    spawn: { x: 20, y: 180 },
    walkable,
    exits: [],
    ...extra,
  };
}

// Un rectángulo como polígono (sentido antihorario).
function rect(x0, y0, x1, y1) {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

test('la velocidad de caminata es 60 px lógicos por segundo', () => {
  assert.equal(SPEED, 60);
});

test('findPath encuentra una ruta entre dos puntos del piso', () => {
  const plaza = getRoom('plaza');
  const desde = { x: 100, y: 180 };
  const hasta = { x: 250, y: 180 };
  const path = findPath(plaza, desde, hasta);

  assert.ok(Array.isArray(path), 'findPath devuelve una lista de puntos');
  assert.ok(path.length >= 2, 'la ruta tiene al menos dos puntos');
  // La ruta empieza en el punto de partida y acaba en el de llegada.
  assert.deepEqual(path[0], desde);
  assert.deepEqual(path[path.length - 1], hasta);
  // Todos los puntos de la ruta son caminables.
  for (const punto of path) {
    assert.equal(
      isWalkable(plaza, punto.x, punto.y),
      true,
      `(${punto.x}, ${punto.y}) debería ser caminable`
    );
  }
});

test('findPath rodea los obstáculos: no los atraviesa y es más larga que la recta', () => {
  const plaza = getRoom('plaza');
  // La fuente de la plaza ocupa x 140..180, y 145..200: la línea recta entre
  // estos dos puntos la atraviesa.
  const desde = { x: 100, y: 180 };
  const hasta = { x: 250, y: 180 };
  const path = findPath(plaza, desde, hasta);
  assert.ok(path);

  // Ningún punto de la ruta está dentro de la fuente.
  for (const punto of path) {
    const enLaFuente = punto.x > 140 && punto.x < 180 && punto.y > 145;
    assert.equal(enLaFuente, false, `(${punto.x}, ${punto.y}) está dentro de la fuente`);
  }

  // Y la ruta es más larga que la distancia recta.
  const recta = Math.hypot(hasta.x - desde.x, hasta.y - desde.y);
  assert.ok(
    pathLength(path) > recta,
    `la ruta (${pathLength(path)}) debería ser más larga que la recta (${recta})`
  );
});

test('findPath llega a un punto del piso aunque el centro de su celda no sea caminable', () => {
  const plaza = getRoom('plaza');
  // El borde de los adoquines que da a la fuente (x = 140) es suelo, pero el
  // centro de su celda (x = 142) está dentro de la fuente: la ruta tiene que
  // poder llegar igual.
  assert.equal(isWalkable(plaza, 140, 170), true);
  const path = findPath(plaza, { x: 100, y: 180 }, { x: 140, y: 170 });
  assert.ok(path, 'hay ruta hasta el borde de los adoquines');
  assert.deepEqual(path[path.length - 1], { x: 140, y: 170 });
  for (const punto of path) {
    assert.equal(isWalkable(plaza, punto.x, punto.y), true, `(${punto.x}, ${punto.y}) no es caminable`);
  }
});

test('findPath no corta esquinas: todos los tramos de la ruta pasan por el piso', () => {
  const trayectos = [
    { room: getRoom('plaza'), desde: { x: 100, y: 180 }, hasta: { x: 250, y: 180 } },
    { room: getRoom('plaza'), desde: { x: 100, y: 180 }, hasta: { x: 8, y: 150 } },
    { room: getRoom('parque'), desde: { x: 240, y: 180 }, hasta: { x: 20, y: 180 } },
    { room: getRoom('cafe'), desde: { x: 200, y: 180 }, hasta: { x: 30, y: 120 } },
    // Una sala de prueba con un hueco en L: la ruta tiene que rodearlo.
    {
      room: salaDePrueba([
        rect(0, 110, 100, 200),
        rect(140, 110, 320, 200),
        rect(100, 110, 140, 150),
      ]),
      desde: { x: 40, y: 180 },
      hasta: { x: 280, y: 180 },
    },
  ];
  for (const t of trayectos) {
    const path = findPath(t.room, t.desde, t.hasta);
    assert.ok(path, `no hay ruta en "${t.room.id}"`);
    for (let i = 1; i < path.length; i++) {
      assert.equal(
        segmentWalkable(t.room, path[i - 1], path[i]),
        true,
        `el tramo ${i} de la ruta de "${t.room.id}" se sale del piso`
      );
    }
    assert.equal(pathIsWalkable(t.room, path), true);
  }
});

test('findPath rodea un obstáculo estrecho: no lo atraviesa, ni de un píxel', () => {
  // Un muro de un solo píxel (x = 159) que separa las dos mitades de la sala,
  // con un puente por encima (y 110..140). La rejilla de celdas de 4 px no
  // puede quedarse solo con el centro de la celda: el muro se escondería.
  const sala = salaDePrueba([
    rect(0, 110, 158, 200),   // la mitad izquierda
    rect(160, 110, 320, 200), // la mitad derecha
    rect(158, 110, 162, 140), // el puente por encima del muro
  ]);

  const desde = { x: 20, y: 180 };
  const hasta = { x: 300, y: 180 };
  const path = findPath(sala, desde, hasta);
  assert.ok(path, 'hay ruta: el muro se puede rodear por el puente');

  // Todos los puntos de la ruta están sobre el piso y ningún tramo atraviesa
  // el muro.
  for (const punto of path) {
    assert.equal(isWalkable(sala, punto.x, punto.y), true, `(${punto.x}, ${punto.y}) no es caminable`);
  }
  assert.equal(pathIsWalkable(sala, path), true, 'algún tramo de la ruta atraviesa el muro');

  // La ruta pasa por el puente (por encima del muro), no por el hueco.
  const porElPuente = path.some((p) => p.x >= 156 && p.x <= 164 && p.y < 140);
  assert.equal(porElPuente, true, `la ruta no pasa por el puente: ${JSON.stringify(path)}`);

  // Y es más larga que la línea recta.
  const recta = Math.hypot(hasta.x - desde.x, hasta.y - desde.y);
  assert.ok(pathLength(path) > recta, 'la ruta debería rodear el muro');
});

test('findPath devuelve null si el muro no se puede rodear', () => {
  // El mismo muro, pero sin puente: no hay ningún camino.
  const sala = salaDePrueba([
    rect(0, 110, 158, 200),
    rect(160, 110, 320, 200),
  ]);
  assert.equal(findPath(sala, { x: 20, y: 180 }, { x: 300, y: 180 }), null);
});

test('findPath devuelve null entre dos zonas sin conexión', () => {
  const sala = salaDePrueba([
    rect(0, 110, 100, 200),
    rect(220, 110, 320, 200),
  ]);
  assert.equal(findPath(sala, { x: 50, y: 150 }, { x: 250, y: 150 }), null);
  // Pero sí hay ruta dentro de cada zona.
  assert.ok(findPath(sala, { x: 50, y: 150 }, { x: 20, y: 190 }));
});

test('findPath no acepta puntos que no están sobre el piso', () => {
  const plaza = getRoom('plaza');
  assert.equal(findPath(plaza, { x: 160, y: 20 }, { x: 100, y: 180 }), null);
  assert.equal(findPath(plaza, { x: 100, y: 180 }, { x: 160, y: 20 }), null);
  assert.equal(findPath(plaza, { x: 100, y: 180 }, { x: NaN, y: 20 }), null);
  assert.equal(findPath(plaza, null, { x: 100, y: 180 }), null);
  assert.equal(findPath(null, { x: 100, y: 180 }, { x: 100, y: 150 }), null);
});

test('pathLength suma los tramos de la ruta', () => {
  assert.equal(pathLength([]), 0);
  assert.equal(pathLength([{ x: 0, y: 0 }]), 0);
  assert.equal(pathLength([{ x: 0, y: 0 }, { x: 10, y: 0 }]), 10);
  assert.equal(pathLength([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]), 20);
});

test('pointAlongPath devuelve el punto de la ruta a esa distancia', () => {
  const path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  assert.deepEqual(pointAlongPath(path, 0), { x: 0, y: 0 });
  assert.deepEqual(pointAlongPath(path, 5), { x: 5, y: 0 });
  assert.deepEqual(pointAlongPath(path, 10), { x: 10, y: 0 });
  assert.deepEqual(pointAlongPath(path, 15), { x: 10, y: 5 });
  // Más allá del final: el último punto.
  assert.deepEqual(pointAlongPath(path, 999), { x: 10, y: 10 });
  assert.equal(pointAlongPath([], 5), null);
});

test('pathFacing mira el primer tramo horizontal de la ruta', () => {
  const plaza = getRoom('plaza');
  assert.equal(pathFacing(findPath(plaza, { x: 100, y: 180 }, { x: 60, y: 180 }), 'right'), 'left');
  assert.equal(pathFacing(findPath(plaza, { x: 100, y: 180 }, { x: 250, y: 180 }), 'left'), 'right');
  // Una ruta vertical no cambia el sentido anterior.
  assert.equal(pathFacing(findPath(plaza, { x: 100, y: 180 }, { x: 100, y: 120 }), 'right'), 'right');
  // Una ruta vacía tampoco.
  assert.equal(pathFacing([], 'left'), 'left');
});

test('pathFacing decide el sentido también en rutas cortas', () => {
  // Con dos puntos, el sentido es el de ese único tramo.
  assert.equal(pathFacing([{ x: 100, y: 180 }, { x: 60, y: 180 }], 'right'), 'left');
  assert.equal(pathFacing([{ x: 100, y: 180 }, { x: 140, y: 180 }], 'left'), 'right');
  // Una ruta vertical no cambia el sentido anterior.
  assert.equal(pathFacing([{ x: 100, y: 180 }, { x: 100, y: 120 }], 'right'), 'right');
  // El primer desvío de un par de píxeles no manda: manda el tramo de verdad.
  assert.equal(
    pathFacing([{ x: 100, y: 180 }, { x: 102, y: 182 }, { x: 98, y: 182 }], 'right'),
    'left'
  );
});

test('exitThreshold es el punto caminable más cercano al centro de la salida', () => {
  for (const room of Object.values(ROOMS)) {
    for (const salida of room.exits) {
      const umbral = exitThreshold(room, salida);
      assert.ok(umbral, `la salida de "${room.id}" no tiene umbral`);
      assert.equal(
        isWalkable(room, umbral.x, umbral.y),
        true,
        `el umbral de "${room.id}" no es caminable`
      );
      // Está junto al centro de la puerta.
      const cx = salida.x + salida.w / 2;
      const cy = salida.y + salida.h / 2;
      assert.ok(
        Math.hypot(umbral.x - cx, umbral.y - cy) <= 8,
        `el umbral de "${room.id}" está lejos de la puerta`
      );
    }
  }
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

test('cada toSpawn cae sobre el piso caminable de la sala destino', () => {
  for (const room of Object.values(ROOMS)) {
    for (const exit of room.exits) {
      const destino = getRoom(exit.to);
      assert.ok(destino, `la salida de "${room.id}" apunta a "${exit.to}"`);
      assert.equal(
        isWalkable(destino, exit.toSpawn.x, exit.toSpawn.y),
        true,
        `toSpawn de "${room.id}"→"${exit.to}" no es caminable en "${exit.to}"`
      );
    }
  }
});

test('la zona interior de cada salida toca el piso caminable', () => {
  for (const room of Object.values(ROOMS)) {
    for (const salida of room.exits) {
      let toca = false;
      for (let y = salida.y + 1; y < salida.y + salida.h - 1 && !toca; y++) {
        for (let x = salida.x + 1; x < salida.x + salida.w - 1; x++) {
          if (isWalkable(room, x, y)) { toca = true; break; }
        }
      }
      assert.equal(toca, true, `la salida de "${room.id}" no toca el piso caminable`);
    }
  }
});

test('validateRooms no reporta problemas en el catálogo', () => {
  assert.deepEqual(world.validateRooms(), []);
});

test('validateRooms avisa de una sala sin polígonos y de spawns no caminables', () => {
  const roto = {
    sola: {
      id: 'sola',
      name: 'Sala rota',
      bg: 'plaza',
      width: 320,
      height: 200,
      spawn: { x: 160, y: 10 },
      walkable: [],
      exits: [],
    },
  };
  const problemas = world.validateRooms(roto);
  assert.ok(problemas.some((p) => p.includes('sola') && p.includes('polígonos caminables')));
  assert.ok(problemas.some((p) => p.includes('sola') && p.includes('spawn')));
});

test('validateRooms avisa de un toSpawn no caminable y de una salida lejos del piso', () => {
  const roto = {
    origen: {
      id: 'origen',
      name: 'Sala de salida',
      bg: 'plaza',
      width: 320,
      height: 200,
      spawn: { x: 100, y: 180 },
      walkable: [[{ x: 0, y: 110 }, { x: 320, y: 110 }, { x: 320, y: 200 }, { x: 0, y: 200 }]],
      exits: [
        {
          x: 0, y: 130, w: 16, h: 40,
          to: 'destino',
          toSpawn: { x: 160, y: 20 },
          label: 'Destino',
        },
      ],
    },
    destino: {
      id: 'destino',
      name: 'Sala de destino',
      bg: 'parque',
      width: 320,
      height: 200,
      spawn: { x: 100, y: 180 },
      walkable: [[{ x: 0, y: 110 }, { x: 320, y: 110 }, { x: 320, y: 200 }, { x: 0, y: 200 }]],
      exits: [],
    },
  };
  const problemas = world.validateRooms(roto);
  assert.ok(
    problemas.some((p) => p.includes('toSpawn') && p.includes('caminable')),
    `no avisó del toSpawn no caminable: ${problemas.join(' | ')}`
  );

  // Una salida pegada al borde del piso sí es válida; una salida en el cielo no.
  const enElCielo = JSON.parse(JSON.stringify(roto));
  enElCielo.origen.exits[0].y = 10;
  const problemas2 = world.validateRooms(enElCielo);
  assert.ok(
    problemas2.some((p) => p.includes('no toca el piso caminable')),
    `no avisó de la salida en el cielo: ${problemas2.join(' | ')}`
  );
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
