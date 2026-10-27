// ==========================================================================
//  Bot Universal: FUTBOL DE AUTOS (src/futbol.bot.js)
//  Se pone detras de la pelota (respecto del arco rival) y acelera hacia
//  ella; salta si la pelota viene por arriba y cerca; usa turbo si esta
//  lejos. Si la pelota esta mas cerca de su arco que el, vuelve a defender.
// ==========================================================================
"use strict";

const FutbolBot = {
  nuevo() {
    let t = 0, prox = 0, plan = { x: 0, turbo: false }, saltoCd = 0;
    return {
      step(v, api, dt) {
        if (!v || v.g || v.pausa) { api.input({ x: 0, turbo: false }); return; }
        t += dt; saltoCd -= dt;
        const yo = v.yo === 1 ? v.c1 : v.c2, b = v.b;
        const ataca = v.yo === 1 ? 1 : -1, miArco = v.yo === 1 ? FU.X0 : FU.X1;
        if (t >= prox) {
          prox = t + Kit.rnd(0.08, 0.16);
          const pred = b.x + b.vx * 0.25;
          const peligro = Math.abs(pred - miArco) < Math.abs(yo.x - miArco) - 20;
          let meta = peligro ? miArco + ataca * 60 : pred - ataca * 55;
          const detras = (pred - yo.x) * ataca > 0;
          if (!peligro && detras) meta = pred + ataca * 20;
          const dx = meta - yo.x;
          plan = { x: Math.abs(dx) > 14 ? Math.sign(dx) : 0, turbo: yo.s && Math.abs(dx) > 260 && yo.t > 20 };
          // en el aire: mantener el auto derecho
          if (!yo.s) { const inc = Math.sin(yo.a); plan.x = Math.abs(inc) > 0.2 ? -Math.sign(inc) * (yo.d > 0 ? 1 : -1) : 0; plan.turbo = false; }
          const cerca = Math.abs(b.x - yo.x) < 110 && b.y < yo.y - 50 && b.y > yo.y - 190;
          if (cerca && yo.s && saltoCd <= 0 && Math.random() < 0.7) { api.accion({ salto: 1 }); saltoCd = 0.8; }
        }
        api.input(plan);
      },
    };
  },
};

if (typeof BOTS !== "undefined") BOTS.futbol = FutbolBot;
