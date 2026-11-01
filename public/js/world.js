/* Amigatos — motor del mundo en el cliente (window.WorldUI)
 *
 * Este módulo NO habla con el servidor: solo dibuja lo que le mandan
 * (applyState / applyJoin / applyLeft / applyMoved) y avisa cuando alguien
 * hace clic en el piso (setMoveHandler). El servidor manda; el cliente dibuja.
 *
 * Coordenadas lógicas enteras: x 0..room.width, y 0..room.height (96x72),
 * igual que las de server/world.js.
 */
(function () {
  'use strict';

  var CAT_SCALE = 3;      // escala del sprite (32x32 px lógicos)
  var WALK_MS = 260;      // duración de la caminata entre dos posiciones

  var DEFAULT_ROOM = {
    id: 'plaza',
    name: 'Plaza Bigotes',
    bg: 'plaza',
    width: 96,
    height: 72,
    exits: []
  };

  var stage = null;       // elemento donde se monta la pantalla del mundo
  var bgCtrl = null;      // controlador de CatBG (fondo)
  var layer = null;       // capa de gatos
  var layerOthers = null; // los gatos de los demás
  var layerMe = null;     // el gato propio
  var moveHandler = null; // fn(x, y) que avisa del clic en el piso
  var rafId = null;       // bucle de interpolación

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

  function copyRoom(r) {
    return {
      id: r.id,
      name: r.name,
      bg: r.bg,
      width: r.width,
      height: r.height,
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
      isMe: rec.isMe
    };
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
        rec.x = d.x;
        rec.y = d.y;
        next.push(rec);
        if (rec.el) {
          // el gato propio se dibuja aparte de los demás
          var parent = rec.isMe ? layerMe : layerOthers;
          if (parent && rec.el.parentNode !== parent) parent.appendChild(rec.el);
          if (rec.label) rec.label.textContent = rec.username;
          if (rec.ctrl && rec.cat) rec.ctrl.setCat(rec.cat);
        }
      } else {
        rec = {
          id: d.id,
          username: d.username,
          cat: d.cat,
          x: d.x,
          y: d.y,
          isMe: d.isMe,
          el: null,
          ctrl: null,
          label: null,
          rx: d.x,
          ry: d.y,
          anim: null
        };
        byId[key] = rec;
        next.push(rec);
        createCatEl(rec);
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

    // los que cambiaron de sitio caminan hasta allí
    for (var k = 0; k < next.length; k++) {
      var r = next[k];
      if (r.el && (r.rx !== r.x || r.ry !== r.y)) animateTo(r, r.x, r.y);
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

    var canvas = document.createElement('canvas');
    canvas.className = 'world-cat-canvas';

    var label = document.createElement('div');
    label.className = 'world-cat-name';
    label.textContent = rec.username;

    el.appendChild(canvas);
    el.appendChild(label);
    el.style.cssText = 'position:absolute;left:0;top:0;display:block;pointer-events:none;';
    canvas.style.cssText = 'display:block;image-rendering:pixelated;';
    label.style.cssText = 'position:absolute;bottom:100%;left:50%;transform:translateX(-50%);' +
      'margin-bottom:2px;white-space:nowrap;pointer-events:none;' +
      'font-family:"Pixelify Sans",monospace;font-size:13px;color:#fff;text-shadow:1px 1px 0 #3b2a40;';

    rec.el = el;
    rec.label = label;
    rec.rx = rec.x;
    rec.ry = rec.y;

    if (window.CatArt) {
      rec.ctrl = window.CatArt.mount(canvas, rec.cat || window.CatArt.defaultCat(), { scale: CAT_SCALE, anim: 'idle' });
    }

    var parent = rec.isMe ? layerMe : layerOthers;
    if (parent) parent.appendChild(el);
    place(rec);
  }

  function destroyCatEl(rec) {
    if (rec.ctrl) { rec.ctrl.destroy(); rec.ctrl = null; }
    if (rec.el && rec.el.parentNode) rec.el.parentNode.removeChild(rec.el);
    rec.el = null;
    rec.label = null;
    rec.anim = null;
  }

  // Coloca el gato en su posición lógica (en % del tamaño de la sala).
  function place(rec) {
    if (!rec.el) return;
    var w = model.room.width || 1;
    var h = model.room.height || 1;
    rec.el.style.left = (rec.rx / w * 100) + '%';
    rec.el.style.top = (rec.ry / h * 100) + '%';
    rec.el.style.transform = 'translate(-50%,-50%)';
  }

  /* ------------------------------------------------------------------ */
  /* Animación (interpolación + caminata)                                */
  /* ------------------------------------------------------------------ */

  function animateTo(rec, tx, ty) {
    if (rec.anim && rec.anim.toX === tx && rec.anim.toY === ty) return;
    rec.anim = { fromX: rec.rx, fromY: rec.ry, toX: tx, toY: ty, t0: now(), dur: WALK_MS };
    if (rec.ctrl) rec.ctrl.play('walk');
    kick();
  }

  function kick() {
    if (!rafId && typeof requestAnimationFrame === 'function') rafId = requestAnimationFrame(loop);
  }

  function loop(ts) {
    rafId = null;
    var more = false;
    Object.keys(byId).forEach(function (key) {
      var rec = byId[key];
      var a = rec.anim;
      if (!a) return;
      var p = Math.min(1, (ts - a.t0) / a.dur);
      var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      rec.rx = a.fromX + (a.toX - a.fromX) * e;
      rec.ry = a.fromY + (a.toY - a.fromY) * e;
      place(rec);
      if (p >= 1) {
        rec.rx = a.toX;
        rec.ry = a.toY;
        rec.anim = null;
        if (rec.ctrl) rec.ctrl.play('idle');
      } else {
        more = true;
      }
    });
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
  /* API pública                                                          */
  /* ------------------------------------------------------------------ */

  function mount(el) {
    clearDom();
    stage = el || null;
    if (!stage) return;

    if (window.getComputedStyle && window.getComputedStyle(stage).position === 'static') {
      stage.style.position = 'relative';
    }

    if (window.CatBG) bgCtrl = window.CatBG.mount(stage, model.room.bg);

    layer = document.createElement('div');
    layer.className = 'world-layer';
    layer.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none;';

    layerOthers = document.createElement('div');
    layerOthers.className = 'world-others';
    layerOthers.style.cssText = 'position:absolute;inset:0;';

    layerMe = document.createElement('div');
    layerMe.className = 'world-me';
    layerMe.style.cssText = 'position:absolute;inset:0;';

    layer.appendChild(layerOthers);
    layer.appendChild(layerMe);
    stage.appendChild(layer);

    Object.keys(byId).forEach(function (key) {
      var rec = byId[key];
      createCatEl(rec);
      rec.rx = rec.x;
      rec.ry = rec.y;
      place(rec);
    });

    stage.addEventListener('click', onClick);
    publish();
  }

  function unmount() {
    clearDom();
    model = { room: copyRoom(DEFAULT_ROOM), all: [], me: null };
    byId = {};
    if (typeof window !== 'undefined') delete window.__amigatos;
  }

  // Quita el DOM (gatos, fondo y escuchas) sin tocar el modelo.
  function clearDom() {
    if (stage) stage.removeEventListener('click', onClick);
    stage = null;

    Object.keys(byId).forEach(function (key) { destroyCatEl(byId[key]); });

    if (bgCtrl) { bgCtrl.destroy(); bgCtrl = null; }
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    layer = null;
    layerOthers = null;
    layerMe = null;

    if (rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
    rafId = null;
  }

  function setMoveHandler(fn) {
    moveHandler = typeof fn === 'function' ? fn : null;
  }

  function applyState(payload) {
    payload = payload || {};
    model.room = normalizeRoom(payload.room);
    if (bgCtrl) bgCtrl.set(model.room.bg);

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
    rec.x = num(payload.x, rec.x);
    rec.y = num(payload.y, rec.y);
    animateTo(rec, rec.x, rec.y);
    publish();
  }

  function state() {
    return {
      room: copyRoom(model.room),
      players: model.all.map(function (rec) {
        return { id: rec.id, username: rec.username, cat: rec.cat, x: rec.x, y: rec.y };
      }),
      me: model.me
        ? { id: model.me.id, username: model.me.username, cat: model.me.cat, x: model.me.x, y: model.me.y }
        : null
    };
  }

  // Estado verificable del mundo (así lo comprueban los tests de navegador).
  function publish() {
    var r = model.room;
    window.__amigatos = {
      room: r.id,
      roomName: r.name,
      roomWidth: r.width,
      roomHeight: r.height,
      exits: r.exits.map(function (e) {
        return { x: e.x, y: e.y, w: e.w, h: e.h, to: e.to, label: e.label };
      }),
      me: model.me ? { x: model.me.x, y: model.me.y } : null,
      players: model.all.map(function (rec) {
        return { id: rec.id, username: rec.username, x: rec.x, y: rec.y };
      })
    };
  }

  window.WorldUI = {
    mount: mount,
    unmount: unmount,
    setMoveHandler: setMoveHandler,
    applyState: applyState,
    applyJoin: applyJoin,
    applyLeft: applyLeft,
    applyMoved: applyMoved,
    state: state
  };
})();
