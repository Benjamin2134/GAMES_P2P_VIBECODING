// ==========================================================================
//  Bot Universal: PAC-DUELO (src/pacduelo.bot.js)
//  Fantasma: BFS hacia donde va el comecocos (o huye si esta asustado).
//  Comecocos: BFS al punto mas cercano evitando las casillas cerca del
//  fantasma; con pildora activa y fantasma cerca, lo persigue.
// ==========================================================================
"use strict";

const PacDueloBot = {
  nuevo() {
    let prox = 0, t = 0;
    // BFS desde (x, y): devuelve {d: primera direccion, n: distancia} a la primera celda que cumple meta
    function bfs(x0, y0, meta, evitar) {
      const vis = new Set([x0 + "," + y0]), cola = [];
      for (const [dn, [dx, dy]] of Object.entries(PD.DIR)) {
        const x = (x0 + dx + PD.C) % PD.C, y = y0 + dy;
        if (PD.pisable(x, y) && !(evitar && evitar(x, y))) { vis.add(x + "," + y); cola.push([x, y, dn, 1]); }
      }
      while (cola.length) {
        const [x, y, d, n] = cola.shift();
        if (meta(x, y)) return { d, n };
        for (const [dx, dy] of Object.values(PD.DIR)) {
          const nx = (x + dx + PD.C) % PD.C, ny = y + dy, k = nx + "," + ny;
          if (!vis.has(k) && PD.pisable(nx, ny) && !(evitar && evitar(nx, ny))) { vis.add(k); cola.push([nx, ny, d, n + 1]); }
        }
      }
      return null;
    }
    return {
      step(v, api, dt) {
        if (!v || v.g || v.fase !== "juego") return;
        t += dt;
        if (t < prox) return;
        prox = t + Kit.rnd(0.06, 0.14);
        const soyPac = v.pac === v.yo, yo = soyPac ? v.ep : v.ef, el = soyPac ? v.ef : v.ep;
        const mx = Math.round(yo.x), my = Math.round(yo.y), ox = Math.round(el.x), oy = Math.round(el.y);
        let r = null;
        if (!soyPac) {
          if (v.susto > 0.8) {
            // huir: la vecina que mas se aleja
            let mejor = -1;
            for (const [dn, [dx, dy]] of Object.entries(PD.DIR)) {
              const x = (mx + dx + PD.C) % PD.C, y = my + dy;
              if (!PD.pisable(x, y)) continue;
              const b = bfs(x, y, (a, c) => a === ox && c === oy);
              const dist = b ? b.n : 99;
              if (dist > mejor) { mejor = dist; r = { d: dn }; }
            }
          } else {
            const [dx, dy] = PD.DIR[el.d] || [0, 0];
            const tx = ox + dx * 2, ty = oy + dy * 2;
            r = (PD.pisable(tx, ty) && bfs(mx, my, (a, c) => a === tx && c === ty)) || bfs(mx, my, (a, c) => a === ox && c === oy);
          }
        } else {
          const distF = Math.abs(mx - ox) + Math.abs(my - oy);
          if (v.susto > 1.5 && distF < 8) r = bfs(mx, my, (a, c) => a === ox && c === oy);
          if (!r && v.susto <= 0 && distF < 6) r = bfs(mx, my, (a, c) => v.puntos[c * PD.C + a] === "o", (a, c) => Math.abs(a - ox) + Math.abs(c - oy) < 2);
          if (!r) r = bfs(mx, my, (a, c) => v.puntos[c * PD.C + a] !== " ", v.susto > 0 ? null : (a, c) => Math.abs(a - ox) + Math.abs(c - oy) < 3);
          if (!r) r = bfs(mx, my, (a, c) => v.puntos[c * PD.C + a] !== " ");
        }
        if (r) api.input({ d: r.d });
      },
    };
  },
};

if (typeof BOTS !== "undefined") BOTS.pacduelo = PacDueloBot;
