# GAMES_P2P_VIBECODING — PONG online

Pong para 2 jugadores por internet, **sin instalar nada** y **sin servidor de juego**.
La conexión es directa PC-a-PC con **WebRTC**; un mini-servicio gratis
(`0.peerjs.com`) sólo sirve para intercambiar el código de sala.

## Jugar

Los dos abren `pong.html` en el navegador (Chrome/Edge/Firefox/Safari). Uno hace
**Crear sala** → sale un código de 4 letras → se lo pasa al otro → el otro lo
escribe en **Unirse**. Listo.

- Controles: `W`/`S` o flechas. `H` = HUD de red (FPS, RTT, jitter, bytes/s).
- El que crea la sala es el **jugador 1** (izquierda) y su navegador corre la
  simulación (física de la pelota).
- Primero a 5 gana. Botón de revancha.
- Si alguno cambia de pestaña / minimiza, el juego se **pausa** para los dos y
  se reanuda al volver.

Detalles y solución para cuando no conecta (NAT duro → TURN): ver `LEEME.txt`.

## Optimización de red (netcode)

Para que ambos jueguen fluido y sin lag perceptible:

| Técnica | Qué hace |
|---|---|
| **Paso fijo 120 Hz + acumulador** | La física va a 120 Hz constante y desacoplada del render; sin drift ni tunneling. |
| **Snapshots binarios (31 bytes)** | Estado del juego en un `DataView` en vez de JSON: ~4× menos bytes y sin coste de `JSON.parse` 60 veces/s. |
| **Canal no confiable + nº de secuencia** | El `DataChannel` va sin reintentos ni orden (como UDP): cero *head-of-line blocking*; los paquetes viejos/duplicados se descartan por secuencia. Cada snapshot es autónomo, así que una pérdida no se nota. |
| **Autoridad de cliente sobre tu pala** | Tu pala responde en 0 ms (la simulás localmente) y le mandás la posición al host, que la acepta **limitada a lo físicamente posible** (anti-teleport / anti-cheat). |
| **Interpolación con retardo adaptativo** | La pala rival se interpola entre snapshots con un retardo que se ajusta solo según el *jitter* medido (35–140 ms). Movimiento sin tirones aunque la red varíe. |
| **Dead-reckoning de la pelota** | La pelota se dibuja en su posición proyectada (con rebote de paredes) y la corrección de error se disuelve suavemente (*projective velocity blending*): la pelota nunca "salta". |
| **Render** | Canvas a `devicePixelRatio`, contexto `alpha:false` + `desynchronized:true`, coordenadas redondeadas. |

`node src/test.mjs` corre los tests de la lógica pura (codec, física, límites).

## Estructura del repo

```
pong.html            <- EL JUEGO. Archivo único autocontenido (generado). Es el que se juega/hostea.
LEEME.txt            <- instrucciones para jugadores + cómo agregar TURN
src/
  const.js           <- constantes (campo, palas, velocidades en px/seg, SIM_HZ…)
  sim.js             <- class Partida: simulación autoritativa por dt (corre en el host)
  app.js             <- menú, transporte P2P (codec binario), netcode y render
  template.html      <- HTML + CSS con los marcadores /*__PEERJS__*/ y /*__GAME__*/
  peerjs.min.js      <- PeerJS 1.5.4 vendorizado
  build.mjs          <- ensambla todo -> pong.html
  test.mjs           <- tests de la lógica pura (node src/test.mjs)
```

## Editar / compilar

1. Tocás lo que quieras en `src/` (lo normal es `sim.js` para reglas de juego,
   `app.js` para UI/red, `const.js` para números).
2. Regenerás el archivo jugable:

```bash
node src/build.mjs
```

3. Commit de **`src/` y `pong.html` juntos** (el `pong.html` va commiteado para
   que jugadores y hosting no necesiten Node).

## Publicar con link fijo

Subí `pong.html` a cualquier hosting estático (Netlify Drop, GitHub Pages,
Cloudflare Pages). Es un solo archivo.
