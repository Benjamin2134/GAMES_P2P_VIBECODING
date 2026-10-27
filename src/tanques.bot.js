// ==========================================================================
//  Bot Universal: TANQUES (src/tanques.bot.js)
//  Cada ~0,15 s traza disparos en abanico con la misma fisica de rebote y
//  busca uno que pase por el rival (directo o de rebote). Gira hacia ese
//  angulo y dispara al quedar alineado. Si no hay tiro, se acerca por una
//  grilla de 40 px esquivando muros. Esquiva balas que vienen hacia el.
// ==========================================================================
"use strict";

const TanquesBot = {
  nuevo() {
    let t = 0, prox = 0, angTiro = null, ruta = null, rutaT = 0;
    const CEL = 40;
    function trazar(x, y, a, objetivo, propio, vb) {
      const b = { x: x + Math.cos(a) * (TQ.R + 6), y: y + Math.sin(a) * (TQ.R + 6), vx: Math.cos(a) * vb, vy: Math.sin(a) * vb };
      let reb = 0;
      for (let k = 0; k < 180; k++) {
        if (TQ.mover(b, 1 / 60)) reb++;
        if (reb > TQ.REBOTES) return false;
        if (Math.hypot(b.x - objetivo.x, b.y - objetivo.y) < TQ.R) return true;
        if (k > 8 && Math.hypot(b.x - propio.x, b.y - propio.y) < TQ.R + 4) return false;
      }
      return false;
    }
    function camino(desde, hasta) {
      const cx = (p) => Math.floor((p.x - TQ.X0) / CEL), cy = (p) => Math.floor((p.y - TQ.Y0) / CEL);
      const W = Math.ceil((TQ.X1 - TQ.X0) / CEL), H = Math.ceil((TQ.Y1 - TQ.Y0) / CEL);
      const libre = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !TQ.dentroMuro(TQ.X0 + x * CEL + CEL / 2, TQ.Y0 + y * CEL + CEL / 2, TQ.R - 4);
      const ini = [cx(desde), cy(desde)], fin = [cx(hasta), cy(hasta)], prev = new Map([[ini + "", null]]), cola = [ini];
      while (cola.length) {
        const c = cola.shift();
        if (c[0] === fin[0] && c[1] === fin[1]) break;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = [c[0] + dx, c[1] + dy];
          if (!prev.has(n + "") && libre(n[0], n[1])) { prev.set(n + "", c); cola.push(n); }
        }
      }
      if (!prev.has(fin + "")) return null;
      const r = [];
      for (let c = fin; c; c = prev.get(c + "")) r.unshift({ x: TQ.X0 + c[0] * CEL + CEL / 2, y: TQ.Y0 + c[1] * CEL + CEL / 2 });
      return r;
    }
    const difAng = (a, b) => ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return {
      step(v, api, dt) {
        if (!v || v.g || v.fase !== "juego") { api.input({ giro: 0, mov: 0, fuego: false }); return; }
        t += dt;
        const yo = v.yo === 1 ? v.t1 : v.t2, riv = v.yo === 1 ? v.t2 : v.t1;
        if (!yo.v) return;
        if (t >= prox) {
          prox = t + Kit.rnd(0.12, 0.3);   // reaccion humana variable
          angTiro = null;
          let mejor = Infinity;
          for (let k = 0; k < 72; k++) {
            const a = (k / 72) * Math.PI * 2;
            if (trazar(yo.x, yo.y, a, riv, yo, TQ.BALA * (v.sd ? 1.6 : 1))) { const d = Math.abs(difAng(yo.a, a)); if (d < mejor) { mejor = d; angTiro = a; } }
          }
          if (angTiro !== null) angTiro += (Math.random() - 0.5) * 0.06;   // pulso imperfecto
        }
        let giro = 0, mov = 0, fuego = false;
        if (angTiro !== null) {
          const d = difAng(yo.a, angTiro);
          giro = Math.abs(d) < 0.05 ? 0 : Math.sign(d);
          fuego = Math.abs(d) < 0.07;
        } else {
          if (!ruta || t > rutaT) { ruta = camino(yo, riv); rutaT = t + 0.6; }
          const p = ruta && ruta.find((q) => Math.hypot(q.x - yo.x, q.y - yo.y) > 30);
          if (p) {
            const d = difAng(yo.a, Math.atan2(p.y - yo.y, p.x - yo.x));
            giro = Math.abs(d) < 0.1 ? 0 : Math.sign(d);
            mov = Math.abs(d) < 0.9 ? 1 : 0;
          }
        }
        // esquivar balas cercanas que se acercan
        for (const [bx, by, , bvx, bvy] of v.balas) {
          const rx = yo.x - bx, ry = yo.y - by, dist = Math.hypot(rx, ry);
          if (dist < 110 && rx * bvx + ry * bvy > 0) { mov = Math.abs(difAng(yo.a, Math.atan2(bvy, bvx))) < Math.PI / 2 ? 1 : -1; break; }
        }
        api.input({ giro, mov, fuego });
      },
    };
  },
};

if (typeof BOTS !== "undefined") BOTS.tanques = TanquesBot;
