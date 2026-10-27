// ==========================================================================
//  Bot Universal: ARTILLERIA (src/artilleria.bot.js)
//  Ve lo mismo que un humano (terreno, tanques, viento) y prueba tiros con la
//  misma fisica hasta encontrar uno que caiga cerca del rival. Le suma un
//  error que se achica con cada disparo (como alguien que va corrigiendo).
//  Mueve la mira de a poco antes de disparar.
// ==========================================================================
"use strict";

const ArtilleriaBot = {
  nuevo() {
    let plan = null, t = 0, tiros = 0;
    return {
      step(v, api, dt) {
        if (!v || v.g || v.turno !== v.yo || v.fase !== "apunta") { plan = null; t = 0; return; }
        const yo = v.tanques[v.yo], rival = v.tanques[Kit.otro(v.yo)];
        if (!plan) {
          let mejor = Infinity, ang = yo.ang, pot = yo.pot;
          const haciaDer = rival.x > yo.x;
          for (let a = 10; a <= 80; a += 2) {
            const angulo = ((haciaDer ? a : 180 - a) * Math.PI) / 180;
            for (let p = 30; p <= 100; p += 2) {
              const imp = ART.vuelo(v.alt, v.tanques, v.yo, angulo, p, v.viento, 1 / 60);
              if (!imp) continue;
              const d = imp.tanque === Kit.otro(v.yo) ? 0 : Math.hypot(imp.x - rival.x, imp.y - rival.y) + (imp.tanque === v.yo ? 500 : 0);
              if (d < mejor) { mejor = d; ang = angulo; pot = p; }
            }
          }
          const err = Math.max(0.25, 1.6 - tiros * 0.35);
          plan = {
            ang: clamp(ang + (Math.random() * 2 - 1) * 0.05 * err, 0.05, Math.PI - 0.05),
            pot: clamp(pot + (Math.random() * 2 - 1) * 5 * err, 5, 100),
            a0: yo.ang, p0: yo.pot,
          };
          t = 0;
        }
        t += dt;
        const k = Math.min(1, t / 1.1);
        const i = { ang: lerp(plan.a0, plan.ang, k), pot: lerp(plan.p0, plan.pot, k) };
        api.input(i);
        if (t > 1.5) { api.accion({ fuego: 1, ang: plan.ang, pot: plan.pot }); tiros++; plan = null; t = -99; }
      },
    };
  },
};

if (typeof BOTS !== "undefined") BOTS.artilleria = ArtilleriaBot;
