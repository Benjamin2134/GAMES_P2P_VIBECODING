# GAMES_P2P_VIBECODING

Colección de juegos para **2 jugadores por internet**, en **un solo archivo HTML**,
**sin instalar nada** y **sin servidor de juego**. La conexión es directa PC-a-PC
con **WebRTC**; un mini-servicio gratis (`0.peerjs.com`) sólo intercambia el
código de sala.

Juegos: **Pong** y **Billar (8-ball)**.

## Jugar

1. Los dos abren **`GAMESP2P.html`** en el navegador (Chrome/Edge/Firefox/Safari).
2. Uno elige un juego → **Crear sala** → sale un código de 4 letras.
3. Se lo pasa al otro, que lo escribe en **Unirse** (no elige juego: se usa el que
   eligió quien creó la sala).
4. Listo.

- Si alguno cambia de pestaña / minimiza, se **pausa** para los dos.
- Botón de revancha al terminar.

### Pong
`W`/`S` o flechas. Primero a 5.

### Billar (8-ball)
Por turnos. Apuntás con el **mouse**, **mantenés apretado** para cargar fuerza y
**soltás para tirar** (o flechas + `espacio`). Si hacés falta, el rival pone la
blanca donde quiera con un **click**. Gana quien mete la 8 legal después de
limpiar su grupo (lisas o rayas). Reglas 8-ball simplificadas pero reales:
grupos, faltas, bola en mano, scratch.

Cómo conectar desde otra casa cuando el P2P directo no engancha (NAT duro → TURN):
ver `LEEME.txt`.

## Optimización de red (Pong)

| Técnica | Qué hace |
|---|---|
| Paso fijo 120 Hz + acumulador | Física constante, desacoplada del render. |
| Snapshots binarios (31 B) | Estado en `DataView`, no JSON. |
| Canal no confiable + nº de secuencia | Sin head-of-line blocking; descarta paquetes viejos. |
| Autoridad de cliente sobre tu pala | Tu pala responde en 0 ms; el host la acepta limitada a lo físicamente posible. |
| Interpolación con retardo adaptativo | La pala rival se interpola con un retardo que se ajusta solo al jitter. |
| Dead-reckoning de la pelota | Se dibuja proyectada; el error se disuelve suave. |

Billar es por turnos, así que usa snapshots JSON (la latencia fina no importa) con
reenvío self-healing de las jugadas sobre el canal no confiable.

## Estructura

```
GAMESP2P.html        <- EL JUEGO. Archivo único autocontenido (GENERADO).
LEEME.txt            <- instrucciones para jugadores + cómo agregar TURN
src/
  const.js           <- comunes (clamp, lerp, registro JUEGOS)
  shell.js           <- selector de juego + transporte P2P + loop maestro
  pong.sim.js  pong.js     <- Pong: simulación + módulo (netcode, render)
  billar.sim.js  billar.js <- Billar: simulación 8-ball + módulo (input, render)
  template.html      <- HTML + CSS con /*__PEERJS__*/ y /*__BUNDLE__*/
  peerjs.min.js      <- PeerJS 1.5.4 vendorizado
  build.mjs          <- ensambla -> GAMESP2P.html
  test.mjs           <- tests de la lógica pura (node src/test.mjs)
```

Un juego = un objeto en `JUEGOS.xxx` con:
`nombre, desc, canvas:{w,h}, iniciarHost(), iniciarGuest(), destruir(),
onData(msg), frame(now, dt, pausado), overlay(), revancha()`.
El shell le pasa los globales `cv`, `ctx`, `net` (`{rol, enviar}`).

## Editar / compilar

```bash
node src/build.mjs     # regenera GAMESP2P.html
node src/test.mjs      # tests de física y reglas
```

Commiteá `src/` y `GAMESP2P.html` juntos (jugadores/hosting no necesitan Node).

## Publicar con link fijo

Subí `GAMESP2P.html` a cualquier hosting estático (Netlify Drop, GitHub Pages,
Cloudflare Pages). Es un solo archivo.
