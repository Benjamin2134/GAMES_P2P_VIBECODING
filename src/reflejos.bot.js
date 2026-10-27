// ==========================================================================
//  Bot Universal: DUELO DE REFLEJOS (src/reflejos.bot.js)
//  Reacciona entre 210 y 360 ms despues de ver la señal (como un humano
//  rapido). Con la señal trampa a veces se le escapa el dedo (6%).
// ==========================================================================
"use strict";

const ReflejosBot = {
  nuevo() {
    let ronda = 0, t0 = -1, meta = 0, t = 0, trampaVista = 0;
    return {
      step(v, api, dt) {
        if (!v || v.g) return;
        t += dt;
        if (v.fase === "trampa" && trampaVista !== v.r) {
          trampaVista = v.r;
          if (Math.random() < 0.06) api.accion({ r: v.r, falso: 1 });
        }
        if (v.fase !== "ya" || v.ya[v.yo]) return;
        if (ronda !== v.r) { ronda = v.r; t0 = t; meta = Kit.rnd(0.21, 0.36); }
        if (t - t0 >= meta) api.accion({ r: v.r, ms: Math.round((t - t0) * 1000) });
      },
    };
  },
};

if (typeof BOTS !== "undefined") BOTS.reflejos = ReflejosBot;
