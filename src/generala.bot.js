// ==========================================================================
//  Bot Universal: GENERALA (src/generala.bot.js)
//  Para cada forma de guardar dados (32) simula la proxima tirada y se queda
//  con la que mas promete. Valora cada categoria contra un "par" (3 iguales
//  en los numeros, etc.) para no quemar la generala con un 2.
// ==========================================================================
"use strict";

const GeneralaBot = (() => {
  const PAR = { 1: 3, 2: 6, 3: 9, 4: 12, 5: 15, 6: 18, esc: 10, full: 14, poker: 12, gen: 8, dgen: 4 };
  function valor(d, p, servido) {
    let mejor = -Infinity, cat = null;
    for (const k of GEN.CATS) {
      if (p[k] !== null) continue;
      const s = GEN.puntaje(k, d, servido, p) - PAR[k];
      if (s > mejor) { mejor = s; cat = k; }
    }
    return { v: mejor, cat };
  }
  function esperado(d, guardar, p, n) {
    let s = 0;
    for (let i = 0; i < n; i++) {
      const x = d.map((v, k) => (guardar[k] ? v : 1 + Math.floor(Math.random() * 6)));
      s += valor(x, p, false).v;
    }
    return s / n;
  }

  function elegir(v) {
    const p = v.planillas[v.yo];
    if (!v.tiradas) return { tirar: 1 };
    const ahora = valor(v.dados, p, v.tiradas === 1);
    if (v.tiradas < 3) {
      let mejor = -Infinity, mascara = null;
      for (let m = 0; m < 32; m++) {
        const g = [0, 1, 2, 3, 4].map((k) => !!(m & (1 << k)));
        if (m === 31) continue;
        const e = esperado(v.dados, g, p, 36) + (v.tiradas === 1 ? 2 : 0);   // queda otra tirada mas
        if (e > mejor) { mejor = e; mascara = g; }
      }
      if (mascara && mejor > ahora.v + 1) {
        if (mascara.some((x, k) => x !== v.guardados[k])) return { fijar: mascara };
        return { tirar: 1 };
      }
    }
    return { anotar: ahora.cat };
  }

  return Kit.botTurnos(elegir, { espera: [0.7, 1.2] });
})();

if (typeof BOTS !== "undefined") BOTS.generala = GeneralaBot;
