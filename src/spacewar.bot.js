// ==========================================================================
//  Bot Universal: SPACEWAR 1979 (src/spacewar.bot.js)
//  Heurística newtoniana arcade: intercepción balística, evasión y wrap-around.
// ==========================================================================
"use strict";

const SpacewarBot = {
  // Estado interno liviano del bot (timers de reflejo)
  _reaccionTimer: 0,
  _ultimoInput: { rot: 0, thrust: false, fire: false },

  step(sim, dt) {
    if (!sim || sim.ganador) return;
    const me = sim.naves && sim.naves[2];
    const rival = sim.naves && sim.naves[1];

    // Si el bot o el rival están en respawn / muertos
    if (!me || !me.viva || !rival || !rival.viva) {
      sim.aplicarInputGuest({ rot: 0, thrust: false, fire: false });
      return;
    }

    // 1. Vector de posición en toroide (wrap-around 880x540)
    let dx = rival.x - me.x;
    if (dx > SW.W / 2) dx -= SW.W;
    else if (dx < -SW.W / 2) dx += SW.W;

    let dy = rival.y - me.y;
    if (dy > SW.H / 2) dy -= SW.H;
    else if (dy < -SW.H / 2) dy += SW.H;

    const dist = Math.hypot(dx, dy);

    // 2. Predicción de tiro (Lead Target): calcula dónde estará el rival
    const tVuelo = Math.min(dist / SW.BALA_VEL, 1.2);
    const fx = dx + (rival.vx - me.vx * 0.4) * tVuelo;
    const fy = dy + (rival.vy - me.vy * 0.4) * tVuelo;
    const angDeseado = Math.atan2(fy, fx);

    // 3. Rotación hacia el blanco
    let diff = angDeseado - me.ang;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    let rot = 0;
    if (diff > 0.08) rot = 1;
    else if (diff < -0.08) rot = -1;

    // 4. Decisión de Disparo: alineado y a rango útil
    const alineado = Math.abs(diff) < 0.22; // ~12.6 grados de tolerancia
    const fire = alineado && dist < 620 && (!rival.invuln || rival.invuln <= 0);

    // 5. Decisión de Empuje (Thrust newtoniano): no embalarse sin control
    const velActual = Math.hypot(me.vx, me.vy);
    let thrust = false;

    // Si está lejos y apuntando en dirección general, dar impulso
    if (dist > 230 && Math.abs(diff) < 0.65 && velActual < 280) {
      thrust = true;
    }

    // 6. Evasión de proyectiles enemigos cercanos (peligro inminente < 90px)
    if (sim.balas && sim.balas.length > 0) {
      for (let i = 0; i < sim.balas.length; i++) {
        const b = sim.balas[i];
        if (b.d === 1) {
          let bdx = b.x - me.x;
          if (bdx > SW.W / 2) bdx -= SW.W;
          else if (bdx < -SW.W / 2) bdx += SW.W;

          let bdy = b.y - me.y;
          if (bdy > SW.H / 2) bdy -= SW.H;
          else if (bdy < -SW.H / 2) bdy += SW.H;

          if (Math.hypot(bdx, bdy) < 90) {
            // Evasión de emergencia: impulso lateral
            thrust = true;
            if (rot === 0) rot = 1;
            break;
          }
        }
      }
    }

    const inputFinal = { rot, thrust, fire };
    sim.aplicarInputGuest(inputFinal);
    return inputFinal;
  }
};

// Registro automático en el motor arcade
if (typeof BOTS !== "undefined") {
  BOTS.spacewar = SpacewarBot;
}

// Export para Node.js / test.mjs
if (typeof module !== "undefined" && module.exports) {
  module.exports = { SpacewarBot };
}
