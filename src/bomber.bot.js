// ==========================================================================
//  Bot Universal: BOMBERMAN (src/bomber.bot.js)
//  Mapa de peligro (cuando explota cada casilla). Si esta en peligro, BFS a
//  la casilla segura mas cercana. Si no, pone bomba junto a cajas o en linea
//  con el rival, solo si tiene escapatoria; si no, va a mejoras o cajas.
// ==========================================================================
"use strict";

const BomberBot = {
  nuevo() {
    let t = 0, prox = 0, camino = null, cdBomba = 0;
    function peligros(v, extra) {
      const grid = v.grid.split("").map(Number), p = new Map();
      const marca = (x, y, tt) => { const k = y * BM.C + x; p.set(k, Math.min(p.has(k) ? p.get(k) : 99, tt)); };
      const bombas = v.bombas.map(([x, y, tt, r]) => ({ x, y, t: tt, r }));
      if (extra) bombas.push(extra);
      for (const b of bombas) for (const [x, y] of BM.cruz(grid, b.x, b.y, b.r)) marca(x, y, b.t);
      for (const [x, y] of v.llamas) marca(x, y, 0);
      return { grid, p, bombas };
    }
    // BFS: primera casilla que cumple meta, respetando el tiempo de llegada contra el peligro
    function bfs(v, desde, meta, P, vel) {
      const ini = desde[1] * BM.C + desde[0], prev = new Map([[ini, -1]]), cola = [[desde[0], desde[1], 0]];
      while (cola.length) {
        const [x, y, n] = cola.shift(), k = y * BM.C + x;
        if (meta(x, y, n)) { const r = []; for (let c = k; c !== -1; c = prev.get(c)) r.unshift([c % BM.C, Math.floor(c / BM.C)]); return r; }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, nk = ny * BM.C + nx;
          if (prev.has(nk) || !BM.libreEn(P.grid, P.bombas, nx, ny)) continue;
          const llega = (n + 1) / vel;
          if (P.p.has(nk) && P.p.get(nk) < llega + 0.45 && P.p.get(nk) + BM.LLAMA > llega - 0.2) continue;
          prev.set(nk, k); cola.push([nx, ny, n + 1]);
        }
      }
      return null;
    }
    return {
      step(v, api, dt) {
        if (!v || v.g || v.fase !== "juego") { api.input({ dx: 0, dy: 0 }); return; }
        t += dt; cdBomba -= dt;
        const yo = v.yo === 1 ? v.j1 : v.j2, el = v.yo === 1 ? v.j2 : v.j1;
        if (!yo.v) return;
        const mx = Math.round(yo.x), my = Math.round(yo.y), ex = Math.round(el.x), ey = Math.round(el.y);
        if (t >= prox) {
          prox = t + Kit.rnd(0.1, 0.2);
          const P = peligros(v), vel = yo.s;
          const seguro = (x, y) => !P.p.has(y * BM.C + x);
          if (!seguro(mx, my)) camino = bfs(v, [mx, my], seguro, P, vel);
          else {
            const vecinaCaja = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => P.grid[(my + dy) * BM.C + mx + dx] === 2);
            const enLinea = (mx === ex || my === ey) && BM.cruz(P.grid, mx, my, yo.r).some(([x, y]) => x === ex && y === ey);
            const misBombas = v.bombas.filter((b) => b[4] === v.yo).length;
            if ((vecinaCaja || enLinea) && misBombas < yo.b && cdBomba <= 0) {
              const P2 = peligros(v, { x: mx, y: my, t: BM.MECHA, r: yo.r });
              const esc = bfs(v, [mx, my], (x, y, n) => !P2.p.has(y * BM.C + x) && n / vel < BM.MECHA - 0.4, P2, vel);
              if (esc) { api.accion({ bomba: 1 }); cdBomba = 0.6; camino = esc; }
            }
            if (!camino || camino.length < 2) {
              const mejora = new Set(v.mejoras.map(([x, y]) => y * BM.C + x));
              camino = bfs(v, [mx, my], (x, y) => seguro(x, y) && mejora.has(y * BM.C + x), P, vel)
                || bfs(v, [mx, my], (x, y) => seguro(x, y) && (x !== mx || y !== my) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => P.grid[(y + dy) * BM.C + x + dx] === 2), P, vel)
                || bfs(v, [mx, my], (x, y) => seguro(x, y) && Math.abs(x - ex) + Math.abs(y - ey) <= 1, P, vel);
            }
          }
        }
        // seguir el camino casilla por casilla
        if (camino && camino.length) {
          while (camino.length && Math.abs(camino[0][0] - yo.x) < 0.12 && Math.abs(camino[0][1] - yo.y) < 0.12) camino.shift();
          if (camino.length) {
            const [tx, ty] = camino[0], ddx = tx - yo.x, ddy = ty - yo.y;
            api.input(Math.abs(ddx) > Math.abs(ddy) ? { dx: Math.sign(ddx), dy: 0 } : { dx: 0, dy: Math.sign(ddy) });
            return;
          }
        }
        api.input({ dx: 0, dy: 0 });
      },
    };
  },
};

if (typeof BOTS !== "undefined") BOTS.bomber = BomberBot;
