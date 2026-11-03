'use strict';
// Tests de `world:travel`: viajar desde el mapa del pueblo a una sala exterior.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, registerUser, connect, waitFor } = require('./helpers');
const worldRules = require('../server/world');

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

// Emite un viaje y espera su error.
async function travelError(p, room) {
  const err = waitFor(p.socket, 'error:msg');
  p.socket.emit('world:travel', { room });
  return err;
}

// ------------------------------------------------------------------
// destinos no permitidos
// ------------------------------------------------------------------

test('viajar a una sala interior da error y el gato no se mueve', async () => {
  const a = await player();
  await enter(a);

  const { message } = await travelError(a, 'cafe');
  assert.equal(message, 'Ese lugar no se puede viajar.');

  // Sigue en la plaza: otro gato lo ve allí.
  const b = await player();
  const stateOfB = await enter(b);
  const catA = stateOfB.players.find((pl) => pl.id === a.user.id);
  assert.ok(catA, 'A sigue en la plaza');
  assert.deepEqual({ x: catA.x, y: catA.y }, { x: 100, y: 180 });
});

test('viajar a una sala que no existe da el mismo error', async () => {
  const a = await player();
  await enter(a);

  const { message } = await travelError(a, 'marte');
  assert.equal(message, 'Ese lugar no se puede viajar.');

  const b = await player();
  const stateOfB = await enter(b);
  const catA = stateOfB.players.find((pl) => pl.id === a.user.id);
  assert.ok(catA, 'A sigue en la plaza');
  assert.deepEqual({ x: catA.x, y: catA.y }, { x: 100, y: 180 });
});

test('viajar sin decir a qué sala da el mismo error', async () => {
  const a = await player();
  await enter(a);

  const err = waitFor(a.socket, 'error:msg');
  a.socket.emit('world:travel', {});
  assert.equal((await err).message, 'Ese lugar no se puede viajar.');
});

// ------------------------------------------------------------------
// viaje válido
// ------------------------------------------------------------------

test('viajar a una sala exterior entra en ella en su spawn', async () => {
  const a = await player();
  await enter(a);

  const state = waitFor(a.socket, 'world:state', (s) => s.room.id === 'muelle');
  a.socket.emit('world:travel', { room: 'muelle' });

  const nueva = await state;
  assert.equal(nueva.room.id, 'muelle');
  assert.deepEqual({ x: nueva.me.x, y: nueva.me.y }, worldRules.getRoom('muelle').spawn);
});

test('al viajar, la sala de origen ve la salida y la de destino ve la entrada', async () => {
  const a = await player();   // viaja
  const b = await player();   // se queda en la plaza
  const c = await player();   // espera en el muelle
  await enter(a);
  await enter(b);
  await enter(c, 'muelle');

  const leftForB = waitFor(b.socket, 'world:left', (p) => p.id === a.user.id);
  const joinForC = waitFor(c.socket, 'world:join', (p) => p.player && p.player.id === a.user.id);
  const stateForA = waitFor(a.socket, 'world:state', (s) => s.room.id === 'muelle');

  a.socket.emit('world:travel', { room: 'muelle' });

  assert.deepEqual(await leftForB, { id: a.user.id });
  const entrada = await joinForC;
  assert.deepEqual({ x: entrada.player.x, y: entrada.player.y }, worldRules.getRoom('muelle').spawn);
  assert.equal((await stateForA).room.id, 'muelle');
});

// ------------------------------------------------------------------
// anti-abuso
// ------------------------------------------------------------------

test('no se puede viajar más de 12 veces por segundo', async () => {
  const a = await player();
  await enter(a);

  const error = waitFor(a.socket, 'error:msg', (e) => e.message === 'Te mueves muy rápido.');
  for (let i = 0; i < 20; i++) a.socket.emit('world:travel', { room: 'muelle' });

  assert.equal((await error).message, 'Te mueves muy rápido.');
});
