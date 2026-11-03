/* Amigatos — las salidas de la sala como objetos visibles (window.WorldExits)
 *
 * Cada salida es un **objeto visible** del fondo, no una zona invisible
 * (docs/mundo.md §4). Por cada salida de la sala se crea un elemento del DOM
 * colocado encima del rectángulo de la puerta:
 *
 *   - `data-exit="<destino>"`: el id de la sala de destino;
 *   - la clase `world-exit-door` y, al pasar el mouse, `is-hover` (el resaltado);
 *   - dentro, la etiqueta `.world-exit-label` con el nombre del destino: empieza
 *     oculta (opacity 0 y visibility hidden) y se ve al pasar el mouse.
 *
 * El módulo no decide nada: al pulsar una puerta avisa con `onPick(exit)` y es
 * el motor del mundo (public/js/world.js) el que pide al servidor que el gato
 * camine hasta el umbral y cruce. El cambio de sala lo decide siempre el
 * servidor: el cliente no teletransporta al gato.
 */
(function () {
  'use strict';

  function num(v, def) {
    var n = Number(v);
    return isFinite(n) ? n : def;
  }

  // El resaltado: la puerta se marca con `is-hover` mientras el mouse está
  // encima (o cuando tiene el foco del teclado). Con ella se ve la etiqueta.
  function highlight(el) {
    function on() { el.classList.add('is-hover'); }
    function off() { el.classList.remove('is-hover'); }
    el.addEventListener('mouseenter', on);
    el.addEventListener('mouseleave', off);
    el.addEventListener('focus', on);
    el.addEventListener('blur', off);
  }

  // Una puerta: el elemento con su etiqueta y sus escuchas.
  function makeDoor(exit, room, onPick) {
    var w = num(room.width, 320) || 320;
    var h = num(room.height, 200) || 200;
    var x = num(exit.x, 0);
    var y = num(exit.y, 0);
    var dw = num(exit.w, 0);
    var dh = num(exit.h, 0);
    var name = exit.label || exit.to;

    var el = document.createElement('div');
    el.className = 'world-exit-door';
    el.setAttribute('data-exit', exit.to);
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', 'Ir a ' + name);

    var label = document.createElement('span');
    label.className = 'world-exit-label';
    label.textContent = name;
    el.appendChild(label);

    // La puerta va encima del rectángulo de la salida. Las coordenadas
    // lógicas se ponen en porcentajes: así encaja con cualquier escala entera.
    el.style.left = (x / w * 100) + '%';
    el.style.top = (y / h * 100) + '%';
    el.style.width = (dw / w * 100) + '%';
    el.style.height = (dh / h * 100) + '%';
    // La etiqueta se abre hacia dentro de la sala: en las salidas del borde
    // derecho, hacia la izquierda (y al revés en las de la izquierda).
    if (x + dw / 2 > w / 2) el.classList.add('is-right');

    function pick(ev) {
      // El clic no llega al escenario: el piso no se mueve por debajo de la puerta.
      if (ev) ev.stopPropagation();
      if (typeof onPick === 'function') onPick(exit);
    }

    el.addEventListener('click', pick);
    el.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      pick(ev);
    });

    highlight(el);
    return el;
  }

  // Pinta (o repinta) las puertas de la sala dentro de `container`.
  // Devuelve la lista de elementos creados.
  function render(container, room, onPick) {
    if (!container) return [];
    container.innerHTML = '';
    var exits = (room && Array.isArray(room.exits)) ? room.exits : [];
    var doors = [];
    for (var i = 0; i < exits.length; i++) {
      var exit = exits[i] || {};
      if (!exit.to) continue;
      var el = makeDoor(exit, room || {}, onPick);
      container.appendChild(el);
      doors.push(el);
    }
    return doors;
  }

  window.WorldExits = {
    render: render
  };
})();
