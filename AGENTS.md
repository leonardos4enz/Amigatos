# AGENTS.md: reglas para agentes que trabajan en Amigatos

Lo leen todos los agentes antes de trabajar. Cada corrección que un humano haga más de una vez
se agrega aquí o en `eslint.config.js` (regla de 3), nunca solo en un comentario.

## Qué es Amigatos

Un juego web social de gatitos pixel art. Hoy: cuentas, creador de gatos, amigos, presencia en línea
y 6 minijuegos por turnos en tiempo real con chat. La visión es crecer hasta un **mundo virtual propio**:
moverse por un mapa 2D, casas con muebles, ropa, tiendas, economía, historia y logros.

Es un mundo **original**: nombres, lugares, personajes y arte propios de Amigatos. No copies nombres,
mapas, personajes ni arte de otros juegos.

## Stack (no lo cambies sin que el issue lo pida)

- Node 22, Express, Socket.IO 4, `pg`. Servidor en **CommonJS** (`require`).
- Frontend **vanilla sin build**: HTML/CSS/JS servido desde `public/`. Nada de React, bundlers ni TypeScript.
- **El servidor decide todo** (autoritativo): el cliente solo envía intenciones y dibuja el estado que recibe.
- Persistencia en `server/db.js` con **dos implementaciones**, Postgres y memoria. Todo lo nuevo que se guarde
  debe funcionar en ambas: los tests usan memoria y producción usa Postgres.
- Todo el texto visible en **español**.
- `CONTRACT.md` es el contrato entre frontend y backend. **Si cambias una ruta, un evento de socket o un modelo,
  actualiza `CONTRACT.md` en el mismo PR.**

## Definición de "terminado"

1. `npm run verify` pasa: `lint` + `test` (servidor) + `e2e` (navegador).
2. Todo comportamiento nuevo tiene tests que fallarían sin el cambio:
   - lógica pura → test unitario en `test/` (ver `test/games.test.js`);
   - API REST o sockets → test con el servidor real (ver `test/api.test.js` y `test/multiplayer.test.js`);
   - interfaz → test de Playwright en `e2e/` (ver `e2e/smoke.spec.js`).
3. El diff toca solo lo que pide el issue, y `CONTRACT.md` refleja cualquier cambio de API.

## Cómo verificar sin ver la pantalla (importante)

Los agentes **no pueden ver imágenes ni capturas**. Todo lo visual se verifica en texto:

- Usa `id` o `data-testid` estables en los elementos nuevos, y en Playwright revisa texto, visibilidad y atributos.
- Para lo que se dibuja en canvas (mapa, gatos moviéndose, muebles), expón el estado en
  **`window.__amigatos`**, por ejemplo `{ room, me: { x, y }, players: [{ id, x, y }], inventory }`, y en
  Playwright compruébalo con `page.evaluate(() => window.__amigatos...)`.
  Es la forma oficial de probar el mundo: si algo se ve, su estado tiene que poder leerse ahí.
- Los tests de navegador fallan si hay errores de JavaScript en la consola (`trackErrors` en `e2e/smoke.spec.js`).
- Para probar multijugador en el navegador, abre dos contextos (`browser.newContext()`) con dos cuentas.

## Camino pavimentado: una sola forma de hacer cada cosa

- **Minijuego nuevo:** `server/games/<id>.js` exporta `create(players)` y `applyMove(state, userId, move)`
  (y `revealData(state)` si tiene información oculta). El servidor lo detecta solo por el nombre del archivo.
  UI en `public/js/games/<id>.js`. Tests de la lógica en `test/`.
- **Arte:** pixel art **procedural en código** (como `public/js/cat-art.js` y `public/js/bg/`).
  No agregues imágenes binarias: no puedes verlas ni verificarlas.
- **Eventos de socket:** nombre `dominio:accion` (`invite:send`, `game:state`). Valida todo lo que llega del cliente.
- **Errores al usuario:** status 4xx con `{ error: "mensaje en español" }` en REST, y `error:msg` en sockets.

## Tests

- Cada test crea sus propios usuarios con nombres únicos (`registerUser`, `uniqueName`). Ningún test depende
  de otro ni del orden.
- Nunca borres ni debilites tests existentes para que pase tu cambio.
- Espera eventos con `waitFor` (tiene timeout). Nada de `setTimeout` fijos para "dar tiempo".

## Prohibido

- Tocar `Dockerfile`, `.github/`, `eslint.config.js`, `playwright.config.js` o este archivo, salvo que el issue lo pida.
- Agregar dependencias sin que el issue lo justifique.
- Secretos en el código. La configuración va en variables de entorno.
- Desactivar reglas de lint, salvo con un comentario `-- motivo` en la misma línea.
- Confiar en datos del cliente: posiciones, monedas, compras e inventario los valida y decide el servidor.
