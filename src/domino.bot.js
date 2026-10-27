// ==========================================================================
//  Bot Universal: DOMINO (src/domino.bot.js)
//  Solo mira su mano y la mesa. Prefiere soltar fichas pesadas y dobles, y
//  dejar en los extremos numeros que tiene (para no quedarse sin jugada).
// ==========================================================================
"use strict";

const DominoBot = (() => {
  function elegir(v) {
    if (v.fase !== "juego") return null;
    if (v.puedeRobar) return { robar: 1 };
    if (v.puedePasar) return { pasar: 1 };
    let mejor = -Infinity, jug = null;
    for (const i of v.jugables) {
      const f = v.mano[i];
      for (const lado of DOM.lados(f, v.mesa)) {
        // extremo que queda a la vista tras jugar
        let queda = f[1];
        if (v.mesa.length) {
          const ext = lado === "i" ? v.mesa[0].a : v.mesa[v.mesa.length - 1].b;
          queda = f[0] === ext ? f[1] : f[0];
        }
        const resto = v.mano.filter((_, k) => k !== i);
        const tengo = resto.filter((x) => x[0] === queda || x[1] === queda).length;
        const s = f[0] + f[1] + (f[0] === f[1] ? 5 : 0) + tengo * 3 + Math.random() * 2;
        if (s > mejor) { mejor = s; jug = { i, lado }; }
      }
    }
    return jug;
  }
  return Kit.botTurnos(elegir, { espera: [0.6, 1.2], puede: (v) => v.turno === v.yo && v.fase === "juego" });
})();

if (typeof BOTS !== "undefined") BOTS.domino = DominoBot;
