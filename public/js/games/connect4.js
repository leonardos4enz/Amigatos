/* Amigatos — Conecta 4 (ovillos vs pescaditos)
   Juego enchufable: ver "Juegos enchufables" en CONTRACT.md */
(function () {
  'use strict';
  if (!window.GamesUI || !GamesUI.register) return;

  var ROWS = 6, COLS = 7;
  var INK = '#4a2a50';

  /* ---------- Fichas pixel (disco 14x14 generado) ---------- */
  var PAL = {
    yarn: { o: INK, p: '#ff9fbc', d: '#e9789c', l: '#ffc2d4', w: '#ffffff' },
    fish: { o: INK, p: '#8ec5ff', d: '#5a9be6', l: '#cfe8ff', w: '#ffffff', k: INK }
  };
  var FISH = [
    '..............', '..............', '..............', '..............',
    '......www.....',
    '....wwwwww.w..',
    '...wkwwwwwww..',
    '...wwwwwwwww..',
    '....wwwwww.w..',
    '......www.....'
  ];

  function pieceRows(kind) {
    var N = 14, c = 6.5, R = 6.9, rows = [];
    function inside(x, y) { return x >= 0 && y >= 0 && x < N && y < N && (x - c) * (x - c) + (y - c) * (y - c) <= R * R; }
    for (var y = 0; y < N; y++) {
      var row = '';
      for (var x = 0; x < N; x++) {
        var ch = '.';
        if (inside(x, y)) {
          var edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
          if (edge) ch = 'o';
          else if (kind === 'yarn') {
            // hebras en diagonal + sombra abajo a la derecha
            ch = (x + y) % 4 === 0 ? 'd' : ((x - y + 40) % 7 === 0 ? 'l' : 'p');
            if ((x - c) + (y - c) > 6.5 && ch === 'p') ch = 'd';
          } else {
            ch = (x - c) + (y - c) > 6 ? 'd' : 'p';
            var f = FISH[y] && FISH[y][x];
            if (f && f !== '.') ch = f;
          }
        }
        row += ch;
      }
      rows.push(row);
    }
    // brillito
    function put(x, y, ch) { rows[y] = rows[y].substr(0, x) + ch + rows[y].substr(x + 1); }
    put(3, 3, 'w'); put(4, 2, 'w'); put(2, 4, 'l'); put(5, 2, 'l');
    return rows;
  }

  var SVG_CACHE = {};
  function pieceSVG(kind) {
    if (SVG_CACHE[kind]) return SVG_CACHE[kind];
    var rows = pieceRows(kind), colors = PAL[kind] || PAL.yarn, out = '';
    for (var y = 0; y < rows.length; y++) {
      for (var x = 0; x < rows[y].length; x++) {
        var col = colors[rows[y][x]];
        if (col) out += '<rect x="' + x + '" y="' + y + '" width="1.05" height="1.05" fill="' + col + '"/>';
      }
    }
    SVG_CACHE[kind] = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" shape-rendering="crispEdges" aria-hidden="true">' + out + '</svg>';
    return SVG_CACHE[kind];
  }

  /* ---------- Utilidades ---------- */
  function sameId(a, b) { return a != null && b != null && String(a) === String(b); }
  function pieceOf(state, id) {
    var p = state && state.data && state.data.pieces;
    return (p && id != null && p[String(id)]) || null;
  }
  function plural(kind) { return kind === 'fish' ? 'pescaditos' : 'ovillos'; }
  function newPiece(prev, state) {
    var pb = prev && prev.data && prev.data.board, nb = state && state.data && state.data.board;
    if (!nb) return null;
    for (var r = 0; r < nb.length; r++) {
      for (var c = 0; c < nb[r].length; c++) {
        if (nb[r][c] != null && !(pb && pb[r] && pb[r][c] != null)) return { r: r, c: c, owner: nb[r][c] };
      }
    }
    return null;
  }
  function lineWord(line) {
    if (!line || line.length < 2) return 'en línea';
    var dr = line[1][0] - line[0][0], dc = line[1][1] - line[0][1];
    if (dr === 0) return 'en fila';
    if (dc === 0) return 'en columna';
    return 'en diagonal';
  }

  /* ---------- Estilos ---------- */
  var CSS = [
    '.c4{width:100%;max-width:470px;display:grid;justify-items:center;gap:10px;',
    '  --c4-gap:5px;--c4-pad:10px;--c4-cell:min(54px,calc((100vw - 120px) / 7));}',
    '@supports (width:1cqi){.c4{container-type:inline-size}',
    '  .c4-stage{--c4-cell:min(54px,calc((100cqi - 2 * var(--c4-pad) - 6 * var(--c4-gap) - 12px) / 7))}}',
    '.c4-legend{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;font-size:16px}',
    '.c4-legend span{display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 6px;background:#fff7ea;',
    '  box-shadow:0 -3px 0 0 #4a2a50,0 3px 0 0 #4a2a50,-3px 0 0 0 #4a2a50,3px 0 0 0 #4a2a50;margin:3px;opacity:.6}',
    '.c4-legend span.c4-on{opacity:1;background:#fff3c9;animation:c4-nudge .8s steps(2) infinite alternate}',
    '.c4-legend svg{width:24px;height:24px}',
    '.c4-stage{display:grid;justify-items:center;width:100%}',
    '.c4-top{display:grid;grid-template-columns:repeat(7,var(--c4-cell));gap:var(--c4-gap);height:calc(var(--c4-cell) * .9);',
    '  padding:0 calc(var(--c4-pad) + 4px)}',
    '.c4-top div{display:grid;place-items:end center}',
    '.c4-top svg{width:80%;height:80%;opacity:0;transform:translateY(-4px)}',
    '.c4-top div.c4-show svg{opacity:1;animation:c4-bob .6s steps(2) infinite alternate}',
    '.c4-board{position:relative;display:grid;grid-template-columns:repeat(7,var(--c4-cell));gap:var(--c4-gap);',
    '  padding:var(--c4-pad);background:#bba4f5;margin:4px 4px 14px;',
    '  box-shadow:0 -4px 0 0 #4a2a50,0 4px 0 0 #4a2a50,-4px 0 0 0 #4a2a50,4px 0 0 0 #4a2a50,0 12px 0 0 rgba(74,42,80,.22),',
    '    inset 0 -5px 0 0 #9a80e0,inset 4px 4px 0 0 #d9c9ff}',
    '.c4-board::before,.c4-board::after{content:"";position:absolute;bottom:-14px;width:14%;height:10px;background:#9a80e0;',
    '  box-shadow:0 0 0 3px #4a2a50}',
    '.c4-board::before{left:6%}.c4-board::after{right:6%}',
    '.c4-col{display:grid;grid-template-rows:repeat(6,var(--c4-cell));gap:var(--c4-gap);border:0;padding:0;margin:0;',
    '  background:transparent;cursor:pointer;font:inherit;color:inherit;position:relative;-webkit-tap-highlight-color:transparent}',
    '.c4-col:disabled{cursor:default}',
    '.c4-col:focus{outline:none}',
    '.c4-col:focus-visible{outline:3px dashed #4a2a50;outline-offset:3px}',
    '.c4-col:not(:disabled):hover .c4-cell,.c4-col:not(:disabled):focus-visible .c4-cell{background:#fff3c9}',
    '.c4-cell{position:relative;width:var(--c4-cell);height:var(--c4-cell);background:#fff7ea;display:grid;place-items:center;',
    '  box-shadow:inset 0 4px 0 0 #fdebd6,inset 3px 0 0 0 #fdebd6,0 0 0 3px #4a2a50;transition:background .1s}',
    '.c4-cell svg{width:86%;height:86%;position:relative;z-index:1}',
    '.c4-ghost svg{opacity:0}',
    '.c4-col:not(:disabled):hover .c4-ghost svg,.c4-col:not(:disabled):focus-visible .c4-ghost svg{opacity:.35}',
    '.c4-drop svg{z-index:3;animation:c4-fall var(--c4-dur,.4s) steps(var(--c4-steps,6)) both}',
    '@keyframes c4-fall{0%{transform:translateY(calc((var(--c4-cell) + var(--c4-gap)) * var(--c4-n,1) * -1))}',
    '  82%{transform:translateY(0) scale(1.1,.82)}100%{transform:none}}',
    '.c4-last::after{content:"";position:absolute;width:16%;height:16%;right:6%;top:6%;background:#ffd56e;',
    '  box-shadow:0 0 0 2px #4a2a50;z-index:2}',
    '.c4-done .c4-cell:not(.c4-win) svg{filter:saturate(.55) opacity(.75)}',
    '.c4-win{animation:c4-blink .5s steps(2) infinite}',
    '.c4-win svg{animation:c4-hop .5s steps(2) infinite alternate}',
    '.c4-wait .c4-board{filter:saturate(.85)}',
    '.c4-hint{font-size:15px;color:#6e4c74;min-height:1.3em;text-align:center}',
    '@keyframes c4-blink{0%{background:#ffd56e}100%{background:#fff3c9}}',
    '@keyframes c4-hop{to{transform:translateY(-10%)}}',
    '@keyframes c4-bob{to{transform:translateY(2px)}}',
    '@keyframes c4-nudge{to{transform:translateY(-2px)}}',
    '@media (prefers-reduced-motion:reduce){.c4-drop svg,.c4-win svg,.c4-top div.c4-show svg,.c4-legend span.c4-on{animation:none}}'
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('c4-style')) return;
    var s = document.createElement('style');
    s.id = 'c4-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---------- Construcción ---------- */
  function build(container, api) {
    injectCSS();
    var wrap = document.createElement('div');
    wrap.className = 'c4';
    wrap.innerHTML =
      '<div class="c4-legend" aria-live="polite"></div>' +
      '<div class="c4-stage"><div class="c4-top" aria-hidden="true"></div>' +
      '<div class="c4-board" role="grid" aria-label="Tablero de Conecta 4"></div></div>' +
      '<div class="c4-hint" aria-live="polite"></div>';
    var top = wrap.querySelector('.c4-top');
    var boardEl = wrap.querySelector('.c4-board');
    var ui = {
      wrap: wrap, legend: wrap.querySelector('.c4-legend'), hint: wrap.querySelector('.c4-hint'),
      tops: [], cols: [], cells: [], prevBoard: null, myKind: 'yarn', hover: -1
    };
    for (var c = 0; c < COLS; c++) {
      var t = document.createElement('div');
      top.appendChild(t);
      ui.tops.push(t);
      var col = document.createElement('button');
      col.type = 'button';
      col.className = 'c4-col';
      col.dataset.col = String(c);
      var cells = [];
      for (var r = 0; r < ROWS; r++) {
        var cell = document.createElement('div');
        cell.className = 'c4-cell';
        col.appendChild(cell);
        cells.push(cell);
      }
      boardEl.appendChild(col);
      ui.cols.push(col);
      ui.cells.push(cells); // ui.cells[c][r]
    }

    function setHover(c) {
      ui.hover = c;
      ui.tops.forEach(function (t, i) { t.classList.toggle('c4-show', i === c && !ui.cols[i].disabled); });
    }
    boardEl.addEventListener('mouseover', function (ev) {
      var b = ev.target.closest('.c4-col');
      setHover(b ? Number(b.dataset.col) : -1);
    });
    boardEl.addEventListener('mouseleave', function () { setHover(-1); });
    boardEl.addEventListener('focusin', function (ev) {
      var b = ev.target.closest('.c4-col');
      if (b) setHover(Number(b.dataset.col));
    });
    boardEl.addEventListener('focusout', function () { setHover(-1); });
    boardEl.addEventListener('keydown', function (ev) {
      var b = ev.target.closest('.c4-col');
      if (!b) return;
      var i = Number(b.dataset.col), d = ev.key === 'ArrowLeft' ? -1 : ev.key === 'ArrowRight' ? 1 : 0;
      if (!d) return;
      ev.preventDefault();
      for (var j = i + d; j >= 0 && j < COLS; j += d) {
        if (!ui.cols[j].disabled) { ui.cols[j].focus(); break; }
      }
    });
    boardEl.addEventListener('click', function (ev) {
      var b = ev.target.closest('.c4-col');
      if (!b || b.disabled) return;
      ui.cols.forEach(function (x) { x.disabled = true; }); // evita doble click
      setHover(-1);
      api.send({ col: Number(b.dataset.col) });
    });

    ui.setHover = setHover;
    container.appendChild(wrap);
    return ui;
  }

  /* ---------- Actualización ---------- */
  function update(ui, state, myId, api) {
    var d = state.data || {};
    var board = d.board || [];
    var rows = d.rows || ROWS;
    var playing = state.status === 'playing';
    var myTurn = playing && sameId(state.turn, myId);
    var myKind = pieceOf(state, myId) || 'yarn';
    var esc = (api && api.escapeHTML) || function (s) { return String(s); };

    // leyenda
    var lg = '';
    (state.players || []).forEach(function (p) {
      var kind = pieceOf(state, p.id) || 'yarn';
      var on = playing && sameId(state.turn, p.id);
      lg += '<span class="' + (on ? 'c4-on' : '') + '">' + pieceSVG(kind) + ' ' +
        esc(sameId(p.id, myId) ? 'Tú' : p.username) + '</span>';
    });
    if (ui.legendHTML !== lg) { ui.legend.innerHTML = lg; ui.legendHTML = lg; }

    // vista previa arriba
    if (ui.myKind !== myKind || !ui.topsReady) {
      ui.tops.forEach(function (t) { t.innerHTML = pieceSVG(myKind); });
      ui.myKind = myKind; ui.topsReady = true;
    }

    var winSet = {};
    (d.winLine || []).forEach(function (rc) { winSet[rc[0] + ',' + rc[1]] = true; });
    var last = d.lastMove;
    var prev = ui.prevBoard;

    for (var c = 0; c < COLS; c++) {
      var landing = -1;
      for (var r = rows - 1; r >= 0; r--) { if (!board[r] || board[r][c] == null) { landing = r; break; } }
      for (r = 0; r < rows; r++) {
        var cell = ui.cells[c][r];
        var owner = board[r] ? board[r][c] : null;
        var key = owner == null ? (r === landing ? 'g' + myKind : '') : 'p' + String(owner);
        if (cell.dataset.k !== key) {
          cell.classList.remove('c4-drop');
          if (owner != null) {
            cell.innerHTML = pieceSVG(pieceOf(state, owner) || 'yarn');
            var wasEmpty = prev && !(prev[r] && prev[r][c] != null);
            if (wasEmpty) {
              var n = r + 1;
              cell.style.setProperty('--c4-n', String(n));
              cell.style.setProperty('--c4-steps', String(Math.max(3, n + 2)));
              cell.style.setProperty('--c4-dur', (0.16 + n * 0.06).toFixed(2) + 's');
              void cell.offsetWidth;
              cell.classList.add('c4-drop');
            }
          } else {
            cell.innerHTML = r === landing ? pieceSVG(myKind) : '';
          }
          cell.dataset.k = key;
        }
        cell.classList.toggle('c4-ghost', owner == null && r === landing);
        cell.classList.toggle('c4-win', !!winSet[r + ',' + c]);
        cell.classList.toggle('c4-last', !!(playing && last && last.r === r && last.c === c));
      }
      var col = ui.cols[c];
      col.disabled = !(myTurn && landing !== -1);
      col.setAttribute('aria-label', 'Columna ' + (c + 1) + (landing === -1 ? ', llena' : ''));
    }
    ui.prevBoard = board.map(function (row) { return row.slice(); });

    ui.wrap.classList.toggle('c4-wait', playing && !myTurn);
    ui.wrap.classList.toggle('c4-done', !playing && !!(d.winLine && d.winLine.length));
    if (ui.hover >= 0) ui.setHover(ui.hover);

    var hint;
    if (!playing) hint = state.reason === 'draw' ? '¡Tablero lleno! Nadie hizo cuatro.' : '';
    else if (myTurn) hint = 'Elige una columna y suelta tu ' + (myKind === 'fish' ? 'pescadito' : 'ovillo') + ' 🐾';
    else {
      var opp = (state.players || []).filter(function (p) { return !sameId(p.id, myId); })[0];
      hint = (opp ? esc(opp.username) : 'Tu rival') + ' está pensando…';
    }
    if (ui.hintHTML !== hint) { ui.hint.innerHTML = hint; ui.hintHTML = hint; }
  }

  GamesUI.register({
    id: 'connect4',
    name: 'Conecta 4',
    emoji: '🧶',
    description: 'Suelta ovillos y pescaditos por las columnas: ¡el primero en juntar cuatro en línea se lleva todos los mimos!',
    btnClass: 'btn-lilac',
    build: build,
    update: update,
    scoreHTML: function (player, state) {
      var kind = pieceOf(state, player.id) || 'yarn';
      return pieceSVG(kind) + '<span>' + (kind === 'fish' ? 'Peces' : 'Ovillos') + '</span>';
    },
    react: function (prev, state, ctx) {
      var np = newPiece(prev, state);
      if (!np) return;
      ctx.sound('move');
      if (sameId(np.owner, ctx.myId)) ctx.happy(ctx.myId);
    },
    overText: function (state, o) {
      var d = state.data || {};
      if (o.draw || state.reason === 'draw') return '¡Tablero lleno! Empate peludito 🐾';
      var winKind = pieceOf(state, state.winnerId) || 'yarn';
      var where = lineWord(d.winLine);
      if (o.won) return '¡Cuatro ' + plural(winKind) + ' ' + where + '!';
      return 'Los ' + plural(winKind) + ' de ' + (o.oppName || 'tu rival') + ' hicieron cuatro ' + where + '.';
    }
  });
})();
