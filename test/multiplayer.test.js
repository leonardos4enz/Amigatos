'use strict';
// Tests multijugador: dos jugadores simulados conectados por Socket.IO al servidor real.
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

async function player() {
  const { token, user } = await registerUser(base);
  const socket = await connect(base, token);
  sockets.push(socket);
  return { user, socket };
}

// A invita a B a `game` y B acepta. Devuelve el primer game:state que reciben ambos.
async function startMatch(a, b, game) {
  const invite = waitFor(b.socket, 'invite:received');
  a.socket.emit('invite:send', { toUserId: b.user.id, game });
  const { inviteId } = await invite;
  const stateA = waitFor(a.socket, 'game:state');
  const stateB = waitFor(b.socket, 'game:state');
  b.socket.emit('invite:respond', { inviteId, accept: true });
  return Promise.all([stateA, stateB]);
}

test('un token inválido no puede conectarse', async () => {
  await assert.rejects(connect(base, 'token-falso'), /auth/);
});

test('presence muestra a los dos jugadores conectados', async () => {
  const a = await player();
  const presence = waitFor(a.socket, 'presence', (list) => list.length >= 2);
  const b = await player();
  const list = await presence;
  const ids = list.map((p) => p.id);
  assert.ok(ids.includes(a.user.id) && ids.includes(b.user.id));
});

test('invitación aceptada empieza una partida de Gato para ambos', async () => {
  const a = await player();
  const b = await player();
  const [stateA, stateB] = await startMatch(a, b, 'tictactoe');
  assert.equal(stateA.type, 'tictactoe');
  assert.equal(stateA.id, stateB.id);
  assert.equal(stateA.turn, a.user.id, 'empieza quien invitó');
});

test('partida completa: A gana en línea y ambos reciben game:over', async () => {
  const a = await player();
  const b = await player();
  const [state] = await startMatch(a, b, 'tictactoe');
  const gameId = state.id;
  // A: 0, 1, 2 (fila de arriba). B: 3, 4.
  const moves = [[a, 0], [b, 3], [a, 1], [b, 4]];
  for (const [p, cell] of moves) {
    const next = waitFor(a.socket, 'game:state', (s) => s.data.board[cell] !== null);
    p.socket.emit('game:move', { gameId, move: { cell } });
    await next;
  }
  const overA = waitFor(a.socket, 'game:over');
  const overB = waitFor(b.socket, 'game:over');
  a.socket.emit('game:move', { gameId, move: { cell: 2 } });
  const [resA, resB] = await Promise.all([overA, overB]);
  assert.equal(resA.state.winnerId, a.user.id);
  assert.equal(resB.state.reason, 'win');
});

test('mover fuera de turno devuelve error:msg', async () => {
  const a = await player();
  const b = await player();
  const [state] = await startMatch(a, b, 'tictactoe');
  const err = waitFor(b.socket, 'error:msg');
  b.socket.emit('game:move', { gameId: state.id, move: { cell: 0 } });
  assert.match((await err).message, /turno/i);
});

test('el chat de la partida llega a los dos jugadores', async () => {
  const a = await player();
  const b = await player();
  const [state] = await startMatch(a, b, 'tictactoe');
  const msgB = waitFor(b.socket, 'chat:msg');
  a.socket.emit('chat:send', { gameId: state.id, text: '  ¡Miau!  ' });
  const msg = await msgB;
  assert.equal(msg.text, '¡Miau!');
  assert.equal(msg.from.id, a.user.id);
});
