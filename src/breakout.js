// ==========================================================================
//  Modulo de juego: BREAKOUT VERSUS (JUEGOS.breakout).
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL;
  const COLF = ["#64748b", "#a78bfa", "#f472b6"];

  Kit.juego({
    id: "breakout",
    nombre: "Breakout Versus",
    desc: "Dos paletas, un muro de ladrillos al medio. Rompe más que tu rival y no dejes pasar ninguna pelota.",
    ayuda: "<b>Breakout:</b> mueve tu paleta con el mouse/dedo (o <kbd>↑</kbd>/<kbd>↓</kbd>, <kbd>W</kbd>/<kbd>S</kbd>). <kbd>espacio</kbd> o click lanza tu pelota. Los ladrillos del centro valen más. Si una pelota pasa detrás de ti, pierdes una vida.",
    meta: { tag: "BRICKS", icono: "🧱", gradiente: "linear-gradient(135deg, #be123c 0%, #1f0610 100%)", color: "#fda4af" },
    tipo: "real",
    canvas: { w: 960, h: 600 },
    Sim: BreakoutSim,
    continuo: true,
    fondo: "#08060c",
    local: () => ({ k: {} }),
    inp: () => ({ y: 320 }),

    evento(J, e) {
      if (e.tipo === "pala") J.sfx("rebote", e.j === 1 ? 1 : 1.2);
      if (e.tipo === "ladrillo") { J.sfx("rebote", 1.6 + e.f * 0.05); J.chispas(e.x, e.y, COLF[BK.valor(e.f) - 1], 8, 140, 0.4); }
      if (e.tipo === "vida") { J.sfx("error"); J.sacudir(6); if (J.v && !J.v.g) J.aviso(e.j === J.rol ? "¡Perdiste una vida!" : (J.esBot ? "El bot" : "El rival") + " pierde una vida", J.color(e.j), 1.4); }
    },
    teclado(J, e, abajo) {
      if (e.key === " ") { if (abajo) J.accion({ saca: 1 }); return true; }
      const d = { ArrowUp: "u", w: "u", W: "u", ArrowDown: "d", s: "d", S: "d" }[e.key];
      if (!d) return false;
      J.local.k[d] = abajo; return true;
    },
    puntero(J, tipo, x, y) { J.inp.y = y; if (tipo === "abajo") J.accion({ saca: 1 }); },

    pintar(J, v) {
      const k = J.local.k;
      if (k.u) J.inp.y -= 700 * J.dt;
      if (k.d) J.inp.y += 700 * J.dt;
      J.inp.y = clamp(J.inp.y, BK.Y0 + BK.PH / 2, BK.Y1 - BK.PH / 2);
      ctx.fillStyle = "#0e0b16"; ctx.fillRect(0, BK.Y0, 960, BK.Y1 - BK.Y0);
      D.linea(0, BK.Y0, 960, BK.Y0, "#3f3f46", 2); D.linea(0, BK.Y1, 960, BK.Y1, "#3f3f46", 2);
      for (let k = 0; k < BK.COLS * BK.FILAS; k++) {
        if (v.lad[k] !== "1") continue;
        const c = k % BK.COLS, f = Math.floor(k / BK.COLS), col = COLF[BK.valor(f) - 1];
        D.caja(BK.LX + c * BK.LW + 2, BK.LY + f * BK.LH + 2, BK.LW - 4, BK.LH - 4, { r: 4, fill: col, stroke: "rgba(255,255,255,0.25)", lw: 1 });
      }
      for (const j of [1, 2]) {
        const y = J.s("p" + j, j === 1 ? v.y1 : v.y2);
        D.caja(BK.PX[j] - BK.PW / 2, y - BK.PH / 2, BK.PW, BK.PH, { r: 7, fill: J.color(j), glow: J.color(j) });
        for (let k = 0; k < v.vidas[j]; k++) D.circ((j === 1 ? 30 : 930) + (j === 1 ? k : -k) * 18, 576, 5, J.color(j));
      }
      for (const [x, y, due, pega, , , j] of v.bolas) {
        D.circ(J.s("bx" + j, x, 80), J.s("by" + j, y, 80), BK.R, "#fff", J.color(due), 3, J.color(due));
        if (pega && j === J.rol) D.txt("ESPACIO / CLICK PARA LANZAR", 480, 560, { size: 13, f: "o", color: J.miColor() });
      }
      D.marcador(J, { p1: v.puntos[1], p2: v.puntos[2], centro: "♥ " + v.vidas[1] + " · " + v.vidas[2] + " ♥", y: 26 });
    },
    textoFin(J, v) { return { sub: v.puntos[1] + " a " + v.puntos[2] + " puntos" }; },
  });
})();
