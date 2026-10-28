/* Amigatos — lógica principal del cliente */
(function () {
  'use strict';

  /* ---------- Utilidades ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var GAME_NAMES = { tictactoe: 'Gato', hangman: 'Ahorcado' };
  var TOKEN_KEY = 'amigatos_token';
  var MUTE_KEY = 'amigatos_muted';
  var BASE_TITLE = 'Amigatos';

  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* noop */ } },
    del: function (k) { try { window.localStorage.removeItem(k); } catch (e) { /* noop */ } }
  };

  function sameId(a, b) { return a != null && b != null && String(a) === String(b); }
  function hasCatArt(fn) { return !!(window.CatArt && typeof window.CatArt[fn] === 'function'); }

  var S = {
    token: null,
    user: null,
    socket: null,
    presence: [],
    game: null,
    leftGames: {},
    invites: [],
    currentInvite: null,
    screen: null,
    creator: null,
    meCat: null,
    heroCats: [],
    fighters: { left: null, right: null },
    inviteCat: null,
    overCat: null,
    overShownFor: null,
    rematchMine: false,
    rematchTheirs: false,
    wasDisconnected: false,
    authMode: 'login',
    inviteCooldown: {}
  };

  /* ---------- Sonidos (WebAudio, sin archivos) ---------- */
  var Sound = {
    ctx: null,
    muted: store.get(MUTE_KEY) === '1',
    ensure: function () {
      if (this.muted) return null;
      try {
        if (!this.ctx) {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return null;
          this.ctx = new AC();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
      } catch (e) { return null; }
    },
    blip: function (freq, dur, when, type, vol) {
      var ctx = this.ensure();
      if (!ctx) return;
      try {
        var t = ctx.currentTime + (when || 0);
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = type || 'square';
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(vol || 0.05, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + dur + 0.03);
      } catch (e) { /* noop */ }
    },
    play: function (name) {
      var b = this.blip.bind(this);
      switch (name) {
        case 'move': b(620, 0.07); b(820, 0.06, 0.05); break;
        case 'hit': b(660, 0.07); b(990, 0.1, 0.07); break;
        case 'miss': b(330, 0.1, 0, 'triangle', 0.08); b(220, 0.16, 0.09, 'triangle', 0.08); break;
        case 'win': [523, 659, 784, 1047].forEach(function (f, i) { b(f, 0.14, i * 0.11); }); break;
        case 'lose': [392, 330, 262].forEach(function (f, i) { b(f, 0.2, i * 0.16, 'triangle', 0.08); }); break;
        case 'draw': b(523, 0.12); b(523, 0.12, 0.16); break;
        case 'invite': b(880, 0.1); b(1175, 0.14, 0.12); b(880, 0.1, 0.3); b(1175, 0.14, 0.42); break;
        case 'msg': b(1046, 0.05, 0, 'sine', 0.06); break;
        case 'click': b(740, 0.03, 0, 'square', 0.03); break;
        case 'turn': b(784, 0.08, 0, 'sine', 0.07); b(1046, 0.1, 0.08, 'sine', 0.07); break;
      }
    }
  };

  /* ---------- Gatos (con respaldo si cat-art.js no está) ---------- */
  var FALLBACK_CAT = {
    name: 'Michi', fur: '#f4a261', pattern: 'tabby', patternColor: '#8d5524',
    eyes: '#2a9d8f', accessory: 'bow', accessoryColor: '#e63946'
  };
  var noopCtl = { setCat: function () {}, play: function () {}, destroy: function () {} };

  function mountCat(canvas, cat, opts) {
    if (!canvas) return noopCtl;
    if (cat && hasCatArt('mount')) {
      try { return window.CatArt.mount(canvas, cat, opts || {}) || noopCtl; } catch (e) { console.warn('CatArt.mount falló', e); }
    }
    try {
      var s = (opts && opts.scale) || 4;
      canvas.width = 32 * s; canvas.height = 32 * s;
      var c = canvas.getContext('2d');
      c.clearRect(0, 0, canvas.width, canvas.height);
      c.font = (22 * s) + 'px serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('🐱', 16 * s, 17 * s);
      if (opts && opts.flip) canvas.style.transform = 'scaleX(-1)';
    } catch (e) { /* noop */ }
    return noopCtl;
  }
  function destroyCtl(ctl) { try { if (ctl && ctl.destroy) ctl.destroy(); } catch (e) { /* noop */ } }
  function playCtl(ctl, anim) { try { if (ctl && ctl.play) ctl.play(anim); } catch (e) { /* noop */ } }

  var avatarCache = {};
  function avatarEl(cat, scale) {
    if (cat && hasCatArt('toDataURL')) {
      var key = JSON.stringify(cat) + '|' + (scale || 2);
      try {
        var url = avatarCache[key] || (avatarCache[key] = window.CatArt.toDataURL(cat, scale || 2));
        var img = new Image();
        img.src = url;
        img.alt = cat.name ? 'Gato ' + cat.name : 'Gato';
        img.className = 'pixel-canvas';
        return img;
      } catch (e) { /* cae al respaldo */ }
    }
    var span = document.createElement('span');
    span.className = 'avatar-fallback';
    span.textContent = '🐱';
    return span;
  }

  function randomCat() {
    if (hasCatArt('randomCat')) { try { return window.CatArt.randomCat(); } catch (e) { /* noop */ } }
    if (hasCatArt('defaultCat')) { try { return window.CatArt.defaultCat(); } catch (e) { /* noop */ } }
    return Object.assign({}, FALLBACK_CAT);
  }

  /* ---------- Toasts / confirmación / título ---------- */
  function toast(msg, kind, ms) {
    var box = $('#toasts');
    var t = document.createElement('div');
    t.className = 'toast toast-' + (kind || 'info');
    t.textContent = msg;
    box.appendChild(t);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(function () {
      t.classList.add('out');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, ms || 3200);
  }

  function confirmPixel(text, yesLabel, noLabel) {
    return new Promise(function (resolve) {
      var m = $('#confirm-modal');
      $('#confirm-text').textContent = text;
      $('#confirm-yes').textContent = yesLabel || 'Sí';
      $('#confirm-no').textContent = noLabel || 'Cancelar';
      m.classList.remove('hidden');
      $('#confirm-no').focus();
      function done(v) {
        m.classList.add('hidden');
        $('#confirm-yes').removeEventListener('click', yes);
        $('#confirm-no').removeEventListener('click', no);
        document.removeEventListener('keydown', esc);
        resolve(v);
      }
      function yes() { done(true); }
      function no() { done(false); }
      function esc(e) { if (e.key === 'Escape') done(false); }
      $('#confirm-yes').addEventListener('click', yes);
      $('#confirm-no').addEventListener('click', no);
      document.addEventListener('keydown', esc);
    });
  }

  var titleTimer = null;
  function notifyTitle(msg) {
    if (!document.hidden) return;
    stopTitle();
    var on = false;
    titleTimer = setInterval(function () {
      on = !on;
      document.title = on ? msg : BASE_TITLE;
    }, 1000);
    document.title = msg;
  }
  function stopTitle() {
    if (titleTimer) clearInterval(titleTimer);
    titleTimer = null;
    document.title = BASE_TITLE;
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) stopTitle(); });
  window.addEventListener('focus', stopTitle);

  /* ---------- REST ---------- */
  function api(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    if (S.token) headers.Authorization = 'Bearer ' + S.token;
    return fetch(path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    }).catch(function () {
      var err = new Error('No se pudo conectar con el servidor. ¿Hay internet?');
      err.network = true;
      throw err;
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error) || 'Algo salió mal (' + res.status + ')');
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  /* ---------- Pantallas ---------- */
  function showScreen(name) {
    if (S.screen === name) return;
    // limpieza de la pantalla anterior
    if (S.screen === 'creator' && S.creator) { try { S.creator.destroy(); } catch (e) { /* noop */ } S.creator = null; }
    if (S.screen === 'lobby') { destroyCtl(S.meCat); S.meCat = null; }
    if (S.screen === 'auth') { S.heroCats.forEach(destroyCtl); S.heroCats = []; }
    if (S.screen === 'game') { destroyCtl(S.fighters.left); destroyCtl(S.fighters.right); S.fighters = { left: null, right: null }; }

    S.screen = name;
    $$('.screen').forEach(function (sec) { sec.classList.toggle('hidden', sec.dataset.screen !== name); });
    window.scrollTo(0, 0);
    updateUserChip();
  }

  function updateUserChip() {
    var chip = $('#user-chip');
    if (!S.user || S.screen === 'auth') { chip.classList.add('hidden'); return; }
    chip.classList.remove('hidden');
    $('#user-chip-name').textContent = S.user.username;
    var av = $('#user-chip-avatar');
    av.innerHTML = '';
    av.appendChild(avatarEl(S.user.cat, 1));
  }

  /* ---------- Marca ---------- */
  function initBrand() {
    var title = $('#brand-title');
    var txt = title.textContent;
    title.textContent = '';
    txt.split('').forEach(function (ch, i) {
      var sp = document.createElement('span');
      sp.textContent = ch;
      sp.style.animationDelay = (i * 0.12) + 's';
      title.appendChild(sp);
    });
    var icon = $('#brand-icon');
    icon.innerHTML = window.GamesUI ? window.GamesUI.icon('cat') : '🐱';

    // iconos de las tarjetas de juego
    var ttt = $('#icon-ttt'), hm = $('#icon-hm');
    if (window.GamesUI) {
      ttt.innerHTML = '<div class="duo">' + GamesUI.icon('paw') + GamesUI.icon('fish') + GamesUI.icon('fish') + GamesUI.icon('paw') + '</div>';
      hm.innerHTML = GamesUI.icon('yarn');
    } else { ttt.textContent = '🐾'; hm.textContent = '🧶'; }
    // si cat-art trae decoraciones, úsalas para el ahorcado
    var dec = window.CatArt && (window.CatArt.decor || window.CatArt);
    if (dec && typeof dec.drawYarn === 'function') {
      try {
        var cv = document.createElement('canvas');
        cv.className = 'pixel-canvas';
        dec.drawYarn(cv);
        if (cv.width > 0) { hm.innerHTML = ''; hm.appendChild(cv); }
      } catch (e) { /* noop */ }
    }
  }

  /* ---------- Auth ---------- */
  function setAuthMode(mode) {
    S.authMode = mode;
    $$('.tab').forEach(function (t) {
      var on = t.dataset.tab === mode;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $('#auth-submit').textContent = mode === 'login' ? 'Entrar' : 'Crear cuenta';
    $('#auth-hint').textContent = mode === 'login'
      ? '¡Hola de nuevo! Entra para ver a tus amigatos.'
      : 'Usuario de 3 a 20 letras, números o _ · contraseña de 4+ caracteres.';
    $('#auth-password').setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
    hideError('#auth-error');
  }

  function showError(sel, msg) {
    var e = $(sel);
    e.textContent = msg;
    e.classList.remove('hidden');
    // reiniciar animación
    e.style.animation = 'none'; void e.offsetWidth; e.style.animation = '';
  }
  function hideError(sel) { $(sel).classList.add('hidden'); }

  function showAuth() {
    showScreen('auth');
    var a = $('#hero-cat-a'), b = $('#hero-cat-b');
    S.heroCats = [
      mountCat(a, randomCat(), { scale: 4, anim: 'idle' }),
      mountCat(b, randomCat(), { scale: 4, anim: 'idle', flip: true })
    ];
    setTimeout(function () { $('#auth-username').focus(); }, 50);
  }

  function onAuthSubmit(ev) {
    ev.preventDefault();
    var username = $('#auth-username').value.trim();
    var password = $('#auth-password').value;
    if (!username || !password) return showError('#auth-error', 'Escribe tu usuario y contraseña.');
    if (S.authMode === 'register') {
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return showError('#auth-error', 'El usuario debe tener de 3 a 20 caracteres: letras, números o _.');
      if (password.length < 4) return showError('#auth-error', 'La contraseña debe tener al menos 4 caracteres.');
    }
    hideError('#auth-error');
    var btn = $('#auth-submit');
    btn.disabled = true;
    var old = btn.textContent;
    btn.textContent = '…';
    api('POST', S.authMode === 'login' ? '/api/login' : '/api/register', { username: username, password: password })
      .then(function (data) {
        S.token = data.token;
        store.set(TOKEN_KEY, data.token);
        $('#auth-password').value = '';
        Sound.play('hit');
        onLoggedIn(data.user);
      })
      .catch(function (err) { showError('#auth-error', err.message); })
      .then(function () { btn.disabled = false; btn.textContent = old; });
  }

  function onLoggedIn(user) {
    S.user = user;
    connectSocket();
    if (!user.cat) openCreator(true);
    else enterLobby();
  }

  function logout(msg) {
    if (S.socket) { try { S.socket.removeAllListeners(); S.socket.disconnect(); } catch (e) { /* noop */ } }
    S.socket = null;
    S.token = null;
    S.user = null;
    S.game = null;
    S.presence = [];
    S.invites = [];
    S.currentInvite = null;
    store.del(TOKEN_KEY);
    closeInviteModal();
    hideOver();
    $('#conn-banner').classList.add('hidden');
    showAuth();
    if (msg) toast(msg, 'info');
  }

  /* ---------- Creador ---------- */
  function openCreator(first) {
    showScreen('creator');
    $('#creator-title').textContent = first ? '¡Diseña tu gato!' : 'Editar mi gato';
    $('#creator-sub').textContent = first
      ? 'Antes de jugar, crea a tu compañero gatuno. ¡Ponle un nombre bonito!'
      : 'Cambia lo que quieras. Tus amigos verán a tu gato renovado.';
    $('#creator-cancel').classList.toggle('hidden', !!first || !S.user.cat);
    hideError('#creator-error');
    var host = $('#creator-host');
    host.innerHTML = '';
    var initial = S.user.cat ? Object.assign({}, S.user.cat) : randomCat();
    if (window.CatCreator && typeof window.CatCreator.mount === 'function') {
      try {
        S.creator = window.CatCreator.mount(host, initial, function () { hideError('#creator-error'); });
        return;
      } catch (e) { console.warn('CatCreator.mount falló', e); host.innerHTML = ''; }
    }
    S.creator = fallbackCreator(host, initial);
  }

  // Creador mínimo por si cat-creator.js no está disponible
  function fallbackCreator(host, initial) {
    var cat = Object.assign({}, FALLBACK_CAT, initial || {});
    var box = document.createElement('div');
    box.className = 'fallback-creator';
    box.innerHTML =
      '<canvas class="pixel-canvas"></canvas>' +
      '<label class="field" style="width:100%;max-width:320px"><span class="field-label">Nombre</span>' +
      '<input class="input" maxlength="16" type="text"></label>' +
      '<label class="field" style="width:100%;max-width:320px"><span class="field-label">Color del pelaje</span>' +
      '<input class="input" type="color" style="height:48px;padding:4px"></label>';
    host.appendChild(box);
    var cv = box.querySelector('canvas');
    var ctl = mountCat(cv, cat, { scale: 5, anim: 'idle' });
    var name = box.querySelector('input[type=text]');
    var fur = box.querySelector('input[type=color]');
    name.value = cat.name || '';
    fur.value = /^#[0-9a-f]{6}$/i.test(cat.fur) ? cat.fur : '#f4a261';
    function upd() { cat.name = name.value; cat.fur = fur.value; try { ctl.setCat(Object.assign({}, cat)); } catch (e) { /* noop */ } }
    name.addEventListener('input', upd);
    fur.addEventListener('input', upd);
    return {
      getCat: function () { return Object.assign({}, cat); },
      destroy: function () { destroyCtl(ctl); }
    };
  }

  function saveCat() {
    if (!S.creator) return;
    var cat;
    try { cat = S.creator.getCat(); } catch (e) { cat = null; }
    if (!cat) return showError('#creator-error', 'No pude leer tu gato. Intenta de nuevo.');
    cat = Object.assign({}, cat, { name: String(cat.name || '').trim() });
    if (!cat.name) return showError('#creator-error', '¡Tu gato necesita un nombre!');
    if (cat.name.length > 16) return showError('#creator-error', 'El nombre puede tener máximo 16 caracteres.');
    var btn = $('#creator-save');
    btn.disabled = true;
    api('PUT', '/api/cat', { cat: cat })
      .then(function (data) {
        var first = !S.user.cat;
        S.user = data.user;
        avatarCache = {};
        Sound.play('win');
        toast(first ? '¡Bienvenido, ' + S.user.cat.name + '! 🐾' : '¡Gato guardado!', 'ok');
        enterLobby();
      })
      .catch(function (err) {
        if (err.status === 401) return logout('Tu sesión expiró. Vuelve a entrar.');
        showError('#creator-error', err.message);
      })
      .then(function () { btn.disabled = false; });
  }

  /* ---------- Sala ---------- */
  function enterLobby() {
    S.game = null;
    hideOver();
    if (window.GamesUI && GamesUI.reset) GamesUI.reset($('#game-board'));
    showScreen('lobby');
    renderMe();
    renderPresence();
    loadLeaderboard();
    showNextInvite();
  }

  function breedInfo(cat) {
    try {
      var list = (window.CatArt && CatArt.OPTIONS.breeds) || [];
      return list.filter(function (b) { return cat && b.id === cat.breed; })[0] || null;
    } catch (e) { return null; }
  }

  function renderMe() {
    if (!S.user) return;
    var cat = S.user.cat || FALLBACK_CAT;
    if (S.screen === 'lobby') {
      if (S.meCat) { try { S.meCat.setCat(cat); } catch (e) { /* noop */ } }
      else S.meCat = mountCat($('#me-cat'), cat, { scale: 6, anim: 'idle' });
    }
    $('#me-catname').textContent = cat.name || 'Michi';
    $('#me-username').textContent = '@' + S.user.username;
    var breed = breedInfo(cat);
    $('#me-story').hidden = !(breed && breed.story);
    if (breed && breed.story) {
      $('#me-story-title').textContent = '📜 ' + breed.label;
      $('#me-story-text').textContent = breed.story;
    }
    setStat('#stat-wins', S.user.wins);
    setStat('#stat-losses', S.user.losses);
    setStat('#stat-draws', S.user.draws);
    updateUserChip();
  }
  function setStat(sel, v) {
    var e = $(sel);
    var nv = String(v || 0);
    if (e.textContent !== nv) {
      e.textContent = nv;
      e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump');
    }
  }

  function renderPresence() {
    var list = $('#player-list');
    if (!list || !S.user) return;
    list.innerHTML = '';
    var others = S.presence.filter(function (p) { return !sameId(p.id, S.user.id); });
    // me primero
    var me = S.presence.find(function (p) { return sameId(p.id, S.user.id); });
    if (me) list.appendChild(playerItem(Object.assign({}, me, { cat: S.user.cat || me.cat }), true));
    others.forEach(function (p) { list.appendChild(playerItem(p, false)); });
    $('#player-empty').classList.toggle('hidden', others.length > 0);
  }

  function playerItem(p, isMe) {
    var li = document.createElement('li');
    li.className = 'player' + (isMe ? ' is-me' : '');
    var av = document.createElement('div');
    av.className = 'player-avatar';
    av.appendChild(avatarEl(p.cat, 2));
    var info = document.createElement('div');
    info.style.minWidth = '0';
    var nm = document.createElement('div');
    nm.className = 'player-name';
    nm.textContent = p.username + (isMe ? ' (tú)' : '');
    var cn = document.createElement('span');
    cn.className = 'player-cat';
    var pb = breedInfo(p.cat);
    cn.textContent = p.cat && p.cat.name ? '🐾 ' + p.cat.name + (pb ? ' · ' + pb.label : '') : 'Sin gato todavía';
    if (pb && pb.story) cn.title = pb.story;
    info.appendChild(nm); info.appendChild(cn);
    var badge = document.createElement('span');
    var playing = p.status === 'playing';
    badge.className = 'badge ' + (isMe ? 'badge-me' : playing ? 'badge-playing' : 'badge-idle');
    badge.textContent = isMe ? 'Tú' : playing ? 'Jugando' : 'Disponible';
    li.appendChild(av); li.appendChild(info); li.appendChild(badge);

    if (!isMe) {
      var actions = document.createElement('div');
      actions.className = 'player-actions';
      [['tictactoe', 'Jugar Gato', 'btn-pink'], ['hangman', 'Jugar Ahorcado', 'btn-mint']].forEach(function (g) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-sm ' + g[2];
        b.textContent = g[1];
        var cool = S.inviteCooldown[p.id] && S.inviteCooldown[p.id] > Date.now();
        b.disabled = playing || !p.cat || cool || (S.game && S.game.status === 'playing');
        if (playing) b.title = 'Está jugando ahora';
        b.addEventListener('click', function () { sendInvite(p, g[0]); });
        actions.appendChild(b);
      });
      li.appendChild(actions);
    }
    return li;
  }

  function sendInvite(p, game) {
    if (!S.socket || !S.socket.connected) return toast('Sin conexión. Espera un momento…', 'error');
    S.socket.emit('invite:send', { toUserId: p.id, game: game });
    Sound.play('click');
    toast('Invitación de ' + GAME_NAMES[game] + ' enviada a ' + p.username + ' 💌', 'ok');
    S.inviteCooldown[p.id] = Date.now() + 4000;
    renderPresence();
    setTimeout(function () { renderPresence(); }, 4100);
  }

  function loadLeaderboard() {
    var ol = $('#leaderboard');
    api('GET', '/api/leaderboard').then(function (data) {
      var players = (data && data.players) || [];
      ol.innerHTML = '';
      if (!players.length) {
        ol.innerHTML = '<li class="empty">Aún no hay partidas. ¡Sé el primero!</li>';
        return;
      }
      players.slice(0, 10).forEach(function (p, i) {
        var li = document.createElement('li');
        li.className = 'lb-row' + (S.user && p.username === S.user.username ? ' is-me' : '');
        var rank = document.createElement('span');
        rank.className = 'lb-rank';
        rank.textContent = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);
        var av = document.createElement('span');
        av.className = 'lb-avatar';
        av.appendChild(avatarEl(p.cat, 1));
        var nm = document.createElement('span');
        nm.className = 'lb-name';
        nm.textContent = p.username;
        var small = document.createElement('small');
        small.textContent = p.cat && p.cat.name ? p.cat.name : '—';
        nm.appendChild(small);
        var sc = document.createElement('span');
        sc.className = 'lb-score';
        sc.innerHTML = '<span class="w">' + (p.wins || 0) + 'V</span> <span class="l">' + (p.losses || 0) +
          'D</span><br><span class="d">' + (p.draws || 0) + 'E</span>';
        sc.title = (p.wins || 0) + ' victorias, ' + (p.losses || 0) + ' derrotas, ' + (p.draws || 0) + ' empates';
        li.appendChild(rank); li.appendChild(av); li.appendChild(nm); li.appendChild(sc);
        ol.appendChild(li);
      });
    }).catch(function () {
      ol.innerHTML = '<li class="empty">No se pudo cargar el ranking.</li>';
    });
  }

  /* ---------- Invitaciones ---------- */
  function onInviteReceived(inv) {
    if (!inv || !inv.from) return;
    if (S.game && S.game.status === 'playing') {
      // ocupado: rechazar con cariño
      if (S.socket) S.socket.emit('invite:respond', { inviteId: inv.inviteId, accept: false });
      toast(inv.from.username + ' te invitó a jugar, pero estás en una partida.', 'info');
      return;
    }
    S.invites.push(inv);
    Sound.play('invite');
    notifyTitle('💌 ¡' + inv.from.username + ' te invita!');
    showNextInvite();
  }

  function showNextInvite() {
    if (S.currentInvite || !S.invites.length) return;
    if (S.screen !== 'lobby' && S.screen !== 'game') return;
    if (S.game && S.game.status === 'playing') return;
    var inv = S.invites.shift();
    S.currentInvite = inv;
    $('#invite-title').textContent = '¡Invitación!';
    var txt = $('#invite-text');
    txt.innerHTML = '';
    var b = document.createElement('b'); b.textContent = inv.from.username;
    var g = document.createElement('b'); g.textContent = GAME_NAMES[inv.game] || inv.game;
    txt.appendChild(b);
    txt.appendChild(document.createTextNode(inv.from.cat && inv.from.cat.name ? ' y ' + inv.from.cat.name + ' te invitan a jugar ' : ' te invita a jugar '));
    txt.appendChild(g);
    txt.appendChild(document.createTextNode(' 🐾'));
    destroyCtl(S.inviteCat);
    S.inviteCat = mountCat($('#invite-cat'), inv.from.cat || FALLBACK_CAT, { scale: 4, anim: 'happy' });
    $('#invite-modal').classList.remove('hidden');
    $('#invite-accept').focus();
  }

  function respondInvite(accept) {
    var inv = S.currentInvite;
    if (!inv) return;
    if (S.socket) S.socket.emit('invite:respond', { inviteId: inv.inviteId, accept: accept });
    Sound.play(accept ? 'hit' : 'click');
    closeInviteModal();
    stopTitle();
    if (!accept) setTimeout(showNextInvite, 300);
  }

  function closeInviteModal() {
    $('#invite-modal').classList.add('hidden');
    destroyCtl(S.inviteCat);
    S.inviteCat = null;
    S.currentInvite = null;
  }

  /* ---------- Partida ---------- */
  function myId() { return S.user && S.user.id; }
  function opponentOf(state) {
    return (state.players || []).find(function (p) { return !sameId(p.id, myId()); }) || null;
  }
  function meIn(state) {
    return (state.players || []).find(function (p) { return sameId(p.id, myId()); }) || null;
  }

  function sendMove(move) {
    if (!S.socket || !S.game) return;
    S.socket.emit('game:move', { gameId: S.game.id, move: move });
  }

  function onGameState(state) {
    if (!state || !state.id) return;
    if (S.leftGames[state.id]) return;
    S.lastStateAt = Date.now();
    var prev = S.game && S.game.id === state.id ? S.game : null;
    S.game = state;
    if (!prev) startGame(state);
    else updateGame(prev, state);
  }

  function startGame(state) {
    // nueva partida (o revancha)
    var isRematch = S.screen === 'game';
    hideOver();
    closeInviteModal();
    S.invites = [];
    S.rematchMine = false;
    S.rematchTheirs = false;
    if (window.GamesUI && GamesUI.reset) GamesUI.reset($('#game-board'));
    showScreen('game');
    if (!isRematch) $('#chat-log').innerHTML = '';
    var me = meIn(state) || { username: S.user.username, cat: S.user.cat };
    var opp = opponentOf(state) || { username: '???', cat: null };

    // gatos enfrentados: yo a la izquierda, rival a la derecha mirando hacia mí
    destroyCtl(S.fighters.left); destroyCtl(S.fighters.right);
    var L = $('#fighter-left'), R = $('#fighter-right');
    replaceCanvas(L); replaceCanvas(R);
    S.fighters.left = mountCat($('canvas', L), me.cat || S.user.cat || FALLBACK_CAT, { scale: 3, anim: 'idle' });
    S.fighters.right = mountCat($('canvas', R), opp.cat || FALLBACK_CAT, { scale: 3, anim: 'idle', flip: true });
    $('.fighter-name', L).textContent = 'Tú';
    $('.fighter-name', R).textContent = opp.username;
    $('#game-label').textContent = GAME_NAMES[state.type] || 'Juego';

    sysMsg((isRematch ? '¡Revancha! ' : '') + 'Empieza una partida de ' + (GAME_NAMES[state.type] || 'juego') + ' contra ' + opp.username + '.');
    renderGame(state);
    Sound.play('turn');
    if (sameId(state.turn, myId())) notifyTitle('🐾 ¡Tu turno!');
  }

  function replaceCanvas(fighterEl) {
    var wrap = $('.fighter-cat', fighterEl);
    wrap.innerHTML = '<canvas class="pixel-canvas"></canvas>';
  }

  function renderGame(state) {
    var board = $('#game-board');
    if (window.GamesUI && typeof GamesUI.render === 'function') {
      try { GamesUI.render(board, state, S.user, sendMove); }
      catch (e) { console.error(e); board.textContent = 'Error al dibujar el juego 😿'; }
    }
    renderVsBar(state);
  }

  function renderVsBar(state) {
    var me = meIn(state), opp = opponentOf(state);
    var L = $('#fighter-left'), R = $('#fighter-right');
    var playing = state.status === 'playing';
    L.classList.toggle('active', playing && me && sameId(state.turn, me.id));
    R.classList.toggle('active', playing && opp && sameId(state.turn, opp.id));

    function scoreHTML(p) {
      if (!p) return '';
      if (state.type === 'tictactoe') {
        var sym = state.data && state.data.symbols && state.data.symbols[String(p.id)];
        return (window.GamesUI ? GamesUI.symbolIcon(sym) : '') + '<span>' + (sym === 'O' ? 'Pez' : 'Huella') + '</span>';
      }
      var n = (state.data && state.data.scores && state.data.scores[String(p.id)]) || 0;
      return '<span>⭐ ' + n + ' pts</span>';
    }
    $('.fighter-score', L).innerHTML = scoreHTML(me);
    $('.fighter-score', R).innerHTML = scoreHTML(opp);

    var pill = $('#turn-pill');
    pill.classList.remove('mine', 'over');
    if (!playing) {
      pill.textContent = '¡Fin!';
      pill.classList.add('over');
    } else if (sameId(state.turn, myId())) {
      pill.textContent = '¡Tu turno!';
      pill.classList.add('mine');
    } else {
      pill.textContent = 'Turno de ' + (opp ? opp.username : 'tu rival');
    }
  }

  function ctlFor(userId) {
    return sameId(userId, myId()) ? S.fighters.left : S.fighters.right;
  }

  function updateGame(prev, state) {
    renderGame(state);
    // reacciones de los gatos + sonidos
    if (state.type === 'tictactoe') {
      var pb = (prev.data && prev.data.board) || [], nb = (state.data && state.data.board) || [];
      for (var i = 0; i < 9; i++) {
        if (pb[i] == null && nb[i] != null) {
          if (sameId(nb[i], myId())) playCtl(S.fighters.left, 'happy');
          Sound.play('move');
          break;
        }
      }
    } else if (state.type === 'hangman') {
      var ps = (prev.data && prev.data.scores) || {}, ns = (state.data && state.data.scores) || {};
      var scorer = null;
      Object.keys(ns).forEach(function (k) { if ((ns[k] || 0) > (ps[k] || 0)) scorer = k; });
      var pw = (prev.data && prev.data.wrong) || 0, nw = (state.data && state.data.wrong) || 0;
      if (scorer != null) {
        playCtl(ctlFor(scorer), 'happy');
        Sound.play('hit');
      } else if (nw > pw) {
        playCtl(ctlFor(prev.turn), 'sad');
        Sound.play('miss');
      }
    }
    if (state.status === 'playing' && !sameId(prev.turn, state.turn) && sameId(state.turn, myId())) {
      setTimeout(function () { Sound.play('turn'); }, 250);
      notifyTitle('🐾 ¡Tu turno!');
    }
  }

  function onGameOver(payload) {
    var state = payload && payload.state;
    if (!state || S.leftGames[state.id]) return;
    var prev = S.game && S.game.id === state.id ? S.game : null;
    S.game = state;
    if (!prev && S.screen !== 'game') startGame(state);
    else renderGame(state);

    var me = myId();
    var won = sameId(state.winnerId, me);
    var draw = state.winnerId == null;
    if (draw) { playCtl(S.fighters.left, 'idle'); playCtl(S.fighters.right, 'idle'); }
    else {
      playCtl(S.fighters.left, won ? 'happy' : 'sad');
      playCtl(S.fighters.right, won ? 'sad' : 'happy');
    }
    setTimeout(function () {
      if (!S.game || S.game.id !== state.id || S.screen !== 'game') return;
      showOver(state);
    }, 900);
    setTimeout(loadLeaderboard, 800);
  }

  function showOver(state) {
    var me = myId();
    var opp = opponentOf(state);
    var oppName = opp ? opp.username : 'Tu rival';
    var won = sameId(state.winnerId, me);
    var draw = state.winnerId == null;
    var title = $('#over-title'), sub = $('#over-sub');
    title.classList.remove('win', 'lose', 'draw');
    if (draw) { title.textContent = '¡Empate!'; title.classList.add('draw'); }
    else if (won) { title.textContent = '¡Ganaste!'; title.classList.add('win'); }
    else { title.textContent = 'Perdiste'; title.classList.add('lose'); }

    var reasons = {
      win: won ? '¡Tres en línea! Qué gatito tan listo.' : oppName + ' hizo tres en línea.',
      draw: 'El tablero se llenó. ¡Nadie gana esta vez!',
      abandon: won ? oppName + ' abandonó la partida. ¡Ganas por abandono!' : 'Abandonaste la partida.',
      word: won ? '¡Completaste la palabra con más puntos!' : (draw ? 'Palabra completada… ¡con los mismos puntos!' : oppName + ' terminó con más puntos.'),
      hanged: 'El ovillo se deshizo por completo 🧶. ' + (draw ? 'Empatados en puntos.' : (won ? '¡Pero tenías más puntos!' : oppName + ' tenía más puntos.'))
    };
    var subText = reasons[state.reason] || (won ? '¡Bien jugado!' : draw ? 'Buena partida.' : '¡La próxima será!');
    if (state.type === 'hangman' && state.data && state.data.scores) {
      var mine = state.data.scores[String(me)] || 0;
      var theirs = opp ? (state.data.scores[String(opp.id)] || 0) : 0;
      subText += ' (' + mine + ' – ' + theirs + ')';
    }
    sub.textContent = subText;

    var wordEl = $('#over-word');
    if (state.type === 'hangman' && state.data && state.data.word) {
      wordEl.textContent = 'La palabra era: ' + state.data.word;
      wordEl.classList.remove('hidden');
    } else wordEl.classList.add('hidden');

    destroyCtl(S.overCat);
    var myCat = (meIn(state) && meIn(state).cat) || S.user.cat || FALLBACK_CAT;
    S.overCat = mountCat($('#over-cat'), myCat, { scale: 4, anim: won ? 'happy' : (draw ? 'idle' : 'sad') });
    // repetir la animación de vez en cuando
    if (won || !draw) {
      var anim = won ? 'happy' : 'sad';
      S.overAnimTimer = setInterval(function () { playCtl(S.overCat, anim); }, 1800);
    }

    S.overShownFor = state.id;
    updateRematchUI();
    $('#over-modal').classList.remove('hidden');
    if (won) { confetti(); Sound.play('win'); }
    else if (draw) Sound.play('draw');
    else Sound.play('lose');
    notifyTitle(won ? '🏆 ¡Ganaste!' : draw ? '🤝 ¡Empate!' : '😿 Fin de la partida');
  }

  function hideOver() {
    $('#over-modal').classList.add('hidden');
    $('#over-confetti').innerHTML = '';
    if (S.overAnimTimer) clearInterval(S.overAnimTimer);
    S.overAnimTimer = null;
    destroyCtl(S.overCat);
    S.overCat = null;
    S.overShownFor = null;
  }

  function opponentOnline(state) {
    var opp = state && opponentOf(state);
    if (!opp) return false;
    return S.presence.some(function (p) { return sameId(p.id, opp.id); });
  }

  function updateRematchUI() {
    var st = S.game;
    if (!st) return;
    var btn = $('#over-rematch'), note = $('#over-rematch-note');
    var opp = opponentOf(st);
    var oppName = opp ? opp.username : 'Tu rival';
    var canRematch = st.reason !== 'abandon' && opponentOnline(st);
    btn.disabled = !canRematch || S.rematchMine;
    if (!canRematch) {
      btn.textContent = 'Revancha';
      note.textContent = oppName + ' ya no está en la partida.';
      note.classList.remove('hidden');
      return;
    }
    if (S.rematchMine) {
      btn.textContent = 'Esperando…';
      note.textContent = 'Esperando a que ' + oppName + ' acepte la revancha…';
      note.classList.remove('hidden');
    } else if (S.rematchTheirs) {
      btn.textContent = '¡Acepto revancha!';
      note.textContent = oppName + ' quiere revancha 🐾';
      note.classList.remove('hidden');
    } else {
      btn.textContent = 'Revancha';
      note.classList.add('hidden');
    }
  }

  function requestRematch() {
    if (!S.game || !S.socket) return;
    S.socket.emit('game:rematch', { gameId: S.game.id });
    S.rematchMine = true;
    Sound.play('click');
    updateRematchUI();
  }

  function onRematch(data) {
    if (!data || !S.game || data.gameId !== S.game.id) return;
    if (sameId(data.requestedBy, myId())) { S.rematchMine = true; }
    else {
      S.rematchTheirs = true;
      Sound.play('invite');
      var opp = opponentOf(S.game);
      sysMsg((opp ? opp.username : 'Tu rival') + ' quiere revancha 🐾');
      notifyTitle('🔁 ¡Revancha!');
    }
    updateRematchUI();
  }

  function leaveGame() {
    var st = S.game;
    if (st && st.status === 'playing') {
      confirmPixel('¿Seguro que quieres salir? Si abandonas, pierdes la partida 😿', 'Salir', 'Seguir jugando')
        .then(function (ok) {
          if (!ok) return;
          if (S.game && S.game.id === st.id && S.game.status === 'playing') {
            S.leftGames[st.id] = true;
            if (S.socket) S.socket.emit('game:leave', { gameId: st.id });
          }
          backToLobby();
        });
    } else backToLobby();
  }

  function backToLobby() {
    hideOver();
    stopTitle();
    if (S.game) {
      // partida terminada: avisar al server que salimos (así no queda una revancha colgando)
      if (S.game.status !== 'playing' && S.socket && S.socket.connected) S.socket.emit('game:leave', { gameId: S.game.id });
      S.leftGames[S.game.id] = true;
    }
    S.game = null;
    enterLobby();
  }

  function confetti() {
    var box = $('#over-confetti');
    box.innerHTML = '';
    var cols = ['#ff9fbc', '#bba4f5', '#93dfbd', '#ffb98a', '#ffd56e', '#cfe8ff'];
    for (var i = 0; i < 36; i++) {
      var p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = cols[i % cols.length];
      p.style.animationDelay = (Math.random() * 0.8) + 's';
      p.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
      box.appendChild(p);
    }
  }

  /* ---------- Chat ---------- */
  function sysMsg(text) {
    var li = document.createElement('li');
    li.className = 'msg-sys';
    li.textContent = text;
    appendChat(li);
  }

  function appendChat(li) {
    var log = $('#chat-log');
    log.appendChild(li);
    while (log.children.length > 150) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }

  function onChatMsg(m) {
    if (!m || S.screen !== 'game') return;
    var mine = m.from && sameId(m.from.id, myId());
    var li = document.createElement('li');
    var text = String(m.text || '');
    var isEmoji = /^\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*$/u.test(text.trim());
    li.className = 'msg' + (mine ? ' mine' : '') + (isEmoji ? ' big' : '');
    var cat = null;
    if (S.game) {
      var p = (S.game.players || []).find(function (pl) { return m.from && sameId(pl.id, m.from.id); });
      cat = p && p.cat;
    }
    li.appendChild(avatarEl(cat, 1));
    var bub = document.createElement('div');
    bub.className = 'msg-bubble';
    var nm = document.createElement('span');
    nm.className = 'msg-name';
    var time = '';
    try { time = new Date(m.ts || Date.now()).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }); } catch (e) { /* noop */ }
    nm.textContent = (mine ? 'Tú' : (m.from ? m.from.username : '?')) + (time ? ' · ' + time : '');
    var tx = document.createElement('span');
    tx.textContent = text;
    bub.appendChild(nm); bub.appendChild(tx);
    li.appendChild(bub);
    appendChat(li);
    if (!mine) {
      Sound.play('msg');
      notifyTitle('💬 ' + (m.from ? m.from.username : '') + ': ' + text.slice(0, 30));
      if (text === 'Miau!' || text === '😺' || text === '❤️') playCtl(S.fighters.right, 'happy');
    } else if (text === 'Miau!' || text === '😺' || text === '❤️') {
      playCtl(S.fighters.left, 'happy');
    }
  }

  function sendChat(text) {
    text = String(text || '').trim().slice(0, 200);
    if (!text || !S.game || !S.socket) return;
    S.socket.emit('chat:send', { gameId: S.game.id, text: text });
  }

  /* ---------- Socket ---------- */
  function connectSocket() {
    if (S.socket) { try { S.socket.removeAllListeners(); S.socket.disconnect(); } catch (e) { /* noop */ } }
    if (typeof window.io !== 'function') {
      toast('No se pudo cargar el modo en línea 😿', 'error', 5000);
      return;
    }
    var sock = window.io({ auth: { token: S.token } });
    S.socket = sock;

    sock.on('connect', function () {
      $('#conn-banner').classList.add('hidden');
      if (S.wasDisconnected) {
        toast('¡Conectado de nuevo! 🐾', 'ok');
        if (S.game && S.game.status === 'playing') {
          // si el server sigue teniendo la partida (otra pestaña) nos reenvía game:state;
          // si no, la dio por abandonada al desconectarnos.
          var gid = S.game.id, since = Date.now();
          setTimeout(function () {
            if (!S.game || S.game.id !== gid || S.game.status !== 'playing') return;
            if ((S.lastStateAt || 0) >= since) return;
            S.leftGames[gid] = true;
            toast('Se perdió la conexión y la partida terminó.', 'error', 4500);
            backToLobby();
          }, 1500);
        }
      }
      S.wasDisconnected = false;
    });
    sock.on('disconnect', function (reason) {
      if (reason === 'io client disconnect') return;
      S.wasDisconnected = true;
      $('#conn-banner').classList.remove('hidden');
      if (reason === 'io server disconnect') {
        // el server cerró: reintentar manualmente
        setTimeout(function () { if (S.socket === sock && !sock.connected) sock.connect(); }, 1000);
      }
    });
    sock.on('connect_error', function (err) {
      if (err && err.message === 'auth') { logout('Tu sesión expiró. Vuelve a entrar.'); return; }
      $('#conn-banner').classList.remove('hidden');
    });

    sock.on('presence', function (list) {
      S.presence = Array.isArray(list) ? list : [];
      if (S.screen === 'lobby') renderPresence();
      if (S.overShownFor) updateRematchUI();
    });
    sock.on('invite:received', onInviteReceived);
    sock.on('invite:declined', function (d) {
      var who = d && d.by ? d.by.username : 'Tu amigo';
      toast(who + ' rechazó tu invitación 😿', 'info');
      Sound.play('miss');
    });
    sock.on('game:state', onGameState);
    sock.on('game:over', onGameOver);
    sock.on('game:rematch', onRematch);
    sock.on('chat:msg', onChatMsg);
    sock.on('error:msg', function (d) {
      toast((d && d.message) || 'Algo salió mal', 'error');
      if (S.overShownFor && S.rematchMine) {
        S.rematchMine = false;
        updateRematchUI();
      }
      // si un movimiento fue rechazado, re-renderizar para reactivar botones
      if (S.game && S.screen === 'game') renderGame(S.game);
    });
    sock.on('user:updated', function (d) {
      if (!d || !d.user) return;
      S.user = d.user;
      renderMe();
      setTimeout(loadLeaderboard, 200);
    });
  }

  /* ---------- Eventos de la UI ---------- */
  function bindUI() {
    $$('.tab').forEach(function (t) { t.addEventListener('click', function () { setAuthMode(t.dataset.tab); }); });
    $('#auth-form').addEventListener('submit', onAuthSubmit);

    $('#creator-save').addEventListener('click', saveCat);
    $('#creator-cancel').addEventListener('click', function () { if (S.user && S.user.cat) enterLobby(); });

    $('#btn-edit-cat').addEventListener('click', function () { openCreator(false); });
    $('#btn-logout').addEventListener('click', function () {
      confirmPixel('¿Cerrar sesión?', 'Salir', 'Quedarme').then(function (ok) { if (ok) logout('¡Hasta pronto! 👋'); });
    });
    $('#btn-lb-refresh').addEventListener('click', loadLeaderboard);
    $('#me-cat-wrap').addEventListener('click', function () {
      playCtl(S.meCat, 'happy');
      Sound.play('msg');
    });

    $('#invite-accept').addEventListener('click', function () { respondInvite(true); });
    $('#invite-decline').addEventListener('click', function () { respondInvite(false); });

    $('#over-rematch').addEventListener('click', requestRematch);
    $('#over-lobby').addEventListener('click', backToLobby);
    $('#btn-leave-game').addEventListener('click', leaveGame);

    $('#chat-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = $('#chat-input');
      sendChat(inp.value);
      inp.value = '';
    });
    $$('.emote').forEach(function (b) {
      b.addEventListener('click', function () { sendChat(b.dataset.emote); });
    });

    var mute = $('#btn-mute');
    function paintMute() {
      mute.textContent = Sound.muted ? '🔇' : '🔊';
      mute.title = Sound.muted ? 'Activar sonido' : 'Silenciar';
    }
    paintMute();
    mute.addEventListener('click', function () {
      Sound.muted = !Sound.muted;
      store.set(MUTE_KEY, Sound.muted ? '1' : '0');
      paintMute();
      Sound.play('click');
    });

    window.addEventListener('beforeunload', function (e) {
      if (S.game && S.game.status === 'playing') { e.preventDefault(); e.returnValue = ''; }
    });
  }

  /* ---------- Arranque ---------- */
  function boot() {
    initBrand();
    bindUI();
    setAuthMode('login');
    S.token = store.get(TOKEN_KEY);
    if (!S.token) { showAuth(); return; }
    api('GET', '/api/me').then(function (data) {
      onLoggedIn(data.user);
    }).catch(function (err) {
      if (!err.network) { store.del(TOKEN_KEY); S.token = null; }
      showAuth();
      if (err.network) showError('#auth-error', err.message);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
