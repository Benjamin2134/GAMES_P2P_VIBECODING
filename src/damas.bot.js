// ==========================================================================
//  Bot Universal: DAMAS (src/damas.bot.js)
//  Negamax alfa-beta a 5 medias jugadas (las capturas encadenadas no gastan
//  turno del rival). Material (dama ~3 peones), avance y control del centro.
// ==========================================================================
"use strict";

const DamasBot = (() => {
  const otro = (j) => (j === 1 ? 2 : 1);
  function evalPara(tab, j) {
    let s = 0;
    for (let i = 0; i < 64; i++) {
      const x = tab[i];
      if (!x) continue;
      const d = DM.dueno(x), f = i >> 3, c = i & 7;
      let v = DM.rey(x) ? 320 : 100 + (d === 1 ? 7 - f : f) * 4;
      if (c >= 2 && c <= 5 && f >= 2 && f <= 5) v += 6;
      if (!DM.rey(x) && (d === 1 ? f === 7 : f === 0)) v += 8;   // fila de fondo defiende la coronacion
      s += d === j ? v : -v;
    }
    return s;
  }
  const R = {
    movs: (s) => {
      const m = DM.movs(s.tab, s.turno, s.enc);
      return m.sort((a, b) => (b.cap >= 0) - (a.cap >= 0));
    },
    aplicar(s, m) {
      const r = DM.aplicar(s.tab, m);
      return r.sigue ? { tab: r.tab, turno: s.turno, enc: m.a } : { tab: r.tab, turno: otro(s.turno), enc: -1 };
    },
    sigue: (s, s2) => s2.turno === s.turno,
    fin: (s, prof) => (DM.movs(s.tab, s.turno, s.enc).length ? null : -(100000 + prof)),
    eval: (s) => evalPara(s.tab, s.turno),
  };

  function elegir(v) {
    if (!v.movs.length) return null;
    const prof = Math.random() < 0.2 ? 3 : 5;
    const r = Kit.negamax({ tab: v.tab, turno: v.yo, enc: v.enc }, prof, -Infinity, Infinity, R);
    const m = r.m || { de: v.movs[0][0], a: v.movs[0][1] };
    return { de: m.de, a: m.a };
  }

  // el encadenado se ve rapido (como un humano que ya sabe por donde sigue)
  return Kit.botTurnos(elegir, { espera: [0.55, 1.0] });
})();

if (typeof BOTS !== "undefined") BOTS.damas = DamasBot;
