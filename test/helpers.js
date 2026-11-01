'use strict';
// Utilidades compartidas por los tests del servidor.
// Cada archivo de test corre en su propio proceso (node --test), con su propio servidor
// y la base de datos en memoria (sin DATABASE_URL).
const { io: connectClient } = require('socket.io-client');

let started = null;

// Levanta el servidor una vez por archivo de test, en un puerto libre.
async function startServer() {
  if (!started) {
    const { start } = require('../server');
    started = start(0);
  }
  const server = await started;
  return `http://localhost:${server.address().port}`;
}

async function stopServer() {
  if (!started) return;
  const { io } = require('../server');
  await new Promise((resolve) => io.close(() => resolve()));
}

let counter = 0;
// Nombre de usuario único (3–20 caracteres [a-zA-Z0-9_]).
const uniqueName = (prefix = 'u') => `${prefix}${Date.now().toString(36)}${counter++}`.slice(0, 20);

async function request(base, method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

const VALID_CAT = {
  name: 'Michi',
  breed: 'comun',
  fur: '#f4a261',
  pattern: 'tabby',
  patternColor: '#8d5524',
  eyes: '#2a9d8f',
  accessory: 'bow',
  accessoryColor: '#e63946',
};

// Registra un usuario nuevo y devuelve { token, user }.
async function registerUser(base, { withCat = true } = {}) {
  const username = uniqueName();
  const { status, data } = await request(base, 'POST', '/api/register', { body: { username, password: 'secreto123' } });
  if (status !== 200) throw new Error(`registro falló: ${status} ${JSON.stringify(data)}`);
  if (withCat) await request(base, 'PUT', '/api/cat', { token: data.token, body: { cat: VALID_CAT } });
  return data;
}

// Conecta un cliente Socket.IO autenticado y espera a que la conexión esté lista.
function connect(base, token) {
  return new Promise((resolve, reject) => {
    const socket = connectClient(base, { auth: { token }, transports: ['websocket'], forceNew: true });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => {
      socket.close();
      reject(err);
    });
  });
}

// Espera el próximo evento `event` que cumpla `predicate` (con timeout para no colgar el test).
function waitFor(socket, event, predicate = () => true, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timeout esperando "${event}"`));
    }, timeoutMs);
    function handler(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }
    socket.on(event, handler);
  });
}

module.exports = { startServer, stopServer, request, registerUser, connect, waitFor, uniqueName, VALID_CAT };
