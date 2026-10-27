// ==========================================================================
//  Bot Universal: CURLING (src/curling.bot.js)
//  Simula lanzamientos (direccion x fuerza x giro) con la misma fisica y
//  elige el que deja la entrada mejor para el: sus piedras puntuando y las
//  rivales lejos del centro. Con error humano en direccion y fuerza.
// ==========================================================================
"use strict";

const CurlingBot = {
  nuevo() {
    let plan = null, t = 0;
    function valor(ps, j) {
      const [g, n] = CU.puntaje(ps);
      let s = g === j ? n * 100 : g ? -n * 100 : 0;
      const mia = ps.filter((p) => p.j === j).map(CU.dCasa).sort((a, b) => a - b)[0];
      const suya = ps.filter((p) => p.j !== j).map(CU.dCasa).sort((a, b) => a - b)[0];
      if (mia !== undefined) s -= mia * 0.3;
      if (suya !== undefined) s += Math.min(suya, 200) * 0.25;
      return s;
    }
    function planear(v) {
      const ps = v.piedras.map((p) => ({ ...p, vx: 0, vy: 0, giro: 0 }));
      let mejor = -Infinity, pl = { ang: 0, pot: 0.25, giro: 1 };
      const pots = [];
      for (let p = 0.14; p <= 0.4; p += 0.02) pots.push(p);
      pots.push(0.55, 0.7, 0.85);
      for (const giro of [1, -1]) for (let a = -0.07; a <= 0.0701; a += 0.005) for (const pot of pots) {
        const s = valor(CU.simular(ps, v.yo, a, pot, giro), v.yo);
        if (s > mejor) { mejor = s; pl = { ang: a, pot, giro }; }
      }
      return { ang: pl.ang + (Math.random() * 2 - 1) * 0.004, pot: clamp(pl.pot + (Math.random() * 2 - 1) * 0.012, 0, 1), giro: pl.giro };
    }
    return {
      step(v, api, dt) {
        if (!v || v.g || v.turno !== v.yo || v.fase !== "apunta") { plan = null; t = 0; return; }
        if (!plan) { plan = planear(v); t = 0; }
        t += dt;
        api.input({ ang: plan.ang * Math.min(1, t), pot: plan.pot * Math.min(1, t), giro: plan.giro });
        if (t > 1.5) { api.accion({ lanza: 1, ...plan }); plan = null; t = -99; }
      },
    };
  },
};

if (typeof BOTS !== "undefined") BOTS.curling = CurlingBot;
