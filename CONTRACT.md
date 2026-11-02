# Amigatos — contrato compartido

Juego web para 2 amigas/os: cada quien crea su cuenta, diseña su gato pixel art y juega minijuegos
en tiempo real (Gato / tic-tac-toe y Ahorcado). Todo el texto de la UI en **español**.

## Stack
- Node 22, Express, Socket.IO 4, `pg`, `bcryptjs`, `jsonwebtoken`. CommonJS (`require`).
- Frontend: HTML/CSS/JS vanilla (sin build), servido estático desde `public/`.
  Socket.IO cliente desde `/socket.io/socket.io.js`. Fuente pixel: Google Fonts "Pixelify Sans" + "Press Start 2P".
- Si `DATABASE_URL` no existe, el server usa un almacenamiento **en memoria** (para pruebas locales).
- Env: `PORT` (3000), `DATABASE_URL`, `JWT_SECRET`, `PGSSL` ("true" para ssl).

## Estructura de archivos (dueños)
- Backend agent: `server/index.js`, `server/db.js`, `server/games/tictactoe.js`, `server/games/hangman.js`, `server/words.js`
- Cat art agent: `public/js/cat-art.js`, `public/js/cat-creator.js`, `public/cat-lab.html` (página de prueba)
- Frontend agent: `public/index.html`, `public/css/style.css`, `public/js/app.js`, `public/js/games-ui.js`
- Ya existen: `package.json`, `Dockerfile`, este contrato. No los modifiques (salvo el backend, que puede añadir deps a package.json si es imprescindible).

## Modelo de gato (`cat`)
```json
{
  "name": "Michi",
  "breed": "comun",         // "comun"|"carey"|"siames"|"persa"|"mainecoon"|"sphynx"|"scottish"|"bengala"|"ragdoll"|"british"|"azulruso"|"angora"|"bombay"|"naranja" (desconocida → "comun")
  "fur": "#f4a261",         // color base
  "pattern": "tabby",       // "solid" | "tabby" | "spots" | "tuxedo" | "calico" | "siamese" | "tortie"
  "patternColor": "#8d5524",
  "eyes": "#2a9d8f",
  "accessory": "bow",       // "none" | "bow" | "hat" | "scarf" | "crown" | "glasses" | "flower"
  "accessoryColor": "#e63946"
}
```
`user.cat` es `null` hasta que la persona crea su gato.

## Usuario (respuesta pública)
`{ id: number, username: string, cat: Cat|null, wins: number, losses: number, draws: number }`

## REST (JSON). Auth: header `Authorization: Bearer <token>`
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/api/register` | `{username, password}` | `{token, user}` (username 3–20 chars `[a-zA-Z0-9_]`, password ≥ 4) |
| POST | `/api/login` | `{username, password}` | `{token, user}` |
| GET | `/api/me` | — | `{user}` |
| PUT | `/api/cat` | `{cat}` | `{user}` (valida campos; hex `#rrggbb`, nombre 1–16 chars) |
| GET | `/api/leaderboard` | — | `{players: [{username, cat, wins, losses, draws}]}` |
Errores: status 4xx con `{error: "mensaje en español"}`.

## Socket.IO
Conexión: `io({ auth: { token } })`. Si el token es inválido, el server rechaza con `connect_error` mensaje `"auth"`.

### Server → cliente
- `presence` → `[{id, username, cat, status: "idle"|"playing"}]` (todos los conectados, se emite a todos en cada cambio)
- `invite:received` → `{inviteId, from: {id, username, cat}, game: "tictactoe"|"hangman"}`
- `invite:declined` → `{inviteId, by: {id, username}}`
- `game:state` → `GameState` (en cada cambio, a ambos jugadores; también al empezar)
- `game:over` → `{state: GameState}` (tras el último `game:state`; `state.winnerId` puede ser null = empate)
- `game:rematch` → `{gameId, requestedBy: userId}` (el rival pidió revancha)
- `chat:msg` → `{gameId, from: {id, username}, text, ts}`
- `error:msg` → `{message}`
- `user:updated` → `{user}` (tras terminar una partida, con estadísticas nuevas)

### Cliente → server
- `invite:send` `{toUserId, game}`
- `invite:respond` `{inviteId, accept: boolean}` → si acepta, ambos reciben `game:state`
- `game:move` `{gameId, move}`
- `game:rematch` `{gameId}` → cuando ambos la piden se crea partida nueva del mismo tipo (nuevo id) y se emite `game:state`
- `game:leave` `{gameId}` → la otra persona gana por abandono (también al desconectarse durante una partida)
- `chat:send` `{gameId, text}` (máx 200 chars)

### GameState
```json
{
  "id": "string",
  "type": "tictactoe" | "hangman",
  "players": [{ "id": 1, "username": "leo", "cat": {...} }, { ... }],
  "turn": 1,                 // userId al que le toca (null si terminó)
  "status": "playing" | "finished",
  "winnerId": null,          // userId o null
  "reason": null,            // al terminar: "win" | "draw" | "abandon" | "word" | "hanged"
  "data": { ... }            // específico del juego
}
```

#### Gato (tictactoe)
- `data = { board: [null|userId x9], symbols: {"<userId>": "X"|"O"}, winLine: null|[a,b,c] }`
- `move = { cell: 0..8 }`. Empieza players[0] (quien invitó) con "X"; en revancha alterna quién empieza.

#### Ahorcado (hangman) — competitivo por turnos
- El server elige palabra al azar de una lista en español por categorías (animales, comida, gatos, casa…), sin acentos, MAYÚSCULAS.
- `data = { masked: ["G", null, "T", null], category: "Animales", guessed: ["A","E"], wrong: 2, maxWrong: 6, scores: {"<userId>": n}, word: null }`
  (`word` se revela solo al terminar; los espacios en `masked` vienen como `" "`)
- `move = { letter: "A" }` o `move = { word: "GATO" }`.
- Letra correcta: +1 punto por cada aparición y **conserva el turno**. Letra incorrecta: wrong+1 y pasa el turno.
- Palabra completa correcta: +3 puntos y termina (reason "word"). Palabra incorrecta: wrong+1 y pasa turno.
- Si se completan todas las letras: termina (reason "word"). Si wrong ≥ maxWrong: termina (reason "hanged").
- Al terminar gana quien tenga más puntos (empate → winnerId null).

## API de arte (`public/js/cat-art.js`, global `window.CatArt`)
- `CatArt.OPTIONS = { patterns: [{id,label}], accessories: [{id,label}], furPalette: [hex], eyePalette: [hex], accentPalette: [hex] }`
- `CatArt.randomCat()` → Cat
- `CatArt.defaultCat()` → Cat
- `CatArt.mount(canvas, cat, opts)` → controller animado. `opts = { scale: 4, anim: "idle", flip: false }`
  - controller: `.setCat(cat)`, `.play(anim)` con anim `"idle"|"happy"|"sad"|"sleep"|"walk"`, `.destroy()`
  - `happy`/`sad` duran ~1.5 s y vuelven a `idle`.
  - el canvas se dimensiona solo (sprite 32x32 px × scale), `image-rendering: pixelated`.
- `CatArt.toDataURL(cat, scale=4)` → PNG estático (para avatares en listas/chat).
- `CatArt.decor` → helpers opcionales: `CatArt.drawYarn(canvas)`, `CatArt.drawFish(canvas)` etc. (iconos pixel para la UI).

## API del creador (`public/js/cat-creator.js`, global `window.CatCreator`)
- `CatCreator.mount(container, initialCat, onChange)` → renderiza preview animado grande + controles
  (nombre, colores con swatches pixel, patrón, accesorio, botón "🎲 Aleatorio"). Llama `onChange(cat)` en cada cambio.
  Devuelve `{ getCat(), destroy() }`. No incluye botón de guardar (lo pone app.js).

## Juegos enchufables (añadido v2)
Cada juego nuevo vive en **dos archivos propios** y no toca nada más:

- `server/games/<id>.js` (se carga solo; el id es el nombre del archivo). Exporta:
  - `create(players)` → estado inicial `{type: '<id>', players, turn, status: 'playing', winnerId: null, reason: null, data, secret?}`.
    `players[0]` empieza (en revancha el server invierte el orden). `secret` es info oculta: **nunca** se envía al cliente.
  - `applyMove(state, userId, move)` → `{state}` o `{error: 'mensaje en español'}`. Puro, sin mutar `state`.
    Validar: partida en curso, que sea su turno, y el `move`. Al terminar: `status: 'finished'`, `turn: null`,
    `winnerId` (o null = empate) y `reason` propio del juego.
  - opcional `revealData(state)` → `data` a mostrar si alguien abandona (para destapar lo oculto).
- `public/js/games/<id>.js` (ya incluido en index.html, después de games-ui.js). Llama a:
  ```js
  GamesUI.register({
    id, name, emoji, description, btnClass,         // btnClass: 'btn-pink'|'btn-mint'|'btn-lilac'|'btn-peach'
    build(container, api) -> ui,                     // crea el DOM una vez por partida; api.send(move), api.icon(name), api.escapeHTML
    update(ui, state, myId, api),                    // refresca con cada game:state (comparar ids con String())
    scoreHTML(player, state) -> html,                // opcional: texto bajo cada gato en la barra VS
    react(prev, state, ctx),                         // opcional: ctx.myId, ctx.happy(uid), ctx.sad(uid), ctx.sound('move'|'hit'|'miss'|'win'|'click')
    overText(state, {won, draw, oppName, myId}) -> string  // opcional: frase del resultado final
  });
  ```
  Estilos: inyecta tu propio `<style>` con clases prefijadas por el id del juego. `api.icon` dibuja iconos pixel SVG
  ('paw', 'fish', 'yarn', 'cat', 'heart'… ver `pixelSVG` en games-ui.js). `CatArt.toDataURL(cat, scale)` da avatares.

## Fondos personalizados (añadido v3)
- `cat.bg`: id de escena de fondo (string). Desconocido o ausente → `CatBG.DEFAULT` ("cuarto").
- Núcleo `public/js/backgrounds.js` (window.CatBG): `register({id,label,emoji,animated,draw(ctx,w,h,t)})`,
  `list()`, `has(id)`, `resolve(id)`, `mount(container, id, {base}) → {set(id), destroy()}`, `toDataURL(id, w, h)`.
  `draw` pinta en pixeles lógicos (≈96×72, pero el alto varía con el contenedor: dibujar adaptándose a `w`,`h`).
  Animadas a 8 fps; `t` en segundos.
- Escenas en `public/js/bg/indoor.js` y `public/js/bg/outdoor.js`.
- Escenas del mundo, una por archivo en `public/js/bg/rooms/`: `plaza.js` (Plaza Bigotes),
  `parque.js` (Parque Ronroneo) y `cafe.js` (Café del Ovillo). Son las tres salas del mapa 2D
  (ver "El mundo (fase 1)"). Las utilidades de dibujo compartidas están en `public/js/bg/pixels.js`
  (`window.CatBGPixels`): cada escena declara su ancho nativo (`NATIVE_W`) y el envoltorio la escala
  a la base pedida sin suavizado (`imageSmoothingEnabled = false`).

## Amigos (añadido v3)
Amistad **mutua e inmediata** (sin solicitudes): al agregar se guardan ambas direcciones en
`friendships(user_id, friend_id, created_at, PK(user_id, friend_id))` (ON DELETE CASCADE).
DB: `addFriend(a,b)`, `removeFriend(a,b)`, `isFriend(a,b)`, `listFriends(uid)`, `searchUsers(q, excludeId, limit=10)`.

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/api/friends` | — | `{friends: [{id, username, cat, wins, losses, draws, online, status: "idle"\|"playing"\|"offline"}]}` |
| POST | `/api/friends` | `{username}` | `{friend}` · errores: "No existe ese usuario" (404), "No puedes agregarte a ti misma/o" (400), "Ya son amigos" (409) |
| DELETE | `/api/friends/:id` | — | `{ok: true}` (quita ambas direcciones) |
| GET | `/api/users/search?q=` | — | `{users: [{id, username, cat, isFriend}]}` (q ≥ 1 char, contiene, sin distinguir mayúsculas; prefijos primero; te excluye) |

Socket: `friends:updated` (sin payload) a ambas personas al agregar/quitar. El estado en línea/jugando
**no** se reenvía por amigos: el cliente cruza su lista de amigos con `presence`.
UI: panel "Mis amigos 💕" arriba de la sala (buscador, lista con botones de juego del catálogo, "Quitar"),
y botón "+ Agregar" en "Conectados ahora" para quien no es amiga/o.

## El mundo (fase 1)
El mundo es un mapa 2D con salas. El **servidor es autoritativo**: decide la posición de cada gato y
el cliente solo dibuja lo que recibe. El catálogo de salas y las reglas de movimiento viven en
`server/world.js` (fuente única de la geometría); el cliente copia ese mismo catálogo para dibujar.

### Salas
| id | nombre | bg | tamaño (ancho×alto) | spawn | salidas |
|---|---|---|---|---|---|
| `plaza` | Plaza Bigotes | `plaza` | 320×200 | (100, 180) | → `parque` en x 0–15, y 130–169 (llega en 290, 180) · → `cafe` en x 304–319, y 130–169 (llega en 30, 180) |
| `parque` | Parque Ronroneo | `parque` | 320×200 | (240, 180) | → `plaza` en x 304–319, y 130–169 (llega en 30, 180) |
| `cafe` | Café del Ovillo | `cafe` | 320×200 | (200, 180) | → `plaza` en x 0–15, y 130–169 (llega en 290, 180) |

Coordenadas lógicas enteras: x 0..width, y 0..height (320×200). El rectángulo de una salida cubre
x..x+w-1, y..y+h-1. El room de Socket.IO de una sala es `world:<roomId>`.

### Piso caminable
Cada sala define `walkable`: una lista de polígonos (rectángulos) en coordenadas lógicas enteras que
delimitan el suelo por el que se puede caminar. El cielo, las paredes, el agua, los mostradores, las
fuentes y los muebles grandes quedan **fuera** de los polígonos.

- El `spawn` de cada sala y el `toSpawn` de cada salida caen sobre el piso caminable de su sala.
- El `toSpawn` de una salida no cae dentro de ninguna salida de la sala destino (si no, el gato rebota).
- Los rectángulos de las salidas están pegados al borde del piso caminable: su zona interior lo toca.

`server/world.js` exporta tres funciones puras sobre la geometría:
| Función | Qué hace |
|---|---|
| `isWalkable(room, x, y)` | ¿El punto está dentro de algún polígono de `room.walkable`? El borde cuenta como dentro. |
| `nearestWalkable(room, x, y)` | El punto caminable más cercano al punto dado (búsqueda exhaustiva sobre la retícula de la sala). Si el punto ya es caminable, devuelve ese mismo punto. |
| `walkablePolygons(room)` | Los polígonos de `room.walkable` (copia profunda). |

`validateRooms()` comprueba el catálogo: avisa de spawns y `toSpawn` no caminables, de salas sin
polígonos y de salidas cuya zona interior no toca el piso caminable. El módulo hace una autocomprobación
al cargarse: si hay problemas, `require('server/world')` lanza y el servidor no arranca con geometría
inválida.

### Interfaz de las salidas
- La lista de salidas de la sala (`#world-exits`) pinta cada salida como un `<button>` con el nombre de la
  sala de destino (`label`). Al pulsarlo, con ratón o con teclado, el cliente emite `world:move` con el
  centro de esa salida: el cambio de sala lo decide el servidor con la misma validación que un clic en el
  piso (no hay atajo en el cliente).

### Cliente → servidor
- `world:enter` `{ room? }` — entra al mundo; sin `room` entra a `plaza`. Si ya estaba en el mundo, sale
  primero de la sala anterior (los demás reciben `world:left`) y luego entra en la nueva.
- `world:move` `{ x, y }` — pide mover el gato a un punto del piso (coordenadas lógicas enteras).
- `world:leave` — sale del mundo (vuelve al lobby).

### Servidor → cliente
- `world:state` `{ room, players, me }` — snapshot de la sala.
  - `room` = `{ id, name, bg, width, height, spawn: {x, y}, walkable: [[{x, y}, ...], ...], exits: [{x, y, w, h, to, toSpawn: {x, y}, label}] }`
  - `room.walkable` = los polígonos del piso caminable de la sala (los mismos puntos que define
    `server/world.js`), para que el cliente pueda predecir el punto caminable más cercano.
  - `players` = **todos** los gatos de la sala, incluido el propio: `{ id, username, cat, x, y }`
  - `me` = el propio gato: `{ id, username, cat, x, y }`
- `world:join` `{ player }` — alguien más entró a tu sala: `{ id, username, cat, x, y }`.
- `world:left` `{ id }` — alguien salió de tu sala o se fue del mundo.
- `world:moved` `{ id, x, y }` — alguien se movió en tu sala.

### Reglas del servidor
- El servidor decide la posición: si `x`/`y` no son finitos, error; si están fuera de la sala, error y el
  gato **no** se mueve; si son válidos se redondean a enteros, se guardan y se emite `world:moved` a todo
  el room `world:<room>` (incluido quien se movió).
- Cambio de sala: si la posición nueva cae dentro de una salida, el gato pasa a la sala `to` en el
  `toSpawn` de esa salida. Entonces los demás de la sala anterior reciben `world:left`, quien se movió
  recibe `world:state` con la sala nueva y los demás de la sala nueva reciben `world:join`.
- Frecuencia: máximo **12 movimientos por persona cada 1000 ms** (ventana deslizante). Al pasarse, el gato
  no se mueve y se manda `error:msg` con `"Te mueves muy rápido."`.
- Varias pestañas: todas entran y salen de la sala juntas y todas reciben el `world:state`.
- `world:leave` y la desconexión (última pestaña cerrada) sacan al gato del mundo y los demás de la sala
  reciben `world:left` `{id}`.

### Errores (`error:msg` → `{ message }`)
| Mensaje | Cuándo |
|---|---|
| `Esa sala no existe.` | `world:enter` con una sala desconocida |
| `Movimiento inválido.` | `world:move` con `x` o `y` que no es un número finito |
| `No puedes salir de la sala.` | `world:move` con una posición fuera de 0..width / 0..height |
| `Te mueves muy rápido.` | más de 12 movimientos en 1000 ms |
| `Primero entra al mundo.` | `world:move` sin estar en el mundo |

### Escala del escenario (cliente)
Cada sala tiene una **resolución lógica de 320×200** (16:10). El motor del cliente
(`public/js/world.js`) calcula una escala **entera** `k = clamp(floor(ancho disponible / 320), 1, 3)`:

- el escenario mide exactamente `320*k` × `200*k` px de CSS (`--world-scale` en
  `public/css/world-scale.css`);
- el gato (32×32 lógicos) se pinta a escala 1 y se ve a `32*k` px, con `image-rendering: pixelated`;
- el canvas del fondo se pinta a `320×200` px lógicos (`CatBG.mount(stage, room.bg, { base: room.width })`).

Nunca hay escalado fraccionario: el pixel art se ve nítido. La escala se recalcula sola cuando
cambia el ancho disponible.

### Estado para el cliente (`window.__amigatos`)
```js
window.__amigatos = {
  room: 'plaza',                    // id de la sala actual
  roomName: 'Plaza Bigotes',        // nombre de la sala
  roomWidth: 320,                   // ancho lógico de la sala
  roomHeight: 200,                  // alto lógico de la sala
  catHeight: 32,                    // alto del gato en px lógicos
  walkable: [[{ x, y }, ...], ...], // polígonos del piso caminable (los del servidor)
  exits: [{ x, y, w, h, to, label }], // salidas de la sala
  me: { x, y },                     // mi gato (el movimiento lo completa la tarea de movimiento)
  players: [{ id, username, x, y }], // todos los gatos de la sala
  scale: 2,                         // escala entera del escenario (1..3)
  mapOpen: false,                   // el mapa del pueblo está cerrado
  transition: false,                // no hay cambio de sala en curso
};
```
Es la forma oficial de probar el mundo (nadie ve la pantalla): el cliente mantiene `window.__amigatos`
actualizado con cada `world:state`, `world:join`, `world:left` y `world:moved`.
