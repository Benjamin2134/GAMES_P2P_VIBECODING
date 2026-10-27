// ==========================================================================
//  Bot Universal: DUDO (src/dudo.bot.js)
//  Solo ve sus dados. Estima cuantos hay de cada pinta: los suyos + los
//  ocultos del rival por probabilidad (1/3 con comodin, 1/6 para ases).
//  Duda si la apuesta supera bastante lo esperado; a veces calza; si no, sube
//  con la pinta que mas le conviene (y de vez en cuando farolea).
// ==========================================================================
"use strict";

const DudoBot = (() => {
  function esperado(v, c) { return DUDO.cuenta(v.mios, c) + v.nRival * (c === 1 ? 1 / 6 : 1 / 3); }

  function elegir(v) {
    if (v.fase !== "apuesta") return null;
    const ap = v.apuesta;
    if (ap) {
      const e = esperado(v, ap.c);
      if (ap.q - e > 0.9 + Math.random() * 0.7) return { dudo: 1 };
      if (Math.abs(ap.q - e) < 0.4 && Math.random() < 0.22) return { calzo: 1 };
    }
    let mejor = null, ms = -Infinity;
    for (let c = 1; c <= 6; c++) {
      const q = DUDO.minima(ap, c, v.nMio);
      if (q > v.nMio + v.nRival) continue;
      const margen = esperado(v, c) - q + (Math.random() < 0.15 ? 1 : 0);   // farol ocasional
      const s = margen + c * 0.02;
      if (s > ms) { ms = s; mejor = { q, c }; }
    }
    if (!mejor || (ap && ms < -0.6)) return ap ? { dudo: 1 } : mejor;
    // al abrir, apuesta un poco por debajo de lo esperado
    if (!ap) mejor.q = Math.max(1, Math.min(mejor.q + Math.floor(Math.max(0, ms - 0.5)), Math.floor(esperado(v, mejor.c))));
    return mejor;
  }

  return Kit.botTurnos(elegir, { espera: [0.8, 1.5], puede: (v) => v.turno === v.yo && v.fase === "apuesta" });
})();

if (typeof BOTS !== "undefined") BOTS.dudo = DudoBot;
