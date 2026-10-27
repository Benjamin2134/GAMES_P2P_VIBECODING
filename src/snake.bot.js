// ==========================================================================
//  Bot Universal: SNAKE DUELO (src/snake.bot.js)
//  BFS hacia la manzana mas cercana (la dorada si esta a mano). Antes de
//  doblar mira cuanto espacio libre le queda (flood fill) para no encerrarse.
// ==========================================================================
"use strict";

const SnakeBot = {
  nuevo() {
    return {
      step(v, api) {
        if (!v || v.g || v.fase !== "juego") return;
        const yo = v.yo === 1 ? v.s1 : v.s2, otro = v.yo === 1 ? v.s2 : v.s1;
        if (!yo.v) return;
        const ocup = new Set();
        for (const s of [yo, otro]) s.c.forEach(([x, y], k) => { if (k < s.c.length - 1) ocup.add(x + "," + y); });
        // evitar las celdas junto a la cabeza rival (posible choque de cabezas)
        const [ox, oy] = otro.c[0], peligro = new Set();
        for (const d of Object.values(SN.DIR)) peligro.add(ox + d[0] + "," + (oy + d[1]));
        const libre = (x, y) => x >= 0 && y >= 0 && x < SN.C && y < SN.F && !ocup.has(x + "," + y);
        const area = (x0, y0) => {
          const vis = new Set([x0 + "," + y0]), cola = [[x0, y0]];
          while (cola.length && vis.size < 160) {
            const [x, y] = cola.shift();
            for (const d of Object.values(SN.DIR)) { const k = x + d[0] + "," + (y + d[1]); if (!vis.has(k) && libre(x + d[0], y + d[1])) { vis.add(k); cola.push([x + d[0], y + d[1]]); } }
          }
          return vis.size;
        };
        const [hx, hy] = yo.c[0];
        const metas = v.oro ? [v.oro, ...v.manzanas] : v.manzanas;
        // BFS desde la cabeza: primera direccion de cada celda alcanzada
        const prim = new Map(), cola = [];
        for (const [dn, d] of Object.entries(SN.DIR)) {
          if (dn === SN.OPUESTA[yo.d]) continue;
          const x = hx + d[0], y = hy + d[1];
          if (libre(x, y)) { prim.set(x + "," + y, dn); cola.push([x, y]); }
        }
        let elegida = null;
        while (cola.length) {
          const [x, y] = cola.shift(), dn = prim.get(x + "," + y);
          if (metas.some(([a, b]) => a === x && b === y)) { elegida = dn; break; }
          for (const d of Object.values(SN.DIR)) { const nx = x + d[0], ny = y + d[1], k = nx + "," + ny; if (!prim.has(k) && libre(nx, ny)) { prim.set(k, dn); cola.push([nx, ny]); } }
        }
        // chequeo de espacio: si la direccion elegida encierra, toma la de mas area
        const opciones = Object.entries(SN.DIR).filter(([dn]) => dn !== SN.OPUESTA[yo.d]).map(([dn, d]) => {
          const x = hx + d[0], y = hy + d[1];
          return { dn, a: libre(x, y) ? area(x, y) - (peligro.has(x + "," + y) ? 50 : 0) : -999 };
        });
        const largo = yo.c.length;
        const op = opciones.find((o) => o.dn === elegida);
        if (!op || op.a < Math.min(largo + 4, 120)) elegida = opciones.sort((a, b) => b.a - a.a)[0].dn;
        api.input({ d: elegida });
      },
    };
  },
};

if (typeof BOTS !== "undefined") BOTS.snake = SnakeBot;
