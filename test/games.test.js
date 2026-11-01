'use strict';
// Tests de la lógica pura de los juegos (server/games/*). No necesitan servidor.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const tictactoe = require('../server/games/tictactoe');

const A = { id: 1, username: 'ana', cat: null };
const B = { id: 2, username: 'beto', cat: null };

function play(moves) {
  let state = tictactoe.create([A, B]);
  for (const [player, cell] of moves) {
    const res = tictactoe.applyMove(state, player.id, { cell });
    if (res.error) return { error: res.error, state };
    state = res.state;
  }
  return { state };
}

test('Gato: empieza el primer jugador con X', () => {
  const s = tictactoe.create([A, B]);
  assert.equal(s.turn, A.id);
  assert.equal(s.data.symbols[A.id], 'X');
});

test('Gato: tres en línea gana y marca la línea', () => {
  const { state } = play([[A, 0], [B, 3], [A, 1], [B, 4], [A, 2]]);
  assert.equal(state.status, 'finished');
  assert.equal(state.winnerId, A.id);
  assert.deepEqual(state.data.winLine, [0, 1, 2]);
});

test('Gato: tablero lleno sin línea es empate', () => {
  const { state } = play([[A, 0], [B, 1], [A, 2], [B, 4], [A, 3], [B, 5], [A, 7], [B, 6], [A, 8]]);
  assert.equal(state.status, 'finished');
  assert.equal(state.winnerId, null);
  assert.equal(state.reason, 'draw');
});

test('Gato: rechaza mover fuera de turno y casillas ocupadas o inválidas', () => {
  assert.match(play([[B, 0]]).error, /turno/);
  assert.match(play([[A, 0], [B, 0]]).error, /ocupada/);
  assert.match(play([[A, 9]]).error, /inválida/);
});
