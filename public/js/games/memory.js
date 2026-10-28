/* Amigatos — Memorama (juego enchufable `memory`)
   16 cartas boca abajo (8 parejas de razas). Volteas 2: si son pareja, sumas y sigues;
   si no, se muestran un momento a ambos y el turno pasa. */
(function () {
  'use strict';
  if (!window.GamesUI || !GamesUI.register) return;

  var C = {
    ink: '#4a2a50', cream: '#fff7ea', pink: '#ffc2d4', pink2: '#ff9fbc', pinkD: '#e9789c',
    lilac: '#d9c9ff', lilac2: '#bba4f5', lilacD: '#9a80e0', mint: '#c4f0dc', mint2: '#93dfbd', mintD: '#5fc39a',
    peach: '#ffd8b8', gold: '#ffd56e', red: '#f0708f'
  };
  var MISS_MS = 1200;
  var SHORT = { naranja: 'Naranja', british: 'British', scottish: 'Scottish', angora: 'Angora', azulruso: 'Azul ruso', mainecoon: 'Maine Coon' };

  function sameId(a, b) { return a != null && b != null && String(a) === String(b); }

  /* ---------- Estilos ---------- */
  function pawTile() {
    // patrón de huellitas para el dorso de las cartas (2 huellas por tile, pixel)
    var paw = function (x, y, c) {
      return '<g fill="' + c + '"><rect x="' + (x) + '" y="' + (y + 1) + '" width="1" height="1"/>' +
        '<rect x="' + (x + 1) + '" y="' + y + '" width="1" height="1"/><rect x="' + (x + 3) + '" y="' + y + '" width="1" height="1"/>' +
        '<rect x="' + (x + 4) + '" y="' + (y + 1) + '" width="1" height="1"/><rect x="' + (x + 1) + '" y="' + (y + 2) + '" width="3" height="2"/>' + '</g>';
    };
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" shape-rendering="crispEdges">' +
      paw(1, 1, C.pinkD) + paw(8, 8, C.lilacD) + '</svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }

  var bd = function (c, w) { w = w || 3; return '0 -' + w + 'px 0 0 ' + c + ', 0 ' + w + 'px 0 0 ' + c + ', -' + w + 'px 0 0 0 ' + c + ', ' + w + 'px 0 0 0 ' + c; };

  function injectStyle() {
    if (document.getElementById('mem-style')) return;
    var css = [
      '.mem{display:grid;justify-items:center;gap:12px;width:100%;max-width:470px;margin:0 auto;}',
      '.mem-top{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px 14px;font-size:15px;}',
      '.mem-legend{display:inline-flex;align-items:center;gap:6px;font-weight:700;}',
      '.mem-swatch{width:14px;height:18px;display:inline-block;box-shadow:' + bd(C.ink, 2) + ';clip-path:none;}',
      '.mem-swatch.me{background:' + C.mint2 + ';} .mem-swatch.opp{background:' + C.lilac2 + ';}',
      '.mem-left{font-family:var(--font-pixel,monospace);font-size:9px;background:' + C.gold + ';padding:6px 8px;box-shadow:' + bd(C.ink, 2) + ';}',
      '.mem-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;width:100%;padding:12px;background:' + C.cream + ';' +
        'background-image:repeating-linear-gradient(45deg,rgba(233,120,156,.07) 0 8px,transparent 8px 16px);box-shadow:' + bd(C.ink, 4) + ';margin:4px;}',
      '.mem-card{position:relative;display:block;width:100%;aspect-ratio:4/5;padding:0;border:0;background:transparent;cursor:default;perspective:600px;font:inherit;color:inherit;-webkit-tap-highlight-color:transparent;}',
      '.mem-card:focus-visible{outline:3px dashed ' + C.pinkD + ';outline-offset:5px;}',
      '.mem-inner{position:absolute;inset:3px;transform-style:preserve-3d;transition:transform .36s steps(6);}',
      '.mem-card.is-up .mem-inner{transform:rotateY(180deg);}',
      '.mem-side{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;display:grid;place-items:center;}',
      '.mem-back{background-color:' + C.pink + ';background-image:' + pawTile() + ';background-size:28px 28px;image-rendering:pixelated;' +
        'box-shadow:' + bd(C.ink) + ', inset 0 -4px 0 0 ' + C.pinkD + ', inset 0 4px 0 0 #ffe0ea;}',
      '.mem-back-badge{width:46%;aspect-ratio:1;display:grid;place-items:center;background:' + C.cream + ';box-shadow:' + bd(C.ink, 2) + ';}',
      '.mem-back-badge svg{width:78%;height:78%;}',
      '.mem-card.can .mem-back{cursor:pointer;}',
      '.mem-card.can{cursor:pointer;}',
      '.mem-card.can:not(.is-up):hover .mem-inner{transform:translateY(-4px);}',
      '.mem-card.can:not(.is-up):hover .mem-back{background-color:#ffd3e0;}',
      '.mem-card.can:not(.is-up):active .mem-inner{transform:translateY(0);}',
      '.mem-face{transform:rotateY(180deg);background:' + C.cream + ';box-shadow:' + bd(C.ink) + ', inset 0 -4px 0 0 ' + C.peach + ';' +
        'grid-template-rows:1fr auto;padding:4px 2px 6px;overflow:hidden;}',
      '.mem-face img{width:92%;max-width:96px;image-rendering:pixelated;align-self:end;}',
      '.mem-label{font-size:11px;font-weight:700;line-height:1.1;max-width:100%;padding:0 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.mem-card.own-me .mem-face{background:' + C.mint + ';box-shadow:' + bd(C.ink) + ', inset 0 -4px 0 0 ' + C.mint2 + ';}',
      '.mem-card.own-opp .mem-face{background:' + C.lilac + ';box-shadow:' + bd(C.ink) + ', inset 0 -4px 0 0 ' + C.lilac2 + ';}',
      // listón del dueño (marcapáginas con muesca; el contorno va en el wrapper porque clip-path recorta el filtro)
      '.mem-ribbon{display:block;width:14px;height:22px;clip-path:polygon(0 0,100% 0,100% 100%,50% 72%,0 100%);}',
      '.mem-ribbon-wrap{position:absolute;top:-3px;right:6px;display:none;filter:drop-shadow(2px 0 0 ' + C.ink + ') drop-shadow(-2px 0 0 ' + C.ink + ') drop-shadow(0 2px 0 ' + C.ink + ');}',
      '.mem-card.own-me .mem-ribbon-wrap,.mem-card.own-opp .mem-ribbon-wrap{display:block;}',
      '.mem-card.own-me .mem-ribbon{background:' + C.mintD + ';} .mem-card.own-opp .mem-ribbon{background:' + C.lilacD + ';}',
      '.mem-card.is-miss .mem-face{background:#ffd9e2;box-shadow:' + bd(C.ink) + ', inset 0 -4px 0 0 ' + C.red + ';}',
      '.mem-card.is-miss .mem-inner{animation:mem-shake .42s steps(2) 1 .3s;}',
      '@keyframes mem-shake{0%{transform:rotateY(180deg) translateX(0)}25%{transform:rotateY(180deg) translateX(-4px)}50%{transform:rotateY(180deg) translateX(4px)}75%{transform:rotateY(180deg) translateX(-3px)}100%{transform:rotateY(180deg) translateX(0)}}',
      '.mem-card.just-matched .mem-inner{animation:mem-pop .5s steps(4) 1 .3s;}',
      '@keyframes mem-pop{0%{transform:rotateY(180deg) scale(1)}40%{transform:rotateY(180deg) scale(1.14)}100%{transform:rotateY(180deg) scale(1)}}',
      '.mem-card.just-matched::after{content:"";position:absolute;inset:-6px;pointer-events:none;opacity:0;' +
        'background:radial-gradient(circle,' + C.gold + ' 0 2px,transparent 3px) 0 0/14px 14px;animation:mem-spark .8s steps(4) 1 .35s;}',
      '@keyframes mem-spark{0%{opacity:0;transform:scale(.7)}30%{opacity:1}100%{opacity:0;transform:scale(1.2)}}',
      '.mem-grid.locked .mem-card{cursor:default;}',
      '.mem-hint{min-height:22px;font-weight:700;font-size:16px;text-align:center;}',
      '.mem-hint.good{color:#2c8a63;} .mem-hint.bad{color:#b93a62;}',
      '@media (max-width:420px){.mem-grid{gap:7px;padding:8px;}.mem-label{font-size:10px;}.mem-top{font-size:13px;}}',
      '@media (prefers-reduced-motion:reduce){.mem-inner{transition:none;}.mem-card .mem-inner,.mem-card::after{animation:none!important;}}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'mem-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------- Arte de las razas ---------- */
  function breedInfo(id) {
    var list = (window.CatArt && CatArt.OPTIONS && CatArt.OPTIONS.breeds) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  var artCache = {};
  function breedArt(id) {
    if (artCache[id] != null) return artCache[id];
    var b = breedInfo(id);
    var url = '';
    try {
      if (window.CatArt && CatArt.toDataURL) {
        var cat = {};
        var preset = (b && b.preset) || {};
        for (var k in preset) cat[k] = preset[k];
        cat.breed = id; cat.name = ''; cat.accessory = 'none';
        url = CatArt.toDataURL(cat, 3) || '';
      }
    } catch (e) { url = ''; }
    artCache[id] = url;
    return url;
  }
  function breedLabel(id) {
    var b = breedInfo(id);
    return { short: SHORT[id] || (b ? b.label : id), full: b ? b.label : id };
  }

  /* ---------- Construcción ---------- */
  function build(container, api) {
    injectStyle();
    var root = document.createElement('div');
    root.className = 'mem';
    var top = document.createElement('div');
    top.className = 'mem-top';
    var grid = document.createElement('div');
    grid.className = 'mem-grid';
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', 'Memorama');
    var hint = document.createElement('div');
    hint.className = 'mem-hint';
    hint.setAttribute('aria-live', 'polite');

    var cards = [];
    for (var i = 0; i < 16; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mem-card';
      b.dataset.index = String(i);
      b.innerHTML =
        '<span class="mem-inner">' +
          '<span class="mem-side mem-back"><span class="mem-back-badge">' + api.icon('paw') + '</span></span>' +
          '<span class="mem-side mem-face"><img alt="" draggable="false"><span class="mem-label"></span>' +
            '<span class="mem-ribbon-wrap"><span class="mem-ribbon"></span></span></span>' +
        '</span>';
      grid.appendChild(b);
      cards.push({ el: b, img: b.querySelector('img'), label: b.querySelector('.mem-label'), breed: null });
    }

    var ui = {
      root: root, top: top, grid: grid, hint: hint, cards: cards, api: api,
      state: null, myId: null, prevData: null, pending: {}, pendingN: 0,
      missUntil: 0, missTimer: null, matchedNow: {}
    };

    grid.addEventListener('click', function (ev) {
      var btn = ev.target.closest('.mem-card');
      if (!btn || !ui.state) return;
      var idx = Number(btn.dataset.index);
      if (!canClick(ui, idx)) return;
      ui.pending[idx] = true;
      ui.pendingN++;
      paint(ui);
      ui.api.send({ index: idx });
    });

    root.appendChild(top);
    root.appendChild(grid);
    root.appendChild(hint);
    container.appendChild(root);
    return ui;
  }

  function missSet(d) {
    var s = {};
    if (d && d.lastMiss) d.lastMiss.forEach(function (i) { s[i] = true; });
    return s;
  }

  // ¿La carta se ve boca abajo ahora mismo (contando el fallo que ya se ocultó visualmente)?
  function visuallyHidden(ui, i) {
    var d = ui.state.data || {};
    var c = (d.cards || [])[i];
    if (!c) return true;
    if (c.owner == null && missSet(d)[i] && Date.now() >= ui.missUntil) return true;
    return false;
  }

  function canClick(ui, i) {
    var st = ui.state;
    if (!st || st.status !== 'playing' || !sameId(st.turn, ui.myId)) return false;
    if (ui.pending[i]) return false;
    var d = st.data || {};
    var c = (d.cards || [])[i];
    var miss = missSet(d);
    // cartas del fallo anterior: el server las esconde con la siguiente jugada, se pueden elegir ya
    if (c && !(c.owner == null && miss[i])) return false;
    var mine = d.lastMiss ? 0 : (d.flipped || []).length;
    return mine + ui.pendingN < 2;
  }

  /* ---------- Pintado ---------- */
  function paint(ui) {
    var st = ui.state;
    if (!st) return;
    var d = st.data || {};
    var cards = d.cards || [];
    var miss = missSet(d);
    var showMiss = Date.now() < ui.missUntil;
    var myTurn = st.status === 'playing' && sameId(st.turn, ui.myId);
    ui.grid.classList.toggle('locked', !myTurn);

    for (var i = 0; i < 16; i++) {
      var slot = ui.cards[i];
      var c = cards[i];
      if (c && c.breed && slot.breed !== c.breed) {
        slot.breed = c.breed;
        var art = breedArt(c.breed);
        if (art) slot.img.src = art; else slot.img.removeAttribute('src');
        var lb = breedLabel(c.breed);
        slot.label.textContent = lb.short;
        slot.label.title = lb.full;
      }
      var up = !!c && !(c.owner == null && miss[i] && !showMiss);
      var el = slot.el;
      el.classList.toggle('is-up', up);
      el.classList.toggle('is-miss', !!c && c.owner == null && !!miss[i] && showMiss);
      el.classList.toggle('own-me', !!c && c.owner != null && sameId(c.owner, ui.myId));
      el.classList.toggle('own-opp', !!c && c.owner != null && !sameId(c.owner, ui.myId));
      el.classList.toggle('just-matched', !!ui.matchedNow[i]);
      var can = canClick(ui, i);
      el.classList.toggle('can', can);
      el.setAttribute('aria-disabled', can ? 'false' : 'true');
      var name = c && c.breed ? breedLabel(c.breed).full : '';
      var desc = !up ? 'boca abajo' : c.owner != null ? (name + ', pareja ' + (sameId(c.owner, ui.myId) ? 'tuya' : 'del rival')) : name;
      el.setAttribute('aria-label', 'Carta ' + (i + 1) + ', ' + desc);
    }
  }

  function hintFor(ui, st) {
    var api = ui.api;
    var d = st.data || {};
    if (st.status !== 'playing') return { text: '', cls: '' };
    var myTurn = sameId(st.turn, ui.myId);
    var opp = (st.players || []).filter(function (p) { return !sameId(p.id, ui.myId); })[0];
    var oppName = opp ? api.escapeHTML(opp.username) : 'tu rival';
    var gotMatch = Object.keys(ui.matchedNow).length > 0;
    if (gotMatch) {
      return myTurn ? { text: '¡Pareja! Sigues tú ✨', cls: 'good' } : { text: '¡' + oppName + ' encontró pareja!', cls: '' };
    }
    if (d.lastMiss && Date.now() < ui.missUntil) {
      return myTurn ? { text: '¡Uy, no eran pareja! Te toca 🐾', cls: '' } : { text: '¡Uy, no eran pareja!', cls: 'bad' };
    }
    var n = d.lastMiss ? 0 : (d.flipped || []).length;
    if (myTurn) return { text: n === 1 ? 'Ahora busca su pareja…' : 'Voltea dos cartas 🃏', cls: '' };
    return { text: 'Turno de ' + oppName + '…', cls: '' };
  }

  function paintHint(ui) {
    var h = hintFor(ui, ui.state);
    if (ui.hint.innerHTML !== h.text) ui.hint.innerHTML = h.text;
    ui.hint.className = 'mem-hint' + (h.cls ? ' ' + h.cls : '');
  }

  function update(ui, state, myId, api) {
    ui.state = state;
    ui.myId = myId;
    ui.api = api || ui.api;
    ui.pending = {};
    ui.pendingN = 0;
    var d = state.data || {};
    var pd = ui.prevData;

    // parejas nuevas (para animación)
    ui.matchedNow = {};
    if (pd && pd.cards) {
      (d.cards || []).forEach(function (c, i) {
        var was = pd.cards[i];
        if (c && c.owner != null && !(was && was.owner != null)) ui.matchedNow[i] = true;
      });
    }

    // fallo nuevo: mostrarlo ~1.2s y luego ocultarlo visualmente
    if (d.lastMiss && !(pd && pd.lastMiss) && state.status === 'playing') {
      ui.missUntil = Date.now() + MISS_MS;
      clearTimeout(ui.missTimer);
      ui.missTimer = setTimeout(function () {
        if (!ui.root.isConnected) return;
        paint(ui); paintHint(ui);
      }, MISS_MS + 20);
    } else if (!d.lastMiss) {
      ui.missUntil = 0;
    }

    // cabecera: leyenda de listones + parejas restantes
    var me = null, opp = null;
    (state.players || []).forEach(function (p) { if (sameId(p.id, myId)) me = p; else opp = p; });
    var top = '<span class="mem-legend"><span class="mem-swatch me"></span>Tú</span>' +
      '<span class="mem-left">' + (state.status === 'playing' ? 'Quedan ' + (d.pairsLeft != null ? d.pairsLeft : 8) : '¡Fin!') + '</span>' +
      '<span class="mem-legend"><span class="mem-swatch opp"></span>' + ui.api.escapeHTML(opp ? opp.username : 'Rival') + '</span>';
    if (ui.topHTML !== top) { ui.top.innerHTML = top; ui.topHTML = top; }

    paint(ui);
    paintHint(ui);
    ui.prevData = d;

    // quitar la marca de "recién emparejada" tras la animación
    if (Object.keys(ui.matchedNow).length) {
      clearTimeout(ui.matchTimer);
      ui.matchTimer = setTimeout(function () {
        ui.matchedNow = {};
        if (ui.root.isConnected) { paint(ui); }
      }, 1300);
    }
  }

  /* ---------- Plugin ---------- */
  function countOwned(d) {
    var by = {};
    ((d && d.cards) || []).forEach(function (c) { if (c && c.owner != null) by[String(c.owner)] = (by[String(c.owner)] || 0) + 1; });
    return by;
  }

  GamesUI.register({
    id: 'memory',
    name: 'Memorama',
    emoji: '🃏',
    description: 'Voltea cartas y encuentra las parejas de gatitos: ¡quien recuerde más michis gana!',
    btnClass: 'btn-peach',
    build: build,
    update: update,
    scoreHTML: function (player, state) {
      var n = (state.data && state.data.scores && state.data.scores[String(player.id)]) || 0;
      return '<span>🃏 ' + n + (n === 1 ? ' pareja' : ' parejas') + '</span>';
    },
    react: function (prev, state, ctx) {
      if (!prev || !state || prev.type !== 'memory') return;
      var pd = prev.data || {}, d = state.data || {};
      var before = countOwned(pd), after = countOwned(d);
      var scorer = null;
      Object.keys(after).forEach(function (k) { if ((after[k] || 0) > (before[k] || 0)) scorer = k; });
      if (scorer != null) {
        var p = (state.players || []).filter(function (pl) { return sameId(pl.id, scorer); })[0];
        ctx.happy(p ? p.id : scorer);
        ctx.sound('hit');
        return;
      }
      if (d.lastMiss && !pd.lastMiss) {
        if (prev.turn != null) ctx.sad(prev.turn);
        ctx.sound('miss');
        return;
      }
      var nf = d.flipped || [], pf = pd.flipped || [];
      if (nf.length === 1 && (pd.lastMiss || pf.length !== 1 || pf[0] !== nf[0])) ctx.sound('move');
    },
    overText: function (state, o) {
      var sc = (state.data && state.data.scores) || {};
      var mine = sc[String(o.myId)] || 0;
      var theirs = 0;
      (state.players || []).forEach(function (p) { if (!sameId(p.id, o.myId)) theirs = sc[String(p.id)] || 0; });
      var pz = function (n) { return n + (n === 1 ? ' pareja' : ' parejas'); };
      if (o.draw) return '¡Empate! ' + pz(mine) + ' cada quien. ¡Qué memoria tan gatuna! 🐾';
      if (o.won) return '¡Encontraste ' + pz(mine) + ' contra ' + theirs + '! Memoria de michi campeón 🏆';
      return (o.oppName || 'Tu rival') + ' encontró ' + pz(theirs) + ' y tú ' + mine + '. ¡A la próxima! 🐾';
    }
  });
})();
