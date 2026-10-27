// ==========================================================================
//  Bot Universal: CONECTA 4 (src/conecta4.bot.js)
//  Negamax alfa-beta a 5 jugadas con evaluacion por ventanas de 4 y bonus
//  de columna central. A veces mira solo 3 jugadas (para que sea ganable).
// ==========================================================================
"use strict";

const Conecta4Bot = (() => {
  // Las 69 ventanas de 4 celdas del tablero
  const VENTANAS = [];
  for (let f = 0; f < 6; f++) for (let c = 0; c < 7; c++)
    for (const [df, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const v = [];
      for (let k = 0; k < 4; k++) {
        const ff = f + df * k, cc = c + dc * k;
        if (ff < 0 || ff >= 6 || cc < 0 || cc >= 7) break;
        v.push(ff * 7 + cc);
      }
      if (v.length === 4) VENTANAS.push(v);
    }
  const ORDEN = [3, 2, 4, 1, 5, 0, 6];

  function evalPara(tab, j) {
    const o = j === 1 ? 2 : 1;
    let s = 0;
    for (let f = 0; f < 6; f++) { if (tab[f * 7 + 3] === j) s += 4; else if (tab[f * 7 + 3] === o) s -= 4; }
    for (const w of VENTANAS) {
      let a = 0, b = 0;
      for (const i of w) { if (tab[i] === j) a++; else if (tab[i] === o) b++; }
      if (a && b) continue;
      if (a === 3) s += 60; else if (a === 2) s += 8;
      if (b === 3) s -= 70; else if (b === 2) s -= 8;
    }
    return s;
  }

  const R = {
    movs: (s) => ORDEN.filter((c) => !s.tab[c]),
    aplicar(s, c) {
      const tab = s.tab.slice();
      const f = C4.caer(tab, c);
      tab[f * 7 + c] = s.turno;
      return { tab, turno: s.turno === 1 ? 2 : 1, gano: !!C4.linea(tab, f, c) };
    },
    // si la jugada anterior gano, el que mueve ahora perdio
    fin: (s, prof) => (s.gano ? -(100000 + prof) : C4.lleno(s.tab) ? 0 : null),
    eval: (s) => evalPara(s.tab, s.turno),
  };

  function elegir(v) {
    const prof = Math.random() < 0.15 ? 3 : 5;
    const r = Kit.negamax({ tab: v.tab, turno: v.yo, gano: false }, prof, -Infinity, Infinity, R);
    return { col: r.m !== null && r.m !== undefined ? r.m : R.movs({ tab: v.tab })[0] };
  }

  return Kit.botTurnos(elegir, { espera: [0.6, 1.1] });
})();

if (typeof BOTS !== "undefined") BOTS.conecta4 = Conecta4Bot;
