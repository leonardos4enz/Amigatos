/* Amigatos — Cajitas (puntos y cajas, versión gatuna)
   Cada jugador dibuja una línea entre dos puntos vecinos. Quien cierra una
   cajita se mete dentro (¡a los gatos les encantan las cajas!) y vuelve a jugar. */
(function () {
  'use strict';
  if (!window.GamesUI || !GamesUI.register) return;

  var INK = '#4a2a50';
  var COLORS = [
    { name: 'rosa', main: '#ff9fbc', dark: '#e9789c', light: '#ffcfde' },
    { name: 'azul', main: '#8ccaff', dark: '#4f9fe0', light: '#c9e4ff' }
  ];
  var CARD = { base: '#e8b47e', dark: '#c98b5a', deep: '#9a6239', light: '#f6d3a4', tape: '#fbe6c4' };

  // Geometría (unidades del viewBox)
  var CELL = 40, M = 10, DOT = 9, LW = 7;

  var SVGNS = 'http://www.w3.org/2000/svg';

  function sameId(a, b) { return a != null && b != null && String(a) === String(b); }
  function playerIndex(state, id) {
    var ps = state.players || [];
    for (var i = 0; i < ps.length; i++) if (sameId(ps[i].id, id)) return i;
    return -1;
  }
  function colorOf(state, id) { var i = playerIndex(state, id); return COLORS[i < 0 ? 0 : i % 2]; }
  function scoreOf(state, id) {
    var sc = (state.data && state.data.scores) || {};
    return sc[String(id)] || 0;
  }
  function cajitas(n) { return n + (n === 1 ? ' cajita' : ' cajitas'); }
  function countLines(d) {
    var n = 0;
    ['h', 'v'].forEach(function (k) { (d && d[k] || []).forEach(function (row) { row.forEach(function (x) { if (x != null) n++; }); }); });
    return n;
  }
  function sv(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    return e;
  }
  function px(x) { return M + x * CELL; }

  /* ---------- Estilos ---------- */
  var CSS = [
    '.bx{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;}',
    '.bx-legend{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 14px;font-family:var(--font-body,sans-serif);font-size:15px;color:' + INK + ';}',
    '.bx-chip{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;background:#fff;box-shadow:0 -2px 0 0 ' + INK + ',0 2px 0 0 ' + INK + ',-2px 0 0 0 ' + INK + ',2px 0 0 0 ' + INK + ';}',
    '.bx-chip.bx-turn{background:#fff3c9;}',
    '.bx-sw{display:inline-block;width:22px;height:8px;box-shadow:0 0 0 2px ' + INK + ';}',
    '.bx-chip b{font-family:var(--font-pixel,monospace);font-size:11px;}',
    '.bx-board{position:relative;width:100%;max-width:440px;box-sizing:border-box;padding:6px;margin:4px;background:#fff7ea;',
    '  box-shadow:0 -4px 0 0 ' + INK + ',0 4px 0 0 ' + INK + ',-4px 0 0 0 ' + INK + ',4px 0 0 0 ' + INK + ',0 10px 0 0 rgba(74,42,80,.22),inset 0 -4px 0 0 #fdebd6,inset 4px 4px 0 0 #fff;}',
    '.bx-svg{display:block;width:100%;height:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;}',
    '.bx-svg image{image-rendering:pixelated;image-rendering:crisp-edges;}',
    '.bx-slot{pointer-events:none;outline:none;}',
    '.bx-slot.bx-free{pointer-events:auto;cursor:pointer;}',
    '.bx-wait .bx-slot{pointer-events:none!important;}',
    '.bx-ghost{opacity:0;transition:opacity .12s;}',
    '@media (hover:hover){.bx-slot.bx-free:hover .bx-ghost{opacity:.65;}}',
    '.bx-slot.bx-free:focus-visible .bx-ghost{opacity:.8;}',
    '.bx-slot.bx-picked .bx-ghost{opacity:.9;}',
    '.bx-line{transform-box:fill-box;transform-origin:center;}',
    '.bx-line.bx-new{animation:bx-draw .28s steps(4,end);}',
    '@keyframes bx-draw{from{transform:scale(0.1,1);}to{transform:scale(1,1);}}',
    '.bx-line.bx-v.bx-new{animation-name:bx-drawv;}',
    '@keyframes bx-drawv{from{transform:scale(1,0.1);}to{transform:scale(1,1);}}',
    '.bx-glow{fill:#ffd56e;animation:bx-pulse 1.1s steps(2,end) infinite;}',
    '@keyframes bx-pulse{0%{opacity:.95;}50%{opacity:.35;}100%{opacity:.95;}}',
    '.bx-box{transform-box:fill-box;transform-origin:50% 100%;}',
    '.bx-box.bx-new{animation:bx-hop .5s steps(6,end);}',
    '@keyframes bx-hop{0%{transform:scale(.2,.2);}45%{transform:scale(1.15,.85);}70%{transform:scale(.92,1.1);}100%{transform:scale(1,1);}}',
    '.bx-cat{animation:bx-peek 3.2s steps(1,end) infinite;}',
    '@keyframes bx-peek{0%,82%{transform:translateY(0);}86%,96%{transform:translateY(-1.5px);}}',
    '.bx-hint{min-height:1.3em;font-family:var(--font-body,sans-serif);font-size:15px;color:' + INK + ';text-align:center;}',
    '.bx-hint.bx-mine{color:#e9789c;font-weight:bold;}',
    '@media (prefers-reduced-motion:reduce){.bx-line.bx-new,.bx-box.bx-new,.bx-cat,.bx-glow{animation:none!important;}}'
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('bx-style')) return;
    var st = document.createElement('style');
    st.id = 'bx-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ---------- Construcción ---------- */
  function build(container, api) {
    injectCSS();
    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'bx';
    var legend = document.createElement('div');
    legend.className = 'bx-legend';
    var board = document.createElement('div');
    board.className = 'bx-board';
    var hint = document.createElement('div');
    hint.className = 'bx-hint';
    hint.setAttribute('aria-live', 'polite');
    wrap.appendChild(legend);
    wrap.appendChild(board);
    wrap.appendChild(hint);
    container.appendChild(wrap);
    return { api: api, legend: legend, board: board, hint: hint, size: 0, svg: null, catURL: {}, prev: null, pendingT: 0 };
  }

  function buildBoard(ui, n) {
    ui.board.innerHTML = '';
    var S = 2 * M + n * CELL;
    var svg = sv('svg', { viewBox: '0 0 ' + S + ' ' + S, 'class': 'bx-svg', 'shape-rendering': 'crispEdges', role: 'group', 'aria-label': 'Tablero de cajitas' });
    var gCells = sv('g', {}), gGlow = sv('g', {}), gLines = sv('g', {}), gDots = sv('g', {}), gSlots = sv('g', {});
    svg.appendChild(gCells); svg.appendChild(gGlow); svg.appendChild(gLines); svg.appendChild(gDots); svg.appendChild(gSlots);

    // casillas (fondo + caja)
    ui.cells = [];
    for (var r = 0; r < n; r++) {
      ui.cells.push([]);
      for (var c = 0; c < n; c++) {
        var g = sv('g', {});
        g.dataset.owner = '';
        gCells.appendChild(g);
        ui.cells[r].push(g);
      }
    }
    // puntos
    for (var dr = 0; dr <= n; dr++) {
      for (var dc = 0; dc <= n; dc++) {
        var x = px(dc) - DOT / 2, y = px(dr) - DOT / 2;
        gDots.appendChild(sv('rect', { x: x, y: y, width: DOT, height: DOT, fill: INK }));
        gDots.appendChild(sv('rect', { x: x + 2, y: y + 2, width: DOT - 4, height: DOT - 4, fill: '#bba4f5' }));
        gDots.appendChild(sv('rect', { x: x + 2, y: y + 2, width: 2, height: 2, fill: '#fff' }));
      }
    }
    // líneas dibujadas + huecos clicables
    ui.lines = { h: [], v: [] };
    ui.slots = { h: [], v: [] };
    var H = CELL / 2;
    ['h', 'v'].forEach(function (dir) {
      var rows = dir === 'h' ? n + 1 : n, cols = dir === 'h' ? n : n + 1;
      for (var r2 = 0; r2 < rows; r2++) {
        ui.lines[dir].push([]); ui.slots[dir].push([]);
        for (var c2 = 0; c2 < cols; c2++) {
          var x0 = px(c2), y0 = px(r2);
          var rect = dir === 'h'
            ? { x: x0, y: y0 - LW / 2, width: CELL, height: LW }
            : { x: x0 - LW / 2, y: y0, width: LW, height: CELL };
          // línea dibujada (contorno + color)
          var lg = sv('g', { 'class': 'bx-line bx-' + dir, visibility: 'hidden' });
          lg.appendChild(sv('rect', { x: rect.x, y: rect.y, width: rect.width, height: rect.height, fill: INK }));
          var inner = dir === 'h'
            ? { x: rect.x, y: rect.y + 2, width: rect.width, height: rect.height - 4 }
            : { x: rect.x + 2, y: rect.y, width: rect.width - 4, height: rect.height };
          var fillR = sv('rect', { x: inner.x, y: inner.y, width: inner.width, height: inner.height, fill: COLORS[0].main });
          lg.appendChild(fillR);
          lg._fill = fillR;
          gLines.appendChild(lg);
          ui.lines[dir][r2].push(lg);

          // hueco: rombo que va de punto a punto pasando por el centro de las cajas vecinas
          var pts = dir === 'h'
            ? [x0, y0, x0 + H, y0 - H, x0 + CELL, y0, x0 + H, y0 + H]
            : [x0, y0, x0 - H, y0 + H, x0, y0 + CELL, x0 + H, y0 + H];
          var sg = sv('g', { 'class': 'bx-slot', role: 'button', tabindex: '-1' });
          sg.dataset.dir = dir; sg.dataset.r = String(r2); sg.dataset.c = String(c2);
          var ghost = sv('rect', { 'class': 'bx-ghost', x: inner.x, y: inner.y, width: inner.width, height: inner.height, fill: COLORS[0].main });
          sg.appendChild(ghost);
          sg.appendChild(sv('polygon', { points: pts.join(' '), fill: 'transparent' }));
          sg._ghost = ghost;
          gSlots.appendChild(sg);
          ui.slots[dir][r2].push(sg);
        }
      }
    });
    ui.glow = sv('rect', { 'class': 'bx-glow', visibility: 'hidden' });
    gGlow.appendChild(ui.glow);

    function pick(slot) {
      if (!slot || !slot.classList.contains('bx-free') || ui.pending) return;
      ui.pending = true;
      svg.classList.add('bx-wait');
      slot.classList.add('bx-picked');
      clearTimeout(ui.pendingT);
      ui.pendingT = setTimeout(function () { // por si el server rechaza la jugada
        ui.pending = false; svg.classList.remove('bx-wait'); slot.classList.remove('bx-picked');
      }, 1500);
      ui.api.send({ dir: slot.dataset.dir, r: Number(slot.dataset.r), c: Number(slot.dataset.c) });
    }
    gSlots.addEventListener('click', function (ev) {
      pick(ev.target.closest && ev.target.closest('.bx-slot'));
    });
    gSlots.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        pick(ev.target.closest && ev.target.closest('.bx-slot'));
      }
    });

    ui.board.appendChild(svg);
    ui.svg = svg;
    ui.size = n;
  }

  /* Huellita pixel del color del dueño (por si no hay CatArt). */
  var PAW = ['.o.o.o.', 'opopopo', '.o.o.o.', '.ooooo.', 'opppppo', 'opwpppo', '.ooooo.'];
  function pawMarkup(x0, y0, col) {
    var s = '', map = { o: INK, p: col.main, w: '#fff' };
    for (var y = 0; y < PAW.length; y++) {
      for (var x = 0; x < PAW[y].length; x++) {
        var f = map[PAW[y][x]];
        if (f) s += '<rect x="' + (x0 + x * 2) + '" y="' + (y0 + y * 2) + '" width="2" height="2" fill="' + f + '"/>';
      }
    }
    return s;
  }

  /* Caja de cartón con el gatito asomado (coordenadas relativas a la casilla). */
  function boxMarkup(ui, state, owner) {
    var col = colorOf(state, owner);
    var p = null, ps = state.players || [];
    for (var i = 0; i < ps.length; i++) if (sameId(ps[i].id, owner)) p = ps[i];
    var key = String(owner);
    if (!(key in ui.catURL)) {
      var url = '';
      // CatArt normaliza un gato vacío al gatito por defecto (igual que la barra VS).
      try { if (window.CatArt && CatArt.toDataURL) url = CatArt.toDataURL((p && p.cat) || null, 2); } catch (e) { url = ''; }
      ui.catURL[key] = url;
    }
    var cat = ui.catURL[key];
    var s = '';
    // fondo de la casilla teñido con el color del dueño
    s += '<rect x="0" y="0" width="' + CELL + '" height="' + CELL + '" fill="' + col.light + '"/>';
    s += '<g class="bx-box">';
    // sombra
    s += '<rect x="7" y="35" width="26" height="2" fill="rgba(74,42,80,.22)"/>';
    // interior (abertura)
    s += '<rect x="7" y="19" width="26" height="5" fill="' + INK + '"/>';
    s += '<rect x="8" y="20" width="24" height="4" fill="' + CARD.deep + '"/>';
    // gatito
    if (cat) {
      s += '<g class="bx-cat"><image href="' + cat + '" x="7" y="1" width="26" height="26" preserveAspectRatio="xMidYMid meet"/></g>';
    } else {
      s += '<g class="bx-cat">' + pawMarkup(13, 8, col) + '</g>';
    }
    // solapas
    s += '<polygon points="3,17 8,22 8,25 1,20" fill="' + CARD.light + '" stroke="' + INK + '" stroke-width="1.2" stroke-linejoin="miter" shape-rendering="geometricPrecision"/>';
    s += '<polygon points="37,17 32,22 32,25 39,20" fill="' + CARD.light + '" stroke="' + INK + '" stroke-width="1.2" stroke-linejoin="miter" shape-rendering="geometricPrecision"/>';
    // frente
    s += '<rect x="6" y="22" width="28" height="14" fill="' + INK + '"/>';
    s += '<rect x="7" y="23" width="26" height="12" fill="' + CARD.base + '"/>';
    s += '<rect x="7" y="23" width="26" height="2" fill="' + CARD.light + '"/>';
    s += '<rect x="7" y="33" width="26" height="2" fill="' + CARD.dark + '"/>';
    s += '<rect x="18" y="23" width="4" height="12" fill="' + CARD.tape + '"/>';
    // etiqueta con el color del dueño (corazoncito)
    s += '<rect x="9" y="27" width="7" height="5" fill="' + INK + '"/>';
    s += '<rect x="10" y="28" width="5" height="3" fill="' + col.main + '"/>';
    s += '<rect x="11" y="28" width="1" height="1" fill="#fff"/>';
    s += '</g>';
    return s;
  }

  /* ---------- Actualización ---------- */
  function update(ui, state, myId, api) {
    if (api) ui.api = api;
    var d = state.data || {};
    var n = d.size || 4;
    if (!ui.svg || ui.size !== n) { buildBoard(ui, n); ui.prev = null; }
    var first = ui.prev == null;
    var prev = ui.prev || {};
    var playing = state.status === 'playing';
    var myTurn = playing && sameId(state.turn, myId);
    var myCol = colorOf(state, myId);

    // fin de jugada pendiente
    ui.pending = false;
    clearTimeout(ui.pendingT);
    ui.svg.classList.remove('bx-wait');
    ui.svg.classList.toggle('bx-over', !playing);

    // leyenda
    var lg = '';
    (state.players || []).forEach(function (p, i) {
      var c = COLORS[i % 2];
      var turn = playing && sameId(state.turn, p.id);
      lg += '<span class="bx-chip' + (turn ? ' bx-turn' : '') + '"><span class="bx-sw" style="background:' + c.main + '"></span>' +
        ui.api.escapeHTML(sameId(p.id, myId) ? 'Tú' : p.username) + ' <b>' + scoreOf(state, p.id) + '</b></span>';
    });
    if (ui.legendHTML !== lg) { ui.legend.innerHTML = lg; ui.legendHTML = lg; }

    // líneas
    var nowLines = countLines(d);
    ['h', 'v'].forEach(function (dir) {
      var grid = d[dir] || [];
      for (var r = 0; r < ui.lines[dir].length; r++) {
        for (var c = 0; c < ui.lines[dir][r].length; c++) {
          var owner = grid[r] ? grid[r][c] : null;
          var lgEl = ui.lines[dir][r][c];
          var slot = ui.slots[dir][r][c];
          var key = owner == null ? '' : String(owner);
          if (lgEl.dataset.owner !== key) {
            if (owner == null) {
              lgEl.setAttribute('visibility', 'hidden');
            } else {
              lgEl.setAttribute('visibility', 'visible');
              lgEl._fill.setAttribute('fill', colorOf(state, owner).main);
              if (!first) {
                lgEl.classList.remove('bx-new');
                void lgEl.getBoundingClientRect();
                lgEl.classList.add('bx-new');
              }
            }
            lgEl.dataset.owner = key;
          }
          var free = owner == null && myTurn;
          slot.classList.toggle('bx-free', free);
          slot.classList.remove('bx-picked');
          slot.setAttribute('tabindex', free ? '0' : '-1');
          slot.setAttribute('aria-label', (dir === 'h' ? 'Línea horizontal' : 'Línea vertical') + ' fila ' + (r + 1) + ', columna ' + (c + 1) +
            (owner == null ? '' : (sameId(owner, myId) ? ', tuya' : ', del rival')));
          if (free) slot._ghost.setAttribute('fill', myCol.main);
        }
      }
    });

    // última línea resaltada
    var ll = d.lastLine;
    if (ll && (ll.dir === 'h' || ll.dir === 'v')) {
      var gx = px(ll.c), gy = px(ll.r);
      var pad = 4;
      if (ll.dir === 'h') {
        ui.glow.setAttribute('x', gx - pad); ui.glow.setAttribute('y', gy - LW / 2 - pad);
        ui.glow.setAttribute('width', CELL + pad * 2); ui.glow.setAttribute('height', LW + pad * 2);
      } else {
        ui.glow.setAttribute('x', gx - LW / 2 - pad); ui.glow.setAttribute('y', gy - pad);
        ui.glow.setAttribute('width', LW + pad * 2); ui.glow.setAttribute('height', CELL + pad * 2);
      }
      ui.glow.setAttribute('visibility', 'visible');
    } else {
      ui.glow.setAttribute('visibility', 'hidden');
    }

    // cajitas
    var owners = d.owners || [];
    var claimedNow = 0;
    for (var r3 = 0; r3 < n; r3++) {
      for (var c3 = 0; c3 < n; c3++) {
        var o = owners[r3] ? owners[r3][c3] : null;
        var g = ui.cells[r3][c3];
        var k = o == null ? '' : String(o);
        if (g.dataset.owner !== k) {
          g.setAttribute('transform', 'translate(' + px(c3) + ' ' + px(r3) + ')');
          g.innerHTML = o == null ? '' : boxMarkup(ui, state, o);
          if (o != null && !first) {
            var bx = g.querySelector('.bx-box');
            if (bx) bx.classList.add('bx-new');
            if (sameId(o, prev.turn)) claimedNow++;
          }
          g.dataset.owner = k;
        }
      }
    }

    // pista
    var hint = '', mine = false;
    if (!playing) {
      hint = state.reason === 'boxes' ? '¡Todas las cajitas tienen dueño!' : 'Partida terminada';
    } else if (myTurn) {
      mine = true;
      hint = (claimedNow > 0 && sameId(prev.turn, myId)) ? '¡Cajita para ti! Vuelve a dibujar 📦' : 'Tu turno: dibuja una línea';
    } else {
      var opp = null;
      (state.players || []).forEach(function (p) { if (sameId(p.id, state.turn)) opp = p; });
      hint = (claimedNow > 0 ? '¡Se metió en una cajita! ' : '') + 'Esperando a ' + (opp ? opp.username : 'tu rival') + '…';
    }
    ui.hint.textContent = hint;
    ui.hint.classList.toggle('bx-mine', mine);
    ui.svg.setAttribute('aria-label', 'Tablero de cajitas, ' + nowLines + ' líneas dibujadas');

    ui.prev = { turn: state.turn };
  }

  /* ---------- Registro ---------- */
  GamesUI.register({
    id: 'boxes',
    name: 'Cajitas',
    emoji: '📦',
    description: 'Unan puntitos por turnos: quien cierre una cajita se mete dentro, ¡y a los gatos les encantan las cajas!',
    btnClass: 'btn-mint',
    build: build,
    update: update,
    scoreHTML: function (player, state) {
      return '<span>📦 ' + cajitas(scoreOf(state, player.id)) + '</span>';
    },
    react: function (prev, state, ctx) {
      var pd = (prev && prev.data) || {}, nd = (state && state.data) || {};
      var po = pd.owners || [], no = nd.owners || [];
      var gained = {}, any = false;
      for (var r = 0; r < no.length; r++) {
        for (var c = 0; c < (no[r] || []).length; c++) {
          var a = po[r] ? po[r][c] : null, b = no[r][c];
          if (a == null && b != null) { gained[String(b)] = b; any = true; }
        }
      }
      if (any) {
        Object.keys(gained).forEach(function (k) { ctx.happy(gained[k]); });
        ctx.sound('hit');
      } else if (countLines(nd) > countLines(pd)) {
        ctx.sound('move');
      }
    },
    overText: function (state, o) {
      var ps = state.players || [];
      var mine = scoreOf(state, o.myId), theirs = 0;
      ps.forEach(function (p) { if (!sameId(p.id, o.myId)) theirs = scoreOf(state, p.id); });
      if (o.draw) return '¡Empate! ' + mine + ' cajitas cada uno, hay cajas para todos 📦';
      if (o.won) return '¡Te quedaste con ' + cajitas(mine) + ' contra ' + theirs + '! Qué gatito tan cajero 📦';
      return (o.oppName || 'Tu rival') + ' juntó ' + cajitas(theirs) + ' contra tus ' + mine + '. ¡La próxima caja es tuya!';
    }
  });
})();
