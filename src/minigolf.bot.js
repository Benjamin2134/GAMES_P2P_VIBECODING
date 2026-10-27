// ==========================================================================
//  Bot Universal: MINIGOLF (src/minigolf.bot.js)
//  Prueba tiros con la misma fisica (barrido grueso y despues fino alrededor
//  del mejor) y elige el que deja la bola mas cerca del hoyo. Le suma un
//  pulso humano: un poco de error en angulo y fuerza. Mueve la mira antes de pegar.
// ==========================================================================
"use strict";

const MinigolfBot = {
  nuevo() {
    let plan = null, t = 0;
    function evaluar(h, bolas, j, ang, pot) {
      const b = MG.simular(h, bolas, j, ang, pot, 1 / 60);
      if (b.dentro) return -1000 + pot * 10;
      return Math.hypot(b.x - h.hoyo[0], b.y - h.hoyo[1]) + (MG.enArena(h, b) ? 40 : 0);
    }
    function planear(v) {
      const h = MG.HOYOS[v.n];
      const bolas = {};
      for (const j of [1, 2]) bolas[j] = { x: v.bolas[j].x, y: v.bolas[j].y, vx: 0, vy: 0, dentro: v.bolas[j].d };
      let mejor = Infinity, ma = 0, mp = 0.4;
      for (let a = 0; a < 360; a += 4) for (let p = 0.1; p <= 1.001; p += 0.065) {
        const s = evaluar(h, bolas, v.yo, (a * Math.PI) / 180, p);
        if (s < mejor) { mejor = s; ma = (a * Math.PI) / 180; mp = p; }
      }
      for (let da = -3; da <= 3; da += 1) for (let dp = -0.03; dp <= 0.031; dp += 0.015) {
        const a = ma + (da * Math.PI) / 180, p = clamp(mp + dp, 0.05, 1);
        const s = evaluar(h, bolas, v.yo, a, p);
        if (s < mejor) { mejor = s; ma = a; mp = p; }
      }
      return { ang: ma + (Math.random() * 2 - 1) * 0.03, pot: clamp(mp * (1 + (Math.random() * 2 - 1) * 0.05), 0.05, 1) };
    }
    return {
      step(v, api, dt) {
        if (!v || v.g || v.turno !== v.yo || v.fase !== "apunta") { plan = null; t = 0; return; }
        if (!plan) { plan = planear(v); t = 0; }
        t += dt;
        const k = Math.min(1, t / 1.0);
        api.input({ ang: plan.ang, pot: plan.pot * k });
        if (t > 1.4) { api.accion({ tiro: 1, ang: plan.ang, pot: plan.pot }); plan = null; t = -99; }
      },
    };
  },
};

if (typeof BOTS !== "undefined") BOTS.minigolf = MinigolfBot;
