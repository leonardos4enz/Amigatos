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
  };
}

function makeMemory() {
  const users = new Map();
  let nextId = 1;
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
  };
}

const impl = process.env.DATABASE_URL ? makePg(process.env.DATABASE_URL) : makeMemory();
module.exports = impl;
