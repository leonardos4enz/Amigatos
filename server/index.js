'use strict';
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const fs = require('fs');
const db = require('./db');

// Cada archivo de server/games/ es un juego: exporta create(players) y applyMove(state, userId, move),
// y opcionalmente revealData(state) para destapar la info oculta (state.secret) si alguien abandona.
// El id del juego es el nombre del archivo.
const GAMES = {};
for (const file of fs.readdirSync(path.join(__dirname, 'games'))) {
  if (file.endsWith('.js')) GAMES[path.basename(file, '.js')] = require(path.join(__dirname, 'games', file));
}
console.log('[amigatos] juegos:', Object.keys(GAMES).join(', '));
const PORT = process.env.PORT || 3000;
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  JWT_SECRET = 'amigatos-dev-secret-cambiame';
  console.warn('[amigatos] ADVERTENCIA: JWT_SECRET no está definido; usando un secreto de desarrollo. ¡Defínelo en producción!');
}

// ---------- Utilidades ----------
const PATTERNS = ['solid', 'tabby', 'spots', 'tuxedo', 'calico', 'siamese', 'tortie'];
const ACCESSORIES = ['none', 'bow', 'hat', 'scarf', 'crown', 'glasses', 'flower'];
const BREEDS = ['comun', 'carey', 'siames', 'persa', 'mainecoon', 'sphynx', 'scottish', 'bengala', 'ragdoll', 'british', 'azulruso', 'angora', 'bombay', 'naranja'];
const HEX = /^#[0-9a-fA-F]{6}$/;

function validateCat(input) {
  if (!input || typeof input !== 'object') return { error: 'Falta el gato.' };
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length < 1 || name.length > 16) return { error: 'El nombre del gato debe tener entre 1 y 16 caracteres.' };
  for (const key of ['fur', 'patternColor', 'eyes', 'accessoryColor']) {
    if (typeof input[key] !== 'string' || !HEX.test(input[key])) {
      return { error: `Color inválido en "${key}" (usa formato #rrggbb).` };
    }
  }
  if (!PATTERNS.includes(input.pattern)) return { error: 'Patrón de pelaje inválido.' };
  if (!ACCESSORIES.includes(input.accessory)) return { error: 'Accesorio inválido.' };
  return {
    cat: {
      name,
      breed: BREEDS.includes(input.breed) ? input.breed : 'comun',
      bg: typeof input.bg === 'string' && /^[a-z0-9]{2,20}$/.test(input.bg) ? input.bg : 'cuarto',
      fur: input.fur.toLowerCase(),
      pattern: input.pattern,
      patternColor: input.patternColor.toLowerCase(),
      eyes: input.eyes.toLowerCase(),
      accessory: input.accessory,
      accessoryColor: input.accessoryColor.toLowerCase(),
    },
  };
}

function publicUser(u) {
  return { id: u.id, username: u.username, cat: u.cat || null, wins: u.wins, losses: u.losses, draws: u.draws };
}
function miniUser(u) {
  return { id: u.id, username: u.username, cat: u.cat || null };
}
function signToken(user) {
  return jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '30d' });
}
async function userFromToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return await db.findById(payload.uid);
  } catch {
    return null;
  }
}

// ---------- Express ----------
const app = express();
app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => res.type('text').send('ok'));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const user = await userFromToken(token);
  if (!user) return res.status(401).json({ error: 'Sesión inválida. Vuelve a iniciar sesión.' });
  req.user = user;
  next();
}

app.post('/api/register', wrap(async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'El usuario debe tener de 3 a 20 caracteres (letras, números o _).' });
  }
  if (typeof password !== 'string' || password.length < 4) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres.' });
  }
  if (password.length > 200) return res.status(400).json({ error: 'La contraseña es demasiado larga.' });
  if (await db.findByUsername(username)) return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });
  const hash = await bcrypt.hash(password, 10);
  const user = await db.createUser(username, hash);
  if (!user) return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });
  res.json({ token: signToken(user), user: publicUser(user) });
}));

app.post('/api/login', wrap(async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({ error: 'Escribe tu usuario y contraseña.' });
  }
  const user = await db.findByUsername(username);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
}));

app.get('/api/me', wrap(auth), (req, res) => res.json({ user: publicUser(req.user) }));

app.put('/api/cat', wrap(auth), wrap(async (req, res) => {
  const v = validateCat(req.body && req.body.cat);
  if (v.error) return res.status(400).json({ error: v.error });
  const user = await db.updateCat(req.user.id, v.cat);
  const entry = online.get(user.id);
  if (entry) {
    entry.user = user;
    broadcastPresence();
  }
  res.json({ user: publicUser(user) });
}));

app.get('/api/leaderboard', wrap(async (req, res) => {
  const list = await db.leaderboard(50);
  res.json({ players: list.map((u) => ({ username: u.username, cat: u.cat || null, wins: u.wins, losses: u.losses, draws: u.draws })) });
}));

// ---------- Amigos (mutuos e inmediatos, sin solicitudes) ----------
function friendView(u) {
  const isOnline = online.has(u.id);
  return {
    ...publicUser(u),
    online: isOnline,
    status: !isOnline ? 'offline' : isPlaying(u.id) ? 'playing' : 'idle',
  };
}
function notifyFriends(...uids) {
  for (const uid of uids) io.to(room(uid)).emit('friends:updated');
}

app.get('/api/friends', wrap(auth), wrap(async (req, res) => {
  const list = await db.listFriends(req.user.id);
  res.json({ friends: list.map(friendView) });
}));

app.post('/api/friends', wrap(auth), wrap(async (req, res) => {
  const username = req.body && typeof req.body.username === 'string' ? req.body.username.trim() : '';
  if (!username) return res.status(400).json({ error: 'Escribe el nombre de usuario de tu amiga/o.' });
  const other = await db.findByUsername(username);
  if (!other) return res.status(404).json({ error: 'No existe ese usuario' });
  if (other.id === req.user.id) return res.status(400).json({ error: 'No puedes agregarte a ti misma/o' });
  if (await db.isFriend(req.user.id, other.id)) return res.status(409).json({ error: 'Ya son amigos' });
  await db.addFriend(req.user.id, other.id);
  notifyFriends(req.user.id, other.id);
  res.json({ friend: friendView(other) });
}));

app.delete('/api/friends/:id', wrap(auth), wrap(async (req, res) => {
  const fid = Number(req.params.id);
  if (!Number.isInteger(fid) || fid <= 0) return res.status(400).json({ error: 'Amiga/o inválida/o.' });
  const removed = await db.removeFriend(req.user.id, fid);
  if (removed) notifyFriends(req.user.id, fid);
  res.json({ ok: true });
}));

app.get('/api/users/search', wrap(auth), wrap(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 20) : '';
  if (q.length < 1) return res.status(400).json({ error: 'Escribe al menos una letra para buscar.' });
  const [found, friends] = await Promise.all([db.searchUsers(q, req.user.id, 10), db.listFriends(req.user.id)]);
  const ids = new Set(friends.map((f) => f.id));
  res.json({ users: found.map((u) => ({ id: u.id, username: u.username, cat: u.cat || null, isFriend: ids.has(u.id) })) });
}));

// Perfil público (para la tarjeta flotante al picar la foto de alguien)
app.get('/api/profile/:username', wrap(auth), wrap(async (req, res) => {
  const u = await db.findByUsername(String(req.params.username || '').slice(0, 20));
  if (!u) return res.status(404).json({ error: 'No existe ese usuario' });
  const isMe = u.id === req.user.id;
  res.json({ profile: { ...friendView(u), isMe, isFriend: isMe ? false : await db.isFriend(req.user.id, u.id) } });
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')) {
    return res.status(400).json({ error: 'Solicitud inválida.' });
  }
  console.error('[amigatos] error:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// ---------- Socket.IO ----------
const server = http.createServer(app);
const io = new Server(server);

// userId -> { user, sockets: Set<socketId>, gameId: string|null }
const online = new Map();
// inviteId -> { id, fromId, toId, game }
const invites = new Map();
// gameId -> { state (interno, puede tener secret), rematch: Set<userId>, left: Set<userId>, recorded }
const games = new Map();

const room = (uid) => `user:${uid}`;
const newId = () => crypto.randomBytes(6).toString('hex');

function activeGameOf(uid) {
  const e = online.get(uid);
  if (!e || !e.gameId) return null;
  const g = games.get(e.gameId);
  return g && g.state.status === 'playing' ? g : null;
}
function isPlaying(uid) {
  return !!activeGameOf(uid);
}

function presenceList() {
  return [...online.values()].map((e) => ({
    ...miniUser(e.user),
    status: isPlaying(e.user.id) ? 'playing' : 'idle',
  }));
}
function broadcastPresence() {
  io.emit('presence', presenceList());
}

function publicState(state) {
  const { secret, ...rest } = state; // nunca enviar la palabra secreta
  return rest;
}

function emitToPlayers(game, event, payload) {
  for (const p of game.state.players) io.to(room(p.id)).emit(event, payload);
}

function sendError(socket, message) {
  socket.emit('error:msg', { message });
}

function dropInvitesOf(uid) {
  for (const [id, inv] of invites) if (inv.fromId === uid || inv.toId === uid) invites.delete(id);
}

function startGame(type, players) {
  const id = newId();
  const state = { id, ...GAMES[type].create(players) };
  const game = { state, rematch: new Set(), left: new Set(), recorded: false };
  games.set(id, game);
  for (const p of players) {
    dropInvitesOf(p.id);
    const e = online.get(p.id);
    if (e) e.gameId = id;
  }
  emitToPlayers(game, 'game:state', publicState(state));
  broadcastPresence();
  return game;
}

async function finishGame(game) {
  const s = game.state;
  emitToPlayers(game, 'game:state', publicState(s));
  emitToPlayers(game, 'game:over', { state: publicState(s) });
  broadcastPresence();
  if (game.recorded) return;
  game.recorded = true;
  const [a, b] = s.players;
  try {
    if (s.winnerId == null) await db.recordResult(a.id, b.id, true);
    else await db.recordResult(s.winnerId, s.winnerId === a.id ? b.id : a.id, false);
    for (const p of s.players) {
      const u = await db.findById(p.id);
      if (!u) continue;
      const e = online.get(u.id);
      if (e) e.user = u;
      io.to(room(u.id)).emit('user:updated', { user: publicUser(u) });
    }
  } catch (err) {
    console.error('[amigatos] no se pudo guardar el resultado:', err);
  }
}

function abandon(game, leaverId) {
  const s = game.state;
  if (s.status !== 'playing') return;
  const winner = s.players.find((p) => p.id !== leaverId);
  const mod = GAMES[s.type];
  const data = mod.revealData ? mod.revealData(s) : s.data;
  game.state = { ...s, status: 'finished', turn: null, winnerId: winner.id, reason: 'abandon', data };
  game.left.add(leaverId);
  finishGame(game);
}

function getPlayerGame(socket, gameId) {
  const g = games.get(gameId);
  if (!g || !g.state.players.some((p) => p.id === socket.data.uid)) {
    sendError(socket, 'Esa partida no existe.');
    return null;
  }
  return g;
}

io.use(async (socket, next) => {
  const user = await userFromToken(socket.handshake.auth && socket.handshake.auth.token);
  if (!user) return next(new Error('auth'));
  socket.data.uid = user.id;
  socket.data.user = user;
  next();
});

io.on('connection', (socket) => {
  const uid = socket.data.uid;
  let entry = online.get(uid);
  if (!entry) {
    entry = { user: socket.data.user, sockets: new Set(), gameId: null };
    online.set(uid, entry);
  } else {
    entry.user = socket.data.user;
  }
  entry.sockets.add(socket.id);
  socket.join(room(uid));
  broadcastPresence();

  // Si ya estaba en una partida (otra pestaña), mandarle el estado actual.
  const current = activeGameOf(uid);
  if (current) socket.emit('game:state', publicState(current.state));

  const me = () => online.get(uid).user;

  socket.on('invite:send', (payload = {}) => {
    const toUserId = Number(payload.toUserId);
    const type = payload.game;
    if (!GAMES[type]) return sendError(socket, 'Juego desconocido.');
    if (toUserId === uid) return sendError(socket, 'No puedes invitarte a ti misma/o.');
    if (!online.has(toUserId)) return sendError(socket, 'Esa persona no está conectada.');
    if (isPlaying(uid)) return sendError(socket, 'Ya estás en una partida.');
    if (isPlaying(toUserId)) return sendError(socket, 'Esa persona ya está jugando.');
    for (const inv of invites.values()) {
      if (inv.fromId === uid && inv.toId === toUserId) return sendError(socket, 'Ya le enviaste una invitación.');
    }
    const inv = { id: newId(), fromId: uid, toId: toUserId, game: type };
    invites.set(inv.id, inv);
    io.to(room(toUserId)).emit('invite:received', { inviteId: inv.id, from: miniUser(me()), game: type });
  });

  socket.on('invite:respond', (payload = {}) => {
    const inv = invites.get(payload.inviteId);
    if (!inv || inv.toId !== uid) return sendError(socket, 'La invitación ya no es válida.');
    invites.delete(inv.id);
    if (!payload.accept) {
      io.to(room(inv.fromId)).emit('invite:declined', { inviteId: inv.id, by: { id: uid, username: me().username } });
      return;
    }
    const from = online.get(inv.fromId);
    if (!from) return sendError(socket, 'Quien te invitó ya no está conectada/o.');
    if (isPlaying(inv.fromId)) return sendError(socket, 'Quien te invitó ya está en otra partida.');
    if (isPlaying(uid)) return sendError(socket, 'Ya estás en una partida.');
    startGame(inv.game, [miniUser(from.user), miniUser(me())]);
  });

  socket.on('game:move', (payload = {}) => {
    const g = getPlayerGame(socket, payload.gameId);
    if (!g) return;
    if (g.state.status !== 'playing') return sendError(socket, 'La partida ya terminó.');
    const res = GAMES[g.state.type].applyMove(g.state, uid, payload.move);
    if (res.error) return sendError(socket, res.error);
    g.state = res.state;
    if (g.state.status === 'finished') finishGame(g);
    else emitToPlayers(g, 'game:state', publicState(g.state));
  });

  socket.on('game:rematch', (payload = {}) => {
    const g = getPlayerGame(socket, payload.gameId);
    if (!g) return;
    if (g.state.status !== 'finished') return sendError(socket, 'La partida aún no termina.');
    if (g.rematchStarted) return sendError(socket, 'La revancha ya empezó.');
    const opp = g.state.players.find((p) => p.id !== uid);
    if (g.left.has(opp.id) || !online.has(opp.id)) return sendError(socket, 'Tu rival ya salió de la partida.');
    if (g.rematch.has(uid)) return;
    g.rematch.add(uid);
    if (g.rematch.size < 2) {
      io.to(room(opp.id)).emit('game:rematch', { gameId: g.state.id, requestedBy: uid });
      return;
    }
    if (isPlaying(uid) || isPlaying(opp.id)) return sendError(socket, 'Alguien ya está en otra partida.');
    g.rematchStarted = true;
    const [a, b] = g.state.players;
    // Alterna quién empieza: el segundo jugador pasa a ser players[0].
    const players = [b, a].map((p) => miniUser(online.get(p.id).user));
    games.delete(g.state.id);
    startGame(g.state.type, players);
  });

  socket.on('game:leave', (payload = {}) => {
    const g = games.get(payload.gameId);
    if (!g || !g.state.players.some((p) => p.id === uid)) return;
    g.left.add(uid);
    if (g.state.status === 'playing') abandon(g, uid);
    const e = online.get(uid);
    if (e && e.gameId === g.state.id) e.gameId = null;
    if (g.state.players.every((p) => g.left.has(p.id))) games.delete(g.state.id);
    broadcastPresence();
  });

  socket.on('chat:send', (payload = {}) => {
    const g = getPlayerGame(socket, payload.gameId);
    if (!g) return;
    const text = typeof payload.text === 'string' ? payload.text.trim().slice(0, 200) : '';
    if (!text) return;
    emitToPlayers(g, 'chat:msg', { gameId: g.state.id, from: { id: uid, username: me().username }, text, ts: Date.now() });
  });

  socket.on('disconnect', () => {
    const e = online.get(uid);
    if (!e) return;
    e.sockets.delete(socket.id);
    if (e.sockets.size > 0) return;
    // Última pestaña cerrada.
    const g = activeGameOf(uid);
    online.delete(uid);
    dropInvitesOf(uid);
    if (g) abandon(g, uid);
    // Marca como "salió" en partidas terminadas para que no haya revancha pendiente.
    for (const [id, game] of games) {
      if (game.state.players.some((p) => p.id === uid)) {
        game.left.add(uid);
        if (game.state.players.every((p) => game.left.has(p.id))) games.delete(id);
      }
    }
    broadcastPresence();
  });
});

db.init()
  .then(() => {
    server.listen(PORT, () => console.log(`[amigatos] escuchando en http://localhost:${PORT} (db: ${db.mode})`));
  })
  .catch((err) => {
    console.error('[amigatos] no se pudo iniciar la base de datos:', err);
    process.exit(1);
  });
