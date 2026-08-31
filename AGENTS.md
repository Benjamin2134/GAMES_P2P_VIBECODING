# AGENTS.md — Protocolo de desarrollo colaborativo (Arcade P2P)

> Para cualquier asistente de IA (Claude Code, Cursor, Copilot, Windsurf, etc.)
> y para cualquier persona que toque el repo.

Este proyecto es un **arcade multijugador P2P por WebRTC** hecho en equipo con
IA (*vibecoding*). El producto final es **un único archivo `GAMESP2P.html`** que
se abre en el navegador, sin instalar nada. Para trabajar de a dos sin romper
nada en Git, respetá esto.

## 1. Estructura (aislamiento por juego)

```
src/
  const.js              núcleo: clamp, lerp, registro global JUEGOS
  audio.js              sintetizador Web Audio (RetroAudio) compartido
  shell.js              selector de juego + transporte P2P + loop maestro (rAF)
  peerjs.min.js         PeerJS 1.5.4 vendorizado
  <juego>.sim.js        simulación autoritativa del juego (corre en el host)
  <juego>.js            módulo del juego: input + netcode + render
  template.html         HTML + CSS con los marcadores /*__PEERJS__*/ y /*__BUNDLE__*/
  build.mjs             ensambla todo -> ../GAMESP2P.html
  test.mjs              tests de la lógica pura de todas las sims
GAMESP2P.html           GENERADO. No editar a mano.
```

> **Regla de oro:** si vos trabajás en `spacewar.*` y tu amigo en `tron.*`, los
> archivos son independientes y Git no va a tener conflicto en el código del
> juego. Lo único compartido es `shell.js`, `const.js`, `audio.js`, `build.mjs`,
> `test.mjs`, `template.html` — coordinar antes de tocarlos.

## 2. Agregar un juego nuevo

1. `git checkout -b feature/<juego>`
2. Crear `src/<juego>.sim.js` (clase de simulación) y `src/<juego>.js` (módulo).
   El módulo se registra solo: `JUEGOS.<juego> = { ... }` — aparece en el
   selector automáticamente.
3. Sumar los dos archivos a `ORDEN` en `src/build.mjs` (sims antes que módulos,
   `shell.js` siempre al final) y sumar tests en `src/test.mjs`.
4. `node src/test.mjs` y `node src/build.mjs`. Abrir `GAMESP2P.html`, probar.
5. `git pull origin main`. Si `GAMESP2P.html` da conflicto: **no lo edites a
   mano**, corré `node src/build.mjs`, `git add .`, commit.
6. `git push origin feature/<juego>` → Pull Request. Se commitean `src/` **y**
   `GAMESP2P.html` juntos (para jugar/hostear sin Node).

## 3. Contrato de un módulo de juego (`JUEGOS.<id>`)

```js
JUEGOS.miJuego = {
  nombre, desc,
  canvas: { w, h },            // tamaño lógico del canvas
  iniciarHost(), iniciarGuest(), destruir(),
  onData(msg),                 // msg = objeto JSON ya parseado, o ArrayBuffer (binario)
  frame(now, dtSeg, pausado),  // lo llama el loop del shell cada rAF
  overlay(),                   // null | {texto, sub, revancha, revanchaPedida}
  revancha(),
};
```

El shell le pasa los globales `cv`, `ctx`, `net` (`{ rol, enviar(x) }`).
`rol` = 1 host (corre la sim autoritativa), 2 guest.

## 4. Física y sincronización

- Simulación autoritativa **por dt en segundos**, paso fijo (120 Hz) con
  acumulador dentro de `frame()`. El host la corre; el guest sólo dibuja y manda
  inputs.
- El loop es **`requestAnimationFrame`** (no `setInterval`: el navegador lo
  estrangula al ocultar la pestaña — y ahí justo se pausa el juego).
- **Anti-cheat mínimo:** el host valida/limita lo que manda el guest (ej: en Pong
  la pala del guest se acepta pero limitada a la velocidad físicamente posible).

## 5. Mensajes por el DataChannel

El canal es **no confiable** (`{reliable:false}`), sin orden ni reintentos.

| Forma | Uso |
|---|---|
| `{ t: "__hola" \| "__pausa" }` | control del shell (handshake de juego, pausa). Reservado. |
| `ArrayBuffer` con byte 0 = tipo | Pong: `1` snapshot, `2` pala. Rango 1–9 para Pong. |
| `{ t: "e" }` | snapshot de estado (Billar, Spacewar) |
| `{ t: "in" \| "aim" \| "mano" \| "rev" \| ... }` | inputs/acciones del guest |

Cada snapshot debe ser **autónomo** (que una pérdida no importe). Para acciones
puntuales sobre canal no confiable, reenviar hasta ver el efecto en el snapshot
(*self-healing*), como hacen Billar y Spacewar.

## 6. Publicar

`GAMESP2P.html` es autárquico. Doble clic, o subirlo a GitHub Pages / Netlify
Drop / Cloudflare Pages. Cualquiera con el link entra, crea una sala de 4 letras
y juega.
