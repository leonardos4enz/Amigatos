/* Amigatos — motor del mundo en el cliente (window.WorldUI)
 *
 * Este módulo NO habla con el servidor: solo dibuja lo que le mandan
 * (applyState / applyJoin / applyLeft / applyMoved) y avisa cuando alguien
 * hace clic en el piso (setMoveHandler). El servidor manda; el cliente dibuja.
 *
 * Coordenadas lógicas enteras: x 0..room.width, y 0..room.height (320x200),
 * igual que las de server/world.js.
 *
 * Escala (docs/mundo.md §1): la sala tiene una resolución lógica de 320x200 y
 * el motor calcula una escala ENTERA k (1..3) a partir del ancho disponible.
 * El escenario mide 320*k x 200*k px de CSS y el gato (32x32 lógicos) se ve a
 * 32*k px. Nunca hay escala fraccionaria: el pixel art se ve nítido.
 */
(function () {
  'use strict';

  var LOGICAL_W = 320;    // resolución lógica de la sala (docs/mundo.md §1)
  var LOGICAL_H = 200;
  var CAT_LOGICAL = 32;   // el gato: 32 px lógicos de alto (~15 % del alto de la sala)
  var MIN_SCALE = 1;      // nunca menos de 1 (320 px de CSS)
  var MAX_SCALE = 3;      // nunca más de 3 (960 px de CSS)
  // Velocidad de caminata: 60 px lógicos por segundo (docs/mundo.md §3). Es la
  // misma que usa el servidor (SPEED en server/world.js): el gato se dibuja
  // avanzando por la ruta que manda el servidor, a la misma velocidad.
  var WALK_SPEED = 60;
  // Tolerancia (px lógicos) para saber si un gato está "sobre" la ruta que
  // manda el servidor: si su posición dibujada está a menos de esto de la
  // ruta, sigue la ruta desde ahí (docs/mundo.md §3).
  var ON_ROUTE = 2;
  // Cuánto puede estar el gato dibujado por delante o por detrás de la
  // posición que manda el servidor (px lógicos) para que se siga desde donde
  // está dibujado. Más de esto significa que el cliente se ha desfasado (una
  // pestaña en segundo plano, un mensaje perdido) y entonces manda el
  // servidor.
  var MAX_DESFASE = 16;

  var DEFAULT_ROOM = {
    id: 'plaza',
    name: 'Plaza Bigotes',
    bg: 'plaza',
    width: LOGICAL_W,
    height: LOGICAL_H,
    walkable: [],
    exits: []
  };

  var stage = null;       // elemento donde se monta la pantalla del mundo
  var bgCtrl = null;      // controlador de CatBG (fondo)
  var bgBase = 0;         // base lógica con la que está pintado el fondo
  var layer = null;       // capa de gatos (todos, ordenados por profundidad)
  var layerExits = null;  // capa de las puertas (salidas visibles)
  var moveHandler = null; // fn(x, y) que avisa del clic en el piso
  var rafId = null;       // bucle de interpolación
  var scale = 0;          // escala entera del escenario (1..3)
  var resizeObs = null;   // observa el contenedor para recalcular la escala
  var onResize = null;    // respaldo si no hay ResizeObserver

  var model = { room: copyRoom(DEFAULT_ROOM), all: [], me: null };
  var byId = {};          // id (string) → registro de gato

  /* ------------------------------------------------------------------ */
  /* Utilidades                                                           */
  /* ------------------------------------------------------------------ */

  function num(v, def) {
    var n = Number(v);
    return isFinite(n) ? n : def;
  }

  function now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  // Copia de los polígonos del piso caminable: [[{x, y}, ...], ...]
  function copyPolys(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var poly = list[i];
      if (!Array.isArray(poly)) continue;
      var pts = [];
      for (var j = 0; j < poly.length; j++) {
        var p = poly[j] || {};
        pts.push({ x: num(p.x, 0), y: num(p.y, 0) });
      }
      out.push(pts);
    }
    return out;
  }

  // Copia de una lista de puntos: [{x, y}, ...]
  function copyPoints(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i] || {};
      out.push({ x: num(p.x, 0), y: num(p.y, 0) });
    }
    return out;
  }

  // Longitud de una ruta (px lógicos).
  function pathLength(path) {
    if (!Array.isArray(path) || path.length === 0) return 0;
    var total = 0;
    for (var i = 1; i < path.length; i++) {
      total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    }
    return total;
  }

  // El punto de la ruta a `distance` px del principio (interpolado). Si la
  // distancia es mayor que la ruta, devuelve el último punto.
  function pointAlongPath(path, distance) {
    if (!Array.isArray(path) || path.length === 0) return null;
    if (!(distance > 0)) return { x: path[0].x, y: path[0].y };
    var rest = distance;
    for (var i = 1; i < path.length; i++) {
      var dx = path[i].x - path[i - 1].x;
      var dy = path[i].y - path[i - 1].y;
      var segment = Math.hypot(dx, dy);
      if (rest <= segment) {
        var t = segment === 0 ? 0 : rest / segment;
        return { x: path[i - 1].x + dx * t, y: path[i - 1].y + dy * t };
      }
      rest -= segment;
    }
    var last = path[path.length - 1];
    return { x: last.x, y: last.y };
  }

  // El punto de la ruta más cercano a (x, y): dónde está (px desde el
  // principio de la ruta), el punto en sí y a qué distancia está (al
  // cuadrado) de la ruta.
  function nearestOnPath(path, x, y) {
    if (!Array.isArray(path) || path.length === 0) return null;
    var acc = 0;
    var best = 0;
    var bestD2 = Infinity;
    var bestPoint = { x: path[0].x, y: path[0].y };
    for (var i = 1; i < path.length; i++) {
      var a = path[i - 1];
      var b = path[i];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var len = Math.hypot(dx, dy);
      var t = 0;
      if (len > 0) {
        t = ((x - a.x) * dx + (y - a.y) * dy) / (len * len);
        t = Math.min(Math.max(t, 0), 1);
      }
      var px = a.x + dx * t;
      var py = a.y + dy * t;
      var d2 = (px - x) * (px - x) + (py - y) * (py - y);
      if (d2 < bestD2) {
        bestD2 = d2;
        best = acc + len * t;
        bestPoint = { x: px, y: py };
      }
      acc += len;
    }
    return { dist: best, d2: bestD2, point: bestPoint };
  }

  // La distancia (px desde el principio de la ruta) del punto de la ruta más
  // cercano a (x, y). Sirve para saber por dónde va el gato cuando el
  // servidor manda una ruta con la posición actual.
  function distanceAlongPath(path, x, y) {
    var near = nearestOnPath(path, x, y);
    return near ? near.dist : 0;
  }

  function copyRoom(r) {
    return {
      id: r.id,
      name: r.name,
      bg: r.bg,
      width: r.width,
      height: r.height,
      walkable: copyPolys(r.walkable),
      exits: r.exits.map(function (e) {
        return { x: e.x, y: e.y, w: e.w, h: e.h, to: e.to, label: e.label };
      })
    };
  }

  function normalizeRoom(room) {
    var r = (room && typeof room === 'object') ? room : {};
    var out = {
      id: (typeof r.id === 'string' && r.id) ? r.id : (typeof room === 'string' ? room : DEFAULT_ROOM.id),
      name: (typeof r.name === 'string' && r.name) ? r.name : DEFAULT_ROOM.name,
      bg: (typeof r.bg === 'string' && r.bg) ? r.bg : DEFAULT_ROOM.bg,
      width: Math.max(1, Math.round(num(r.width, DEFAULT_ROOM.width))),
      height: Math.max(1, Math.round(num(r.height, DEFAULT_ROOM.height))),
      walkable: copyPolys(r.walkable),
      exits: []
    };
    var exits = Array.isArray(r.exits) ? r.exits : [];
    for (var i = 0; i < exits.length; i++) {
      var e = exits[i] || {};
      out.exits.push({
        x: num(e.x, 0),
        y: num(e.y, 0),
        w: num(e.w, 0),
        h: num(e.h, 0),
        to: typeof e.to === 'string' ? e.to : '',
        label: typeof e.label === 'string' ? e.label : ''
      });
    }
    return out;
  }

  function dataOf(rec) {
    return {
      id: rec.id,
      username: rec.username,
      cat: rec.cat,
      x: rec.x,
      y: rec.y,
      target: rec.target,
      anim: rec.anim,
      facing: rec.facing,
      path: rec.path,
      isMe: rec.isMe
    };
  }

  /* ------------------------------------------------------------------ */
  /* Orientación y profundidad                                            */
  /* ------------------------------------------------------------------ */

  // Orientación del gato: 'left' o 'right' (docs/mundo.md §3). El sprite se
  // voltea cuando el gato mira a la izquierda.
  function setFacing(rec, facing) {
    if (facing !== 'left' && facing !== 'right') return;
    rec.facing = facing;
    applyFacing(rec);
  }

  // Voltea el sprite del gato si su orientación cambia.
  function applyFacing(rec) {
    var flip = rec.facing === 'left';
    if (rec.flipped === flip) return;
    rec.flipped = flip;
    // La orientación también queda en el DOM (para las pruebas sin pantalla).
    if (rec.el) rec.el.setAttribute('data-facing', rec.facing);
    if (rec.ctrl) rec.ctrl.setFlip(flip);
  }

  // Orientación a partir del avance horizontal: el gato mira hacia donde
  // camina (docs/mundo.md §3). El avance sale de interpolar la ruta, así que
  // su signo es el del tramo que se está recorriendo: cualquier avance
  // horizontal decide el sentido (no hace falta un umbral, que retrasaría el
  // cambio). Si el gato camina en vertical no hay avance horizontal y se
  // mantiene la orientación anterior.
  function facingFromStep(dx, previous) {
    var d = num(dx, 0);
    if (d > 0) return 'right';
    if (d < 0) return 'left';
    return previous === 'left' ? 'left' : 'right';
  }

  // Profundidad: los gatos se ordenan por `y` y el de mayor `y` se dibuja
  // encima (docs/mundo.md §3). El z-index sale directamente de la `y`.
  function depthZ(y) {
    return Math.round(num(y, 0));
  }

  /* ------------------------------------------------------------------ */
  /* Escala entera del escenario                                          */
  /* ------------------------------------------------------------------ */

  // Ancho disponible para el escenario: el del contenedor que lo envuelve
  // (menos su padding). Si no se puede medir, el ancho de la ventana.
  function availableWidth() {
    var parent = stage && stage.parentNode;
    var w = 0;
    if (parent && typeof parent.getBoundingClientRect === 'function') {
      w = parent.getBoundingClientRect().width;
      if (window.getComputedStyle) {
        var cs = window.getComputedStyle(parent);
        w -= (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      }
    }
    if (!(w > 0)) w = (typeof window !== 'undefined' && window.innerWidth) || LOGICAL_W;
    return w;
  }

  // Escala entera: k = clamp(floor(ancho disponible / 320), 1, 3).
  function computeScale() {
    var k = Math.floor(availableWidth() / LOGICAL_W);
    if (!isFinite(k) || k < MIN_SCALE) k = MIN_SCALE;
    if (k > MAX_SCALE) k = MAX_SCALE;
    return k;
  }

  // Aplica la escala: el escenario mide 320*k x 200*k px de CSS y el gato
  // (32x32 lógicos) se ve a 32*k px, siempre con píxeles enteros.
  function applyScale(force) {
    var k = computeScale();
    if (!force && k === scale) return;
    scale = k;

    if (stage) {
      stage.style.setProperty('--world-scale', String(scale));
      stage.style.width = (LOGICAL_W * scale) + 'px';
      stage.style.height = (LOGICAL_H * scale) + 'px';
    }

    Object.keys(byId).forEach(function (key) {
      var rec = byId[key];
      if (rec && rec.canvas) {
        rec.canvas.style.width = (CAT_LOGICAL * scale) + 'px';
        rec.canvas.style.height = (CAT_LOGICAL * scale) + 'px';
      }
    });

    publish();
  }

  /* ------------------------------------------------------------------ */
  /* Modelo                                                               */
  /* ------------------------------------------------------------------ */

  // Reemplaza la lista de gatos de la sala: crea los nuevos, quita los que
  // se fueron y mueve los que cambiaron de posición.
  function setPlayers(listData) {
    var next = [];
    var seen = {};

    for (var i = 0; i < listData.length; i++) {
      var d = listData[i];
      var key = String(d.id);
      if (seen[key]) continue;
      seen[key] = true;

      var rec = byId[key];
      if (rec) {
        rec.username = d.username;
        rec.cat = d.cat;
        rec.isMe = d.isMe;
        rec.target = d.target || null;
        setFacing(rec, d.facing || rec.facing);
        next.push(rec);
        if (rec.el) {
          // Todos los gatos viven en la misma capa: el orden de pintado lo
          // decide el `z-index` de cada uno (su `y`), no el orden en el DOM.
          if (layer && rec.el.parentNode !== layer) layer.appendChild(rec.el);
          if (rec.label) rec.label.textContent = rec.username;
          if (rec.ctrl && rec.cat) rec.ctrl.setCat(rec.cat);
        }
        // La ruta que manda el servidor: el gato camina por ella.
        setWalk(rec, d.path, d.x, d.y);
      } else {
        rec = {
          id: d.id,
          username: d.username,
          cat: d.cat,
          x: d.x,
          y: d.y,
          target: d.target || null,
          facing: d.facing || 'right',
          flipped: undefined,
          path: d.path || null,
          isMe: d.isMe,
          el: null,
          ctrl: null,
          label: null,
          canvas: null,
          rx: d.x,
          ry: d.y,
          anim: 'idle',
          walk: null
        };
        byId[key] = rec;
        next.push(rec);
        createCatEl(rec);
        applyFacing(rec);
        setWalk(rec, d.path, d.x, d.y);
      }
    }

    // los que ya no están en la sala
    Object.keys(byId).forEach(function (key) {
      if (!seen[key]) {
        destroyCatEl(byId[key]);
        delete byId[key];
      }
    });

    model.all = next;
    model.me = null;
    for (var j = 0; j < next.length; j++) {
      if (next[j].isMe) model.me = next[j];
    }
  }

  /* ------------------------------------------------------------------ */
  /* DOM de los gatos                                                     */
  /* ------------------------------------------------------------------ */

  function createCatEl(rec) {
    if (rec.el || !layer) return;

    var el = document.createElement('div');
    el.className = 'world-cat';
    el.setAttribute('data-player-id', String(rec.id));
    el.setAttribute('data-facing', rec.facing);

    var canvas = document.createElement('canvas');
    canvas.className = 'world-cat-canvas';

    var label = document.createElement('div');
    label.className = 'world-cat-name';
    label.textContent = rec.username;

    el.appendChild(canvas);
    el.appendChild(label);
    el.style.cssText = 'position:absolute;left:0;top:0;display:block;pointer-events:none;';
    // El sprite se pinta a escala 1 (32x32 lógicos) y se muestra a 32*k px.
    canvas.style.cssText = 'display:block;image-rendering:pixelated;' +
      'width:' + (CAT_LOGICAL * scale) + 'px;height:' + (CAT_LOGICAL * scale) + 'px;';
    label.style.cssText = 'position:absolute;bottom:100%;left:50%;transform:translateX(-50%);' +
      'margin-bottom:2px;white-space:nowrap;pointer-events:none;' +
      'font-family:"Pixelify Sans",monospace;font-size:13px;color:#fff;text-shadow:1px 1px 0 #3b2a40;';

    rec.el = el;
    rec.label = label;
    rec.canvas = canvas;
    rec.rx = rec.x;
    rec.ry = rec.y;

    if (window.CatArt) {
      // El sprite nace con la orientación del gato (izquierda = volteado).
      rec.flipped = rec.facing === 'left';
      rec.ctrl = window.CatArt.mount(canvas, rec.cat || window.CatArt.defaultCat(),
        { scale: 1, anim: 'idle', flip: rec.flipped });
    }

    if (layer) layer.appendChild(el);
    place(rec);
  }

  function destroyCatEl(rec) {
    if (rec.ctrl) { rec.ctrl.destroy(); rec.ctrl = null; }
    if (rec.el && rec.el.parentNode) rec.el.parentNode.removeChild(rec.el);
    rec.el = null;
    rec.label = null;
    rec.canvas = null;
    rec.walk = null;
  }

  // Coloca el gato en su posición lógica (en % del tamaño de la sala).
  function place(rec) {
    if (!rec.el) return;
    var w = model.room.width || 1;
    var h = model.room.height || 1;
    rec.el.style.left = (rec.rx / w * 100) + '%';
    rec.el.style.top = (rec.ry / h * 100) + '%';
    rec.el.style.transform = 'translate(-50%,-50%)';
    // Profundidad: el gato con mayor `y` se dibuja encima (docs/mundo.md §3).
    rec.el.style.zIndex = String(depthZ(rec.ry));
  }

  /* ------------------------------------------------------------------ */
  /* Animación (la caminata)                                             */
  /* ------------------------------------------------------------------ */

  // El gato se queda quieto: sin ruta, sin destino y con la animación idle.
  // En reposo no hay destino: `target` es null (docs/mundo.md §3 y §6).
  function restAt(rec, x, y) {
    rec.walk = null;
    rec.target = null;
    rec.anim = 'idle';
    rec.x = x;
    rec.y = y;
    rec.rx = x;
    rec.ry = y;
    place(rec);
    if (rec.ctrl) rec.ctrl.play('idle');
  }

  // De dónde sigue el gato la ruta que llega del servidor. Lo normal es que el
  // gato siga desde donde está DIBUJADO (su posición renderizada): así, al
  // llegar la ruta, el gato continúa donde está y nunca aparece de golpe en
  // el destino (docs/mundo.md §3). Solo si el gato dibujado está sobre la
  // ruta y va en tune con el servidor; si el cliente está desfasado (una
  // pestaña en segundo plano, un mensaje perdido) manda el servidor.
  function salidaDeRuta(ruta, rec, sx, sy) {
    var delServidor = distanceAlongPath(ruta, sx, sy);
    if (rec.el && rec.rx != null && rec.ry != null) {
      var cerca = nearestOnPath(ruta, rec.rx, rec.ry);
      if (cerca && cerca.d2 <= ON_ROUTE * ON_ROUTE &&
          Math.abs(cerca.dist - delServidor) <= MAX_DESFASE) {
        return { dist: cerca.dist, punto: cerca.point };
      }
    }
    return { dist: delServidor, punto: pointAlongPath(ruta, delServidor) };
  }

  // Prepara la caminata de un gato: la ruta que manda el servidor y el punto
  // de la ruta en el que está ahora. El gato avanza por la ruta a WALK_SPEED
  // (la misma velocidad que el servidor), así que la posición se deriva de la
  // ruta igual que en el servidor (docs/mundo.md §3). La misma lógica sirve
  // para el gato propio y para los demás: al recibir `world:moved` con su
  // ruta, el gato sigue desde donde está dibujado, a 60 px lógicos por
  // segundo, con `walk` mientras camina y `idle` al llegar.
  function setWalk(rec, path, x, y) {
    var ruta = copyPoints(path);
    rec.path = ruta.length ? ruta : null;
    var sx = num(x, rec.x);
    var sy = num(y, rec.y);

    // Sin ruta no hay caminata: el gato se queda donde está.
    if (ruta.length < 2) {
      restAt(rec, sx, sy);
      return;
    }

    var total = pathLength(ruta);
    var salida = salidaDeRuta(ruta, rec, sx, sy);
    var dist = salida.dist;
    var last = ruta[ruta.length - 1];

    // Ya está en el final de la ruta: no camina.
    if (dist >= total - 0.001) {
      restAt(rec, last.x, last.y);
      return;
    }

    // El ancla es el punto de la ruta donde está el gato ahora.
    var ancla = salida.punto;
    rec.walk = { path: ruta, dist: dist, t0: now() };
    // Mientras camina: el destino es el final de la ruta y la animación es walk.
    rec.target = { x: last.x, y: last.y };
    rec.anim = 'walk';
    rec.x = ancla.x;
    rec.y = ancla.y;
    rec.rx = ancla.x;
    rec.ry = ancla.y;
    place(rec);
    if (rec.ctrl) rec.ctrl.play('walk');
    kick();
  }

  function kick() {
    if (!rafId && typeof requestAnimationFrame === 'function') rafId = requestAnimationFrame(loop);
  }

  function loop(ts) {
    rafId = null;
    var more = false;
    var moved = false;
    Object.keys(byId).forEach(function (key) {
      var rec = byId[key];
      var w = rec.walk;
      if (!w) return;
      var dist = w.dist + ((ts - w.t0) / 1000) * WALK_SPEED;
      var total = pathLength(w.path);
      var p;
      if (dist >= total) {
        // El gato ha llegado: se queda en el final de la ruta y vuelve a idle.
        var last = w.path[w.path.length - 1];
        p = { x: last.x, y: last.y };
        rec.walk = null;
        rec.target = null;
        rec.anim = 'idle';
        if (rec.ctrl) rec.ctrl.play('idle');
      } else {
        p = pointAlongPath(w.path, dist);
        more = true;
      }
      // Orientación: el gato mira hacia donde camina (docs/mundo.md §3).
      setFacing(rec, facingFromStep(p.x - rec.x, rec.facing));
      rec.x = p.x;
      rec.y = p.y;
      rec.rx = p.x;
      rec.ry = p.y;
      moved = true;
      place(rec);
    });
    if (moved) publish();
    if (more) rafId = requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------------ */
  /* Clic en el piso                                                      */
  /* ------------------------------------------------------------------ */

  function onClick(ev) {
    if (!stage) return;
    var rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    var w = model.room.width;
    var h = model.room.height;
    var x = Math.round((ev.clientX - rect.left) / rect.width * w);
    var y = Math.round((ev.clientY - rect.top) / rect.height * h);
    x = Math.min(Math.max(x, 0), w);
    y = Math.min(Math.max(y, 0), h);

    if (typeof moveHandler === 'function') moveHandler(x, y);
  }

  /* ------------------------------------------------------------------ */
  /* Las salidas: puertas visibles sobre el fondo (docs/mundo.md §4)        */
  /* ------------------------------------------------------------------ */

  // Pinta las puertas de la sala actual: un elemento por salida, con su
  // etiqueta y su resaltado (public/js/world-exits.js).
  function renderExits() {
    if (!layerExits || !window.WorldExits) return;
    window.WorldExits.render(layerExits, model.room, onExitPick);
  }

  // Al pulsar una puerta, el gato camina hasta ella: se pide al servidor el
  // punto de la salida y el servidor decide la ruta, el umbral y el cruce.
  // El cliente no cambia de sala por su cuenta.
  function onExitPick(exit) {
    if (!exit || typeof moveHandler !== 'function') return;
    var x = Math.round(num(exit.x, 0) + num(exit.w, 0) / 2);
    var y = Math.round(num(exit.y, 0) + num(exit.h, 0) / 2);
    moveHandler(x, y);
  }

  /* ------------------------------------------------------------------ */
  /* API pública                                                          */
  /* ------------------------------------------------------------------ */

  // Monta el fondo con la base lógica de la sala (320x200): el canvas del fondo
  // mide exactamente 320x200 px lógicos y el navegador lo escala a la escala
  // entera del escenario.
  function mountBg() {
    if (bgCtrl) { bgCtrl.destroy(); bgCtrl = null; }
    bgBase = 0;
    if (!stage || !window.CatBG) return;
    bgBase = model.room.width;
    bgCtrl = window.CatBG.mount(stage, model.room.bg, { base: bgBase });
  }

  function mount(el) {
    clearDom();
    stage = el || null;
    if (!stage) return;

    if (window.getComputedStyle && window.getComputedStyle(stage).position === 'static') {
      stage.style.position = 'relative';
    }

    // Escala entera antes de montar el fondo: el canvas del fondo se calcula
    // con el tamaño del escenario.
    scale = 0;
    applyScale(true);

    mountBg();

    // La capa de las puertas va debajo de los gatos: el gato pasa por delante
    // de la puerta, pero la puerta se puede pulsar.
    layerExits = document.createElement('div');
    layerExits.className = 'world-exit-layer';
    layerExits.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none;';
    stage.appendChild(layerExits);

    layer = document.createElement('div');
    layer.className = 'world-layer';
    layer.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none;';

    stage.appendChild(layer);

    Object.keys(byId).forEach(function (key) {
      var rec = byId[key];
      createCatEl(rec);
      rec.rx = rec.x;
      rec.ry = rec.y;
      place(rec);
    });

    stage.addEventListener('click', onClick);
    watchSize();
    renderExits();
    publish();
  }

  // Recalcula la escala cuando cambia el ancho disponible.
  function watchSize() {
    var parent = stage && stage.parentNode;
    if (parent && typeof ResizeObserver !== 'undefined') {
      resizeObs = new ResizeObserver(function () { applyScale(false); });
      resizeObs.observe(parent);
    } else if (typeof window !== 'undefined') {
      onResize = function () { applyScale(false); };
      window.addEventListener('resize', onResize);
    }
  }

  function unwatchSize() {
    if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
    if (onResize && typeof window !== 'undefined') {
      window.removeEventListener('resize', onResize);
      onResize = null;
    }
  }

  function unmount() {
    clearDom();
    model = { room: copyRoom(DEFAULT_ROOM), all: [], me: null };
    byId = {};
    if (typeof window !== 'undefined') delete window.__amigatos;
  }

  // Quita el DOM (gatos, fondo y escuchas) sin tocar el modelo.
  function clearDom() {
    unwatchSize();
    if (stage) stage.removeEventListener('click', onClick);
    stage = null;

    Object.keys(byId).forEach(function (key) { destroyCatEl(byId[key]); });

    if (bgCtrl) { bgCtrl.destroy(); bgCtrl = null; }
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    layer = null;

    if (layerExits && layerExits.parentNode) layerExits.parentNode.removeChild(layerExits);
    layerExits = null;

    if (rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
    rafId = null;
  }

  function setMoveHandler(fn) {
    moveHandler = typeof fn === 'function' ? fn : null;
  }

  function applyState(payload) {
    payload = payload || {};
    model.room = normalizeRoom(payload.room);
    // El fondo se pinta con la base lógica de la sala: si cambia, se vuelve a montar.
    if (bgCtrl && model.room.width === bgBase) bgCtrl.set(model.room.bg);
    else mountBg();
    // Las puertas de la sala nueva se pintan sobre su fondo.
    renderExits();

    var meId = (payload.me && payload.me.id != null) ? String(payload.me.id) : null;
    var list = [];
    var players = Array.isArray(payload.players) ? payload.players : [];

    for (var i = 0; i < players.length; i++) {
      var p = players[i] || {};
      list.push({
        id: p.id,
        username: typeof p.username === 'string' ? p.username : '',
        cat: (p.cat && typeof p.cat === 'object') ? p.cat : null,
        x: num(p.x, 0),
        y: num(p.y, 0),
        target: (p.target && typeof p.target === 'object') ? { x: num(p.target.x, 0), y: num(p.target.y, 0) } : null,
        facing: p.facing === 'left' || p.facing === 'right' ? p.facing : 'right',
        path: copyPoints(p.path),
        isMe: meId !== null && String(p.id) === meId
      });
    }

    // el gato propio: sus datos mandan sobre los que vinieron en la lista
    if (meId) {
      var m = payload.me || {};
      var idx = -1;
      for (var j = 0; j < list.length; j++) {
        if (String(list[j].id) === meId) { idx = j; break; }
      }
      var meRec = idx >= 0 ? list[idx] : {
        id: m.id, username: '', cat: null, x: 0, y: 0, isMe: true
      };
      if (typeof m.username === 'string' && m.username) meRec.username = m.username;
      if (m.cat && typeof m.cat === 'object') meRec.cat = m.cat;
      meRec.x = num(m.x, meRec.x);
      meRec.y = num(m.y, meRec.y);
      if (m.target && typeof m.target === 'object') {
        meRec.target = { x: num(m.target.x, meRec.x), y: num(m.target.y, meRec.y) };
      }
      if (m.facing === 'left' || m.facing === 'right') meRec.facing = m.facing;
      meRec.path = copyPoints(m.path);
      meRec.isMe = true;
      if (idx < 0) list.push(meRec);
    }

    setPlayers(list);
    publish();
  }

  function applyJoin(payload) {
    var p = (payload && payload.player) ? payload.player : payload;
    if (!p || p.id == null) return;

    var key = String(p.id);
    var isMe = !!(model.me && String(model.me.id) === key);
    var list = model.all.map(dataOf);
    var existing = null;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === key) { existing = list[i]; break; }
    }

    var d = existing || { id: p.id, username: '', cat: null, x: 0, y: 0, isMe: isMe };
    if (typeof p.username === 'string') d.username = p.username;
    if (p.cat && typeof p.cat === 'object') d.cat = p.cat;
    d.x = num(p.x, d.x);
    d.y = num(p.y, d.y);
    if (p.target && typeof p.target === 'object') {
      d.target = { x: num(p.target.x, d.x), y: num(p.target.y, d.y) };
    }
    if (p.facing === 'left' || p.facing === 'right') d.facing = p.facing;
    d.path = copyPoints(p.path);
    d.isMe = isMe;
    if (!existing) list.push(d);

    setPlayers(list);
    publish();
  }

  function applyLeft(payload) {
    var id = null;
    if (payload && payload.id != null) id = payload.id;
    else if (payload && payload.player && payload.player.id != null) id = payload.player.id;
    if (id == null) return;

    var key = String(id);
    var list = model.all.filter(function (rec) { return String(rec.id) !== key; }).map(dataOf);
    setPlayers(list);
    publish();
  }

  function applyMoved(payload) {
    if (!payload || payload.id == null) return;
    var rec = byId[String(payload.id)];
    if (!rec) return;
    if (payload.target && typeof payload.target === 'object') {
      rec.target = { x: num(payload.target.x, rec.x), y: num(payload.target.y, rec.y) };
    }
    if (payload.facing === 'left' || payload.facing === 'right') setFacing(rec, payload.facing);
    // El servidor manda la ruta que sigue el gato: el cliente la recorre a la
    // misma velocidad que el servidor (60 px lógicos por segundo).
    setWalk(rec, payload.path, payload.x, payload.y);
    publish();
  }

  function state() {
    return {
      room: copyRoom(model.room),
      scale: scale,
      players: model.all.map(function (rec) {
        return {
          id: rec.id, username: rec.username, cat: rec.cat, x: rec.x, y: rec.y,
          target: rec.target, anim: rec.anim, facing: rec.facing
        };
      }),
      me: model.me
        ? {
          id: model.me.id, username: model.me.username, cat: model.me.cat,
          x: model.me.x, y: model.me.y, target: model.me.target,
          anim: model.me.anim, facing: model.me.facing
        }
        : null
    };
  }

  // Estado verificable del mundo (así lo comprueban los tests de navegador).
  // Contrato mínimo de docs/mundo.md §6.
  function publish() {
    var r = model.room;
    window.__amigatos = {
      room: r.id,
      roomName: r.name,
      roomWidth: r.width,
      roomHeight: r.height,
      catHeight: CAT_LOGICAL,
      walkable: copyPolys(r.walkable),
      exits: r.exits.map(function (e) {
        return { x: e.x, y: e.y, w: e.w, h: e.h, to: e.to, label: e.label };
      }),
      me: model.me ? {
        x: model.me.x, y: model.me.y, target: model.me.target,
        anim: model.me.anim, facing: model.me.facing
      } : null,
      players: model.all.map(function (rec) {
        return {
          id: rec.id, username: rec.username, x: rec.x, y: rec.y,
          target: rec.target, anim: rec.anim, facing: rec.facing
        };
      }),
      scale: scale,
      mapOpen: false,
      transition: false
    };
  }

  var api = {
    mount: mount,
    unmount: unmount,
    setMoveHandler: setMoveHandler,
    applyState: applyState,
    applyJoin: applyJoin,
    applyLeft: applyLeft,
    applyMoved: applyMoved,
    state: state,
    // Orientación (puro): qué mira el gato según su avance horizontal.
    facingFromStep: facingFromStep,
    // Profundidad (puro): el z-index de un gato sale de su `y`.
    depthZ: depthZ
  };

  if (typeof window !== 'undefined') window.WorldUI = api;
  // Las funciones puras se pueden probar en Node (sin navegador).
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
