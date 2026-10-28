/* Amigatos — CatCreator
 * Editor de gato con vista previa animada. Requiere window.CatArt (cat-art.js).
 * window.CatCreator.mount(container, initialCat, onChange) → { getCat(), destroy() }
 */
(function () {
  'use strict';

  var STYLE_ID = 'cc-styles';
  var CSS = [
    '.cc-root{--cc-ink:#3b2a40;--cc-ink2:#6b5470;--cc-paper:#fff8ef;--cc-card:#ffffff;--cc-soft:#ffe9ef;--cc-accent:#ff8fab;--cc-accent2:#ffc6d6;--cc-mint:#c9f0e1;--cc-px:3px;',
    'font-family:"Pixelify Sans","Press Start 2P",monospace;color:var(--cc-ink);display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start;justify-content:center;width:100%;box-sizing:border-box;}',
    '.cc-root *,.cc-root *::before,.cc-root *::after{box-sizing:border-box;}',
    '.cc-px{box-shadow:0 calc(var(--cc-px)*-1) 0 0 var(--cc-ink),0 var(--cc-px) 0 0 var(--cc-ink),calc(var(--cc-px)*-1) 0 0 0 var(--cc-ink),var(--cc-px) 0 0 0 var(--cc-ink);}',
    '.cc-stagewrap{flex:0 1 296px;min-width:0;display:flex;flex-direction:column;align-items:center;gap:14px;margin:var(--cc-px);}',
    '.cc-stage{position:relative;width:100%;max-width:296px;aspect-ratio:1/1;background:',
    'linear-gradient(to bottom,transparent 72%,#f6d7b8 72%,#f6d7b8 74%,#f9e4cc 74%),',
    'repeating-linear-gradient(90deg,#fff3f6 0 16px,#ffeaf0 16px 32px);',
    'display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer;-webkit-tap-highlight-color:transparent;}',
    '.cc-stage::before{content:"";position:absolute;left:50%;bottom:9%;width:72%;height:10%;transform:translateX(-50%);',
    'background:repeating-linear-gradient(90deg,#ffc6d6 0 8px,#ffb3c7 8px 16px);box-shadow:0 -3px 0 0 #e889a4,0 3px 0 0 #e889a4,-3px 0 0 0 #e889a4,3px 0 0 0 #e889a4;}',
    '.cc-stage canvas{position:relative;width:86%;height:auto;image-rendering:pixelated;image-rendering:crisp-edges;display:block;}',
    '.cc-plate{background:var(--cc-card);padding:6px 14px;font-size:20px;line-height:1.1;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.cc-hint{font-size:13px;color:var(--cc-ink2);margin-top:-6px;}',
    '.cc-panel{flex:1 1 320px;min-width:0;max-width:560px;display:flex;flex-direction:column;gap:14px;background:var(--cc-paper);padding:16px;margin:var(--cc-px);}',
    '.cc-sec{display:flex;flex-direction:column;gap:8px;}',
    '.cc-title{font-size:15px;letter-spacing:.5px;display:flex;align-items:center;gap:6px;}',
    '.cc-title::before{content:"";width:8px;height:8px;background:var(--cc-accent);box-shadow:2px 2px 0 var(--cc-ink);}',
    '.cc-name{font:inherit;font-size:20px;color:var(--cc-ink);background:var(--cc-card);border:0;outline:0;padding:8px 10px;width:100%;margin:0 var(--cc-px);width:calc(100% - var(--cc-px)*2);border-radius:0;}',
    '.cc-name:focus{background:#fffdf5;box-shadow:0 -3px 0 0 var(--cc-ink),0 3px 0 0 var(--cc-ink),-3px 0 0 0 var(--cc-ink),3px 0 0 0 var(--cc-ink),0 0 0 6px var(--cc-accent2);}',
    '.cc-swatches{display:flex;flex-wrap:wrap;gap:10px;padding:3px;}',
    '.cc-sw{position:relative;width:30px;height:30px;border:0;padding:0;margin:0;cursor:pointer;background:var(--sw,#fff);',
    'box-shadow:0 -2px 0 0 var(--cc-ink),0 2px 0 0 var(--cc-ink),-2px 0 0 0 var(--cc-ink),2px 0 0 0 var(--cc-ink),inset -3px -3px 0 0 rgba(0,0,0,.14),inset 3px 3px 0 0 rgba(255,255,255,.35);',
    'transition:transform .08s steps(2);-webkit-tap-highlight-color:transparent;}',
    '.cc-sw:hover{transform:translateY(-2px);}',
    '.cc-sw:focus-visible{outline:3px dashed var(--cc-accent);outline-offset:5px;}',
    '.cc-sw[aria-pressed="true"]{transform:translateY(-3px);box-shadow:0 -2px 0 0 var(--cc-ink),0 2px 0 0 var(--cc-ink),-2px 0 0 0 var(--cc-ink),2px 0 0 0 var(--cc-ink),inset 0 0 0 3px #fff,0 6px 0 0 var(--cc-accent);}',
    '.cc-custom{background:repeating-linear-gradient(45deg,#ffd6e0 0 5px,#c9f0e1 5px 10px,#d8ccff 10px 15px);display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;color:var(--cc-ink);overflow:hidden;}',
    '.cc-custom.cc-has{background:var(--sw);}',
    '.cc-custom span{pointer-events:none;text-shadow:1px 1px 0 #fff,-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff;}',
    '.cc-custom input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;border:0;padding:0;}',
    '.cc-opts{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:12px;padding:3px;}',
    '.cc-opt{font:inherit;font-size:14px;color:var(--cc-ink);background:var(--cc-card);border:0;margin:0;padding:6px 4px 7px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;',
    'box-shadow:0 -3px 0 0 var(--cc-ink),0 3px 0 0 var(--cc-ink),-3px 0 0 0 var(--cc-ink),3px 0 0 0 var(--cc-ink),inset 0 -4px 0 0 #f1e3ea;transition:transform .08s steps(2);-webkit-tap-highlight-color:transparent;}',
    '.cc-opt:hover{transform:translateY(-2px);background:#fffafc;}',
    '.cc-opt:focus-visible{outline:3px dashed var(--cc-accent);outline-offset:5px;}',
    '.cc-opt[aria-pressed="true"]{background:var(--cc-soft);transform:translateY(-2px);box-shadow:0 -3px 0 0 var(--cc-ink),0 3px 0 0 var(--cc-ink),-3px 0 0 0 var(--cc-ink),3px 0 0 0 var(--cc-ink),inset 0 -4px 0 0 var(--cc-accent2),0 7px 0 0 var(--cc-accent);}',
    '.cc-opt img{width:56px;height:56px;image-rendering:pixelated;display:block;}',
    '.cc-random{font:inherit;font-size:18px;color:var(--cc-ink);background:var(--cc-mint);border:0;margin:6px var(--cc-px) var(--cc-px);padding:10px 14px;cursor:pointer;',
    'box-shadow:0 -3px 0 0 var(--cc-ink),0 3px 0 0 var(--cc-ink),-3px 0 0 0 var(--cc-ink),3px 0 0 0 var(--cc-ink),inset 0 -5px 0 0 #9fdcc5;transition:transform .08s steps(2);}',
    '.cc-random:hover{transform:translateY(-2px);}',
    '.cc-random:active{transform:translateY(2px);box-shadow:0 -3px 0 0 var(--cc-ink),0 3px 0 0 var(--cc-ink),-3px 0 0 0 var(--cc-ink),3px 0 0 0 var(--cc-ink),inset 0 3px 0 0 #9fdcc5;}',
    '.cc-random:focus-visible{outline:3px dashed var(--cc-accent);outline-offset:6px;}',
    '.cc-breeds{display:grid;grid-auto-flow:column;grid-template-rows:repeat(2,auto);grid-auto-columns:88px;gap:12px;overflow-x:auto;padding:5px 5px 12px;scroll-snap-type:x proximity;scroll-padding-inline:5px;scrollbar-width:thin;scrollbar-color:var(--cc-accent) transparent;}',
    '.cc-breeds .cc-opt{scroll-snap-align:start;font-size:13px;line-height:1.05;min-height:96px;justify-content:flex-start;text-align:center;}',
    '.cc-breeds::-webkit-scrollbar{height:8px;}.cc-breeds::-webkit-scrollbar-thumb{background:var(--cc-accent);}',
    '.cc-namerow{display:flex;gap:12px;align-items:stretch;padding:0 3px;}',
    '.cc-namerow .cc-name{flex:1 1 auto;min-width:0;margin:3px;width:auto;}',
    '.cc-dice{font:inherit;font-size:20px;line-height:1;border:0;margin:3px;padding:0 10px;cursor:pointer;background:var(--cc-accent2);',
    'box-shadow:0 -3px 0 0 var(--cc-ink),0 3px 0 0 var(--cc-ink),-3px 0 0 0 var(--cc-ink),3px 0 0 0 var(--cc-ink),inset 0 -4px 0 0 var(--cc-accent);transition:transform .08s steps(2);}',
    '.cc-dice:hover{transform:translateY(-2px) rotate(-6deg);}.cc-dice:active{transform:translateY(2px);}',
    '.cc-dice:focus-visible{outline:3px dashed var(--cc-accent);outline-offset:5px;}',
    '.cc-name-big{font-size:22px;}',
    '.cc-story{margin:12px 3px 0;padding:10px 12px;background:#fff8e7;color:var(--cc-ink);}',
    '.cc-story-title{font-size:15px;font-weight:700;margin-bottom:4px;color:var(--cc-accent);}',
    '.cc-story-text{margin:0;font-size:15px;line-height:1.35;}',
    '@media (max-width:480px){.cc-root{gap:14px;}.cc-panel{padding:12px;}.cc-sw{width:28px;height:28px;}.cc-swatches{gap:9px;}',
    '.cc-opts{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;}.cc-opt img{width:48px;height:48px;}.cc-stagewrap{flex-basis:100%;}.cc-stage{max-width:240px;}}',
    '@media (prefers-reduced-motion:reduce){.cc-sw,.cc-opt,.cc-random{transition:none;}}'
  ].join('');

  function injectStyles() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function el(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) for (var k in attrs) {
      if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    return e;
  }

  function mount(container, initialCat, onChange) {
    if (!window.CatArt) throw new Error('CatCreator necesita CatArt (carga cat-art.js primero).');
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) throw new Error('CatCreator: contenedor no encontrado.');
    injectStyles();

    var A = window.CatArt;
    var O = A.OPTIONS;
    var cat = A.normalizeCat(initialCat || A.defaultCat());
    var nameRaw = initialCat && typeof initialCat.name === 'string' ? initialCat.name.slice(0, 16) : cat.name;
    var listeners = [];
    function on(node, ev, fn) { node.addEventListener(ev, fn); listeners.push([node, ev, fn]); }

    var root = el('div', 'cc-root');

    // --- vista previa ---
    var stageWrap = el('div', 'cc-stagewrap');
    var stage = el('div', 'cc-stage cc-px', { title: '¡Hazle cariño!', role: 'img', 'aria-label': 'Vista previa del gato' });
    var canvas = el('canvas');
    stage.appendChild(canvas);
    var plate = el('div', 'cc-plate cc-px');
    var hint = el('div', 'cc-hint', { text: 'toca a tu gato ♥' });
    stageWrap.appendChild(stage);
    stageWrap.appendChild(plate);
    stageWrap.appendChild(hint);
    root.appendChild(stageWrap);

    // --- panel ---
    var panel = el('div', 'cc-panel cc-px');
    root.appendChild(panel);

    function section(title) {
      var s = el('div', 'cc-sec');
      s.appendChild(el('div', 'cc-title', { text: title }));
      panel.appendChild(s);
      return s;
    }

    // nombre (con dado de nombres)
    var secName = section('Nombre');
    var nameRow = el('div', 'cc-namerow');
    var nameInput = el('input', 'cc-name cc-name-big cc-px', { type: 'text', maxlength: '16', placeholder: 'Michi', 'aria-label': 'Nombre del gato', autocomplete: 'off', spellcheck: 'false' });
    nameInput.value = nameRaw;
    var nameDice = el('button', 'cc-dice', { type: 'button', title: 'Nombre al azar', 'aria-label': 'Nombre al azar', text: '🎲' });
    nameRow.appendChild(nameInput);
    nameRow.appendChild(nameDice);
    secName.appendChild(nameRow);

    // raza (primero y bien visible)
    var secBreed = section('Raza');
    var breedGrid = el('div', 'cc-breeds', { role: 'group', 'aria-label': 'Raza' });
    var breedItems = (O.breeds || []).map(function (b) {
      var btn = el('button', 'cc-opt', { type: 'button', 'aria-pressed': 'false', title: b.label });
      var img = el('img', '', { alt: '', width: '64', height: '64', draggable: 'false' });
      var thumb = { name: b.label, breed: b.id, accessory: 'none' };
      for (var k in b.preset) thumb[k] = b.preset[k];
      img.src = A.toDataURL(thumb, 2);
      btn.appendChild(img);
      btn.appendChild(el('span', '', { text: b.label }));
      on(btn, 'click', function () { setBreed(b.id); });
      breedGrid.appendChild(btn);
      return { btn: btn, id: b.id };
    });
    secBreed.appendChild(breedGrid);
    var story = el('div', 'cc-story cc-px', { 'aria-live': 'polite' });
    var storyTitle = el('div', 'cc-story-title');
    var storyText = el('p', 'cc-story-text');
    story.appendChild(storyTitle);
    story.appendChild(storyText);
    secBreed.appendChild(story);

    // filas de color
    var swatchRows = {};
    function colorRow(title, field, palette) {
      var s = section(title);
      var row = el('div', 'cc-swatches', { role: 'group', 'aria-label': title });
      var buttons = palette.map(function (hex) {
        var b = el('button', 'cc-sw', { type: 'button', 'aria-label': title + ' ' + hex, title: hex, 'aria-pressed': 'false' });
        b.style.setProperty('--sw', hex);
        b.dataset.hex = hex;
        on(b, 'click', function () { set(field, hex); });
        row.appendChild(b);
        return b;
      });
      var custom = el('label', 'cc-sw cc-custom', { title: 'Color personalizado', 'aria-pressed': 'false' });
      var plus = el('span', '', { text: '+' });
      var inp = el('input', '', { type: 'color', 'aria-label': title + ': color personalizado' });
      custom.appendChild(plus);
      custom.appendChild(inp);
      on(inp, 'input', function () { set(field, inp.value, true); });
      on(inp, 'change', function () { set(field, inp.value); });
      row.appendChild(custom);
      s.appendChild(row);
      swatchRows[field] = { buttons: buttons, custom: custom, input: inp, palette: palette };
    }

    function optionRow(title, field, list) {
      var s = section(title);
      var grid = el('div', 'cc-opts', { role: 'group', 'aria-label': title });
      var items = list.map(function (o) {
        var b = el('button', 'cc-opt', { type: 'button', 'aria-pressed': 'false' });
        var img = el('img', '', { alt: '', width: '64', height: '64', draggable: 'false' });
        b.appendChild(img);
        b.appendChild(el('span', '', { text: o.label }));
        b.dataset.id = o.id;
        on(b, 'click', function () { set(field, o.id); });
        grid.appendChild(b);
        return { btn: b, img: img, id: o.id };
      });
      s.appendChild(grid);
      return items;
    }

    colorRow('Pelaje', 'fur', O.furPalette);
    var patternItems = optionRow('Patrón', 'pattern', O.patterns);
    colorRow('Color del patrón', 'patternColor', O.furPalette);
    colorRow('Ojos', 'eyes', O.eyePalette);
    var accItems = optionRow('Accesorio', 'accessory', O.accessories);
    colorRow('Color del accesorio', 'accessoryColor', O.accentPalette);

    var randomBtn = el('button', 'cc-random', { type: 'button', text: '🎲 Aleatorio' });
    panel.appendChild(randomBtn);

    container.appendChild(root);

    var ctrl = A.mount(canvas, cat, { scale: 8, anim: 'idle' });

    // --- estado ---
    function getCat() {
      var c = {};
      for (var k in cat) c[k] = cat[k];
      var n = nameInput.value.trim().slice(0, 16);
      c.name = n || 'Michi';
      return c;
    }

    function refresh(thumbs) {
      plate.textContent = (nameInput.value.trim() || 'Michi');
      Object.keys(swatchRows).forEach(function (field) {
        var r = swatchRows[field];
        var v = (cat[field] || '').toLowerCase();
        var found = false;
        r.buttons.forEach(function (b) {
          var on_ = b.dataset.hex.toLowerCase() === v;
          if (on_) found = true;
          b.setAttribute('aria-pressed', on_ ? 'true' : 'false');
        });
        r.custom.setAttribute('aria-pressed', found ? 'false' : 'true');
        r.custom.classList.toggle('cc-has', !found);
        if (!found) r.custom.style.setProperty('--sw', v);
        if (/^#[0-9a-f]{6}$/.test(v) && document.activeElement !== r.input) r.input.value = v;
      });
      breedItems.forEach(function (it) { it.btn.setAttribute('aria-pressed', it.id === cat.breed ? 'true' : 'false'); });
      var info = (O.breeds || []).filter(function (b) { return b.id === cat.breed; })[0];
      storyTitle.textContent = info ? '📜 La historia del ' + info.label : '';
      storyText.textContent = info && info.story ? info.story : '';
      story.style.display = info && info.story ? '' : 'none';
      patternItems.forEach(function (it) { it.btn.setAttribute('aria-pressed', it.id === cat.pattern ? 'true' : 'false'); });
      accItems.forEach(function (it) { it.btn.setAttribute('aria-pressed', it.id === cat.accessory ? 'true' : 'false'); });
      if (thumbs) {
        patternItems.forEach(function (it) {
          var c = getCat(); c.pattern = it.id; c.accessory = 'none';
          it.img.src = A.toDataURL(c, 2);
        });
        accItems.forEach(function (it) {
          var c = getCat(); c.accessory = it.id;
          it.img.src = A.toDataURL(c, 2);
        });
      }
    }

    var thumbFields = { fur: 1, patternColor: 1, eyes: 1, accessoryColor: 1, pattern: 1 };
    var lastHappy = 0;
    function emit(celebrate) {
      if (celebrate) {
        var t = Date.now();
        if (t - lastHappy > 250) { ctrl.play('happy'); lastHappy = t; }
      }
      if (typeof onChange === 'function') {
        try { onChange(getCat()); } catch (e) { if (window.console) console.error(e); }
      }
    }

    function set(field, value, live) {
      var next = {};
      for (var k in cat) next[k] = cat[k];
      next[field] = value;
      next = A.normalizeCat(next);
      var changed = next[field] !== cat[field];
      cat = next;
      ctrl.setCat(cat);
      refresh(!!thumbFields[field] || field === 'accessory');
      if (changed) emit(!live || Date.now() - lastHappy > 1200);
    }

    function setBreed(id) {
      var next = {};
      for (var k in cat) next[k] = cat[k];
      next.breed = id;
      var pr = A.breedPreset ? A.breedPreset(id) : null;
      if (pr) for (var k2 in pr) next[k2] = pr[k2];
      cat = A.normalizeCat(next);
      ctrl.setCat(cat);
      refresh(true);
      var sel = breedItems.filter(function (it) { return it.id === id; })[0];
      if (sel && sel.btn.scrollIntoView && breedGrid.scrollWidth > breedGrid.clientWidth) {
        var bl = sel.btn.offsetLeft - breedGrid.offsetLeft, bw = sel.btn.offsetWidth;
        if (bl < breedGrid.scrollLeft || bl + bw > breedGrid.scrollLeft + breedGrid.clientWidth) breedGrid.scrollLeft = bl - 10;
      }
      emit(true);
    }

    on(nameDice, 'click', function () {
      var names = A.NAMES || ['Michi'];
      var n = nameInput.value.trim(), tries = 0, pickN = n;
      while ((pickN === n || !pickN) && tries++ < 10) pickN = names[Math.floor(Math.random() * names.length)];
      nameInput.value = pickN;
      cat.name = pickN;
      refresh(false);
      emit(true);
    });

    on(nameInput, 'input', function () {
      if (nameInput.value.length > 16) nameInput.value = nameInput.value.slice(0, 16);
      cat.name = nameInput.value.trim() || 'Michi';
      refresh(false);
      emit(false);
    });
    on(nameInput, 'change', function () { ctrl.play('happy'); });

    on(stage, 'click', function () { ctrl.play('happy'); });

    on(randomBtn, 'click', function () {
      var r = A.randomCat();
      cat = A.normalizeCat(r);
      nameInput.value = r.name;
      ctrl.setCat(cat);
      refresh(true);
      lastHappy = 0;
      emit(true);
    });

    refresh(true);

    return {
      getCat: getCat,
      destroy: function () {
        ctrl.destroy();
        listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2]); });
        listeners = [];
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  window.CatCreator = { mount: mount };
})();
