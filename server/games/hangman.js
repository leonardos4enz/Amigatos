'use strict';
// Lógica pura del Ahorcado competitivo por turnos.
const { randomWord } = require('../words');

const MAX_WRONG = 6;

function normalize(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O')
    .replace(/[ÚÜ]/g, 'U')
    .trim()
    .replace(/\s+/g, ' ');
}

function maskWord(word, guessed) {
  return [...word].map((ch) => (ch === ' ' ? ' ' : guessed.includes(ch) ? ch : null));
}

// players: [{id, username, cat}]; opts.word/opts.category opcionales (para pruebas).
// La palabra secreta se guarda en state.secret (no se envía al cliente; ver publicState en index.js).
function create(players, opts = {}) {
  const pick = opts.word ? { word: normalize(opts.word), category: opts.category || 'Varios' } : randomWord();
  return {
    type: 'hangman',
    players,
    turn: players[0].id,
    status: 'playing',
    winnerId: null,
    reason: null,
    secret: pick.word,
    data: {
      masked: maskWord(pick.word, []),
      category: pick.category,
      guessed: [],
      wrong: 0,
      maxWrong: MAX_WRONG,
      scores: { [players[0].id]: 0, [players[1].id]: 0 },
      word: null,
    },
  };
}

function finish(state, reason) {
  const [a, b] = state.players;
  const sa = state.data.scores[a.id];
  const sb = state.data.scores[b.id];
  const winnerId = sa > sb ? a.id : sb > sa ? b.id : null;
  return {
    ...state,
    status: 'finished',
    turn: null,
    winnerId,
    reason,
    data: { ...state.data, masked: [...state.secret], word: state.secret },
  };
}

function otherId(state, userId) {
  return state.players.find((p) => p.id !== userId).id;
}

function applyMove(state, userId, move) {
  if (state.status !== 'playing') return { error: 'La partida ya terminó.' };
  if (state.turn !== userId) return { error: 'No es tu turno.' };
  if (!move || typeof move !== 'object') return { error: 'Jugada inválida.' };

  const secret = state.secret;
  const data = { ...state.data, scores: { ...state.data.scores }, guessed: state.data.guessed.slice() };

  if (typeof move.word === 'string') {
    const guess = normalize(move.word);
    if (!guess || !/^[A-ZÑ ]+$/.test(guess)) return { error: 'Escribe una palabra válida (solo letras).' };
    if (guess === secret) {
      data.scores[userId] += 3;
      return { state: finish({ ...state, data }, 'word') };
    }
    data.wrong += 1;
    const next = { ...state, data, turn: otherId(state, userId) };
    if (data.wrong >= data.maxWrong) return { state: finish(next, 'hanged') };
    return { state: next };
  }

  if (typeof move.letter === 'string') {
    const letter = normalize(move.letter);
    if (!/^[A-ZÑ]$/.test(letter)) return { error: 'Escribe una sola letra (A-Z o Ñ).' };
    if (data.guessed.includes(letter)) return { error: 'Esa letra ya se intentó.' };
    data.guessed.push(letter);
    const hits = [...secret].filter((ch) => ch === letter).length;
    if (hits > 0) {
      data.scores[userId] += hits;
      data.masked = maskWord(secret, data.guessed);
      const next = { ...state, data };
      if (data.masked.every((c) => c !== null)) return { state: finish(next, 'word') };
      return { state: next }; // conserva el turno
    }
    data.wrong += 1;
    const next = { ...state, data, turn: otherId(state, userId) };
    if (data.wrong >= data.maxWrong) return { state: finish(next, 'hanged') };
    return { state: next };
  }

  return { error: 'Jugada inválida.' };
}

function revealData(state) {
  return { ...state.data, word: state.secret, masked: [...state.secret] };
}

module.exports = { create, applyMove, revealData, MAX_WRONG };
