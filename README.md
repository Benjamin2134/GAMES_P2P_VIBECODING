# GAMES_P2P_VIBECODING

Colección de juegos para **2 jugadores por internet**, en **un solo archivo HTML**,
**sin instalar nada** y **sin servidor de juego**. La conexión es directa PC-a-PC
con **WebRTC**; un mini-servicio gratis (`0.peerjs.com`) sólo intercambia el
código de sala.

Juegos: **Pong**, **Billar (8-ball)** y **Spacewar 1979**. Con sonido retro
(sintetizador Web Audio, botón 🔊 para silenciar).

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
**soltás para tirar** (o flechas + `espacio`). El **círculo blanco** abajo a la
derecha es dónde le pegás a la bola: arriba = corrida (*follow*), abajo =
retroceso (*draw*), a los costados = efecto lateral. Si hacés falta, el rival
pone la blanca donde quiera con un **click**. Marcador arriba con las bolas que
lleva cada uno. La línea de puntería es **corta y se desvanece**: da la
dirección, no el punto de impacto.

Gana quien mete la 8 legal después de limpiar su grupo (lisas o rayas). Reglas
8-ball: grupos, asignación al primer pocket, faltas (scratch, primera bola mala,
no tocar nada), bola en mano.

**Física realista (2D):** movimiento en dos fases — la bola primero *patina*
(fricción alta) y va tomando efecto hasta que *rueda* de forma natural
(v = R·ω en el punto de contacto), y después rueda con resistencia baja; ese
"patina y después agarra" es lo que se ve en una mesa real. Choque bola-bola
con restitución 0.95 + fricción tangencial (*throw*); bandas con restitución
dependiente de la velocidad + efecto; troneras con embudo. Follow / draw /
efecto lateral salen de dónde le pegás a la blanca. Constantes basadas en la
física real del pool (drdavepoolinfo.com, pooltool), con multiplicadores de
juego para que las jugadas asienten en pocos segundos.

### Spacewar 1979
Duelo de naves con inercia newtoniana. <kbd>←</kbd>/<kbd>→</kbd> giran,
<kbd>↑</kbd> empuje, <kbd>espacio</kbd> dispara. Los bordes hacen *wrap-around*.
5 vidas cada uno; escudo breve al reaparecer. Basado en el PR de **@777.dub**,
adaptado a esta arquitectura (loop rAF, predicción de tu nave, interpolación de
la rival, dead-reckoning de las balas).

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
  audio.js           <- RetroAudio: sintetizador Web Audio (láser, thrust, explosión…)
  shell.js           <- selector de juego + transporte P2P + loop maestro
  pong.sim.js  pong.js       <- Pong
  billar.sim.js  billar.js   <- Billar 8-ball
  spacewar.sim.js  spacewar.js <- Spacewar 1979
  template.html      <- HTML + CSS con /*__PEERJS__*/ y /*__BUNDLE__*/
  peerjs.min.js      <- PeerJS 1.5.4 vendorizado
  build.mjs          <- ensambla -> GAMESP2P.html
  test.mjs           <- tests de la lógica pura (node src/test.mjs)
```

Ver **`AGENTS.md`** para el flujo de trabajo en equipo y cómo agregar un juego.

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
