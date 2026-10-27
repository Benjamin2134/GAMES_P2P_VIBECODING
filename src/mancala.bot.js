// ==========================================================================
//  Bot Universal: MANCALA (src/mancala.bot.js)
//  Negamax alfa-beta a 6 jugadas; los turnos extra no pasan la mano.
//  Evalua diferencia de graneros y, de desempate, semillas de su lado.
// ==========================================================================
"use strict";

const MancalaBot = (() => {
  const otro = (j) => (j === 1 ? 2 : 1);
  const R = {
    movs: (s) => (s.fin ? [] : [5, 4, 3, 2, 1, 0].filter((k) => s.h[MC.inicio(s.turno) + k] > 0)),
    aplicar(s, k) {
      const r = MC.sembrar(s.h, s.turno, k);
      return { h: r.h, turno: r.extra ? s.turno : otro(s.turno), fin: r.fin, quien: s.turno };
    },
    sigue: (s, s2) => s2.turno === s.turno,
    fin(s, prof) {
      if (!s.fin) return null;
      const d = s.h[MC.granero(s.turno)] - s.h[MC.granero(otro(s.turno))];
      return d > 0 ? 10000 + d + prof : d < 0 ? -10000 + d - prof : 0;
    },
    eval(s) {
      const j = s.turno, o = otro(j);
      let lado = 0;
      for (let k = 0; k < 6; k++) lado += s.h[MC.inicio(j) + k] - s.h[MC.inicio(o) + k];
      return (s.h[MC.granero(j)] - s.h[MC.granero(o)]) * 4 + lado * 0.5;
    },
  };
  function elegir(v) {
    const s = { h: v.h, turno: v.yo, fin: false };
    const ms = R.movs(s);
    if (!ms.length) return null;
    const r = Kit.negamax(s, Math.random() < 0.2 ? 3 : 6, -Infinity, Infinity, R);
    return { k: r.m !== null && r.m !== undefined ? r.m : ms[0] };
  }
  return Kit.botTurnos(elegir);
})();

if (typeof BOTS !== "undefined") BOTS.mancala = MancalaBot;
