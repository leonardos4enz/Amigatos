'use strict';
// Reglas puras del mundo de Amigatos: catálogo de salas, límites de movimiento y anti-abuso.
// Esta es la única fuente de verdad de la geometría: el servidor la usa para validar,
// el cliente la copia para dibujar y los tests la comparan.
//
// Coordenadas lógicas enteras: x 0..width, y 0..height (96x72, como los fondos de CatBG).

// Máximo de movimientos por persona dentro de la ventana deslizante.
const MOVE_WINDOW_MS = 1000;
const MOVE_MAX = 12;

const ROOMS = {
  plaza: {
    id: 'plaza',
    name: 'Plaza Bigotes',
    bg: 'plaza',
    width: 96,
    height: 72,
    spawn: { x: 48, y: 60 },
    exits: [
      {
        x: 0, y: 30, w: 8, h: 14,
        to: 'parque',
        toSpawn: { x: 84, y: 56 },
        label: 'Parque Ronroneo',
      },
      {
        x: 88, y: 30, w: 8, h: 14,
        to: 'cafe',
        toSpawn: { x: 12, y: 56 },
        label: 'Café del Ovillo',
      },
    ],
  },
  parque: {
    id: 'parque',
    name: 'Parque Ronroneo',
    bg: 'parque',
    width: 96,
    height: 72,
    spawn: { x: 48, y: 60 },
    exits: [
      {
        x: 88, y: 30, w: 8, h: 14,
        to: 'plaza',
        toSpawn: { x: 12, y: 37 },
        label: 'Plaza Bigotes',
      },
    ],
  },
  cafe: {
    id: 'cafe',
    name: 'Café del Ovillo',
    bg: 'cafe',
    width: 96,
    height: 72,
    spawn: { x: 48, y: 58 },
    exits: [
      {
        x: 0, y: 30, w: 8, h: 14,
        to: 'plaza',
        toSpawn: { x: 84, y: 37 },
        label: 'Plaza Bigotes',
      },
    ],
  },
};

// ------------------------------------------------------------------
// salas
// ------------------------------------------------------------------

function isValidRoom(id) {
  return Object.prototype.hasOwnProperty.call(ROOMS, id);
}

// Devuelve la sala o null si el id no existe.
function getRoom(id) {
  return isValidRoom(id) ? ROOMS[id] : null;
}

// ¿El punto está dentro del rectángulo de la sala (bordes incluidos)?
function isInsideRoom(room, x, y) {
  if (!room) return false;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return x >= 0 && x <= room.width && y >= 0 && y <= room.height;
}

// Ajusta un punto a los límites de la sala, en coordenadas enteras.
function clampToRoom(room, x, y) {
  if (!room) return { x: 0, y: 0 };
  const cx = Number.isFinite(x) ? Math.round(x) : 0;
  const cy = Number.isFinite(y) ? Math.round(y) : 0;
  return {
    x: Math.min(Math.max(cx, 0), room.width),
    y: Math.min(Math.max(cy, 0), room.height),
  };
}

// ¿El punto cae dentro de este rectángulo de salida? (ancho/alto con el borde derecho
// y el inferior exclusivos: cubre x..x+w-1, y..y+h-1).
function isInsideExit(exit, x, y) {
  return x >= exit.x && x < exit.x + exit.w && y >= exit.y && y < exit.y + exit.h;
}

// Devuelve la salida que contiene el punto, o null.
function exitAt(room, x, y) {
  if (!room || !Array.isArray(room.exits)) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return room.exits.find((exit) => isInsideExit(exit, x, y)) || null;
}

// ------------------------------------------------------------------
// regla anti-bucle
// ------------------------------------------------------------------

// El spawn de cada sala y el toSpawn de cada salida no pueden caer dentro de una salida
// de la sala destino: si lo hicieran, el gato entraría a la sala y rebotaría de inmediato
// contra la salida opuesta, sin poder avanzar nunca.
// Devuelve la lista de violaciones (vacía si todo está bien).
function validateRooms(rooms = ROOMS) {
  const problems = [];

  for (const room of Object.values(rooms)) {
    // El spawn no puede estar sobre una salida de su propia sala.
    for (const exit of room.exits || []) {
      if (isInsideExit(exit, room.spawn.x, room.spawn.y)) {
        problems.push(`spawn de "${room.id}" cae dentro de la salida hacia "${exit.to}"`);
      }
    }

    // El toSpawn no puede estar sobre una salida de la sala a la que se entra.
    for (const exit of room.exits || []) {
      const target = rooms[exit.to];
      if (!target) {
        problems.push(`la salida de "${room.id}" apunta a una sala inexistente: "${exit.to}"`);
        continue;
      }
      for (const targetExit of target.exits || []) {
        if (isInsideExit(targetExit, exit.toSpawn.x, exit.toSpawn.y)) {
          problems.push(
            `toSpawn de "${room.id}"→"${exit.to}" cae dentro de una salida de "${exit.to}"`
          );
        }
      }
    }
  }

  return problems;
}

// ------------------------------------------------------------------
// anti-abuso: ventana deslizante de movimientos
// ------------------------------------------------------------------

// times: array de marcas de tiempo (ms) de los movimientos aceptados.
// now:   momento actual (ms).
// opts:  { windowMs, max } con valores por defecto 1000 ms y 12 movimientos.
// Devuelve { allowed, times }: times ya filtrado a la última ventana (incluye `now`
// cuando el movimiento se acepta), listo para volver a guardarlo.
function allowMove(times, now, opts = {}) {
  const windowMs = Number.isFinite(opts.windowMs) ? opts.windowMs : MOVE_WINDOW_MS;
  const max = Number.isFinite(opts.max) ? opts.max : MOVE_MAX;
  const list = Array.isArray(times) ? times : [];

  const recent = list.filter((t) => Number.isFinite(t) && now - t < windowMs);

  if (recent.length >= max) {
    return { allowed: false, times: recent };
  }

  return { allowed: true, times: recent.concat(now) };
}

// Autocomprobación: si el catálogo se rompe, el servidor no debe arrancar con geometría inválida.
const problems = validateRooms();
if (problems.length > 0) {
  throw new Error(`Geometría del mundo inválida: ${problems.join('; ')}`);
}

module.exports = {
  ROOMS,
  MOVE_WINDOW_MS,
  MOVE_MAX,
  isValidRoom,
  getRoom,
  isInsideRoom,
  clampToRoom,
  exitAt,
  allowMove,
  validateRooms,
};
