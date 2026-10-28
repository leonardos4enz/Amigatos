'use strict';
// Almacenamiento de usuarios: Postgres si hay DATABASE_URL, si no, en memoria.

function rowToUser(r) {
  if (!r) return null;
  return {
    id: Number(r.id),
    username: r.username,
    passwordHash: r.password_hash,
    cat: r.cat || null,
    wins: Number(r.wins) || 0,
    losses: Number(r.losses) || 0,
    draws: Number(r.draws) || 0,
    createdAt: r.created_at,
  };
}

function makePg(url) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: url,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  return {
    mode: 'postgres',
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          cat JSONB,
          wins INT NOT NULL DEFAULT 0,
          losses INT NOT NULL DEFAULT 0,
          draws INT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
      await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (lower(username))');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS friendships (
          user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          friend_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (user_id, friend_id)
        )`);
    },
    async createUser(username, passwordHash) {
      try {
        const { rows } = await pool.query(
          'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *',
          [username, passwordHash]
        );
        return rowToUser(rows[0]);
      } catch (e) {
        if (e.code === '23505') return null; // duplicado
        throw e;
      }
    },
    async findByUsername(username) {
      const { rows } = await pool.query('SELECT * FROM users WHERE lower(username) = lower($1)', [username]);
      return rowToUser(rows[0]);
    },
    async findById(id) {
      const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return rowToUser(rows[0]);
    },
    async updateCat(id, cat) {
      const { rows } = await pool.query('UPDATE users SET cat = $2 WHERE id = $1 RETURNING *', [id, JSON.stringify(cat)]);
      return rowToUser(rows[0]);
    },
    async recordResult(winnerId, loserId, isDraw) {
      if (isDraw) {
        await pool.query('UPDATE users SET draws = draws + 1 WHERE id = ANY($1::int[])', [[winnerId, loserId]]);
      } else {
        await pool.query('UPDATE users SET wins = wins + 1 WHERE id = $1', [winnerId]);
        await pool.query('UPDATE users SET losses = losses + 1 WHERE id = $1', [loserId]);
      }
    },
    async leaderboard(limit = 50) {
      const { rows } = await pool.query(
        'SELECT * FROM users ORDER BY wins DESC, draws DESC, losses ASC, id ASC LIMIT $1',
        [limit]
      );
      return rows.map(rowToUser);
    },
    // Amistad mutua: se guardan ambas direcciones. Devuelve true si era nueva.
    async addFriend(a, b) {
      const { rowCount } = await pool.query(
        `INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2), ($2, $1)
         ON CONFLICT DO NOTHING`,
        [a, b]
      );
      return rowCount > 0;
    },
    async removeFriend(a, b) {
      const { rowCount } = await pool.query(
        'DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
        [a, b]
      );
      return rowCount > 0;
    },
    async isFriend(a, b) {
      const { rows } = await pool.query('SELECT 1 FROM friendships WHERE user_id = $1 AND friend_id = $2', [a, b]);
      return rows.length > 0;
    },
    async listFriends(userId) {
      const { rows } = await pool.query(
        `SELECT u.* FROM friendships f JOIN users u ON u.id = f.friend_id
         WHERE f.user_id = $1 ORDER BY lower(u.username)`,
        [userId]
      );
      return rows.map(rowToUser);
    },
    async searchUsers(q, excludeId, limit = 10) {
      const esc = String(q).toLowerCase().replace(/[\\%_]/g, (c) => '\\' + c);
      const { rows } = await pool.query(
        `SELECT * FROM users
         WHERE id <> $2 AND lower(username) LIKE '%' || $1 || '%'
         ORDER BY (lower(username) LIKE $1 || '%') DESC, lower(username) ASC
         LIMIT $3`,
        [esc, excludeId, limit]
      );
      return rows.map(rowToUser);
    },
  };
}

function makeMemory() {
  const users = new Map();
  const friends = new Map(); // userId -> Map<friendId, createdAt>
  let nextId = 1;
  const friendSet = (id) => {
    if (!friends.has(id)) friends.set(id, new Map());
    return friends.get(id);
  };
  const clone = (u) => (u ? { ...u, cat: u.cat ? { ...u.cat } : null } : null);
  return {
    mode: 'memory',
    async init() {},
    async createUser(username, passwordHash) {
      const lower = username.toLowerCase();
      for (const u of users.values()) if (u.username.toLowerCase() === lower) return null;
      const u = { id: nextId++, username, passwordHash, cat: null, wins: 0, losses: 0, draws: 0, createdAt: new Date() };
      users.set(u.id, u);
      return clone(u);
    },
    async findByUsername(username) {
      const lower = String(username).toLowerCase();
      for (const u of users.values()) if (u.username.toLowerCase() === lower) return clone(u);
      return null;
    },
    async findById(id) {
      return clone(users.get(Number(id)));
    },
    async updateCat(id, cat) {
      const u = users.get(Number(id));
      if (!u) return null;
      u.cat = { ...cat };
      return clone(u);
    },
    async recordResult(winnerId, loserId, isDraw) {
      const w = users.get(Number(winnerId));
      const l = users.get(Number(loserId));
      if (isDraw) {
        if (w) w.draws++;
        if (l) l.draws++;
      } else {
        if (w) w.wins++;
        if (l) l.losses++;
      }
    },
    async leaderboard(limit = 50) {
      return [...users.values()]
        .sort((a, b) => b.wins - a.wins || b.draws - a.draws || a.losses - b.losses || a.id - b.id)
        .slice(0, limit)
        .map(clone);
    },
    async addFriend(a, b) {
      a = Number(a); b = Number(b);
      if (!users.has(a) || !users.has(b)) return false;
      if (friendSet(a).has(b)) return false;
      const now = new Date();
      friendSet(a).set(b, now);
      friendSet(b).set(a, now);
      return true;
    },
    async removeFriend(a, b) {
      a = Number(a); b = Number(b);
      const had = friendSet(a).delete(b);
      const had2 = friendSet(b).delete(a);
      return had || had2;
    },
    async isFriend(a, b) {
      return friendSet(Number(a)).has(Number(b));
    },
    async listFriends(userId) {
      return [...friendSet(Number(userId)).keys()]
        .map((id) => users.get(id))
        .filter(Boolean)
        .sort((x, y) => x.username.toLowerCase().localeCompare(y.username.toLowerCase()))
        .map(clone);
    },
    async searchUsers(q, excludeId, limit = 10) {
      const lq = String(q).toLowerCase();
      return [...users.values()]
        .filter((u) => u.id !== Number(excludeId) && u.username.toLowerCase().includes(lq))
        .sort((x, y) => {
          const px = x.username.toLowerCase().startsWith(lq) ? 0 : 1;
          const py = y.username.toLowerCase().startsWith(lq) ? 0 : 1;
          return px - py || x.username.toLowerCase().localeCompare(y.username.toLowerCase());
        })
        .slice(0, limit)
        .map(clone);
    },
  };
}

const impl = process.env.DATABASE_URL ? makePg(process.env.DATABASE_URL) : makeMemory();
module.exports = impl;
