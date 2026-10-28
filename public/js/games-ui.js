/* Amigatos — UI de minijuegos (Gato y Ahorcado)
   API: window.GamesUI.render(container, state, me, sendMove)
   - me: objeto usuario ({id,...}) o id numérico
   - sendMove(move): envía game:move (app.js añade gameId) */
(function () {
  'use strict';

  var C = {
    ink: '#4a2a50', pink: '#ff9fbc', pinkL: '#ffc2d4', pinkD: '#e9789c',
    lilac: '#bba4f5', lilacL: '#d9c9ff', lilacD: '#9a80e0',
    mint: '#93dfbd', mintD: '#5fc39a', cream: '#fff7ea', white: '#ffffff',
    peach: '#ffb98a', peachD: '#ee9663', gold: '#ffd56e', sky: '#cfe8ff',
    wood: '#c98b5a', woodD: '#9a6239', woodL: '#e2ab7c', red: '#f0708f'
  };

  /* ---------- Iconos pixel (SVG) ---------- */
  var ICONS = {
    paw: {
      rows: [
        '....oo..oo....',
        '...oppooppo...',
        '...oppooppo...',
        '.oo.oo..oo.oo.',
        'oppo......oppo',
        'oppo.oooo.oppo',
        '.oo.oppppo.oo.',
        '...oppppppo...',
        '..oppwpppppo..',
        '..oppppppppo..',
        '...oppppppo...',
        '....oooooo....'
      ],
      colors: { o: C.ink, p: C.pink, w: C.pinkL }
    },
    fish: {
      rows: [
        '.....ooooo.....',
        'oo.ooblllbooo..',
        'oboblllllllbbo.',
        'obbllllllllbkbo',
        'obbbllllllbbbbo',
        'oboblllllllbbo.',
        'oo.ooblllbooo..',
        '.....ooooo.....'
      ],
      colors: { o: C.ink, b: C.lilacD, l: C.lilacL, k: C.ink }
    },
    heart: {
      rows: [
        '.oo...oo.',
        'oppo.oppo',
        'opwpopppo',
        'opppppppo',
        '.opppppo.',
        '..opppo..',
        '...opo...',
        '....o....'
      ],
      colors: { o: C.ink, p: C.red, w: C.white }
    },
    yarn: {
      rows: [
        '....oooo....',
        '..oopppwoo..',
        '.opdppdpppo.',
        '.oppdppdppo.',
        'opdppdppdppo',
        'oppdppdppdpo',
        'opppdppdppdo',
        'odppdppdpppo',
        '.oppdppdppo.',
        '.opppdppdpo.',
        '..oopppdoo.o',
        '....oooo.oo.'
      ],
      colors: { o: C.ink, p: C.pink, d: C.pinkD, w: C.white }
    },
    cat: {
      rows: [
        '.o...........o.',
        'opo.........opo',
        'oppo.......oppo',
        'opppooooooopppo',
        'opppppppppppppo',
        'oppkkpppppkkppo',
        'oppkwpppppkwppo',
        'opppppppppppppo',
        'orrpppopoppprro',
        'oppppppoppppppo',
        '.opppppppppppo.',
        '..ooooooooooo..'
      ],
      colors: { o: C.ink, p: C.peach, k: C.ink, w: C.white, r: C.pink }
    },
    star: {
      rows: [
        '....o....',
        '...ogo...',
        'oooogoooo',
        'oggggwggo',
        '.oggggwo.',
        '..ogggo..',
        '.oggogo..',
        'ogo...ogo',
        'oo.....oo'
      ],
      colors: { o: C.ink, g: C.gold, w: C.white }
    }
  };

  function pixelSVG(name, extraClass) {
    var ic = ICONS[name];
    if (!ic) return '';
    var w = 0, h = ic.rows.length, out = '';
    for (var y = 0; y < h; y++) {
      var row = ic.rows[y];
      if (row.length > w) w = row.length;
      for (var x = 0; x < row.length; x++) {
        var col = ic.colors[row[x]];
        if (col) out += '<rect x="' + x + '" y="' + y + '" width="1.05" height="1.05" fill="' + col + '"/>';
      }
    }
    var s = Math.max(w, h);
    var ox = (s - w) / 2, oy = (s - h) / 2;
    return '<svg class="' + (extraClass || '') + '" xmlns="http://www.w3.org/2000/svg" viewBox="' + (-ox) + ' ' + (-oy) + ' ' + s + ' ' + s +
      '" shape-rendering="crispEdges" aria-hidden="true">' + out + '</svg>';
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function idOf(me) { return me && typeof me === 'object' ? me.id : me; }
  function sameId(a, b) { return a != null && b != null && String(a) === String(b); }
  function playerById(state, id) {
    var ps = state.players || [];
    for (var i = 0; i < ps.length; i++) if (sameId(ps[i].id, id)) return ps[i];
    return null;
  }
  function symbolFor(state, id) {
    var s = state.data && state.data.symbols;
    return s ? s[String(id)] : null;
  }
  function iconForSymbol(sym) { return sym === 'O' ? 'fish' : 'paw'; }

  /* ---------- Contexto actual (para teclado físico) ---------- */
  var current = null; // {container, state, myId, sendMove}

  document.addEventListener('keydown', function (ev) {
    if (!current || !current.container.isConnected) return;
    var st = current.state;
    if (!st || st.type !== 'hangman' || st.status !== 'playing' || !sameId(st.turn, current.myId)) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    var t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (document.querySelector('.modal-backdrop:not(.hidden)')) return;
    var k = (ev.key || '').toUpperCase();
    if (/^[A-ZÑ]$/.test(k)) {
      var guessed = (st.data && st.data.guessed) || [];
      if (guessed.indexOf(k) === -1) { ev.preventDefault(); current.sendMove({ letter: k }); }
    }
  });

  /* =====================================================
     GATO (tic-tac-toe)
     ===================================================== */
  function buildTTT(root) {
    root.innerHTML = '';
    var wrap = el('div', 'ttt');
    var legend = el('div', 'ttt-legend');
    var board = el('div', 'ttt-board');
    board.setAttribute('role', 'grid');
    var cells = [];
    for (var i = 0; i < 9; i++) {
      var b = el('button', 'cell');
      b.type = 'button';
      b.dataset.cell = String(i);
      b.setAttribute('aria-label', 'Casilla ' + (i + 1));
      board.appendChild(b);
      cells.push(b);
    }
    board.addEventListener('click', function (ev) {
      var btn = ev.target.closest('.cell');
      if (!btn || btn.disabled || !current) return;
      btn.disabled = true; // evita doble click
      current.sendMove({ cell: Number(btn.dataset.cell) });
    });
    wrap.appendChild(legend);
    wrap.appendChild(board);
    root.appendChild(wrap);
    return { legend: legend, cells: cells, prevBoard: null };
  }

  function updateTTT(ui, state, myId) {
    var d = state.data || {};
    var board = d.board || [];
    var win = d.winLine || [];
    var myTurn = state.status === 'playing' && sameId(state.turn, myId);
    var mySym = symbolFor(state, myId) || 'X';

    // leyenda
    var lg = '';
    (state.players || []).forEach(function (p) {
      var sym = symbolFor(state, p.id);
      lg += '<span>' + pixelSVG(iconForSymbol(sym)) + ' ' + escapeHTML(sameId(p.id, myId) ? 'Tú' : p.username) + '</span>';
    });
    if (ui.legendHTML !== lg) { ui.legend.innerHTML = lg; ui.legendHTML = lg; }

    for (var i = 0; i < 9; i++) {
      var c = ui.cells[i];
      var owner = board[i];
      var key = owner == null ? '' : String(owner);
      if (c.dataset.owner !== key) {
        if (owner == null) {
          c.innerHTML = '<span class="ghost">' + pixelSVG(iconForSymbol(mySym)) + '</span>';
          c.classList.remove('placed');
        } else {
          c.innerHTML = pixelSVG(iconForSymbol(symbolFor(state, owner)));
          if (ui.prevBoard) c.classList.add('placed');
        }
        c.dataset.owner = key;
      }
      if (owner == null) c.querySelector('.ghost').innerHTML = pixelSVG(iconForSymbol(mySym));
      c.disabled = !(myTurn && owner == null);
      c.classList.toggle('win', win.indexOf(i) !== -1);
      var who = owner == null ? 'vacía' : (sameId(owner, myId) ? 'tuya' : 'del rival');
      c.setAttribute('aria-label', 'Casilla ' + (i + 1) + ', ' + who);
    }
    ui.prevBoard = board.slice();
  }

  /* =====================================================
     AHORCADO (versión ovillo de lana)
     ===================================================== */
  var LETTERS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');

  function buildHM(root) {
    root.innerHTML = '';
    var wrap = el('div', 'hm');

    var top = el('div', 'hm-top');
    var canvas = el('canvas', 'hm-canvas pixel-canvas');
    canvas.width = 240; canvas.height = 240;
    canvas.setAttribute('role', 'img');
    var info = el('div', 'hm-info');
    var cat = el('div', 'hm-category');
    var lives = el('div', 'hm-lives');
    var wrong = el('div', 'hm-wrong');
    var scores = el('div', 'hm-scores');
    info.appendChild(cat); info.appendChild(lives); info.appendChild(wrong); info.appendChild(scores);
    top.appendChild(canvas); top.appendChild(info);

    var word = el('div', 'hm-word');
    word.setAttribute('aria-live', 'polite');

    var kb = el('div', 'keyboard');
    var keys = {};
    LETTERS.forEach(function (L) {
      var k = el('button', 'key', L);
      k.type = 'button';
      k.dataset.letter = L;
      k.setAttribute('aria-label', 'Letra ' + L);
      kb.appendChild(k);
      keys[L] = k;
    });
    kb.addEventListener('click', function (ev) {
      var k = ev.target.closest('.key');
      if (!k || k.disabled || !current) return;
      k.disabled = true;
      current.sendMove({ letter: k.dataset.letter });
    });

    var form = el('form', 'hm-guess');
    form.setAttribute('autocomplete', 'off');
    var input = el('input', 'input');
    input.type = 'text';
    input.maxLength = 30;
    input.placeholder = '¿Ya sabes la palabra?';
    input.setAttribute('aria-label', 'Adivinar palabra');
    var gbtn = el('button', 'btn btn-lilac btn-sm', 'Adivinar palabra');
    gbtn.type = 'submit';
    form.appendChild(input); form.appendChild(gbtn);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!current) return;
      var w = normalizeWord(input.value);
      if (!w) { input.focus(); return; }
      current.sendMove({ word: w });
      input.value = '';
    });

    wrap.appendChild(top);
    wrap.appendChild(word);
    wrap.appendChild(kb);
    wrap.appendChild(form);
    root.appendChild(wrap);

    return {
      canvas: canvas, cat: cat, lives: lives, wrong: wrong, scores: scores, word: word,
      kb: kb, keys: keys, input: input, gbtn: gbtn, form: form,
      prevMasked: null, prevWrong: null, lastDrawKey: ''
    };
  }

  function normalizeWord(s) {
    s = String(s || '').toUpperCase().trim();
    // quitar acentos pero conservar la Ñ
    s = s.replace(/Ñ/g, '\u0001');
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* noop */ }
    s = s.replace(/\u0001/g, 'Ñ');
    return s.replace(/\s+/g, ' ');
  }

  function updateHM(ui, state, myId) {
    var d = state.data || {};
    var masked = d.masked || [];
    var guessed = d.guessed || [];
    var wrongN = d.wrong || 0;
    var maxWrong = d.maxWrong || 6;
    var playing = state.status === 'playing';
    var myTurn = playing && sameId(state.turn, myId);
    var reveal = !playing && d.word ? String(d.word) : null;

    ui.cat.textContent = 'Pista: ' + (d.category || '???');

    // vidas (corazones)
    var lh = '';
    for (var i = 0; i < maxWrong; i++) {
      var lost = i >= maxWrong - wrongN;
      var lostNow = lost && ui.prevWrong != null && i < maxWrong - ui.prevWrong;
      lh += '<span class="' + (lost ? 'lost' : '') + (lostNow ? ' lost-now' : '') + '">' + pixelSVG('heart') + '</span>';
    }
    ui.lives.innerHTML = lh;
    ui.wrong.textContent = 'Fallos: ' + wrongN + ' / ' + maxWrong;

    // marcadores
    var sc = d.scores || {};
    var sh = '';
    (state.players || []).forEach(function (p) {
      var n = sc[String(p.id)] || 0;
      sh += '<span>' + (sameId(p.id, myId) ? '⭐ Tú' : '⭐ ' + escapeHTML(p.username)) + ': <b>' + n + '</b></span>';
    });
    ui.scores.innerHTML = sh;

    // palabra en fichas (agrupadas por palabra para que no se partan)
    var html = '<span class="hm-wordpart">';
    for (var j = 0; j < masked.length; j++) {
      var ch = masked[j];
      if (ch === ' ') { html += '</span><span class="tile-gap"></span><span class="hm-wordpart">'; continue; }
      if (ch == null) {
        if (reveal && reveal[j] && reveal[j] !== ' ') html += '<span class="tile reveal new">' + escapeHTML(reveal[j]) + '</span>';
        else html += '<span class="tile empty">_</span>';
      } else {
        var isNew = ui.prevMasked && ui.prevMasked[j] == null;
        html += '<span class="tile shown' + (isNew ? ' new' : '') + '">' + escapeHTML(ch) + '</span>';
      }
    }
    html += '</span>';
    ui.word.innerHTML = html;
    var spoken = masked.map(function (c) { return c == null ? 'guion' : c; }).join(' ');
    ui.word.setAttribute('aria-label', 'Palabra: ' + spoken);

    // teclado
    var inWord = {};
    masked.forEach(function (c) { if (c && c !== ' ') inWord[c] = true; });
    if (reveal) reveal.split('').forEach(function (c) { inWord[c] = true; });
    LETTERS.forEach(function (L) {
      var k = ui.keys[L];
      var g = guessed.indexOf(L) !== -1;
      k.classList.toggle('hit', g && !!inWord[L]);
      k.classList.toggle('miss', g && !inWord[L]);
      k.disabled = g || !myTurn;
    });
    ui.kb.classList.toggle('locked', !myTurn);
    ui.input.disabled = !myTurn;
    ui.gbtn.disabled = !myTurn;
    ui.form.classList.toggle('hidden', !playing);
    ui.input.placeholder = myTurn ? '¿Ya sabes la palabra?' : 'Espera tu turno…';

    // dibujo
    var drawKey = wrongN + '/' + maxWrong + '/' + state.status;
    if (drawKey !== ui.lastDrawKey) {
      drawYarnScene(ui.canvas, wrongN, maxWrong, !playing && state.reason === 'hanged');
      ui.lastDrawKey = drawKey;
    }
    ui.canvas.setAttribute('aria-label', 'Ovillo: ' + wrongN + ' de ' + maxWrong + ' fallos');

    ui.prevMasked = masked.slice();
    ui.prevWrong = wrongN;
  }

  /* Escena: un poste de madera con un ovillo colgando. Cada fallo deshace
     el ovillo (se encoge) y la lana suelta se amontona en el suelo.
     Al llegar a maxWrong el ovillo desaparece y un gatito triste mira la lana. */
  function drawYarnScene(canvas, wrong, max, lostAll) {
    var G = 48; // rejilla lógica 48x48
    var S = Math.floor(canvas.width / G);
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    function px(x, y, c, w, h) { ctx.fillStyle = c; ctx.fillRect(x * S, y * S, (w || 1) * S, (h || 1) * S); }

    var t = Math.max(0, Math.min(1, wrong / max));

    // cielo
    px(0, 0, C.sky, G, G);
    // nubecitas
    px(34, 4, C.white, 6, 2); px(36, 3, C.white, 3, 1); px(35, 6, C.white, 5, 1);
    px(2, 12, C.white, 5, 2); px(3, 11, C.white, 2, 1);
    // suelo
    px(0, 41, C.mint, G, 7);
    px(0, 41, C.mintD, G, 1);
    for (var gx = 1; gx < G; gx += 5) px(gx, 40, C.mintD, 1, 1);
    for (var gx2 = 3; gx2 < G; gx2 += 7) px(gx2, 44, C.mintD, 1, 1);

    // poste (aparece por partes en los primeros fallos para dar progresión extra)
    var stage = wrong; // 0..max
    // base siempre
    px(4, 39, C.woodD, 14, 2); px(5, 38, C.wood, 12, 1);
    // poste vertical
    px(9, 8, C.woodD, 4, 31); px(10, 8, C.wood, 2, 31); px(10, 8, C.woodL, 1, 31);
    // viga
    px(9, 6, C.woodD, 26, 3); px(10, 7, C.wood, 24, 1);
    // escuadra
    for (var b = 0; b < 6; b++) px(13 + b, 14 - b, C.woodD, 2, 1);
    // gancho y cuerda
    var hx = 30;
    px(hx, 9, C.ink, 1, 2);

    // ovillo
    var maxR = 8;
    var r = lostAll ? 0 : Math.round(maxR * (1 - t));
    if (wrong >= max) r = 0;
    var cy = 20;
    if (r > 0) {
      // hilo hasta el ovillo
      px(hx, 11, C.pinkD, 1, cy - r - 11 + 1);
      drawBall(hx, cy, r);
    } else {
      // solo cuelga un hilo suelto
      px(hx, 11, C.pinkD, 1, 6);
      px(hx + 1, 17, C.pinkD, 1, 1);
    }

    // hilo suelto: cae del ovillo hasta el suelo y se amontona
    if (wrong > 0) {
      var startY = r > 0 ? cy + r : 18;
      var sx = hx;
      for (var y = startY; y < 40; y++) {
        var wav = Math.round(Math.sin(y * 0.7) * 1.2);
        px(sx + wav, y, C.pinkD);
      }
      // montón en el suelo: largo proporcional a los fallos
      var len = Math.round(4 + 22 * t);
      for (var i = 0; i < len; i++) {
        var x = hx - i;
        var yy = 40 + Math.round(Math.sin(i * 0.9) * 1);
        if (x < 0) break;
        px(x, yy, i % 3 === 0 ? C.pinkD : C.pink);
        if (i % 5 === 2) px(x, yy - 1, C.pink);
      }
      // rulos de lana
      var loops = Math.floor(t * 4);
      for (var l = 0; l < loops; l++) drawLoop(hx - 4 - l * 6, 38);
    }

    // gatito pequeño a la derecha
    drawKitty(37, 33, wrong >= max || lostAll);

    function drawBall(cx, cy2, rad) {
      for (var yy2 = -rad - 1; yy2 <= rad + 1; yy2++) {
        for (var xx = -rad - 1; xx <= rad + 1; xx++) {
          var d2 = xx * xx + yy2 * yy2;
          if (d2 <= (rad + 0.6) * (rad + 0.6)) {
            var col;
            if (d2 > (rad - 0.6) * (rad - 0.6)) col = C.ink;
            else if (((xx - yy2) % 3 + 3) % 3 === 0) col = C.pinkD;
            else col = C.pink;
            px(cx + xx, cy2 + yy2, col);
          }
        }
      }
      if (rad >= 3) { px(cx - Math.floor(rad / 2), cy2 - Math.floor(rad / 2), C.white, 1, 1); px(cx - Math.floor(rad / 2) + 1, cy2 - Math.floor(rad / 2), C.white, 1, 1); }
    }
    function drawLoop(x0, y0) {
      px(x0, y0, C.pinkD); px(x0 + 1, y0 - 1, C.pinkD); px(x0 + 2, y0 - 1, C.pinkD);
      px(x0 + 3, y0, C.pinkD); px(x0 + 2, y0 + 1, C.pinkD); px(x0 + 1, y0 + 1, C.pinkD);
    }
    function drawKitty(x0, y0, sad) {
      var o = C.ink, f = C.peach, w = C.white;
      // orejas
      px(x0, y0, o); px(x0 + 6, y0, o);
      px(x0, y0 + 1, o); px(x0 + 1, y0 + 1, f); px(x0 + 5, y0 + 1, f); px(x0 + 6, y0 + 1, o);
      // cabeza
      px(x0, y0 + 2, o, 7, 1);
      px(x0 - 1, y0 + 2, o, 1, 4); px(x0 + 7, y0 + 2, o, 1, 4);
      px(x0, y0 + 2, f, 7, 4); px(x0, y0 + 1, o); px(x0 + 6, y0 + 1, o);
      px(x0 + 1, y0 + 1, f); px(x0 + 5, y0 + 1, f);
      // ojos
      if (sad) { px(x0 + 1, y0 + 3, o, 2, 1); px(x0 + 4, y0 + 3, o, 2, 1); px(x0 + 1, y0 + 4, '#7cc6fe'); }
      else { px(x0 + 1, y0 + 3, o, 1, 2); px(x0 + 5, y0 + 3, o, 1, 2); px(x0 + 1, y0 + 3, w); px(x0 + 5, y0 + 3, w); px(x0 + 2, y0 + 3, o, 1, 2); px(x0 + 4, y0 + 3, o, 1, 2); }
      px(x0 + 3, y0 + 4, C.pinkD);
      // cuerpo
      px(x0 - 1, y0 + 6, o, 9, 1);
      px(x0 - 1, y0 + 6, o, 1, 2); px(x0 + 7, y0 + 6, o, 1, 2);
      px(x0, y0 + 6, f, 7, 2);
      px(x0, y0 + 8, o, 7, 1);
      // cola
      px(x0 + 8, y0 + 5, o, 1, 3); px(x0 + 9, y0 + 4, o, 1, 2);
    }
  }

  /* ---------- Utilidades ---------- */
  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- API pública ---------- */
  function render(container, state, me, sendMove) {
    if (!container || !state) return;
    var myId = idOf(me);
    current = { container: container, state: state, myId: myId, sendMove: sendMove || function () {} };
    var key = state.id + ':' + state.type;
    var plugin = plugins[state.type];
    var api = { send: current.sendMove, icon: pixelSVG, escapeHTML: escapeHTML };
    if (container._gamesKey !== key || !container._gamesUI) {
      container._gamesKey = key;
      container.innerHTML = '';
      if (plugin) container._gamesUI = plugin.build(container, api) || {};
      else container._gamesUI = state.type === 'hangman' ? buildHM(container) : buildTTT(container);
    }
    if (plugin) plugin.update(container._gamesUI, state, myId, api);
    else if (state.type === 'hangman') updateHM(container._gamesUI, state, myId);
    else updateTTT(container._gamesUI, state, myId);
  }

  /* ---------- Juegos enchufables (public/js/games/<id>.js) ---------- */
  var plugins = {};
  var names = { tictactoe: 'Gato', hangman: 'Ahorcado' };
  var catalog = [
    { id: 'tictactoe', name: 'Gato', btnClass: 'btn-pink' },
    { id: 'hangman', name: 'Ahorcado', btnClass: 'btn-mint' }
  ];
  function register(p) {
    if (!p || !p.id || plugins[p.id]) return;
    plugins[p.id] = p;
    names[p.id] = p.name;
    catalog.push({ id: p.id, name: p.name, emoji: p.emoji, description: p.description, btnClass: p.btnClass || 'btn-peach', plugin: p });
  }

  function reset(container) {
    if (container) { container._gamesKey = null; container._gamesUI = null; container.innerHTML = ''; }
    current = null;
  }

  window.GamesUI = {
    render: render,
    reset: reset,
    icon: pixelSVG,
    symbolIcon: function (sym) { return pixelSVG(iconForSymbol(sym)); },
    drawYarnScene: drawYarnScene,
    names: names,
    catalog: catalog,
    register: register,
    plugin: function (id) { return plugins[id] || null; }
  };
})();
