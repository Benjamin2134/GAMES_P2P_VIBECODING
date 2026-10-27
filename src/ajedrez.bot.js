// ==========================================================================
//  Bot Universal: AJEDREZ (src/ajedrez.bot.js)
//  Negamax alfa-beta a 3 medias jugadas + quietud de capturas (2 niveles),
//  material y tablas posicionales simples. Ordena capturas primero (MVV-LVA).
// ==========================================================================
"use strict";

const AjedrezBot = (() => {
  // Tablas desde el punto de vista de las blancas (indice 0 = a8).
  const PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
      -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
  };

  function evaluar(s) {
    let v = 0;
    for (let i = 0; i < 64; i++) {
      const p = s.tab[i];
      if (!p) continue;
      const t = p.toLowerCase();
      if (p === t) v -= AJ.VAL[t] + PST[t][(7 - (i >> 3)) * 8 + (i & 7)];   // negras: tabla espejada
      else v += AJ.VAL[t] + PST[t][i];
    }
    return s.turno === "w" ? v : -v;
  }

  const valor = (p) => (p ? AJ.VAL[p.toLowerCase()] : 0);
  function ordenar(s, ms) {
    return ms.sort((a, b) => (valor(s.tab[b.a]) * 10 - valor(s.tab[b.de]) / 100 + (b.pr ? 800 : 0)) -
                             (valor(s.tab[a.a]) * 10 - valor(s.tab[a.de]) / 100 + (a.pr ? 800 : 0)));
  }

  // Quietud: sigue solo capturas para no cortar en medio de un cambio de piezas.
  function quietud(s, alfa, beta, prof) {
    const base = evaluar(s);
    if (prof <= 0) return base;
    if (base >= beta) return base;
    if (base > alfa) alfa = base;
    const caps = ordenar(s, AJ.legales(s).filter((m) => s.tab[m.a] || m.ep));
    for (const m of caps) {
      const v = -quietud(AJ.aplicar(s, m), -beta, -alfa, prof - 1);
      if (v >= beta) return v;
      if (v > alfa) alfa = v;
    }
    return alfa;
  }

  function buscar(s, prof, alfa, beta) {
    const ms = AJ.legales(s);
    if (!ms.length) return { v: AJ.enJaque(s) ? -(100000 + prof) : 0 };
    if (prof <= 0) return { v: quietud(s, alfa, beta, 2) };
    let mejor = -Infinity, mm = ms[0];
    for (const m of ordenar(s, Kit.mezclar(ms))) {
      const v = -buscar(AJ.aplicar(s, m), prof - 1, -beta, -alfa).v;
      if (v > mejor) { mejor = v; mm = m; }
      if (mejor > alfa) alfa = mejor;
      if (alfa >= beta) break;
    }
    return { v: mejor, m: mm };
  }

  function elegir(v) {
    if (!v.movs.length) return null;
    const s = { tab: v.tab, turno: v.turnoColor, enr: v.enr, ep: v.ep, medio: v.medio };
    const r = buscar(s, Math.random() < 0.25 ? 2 : 3, -Infinity, Infinity);
    const m = r.m;
    return m ? { de: m.de, a: m.a, pr: m.pr || "q" } : { de: v.movs[0][0], a: v.movs[0][1], pr: "q" };
  }

  return Kit.botTurnos(elegir, { espera: [0.7, 1.3] });
})();

if (typeof BOTS !== "undefined") BOTS.ajedrez = AjedrezBot;
