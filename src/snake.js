// ==========================================================================
//  Modulo de juego: SNAKE DUELO (JUEGOS.snake).
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL, T = 24, X0 = (960 - SN.C * T) / 2, Y0 = 60;
  const TECLAS = { ArrowUp: "u", w: "u", W: "u", ArrowDown: "d", s: "d", S: "d", ArrowLeft: "l", a: "l", A: "l", ArrowRight: "r", d: "r", D: "r" };

  function serpiente(J, s, j) {
    const col = J.color(j);
    ctx.globalAlpha = s.v ? 1 : 0.35;
    s.c.forEach(([x, y], k) => {
      const t = 1 - (k / s.c.length) * 0.5;
      D.caja(X0 + x * T + 2, Y0 + y * T + 2, T - 4, T - 4, { r: 6, fill: col, glow: k === 0 || s.t ? col : null, blur: s.t ? 16 : 8 });
      if (k) { ctx.fillStyle = "rgba(0,0,0," + (0.35 - t * 0.3) + ")"; ctx.fillRect(X0 + x * T + 2, Y0 + y * T + 2, T - 4, T - 4); }
    });
    const [hx, hy] = s.c[0], [dx, dy] = SN.DIR[s.d];
    for (const lado of [-1, 1]) D.circ(X0 + hx * T + T / 2 + dx * 4 + dy * lado * 5, Y0 + hy * T + T / 2 + dy * 4 + dx * lado * 5, 3, "#0b0d12");
    ctx.globalAlpha = 1;
  }

  Kit.juego({
    id: "snake",
    nombre: "Snake Duelo",
    desc: "Dos serpientes, una arena. Come para crecer, encierra al rival y busca la manzana dorada.",
    ayuda: "<b>Snake:</b> <kbd>WASD</kbd> o flechas (en celular: desliza el dedo). Si chocas una pared o un cuerpo, pierdes la ronda. La manzana dorada da turbo. Primero a 3 rondas.",
    meta: { tag: "SNAKE", icono: "🐍", gradiente: "linear-gradient(135deg, #166534 0%, #04150a 100%)", color: "#86efac" },
    tipo: "real",
    canvas: { w: 960, h: 600 },
    Sim: SnakeSim,
    continuo: true, envioHz: 30,
    fondo: "#060b08",
    local: () => ({ toque: null }),
    inp: () => ({ d: net.rol === 2 ? "l" : "r" }),

    evento(J, e) {
      if (e.tipo === "come") J.sfx("come");
      if (e.tipo === "oro") { J.sfx("powerup"); J.aviso(J.nombre(e.j) + ": ¡turbo!", C.acento, 1.4); }
      if (e.tipo === "muere") { J.sfx("explosion"); J.sacudir(8); J.chispas(X0 + e.x * T + T / 2, Y0 + e.y * T + T / 2, J.color(e.j), 30, 220); }
      if (e.tipo === "ronda" && J.v && !J.v.g) J.aviso(e.g ? (e.g === J.rol ? "Ganas la ronda" : "Ronda para " + J.nombre(e.g)) : "Choque: nadie suma", e.g ? J.color(e.g) : C.tenue, 1.6);
    },
    teclado(J, e, abajo) { const d = TECLAS[e.key]; if (!d) return false; if (abajo) J.inp.d = d; return true; },
    puntero(J, tipo, x, y) {
      if (tipo === "abajo") J.local.toque = [x, y];
      else if (tipo === "mueve" && J.local.toque) {
        const dx = x - J.local.toque[0], dy = y - J.local.toque[1];
        if (Math.hypot(dx, dy) > 30) { J.inp.d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "r" : "l") : (dy > 0 ? "d" : "u"); J.local.toque = [x, y]; }
      } else if (tipo === "arriba") J.local.toque = null;
    },

    pintar(J, v) {
      D.caja(X0 - 4, Y0 - 4, SN.C * T + 8, SN.F * T + 8, { r: 8, fill: "#0a140d", stroke: "#1f3a28", lw: 2 });
      ctx.fillStyle = "rgba(134,239,172,0.035)";
      for (let x = 0; x < SN.C; x++) for (let y = 0; y < SN.F; y++) if ((x + y) % 2) ctx.fillRect(X0 + x * T, Y0 + y * T, T, T);
      for (const [x, y] of v.manzanas) { D.circ(X0 + x * T + T / 2, Y0 + y * T + T / 2 + 1, T * 0.36, "#ef4444", null, 0, "#ef4444"); D.linea(X0 + x * T + T / 2, Y0 + y * T + 4, X0 + x * T + T / 2 + 3, Y0 + y * T, "#65a30d", 2); }
      if (v.oro) D.circ(X0 + v.oro[0] * T + T / 2, Y0 + v.oro[1] * T + T / 2, T * 0.4 + Math.sin(J.t * 8) * 2, "#facc15", "#fff7", 2, "#facc15");
      serpiente(J, v.s1, 1); serpiente(J, v.s2, 2);
      D.marcador(J, { p1: v.rondas[1], p2: v.rondas[2], centro: "A " + SN.RONDAS + " RONDAS", y: 30 });
      if (v.fase === "cuenta") D.txt("¡PREPÁRATE!", 480, 300, { size: 40, f: "b", color: C.acento, glow: C.acento });
    },
    textoFin(J, v) { return { sub: v.rondas[1] + " a " + v.rondas[2] + " rondas" }; },
  });
})();
