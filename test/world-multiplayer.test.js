'use strict';
// Tests del mundo con dos jugadores sobre el servidor real: qué ve cada gato
// cuando otro se mueve, cambia de sala o se va.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, registerUser, connect, waitFor } = require('./helpers');

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

// Aserción negativa: comprueba que `event` NO llega al socket en `ms` milisegundos.
// Necesita una espera corta y fija porque no hay evento que esperar.
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
// difusión de movimientos
// ------------------------------------------------------------------

test('un movimiento llega a los demás gatos de la misma sala', async () => {
  const a = await player();
  const b = await player();
  await enter(a);
  await enter(b);

  const moved = waitFor(b.socket, 'world:moved');
  a.socket.emit('world:move', { x: 20, y: 24 });

  assert.deepEqual(await moved, { id: a.user.id, x: 20, y: 24 });
});

test('un movimiento no llega a los gatos de otra sala', async () => {
  const a = await player();
  const c = await player();
  await enter(a);
  await enter(c, 'parque');

  const received = [];
  c.socket.on('world:moved', (m) => received.push(m));

  a.socket.emit('world:move', { x: 20, y: 24 });

  assert.ok(await noEvent(c.socket, 'world:moved'), 'el gato del parque no recibe world:moved');
  assert.deepEqual(received, []);
});

// ------------------------------------------------------------------
// cambiar de sala
// ------------------------------------------------------------------

test('caminar a una salida cambia de sala y avisa a los de la sala anterior', async () => {
  const a = await player();
  const b = await player();
  await enter(a);
  await enter(b);

  const leftForB = waitFor(b.socket, 'world:left');
  const stateForA = waitFor(a.socket, 'world:state');
  // La salida de la plaza hacia el parque.
  a.socket.emit('world:move', { x: 4, y: 37 });

  const newState = await stateForA;
  assert.equal(newState.room.id, 'parque');
  assert.deepEqual({ x: newState.me.x, y: newState.me.y }, { x: 84, y: 56 });
  assert.deepEqual(await leftForB, { id: a.user.id });

  // Un gato del parque ve a A en su lista de jugadores.
  const d = await player();
  const stateOfD = await enter(d, 'parque');
  const catA = stateOfD.players.find((pl) => pl.id === a.user.id);
  assert.ok(catA, 'A aparece en la lista de gatos del parque');
  assert.deepEqual({ x: catA.x, y: catA.y }, { x: 84, y: 56 });
});

// ------------------------------------------------------------------
// validación de posiciones
// ------------------------------------------------------------------

test('una posición fuera de la sala da error y el gato no se mueve', async () => {
  const a = await player();
  const b = await player();
  await enter(a);
  await enter(b);

  const movedForA = [];
  a.socket.on('world:moved', (m) => movedForA.push(m));

  const error = waitFor(a.socket, 'error:msg');
  a.socket.emit('world:move', { x: 500, y: 10 });
  const { message } = await error;
  assert.equal(message, 'No puedes salir de la sala.');

  // No se movió: ni el propio ni los demás ven un world:moved.
  assert.ok(await noEvent(a.socket, 'world:moved'), 'el movimiento inválido no se difunde');
  assert.deepEqual(movedForA, []);

  // Y su posición real sigue siendo la del spawn.
  const d = await player();
  const stateOfD = await enter(d);
  const catA = stateOfD.players.find((pl) => pl.id === a.user.id);
  assert.ok(catA, 'A sigue en la plaza');
  assert.deepEqual({ x: catA.x, y: catA.y }, { x: 48, y: 60 });
});

// ------------------------------------------------------------------
// anti-abuso
// ------------------------------------------------------------------

test('no se puede mover más de 12 veces por segundo', async () => {
  const a = await player();
  await enter(a);

  const error = waitFor(a.socket, 'error:msg', (e) => e.message === 'Te mueves muy rápido.');
  for (let i = 0; i < 20; i++) a.socket.emit('world:move', { x: 10 + (i % 30), y: 40 });

  assert.equal((await error).message, 'Te mueves muy rápido.');
});

// ------------------------------------------------------------------
// desconexión
// ------------------------------------------------------------------

test('cerrar el socket saca al gato de la sala', async () => {
  const a = await player();
  const b = await player();
  await enter(a);
  await enter(b);

  const left = waitFor(b.socket, 'world:left');
  a.socket.close();

  assert.deepEqual(await left, { id: a.user.id });
});

// ------------------------------------------------------------------
// salas inválidas
// ------------------------------------------------------------------

test('entrar en una sala que no existe da error', async () => {
  const p = await player();

  const error = waitFor(p.socket, 'error:msg');
  p.socket.emit('world:enter', { room: 'marte' });

  assert.equal((await error).message, 'Esa sala no existe.');
});
