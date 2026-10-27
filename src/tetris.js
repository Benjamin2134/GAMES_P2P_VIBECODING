// ==========================================================================
//  Modulo de juego: TETRIS VERSUS (JUEGOS.tetris). Tu tablero a la izquierda.
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL, T = 24, BY = 76;
  const BX = { yo: 130, rival: 590 };
  const TECLAS = { ArrowLeft: "l", a: "l", A: "l", ArrowRight: "r", d: "r", D: "r", ArrowUp: "rot", w: "rot", W: "rot", x: "rot", X: "rot", z: "rotI", Z: "rotI", " ": "drop" };

  function celda(x, y, t, alfa = 1, tam = T) {
    ctx.globalAlpha = alfa;
    D.caja(x + 1, y + 1, tam - 2, tam - 2, { r: 3, fill: TT.COLOR[t] });
    ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(x + 3, y + 3, tam - 6, 3);
    ctx.globalAlpha = 1;
  }
  function tablero(J, p, x0, j, mio) {
    D.caja(x0 - 6, BY - 6, TT.W * T + 12, TT.H * T + 12, { r: 8, fill: "#0b1020", stroke: J.color(j), lw: mio ? 3 : 1.5, glow: mio ? J.color(j) : null });
    ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 1; x < TT.W; x++) { ctx.moveTo(x0 + x * T, BY); ctx.lineTo(x0 + x * T, BY + TT.H * T); }
    for (let y = 1; y < TT.H; y++) { ctx.moveTo(x0, BY + y * T); ctx.lineTo(x0 + TT.W * T, BY + y * T); }
    ctx.stroke();
    for (let k = 0; k < TT.W * TT.H; k++) { const c = +p.tab[k]; if (c) celda(x0 + (k % TT.W) * T, BY + Math.floor(k / TT.W) * T, c, p.vivo ? 1 : 0.4); }
    if (p.pz && p.vivo) {
      const tab = p.tab.split("").map(Number), z = p.pz, yf = TT.caida(tab, z.t, z.r, z.x, z.y);
      for (const [x, y] of TT.celdas(z.t, z.r)) {
        if (yf + y >= 0) { ctx.strokeStyle = TT.COLOR[z.t]; ctx.lineWidth = 2; ctx.strokeRect(x0 + (z.x + x) * T + 3, BY + (yf + y) * T + 3, T - 6, T - 6); }
        if (z.y + y >= 0) celda(x0 + (z.x + x) * T, BY + (z.y + y) * T, z.t);
      }
    }
    // basura pendiente (barra roja al costado)
    if (p.basura) D.caja(x0 - 16, BY + TT.H * T - p.basura * T, 6, p.basura * T, { r: 3, fill: C.mal, glow: C.mal });
    // siguiente
    const sx = x0 + TT.W * T + 18;
    D.txt("SIGUE", sx + 36, BY + 8, { size: 11, f: "o", color: C.tenue });
    if (p.sig) for (const [x, y] of TT.celdas(p.sig, 0)) celda(sx + x * 18 + 4, BY + 26 + y * 18, p.sig, 1, 18);
    D.txt("LÍNEAS", sx + 36, BY + 120, { size: 11, f: "o", color: C.tenue });
    D.txt(p.lineas, sx + 36, BY + 144, { size: 24, f: "o", color: J.color(j) });
    D.txt(J.nombre(j), x0 + (TT.W * T) / 2, BY - 22, { size: 14, f: "o", color: J.color(j) });
  }

  Kit.juego({
    id: "tetris",
    nombre: "Tetris Versus",
    desc: "Cada uno su tablero y las mismas piezas. Limpia líneas para mandarle basura al rival.",
    ayuda: "<b>Tetris:</b> <kbd>←</kbd>/<kbd>→</kbd> mover, <kbd>↑</kbd> o <kbd>X</kbd> girar, <kbd>Z</kbd> girar al revés, <kbd>↓</kbd> bajar rápido, <kbd>espacio</kbd> caer. 2/3/4 líneas mandan 1/2/4 filas de basura. Pierde quien se tapa.",
    meta: { tag: "BLOCKS", icono: "🧱", gradiente: "linear-gradient(135deg, #6d28d9 0%, #120a26 100%)", color: "#c4b5fd" },
    tipo: "real",
    canvas: { w: 960, h: 600 },
    Sim: TetrisSim,
    continuo: true, envioHz: 40,
    fondo: "#070914",
    inp: () => ({ soft: false }),

    evento(J, e) {
      if (e.tipo === "gira") J.sfx("tic");
      if (e.tipo === "fija" && e.j === J.rol) J.sfx("rebote", 0.6);
      if (e.tipo === "golpe" && e.j === J.rol) J.sfx("golpe", 1.2);
      if (e.tipo === "lineas") {
        J.sfx(e.n >= 4 ? "fanfarria" : "moneda");
        if (e.n >= 2) J.aviso((e.j === J.rol ? "¡" : J.nombre(e.j) + ": ") + ["", "", "Doble", "Triple", "TETRIS"][e.n] + (e.manda ? " → +" + e.manda + " basura" : "") + (e.j === J.rol ? "!" : ""), J.color(e.j), 1.6);
      }
      if (e.tipo === "basura" && e.j === J.rol) { J.sfx("error"); J.sacudir(6); }
    },
    teclado(J, e, abajo) {
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") { J.inp.soft = abajo; return true; }
      const m = TECLAS[e.key]; if (!m) return false;
      if (abajo && !(m === "drop" && e.repeat)) J.accion({ m });
      return true;
    },

    pintar(J, v) {
      const yo = v.yo, o = Kit.otro(yo);
      tablero(J, yo === 1 ? v.p1 : v.p2, BX.yo, yo, true);
      tablero(J, o === 1 ? v.p1 : v.p2, BX.rival, o, false);
      const by = BY + TT.H * T + 12;
      [["◀", "l"], ["⟳", "rot"], ["▶", "r"], ["⤓", "drop"]].forEach(([s, m], k) => J.boton(BX.yo + k * 62, by, 56, 30, s, () => J.accion({ m }), { size: 16, mudo: true }));
      if (v.cuenta) D.txt("¡LISTOS!", 480, 300, { size: 40, f: "b", color: C.acento, glow: C.acento });
    },
    textoFin(J, v, g) { return { sub: g === 3 ? "Se taparon los dos" : g === J.rol ? "El rival se tapó" : "Te tapaste" }; },
  });
})();
