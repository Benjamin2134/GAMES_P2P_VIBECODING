// ==========================================================================
//  Bot Universal: MEMORICE (src/memorice.bot.js)
//  Memoria imperfecta: anota cada carta que ve boca arriba (en cualquier
//  turno), pero al decidir solo recuerda cada una con 80% de probabilidad.
// ==========================================================================
"use strict";

const MemoriceBot = {
  nuevo() {
    const mem = new Map();     // indice -> cara vista
    let t = 0, meta = Kit.rnd(0.7, 1.1);
    return {
      step(v, api, dt) {
        if (!v) return;
        v.cartas.forEach((c, i) => { if (c >= 0) mem.set(i, c); });
        for (let i = 0; i < 30; i++) if (v.dueno[i]) mem.delete(i);
        if (v.g || v.turno !== v.yo || v.espera || v.arriba.length >= 2) { t = 0; return; }
        t += dt;
        if (t < meta) return;
        t = 0; meta = Kit.rnd(0.7, 1.1);

        const recuerdo = [...mem.entries()].filter(([i]) => !v.arriba.includes(i) && Math.random() < 0.8);
        const libres = [];
        for (let i = 0; i < 30; i++) if (!v.dueno[i] && !v.arriba.includes(i)) libres.push(i);
        const desconocidas = libres.filter((i) => !mem.has(i));
        let i = -1;
        if (v.arriba.length === 1) {
          const cara = v.cartas[v.arriba[0]];
          const par = recuerdo.find(([, c]) => c === cara);
          if (par) i = par[0];
        } else {
          const visto = new Map();
          for (const [k, c] of recuerdo) {
            if (visto.has(c)) { i = visto.get(c); break; }
            visto.set(c, k);
          }
        }
        if (i < 0) i = Kit.elegir(desconocidas.length ? desconocidas : libres);
        if (i !== undefined && i >= 0) api.accion({ i });
      },
    };
  },
};

if (typeof BOTS !== "undefined") BOTS.memorice = MemoriceBot;
