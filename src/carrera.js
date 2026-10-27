// ==========================================================================
//  Modulo de juego: CARRERA (JUEGOS.carrera). El fantasma de tu mejor
//  vuelta se graba y se dibuja solo en tu pantalla.
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL;

  function camino() { ctx.beginPath(); CR.PTS.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
  function auto(x, y, a, color, alfa = 1) {
    ctx.save(); ctx.globalAlpha = alfa; ctx.translate(x, y); ctx.rotate(a);
    D.caja(-15, -9, 30, 18, { r: 5, fill: color, glow: alfa === 1 ? color : null });
    ctx.fillStyle = "rgba(15,23,42,0.75)"; ctx.fillRect(-2, -7, 8, 14);
    ctx.fillStyle = "#111"; for (const [wx, wy] of [[-10, -11], [8, -11], [-10, 9], [8, 9]]) ctx.fillRect(wx, wy, 7, 3);
    ctx.restore(); ctx.globalAlpha = 1;
  }

  Kit.juego({
    id: "carrera",
    nombre: "Carrera",
    desc: "Carrera cenital a 3 vueltas con derrapes. Tu mejor vuelta queda como fantasma.",
    ayuda: "<b>Carrera:</b> <kbd>↑</kbd>/<kbd>W</kbd> acelerar, <kbd>↓</kbd>/<kbd>S</kbd> frenar, <kbd>←</kbd>/<kbd>→</kbd> doblar, <kbd>espacio</kbd> freno de mano (derrape). Fuera del asfalto te frenas. 3 vueltas.",
    meta: { tag: "RACE", icono: "🏎️", gradiente: "linear-gradient(135deg, #b45309 0%, #1a0e02 100%)", color: "#fcd34d" },
    tipo: "real",
    canvas: { w: 960, h: 600 },
    Sim: CarreraSim,
    continuo: true,
    fondo: "#14280f",
    local: () => ({ k: {}, actual: [], fantasma: null, mejor: Infinity, vueltaVista: 0, tMuestra: 0, t0: 0 }),
    inp: () => ({ gas: 0, giro: 0, mano: false }),

    evento(J, e) {
      if (e.tipo === "cuenta") J.sfx(e.n ? "tic" : "punto");
      if (e.tipo === "choque") J.sfx("golpe", 1.2);
      if (e.tipo === "vuelta") { J.sfx("moneda"); J.aviso(J.nombre(e.j) + ": vuelta " + e.n + " en " + e.t.toFixed(2) + " s", J.color(e.j), 1.8); }
    },
    teclado(J, e, abajo) {
      const k = J.local.k, d = { ArrowUp: "u", w: "u", W: "u", ArrowDown: "d", s: "d", S: "d", ArrowLeft: "l", a: "l", A: "l", ArrowRight: "r", d: "r", D: "r", " ": "m" }[e.key];
      if (!d) return false;
      k[d] = abajo;
      J.inp.gas = (k.u ? 1 : 0) - (k.d ? 1 : 0); J.inp.giro = (k.r ? 1 : 0) - (k.l ? 1 : 0); J.inp.mano = !!k.m;
      return true;
    },

    pintar(J, v) {
      const L = J.local, yo = v.yo === 1 ? v.c1 : v.c2;
      // pasto y pista
      ctx.fillStyle = "rgba(0,0,0,0.12)"; for (let k = 0; k < 140; k++) ctx.fillRect((k * 131) % 960, (k * 71) % 600, 3, 3);
      ctx.lineJoin = "round";
      camino(); ctx.strokeStyle = "#dc2626"; ctx.lineWidth = CR.ANCHO + 12; ctx.stroke();
      camino(); ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = CR.ANCHO + 12; ctx.setLineDash([18, 18]); ctx.stroke(); ctx.setLineDash([]);
      camino(); ctx.strokeStyle = "#374151"; ctx.lineWidth = CR.ANCHO; ctx.stroke();
      camino(); ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2; ctx.setLineDash([20, 24]); ctx.stroke(); ctx.setLineDash([]);
      // meta a cuadros
      const [mx, my] = CR.PTS[0], [m2x, m2y] = CR.PTS[1], ma = Math.atan2(m2y - my, m2x - mx);
      ctx.save(); ctx.translate(mx, my); ctx.rotate(ma);
      for (let k = -6; k < 6; k++) for (let c = 0; c < 2; c++) { ctx.fillStyle = (k + c) % 2 ? "#fff" : "#111"; ctx.fillRect(c * 8 - 8, k * 8.7, 8, 8.7); }
      ctx.restore();

      // fantasma: grabo mi vuelta cada 0,1 s; si es la mejor, queda de fantasma
      if (!v.cuenta && !v.g) {
        if (yo.vuelta !== L.vueltaVista) {
          if (L.vueltaVista > 0) { const tv = v.t - L.t0; if (tv < L.mejor) { L.mejor = tv; L.fantasma = L.actual; } }
          L.vueltaVista = yo.vuelta; L.actual = []; L.t0 = v.t;
        }
        if (v.t - L.tMuestra >= 0.1) { L.tMuestra = v.t; L.actual.push([yo.x, yo.y, yo.a]); }
        if (L.fantasma) { const p = L.fantasma[Math.min(L.fantasma.length - 1, Math.floor((v.t - L.t0) / 0.1))]; if (p) auto(p[0], p[1], p[2], "#e5e7eb", 0.3); }
      }
      for (const j of [1, 2]) { const c = j === 1 ? v.c1 : v.c2; auto(J.s("x" + j, c.x), J.s("y" + j, c.y), J.sa("a" + j, c.a), J.color(j)); if (c.fuera && c.v > 40) J.chispas(c.x, c.y, "#65a30d", 1, 40, 0.3); }

      D.marcador(J, { p1: "V" + v.c1.vuelta + "/" + CR.VUELTAS, p2: "V" + v.c2.vuelta + "/" + CR.VUELTAS, centro: v.t.toFixed(1) + " s", y: 26 });
      D.txt(yo.v + " km/h" + (L.mejor < Infinity ? " · mejor vuelta " + L.mejor.toFixed(2) + " s" : ""), 480, 586, { size: 13, f: "o", color: C.tenue });
      if (v.cuenta) D.txt(v.cuenta, 480, 300, { size: 90, f: "b", color: C.acento, glow: C.acento });
    },
    textoFin(J, v, g) { return { sub: (g === J.rol ? "Cruzaste primero" : "Llegaste segundo") + " · " + v.t.toFixed(1) + " s" }; },
  });
})();
