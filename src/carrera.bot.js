// ==========================================================================
//  Bot Universal: CARRERA (src/carrera.bot.js)
//  Mira un punto de la linea central mas adelante (mas lejos cuanto mas
//  rapido va) y dobla hacia el. Frena si la curva que viene es cerrada.
// ==========================================================================
"use strict";

const CarreraBot = {
  nuevo() {
    const ritmo = Kit.rnd(0.86, 0.95);   // no todos los bots van al limite
    return {
      step(v, api) {
        if (!v || v.g || v.cuenta) { api.input({ gas: 0, giro: 0 }); return; }
        const yo = v.yo === 1 ? v.c1 : v.c2;
        const adelante = 9 + Math.round(yo.v / 30);
        const [tx, ty] = CR.PTS[(yo.idx + adelante) % CR.N];
        const d = ((Math.atan2(ty - yo.y, tx - yo.x) - yo.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        // curvatura: cuanto gira la pista entre aqui y mas adelante
        const p0 = CR.PTS[(yo.idx + 5) % CR.N], p1 = CR.PTS[(yo.idx + 20) % CR.N], p2 = CR.PTS[(yo.idx + 35) % CR.N];
        const a1 = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), a2 = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
        const curva = Math.abs(((a2 - a1 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        const vObj = CR.VMAX * ritmo * (1 - Math.min(0.55, curva * 0.55));
        const gas = yo.v > vObj + 30 ? -1 : yo.v < vObj ? 1 : 0.3;
        api.input({ gas, giro: clamp(d * 2.2, -1, 1), mano: false });
      },
    };
  },
};

if (typeof BOTS !== "undefined") BOTS.carrera = CarreraBot;
