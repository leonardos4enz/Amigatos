'use strict';
// El volteo del sprite (docs/mundo.md §3): `CatArt.mount(...).setFlip(true)`
// voltea el gato en caliente, y el resto de la API (mount, play, setCat,
// destroy, toDataURL) sigue igual.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const W = 32;

// DOM mínimo: un canvas falso que guarda el framebuffer de cada cuadro y un
// reloj congelado, para que todos los cuadros sean el mismo y se puedan
// comparar píxel a píxel.
function montarDom() {
  const cuadros = [];
  const ctx = {
    imageSmoothingEnabled: false,
    clearRect() {},
    drawImage() {},
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData(img) { cuadros.push(new Uint8ClampedArray(img.data)); }
  };
  const crearCanvas = () => ({
    width: 0,
    height: 0,
    style: {},
    getContext: () => ctx,
    toDataURL: () => 'data:image/png;base64,stub'
  });
  globalThis.document = { createElement: crearCanvas };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  globalThis.performance.now = () => 1000;
  return { cuadros, canvas: crearCanvas() };
}

// ¿Son los dos framebuffers el uno el espejo del otro?
function distintaDelEspejo(a, b) {
  let distintos = 0;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 4;
      const q = (y * W + (W - 1 - x)) * 4;
      if (a[p] !== b[q] || a[p + 1] !== b[q + 1] || a[p + 2] !== b[q + 2] || a[p + 3] !== b[q + 3]) distintos++;
    }
  }
  return distintos;
}

// ¿Cuántos píxeles cambian entre los dos framebuffers?
function distintos(a, b) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

test('setFlip voltea el sprite en caliente', () => {
  const { cuadros, canvas } = montarDom();
  const CatArt = require('../public/js/cat-art.js');
  const cat = CatArt.defaultCat();

  const ctrl = CatArt.mount(canvas, cat, { scale: 1, anim: 'walk' });
  assert.equal(typeof ctrl.setFlip, 'function', 'el controlador debe tener setFlip');
  const normal = cuadros[cuadros.length - 1];

  ctrl.setFlip(true);
  const volteado = cuadros[cuadros.length - 1];

  assert.ok(distintos(normal, volteado) > 0, 'el sprite tiene que cambiar al voltearlo');
  assert.equal(distintaDelEspejo(volteado, normal), 0, 'el sprite volteado es el espejo del normal');

  // Y volver a voltear deshace el cambio.
  ctrl.setFlip(false);
  assert.equal(distintos(cuadros[cuadros.length - 1], normal), 0, 'volver a false deja el sprite como estaba');

  ctrl.destroy();
});

test('la API de CatArt sigue igual', () => {
  const { canvas } = montarDom();
  const CatArt = require('../public/js/cat-art.js');
  const cat = CatArt.defaultCat();

  const ctrl = CatArt.mount(canvas, cat, { scale: 1 });
  assert.equal(ctrl.play('walk'), ctrl, 'play devuelve el controlador');
  assert.equal(ctrl.setCat({ name: 'Nube', breed: 'comun' }), ctrl, 'setCat devuelve el controlador');
  assert.equal(ctrl.setFlip(false), ctrl, 'setFlip devuelve el controlador');
  ctrl.destroy();
  assert.match(CatArt.toDataURL(cat, 2), /^data:image\/png/, 'toDataURL sigue igual');
});
