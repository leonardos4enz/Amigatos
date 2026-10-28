'use strict';
// Lógica pura del Gato (tic-tac-toe).
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

// players: [{id, username, cat}], players[0] empieza con "X".
function create(players) {
  const [a, b] = players;
  return {
    type: 'tictactoe',
    players,
    turn: a.id,
    status: 'playing',
    winnerId: null,
    reason: null,
    data: {
      board: Array(9).fill(null),
      symbols: { [a.id]: 'X', [b.id]: 'O' },
      winLine: null,
    },
  };
}

function applyMove(state, userId, move) {
  if (state.status !== 'playing') return { error: 'La partida ya terminó.' };
  if (state.turn !== userId) return { error: 'No es tu turno.' };
  const cell = move && move.cell;
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) return { error: 'Casilla inválida.' };
  if (state.data.board[cell] !== null) return { error: 'Esa casilla ya está ocupada.' };

  const board = state.data.board.slice();
  board[cell] = userId;
  const next = { ...state, data: { ...state.data, board } };

  const line = LINES.find(([x, y, z]) => board[x] === userId && board[y] === userId && board[z] === userId);
  if (line) {
    return { state: { ...next, status: 'finished', turn: null, winnerId: userId, reason: 'win', data: { ...next.data, winLine: line } } };
  }
  if (board.every((c) => c !== null)) {
    return { state: { ...next, status: 'finished', turn: null, winnerId: null, reason: 'draw' } };
  }
  const other = state.players.find((p) => p.id !== userId);
  return { state: { ...next, turn: other.id } };
}

module.exports = { create, applyMove };
