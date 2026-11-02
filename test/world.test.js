'use strict';
// Tests del mundo contra el servidor real: entrar, moverse, cambiar de sala y salir.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, registerUser, connect, waitFor } = require('./helpers');
const { ROOMS } = require('../server/world');

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
  assert.deepEqual(state.me, {
    id: p.user.id,
    username: p.user.username,
    cat: state.me.cat,
    x: 100,
    y: 180,
  });
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
  a.socket.emit('world:move', { x: 10, y: 10 });
  await moved;
  assert.deepEqual(moves, [{ id: a.user.id, x: 10, y: 10 }]);

  // Y la posición real del gato sigue siendo la del movimiento válido.
  const b = await player();
  const state = await enter(b);
  const catA = state.players.find((pl) => pl.id === a.user.id);
  assert.deepEqual({ x: catA.x, y: catA.y }, { x: 10, y: 10 });
});

test('world:move con coordenadas no numéricas da error', async () => {
  const p = await player();
  await enter(p);
  const { message } = await moveError(p, { x: 'a', y: 1 });
  assert.equal(message, 'Movimiento inválido.');
});

test('world:move válido devuelve world:moved con las coordenadas redondeadas', async () => {
  const a = await player();
  const b = await player();
  await enter(a);
  await enter(b);

  const movedA = waitFor(a.socket, 'world:moved');
  const movedB = waitFor(b.socket, 'world:moved');
  a.socket.emit('world:move', { x: 10.6, y: 20.4 });
  assert.deepEqual(await movedA, { id: a.user.id, x: 11, y: 20 });
  assert.deepEqual(await movedB, { id: a.user.id, x: 11, y: 20 });
});

test('no se puede mover más de 12 veces por segundo', async () => {
  const a = await player();
  await enter(a);
  for (let i = 0; i < 12; i++) a.socket.emit('world:move', { x: 40 + i, y: 40 });

  const { message } = await moveError(a, { x: 60, y: 40 });
  assert.equal(message, 'Te mueves muy rápido.');

  // El gato se quedó en el último movimiento aceptado.
  const b = await player();
  const state = await enter(b);
  const catA = state.players.find((pl) => pl.id === a.user.id);
  assert.deepEqual({ x: catA.x, y: catA.y }, { x: 51, y: 40 });
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
  const state = waitFor(a.socket, 'world:state');
  a.socket.emit('world:move', { x: 4, y: 150 });

  const newState = await state;
  assert.equal(newState.room.id, 'parque');
  assert.deepEqual({ x: newState.me.x, y: newState.me.y }, { x: 290, y: 180 });
  assert.deepEqual(await leftForB, { id: a.user.id });
  const joined = await joinForC;
  assert.equal(joined.player.id, a.user.id);
  assert.deepEqual({ x: joined.player.x, y: joined.player.y }, { x: 290, y: 180 });
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
  tab1.emit('world:move', { x: 12, y: 13 });
  assert.deepEqual(await moved, { id: user.id, x: 12, y: 13 });

  // Al salir, los demás de la sala se enteran una sola vez.
  const other = await player();
  await enter(other);
  const left = waitFor(other.socket, 'world:left');
  tab1.emit('world:leave');
  assert.deepEqual(await left, { id: user.id });
});
