'use strict';
// Reglas puras del mundo de Amigatos: catálogo de salas, límites de movimiento y anti-abuso.
// Esta es la única fuente de verdad de la geometría: el servidor la usa para validar,
// el cliente la copia para dibujar y los tests la comparan.
//
// Coordenadas lógicas enteras: x 0..width, y 0..height (320x200, como las salas del mundo).

// Máximo de movimientos por persona dentro de la ventana deslizante.
const MOVE_WINDOW_MS = 1000;
const MOVE_MAX = 12;

// Rectángulo como polígono de coordenadas lógicas enteras (sentido antihorario).
function rect(x0, y0, x1, y1) {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

const ROOMS = {
  plaza: {
    id: 'plaza',
    name: 'Plaza Bigotes',
    bg: 'plaza',
    width: 320,
    height: 200,
    // La línea de suelo está en y=110: por encima solo hay cielo y los tejados.
    // El parque queda al oeste (salida de la izquierda) y el café al este (derecha).
    spawn: { x: 100, y: 180 },
    // Los adoquines de la plaza. La fuente del centro (x 140..180, y 145..200)
    // no se puede pisar: se rodea por detrás (y 110..145).
    walkable: [
      rect(0, 110, 140, 200),   // adoquines a la izquierda de la fuente
      rect(180, 110, 320, 200), // adoquines a la derecha de la fuente
      rect(140, 110, 180, 145), // adoquines detrás de la fuente
    ],
    exits: [
      {
        // Un camino que se sale del cuadro por la izquierda (hacia el parque).
        x: 0, y: 130, w: 16, h: 40,
        to: 'parque',
        toSpawn: { x: 290, y: 180 },
        label: 'Parque Ronroneo',
      },
      {
        // Y otro por la derecha (hacia el café).
        x: 304, y: 130, w: 16, h: 40,
        to: 'cafe',
        toSpawn: { x: 30, y: 180 },
        label: 'Café del Ovillo',
      },
    ],
  },
  parque: {
    id: 'parque',
    name: 'Parque Ronroneo',
    bg: 'parque',
    width: 320,
    height: 200,
    // Misma línea de suelo que en la plaza: el parque empieza en y=110.
    // La puerta a la plaza está al este, en el lado opuesto al de la plaza.
    spawn: { x: 240, y: 180 },
    // El césped del parque. El estanque (x 100..220, y 145..200) no se puede pisar:
    // se rodea por detrás (y 110..145).
    walkable: [
      rect(0, 110, 100, 200),   // césped de la izquierda
      rect(220, 110, 320, 200), // césped de la derecha
      rect(100, 110, 220, 145), // césped detrás del estanque
    ],
    exits: [
      {
        x: 304, y: 130, w: 16, h: 40,
        to: 'plaza',
        toSpawn: { x: 30, y: 180 },
        label: 'Plaza Bigotes',
      },
    ],
  },
  cafe: {
    id: 'cafe',
    name: 'Café del Ovillo',
    bg: 'cafe',
    width: 320,
    height: 200,
    // Interior: la pared con las estanterías baja hasta y=110, el suelo empieza ahí.
    // La puerta a la plaza está al oeste, en el lado opuesto al de la plaza.
    spawn: { x: 200, y: 180 },
    // El suelo del café. El mostrador (x 60..180, y 110..150) y la mesa grande
    // (x 240..320, y 155..200) no se pueden pisar.
    walkable: [
      rect(0, 110, 60, 200),    // suelo junto a la puerta
      rect(60, 150, 180, 200),  // suelo delante del mostrador
      rect(180, 110, 240, 200), // suelo central
      rect(240, 110, 320, 155), // suelo detrás de la mesa
    ],
    exits: [
      {
        x: 0, y: 130, w: 16, h: 40,
        to: 'plaza',
        toSpawn: { x: 290, y: 180 },
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

// Acepta una sala (objeto) o su id y devuelve siempre el objeto de la sala.
function resolveRoom(room) {
  if (!room) return null;
  if (typeof room === 'string') return getRoom(room);
  return room;
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
// piso caminable
// ------------------------------------------------------------------

// Polígonos de una sala (copia profunda: quien los recibe no puede tocar el catálogo).
function walkablePolygons(room) {
  const r = resolveRoom(room);
  if (!r || !Array.isArray(r.walkable)) return [];
  return r.walkable.map((poly) => poly.map((p) => ({ x: p.x, y: p.y })));
}

// Caja envolvente de un polígono (con el borde incluido).
function boundsOf(poly) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

// ¿El punto está sobre el segmento (a,b)? Todo con coordenadas enteras: exacto.
function isOnSegment(px, py, ax, ay, bx, by) {
  const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  if (cross !== 0) return false;
  const dot = (px - ax) * (bx - ax) + (py - ay) * (by - ay);
  if (dot < 0) return false;
  const len2 = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
  return dot <= len2;
}

// ¿El punto está dentro del polígono? El borde cuenta como dentro.
function isInsidePolygon(poly, x, y) {
  if (!Array.isArray(poly) || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j];
    const b = poly[i];
    if (isOnSegment(x, y, a.x, a.y, b.x, b.y)) return true;
    const intersects = ((a.y > y) !== (b.y > y))
      && (x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x);
    if (intersects) inside = !inside;
  }
  return inside;
}

// ¿El punto está en el piso caminable de la sala (borde incluido)?
function isWalkable(room, x, y) {
  const r = resolveRoom(room);
  if (!r || !Array.isArray(r.walkable)) return false;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return r.walkable.some((poly) => {
    const b = boundsOf(poly);
    if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) return false;
    return isInsidePolygon(poly, x, y);
  });
}

// Punto caminable más cercano al punto dado (búsqueda sobre la retícula entera
// de la sala, así el resultado es siempre un punto lógico válido).
// Si el punto ya es caminable, devuelve ese mismo punto.
function nearestWalkable(room, x, y) {
  const r = resolveRoom(room);
  if (!r) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (isWalkable(r, x, y)) return { x, y };

  // Cajas envolventes de los polígonos: solo se miran los puntos que caen en alguna.
  const cajas = r.walkable.map(boundsOf);

  let best = null;
  let bestD2 = Infinity;
  for (let py = 0; py <= r.height; py++) {
    for (let px = 0; px <= r.width; px++) {
      const dx = px - x;
      const dy = py - y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= bestD2) continue;
      const enAlgunaCaja = cajas.some(
        (b) => px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY
      );
      if (!enAlgunaCaja) continue;
      if (!isWalkable(r, px, py)) continue;
      bestD2 = d2;
      best = { x: px, y: py };
    }
  }
  return best;
}

// ¿La zona interior de esta salida toca el piso caminable de la sala?
function exitTouchesWalkable(room, exit) {
  const r = resolveRoom(room);
  if (!r || !exit) return false;
  const x0 = exit.x + 1;
  const y0 = exit.y + 1;
  const x1 = exit.x + exit.w - 2;
  const y1 = exit.y + exit.h - 2;
  // Salidas muy estrechas: se mira el rectángulo entero.
  if (x1 < x0 || y1 < y0) {
    for (let y = exit.y; y < exit.y + exit.h; y++) {
      for (let x = exit.x; x < exit.x + exit.w; x++) {
        if (isWalkable(r, x, y)) return true;
      }
    }
    return false;
  }
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (isWalkable(r, x, y)) return true;
    }
  }
  return false;
}

// ------------------------------------------------------------------
// rutas: A* sobre una cuadrícula de celdas de 4 px
// ------------------------------------------------------------------

// Velocidad de caminata: 60 px lógicos por segundo (docs/mundo.md §3).
const SPEED = 60;
// Lado de la celda de la cuadrícula de caminos (px lógicos).
const CELL = 4;

// Los 8 vecinos de una celda. En diagonal no se cortan esquinas: los dos
// vecinos ortogonales tienen que ser caminables.
const NEIGHBORS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

// Centro de la celda (cx, cy) de la cuadrícula.
function cellCenter(cx, cy) {
  return { x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 };
}

// Montículo binario mínimo: guarda los nodos por su prioridad f (el A*).
function heapPush(heap, item) {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (heap[parent].f <= heap[i].f) break;
    const swap = heap[parent];
    heap[parent] = heap[i];
    heap[i] = swap;
    i = parent;
  }
}

function heapPop(heap) {
  const top = heap[0];
  const last = heap.pop();
  if (heap.length > 0) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let min = i;
      if (left < heap.length && heap[left].f < heap[min].f) min = left;
      if (right < heap.length && heap[right].f < heap[min].f) min = right;
      if (min === i) break;
      const swap = heap[min];
      heap[min] = heap[i];
      heap[i] = swap;
      i = min;
    }
  }
  return top;
}

// Ruta entre dos puntos del piso caminable (A* sobre la cuadrícula de celdas
// de 4 px). Devuelve la lista de puntos de la ruta o null si no hay camino.
//
// La ruta va del punto exacto de salida al punto exacto de llegada: los
// puntos intermedios son los centros de las celdas por las que pasa el gato.
// Todos los puntos de la ruta están sobre el piso caminable.
function findPath(room, from, to) {
  const r = resolveRoom(room);
  if (!r || !Array.isArray(r.walkable) || r.walkable.length === 0) return null;
  if (!from || !to) return null;
  if (!Number.isFinite(from.x) || !Number.isFinite(from.y)) return null;
  if (!Number.isFinite(to.x) || !Number.isFinite(to.y)) return null;
  // Los dos extremos tienen que estar sobre el piso caminable.
  if (!isWalkable(r, from.x, from.y) || !isWalkable(r, to.x, to.y)) return null;

  const cols = Math.max(1, Math.ceil(r.width / CELL));
  const rows = Math.max(1, Math.ceil(r.height / CELL));
  const cellOf = (x, y) => ({
    cx: Math.min(Math.max(Math.floor(x / CELL), 0), cols - 1),
    cy: Math.min(Math.max(Math.floor(y / CELL), 0), rows - 1),
  });
  const walkableCell = (cx, cy) => {
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return false;
    const c = cellCenter(cx, cy);
    return isWalkable(r, c.x, c.y);
  };

  const start = cellOf(from.x, from.y);
  const goal = cellOf(to.x, to.y);
  if (!walkableCell(start.cx, start.cy) || !walkableCell(goal.cx, goal.cy)) return null;

  // Distancia octil: el coste real de los 8 vecinos (nunca sobreestima).
  const heuristic = (cx, cy) => {
    const dx = Math.abs(cx - goal.cx);
    const dy = Math.abs(cy - goal.cy);
    return dx + dy - (2 - Math.SQRT2) * Math.min(dx, dy);
  };

  const startKey = start.cy * cols + start.cx;
  const goalKey = goal.cy * cols + goal.cx;
  const gScore = new Map([[startKey, 0]]);
  const cameFrom = new Map();
  const closed = new Set();
  const open = [];
  heapPush(open, { key: startKey, f: heuristic(start.cx, start.cy) });

  while (open.length > 0) {
    const current = heapPop(open);
    if (closed.has(current.key)) continue;
    closed.add(current.key);
    if (current.key === goalKey) break;

    const cx = current.key % cols;
    const cy = (current.key - cx) / cols;
    const g = gScore.get(current.key);

    for (const [dx, dy] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!walkableCell(nx, ny)) continue;
      // En diagonal no se cortan esquinas: los dos vecinos ortogonales
      // tienen que ser caminables.
      if (dx !== 0 && dy !== 0) {
        if (!walkableCell(cx + dx, cy) || !walkableCell(cx, cy + dy)) continue;
      }
      const key = ny * cols + nx;
      if (closed.has(key)) continue;
      const step = (dx !== 0 && dy !== 0) ? Math.SQRT2 : 1;
      const next = g + step;
      const previous = gScore.get(key);
      if (previous !== undefined && previous <= next) continue;
      gScore.set(key, next);
      cameFrom.set(key, current.key);
      heapPush(open, { key, f: next + heuristic(nx, ny) });
    }
  }

  if (!gScore.has(goalKey)) return null;

  // Reconstruye la ruta de celdas (del final hacia el principio).
  const cells = [];
  let key = goalKey;
  while (key !== undefined) {
    const cx = key % cols;
    cells.push({ cx, cy: (key - cx) / cols });
    key = cameFrom.get(key);
  }
  cells.reverse();

  // La ruta final: del punto exacto al punto exacto, con los centros de las
  // celdas intermedias por medio.
  const points = [{ x: from.x, y: from.y }];
  for (let i = 1; i < cells.length - 1; i++) {
    points.push(cellCenter(cells[i].cx, cells[i].cy));
  }
  points.push({ x: to.x, y: to.y });

  // Sin puntos repetidos.
  const path = [];
  for (const p of points) {
    const last = path[path.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    path.push(p);
  }
  return path;
}

// Longitud de una ruta (en px lógicos).
function pathLength(path) {
  if (!Array.isArray(path) || path.length === 0) return 0;
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  }
  return total;
}

// Punto de la ruta a `distance` px del principio (interpolado). Si la distancia
// es mayor que la ruta, devuelve el último punto.
function pointAlongPath(path, distance) {
  if (!Array.isArray(path) || path.length === 0) return null;
  if (!(distance > 0)) return { x: path[0].x, y: path[0].y };
  let rest = distance;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    const segment = Math.hypot(dx, dy);
    if (rest <= segment) {
      const t = segment === 0 ? 0 : rest / segment;
      return { x: path[i - 1].x + dx * t, y: path[i - 1].y + dy * t };
    }
    rest -= segment;
  }
  const last = path[path.length - 1];
  return { x: last.x, y: last.y };
}

// Sentido del gato: 'left' o 'right' según el primer tramo con movimiento
// horizontal de la ruta. Si la ruta no dice nada (o está vacía), se conserva
// el sentido anterior.
function pathFacing(path, previous) {
  if (!Array.isArray(path) || path.length < 2) return previous;
  // El primer tramo une el punto de partida con la cuadrícula y el último con
  // el punto exacto de llegada: los dos pueden llevar un desvío de un par de
  // píxeles. Los tramos entre centros de celda no: el primero horizontal manda.
  for (let i = 1; i < path.length - 2; i++) {
    const dx = path[i + 1].x - path[i].x;
    if (dx !== 0) return dx < 0 ? 'left' : 'right';
  }
  // Si no hay tramos horizontales, manda la dirección de la ruta a nivel de
  // celda (la columna del punto de partida y la del punto de llegada).
  const dx = Math.floor(path[path.length - 1].x / CELL) - Math.floor(path[0].x / CELL);
  if (dx < 0) return 'left';
  if (dx > 0) return 'right';
  return previous;
}

// El umbral de la puerta: el punto caminable más cercano al centro de la salida.
// Es hasta donde camina el gato antes de cruzar.
function exitThreshold(room, exit) {
  const r = resolveRoom(room);
  if (!r || !exit) return null;
  const cx = Math.round(exit.x + exit.w / 2);
  const cy = Math.round(exit.y + exit.h / 2);
  return nearestWalkable(r, cx, cy);
}

// ------------------------------------------------------------------
// regla anti-bucle
// ------------------------------------------------------------------

// El spawn de cada sala y el toSpawn de cada salida no pueden caer dentro de una salida
// de la sala destino: si lo hicieran, el gato entraría a la sala y rebotaría de inmediato
// contra la salida opuesta, sin poder avanzar nunca.
// Además, el spawn y los toSpawn tienen que estar sobre el piso caminable, cada sala
// necesita polígonos y ninguna salida puede quedar flotando lejos del piso.
// Devuelve la lista de violaciones (vacía si todo está bien).
function validateRooms(rooms = ROOMS) {
  const problems = [];

  for (const room of Object.values(rooms)) {
    if (!Array.isArray(room.walkable) || room.walkable.length === 0) {
      problems.push(`la sala "${room.id}" no define polígonos caminables`);
    }

    // El spawn tiene que estar en el piso caminable.
    if (!isWalkable(room, room.spawn.x, room.spawn.y)) {
      problems.push(`el spawn de "${room.id}" no está sobre el piso caminable`);
    }

    // El spawn no puede estar sobre una salida de su propia sala.
    for (const exit of room.exits || []) {
      if (isInsideExit(exit, room.spawn.x, room.spawn.y)) {
        problems.push(`spawn de "${room.id}" cae dentro de la salida hacia "${exit.to}"`);
      }
      // La salida tiene que tocar el piso caminable: si no, es unreachable.
      if (!exitTouchesWalkable(room, exit)) {
        problems.push(`la salida de "${room.id}" hacia "${exit.to}" no toca el piso caminable`);
      }
    }

    // El toSpawn no puede estar sobre una salida de la sala a la que se entra.
    for (const exit of room.exits || []) {
      const target = rooms[exit.to];
      if (!target) {
        problems.push(`la salida de "${room.id}" apunta a una sala inexistente: "${exit.to}"`);
        continue;
      }
      if (!isWalkable(target, exit.toSpawn.x, exit.toSpawn.y)) {
        problems.push(`toSpawn de "${room.id}"→"${exit.to}" no está sobre el piso caminable`);
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
  SPEED,
  isValidRoom,
  getRoom,
  isInsideRoom,
  clampToRoom,
  exitAt,
  isWalkable,
  nearestWalkable,
  walkablePolygons,
  findPath,
  pathLength,
  pointAlongPath,
  pathFacing,
  exitThreshold,
  allowMove,
  validateRooms,
};
