'use strict';
// Lógica pura del Memorama (16 cartas, 8 parejas de razas de gato).
// El tablero completo vive en state.secret (nunca se envía al cliente).
// data.cards: null (boca abajo) | {breed, owner} (owner = userId si ya es pareja encontrada, si no null).

const BREEDS = [
  'comun', 'carey', 'naranja', 'siames', 'persa', 'mainecoon', 'sphynx',
  'scottish', 'bengala', 'ragdoll', 'british', 'azulruso', 'angora', 'bombay',
];
const PAIRS = 8;
const SIZE = PAIRS * 2;

function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// players: [{id, username, cat}]; opts.layout (16 ids de raza) opcional para pruebas.
function create(players, opts = {}) {
  let layout;
  if (Array.isArray(opts.layout) && opts.layout.length === SIZE) layout = opts.layout.slice();
  else {
    const picked = shuffle(BREEDS).slice(0, PAIRS);
    layout = shuffle(picked.concat(picked));
  }
  return {
    type: 'memory',
    players,
    turn: players[0].id,
    status: 'playing',
    winnerId: null,
    reason: null,
    secret: layout,
    data: {
      cards: new Array(SIZE).fill(null),
      flipped: [],
      scores: { [players[0].id]: 0, [players[1].id]: 0 },
      lastMiss: null,
      pairsLeft: PAIRS,
    },
  };
}

function otherId(state, userId) {
  return state.players.find((p) => p.id !== userId).id;
}

function revealData(state) {
  const cards = state.data.cards.map((c, i) => c || { breed: state.secret[i], owner: null });
  return { ...state.data, cards, flipped: [], lastMiss: null };
}

function applyMove(state, userId, move) {
  if (state.status !== 'playing') return { error: 'La partida ya terminó.' };
  if (state.turn !== userId) return { error: 'No es tu turno.' };
  if (!move || typeof move !== 'object') return { error: 'Jugada inválida.' };
  const idx = move.index;
  if (!Number.isInteger(idx) || idx < 0 || idx >= SIZE) return { error: 'Esa carta no existe.' };

  const secret = state.secret;
  const data = {
    ...state.data,
    cards: state.data.cards.slice(),
    flipped: state.data.flipped.slice(),
    scores: { ...state.data.scores },
  };

  // Primero se esconde el fallo anterior (que se mostró a ambos jugadores).
  if (data.lastMiss) {
    for (const i of data.lastMiss) {
      if (data.cards[i] && data.cards[i].owner == null) data.cards[i] = null;
    }
    data.flipped = [];
    data.lastMiss = null;
  }

  if (data.cards[idx]) return { error: 'Esa carta ya está boca arriba.' };

  data.cards[idx] = { breed: secret[idx], owner: null };
  data.flipped.push(idx);

  if (data.flipped.length < 2) return { state: { ...state, data } };

  const [a, b] = data.flipped;
  if (secret[a] === secret[b]) {
    data.cards[a] = { breed: secret[a], owner: userId };
    data.cards[b] = { breed: secret[b], owner: userId };
    data.flipped = [];
    data.scores[userId] = (data.scores[userId] || 0) + 1;
    data.pairsLeft -= 1;
    if (data.pairsLeft <= 0) {
      const [p0, p1] = state.players;
      const s0 = data.scores[p0.id] || 0;
      const s1 = data.scores[p1.id] || 0;
      const winnerId = s0 > s1 ? p0.id : s1 > s0 ? p1.id : null;
      return { state: { ...state, data, status: 'finished', turn: null, winnerId, reason: 'pairs' } };
    }
    return { state: { ...state, data } }; // conserva el turno
  }

  // Fallo: ambas quedan visibles hasta la siguiente jugada y el turno pasa.
  data.lastMiss = [a, b];
  return { state: { ...state, data, turn: otherId(state, userId) } };
}

module.exports = { create, applyMove, revealData, BREEDS, PAIRS };
