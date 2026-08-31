# GAMES_P2P_VIBECODING — Arcade Hub Online P2P

> 🤖 **Reglas para Asistentes de IA (Cursor, Copilot, Claude Code, etc.):**
> Leer [`AGENTS.md`](./AGENTS.md) antes de editar. Prohibido modificar los archivos `.html` raíz directamente; todo desarrollo se realiza en `src/` y se compila con `node src/build.mjs`.

Salón de juegos arcade para 2 jugadores por internet, **sin instalar nada** y **sin servidor de juego central**.
La conexión es directa navegador-a-navegador vía **WebRTC (PeerJS)**.

---

## 🕹️ Juegos Disponibles

1. **SPACEWAR 1979:** Combate de naves espaciales con física newtoniana, inercia pura a 120 Hz, proyectiles balísticos, rotación y estética retro CRT de fósforo verde.
2. **PONG CLÁSICO:** Duelo de palas con dead-reckoning de pelota, delay adaptativo según jitter y snapshots binarios ultralivianos (31 bytes).
3. **Próximamente:** *Tron / Lightcycles*, *Tank Duel*, *Air Hockey*.

---

## 🚀 Cómo Jugar

1. Ambos abren `index.html` en cualquier navegador.
2. Uno hace clic en **Crear sala (Host)** $\rightarrow$ se genera un código de 4 letras $\rightarrow$ se lo comparte a su amigo.
3. El amigo escribe el código y presiona **Unirse (Guest)**.
4. **Lobby / Home:** Una vez conectados, entran al catálogo de juegos. El Host selecciona a qué jugar y ambos entran a la partida en simultáneo.
5. Con el botón **[ ⎋ Catálogo de Juegos ]** pueden regresar al Home y cambiar de juego en cualquier momento sin perder la conexión P2P.

---

## 🛠️ Arquitectura y Desarrollo

```
index.html           <- ARCADE HUB. Archivo único autocontenido (el que se juega/hostea).
pong.html            <- Standalone de Pong
spacewar.html        <- Standalone de Spacewar
AGENTS.md            <- Reglas de arquitectura para desarrollo colaborativo con IA
src/
  const*.js          <- Constantes de físicas y dimensiones
  sim*.js            <- Simulaciones autoritativas fijas a 120 Hz
  app-hub.js         <- Transporte P2P, multiplexor y renderers
  audio.js           <- Sintetizador Web Audio API puro
  template-hub.html  <- Layout HTML + CSS
  build.mjs          <- Ensambla todo en index.html, pong.html y spacewar.html
  test.mjs           <- Tests unitarios de física y lógica (node src/test.mjs)
```

### Flujo de Build
```bash
# 1. Correr tests
node src/test.mjs

# 2. Compilar
node src/build.mjs
```
