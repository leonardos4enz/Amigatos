/* Amigatos — CatArt
 * Gatos pixel art 32x32 dibujados por código (sin imágenes externas).
 * Expone window.CatArt (ver CONTRACT.md, "API de arte").
 */
(function () {
  'use strict';

  var W = 32;
  var INK = [43, 26, 51];          // tinta base (ciruela oscuro) para contornos
  var WHITE = [255, 255, 255];

  /* ------------------------------------------------------------------ */
  /* Opciones y paletas                                                  */
  /* ------------------------------------------------------------------ */
  var OPTIONS = {
    patterns: [
      { id: 'solid', label: 'Liso' },
      { id: 'tabby', label: 'Atigrado' },
      { id: 'spots', label: 'Manchas' },
      { id: 'tuxedo', label: 'Esmoquin' },
      { id: 'calico', label: 'Tricolor' },
      { id: 'siamese', label: 'Siamés' }
    ],
    accessories: [
      { id: 'none', label: 'Nada' },
      { id: 'bow', label: 'Moño' },
      { id: 'hat', label: 'Gorrito' },
      { id: 'scarf', label: 'Bufanda' },
      { id: 'crown', label: 'Corona' },
      { id: 'glasses', label: 'Lentes' },
      { id: 'flower', label: 'Flor' }
    ],
    furPalette: [
      '#f4a261', // naranja
      '#e07a3f', // jengibre
      '#f3dcb5', // crema
      '#f7f3ee', // blanco
      '#b9b3ad', // gris claro
      '#8e98a8', // gris azulado
      '#4a4553', // negro suave
      '#9b6a45', // café
      '#5e4034', // chocolate
      '#cdb8de', // lila
      '#f6c1cc', // rosa pastel
      '#e9c46a', // dorado
      '#b8e0d2', // menta pastel
      '#2f2a36', // negro azabache
      '#f2c6c0'  // piel rosada
    ],
    eyePalette: [
      '#2a9d8f', // turquesa
      '#4cc9f0', // celeste
      '#57cc99', // verde
      '#f6bd60', // ámbar
      '#e9c46a', // oro
      '#8f6fd1', // violeta
      '#3a86ff', // azul
      '#a0522d', // miel oscura
      '#e08a2e'  // cobre
    ],
    accentPalette: [
      '#e63946', // rojo
      '#ff8fab', // rosa
      '#ffb703', // amarillo
      '#8ecae6', // celeste
      '#219ebc', // azul
      '#90be6d', // verde
      '#9b5de5', // morado
      '#f15bb5', // fucsia
      '#f8f9fa', // blanco
      '#3d405b'  // marino
    ]
  };

  OPTIONS.breeds = [
    { id: 'comun', label: 'Común', preset: { fur: '#b9b3ad', pattern: 'tabby', patternColor: '#6e6660', eyes: '#57cc99' } },
    { id: 'naranja', label: 'Atigrado Naranja', preset: { fur: '#f4a261', pattern: 'tabby', patternColor: '#b5602f', eyes: '#2a9d8f' } },
    { id: 'siames', label: 'Siamés', preset: { fur: '#f3dcb5', pattern: 'siamese', patternColor: '#5e4034', eyes: '#3a86ff' } },
    { id: 'persa', label: 'Persa', preset: { fur: '#f7f3ee', pattern: 'solid', patternColor: '#e8d8c8', eyes: '#e08a2e' } },
    { id: 'mainecoon', label: 'Maine Coon', preset: { fur: '#9b6a45', pattern: 'tabby', patternColor: '#4f3426', eyes: '#e9c46a' } },
    { id: 'sphynx', label: 'Esfinge', preset: { fur: '#f2c6c0', pattern: 'solid', patternColor: '#d99a9a', eyes: '#57cc99' } },
    { id: 'scottish', label: 'Scottish Fold', preset: { fur: '#b9b3ad', pattern: 'solid', patternColor: '#8e98a8', eyes: '#f6bd60' } },
    { id: 'bengala', label: 'Bengala', preset: { fur: '#e9b464', pattern: 'spots', patternColor: '#5e3a1f', eyes: '#57cc99' } },
    { id: 'ragdoll', label: 'Ragdoll', preset: { fur: '#f7f3ee', pattern: 'siamese', patternColor: '#8e98a8', eyes: '#4cc9f0' } },
    { id: 'british', label: 'British Shorthair', preset: { fur: '#8e98a8', pattern: 'solid', patternColor: '#6c7686', eyes: '#e08a2e' } },
    { id: 'azulruso', label: 'Azul Ruso', preset: { fur: '#7f8fa6', pattern: 'solid', patternColor: '#64748b', eyes: '#57cc99' } },
    { id: 'angora', label: 'Angora Turco', preset: { fur: '#f7f3ee', pattern: 'solid', patternColor: '#f3dcb5', eyes: '#4cc9f0' } },
    { id: 'bombay', label: 'Bombay', preset: { fur: '#2f2a36', pattern: 'solid', patternColor: '#4a4553', eyes: '#e08a2e' } }
  ];
  var BREED_IDS = OPTIONS.breeds.map(function (b) { return b.id; });

  var PATTERN_IDS = OPTIONS.patterns.map(function (p) { return p.id; });
  var ACCESSORY_IDS = OPTIONS.accessories.map(function (a) { return a.id; });
  var ANIMS = ['idle', 'happy', 'sad', 'sleep', 'walk'];

  var NAMES = ['Pancho', 'Mimí', 'Bolita', 'Tigre', 'Simba', 'Oreo', 'Nala', 'Coco', 'Michi', 'Pelusa', 'Bigotes', 'Luna', 'Mishi', 'Canela', 'Nube', 'Galleta',
    'Tofu', 'Mochi', 'Churro', 'Pimienta', 'Kiwi', 'Copito', 'Frijol', 'Chispa', 'Bombón',
    'Miel', 'Garbanzo', 'Lucero', 'Ñoño', 'Panqué', 'Tamal', 'Cocada'];

  /* ------------------------------------------------------------------ */
  /* Utilidades de color                                                 */
  /* ------------------------------------------------------------------ */
  function normHex(h) {
    if (typeof h !== 'string') return null;
    h = h.trim();
    if (/^#[0-9a-fA-F]{3}$/.test(h)) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    if (!/^#[0-9a-fA-F]{6}$/.test(h)) return null;
    return h.toLowerCase();
  }
  function rgb(h) {
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function hex(c) {
    return '#' + c.map(function (v) {
      var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length < 2 ? '0' + s : s;
    }).join('');
  }
  function mix(a, b, t) {
    return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
  }
  function lum(c) { return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }

  /* ------------------------------------------------------------------ */
  /* Modelo de gato                                                      */
  /* ------------------------------------------------------------------ */
  function defaultCat() {
    return {
      name: 'Michi',
      breed: 'naranja',
      fur: '#f4a261',
      pattern: 'tabby',
      patternColor: '#b5602f',
      eyes: '#2a9d8f',
      accessory: 'bow',
      accessoryColor: '#e63946'
    };
  }

  function normalizeCat(cat) {
    var d = defaultCat();
    if (!cat || typeof cat !== 'object') return d;
    var name = typeof cat.name === 'string' ? cat.name.trim().slice(0, 16) : '';
    if (BREED_IDS.indexOf(cat.breed) >= 0) {
      var bp = breedPreset(cat.breed);
      d.fur = bp.fur; d.patternColor = bp.patternColor; d.eyes = bp.eyes; d.pattern = bp.pattern;
    }
    return {
      name: name || d.name,
      breed: BREED_IDS.indexOf(cat.breed) >= 0 ? cat.breed : 'comun',
      fur: normHex(cat.fur) || d.fur,
      pattern: PATTERN_IDS.indexOf(cat.pattern) >= 0 ? cat.pattern : (d.pattern || 'solid'),
      patternColor: normHex(cat.patternColor) || d.patternColor,
      eyes: normHex(cat.eyes) || d.eyes,
      accessory: ACCESSORY_IDS.indexOf(cat.accessory) >= 0 ? cat.accessory : 'none',
      accessoryColor: normHex(cat.accessoryColor) || d.accessoryColor
    };
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function breedPreset(id) {
    for (var i = 0; i < OPTIONS.breeds.length; i++) if (OPTIONS.breeds[i].id === id) return OPTIONS.breeds[i].preset;
    return OPTIONS.breeds[0].preset;
  }

  function randomCat() {
    // la mitad de las veces: raza con sus colores típicos; si no, mezcla libre
    if (Math.random() < 0.5) {
      var bid = pick(BREED_IDS), pr = breedPreset(bid);
      return {
        name: pick(NAMES), breed: bid, fur: pr.fur, pattern: pr.pattern, patternColor: pr.patternColor, eyes: pr.eyes,
        accessory: Math.random() < 0.2 ? 'none' : pick(ACCESSORY_IDS.slice(1)),
        accessoryColor: pick(OPTIONS.accentPalette)
      };
    }
    var pattern = pick(PATTERN_IDS);
    var fur = pick(OPTIONS.furPalette);
    var patternColor;
    if (pattern === 'tuxedo') {
      fur = pick(['#4a4553', '#5e4034', '#8e98a8', '#9b6a45', '#e07a3f', '#4a4553']);
      patternColor = pick(['#f7f3ee', '#f7f3ee', '#f3dcb5']);
    } else if (pattern === 'siamese') {
      fur = pick(['#f3dcb5', '#f7f3ee', '#e8d8c8', '#cdb8de']);
      patternColor = pick(['#5e4034', '#6b5a6e', '#8e98a8', '#9b6a45']);
    } else if (pattern === 'calico') {
      fur = pick(['#f7f3ee', '#f3dcb5', '#f7f3ee']);
      patternColor = pick(['#4a4553', '#5e4034', '#8e98a8']);
    } else if (pattern === 'tabby') {
      patternColor = hex(mix(rgb(fur), INK, 0.35));
    } else {
      var others = OPTIONS.furPalette.filter(function (c) { return c !== fur; });
      patternColor = pick(others);
    }
    return {
      name: pick(NAMES),
      breed: pick(BREED_IDS.filter(function (b) { return b !== 'bombay' && b !== 'siames' && b !== 'naranja'; })),
      fur: fur,
      pattern: pattern,
      patternColor: patternColor,
      eyes: pick(OPTIONS.eyePalette),
      accessory: Math.random() < 0.15 ? 'none' : pick(ACCESSORY_IDS.slice(1)),
      accessoryColor: pick(OPTIONS.accentPalette)
    };
  }

  /* ------------------------------------------------------------------ */
  /* Mapas de pixeles (hechos a mano)                                    */
  /*  f pelaje · h brillo · w panza/hocico · p rosa oreja · o contorno    */
  /* ------------------------------------------------------------------ */
  var HEAD = [
    '....ffffffffffff....',
    '..ffhhhfffffffffff..',
    '.fhhfffffffffffffff.',
    '.fhffffffffffffffff.',
    'ffffffffffffffffffff',
    'ffffffffffffffffffff',
    'ffffffffffffffffffff',
    'ffffffffffffffffffff',
    'ffffffffwwwwffffffff',
    'fffffffwwwwwwfffffff',
    '.ffffffwwwwwwffffff.',
    '..fffffwwwwwwfffff..',
    '....ffffffffffff....'
  ];
  var EAR_UP = [
    'f.....',
    'ff....',
    'fpf...',
    'fppf..',
    'fpppf.',
    'ffffff'
  ];
  var EAR_DROOP = [
    '......',
    '......',
    'fff...',
    'fppff.',
    '.fpppf',
    '..ffff'
  ];
  var BODY = [
    '....ffffffff....',
    '...ffffffffff...',
    '..fffffwwfffff..',
    '.ffffwwwwwwffff.',
    '.fffwwwwwwwwfff.',
    'ffffwwwwwwwwffff',
    'ffffwwwwwwwwffff',
    'ffffwwwwwwwwffff',
    'ffffwwwwwwwwffff',
    'fffffwwwwwwfffff',
    '.ffffffffffffff.',
    '..ffffffffffff..'
  ];
  var PAW = [
    '.ff.',
    'ffff',
    'ffff'
  ];
  var FOOT = [
    '.fff.',
    'fffff',
    '.fff.'
  ];

  var EYES = {
    open: ['.K.', 'KWK', 'EEE', '.E.'],
    sad: ['...', 'KKK', 'WEE', '.E.'],
    happy: ['...', '.K.', 'K.K', '...'],
    closed: ['...', '...', 'KKK', '...'],
    sleep: ['...', '...', 'K.K', '.K.']
  };

  // Accesorios (coordenadas relativas a la cabeza)
  var ACC = {
    bow: { x: 13, y: -2, rows: ['AB.BA', 'AAKAA', 'AA.AA'] },
    hat: { x: 7, y: -6, rows: ['..YY..', '..AA..', '.ABAA.', '.AABA.', 'AAAAAB', 'ABAAAA'] },
    crown: { x: 7, y: -3, rows: ['G.GG.G', 'GGGGGG', 'GJGGJG', 'GGGGGG'] },
    flower: { x: 1, y: -2, rows: ['.PPP.', 'PPYPP', 'PYYYP', 'PPYPP', '.PPP.'] },
    scarf: {
      x: 2, y: 11, rows: [
        '..AAAAAAAAAAAA..',
        '.ABAABAABAABAAB.',
        '..AAAAAAAAAAAAA.',
        '...........AAA..',
        '...........ABA..',
        '...........AAA..',
        '...........B.B..'
      ]
    }
  };

  var HEART = ['HH.HH', 'HLHHH', 'HHHHH', '.HHH.', '..H..'];
  var HEART_S = ['H.H', 'HHH', '.H.'];
  var SPARK = ['.S.', 'SWS', '.S.'];
  var ZBIG = ['ZZZZ', '...Z', '..Z.', '.Z..', 'ZZZZ'];
  var ZSMALL = ['ZZZ', '..Z', '.Z.', 'Z..', 'ZZZ'];

  /* ------------------------------------------------------------------ */
  /* Framebuffer                                                          */
  /* ------------------------------------------------------------------ */
  function newFB(n) { return new Uint8ClampedArray((n || W) * (n || W) * 4); }

  function setPx(fb, x, y, c, size) {
    size = size || W;
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    var i = (y * size + x) * 4;
    fb[i] = c[0]; fb[i + 1] = c[1]; fb[i + 2] = c[2]; fb[i + 3] = 255;
  }
  function blendPx(fb, x, y, c, a, size) {
    size = size || W;
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    var i = (y * size + x) * 4;
    if (fb[i + 3] === 0) {
      fb[i] = c[0]; fb[i + 1] = c[1]; fb[i + 2] = c[2]; fb[i + 3] = Math.round(255 * a);
      return;
    }
    fb[i] = fb[i] + (c[0] - fb[i]) * a;
    fb[i + 1] = fb[i + 1] + (c[1] - fb[i + 1]) * a;
    fb[i + 2] = fb[i + 2] + (c[2] - fb[i + 2]) * a;
  }

  function mapCells(rows, ox, oy, region) {
    var cells = [];
    for (var y = 0; y < rows.length; y++) {
      var r = rows[y];
      for (var x = 0; x < r.length; x++) {
        var ch = r[x];
        if (ch !== '.' && ch !== ' ') cells.push({ x: ox + x, y: oy + y, c: ch, lx: x, ly: y, region: region });
      }
    }
    return cells;
  }

  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // Pinta una "pieza": primero su contorno (auto), luego el relleno con sombreado automático
  function stamp(fb, cells, colorFn, outline, size, skipUp) {
    var set = {};
    var i, c;
    for (i = 0; i < cells.length; i++) set[cells[i].x + ',' + cells[i].y] = 1;
    if (outline) {
      for (i = 0; i < cells.length; i++) {
        c = cells[i];
        for (var d = 0; d < (skipUp ? 3 : 4); d++) {
          var nx = c.x + DIRS[d][0], ny = c.y + DIRS[d][1];
          if (!set[nx + ',' + ny]) setPx(fb, nx, ny, outline, size);
        }
      }
    }
    for (i = 0; i < cells.length; i++) {
      c = cells[i];
      var edge = !set[(c.x + 1) + ',' + c.y] || !set[c.x + ',' + (c.y + 1)];
      var col = colorFn(c, edge);
      if (col) setPx(fb, c.x, c.y, col, size);
    }
  }

  function tailCells(b, k, t2, r0, rt) {
    r0 = r0 || 1.5; rt = rt || 0.35;
    var best = {};
    var N = 30;
    for (var i = 0; i <= N; i++) {
      var t = i / N, u = 1 - t;
      var px = u * u * b[0] + 2 * u * t * k[0] + t * t * t2[0];
      var py = u * u * b[1] + 2 * u * t * k[1] + t * t * t2[1];
      var r = r0 - rt * t;
      for (var y = Math.floor(py - r); y <= Math.ceil(py + r); y++) {
        for (var x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
          var dx = x + 0.5 - px, dy = y + 0.5 - py, dd = dx * dx + dy * dy;
          if (dd <= r * r) {
            var key = x + ',' + y;
            if (!best[key] || best[key].d > dd) best[key] = { x: x, y: y, d: dd, t: t };
          }
        }
      }
    }
    var cells = [];
    for (var kk in best) {
      var o = best[kk];
      cells.push({ x: o.x, y: o.y, c: 'f', lx: o.t, ly: 0, region: 'tail' });
    }
    return cells;
  }

  /* ------------------------------------------------------------------ */
  /* Colores derivados                                                   */
  /* ------------------------------------------------------------------ */
  var colorCache = {};
  function deriveColors(cat) {
    var key = cat.fur + cat.patternColor + cat.eyes + cat.accessoryColor;
    if (colorCache[key]) return colorCache[key];
    var fur = rgb(cat.fur), pat = rgb(cat.patternColor), eye = rgb(cat.eyes), acc = rgb(cat.accessoryColor);
    var C = {};
    function tone(name, base) {
      C[name] = base;
      C[name + 'S'] = mix(base, INK, lum(base) > 0.85 ? 0.16 : 0.24);
      C[name + 'H'] = mix(base, WHITE, 0.3);
    }
    tone('fur', fur);
    tone('pat', pat);
    tone('mix', mix(fur, pat, 0.5));
    tone('white', [252, 248, 240]);
    tone('orange', [238, 146, 70]);
    tone('belly', mix(fur, [255, 249, 238], 0.55));
    C.outline = mix(fur, INK, lum(fur) < 0.3 ? 0.65 : 0.76);
    if (lum(fur) < 0.3) C.outline = mix(INK, [0, 0, 0], 0.35);
    C.ear = mix([247, 168, 188], fur, 0.12);
    C.nose = [236, 112, 146];
    C.mouth = mix(C.outline, INK, 0.3);
    C.tongue = [255, 132, 160];
    C.blush = [255, 120, 155];
    C.K = mix(eye, INK, 0.72);
    C.E = eye;
    C.L = mix(eye, WHITE, 0.4);
    C.W = WHITE;
    C.A = acc;
    C.AK = mix(acc, INK, lum(acc) > 0.85 ? 0.2 : 0.3);
    C.AB = mix(acc, WHITE, 0.4);
    C.AO = mix(acc, INK, lum(acc) > 0.85 ? 0.6 : 0.72);
    C.gold = [255, 209, 102];
    C.goldS = [232, 160, 52];
    C.goldO = [120, 70, 30];
    C.yellow = [255, 221, 87];
    colorCache[key] = C;
    return C;
  }

  /* ------------------------------------------------------------------ */
  /* Patrones (máscaras por región, en coordenadas locales de cada pieza) */
  /* ------------------------------------------------------------------ */
  function inCircle(x, y, cx, cy, r2) { var dx = x - cx, dy = y - cy; return dx * dx + dy * dy <= r2; }

  var TABBY_HEAD = { '7,1': 1, '7,2': 1, '9,0': 1, '9,1': 1, '10,0': 1, '10,1': 1, '12,1': 1, '12,2': 1,
    '0,5': 1, '1,5': 1, '0,7': 1, '1,7': 1, '19,5': 1, '18,5': 1, '19,7': 1, '18,7': 1 };

  var ROSETTES = {
    head: [[2.5, 2.5], [16.5, 2], [1, 9.5], [18.5, 9.5], [9.5, 0.5]],
    body: [[1.5, 4], [13.5, 4], [3, 8.5], [12, 8.5], [7.5, 0.5]]
  };
  var PATTERNS = {
    solid: function () { return null; },
    rosettes: function (reg, x, y, c) {
      if (c === 'w') return null;
      var list = ROSETTES[reg];
      if (list) {
        for (var i = 0; i < list.length; i++) {
          var dx = x - list[i][0], dy = y - list[i][1], d = dx * dx + dy * dy;
          if (d < 0.6) return 'mix';
          if (d < 2.6 && !((Math.round(x) + Math.round(y)) % 4 === 0 && d > 1.8)) return 'pat';
        }
        return null;
      }
      if (reg === 'tail') return (x > 0.12 && Math.floor(x * 8) % 2 === 1) ? 'pat' : null;
      if (reg === 'earL' || reg === 'earR') return null;
      return null;
    },
    tabby: function (reg, x, y, c) {
      if (c === 'w') return null;
      if (reg === 'head') return TABBY_HEAD[x + ',' + y] ? 'pat' : null;
      if (reg === 'body') {
        if ((y === 3 || y === 6 || y === 9) && (x <= 2 || x >= 13)) return 'pat';
        if (y === 4 && (x === 3 || x === 12)) return 'pat';
        if (y === 7 && (x === 3 || x === 12)) return 'pat';
        return null;
      }
      if (reg === 'tail') return (x > 0.12 && Math.floor(x * 9) % 2 === 1) ? 'pat' : null;
      return null;
    },
    spots: function (reg, x, y, c) {
      if (c === 'w') return null;
      if (reg === 'head') return (inCircle(x, y, 15, 1.5, 9) || inCircle(x, y, 2.5, 10, 2.3)) ? 'pat' : null;
      if (reg === 'earR') return 'pat';
      if (reg === 'body') return (inCircle(x, y, 2, 5, 4.5) || inCircle(x, y, 13.5, 8.5, 3.5) || inCircle(x, y, 12, 1, 2)) ? 'pat' : null;
      if (reg === 'tail') return x > 0.68 ? 'pat' : null;
      if (reg === 'footR') return 'pat';
      return null;
    },
    tuxedo: function (reg, x, y, c) {
      if (c === 'w') return 'pat';
      if (reg === 'pawL' || reg === 'pawR' || reg === 'footL' || reg === 'footR') return 'pat';
      if (reg === 'head') {
        if ((x === 9 || x === 10) && y >= 3 && y <= 8) return 'pat';
        if (y >= 9 && x >= 6 && x <= 13) return 'pat';
      }
      if (reg === 'tail') return x > 0.86 ? 'pat' : null;
      return null;
    },
    calico: function (reg, x, y, c) {
      if (c === 'w') return 'white';
      if (reg === 'pawL' || reg === 'pawR' || reg === 'footL' || reg === 'footR') return 'white';
      if (reg === 'earL') return 'pat';
      if (reg === 'earR') return 'orange';
      if (reg === 'head') {
        if (inCircle(x, y, 2.5, 2.5, 10)) return 'pat';
        if (inCircle(x, y, 16.5, 3, 9)) return 'orange';
        if (inCircle(x, y, 17, 9, 3)) return 'pat';
        return null;
      }
      if (reg === 'body') {
        if (inCircle(x, y, 1.5, 4.5, 7)) return 'orange';
        if (inCircle(x, y, 14, 6.5, 6)) return 'pat';
        if (inCircle(x, y, 3, 10, 2)) return 'pat';
        return null;
      }
      if (reg === 'tail') return x < 0.4 ? 'orange' : (x > 0.62 ? 'pat' : null);
      return null;
    },
    siamese: function (reg, x, y, c) {
      if (reg === 'earL' || reg === 'earR') return 'pat';
      if (reg === 'pawL' || reg === 'pawR' || reg === 'footL' || reg === 'footR') return 'pat';
      if (reg === 'head') {
        var dx = (x - 9.5) / 4.4, dy = (y - 8.8) / 3.6, d = dx * dx + dy * dy;
        if (c === 'w') return d < 0.5 ? 'mix' : null;
        if (d < 1.05) return 'mix';
        if (y <= 1 && x >= 7 && x <= 12) return 'mix';
        return null;
      }
      if (reg === 'tail') return x > 0.55 ? 'pat' : (x > 0.32 ? 'mix' : null);
      return null;
    }
  };

  /* ------------------------------------------------------------------ */
  /* Estado de animación por cuadro                                       */
  /* ------------------------------------------------------------------ */
  function frameState(anim, t, seed) {
    var s = {
      dy: 0, hdx: 0, hdy: 0, ears: 'up', eyes: 'open', mouth: 'smile',
      sway: 0, tail: 'up', pawL: 0, pawR: 0, footL: 0, footR: 0,
      fx: [], shadow: 0, blush: 1
    };
    var bt;
    if (anim === 'idle') {
      s.hdy = Math.floor(t / 750) % 2;
      s.sway = Math.round(Math.sin(t / 520) * 2) / 2;
      bt = (t + seed * 997) % 4100;
      if ((bt > 3800 && bt < 3930) || (Math.floor((t + seed * 997) / 4100) % 3 === 1 && bt > 4000)) s.eyes = 'closed';
    } else if (anim === 'happy') {
      var b = Math.abs(Math.sin(t / 1500 * Math.PI * 3));
      s.dy = -Math.round(b * 2.4);
      s.shadow = s.dy;
      s.hdy = s.dy === 0 ? 1 : 0;
      s.eyes = 'happy';
      s.mouth = 'open';
      s.sway = Math.round(Math.sin(t / 110) * 2) / 2;
      s.blush = 1.4;
      for (var i = 0; i < 2; i++) {
        var ph = ((t + i * 520) % 1040) / 1040;
        s.fx.push({ k: 'heart', x: i ? 26 : 1, y: Math.round(14 - ph * 10), big: (Math.floor(t / 200) + i) % 2 === 0 });
      }
      if (Math.floor(t / 180) % 2 === 0) s.fx.push({ k: 'spark', x: 3, y: 2 });
      else s.fx.push({ k: 'spark', x: 27, y: 1 });
    } else if (anim === 'sad') {
      s.hdy = 1;
      s.ears = 'droop';
      s.eyes = 'sad';
      s.mouth = 'frown';
      s.tail = 'down';
      s.sway = Math.round(Math.sin(t / 900));
      s.blush = 0.5;
      var tp = Math.floor((t % 1000) / 160);
      if (tp < 5) s.fx.push({ k: 'tear', dx: 4, dy: 9 + tp });
    } else if (anim === 'sleep') {
      var br = Math.floor(t / 1300) % 2;
      s.hdy = 1 + br;
      s.eyes = 'sleep';
      s.mouth = 'sleep';
      s.sway = Math.round(Math.sin(t / 1600) * 2) / 2;
      s.tail = 'sleep';
      var zc = 2400;
      for (var z = 0; z < 2; z++) {
        var zp = ((t + z * zc / 2) % zc) / zc;
        s.fx.push({ k: 'z', big: z === 0, x: 22 + Math.round(zp * 4), y: Math.round(8 - zp * 8) });
      }
    } else if (anim === 'walk') {
      var st = Math.floor(t / 180) % 4;
      s.pawL = st === 0 ? 1 : 0;
      s.pawR = st === 2 ? 1 : 0;
      s.footL = st === 2 ? 1 : 0;
      s.footR = st === 0 ? 1 : 0;
      s.dy = (st === 1 || st === 3) ? 0 : -1;
      s.shadow = 0;
      s.hdy = (st === 1 || st === 3) ? 1 : 0;
      s.hdx = 0;
      s.sway = st < 2 ? 1 : -1;
    }
    return s;
  }

  function stateKey(s) {
    var k = [s.dy, s.hdx, s.hdy, s.ears, s.eyes, s.mouth, s.sway, s.tail, s.pawL, s.pawR, s.footL, s.footR, s.shadow].join('|');
    for (var i = 0; i < s.fx.length; i++) {
      var f = s.fx[i];
      k += '|' + f.k + f.x + ',' + f.y + (f.dx || '') + (f.dy || '') + (f.big ? 'b' : '');
    }
    return k;
  }

  /* ------------------------------------------------------------------ */
  /* Render de un cuadro → Uint8ClampedArray 32x32 RGBA                   */
  /* ------------------------------------------------------------------ */
  var HX = 6, HY = 7, BX = 8, BY = 18;

  /* ---------- Formas por raza (modificadores sobre los mapas base) ---------- */
  var EAR_SHAPES = {
    up: { rows: EAR_UP, x: 1, y: -5 },
    tall: { rows: ['f.....', 'ff....', 'fpf...', 'fppf..', 'fpppf.', 'fppppf', 'ffffff'], x: 1, y: -6 },
    small: { rows: ['f....', 'fpf..', 'fppf.', 'fffff'], x: 2, y: -3 },
    bat: { rows: ['f......', 'ff.....', 'fpf....', 'fppf...', 'fpppf..', 'fppppf.', 'fpppppf', 'fffffff'], x: -1, y: -7 },
    fold: { rows: ['.ffff.', 'ffdddf', 'ffffff'], x: 2, y: -2 },
    tuft: { rows: EAR_UP, x: 1, y: -5, tuft: true }
  };
  var BODY_BIG = [
    '.....ffffffff.....',
    '...ffffffffffff...',
    '..fffffwwwwfffff..',
    '.ffffwwwwwwwwffff.',
    '.fffwwwwwwwwwwfff.',
    'ffffwwwwwwwwwwffff',
    'ffffwwwwwwwwwwffff',
    'ffffwwwwwwwwwwffff',
    'ffffwwwwwwwwwwffff',
    'fffffwwwwwwwwfffff',
    '.ffffffffffffffff.',
    '..ffffffffffffff..'
  ];
  var RUFF = ['..wwwwwwww..', '.wwwwwwwwww.', 'w.ww.ww.ww.w'];

  function extraCells(list, ox, oy, region, c) {
    return list.map(function (p) { return { x: ox + p[0], y: oy + p[1], c: c || 'f', lx: p[0], ly: p[1], region: region }; });
  }
  function mirrorPts(pts) {
    var out = pts.slice();
    pts.forEach(function (p) { out.push([19 - p[0], p[1]]); });
    return out;
  }
  var HEAD_EXTRA = {
    round: mirrorPts([[-1, 5], [-1, 6], [-1, 7], [-1, 8], [-1, 9], [0, 10], [3, 0], [2, 1]]),
    chunky: mirrorPts([[-1, 4], [-1, 5], [-1, 6], [-1, 7], [-1, 8], [-1, 9], [-1, 10], [0, 10], [0, 11], [1, 11], [-2, 7], [-2, 8], [-2, 9]]),
    fluffy: mirrorPts([[-1, 5], [-1, 6], [-2, 6], [-1, 8], [-1, 9], [-2, 9], [0, 10], [0, 11], [1, 12], [3, 0], [2, 1]]).concat([[9, -1], [10, -1], [10, -2]]),
    cheeks: mirrorPts([[-1, 8], [-1, 9], [-2, 9], [-1, 10], [0, 11]])
  };
  var BODY_FLUFF = [[-1, 3], [-1, 4], [-1, 7], [-1, 8]];

  var BREED_SHAPES = {
    comun: {},
    naranja: {},
    siames: { ears: 'tall', tail: 'thin' },
    persa: { ears: 'small', head: 'fluffy', face: 'flat', tail: 'fluffy', fluff: true, ruff: true },
    mainecoon: { ears: 'tuft', head: 'cheeks', body: 'big', ruff: true, tail: 'bushy', fluff: true },
    sphynx: { ears: 'bat', tail: 'thin', wrinkles: true },
    scottish: { ears: 'fold', head: 'round' },
    bengala: { ears: 'tall', rosettes: true },
    ragdoll: { head: 'cheeks', tail: 'fluffy', ruff: true, fluff: true },
    british: { ears: 'small', head: 'chunky', body: 'big' },
    azulruso: { ears: 'tall', tail: 'thin' },
    angora: { ears: 'tall', head: 'cheeks', tail: 'fluffy', ruff: true },
    bombay: { ears: 'tall', tail: 'thin' }
  };
  var TAIL_R = { normal: [1.5, 0.35], thin: [1.15, 0.35], fluffy: [2.0, 0.5], bushy: [2.25, 0.5] };

  function renderCat(cat, s, flip) {
    var fb = newFB();
    var C = deriveColors(cat);
    var shape = BREED_SHAPES[cat.breed] || BREED_SHAPES.comun;
    var patFn = PATTERNS[cat.pattern] || PATTERNS.solid;
    if (shape.rosettes && cat.pattern === 'spots') patFn = PATTERNS.rosettes;
    var dy = s.dy;

    function furColor(cell, edge) {
      var c = cell.c;
      if (c === 'o') return C.outline;
      if (c === 'p') return edge ? mix(C.ear, INK, 0.12) : C.ear;
      var k = patFn(cell.region, cell.lx, cell.ly, c) || (c === 'w' ? 'belly' : 'fur');
      if (edge || c === 'd') return C[k + 'S'];
      if (c === 'h') return C[k + 'H'];
      return C[k];
    }

    // sombra en el suelo
    var shw = s.shadow < -1 ? 6 : 8;
    if (shape.body === 'big') shw += 1;
    for (var x = 16 - shw; x < 16 + shw; x++) blendPx(fb, x, 30, INK, 0.16);
    for (x = 16 - shw + 2; x < 16 + shw - 2; x++) blendPx(fb, x, 31, INK, 0.12);

    // cola (detrás)
    var tr = TAIL_R[shape.tail] || TAIL_R.normal;
    var tb = [22, 26 + dy], tk, tt;
    if (s.tail === 'down') { tk = [27, 30 + dy]; tt = [30, 28 + dy]; tb = [22, 27 + dy]; }
    else if (s.tail === 'sleep') { tk = [29, 29 + dy]; tt = [28 + s.sway, 22 + dy]; }
    else { tk = [29.5, 28.5 + dy]; tt = [27.6 + s.sway * 1.4, 18.5 + dy]; }
    if (tr[0] > 2) {
      tt[0] = Math.min(tt[0], 28); tk[0] = Math.min(tk[0], 28.5);
      if (s.tail === 'down') { tt[1] = Math.min(tt[1], 27 + dy); tk[1] = Math.min(tk[1], 28.5 + dy); }
    }
    stamp(fb, tailCells(tb, tk, tt, tr[0], tr[1]), furColor, C.outline);

    // cuerpo y patas
    var big = shape.body === 'big';
    var bx = big ? BX - 1 : BX;
    var footOff = big ? 1 : 0;
    stamp(fb, mapCells(FOOT, BX - 1 - footOff, BY + 9 + dy - s.footL, 'footL'), furColor, C.outline);
    stamp(fb, mapCells(FOOT, BX + 12 + footOff, BY + 9 + dy - s.footR, 'footR'), furColor, C.outline);
    var bodyCells = mapCells(big ? BODY_BIG : BODY, bx, BY + dy, 'body');
    if (big) bodyCells.forEach(function (c) { c.lx -= 1; });
    if (shape.fluff) {
      var bw = big ? 18 : 16;
      bodyCells = bodyCells.concat(extraCells(BODY_FLUFF, bx, BY + dy, 'body'));
      bodyCells = bodyCells.concat(extraCells(BODY_FLUFF.map(function (p) { return [bw - 1 - p[0], p[1]]; }), bx, BY + dy, 'body'));
    }
    stamp(fb, bodyCells, furColor, C.outline);
    stamp(fb, mapCells(PAW, BX + 3, BY + 9 + dy - s.pawL, 'pawL'), furColor, C.outline);
    stamp(fb, mapCells(PAW, BX + 9, BY + 9 + dy - s.pawR, 'pawR'), furColor, C.outline);

    // cabeza
    var hx = HX + s.hdx, hy = HY + s.hdy + dy;
    var acc = cat.accessory;

    var ear = EAR_SHAPES[shape.ears] || EAR_SHAPES.up;
    var droop = s.ears === 'droop';
    if (droop && (ear.rows === EAR_UP || shape.ears === 'tall')) {
      stamp(fb, mapCells(EAR_DROOP, hx - 1, hy - 3, 'earL'), furColor, C.outline);
      stamp(fb, mapCells(EAR_DROOP.map(rev), hx + 15, hy - 3, 'earR'), furColor, C.outline);
    } else {
      var ew = ear.rows[0].length;
      var exL = hx + ear.x, eyT = hy + ear.y + (droop ? (shape.ears === 'bat' ? 2 : 1) : 0);
      var exR = hx + 19 - ear.x - (ew - 1);
      if (droop && shape.ears === 'bat') { exL -= 1; exR += 1; }
      stamp(fb, mapCells(ear.rows, exL, eyT, 'earL'), furColor, C.outline);
      stamp(fb, mapCells(ear.rows.map(rev), exR, eyT, 'earR'), furColor, C.outline);
      if (ear.tuft && !droop) {
        var tc = mix(C.outline, C.pat, 0.2);
        setPx(fb, exL, eyT - 2, tc); setPx(fb, exL, eyT - 3, tc);
        setPx(fb, exR + ew - 1, eyT - 2, tc); setPx(fb, exR + ew - 1, eyT - 3, tc);
      }
    }
    var headCells = mapCells(HEAD, hx, hy, 'head');
    if (shape.head && HEAD_EXTRA[shape.head]) headCells = headCells.concat(extraCells(HEAD_EXTRA[shape.head], hx, hy, 'head'));
    stamp(fb, headCells, furColor, C.outline);

    if (shape.wrinkles) {
      var wc = mix(C.furS, C.fur, 0.3);
      [[8, 1], [9, 1], [10, 1], [11, 1], [7, 3], [8, 3], [11, 3], [12, 3]].forEach(function (p) { setPx(fb, hx + p[0], hy + p[1], wc); });
    }

    if (shape.ruff) {
      var rc = mapCells(RUFF, hx + 4, hy + 12, 'ruff');
      stamp(fb, rc, function (cell) {
        var k = patFn('ruff', cell.lx, cell.ly, 'w') || 'belly';
        return cell.ly === 2 ? C[k + 'S'] : (cell.ly === 0 ? C[k + 'H'] : C[k]);
      }, null);
    }

    drawFace(fb, hx, hy, s, C, shape);

    // accesorios
    if (acc && acc !== 'none') drawAccessory(fb, acc, hx, hy, C, s, shape);

    // efectos
    for (var i = 0; i < s.fx.length; i++) drawFx(fb, s.fx[i], hx, hy, C);

    if (flip) flipFB(fb);
    return fb;
  }

  function rev(r) { return r.split('').reverse().join(''); }

  function flipFB(fb) {
    for (var y = 0; y < W; y++) {
      for (var x = 0; x < W / 2; x++) {
        var a = (y * W + x) * 4, b = (y * W + (W - 1 - x)) * 4;
        for (var k = 0; k < 4; k++) { var t = fb[a + k]; fb[a + k] = fb[b + k]; fb[b + k] = t; }
      }
    }
  }

  function drawMap(fb, rows, ox, oy, colors) {
    for (var y = 0; y < rows.length; y++) {
      for (var x = 0; x < rows[y].length; x++) {
        var ch = rows[y][x];
        if (ch !== '.' && colors[ch]) setPx(fb, ox + x, oy + y, colors[ch]);
      }
    }
  }

  function drawFace(fb, hx, hy, s, C, shape) {
    var flat = shape && shape.face === 'flat';
    var eyeMap = EYES[s.eyes] || EYES.open;
    var ec = { K: C.K, W: C.W, E: C.E, L: C.L };
    if (s.eyes === 'happy' || s.eyes === 'closed' || s.eyes === 'sleep') ec = { K: C.mouth };
    drawMap(fb, eyeMap, hx + 4, hy + 5, ec);
    drawMap(fb, eyeMap, hx + 13, hy + 5, ec);
    if (s.eyes === 'sad') {
      // cejitas preocupadas
      setPx(fb, hx + 5, hy + 4, C.mouth); setPx(fb, hx + 6, hy + 3, C.mouth);
      setPx(fb, hx + 14, hy + 4, C.mouth); setPx(fb, hx + 13, hy + 3, C.mouth);
    }
    // chapitas
    var ba = Math.min(0.85, 0.5 * s.blush);
    blendPx(fb, hx + 2, hy + 9, C.blush, ba); blendPx(fb, hx + 3, hy + 9, C.blush, ba);
    blendPx(fb, hx + 16, hy + 9, C.blush, ba); blendPx(fb, hx + 17, hy + 9, C.blush, ba);
    if (s.blush > 1) {
      blendPx(fb, hx + 2, hy + 10, C.blush, 0.3); blendPx(fb, hx + 17, hy + 10, C.blush, 0.3);
    }
    // naricita
    if (flat) {
      setPx(fb, hx + 9, hy + 7, C.nose); setPx(fb, hx + 10, hy + 7, C.nose);
      hy -= 1;
    } else {
      setPx(fb, hx + 9, hy + 8, C.nose); setPx(fb, hx + 10, hy + 8, C.nose);
    }
    // boca
    var m = C.mouth;
    if (s.mouth === 'open') {
      setPx(fb, hx + 8, hy + 9, m); setPx(fb, hx + 11, hy + 9, m);
      setPx(fb, hx + 9, hy + 9, [120, 40, 60]); setPx(fb, hx + 10, hy + 9, [120, 40, 60]);
      setPx(fb, hx + 9, hy + 10, C.tongue); setPx(fb, hx + 10, hy + 10, C.tongue);
    } else if (s.mouth === 'frown') {
      setPx(fb, hx + 9, hy + 10, m); setPx(fb, hx + 10, hy + 10, m);
      setPx(fb, hx + 8, hy + 11, m); setPx(fb, hx + 11, hy + 11, m);
    } else {
      setPx(fb, hx + 8, hy + 9, m); setPx(fb, hx + 9, hy + 10, m);
      setPx(fb, hx + 10, hy + 10, m); setPx(fb, hx + 11, hy + 9, m);
    }
  }

  function drawAccessory(fb, acc, hx, hy, C, s) {
    if (acc === 'glasses') {
      var f = C.AO, g = mix(C.A, INK, 0.15);
      [3, 12].forEach(function (ex) {
        for (var i = 1; i <= 3; i++) { setPx(fb, hx + ex + i, hy + 4, g); setPx(fb, hx + ex + i, hy + 9, g); }
        for (var j = 5; j <= 8; j++) { setPx(fb, hx + ex, hy + j, g); setPx(fb, hx + ex + 4, hy + j, g); }
        // brillo de lente
        blendPx(fb, hx + ex + 3, hy + 8, WHITE, 0.55);
      });
      setPx(fb, hx + 8, hy + 6, g); setPx(fb, hx + 9, hy + 5, g); setPx(fb, hx + 10, hy + 5, g); setPx(fb, hx + 11, hy + 6, g);
      setPx(fb, hx + 2, hy + 5, g); setPx(fb, hx + 17, hy + 5, g);
      setPx(fb, hx + 1, hy + 5, f); setPx(fb, hx + 18, hy + 5, f);
      return;
    }
    var a = ACC[acc];
    if (!a) return;
    var ox = hx + a.x, oy = hy + a.y;
    if (acc === 'scarf') oy = hy + a.y + 1 - s.hdy; // la bufanda se queda en el cuello
    var outline = acc === 'crown' ? C.goldO : C.AO;
    var cmap = {
      A: C.A, B: C.AB, K: C.AK, J: C.A, P: C.A,
      Y: acc === 'flower' ? C.yellow : [255, 250, 235],
      G: C.gold
    };
    var cells = mapCells(a.rows, ox, oy, 'acc');
    stamp(fb, cells, function (cell, edge) {
      var col = cmap[cell.c];
      if (!col) return null;
      if (cell.c === 'G') return edge ? C.goldS : C.gold;
      if (cell.c === 'J') return C.A;
      if (cell.c === 'A' || cell.c === 'P') return edge ? C.AK : C.A;
      return col;
    }, outline);
    if (acc === 'crown') { setPx(fb, ox + 1, oy + 1, [255, 244, 200]); }
    if (acc === 'bow') { setPx(fb, ox + 2, oy + 1, C.AK); }
  }

  var FX = {
    heart: { c: { H: [255, 92, 138], L: [255, 200, 214] }, o: [150, 30, 70] },
    spark: { c: { S: [255, 214, 90], W: [255, 255, 240] }, o: null },
    z: { c: { Z: [190, 220, 255] }, o: [61, 72, 128] }
  };

  function drawFx(fb, f, hx, hy, C) {
    if (f.k === 'heart') {
      var cells = mapCells(f.big ? HEART : HEART_S, f.x, f.y, 'fx');
      stamp(fb, cells, function (cell) { return FX.heart.c[cell.c]; }, FX.heart.o);
    } else if (f.k === 'spark') {
      drawMap(fb, SPARK, f.x, f.y, FX.spark.c);
    } else if (f.k === 'z') {
      var zm = f.big ? ZBIG : ZSMALL;
      drawMap(fb, zm, f.x + 1, f.y + 1, { Z: FX.z.o });
      drawMap(fb, zm, f.x, f.y, FX.z.c);
    } else if (f.k === 'tear') {
      setPx(fb, hx + f.dx, hy + f.dy, [120, 200, 255]);
      setPx(fb, hx + f.dx, hy + f.dy + 1, [70, 150, 235]);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Salida a canvas                                                      */
  /* ------------------------------------------------------------------ */
  var scratch = null;
  function getScratch(n) {
    if (typeof document === 'undefined') return null;
    if (!scratch) scratch = {};
    if (!scratch[n]) {
      var c = document.createElement('canvas');
      c.width = n; c.height = n;
      scratch[n] = c;
    }
    return scratch[n];
  }

  function blit(canvas, fb, n, scale) {
    var sc = getScratch(n);
    if (!sc) return;
    var sctx = sc.getContext('2d');
    var img = sctx.createImageData(n, n);
    img.data.set(fb);
    sctx.putImageData(img, 0, 0);
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sc, 0, 0, n * scale, n * scale);
  }

  function prepCanvas(canvas, n, scale) {
    var w = n * scale;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== w) canvas.height = w;
    if (canvas.style) canvas.style.imageRendering = 'pixelated';
  }

  function cleanScale(s, d) {
    s = Math.round(Number(s));
    return isFinite(s) && s > 0 ? Math.min(s, 64) : d;
  }

  /* ------------------------------------------------------------------ */
  /* Bucle de animación compartido                                        */
  /* ------------------------------------------------------------------ */
  var active = [];
  var rafId = 0;
  var raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame :
    function (cb) { return setTimeout(function () { cb(Date.now()); }, 33); };
  var caf = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout;
  function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  function loop(ts) {
    rafId = 0;
    var list = active.slice();
    for (var i = 0; i < list.length; i++) {
      try { list[i]._tick(ts); } catch (e) { if (typeof console !== 'undefined') console.error('[CatArt]', e); list[i].destroy(); }
    }
    if (active.length) rafId = raf(loop);
  }
  function addActive(c) {
    if (active.indexOf(c) < 0) active.push(c);
    if (!rafId) rafId = raf(loop);
  }
  function removeActive(c) {
    var i = active.indexOf(c);
    if (i >= 0) active.splice(i, 1);
    if (!active.length && rafId) { caf(rafId); rafId = 0; }
  }

  var seedCounter = 0;

  function mount(canvas, cat, opts) {
    opts = opts || {};
    var scale = cleanScale(opts.scale, 4);
    var flip = !!opts.flip;
    var current = normalizeCat(cat);
    var anim = ANIMS.indexOf(opts.anim) >= 0 ? opts.anim : 'idle';
    var baseAnim = (anim === 'happy' || anim === 'sad') ? 'idle' : anim;
    var start = now();
    var lastKey = '';
    var seed = (seedCounter++ * 7 + 3) % 11;
    var mountedAt = start;
    var everConnected = false;
    var detachedSince = null;
    var alive = true;
    var hasCanvas = canvas && typeof canvas.getContext === 'function';

    if (hasCanvas) prepCanvas(canvas, W, scale);

    function draw(t, force) {
      if (!hasCanvas) return;
      var s = frameState(anim, t, seed);
      var key = stateKey(s);
      if (!force && key === lastKey) return;
      lastKey = key;
      blit(canvas, renderCat(current, s, flip), W, scale);
    }

    var ctrl = {
      _tick: function (ts) {
        if (!alive) return;
        var connected = !!canvas.isConnected;
        var tnow = now();
        if (!connected) {
          if (everConnected) {
            if (detachedSince === null) detachedSince = tnow;
            if (tnow - detachedSince > 5000) ctrl._sleep();
          } else if (tnow - mountedAt > 30000) {
            ctrl._sleep();
          }
          return;
        }
        everConnected = true;
        detachedSince = null;
        var t = tnow - start;
        if ((anim === 'happy' || anim === 'sad') && t > 1500) {
          anim = baseAnim;
          start = tnow;
          t = 0;
        }
        draw(t, false);
      },
      _sleep: function () { removeActive(ctrl); },
      setCat: function (c) {
        current = normalizeCat(c);
        draw(now() - start, true);
        if (alive) addActive(ctrl);
        return ctrl;
      },
      play: function (a) {
        if (ANIMS.indexOf(a) < 0) a = 'idle';
        if (a !== 'happy' && a !== 'sad') baseAnim = a;
        anim = a;
        start = now();
        mountedAt = start;
        detachedSince = null;
        draw(0, true);
        if (alive) addActive(ctrl);
        return ctrl;
      },
      destroy: function () {
        alive = false;
        removeActive(ctrl);
      }
    };

    draw(0, true);
    if (hasCanvas) addActive(ctrl);
    return ctrl;
  }

  /* ------------------------------------------------------------------ */
  /* PNG estático                                                         */
  /* ------------------------------------------------------------------ */
  var urlCache = {};
  var urlCacheKeys = [];
  function toDataURL(cat, scale) {
    scale = cleanScale(scale, 4);
    var c = normalizeCat(cat);
    var key = JSON.stringify(c) + '@' + scale;
    if (urlCache[key]) return urlCache[key];
    if (typeof document === 'undefined') return '';
    var canvas = document.createElement('canvas');
    prepCanvas(canvas, W, scale);
    blit(canvas, renderCat(c, frameState('idle', 1000, 0), false), W, scale);
    var url = canvas.toDataURL('image/png');
    urlCache[key] = url;
    urlCacheKeys.push(key);
    if (urlCacheKeys.length > 200) delete urlCache[urlCacheKeys.shift()];
    return url;
  }

  /* ------------------------------------------------------------------ */
  /* Íconos decorativos 16x16                                             */
  /* ------------------------------------------------------------------ */
  var IW = 16;

  function iconFromFn(fn, outline) {
    // fn(x, y) → color [r,g,b] o null
    var cells = [];
    for (var y = 0; y < IW; y++) for (var x = 0; x < IW; x++) {
      var col = fn(x, y);
      if (col) cells.push({ x: x, y: y, c: 'x', col: col });
    }
    var fb = newFB(IW);
    stamp(fb, cells, function (cell) { return cell.col; }, outline, IW);
    return fb;
  }

  function renderIcon(fb, canvas, scale) {
    scale = cleanScale(scale, 4);
    if (!canvas || typeof canvas.getContext !== 'function') return canvas;
    prepCanvas(canvas, IW, scale);
    blit(canvas, fb, IW, scale);
    return canvas;
  }

  var ICONS = {
    yarn: function () {
      var base = [255, 143, 171], dark = [214, 86, 128], light = [255, 205, 218];
      return iconFromFn(function (x, y) {
        var dx = x + 0.5 - 7.5, dy = y + 0.5 - 7, d = dx * dx + dy * dy;
        if (d <= 30) {
          if (d < 30 && (dx + dy * 0.5) < -3.5 && d > 14 && d < 22) return light;
          var band = ((x * 2 + y * 3) % 7 + 7) % 7;
          if (band === 0) return dark;
          var band2 = ((x * 3 - y * 2) % 9 + 9) % 9;
          if (band2 === 0 && dx > -2) return dark;
          if (dx > 3 || dy > 3.5) return mix(base, dark, 0.5);
          return base;
        }
        // hebra suelta
        if ((y === 12 && x >= 12 && x <= 13) || (y === 13 && x === 14) || (y === 14 && x >= 12 && x <= 13) || (y === 13 && x === 11)) return base;
        return null;
      }, [130, 40, 80]);
    },
    fish: function () {
      var body = [142, 202, 230], belly = [210, 240, 252], dark = [76, 140, 190];
      var fb = iconFromFn(function (x, y) {
        var dx = (x + 0.5 - 6.5) / 5.4, dy = (y + 0.5 - 8) / 3.4;
        if (dx * dx + dy * dy <= 1) {
          if (y >= 9) return belly;
          if (x >= 6 && x <= 7 && y >= 6 && y <= 8) return dark;
          return body;
        }
        // cola
        var tx = x - 11;
        if (tx >= 0 && tx <= 3) {
          var half = tx * 0.9 + 0.6;
          if (Math.abs(y + 0.5 - 8) <= half && !(tx === 0 && Math.abs(y + 0.5 - 8) > 1)) return tx === 3 ? dark : body;
        }
        return null;
      }, [40, 70, 120]);
      setPx(fb, 3, 7, [40, 40, 60], IW);
      setPx(fb, 3, 6, [255, 255, 255], IW);
      setPx(fb, 4, 6, [40, 40, 60], IW);
      setPx(fb, 4, 7, [40, 40, 60], IW);
      return fb;
    },
    heart: function () {
      return iconFromFn(function (x, y) {
        var X = (x + 0.5 - 8) / 6.2, Y = -(y + 0.5 - 7.2) / 6.2;
        var a = X * X + Y * Y - 1;
        if (a * a * a - X * X * Y * Y * Y <= 0) {
          if ((x === 4 || x === 5) && (y === 4 || y === 5) && !(x === 5 && y === 5)) return [255, 210, 222];
          if (x === 4 && y === 6) return [255, 170, 195];
          if (Y < -0.55 || X > 0.75) return [228, 60, 110];
          return [255, 92, 138];
        }
        return null;
      }, [130, 24, 64]);
    },
    paw: function () {
      var pad = [255, 143, 171], fur = [255, 246, 236], sh = [240, 222, 208];
      var fb = iconFromFn(function (x, y) {
        function ell(cx, cy, rx, ry) { var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; return dx * dx + dy * dy <= 1; }
        if (ell(8, 10.5, 4.3, 3.6)) return y > 12 ? sh : fur;
        if (ell(3.3, 6.2, 1.7, 2.1) || ell(6.4, 3.6, 1.7, 2.1) || ell(9.6, 3.6, 1.7, 2.1) || ell(12.7, 6.2, 1.7, 2.1)) return fur;
        return null;
      }, [110, 60, 70]);
      // almohadillas rosas
      var beans = [[3, 6], [6, 3], [9, 3], [12, 6], [3, 5], [6, 4], [9, 4], [12, 5]];
      beans.forEach(function (b) { setPx(fb, b[0], b[1], pad, IW); });
      for (var x = 6; x <= 9; x++) for (var y = 10; y <= 12; y++) setPx(fb, x, y, pad, IW);
      setPx(fb, 7, 9, pad, IW); setPx(fb, 8, 9, pad, IW);
      setPx(fb, 6, 10, [255, 200, 214], IW);
      return fb;
    },
    star: function () {
      return iconFromFn(function (x, y) {
        var px = x + 0.5 - 8, py = y + 0.5 - 8.3;
        var ang = Math.atan2(py, px), r = Math.sqrt(px * px + py * py);
        var k = Math.cos(5 * (ang + Math.PI / 2)) * 0.5 + 0.5;
        var R = 3.2 + 3.8 * Math.pow(k, 2.2);
        if (r <= R) return (px > 1.2 && py > 0.5) ? [240, 170, 40] : (r < 2 && px < 0 && py < 0 ? [255, 246, 200] : [255, 209, 72]);
        return null;
      }, [130, 80, 20]);
    },
    fishbone: function () {
      var bone = [240, 236, 228], sh = [200, 194, 190];
      return iconFromFn(function (x, y) {
        // cabeza
        var dx = (x + 0.5 - 3.5) / 2.6, dy = (y + 0.5 - 8) / 2.6;
        if (dx * dx + dy * dy <= 1) return (x === 3 && y === 7) ? [70, 60, 80] : bone;
        if (y === 8 && x >= 5 && x <= 12) return bone;
        if ((x === 7 || x === 9 || x === 11) && y >= 5 && y <= 11 && y !== 8) return sh;
        if (x >= 13 && x <= 14 && Math.abs(y + 0.5 - 8) <= (x - 12) * 1.4) return bone;
        return null;
      }, [100, 90, 110]);
    }
  };

  var decor = {};
  Object.keys(ICONS).forEach(function (name) {
    decor[name] = function (canvas, scale) { return renderIcon(ICONS[name](), canvas, scale); };
  });

  function decorDataURL(name, scale) {
    if (!ICONS[name] || typeof document === 'undefined') return '';
    var c = document.createElement('canvas');
    renderIcon(ICONS[name](), c, scale);
    return c.toDataURL('image/png');
  }

  /* ------------------------------------------------------------------ */
  /* Export                                                               */
  /* ------------------------------------------------------------------ */
  var CatArt = {
    OPTIONS: OPTIONS,
    ANIMS: ANIMS.slice(),
    randomCat: randomCat,
    defaultCat: defaultCat,
    normalizeCat: normalizeCat,
    breedPreset: function (id) { var p = breedPreset(id); return { fur: p.fur, pattern: p.pattern, patternColor: p.patternColor, eyes: p.eyes }; },
    randomName: function () { return pick(NAMES); },
    NAMES: NAMES.slice(),
    mount: mount,
    toDataURL: toDataURL,
    decor: decor,
    decorDataURL: decorDataURL,
    drawYarn: decor.yarn,
    drawFish: decor.fish,
    drawHeart: decor.heart,
    drawPaw: decor.paw,
    drawStar: decor.star,
    drawFishbone: decor.fishbone,
    // interno (útil para pruebas)
    _EYES: EYES,
    _renderFrame: function (cat, anim, t, flip) { return renderCat(normalizeCat(cat), frameState(anim || 'idle', t || 0, 0), !!flip); }
  };

  if (typeof window !== 'undefined') window.CatArt = CatArt;
  if (typeof module !== 'undefined' && module.exports) module.exports = CatArt;
})();
