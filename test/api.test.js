'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, request, registerUser, uniqueName, VALID_CAT } = require('./helpers');

let base;
before(async () => { base = await startServer(); });
after(stopServer);

test('GET /health responde ok', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'ok');
});

test('registro crea la cuenta y devuelve token y usuario sin gato', async () => {
  const username = uniqueName();
  const { status, data } = await request(base, 'POST', '/api/register', { body: { username, password: 'secreto123' } });
  assert.equal(status, 200);
  assert.equal(typeof data.token, 'string');
  assert.equal(data.user.username, username);
  assert.equal(data.user.cat, null);
  assert.deepEqual([data.user.wins, data.user.losses, data.user.draws], [0, 0, 0]);
});

test('registro rechaza nombres inválidos y repetidos', async () => {
  const bad = await request(base, 'POST', '/api/register', { body: { username: 'a!', password: 'secreto123' } });
  assert.equal(bad.status, 400);
  const username = uniqueName();
  await request(base, 'POST', '/api/register', { body: { username, password: 'secreto123' } });
  const dup = await request(base, 'POST', '/api/register', { body: { username, password: 'otraclave' } });
  assert.equal(dup.status, 409);
});

test('login con contraseña correcta e incorrecta', async () => {
  const username = uniqueName();
  await request(base, 'POST', '/api/register', { body: { username, password: 'secreto123' } });
  const ok = await request(base, 'POST', '/api/login', { body: { username, password: 'secreto123' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.username, username);
  const wrong = await request(base, 'POST', '/api/login', { body: { username, password: 'mala' } });
  assert.equal(wrong.status, 401);
});

test('GET /api/me exige sesión', async () => {
  assert.equal((await request(base, 'GET', '/api/me')).status, 401);
  const { token, user } = await registerUser(base, { withCat: false });
  const me = await request(base, 'GET', '/api/me', { token });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.id, user.id);
});

test('PUT /api/cat guarda un gato válido y rechaza colores inválidos', async () => {
  const { token } = await registerUser(base, { withCat: false });
  const ok = await request(base, 'PUT', '/api/cat', { token, body: { cat: VALID_CAT } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.cat.name, 'Michi');
  const bad = await request(base, 'PUT', '/api/cat', { token, body: { cat: { ...VALID_CAT, fur: 'rojo' } } });
  assert.equal(bad.status, 400);
});

test('amigos: agregar, listar y quitar', async () => {
  const a = await registerUser(base);
  const b = await registerUser(base);
  const add = await request(base, 'POST', '/api/friends', { token: a.token, body: { username: b.user.username } });
  assert.equal(add.status, 200);
  const list = await request(base, 'GET', '/api/friends', { token: b.token });
  assert.ok(list.data.friends.some((f) => f.id === a.user.id), 'la amistad es mutua');
  await request(base, 'DELETE', `/api/friends/${b.user.id}`, { token: a.token });
  const after = await request(base, 'GET', '/api/friends', { token: a.token });
  assert.equal(after.data.friends.length, 0);
});

test('rutas de API desconocidas devuelven 404 en JSON', async () => {
  const res = await request(base, 'GET', '/api/no-existe');
  assert.equal(res.status, 404);
  assert.equal(typeof res.data.error, 'string');
});
