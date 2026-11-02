'use strict';
// Tests del mundo contra el servidor real: entrar, moverse, cambiar de sala y salir.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, registerUser, connect, waitFor } = require('./helpers');
const worldRules = require('../server/world');
const { ROOMS, SPEED, pathLength } = worldRules;

let base;
const sockets = [];
before(async () => { base = await startServer(); });
after(async () => {
  for (const s of sockets) s.close();
  await stopServer();
});

// Un jugador con su socket conectado.
async function player() {
  const { token, user } = await registerUser(base);
  const socket = await connect(base, token);
  sockets.push(socket);
  return { user, socket };
}

// Entra al mundo y devuelve el world:state (por defecto, la plaza).
async function enter(p, room) {
  const state = waitFor(p.socket, 'world:state');
  p.socket.emit('world:enter', room ? { room } : {});
  return state;
}

// Emite un movimiento y espera su error.
async function moveError(p, move) {
  const err = waitFor(p.socket, 'error:msg');
  p.socket.emit('world:move', move);
  return err;
}

// Registra una sala de prueba aislada (no toca el catálogo global), ejecuta la
// prueba y la quita al terminar.
async function conSala(id, sala, fn) {
  worldRules.addRoom({ ...sala, id });
  try {
    return await fn();
  } finally {
    worldRules.removeRoom(id);
  }
}

// Una sala con dos zonas separadas: no se puede ir de una a otra.
function salaPartida(id, extra = {}) {
  return {
    id,
    name: 'Sala partida',
    bg: 'plaza',
    width: 320,
    height: 200,
    spawn: { x: 50, y: 150 },
    walkable: [
      [{ x: 0, y: 110 }, { x: 100, y: 110 }, { x: 100, y: 200 }, { x: 0, y: 200 }],
      [{ x: 220, y: 110 }, { x: 320, y: 110 }, { x: 320, y: 200 }, { x: 220, y: 200 }],
    ],
    exits: [],
    ...extra,
  };
}

// Aserción negativa: comprueba que `event` NO llega al socket en `ms` milisegundos.
function noEvent(socket, event, ms = 300) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(true);
    }, ms);
    function handler() {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(false);
    }
    socket.on(event, handler);
  });
}

// ------------------------------------------------------------------
// entrar
// ------------------------------------------------------------------

test('entrar sin room lleva a la plaza, en el spawn', async () => {
  const p = await player();
  const state = await enter(p);
  assert.equal(state.room.id, 'plaza');
  assert.equal(state.room.name, 'Plaza Bigotes');
  assert.equal(state.room.bg, 'plaza');
  assert.equal(state.room.width, 320);
  assert.equal(state.room.height, 200);
  assert.deepEqual(state.room.spawn, { x: 100, y: 180 });
  assert.equal(state.room.exits.length, 2);
  assert.equal(state.me.id, p.user.id);
  assert.equal(state.me.username, p.user.username);
  assert.equal(state.me.x, 100);
  assert.equal(state.me.y, 180);
  assert.deepEqual(state.me.target, { x: 100, y: 180 });
  assert.equal(state.me.facing, 'right');
  assert.ok(state.me.cat, 'el gato viaja al cliente');
  // La lista de gatos de la sala incluye al propio.
  assert.ok(state.players.some((pl) => pl.id === p.user.id));
  assert.deepEqual(state.players.find((pl) => pl.id === p.user.id), state.me);
});

test('entrar en una sala concreta devuelve esa sala', async () => {
  const p = await player();
  const state = await enter(p, 'cafe');
  assert.equal(state.room.id, 'cafe');
  assert.equal(state.room.name, 'Café del Ovillo');
  assert.deepEqual(state.room.spawn, { x: 200, y: 180 });
  assert.equal(state.me.x, 200);
  assert.equal(state.me.y, 180);
});

test('world:state manda el piso caminable de la sala', async () => {
  const p = await player();
  const state = await enter(p);
  assert.deepEqual(state.room.walkable, ROOMS.plaza.walkable);

  const enCafe = await enter(p, 'cafe');
  assert.deepEqual(enCafe.room.walkable, ROOMS.cafe.walkable);
  assert.ok(enCafe.room.walkable.length >= 1);
});

test('world:state incluye el destino y el sentido de cada gato', async () => {
  const a = await player();
  await enter(a);

  const moved = waitFor(a.socket, 'world:moved');
  a.socket.emit('world:move', { x: 60, y: 150 });
  await moved;

  const b = await player();
  const state = await enter(b);
  const catA = state.players.find((pl) => pl.id === a.user.id);
  assert.ok(catA, 'A aparece en la lista de gatos');
  assert.deepEqual(catA.target, { x: 60, y: 150 });
  assert.equal(catA.facing, 'left');
});

test('world:enter con una sala inexistente da error', async () => {
  const p = await player();
  const err = waitFor(p.socket, 'error:msg');
  p.socket.emit('world:enter', { room: 'nope' });
  const { message } = await err;
  assert.equal(message, 'Esa sala no existe.');
});

test('world:move sin entrar al mundo da error', async () => {
  const p = await player();
  const { message } = await moveError(p, { x: 10, y: 10 });
  assert.equal(message, 'Primero entra al mundo.');
});

// ------------------------------------------------------------------
// moverse
// ------------------------------------------------------------------

test('world:move fuera de la sala da error y el gato no se mueve', async () => {
  const a = await player();
  await enter(a);
  const moves = [];
  a.socket.on('world:moved', (m) => moves.push(m));

  const { message } = await moveError(a, { x: 400, y: 0 });
  assert.equal(message, 'No puedes salir de la sala.');

  // Un movimiento válido posterior: solo ese debe verse.
  const moved = waitFor(a.socket, 'world:moved');
  a.socket.emit('world:move', { x: 30, y: 150 });
  await moved;
  assert.equal(moves.length, 1);
  assert.equal(moves[0].id, a.user.id);
  assert.deepEqual(moves[0].target, { x: 30, y: 150 });

  // Y el gato sigue en la sala, caminando hacia el destino del movimiento válido.
  const b = await player();
  const state = await enter(b);
  const catA = state.players.find((pl) => pl.id === a.user.id);
  assert.deepEqual(catA.target, { x: 30, y: 150 });
});

test('world:move con coordenadas no numéricas da error', async () => {
  const p = await player();
  await enter(p);
  const { message } = await moveError(p, { x: 'a', y: 1 });
  assert.equal(message, 'Movimiento inválido.');
});

test('world:move válido devuelve world:moved con la ruta, el destino y el sentido', async () => {
  const a = await player();
  const b = await player();
  await enter(a);
  await enter(b);

  const movedA = waitFor(a.socket, 'world:moved');
  const movedB = waitFor(b.socket, 'world:moved');
  a.socket.emit('world:move', { x: 30.6, y: 150.4 });

  const paraA = await movedA;
  const paraB = await movedB;
  assert.deepEqual(paraA, paraB);
  assert.equal(paraA.id, a.user.id);
  // El destino es el punto pedido, redondeado.
  assert.deepEqual(paraA.target, { x: 31, y: 150 });
  // La ruta va del punto actual al destino y solo pasa por el piso caminable.
  assert.ok(Array.isArray(paraA.path) && paraA.path.length >= 2);
  assert.deepEqual(paraA.path[paraA.path.length - 1], { x: 31, y: 150 });
  for (const punto of paraA.path) {
    assert.equal(worldRules.isWalkable(ROOMS.plaza, punto.x, punto.y), true);
  }
  // El sentido es el del primer tramo de la ruta.
  assert.equal(paraA.facing, 'left');
});

test('world:move a un punto no caminable deja al gato en el punto caminable más cercano', async () => {
  const a = await player();
  await enter(a);

  // Un punto del cielo: el destino es el punto caminable más cercano.
  const moved = waitFor(a.socket, 'world:moved');
  a.socket.emit('world:move', { x: 60, y: 20 });
  const m = await moved;

  assert.ok(worldRules.isWalkable(ROOMS.plaza, m.target.x, m.target.y), 'el destino es caminable');
  assert.equal(m.target.y, 110, 'el punto caminable más cercano está en el suelo');
  assert.equal(m.target.x, 60);
  // La ruta tampoco pasa por el cielo.
  for (const punto of m.path) {
    assert.equal(worldRules.isWalkable(ROOMS.plaza, punto.x, punto.y), true);
  }
  assert.ok(m.path.length >= 2);
});

test('world:move a un punto inalcanzable da error y el gato no se mueve', async () => {
  // Una sala de prueba aislada con dos zonas separadas: no hay camino de una
  // a otra. No se toca el catálogo global: la sala se registra y se quita.
  const id = 'salaPartida';
  worldRules.addRoom({
    id,
    name: 'Sala partida',
    bg: 'plaza',
    width: 320,
    height: 200,
    spawn: { x: 50, y: 150 },
    walkable: [
      [{ x: 0, y: 110 }, { x: 100, y: 110 }, { x: 100, y: 200 }, { x: 0, y: 200 }],
      [{ x: 220, y: 110 }, { x: 320, y: 110 }, { x: 320, y: 200 }, { x: 220, y: 200 }],
    ],
    exits: [],
  });
  try {
    const a = await player();
    const moves = [];
    a.socket.on('world:moved', (m) => moves.push(m));
    const state = await enter(a, id);
    assert.equal(state.room.id, id);

    const { message } = await moveError(a, { x: 250, y: 150 });
    assert.equal(message, 'No se puede llegar hasta ahí.');
    assert.deepEqual(moves, [], 'el gato no se mueve');

    // Sigue en su sitio.
    const b = await player();
    const otro = await enter(b, id);
    const catA = otro.players.find((pl) => pl.id === a.user.id);
    assert.deepEqual({ x: catA.x, y: catA.y }, { x: 50, y: 150 });
  } finally {
    worldRules.removeRoom(id);
  }
});

test('no se puede mover más de 12 veces por segundo', async () => {
  const a = await player();
  await enter(a);
  for (let i = 0; i < 12; i++) a.socket.emit('world:move', { x: 40 + i, y: 150 });

  const { message } = await moveError(a, { x: 60, y: 150 });
  assert.equal(message, 'Te mueves muy rápido.');

  // El gato se quedó en el último movimiento aceptado.
  const b = await player();
  const state = await enter(b);
  const catA = state.players.find((pl) => pl.id === a.user.id);
  assert.deepEqual(catA.target, { x: 51, y: 150 });
});

test('un movimiento imposible no gasta las oportunidades de movimiento', async () => {
  await conSala('salaPartidaLimite', salaPartida('salaPartidaLimite'), async () => {
    const a = await player();
    await enter(a, 'salaPartidaLimite');

    // Doce movimientos imposibles: cada uno sale con su error y ninguno gasta
    // una de las 12 oportunidades por segundo.
    for (let i = 0; i < 12; i++) {
      const { message } = await moveError(a, { x: 250, y: 150 });
      assert.equal(message, 'No se puede llegar hasta ahí.');
    }

    // El movimiento siguiente (válido) sigue aceptándose.
    const moved = waitFor(a.socket, 'world:moved');
    a.socket.emit('world:move', { x: 20, y: 150 });
    const m = await moved;
    assert.deepEqual(m.target, { x: 20, y: 150 });
  });
});

test('la posición del gato se deriva de la ruta que camina', async () => {
  const a = await player();
  await enter(a);

  const moved = waitFor(a.socket, 'world:moved');
  a.socket.emit('world:move', { x: 250, y: 180 });
  const m = await moved;
  assert.deepEqual(m.target, { x: 250, y: 180 });

  // La posición NO se guarda: se deriva de la ruta y del tiempo que lleva
  // recorriéndola. Otro gato que entra a la sala ve esa posición actual: ni el
  // spawn (100, 180) ni el destino (250, 180).
  const b = await player();
  const state = await enter(b);
  const catA = state.players.find((pl) => pl.id === a.user.id);
  assert.ok(catA, 'A aparece en la lista de gatos');
  assert.deepEqual(catA.path, m.path, 'el gato sigue la ruta que calculó el servidor');
  assert.ok(catA.x >= 100 && catA.x <= 250, `posición actual rara: ${catA.x}`);
  assert.ok(catA.x < 250, `el gato todavía no ha llegado: ${catA.x}`);
  assert.deepEqual(catA.target, { x: 250, y: 180 });
});

// ------------------------------------------------------------------
// cambiar de sala
// ------------------------------------------------------------------

test('mover sobre una salida cambia de sala', async () => {
  const a = await player();
  const b = await player();
  const c = await player();
  await enter(a);
  await enter(b);
  await enter(c, 'parque');

  const leftForB = waitFor(b.socket, 'world:left');
  const joinForC = waitFor(c.socket, 'world:join');
  const state = waitFor(a.socket, 'world:state', (s) => s.room.id === 'parque', 8000);
  a.socket.emit('world:move', { x: 4, y: 150 });

  const newState = await state;
  assert.equal(newState.room.id, 'parque');
  assert.deepEqual({ x: newState.me.x, y: newState.me.y }, { x: 290, y: 180 });
  assert.deepEqual(await leftForB, { id: a.user.id });
  const joined = await joinForC;
  assert.equal(joined.player.id, a.user.id);
  assert.deepEqual({ x: joined.player.x, y: joined.player.y }, { x: 290, y: 180 });
});

test('un gato que camina hacia una salida cambia de sala al llegar', async () => {
  const a = await player();
  await enter(a);

  const moved = waitFor(a.socket, 'world:moved');
  const t0 = Date.now();
  a.socket.emit('world:move', { x: 4, y: 150 });
  const m = await moved;

  // El destino es el umbral de la puerta y la ruta llega hasta él.
  assert.deepEqual(m.target, { x: 8, y: 150 });
  assert.deepEqual(m.path[m.path.length - 1], { x: 8, y: 150 });

  // El cambio de sala se difiere hasta que el gato llega (longitud / velocidad).
  const esperado = (pathLength(m.path) / SPEED) * 1000;
  assert.ok(esperado > 500, 'el trayecto tarda lo suyo');

  // Antes de llegar, el gato sigue en la plaza.
  const sigueEnLaPlaza = await noEvent(a.socket, 'world:state', esperado * 0.5);
  assert.ok(sigueEnLaPlaza, 'el gato no debe cambiar de sala antes de llegar');

  const state = await waitFor(a.socket, 'world:state', (s) => s.room.id === 'parque', 8000);
  const dt = Date.now() - t0;
  assert.equal(state.room.id, 'parque');
  assert.ok(
    dt >= esperado * 0.6 && dt <= esperado * 1.4,
    `cambió de sala a los ${dt} ms y se esperaba a los ${esperado} ms`
  );
});

test('un movimiento nuevo cancela el cruce de puerta pendiente', async () => {
  const a = await player();
  await enter(a);

  // El gato empieza a caminar hacia la salida...
  const moved = waitFor(a.socket, 'world:moved');
  a.socket.emit('world:move', { x: 4, y: 150 });
  const m = await moved;

  // ...pero se lo piensa y anda a otro sitio: no debe cruzar la puerta.
  const otro = waitFor(a.socket, 'world:moved');
  a.socket.emit('world:move', { x: 100, y: 150 });
  await otro;

  // Se espera más que el trayecto que había empezado: aun así, no cruza.
  const esperado = (pathLength(m.path) / SPEED) * 1000;
  const sigueEnLaPlaza = await noEvent(a.socket, 'world:state', esperado * 1.5);
  assert.ok(sigueEnLaPlaza, 'el gato no debe cruzar la puerta si ya no va a la puerta');
});

test('un movimiento imposible no cancela el cruce de puerta pendiente', async () => {
  // Una sala de prueba aislada con dos zonas separadas y una salida en la
  // primera: el gato no puede llegar a la otra zona, pero sí a la puerta que
  // tiene al lado.
  const id = 'salaPartidaConPuerta';
  worldRules.addRoom({
    id,
    name: 'Sala partida con puerta',
    bg: 'plaza',
    width: 320,
    height: 200,
    spawn: { x: 50, y: 150 },
    walkable: [
      [{ x: 0, y: 110 }, { x: 100, y: 110 }, { x: 100, y: 200 }, { x: 0, y: 200 }],
      [{ x: 220, y: 110 }, { x: 320, y: 110 }, { x: 320, y: 200 }, { x: 220, y: 200 }],
    ],
    exits: [
      {
        x: 0, y: 130, w: 16, h: 40,
        to: 'plaza',
        toSpawn: { x: 100, y: 180 },
        label: 'Plaza Bigotes',
      },
    ],
  });
  try {
    const a = await player();
    await enter(a, id);

    // El gato empieza a caminar hacia la salida...
    const moved = waitFor(a.socket, 'world:moved');
    a.socket.emit('world:move', { x: 4, y: 150 });
    const m = await moved;
    assert.deepEqual(m.target, { x: 8, y: 150 });

    // ...pero se le pide un punto al que no se puede llegar: el movimiento se
    // rechaza y el gato sigue con su camino hacia la puerta.
    const { message } = await moveError(a, { x: 250, y: 150 });
    assert.equal(message, 'No se puede llegar hasta ahí.');

    // Al llegar al umbral, cruza a la plaza.
    const estado = await waitFor(a.socket, 'world:state', (s) => s.room.id === 'plaza', 8000);
    assert.equal(estado.room.id, 'plaza');
    assert.deepEqual({ x: estado.me.x, y: estado.me.y }, { x: 100, y: 180 });
  } finally {
    worldRules.removeRoom(id);
  }
});

// ------------------------------------------------------------------
// salir
// ------------------------------------------------------------------

test('world:leave saca al gato y los demás reciben world:left', async () => {
  const a = await player();
  const b = await player();
  await enter(a);
  await enter(b);

  const left = waitFor(b.socket, 'world:left');
  a.socket.emit('world:leave');
  assert.deepEqual(await left, { id: a.user.id });
});

test('cerrar la última pestaña saca al gato del mundo', async () => {
  const a = await player();
  const b = await player();
  await enter(a);
  await enter(b);

  const left = waitFor(b.socket, 'world:left');
  a.socket.close();
  assert.deepEqual(await left, { id: a.user.id });
});

test('con varias pestañas se entra y se sale todo junto', async () => {
  const { token, user } = await registerUser(base);
  const tab1 = await connect(base, token);
  const tab2 = await connect(base, token);
  sockets.push(tab1, tab2);

  const state1 = waitFor(tab1, 'world:state');
  const state2 = waitFor(tab2, 'world:state');
  tab1.emit('world:enter', {});
  assert.equal((await state1).room.id, 'plaza');
  assert.equal((await state2).room.id, 'plaza');

  // Las dos pestañas comparten la misma posición.
  const moved = waitFor(tab2, 'world:moved');
  tab1.emit('world:move', { x: 12, y: 113 });
  const m = await moved;
  assert.equal(m.id, user.id);
  assert.deepEqual(m.target, { x: 12, y: 113 });

  // Al salir, los demás de la sala se enteran una sola vez.
  const other = await player();
  await enter(other);
  const left = waitFor(other.socket, 'world:left');
  tab1.emit('world:leave');
  assert.deepEqual(await left, { id: user.id });
});
