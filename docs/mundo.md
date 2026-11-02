# Diseño del mundo de Amigatos

Documento de diseño para los agentes. Describe **cómo se debe sentir** el mundo: moverse, orientarse e ir de un
lugar a otro. Es del género "mundo virtual social" (salas 2D, avatares que caminan, mapa para viajar), pero
Amigatos es **original**: lugares, nombres, mapa, personajes y arte propios. No copies nada de otros juegos.

Cada regla trae su forma de verificarla **sin ver la pantalla**, a través de `window.__amigatos` o del DOM.

## Lo que falló en la fase 1 (por qué existe este documento)

Al probarlo, Leo encontró que:
- el mapa se ve chico y borroso (salas de 96×72 píxeles estiradas a toda la pantalla);
- el gato es enorme comparado con la sala;
- el gato se desliza sin animación de caminar, y el movimiento se siente falso;
- se puede caminar por el cielo: toda la sala es caminable;
- no hay señales de a dónde ir: las salidas son zonas invisibles en los bordes.

## 1. Escala y resolución

- **Resolución lógica de cada sala: 320×200** (proporción 16:10). Los fondos se redibujan a esa resolución,
  con más detalle y una lectura clara: horizonte, construcciones y un piso caminable que se distinga a simple vista.
- El escenario ocupa el ancho disponible (hasta unos 960 px de CSS), siempre con escala **entera** y
  `image-rendering: pixelated`, para que el pixel art se vea nítido.
- **Gato: unos 30 px lógicos de alto**, alrededor del 15 % del alto de la sala. La sala tiene que sentirse amplia.
- Opcional, para dar profundidad: escalar el gato entre 0.85 (fondo del piso) y 1.0 (frente).
- Verificación: `__amigatos.roomWidth === 320`, `roomHeight === 200`, y `__amigatos.catHeight` entre 26 y 34.

## 2. Piso caminable

- Cada sala define **`walkable`**: una lista de polígonos en coordenadas lógicas. El cielo, las paredes, el agua,
  los mostradores, las fuentes y los muebles grandes **no son caminables**.
- Si alguien hace clic en una zona no caminable, el destino es **el punto caminable más cercano**. Lo calcula
  el servidor; el cliente puede predecirlo para que se sienta inmediato.
- Si la línea recta cruza una zona no caminable, se camina por una ruta que la rodea: por ejemplo, A* sobre una
  cuadrícula de celdas de 4 px. El servidor valida la ruta.
- Verificación: hacer clic en el cielo deja `__amigatos.me.target` dentro de un polígono de `room.walkable`.
  Tests de servidor con puntos dentro y fuera de cada polígono.

## 3. Caminar

- **Velocidad constante de unos 60 px lógicos por segundo**: cruzar la sala toma unos 5 segundos. Sin aceleración
  ni frenado.
- Mientras se mueve, el gato usa la animación **`walk`** que ya existe en `CatArt`. Al llegar vuelve a **`idle`**.
- **Orientación**: el gato mira hacia donde camina (izquierda o derecha, con el volteo de `CatArt`).
- **Profundidad**: gatos y objetos altos se ordenan por `y`. El que está más abajo se dibuja encima, así un gato
  puede pasar por detrás de una banca o un árbol.
- Los demás jugadores caminan igual: se interpola desde su posición actual hasta su destino a la misma velocidad.
  Nunca aparecen de golpe en el destino.
- Verificación: durante el trayecto `me.anim === 'walk'` y al llegar `'idle'`. `me.facing` cambia al invertir la
  dirección. El tiempo de llegada es más o menos distancia ÷ velocidad (±25 %). Lo mismo se cumple para
  `players[i]` vistos desde el otro navegador.

## 4. Puertas y señales

- Cada salida es **un objeto visible del fondo**: una puerta, un camino que sale del cuadro, un letrero con flecha
  o una escalera. Nada de zonas invisibles.
- Al pasar el mouse sobre una salida, el cursor cambia a `pointer`, la salida se resalta y aparece una etiqueta con
  el nombre del destino. Al hacer clic, el gato camina hasta la puerta y cruza.
- **Transición**: un fundido breve (unos 300 ms) al cambiar de sala. El gato aparece **frente a la puerta por la
  que llegó**, mirando hacia dentro de la sala.
- El nombre de la sala está siempre visible en un cartel en la parte superior.
- Las salidas de la lista de abajo del mapa (botones, issue #17) se mantienen como alternativa accesible.
- Verificación: cada salida tiene en el DOM un elemento con `data-exit="<destino>"`, una etiqueta de texto y
  `cursor: pointer`. Durante el cambio, `__amigatos.transition === true`, y al terminar vuelve a `false`.

## 5. Mapa del pueblo

- Un botón **"Mapa"** siempre visible en el mundo abre un mapa ilustrado del pueblo de Amigatos, también en pixel
  art procedural, con las **salas exteriores** marcadas.
- Al pasar el mouse por un lugar del mapa se ve su nombre. Al hacer clic, se viaja directo a esa sala (el servidor
  valida el destino). Las salas interiores, como el café, solo se alcanzan por sus puertas.
- **Más salas**: el mundo crece hasta al menos 6. Además de las 3 actuales, por ejemplo **Muelle de las Sardinas**,
  **Mercado del Cascabel** y **Colina del Faro**. Los agentes pueden proponer otras, siempre con nombres originales.
- Verificación: `#btn-world-map` abre el mapa y `__amigatos.mapOpen === true`. Cada lugar del mapa tiene
  `data-map-room="<id>"`. Al hacer clic, `__amigatos.room` cambia a ese id y el mapa se cierra.

## 6. Contrato de `window.__amigatos` (mínimo)

```js
{
  room, roomName, roomWidth: 320, roomHeight: 200, catHeight,
  walkable: [[{ x, y }, ...], ...],          // polígonos de la sala actual
  exits: [{ to, label, door: { x, y, w, h } }],
  me: { x, y, target: { x, y } | null, anim: 'idle' | 'walk', facing: 'left' | 'right' },
  players: [{ id, username, x, y, target, anim, facing }],
  mapOpen: false,
  transition: false,
}
```

## 7. Fuera de este documento (fases siguientes)

- Burbujas de chat y emotes (fase 2), economía y ropa (fase 3), casas (fase 4), minijuegos en el mapa (fase 5).
