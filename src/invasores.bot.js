// ==========================================================================
//  Bot Universal: INVASORES (src/invasores.bot.js)
//  Se ubica bajo la columna con invasores mas bajos (o el platillo) y
//  dispara al quedar alineado. Se corre si una bala enemiga le cae encima.
// ==========================================================================
"use strict";

const InvasoresBot = {
  nuevo() {
    let t = 0, prox = 0, meta = 480;
    return {
      step(v, api, dt) {
        if (!v || v.g || v.espera) { api.input({ dx: 0, fuego: false }); return; }
        t += dt;
        const yo = v.yo === 1 ? v.c1 : v.c2;
        if (t >= prox) {
          prox = t + Kit.rnd(0.12, 0.25);
          if (v.ovni !== null && v.ovni > 40 && v.ovni < 920) meta = v.ovni;
          else {
            let mejor = Infinity;
            for (let c = 0; c < IV.COLS; c++) for (let f = IV.FILAS - 1; f >= 0; f--) {
              if (v.inv[f * IV.COLS + c] !== "1") continue;
              const x = v.fx + c * IV.DX + 15, d = Math.abs(x - yo.x) - f * 30;
              if (d < mejor) { mejor = d; meta = x + (Math.random() - 0.5) * 10; }
              break;
            }
          }
        }
        let dx = Math.abs(meta - yo.x) > 6 ? Math.sign(meta - yo.x) : 0;
        for (const [bx, by] of v.bi) if (by > 380 && Math.abs(bx - yo.x) < 26) { dx = bx > yo.x ? -1 : 1; break; }
        api.input({ dx, fuego: Math.abs(meta - yo.x) < 14 && !yo.m });
      },
    };
  },
};

if (typeof BOTS !== "undefined") BOTS.invasores = InvasoresBot;
