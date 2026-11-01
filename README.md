# 🐱 Amigatos

Juego web de gatitos pixel art: cada quien crea su cuenta, diseña su gato y juega minijuegos en tiempo real
(Gato y Ahorcado) con chat.

Stack: Node 22 + Express + Socket.IO + PostgreSQL. Frontend vanilla sin build.

## Local

```bash
npm install
npm start
```

Abre http://localhost:3000. Sin `DATABASE_URL` usa memoria: los datos se pierden al reiniciar.

## Verificación

```bash
npx playwright install chromium   # solo la primera vez
npm run verify                     # lint + tests del servidor + tests de navegador
```

- `test/`: lógica de juegos, API REST y multijugador con dos clientes Socket.IO reales (`node --test`).
- `e2e/`: Playwright. Verifica texto y estado (`window.__amigatos`), nunca capturas.

## Ramas y flota de agentes

- `main` es producción (Easypanel despliega desde aquí).
- `dev` es donde trabaja la flota de agentes (agent-fleet): sus PRs se mergean solos a `dev` si pasan
  la verificación, el review y el CI. Lo que te guste al probar `dev`, lo pasas a `main`.
- Reglas para los agentes: [AGENTS.md](AGENTS.md).

## Despliegue en Easypanel

1. **Base de datos:** en tu proyecto de Easypanel usa tu servicio Postgres existente (o crea uno) y crea una base,
   por ejemplo `amigatos`. Copia la *Internal Connection URL*, del estilo
   `postgres://postgres:PASS@proyecto_postgres:5432/amigatos`.
2. **App:** crea un servicio de tipo *App*, con fuente **GitHub** → `leonardos4enz/Amigatos`, rama `main`,
   y build tipo **Dockerfile**.
3. **Environment:**
   ```
   DATABASE_URL=postgres://...   (la URL interna del paso 1)
   JWT_SECRET=una-cadena-larga-y-aleatoria
   ```
4. **Domains:** añade un dominio (o el subdominio de Easypanel) apuntando al puerto **80** (el Dockerfile ya fija PORT=80). Activa HTTPS.
5. **Deploy.** La tabla `users` se crea sola al arrancar. Comprueba `https://tu-dominio/health` → `ok`.

Los websockets funcionan con el proxy de Easypanel (Traefik) sin configuración extra.

## Estructura

- `server/`: API REST, sockets y lógica de juegos (el server decide todo).
- `public/`: UI, arte pixel procedural (`js/cat-art.js`) y creador de gatos (`js/cat-creator.js`).
- `CONTRACT.md`: contrato entre frontend y backend.
