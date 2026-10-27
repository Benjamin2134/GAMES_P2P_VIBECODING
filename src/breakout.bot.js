// ==========================================================================
//  Bot Universal: BREAKOUT VERSUS (src/breakout.bot.js)
//  Predice donde llega a su lado cada pelota que viene hacia el (con rebotes
//  en techo y piso) y se pone ahi, con error y retraso humanos.
// ==========================================================================
"use strict";

const BreakoutBot = {
  nuevo() {
    let t = 0, prox = 0, meta = 320, errorY = 0, saque = 0;
    return {
      step(v, api, dt) {
        if (!v || v.g) return;
        t += dt;
        const px = BK.PX[v.yo], hacia = (vx) => (v.yo === 1 ? vx < 0 : vx > 0);
        if (t >= prox) {
          prox = t + Kit.rnd(0.1, 0.18);
          let mejor = Infinity;
          meta = 320;
          for (const [x, y, , pega, vx, vy] of v.bolas) {
            if (pega || !hacia(vx) || !vx) continue;
            const tl = (px - x) / vx;
            if (tl < 0 || tl > mejor) continue;
            mejor = tl;
            // rebotes en techo y piso
            const alto = BK.Y1 - BK.Y0 - 2 * BK.R;
            let yy = y + vy * tl - BK.Y0 - BK.R;
            yy = ((yy % (2 * alto)) + 2 * alto) % (2 * alto);
            meta = BK.Y0 + BK.R + (yy > alto ? 2 * alto - yy : yy);
            if (Math.random() < 0.3) errorY = (Math.random() - 0.5) * 70;
          }
          if (mejor === Infinity) { const b = v.bolas.find((q) => !q[3]); if (b) meta = 320 + (b[1] - 320) * 0.5; errorY = 0; }
        }
        api.input({ y: meta + errorY });
        if (v.bolas.some((b) => b[6] === v.yo && b[3])) { saque += dt; if (saque > 0.6) { api.accion({ saca: 1 }); saque = 0; } }
      },
    };
  },
};

if (typeof BOTS !== "undefined") BOTS.breakout = BreakoutBot;
