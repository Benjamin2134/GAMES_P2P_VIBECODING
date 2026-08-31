# GAMES_P2P_VIBECODING — PONG online

Pong para 2 jugadores por internet, **sin instalar nada** y **sin servidor de juego**.
La conexión es directa PC-a-PC con **WebRTC**; un mini-servicio gratis
(`0.peerjs.com`) sólo sirve para intercambiar el código de sala.

## Jugar

Los dos abren `pong.html` en el navegador (Chrome/Edge/Firefox/Safari). Uno hace
**Crear sala** → sale un código de 4 letras → se lo pasa al otro → el otro lo
escribe en **Unirse**. Listo.

- Controles: `W`/`S` o flechas.
- El que crea la sala es el **jugador 1** (izquierda) y su navegador corre la
  simulación (física de la pelota).
- Primero a 5 gana. Botón de revancha.
- Si alguno cambia de pestaña / minimiza, el juego se **pausa** para los dos y
  se reanuda al volver.

Detalles y solución para cuando no conecta (NAT duro → TURN): ver `LEEME.txt`.

## Estructura del repo

```
pong.html            <- EL JUEGO. Archivo único autocontenido (generado). Es el que se juega/hostea.
LEEME.txt            <- instrucciones para jugadores + cómo agregar TURN
src/
  const.js           <- constantes de juego (campo, palas, velocidades…)
  sim.js             <- class Partida: la simulación autoritativa (corre en el host)
  app.js             <- menú, transporte PeerJS/WebRTC, render en canvas, pausa
  template.html      <- HTML + CSS con los marcadores /*__PEERJS__*/ y /*__GAME__*/
  peerjs.min.js      <- PeerJS 1.5.4 vendorizado
  build.mjs          <- ensambla todo -> pong.html
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
