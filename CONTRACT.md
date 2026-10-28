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
  "breed": "comun",         // "comun"|"siames"|"persa"|"mainecoon"|"sphynx"|"scottish"|"bengala"|"ragdoll"|"british"|"azulruso"|"angora"|"bombay"|"naranja" (desconocida → "comun")
  "fur": "#f4a261",         // color base
  "pattern": "tabby",       // "solid" | "tabby" | "spots" | "tuxedo" | "calico" | "siamese"
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
