// ==========================================================================
//  Bot Universal: GOMOKU (src/gomoku.bot.js)
//  Heuristica clasica de amenazas: puntua cada casilla cercana a las piedras
//  por las lineas que arma (ataque) y las que corta (defensa).
// ==========================================================================
"use strict";

const GomokuBot = (() => {
  const N = GK.N;
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

  // Valor de poner j en i mirando una direccion: piedras seguidas y extremos abiertos.
  function patron(tab, i, j, df, dc) {
    const f = Math.floor(i / N), c = i % N;
    let n = 1, abiertos = 0;
    for (const s of [1, -1]) {
      let ff = f + df * s, cc = c + dc * s;
      while (ff >= 0 && ff < N && cc >= 0 && cc < N && tab[ff * N + cc] === j) { n++; ff += df * s; cc += dc * s; }
      if (ff >= 0 && ff < N && cc >= 0 && cc < N && !tab[ff * N + cc]) abiertos++;
    }
    if (n >= 5) return 1e7;
    if (!abiertos) return 0;
    if (n === 4) return abiertos === 2 ? 2e5 : 2e4;
    if (n === 3) return abiertos === 2 ? 8e3 : 600;
    if (n === 2) return abiertos === 2 ? 300 : 40;
    return abiertos === 2 ? 10 : 2;
  }
  function valor(tab, i, j) {
    let s = 0;
    for (const [df, dc] of DIRS) s += patron(tab, i, j, df, dc);
    return s;
  }

  function elegir(v) {
    const tab = v.tab, j = v.yo, o = j === 1 ? 2 : 1;
    if (tab.every((x) => !x)) return { i: 7 * N + 7 };
    let mejor = -1, mi = -1;
    for (let i = 0; i < N * N; i++) {
      if (tab[i]) continue;
      // solo casillas a distancia 2 de alguna piedra
      const f = Math.floor(i / N), c = i % N;
      let cerca = false;
      for (let df = -2; df <= 2 && !cerca; df++) for (let dc = -2; dc <= 2; dc++) {
        const ff = f + df, cc = c + dc;
        if (ff >= 0 && ff < N && cc >= 0 && cc < N && tab[ff * N + cc]) { cerca = true; break; }
      }
      if (!cerca) continue;
      const s = valor(tab, i, j) * 1.1 + valor(tab, i, o) * (0.85 + Math.random() * 0.1) + Math.random() * 3;
      if (s > mejor) { mejor = s; mi = i; }
    }
    if (mi < 0) mi = tab.findIndex((x) => !x);
    return mi < 0 ? null : { i: mi };
  }

  return Kit.botTurnos(elegir, { espera: [0.5, 1.0] });
})();

if (typeof BOTS !== "undefined") BOTS.gomoku = GomokuBot;
