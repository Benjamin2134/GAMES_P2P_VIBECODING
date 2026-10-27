// ==========================================================================
//  Bot Universal: TRES EN RAYA ULTIMATE (src/ultimate.bot.js)
//  Negamax alfa-beta: 4 jugadas si el tablero esta forzado, 2 si es libre.
//  Evalua lineas del tablero grande (pesadas) y de cada tablero chico.
// ==========================================================================
"use strict";

const UltimateBot = (() => {
  const otro = (j) => (j === 1 ? 2 : 1);
  function lineas(a, j, peso2, peso1) {
    const o = otro(j);
    let s = 0;
    for (const l of UT.LINEAS) {
      let m = 0, r = 0;
      for (const i of l) { if (a[i] === j) m++; else if (a[i] === o) r++; else if (a[i] === 3) { m = -9; } }
      if (m < 0) continue;
      if (m && !r) s += m === 2 ? peso2 : peso1;
      if (r && !m) s -= r === 2 ? peso2 : peso1;
    }
    return s;
  }
  function evalPara(s, j) {
    let v = lineas(s.gane, j, 120, 25);
    for (let b = 0; b < 9; b++) {
      if (s.gane[b] === j) v += b === 4 ? 40 : 25;
      else if (s.gane[b] === otro(j)) v -= b === 4 ? 40 : 25;
      else if (!s.gane[b]) v += lineas(s.tab.slice(b * 9, b * 9 + 9), j, 6, 1);
    }
    return v;
  }
  const R = {
    movs: (s) => (s.res ? [] : UT.movs(s.tab, s.gane, s.activo)),
    aplicar(s, [b, k]) { const r = UT.jugar(s, b, k, s.turno); r.turno = otro(s.turno); r.quien = s.turno; return r; },
    fin: (s, prof) => (!s.res ? null : s.res === 3 ? 0 : s.res === s.turno ? 100000 + prof : -(100000 + prof)),
    eval: (s) => evalPara(s, s.turno),
  };

  function elegir(v) {
    const s = { tab: v.tab, gane: v.gane, activo: v.activo, turno: v.yo, res: 0 };
    const ms = UT.movs(v.tab, v.gane, v.activo);
    if (!ms.length) return null;
    const prof = ms.length > 12 ? 2 : Math.random() < 0.2 ? 2 : 4;
    Kit.mezclar(ms);
    const r = Kit.negamax(s, prof, -Infinity, Infinity, { ...R, movs: (x) => (x === s ? ms : R.movs(x)) });
    const m = r.m || ms[0];
    return { b: m[0], k: m[1] };
  }

  return Kit.botTurnos(elegir);
})();

if (typeof BOTS !== "undefined") BOTS.ultimate = UltimateBot;
