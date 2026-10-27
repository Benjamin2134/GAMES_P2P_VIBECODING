// ==========================================================================
//  Bot Universal: REVERSI (src/reversi.bot.js)
//  Negamax alfa-beta a 4 jugadas: pesos posicionales clasicos (esquinas
//  valen oro, las casillas X al lado regalan esquinas) + movilidad.
// ==========================================================================
"use strict";

const ReversiBot = (() => {
  const PESOS = [
    100, -20, 10, 5, 5, 10, -20, 100,
    -20, -50, -2, -2, -2, -2, -50, -20,
    10, -2, 1, 1, 1, 1, -2, 10,
    5, -2, 1, 0, 0, 1, -2, 5,
    5, -2, 1, 0, 0, 1, -2, 5,
    10, -2, 1, 1, 1, 1, -2, 10,
    -20, -50, -2, -2, -2, -2, -50, -20,
    100, -20, 10, 5, 5, 10, -20, 100,
  ];
  const otro = (j) => (j === 1 ? 2 : 1);
  const R = {
    movs(s) {
      const m = RV.validas(s.tab, s.turno);
      if (m.length) return m.sort((a, b) => PESOS[b] - PESOS[a]);
      return RV.validas(s.tab, otro(s.turno)).length ? [-1] : [];   // -1 = pasar
    },
    aplicar(s, i) {
      if (i < 0) return { tab: s.tab, turno: otro(s.turno) };
      const tab = s.tab.slice();
      for (const k of RV.volteos(tab, i, s.turno)) tab[k] = s.turno;
      tab[i] = s.turno;
      return { tab, turno: otro(s.turno) };
    },
    fin(s) {
      if (RV.validas(s.tab, s.turno).length || RV.validas(s.tab, otro(s.turno)).length) return null;
      const c = RV.cuenta(s.tab), d = c[s.turno] - c[otro(s.turno)];
      return d > 0 ? 10000 + d : d < 0 ? -10000 + d : 0;
    },
    eval(s) {
      const j = s.turno, o = otro(j);
      let p = 0;
      for (let i = 0; i < 64; i++) { if (s.tab[i] === j) p += PESOS[i]; else if (s.tab[i] === o) p -= PESOS[i]; }
      return p + (RV.validas(s.tab, j).length - RV.validas(s.tab, o).length) * 5;
    },
  };

  function elegir(v) {
    if (!v.validas.length) return null;
    const prof = Math.random() < 0.2 ? 2 : 4;
    const r = Kit.negamax({ tab: v.tab, turno: v.yo }, prof, -Infinity, Infinity, R);
    return { i: r.m !== null && r.m >= 0 ? r.m : v.validas[0] };
  }

  return Kit.botTurnos(elegir);
})();

if (typeof BOTS !== "undefined") BOTS.reversi = ReversiBot;
