'use strict';
// Lógica pura de Conecta 4 (ovillos vs pescaditos).
const ROWS = 6;
const COLS = 7;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

// players: [{id, username, cat}], players[0] empieza con los ovillos.
function create(players) {
  const [a, b] = players;
  return {
    type: 'connect4',
    players,
    turn: a.id,
    status: 'playing',
    winnerId: null,
    reason: null,
    data: {
      rows: ROWS,
      cols: COLS,
      board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
      pieces: { [a.id]: 'yarn', [b.id]: 'fish' },
      winLine: null,
      lastMove: null,
    },
  };
}

// Busca 4 en línea que pase por (r, c). Devuelve [[r,c] x4] o null.
function findLine(board, r, c, who) {
  for (const [dr, dc] of DIRS) {
    const cells = [[r, c]];
    for (const s of [1, -1]) {
      let rr = r + dr * s, cc = c + dc * s;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr][cc] === who) {
        if (s === 1) cells.push([rr, cc]); else cells.unshift([rr, cc]);
        rr += dr * s; cc += dc * s;
      }
    }
    if (cells.length >= 4) {
      // exactamente 4, centradas en la ficha recién puesta cuando la línea es más larga
      const idx = cells.findIndex(([x, y]) => x === r && y === c);
      const start = Math.max(0, Math.min(idx - 1, cells.length - 4));
      return cells.slice(start, start + 4);
    }
  }
  return null;
}

function applyMove(state, userId, move) {
  if (state.status !== 'playing') return { error: 'La partida ya terminó.' };
  if (state.turn !== userId) return { error: 'No es tu turno.' };
  const col = move && move.col;
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return { error: 'Columna inválida.' };

  const old = state.data.board;
  let row = -1;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (old[r][col] === null) { row = r; break; }
  }
  if (row === -1) return { error: 'Esa columna ya está llena.' };

  const board = old.map((line, r) => (r === row ? line.slice() : line));
  board[row][col] = userId;
  const next = { ...state, data: { ...state.data, board, lastMove: { r: row, c: col } } };

  const line = findLine(board, row, col, userId);
  if (line) {
    return { state: { ...next, status: 'finished', turn: null, winnerId: userId, reason: 'win', data: { ...next.data, winLine: line } } };
  }
  if (board[0].every((c) => c !== null)) {
    return { state: { ...next, status: 'finished', turn: null, winnerId: null, reason: 'draw' } };
  }
  const other = state.players.find((p) => p.id !== userId);
  return { state: { ...next, turn: other.id } };
}

module.exports = { create, applyMove };
