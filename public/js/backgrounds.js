/* Amigatos — fondos pixel art personalizados (window.CatBG)
 * Núcleo: registro de escenas + montaje animado. Las escenas viven en js/bg/*.js y se registran con
 *   CatBG.register({ id, label, emoji, animated, draw(ctx, w, h, t) })
 * draw pinta en coordenadas de "pixel lógico" (w × h, típicamente ~96 × 72); t = segundos desde el inicio.
 * El canvas se escala con image-rendering: pixelated, así que cada unidad es un pixel grande.
 */
(function () {
  'use strict';

  var scenes = {};
  var order = [];
  var DEFAULT = 'cuarto';
  var FPS = 8;

  function register(s) {
    if (!s || !s.id || typeof s.draw !== 'function' || scenes[s.id]) return;
    scenes[s.id] = s;
    order.push(s.id);
  }

  function list() {
    return order.map(function (id) { var s = scenes[id]; return { id: s.id, label: s.label, emoji: s.emoji || '' }; });
  }

  function has(id) { return !!scenes[id]; }
  function resolve(id) { return scenes[id] ? id : (scenes[DEFAULT] ? DEFAULT : order[0]); }

  function paint(canvas, id, t) {
    var s = scenes[resolve(id)];
    if (!s) return;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    try { s.draw(ctx, canvas.width, canvas.height, t || 0); }
    catch (e) { if (window.console) console.error('[CatBG] ' + s.id, e); }
    ctx.restore();
  }

  // tamaño lógico según el aspecto del contenedor (ancho fijo ~96 px lógicos)
  function logicalSize(el, base) {
    var r = el.getBoundingClientRect();
    var w = base || 96;
    var h = r.width > 0 && r.height > 0 ? Math.round(w * r.height / r.width) : 72;
    return { w: w, h: Math.max(24, Math.min(h, 220)) };
  }

  var mounted = [];
  var start = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  var raf = null, last = 0;

  function loop(now) {
    raf = null;
    if (now - last >= 1000 / FPS) {
      last = now;
      var t = (now - start) / 1000;
      mounted = mounted.filter(function (m) {
        if (!m.canvas.isConnected) { m.detached = (m.detached || 0) + 1; return m.detached < 40; }
        m.detached = 0;
        var s = scenes[resolve(m.id)];
        if (m.dirty || (s && s.animated)) { paint(m.canvas, m.id, t); m.dirty = false; }
        return true;
      });
    }
    if (mounted.length) raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf && typeof requestAnimationFrame !== 'undefined') raf = requestAnimationFrame(loop); }

  // Pone un canvas de fondo animado dentro de `container` (que debe tener position no estática).
  function mount(container, id, opts) {
    opts = opts || {};
    var canvas = document.createElement('canvas');
    canvas.className = 'catbg-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;image-rendering:pixelated;pointer-events:none;display:block;';
    container.insertBefore(canvas, container.firstChild);
    var m = { canvas: canvas, id: id, dirty: true };
    function resize() {
      var sz = logicalSize(container, opts.base);
      if (canvas.width !== sz.w || canvas.height !== sz.h) { canvas.width = sz.w; canvas.height = sz.h; m.dirty = true; }
    }
    resize();
    var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function () { resize(); kick(); }) : null;
    if (ro) ro.observe(container);
    mounted.push(m);
    paint(canvas, id, 0);
    kick();
    return {
      set: function (nid) { m.id = nid; m.dirty = true; kick(); },
      destroy: function () {
        if (ro) ro.disconnect();
        mounted = mounted.filter(function (x) { return x !== m; });
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  var thumbCache = {};
  function toDataURL(id, w, h) {
    w = w || 48; h = h || 36;
    var key = resolve(id) + ':' + w + 'x' + h;
    if (thumbCache[key]) return thumbCache[key];
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    paint(c, id, 1.3);
    return (thumbCache[key] = c.toDataURL('image/png'));
  }

  window.CatBG = {
    register: register,
    list: list,
    has: has,
    resolve: resolve,
    DEFAULT: DEFAULT,
    paint: paint,
    mount: mount,
    toDataURL: toDataURL
  };
})();
