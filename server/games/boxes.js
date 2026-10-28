'use strict';
// Lógica pura de Cajitas (puntos y cajas): a los gatos les encantan las cajas.
// Rejilla de size×size cajas ((size+1)×(size+1) puntos).
//   h[r][c]: línea horizontal entre el punto (r,c) y (r,c+1)  → (size+1) filas × size columnas
//   v[r][c]: línea vertical   entre el punto (r,c) y (r+1,c)  → size filas × (size+1) columnas
//   owners[r][c]: dueño de la caja (r,c) o null
const SIZE = 4;

function grid(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

// players: [{id, username, cat}], players[0] empieza.
function create(players) {
  const [a, b] = players;
  return {
    type: 'boxes',
    players,
    turn: a.id,
    status: 'playing',
    winnerId: null,
    reason: null,
    data: {
      size: SIZE,
      h: grid(SIZE + 1, SIZE),
      v: grid(SIZE, SIZE + 1),
      owners: grid(SIZE, SIZE),
      scores: { [a.id]: 0, [b.id]: 0 },
      lastLine: null,
    },
  };
}

function boxClosed(h, v, r, c) {
  return h[r][c] !== null && h[r + 1][c] !== null && v[r][c] !== null && v[r][c + 1] !== null;
}

function applyMove(state, userId, move) {
  if (state.status !== 'playing') return { error: 'La partida ya terminó.' };
  if (state.turn !== userId) return { error: 'No es tu turno.' };
  const d = state.data;
  const n = d.size;
  const dir = move && move.dir;
  const r = move && move.r;
  const c = move && move.c;
  if (dir !== 'h' && dir !== 'v') return { error: 'Línea inválida.' };
  if (!Number.isInteger(r) || !Number.isInteger(c)) return { error: 'Línea inválida.' };
  const maxR = dir === 'h' ? n : n - 1;
  const maxC = dir === 'h' ? n - 1 : n;
  if (r < 0 || r > maxR || c < 0 || c > maxC) return { error: 'Línea fuera del tablero.' };
  if (d[dir][r][c] !== null) return { error: 'Esa línea ya está dibujada.' };

  const h = d.h.map((row) => row.slice());
  const v = d.v.map((row) => row.slice());
  const owners = d.owners.map((row) => row.slice());
  (dir === 'h' ? h : v)[r][c] = userId;

  // Cajas que toca esta línea (como mucho dos).
  const candidates = dir === 'h'
    ? [[r - 1, c], [r, c]]
    : [[r, c - 1], [r, c]];
  let claimed = 0;
  for (const [br, bc] of candidates) {
    if (br < 0 || br >= n || bc < 0 || bc >= n) continue;
    if (owners[br][bc] === null && boxClosed(h, v, br, bc)) {
      owners[br][bc] = userId;
      claimed++;
    }
  }

  const scores = { ...d.scores };
  scores[userId] = (scores[userId] || 0) + claimed;
  const data = { ...d, h, v, owners, scores, lastLine: { dir, r, c } };
  const next = { ...state, data };

  if (owners.every((row) => row.every((o) => o !== null))) {
    const [a, b] = state.players;
    const sa = scores[a.id] || 0;
    const sb = scores[b.id] || 0;
    const winnerId = sa === sb ? null : (sa > sb ? a.id : b.id);
    return { state: { ...next, status: 'finished', turn: null, winnerId, reason: 'boxes' } };
  }

  if (claimed > 0) return { state: next }; // cerró caja: vuelve a jugar
  const other = state.players.find((p) => p.id !== userId);
  return { state: { ...next, turn: other.id } };
}

module.exports = { create, applyMove };
