# AGENTS.md — Protocolo de Desarrollo Colaborativo & Escalabilidad (Arcade P2P)

> **Para cualquier Asistente / Agente de IA (Cursor, Copilot, Claude Code, Antigravity, Windsurf, etc.):**
> Este proyecto es un **Arcade Hub Multijugador P2P WebRTC** desarrollado en equipo por dos o más desarrolladores usando IA (*vibecoding*).
> 
> **EL PRODUCTO FINAL:** Es un único archivo ejecutable (`index.html`) que los jugadores abren en el navegador o descargan sin instalar nada.
> **EL FLUJO INTERNO:** Para que dos personas puedan programar juegos a la vez sin romper el código ni destruirse en Git, **ESTE ES EL PROTOCOLO OBLIGATORIO**.

---

## 🏗️ 1. ESTRUCTURA MODULAR POR JUEGO (Aislamiento Total)

Cada juego nuevo vive en su propio módulo independiente para que nunca haya conflictos entre desarrolladores:

```
src/
  ├── core/                        <- Motor compartido (WebRTC, Audio, Hub)
  │     ├── peerjs.min.js          <- Librería WebRTC vendorizada
  │     ├── audio.js               <- Sintetizador Web Audio API puro
  │     ├── app-hub.js             <- Multiplexor de sala y selección de juegos
  │     └── template-hub.html      <- Maquetación del Arcade y catálogo
  │
  ├── games/                       <- UN DIRECTORIO AISLADO POR CADA JUEGO
  │     ├── pong/
  │     │     ├── const.js
  │     │     └── sim.js
  │     ├── spacewar/
  │     │     ├── const.js
  │     │     └── sim.js
  │     └── [nuevo-juego]/         <- Tu amigo crea su carpeta y no toca las demás
  │           ├── const.js
  │           └── sim.js
  │
  ├── build.mjs                    <- Ensambla todo en index.html y standalones
  └── test.mjs                     <- Tests de física y red de todos los juegos
```

> 🎯 **Regla de Oro:** Si tú trabajas en `spacewar/` y tu amigo trabaja en `tron/`, **los archivos son 100% independientes** y Git jamás tendrá un conflicto en el código del juego.

---

## 👥 2. EL FLUJO DE TRABAJO EN PAREJA (Paso a Paso)

Cuando tú o tu amigo vayan a crear o mejorar un juego:

### Paso 1: Crear una rama de Git
```bash
git checkout -b feature/mi-nuevo-juego
```

### Paso 2: Programar dentro de `src/games/[juego]/`
- Escribir la lógica física autoritativa a 120 Hz (`sim.js`).
- Probar la lógica pura ejecutando los tests:
  ```bash
  node src/test.mjs
  ```

### Paso 3: Probar el juego en el navegador (Build local)
```bash
node src/build.mjs
```
Abre `index.html` (o `[juego].html`) en tu navegador para probar la jugabilidad y la conexión P2P.

### Paso 4: Sincronizar con los cambios de tu amigo antes del PR
Antes de subir o fusionar a `main`, trae lo que tu amigo haya subido:
```bash
git pull origin main
```
- Si hay cambios en `src/`, Git los fusionará automáticamente.
- **Si Git marca conflicto en `index.html`:** No lo toques a mano. Simplemente ejecuta:
  ```bash
  node src/build.mjs
  git add .
  git commit -m "Merge main y regeneración de bundles"
  ```

### Paso 5: Push y Pull Request
```bash
git push origin feature/mi-nuevo-juego
```
Ambos archivos (`src/` y los `.html` compilados listos para jugar) se commitean juntos.

---

## 🧩 3. CONTRATO DE SIMULACIÓN PARA NUEVOS JUEGOS

Toda clase de simulación en `src/games/[juego]/sim.js` debe cumplir con esta interfaz estándar:

```javascript
class Partida[Nombre] {
  constructor() { ... }
  step(dt) { ... }                         // Física fija a 120 Hz (corre en Host)
  aplicarInputHost(input) { ... }          // Input local del Jugador 1
  aplicarInputGuest(input) { ... }         // Input del Jugador 2 (validado contra anti-cheat)
  snapshot() { ... }                       // Retorna estado plano para enviar por WebRTC
  pedirRevancha(jugadorId) { ... }         // Lógica de revancha entre rondas
  reiniciarTodo() { ... }                  // Reset de vidas/puntuación
}
```

---

## 📡 4. RANGOS DE MENSAJES WEBRTC (Evitar Colisiones)

Al serializar paquetes binarios en `DataView`, usa el rango asignado para cada juego:

| Rango de IDs | Uso / Juego |
|---|---|
| `10 - 29` | Control de Sala & Navegación del Hub (`PING`, `SELECT_GAME`, `RETURN_HUB`) |
| `1 - 9` | **PONG** |
| `30 - 39` | **SPACEWAR** |
| `40 - 49` | **TRON / LIGHTCYCLES** |
| `50 - 59` | **TANK DUEL** |
| `60 - 69` | **AIR HOCKEY** |
| `70 - 79` | **MICRO RACERS** |

---

## 🌐 5. PUBLICACIÓN & JUEGO DIRECTO

El archivo `index.html` resultante es 100% autárquico. Puedes:
1. Abrirlo con doble clic en tu máquina.
2. Subirlo a **GitHub Pages** (en `Settings -> Pages -> Deploy from branch main / root`).
3. Arrastrarlo a **Netlify Drop** o **Cloudflare Pages**.
Cualquier persona con el link entra, crea una sala con 4 letras y juega al instante.
