// ==========================================================================
//  Bot Universal: TETRIS VERSUS (src/tetris.bot.js)
//  Para cada pieza prueba todas las rotaciones y columnas, y elige la que
//  mejor deja el tablero (altura total, huecos, irregularidad, lineas).
//  Ejecuta los movimientos a ritmo humano (~9 por segundo).
// ==========================================================================
"use strict";

const TetrisBot = {
  nuevo() {
    let pieza = -1, plan = [], t = 0, prox = 0;
    function evaluar(tab, lineas) {
      const alt = [];
      let huecos = 0;
      for (let x = 0; x < TT.W; x++) {
        let y = 0;
        while (y < TT.H && tab[y * TT.W + x] === "0") y++;
        alt.push(TT.H - y);
        for (let k = y + 1; k < TT.H; k++) if (tab[k * TT.W + x] === "0") huecos++;
      }
      let rugo = 0;
      for (let x = 1; x < TT.W; x++) rugo += Math.abs(alt[x] - alt[x - 1]);
      const suma = alt.reduce((a, b) => a + b, 0), max = Math.max(...alt);
      return -0.51 * suma - 0.36 * huecos * 2 - 0.18 * rugo + 0.76 * lineas * (lineas >= 2 ? 1.4 : 1) - (max > 14 ? (max - 14) * 4 : 0);
    }
    function planear(p) {
      const tab = p.tab.split("").map(Number), z = p.pz;
      let mejor = -Infinity, mejorPlan = ["drop"];
      for (let r = 0; r < 4; r++) for (let x = -2; x < TT.W; x++) {
        if (!TT.cabe(tab, z.t, r, x, z.y) && !TT.cabe(tab, z.t, r, x, z.y + 1)) continue;
        const y0 = TT.cabe(tab, z.t, r, x, z.y) ? z.y : z.y + 1;
        const y = TT.caida(tab, z.t, r, x, y0);
        const f = TT.fijar(tab, z.t, r, x, y);
        if (f.tapado) continue;
        const s = evaluar(f.tab.join(""), f.lineas) + Math.random() * 0.3;
        if (s > mejor) {
          mejor = s;
          const giros = r === 3 ? ["rotI"] : Array(r).fill("rot");
          const dx = x - z.x;
          mejorPlan = [...giros, ...Array(Math.abs(dx)).fill(dx > 0 ? "r" : "l"), "drop"];
        }
      }
      return mejorPlan;
    }
    return {
      step(v, api, dt) {
        if (!v || v.g || v.cuenta) return;
        const p = v.yo === 1 ? v.p1 : v.p2;
        if (!p.vivo || !p.pz) return;
        t += dt;
        if (p.n !== pieza) { pieza = p.n; plan = planear(p); prox = t + Kit.rnd(0.15, 0.3); }
        if (plan.length && t >= prox) { api.accion({ m: plan.shift() }); prox = t + Kit.rnd(0.08, 0.13); }
      },
    };
  },
};

if (typeof BOTS !== "undefined") BOTS.tetris = TetrisBot;
