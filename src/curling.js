// ==========================================================================
//  Modulo de juego: CURLING (JUEGOS.curling). Pista horizontal: se lanza
//  desde la izquierda hacia la casa de la derecha.
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL;

  function piedra(x, y, color, alfa = 1) {
    ctx.globalAlpha = alfa;
    D.circ(x + 2, y + 3, CU.R, "rgba(0,0,0,0.25)");
    D.ficha(x, y, CU.R, "#9ca3af");
    D.circ(x, y, CU.R * 0.62, color, "rgba(0,0,0,0.3)", 1.5);
    D.caja(x - 3, y - CU.R * 0.5, 6, CU.R, { r: 3, fill: "rgba(255,255,255,0.75)" });
    ctx.globalAlpha = 1;
  }

  function lanzar(J) {
    const v = J.v;
    if (!v || v.g || v.turno !== v.yo || v.fase !== "apunta") return;
    J.accion({ lanza: 1, ang: J.inp.ang, pot: J.inp.pot, giro: J.inp.giro });
  }

  Kit.juego({
    id: "curling",
    nombre: "Curling",
    desc: "Lanza piedras con efecto sobre el hielo, barre para alargarlas y saca las del rival de la casa.",
    ayuda: "<b>Curling:</b> arrastra hacia atrás desde la piedra y suelta para lanzar (o <kbd>↑</kbd>/<kbd>↓</kbd> dirección, <kbd>←</kbd>/<kbd>→</kbd> fuerza, <kbd>espacio</kbd>). <kbd>Q</kbd>/<kbd>E</kbd> cambia el giro. Mientras tu piedra corre, mantén <kbd>espacio</kbd> o el click para <b>barrer</b>.",
    meta: { tag: "ICE", icono: "🥌", gradiente: "linear-gradient(135deg, #0e7490 0%, #082f49 100%)", color: "#a5f3fc" },
    tipo: "turnos",
    canvas: { w: 960, h: 600 },
    Sim: CurlingSim,
    continuo: true,
    envioHz: 30,
    fondo: "#0a1a24",
    local: () => ({ arrastra: false, k: {}, listo: false }),
    inp: () => ({ ang: 0, pot: 0.25, giro: 1, barre: false }),

    evento(J, e) {
      if (e.tipo === "lanza") J.sfx("desliza");
      if (e.tipo === "choque") J.sfx("golpe", 1.3);
      if (e.tipo === "fuera") J.sfx("caida");
      if (e.tipo === "cuenta") {
        J.sfx(e.j === J.rol ? "moneda" : e.j ? "error" : "sonar");
        J.aviso(e.j ? J.nombre(e.j) + " suma " + e.n : "Entrada en blanco", e.j ? J.color(e.j) : C.tenue, 3);
      }
    },
    teclado(J, e, abajo) {
      const k = e.key, v = J.v;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(k)) { J.local.k[k] = abajo; return true; }
      if (k === " ") {
        if (v && v.fase === "rueda") { J.inp.barre = abajo; return true; }
        if (abajo) lanzar(J);
        return true;
      }
      if (abajo && (k === "q" || k === "Q")) { J.inp.giro = -1; return true; }
      if (abajo && (k === "e" || k === "E")) { J.inp.giro = 1; return true; }
      return false;
    },
    puntero(J, tipo, x, y) {
      const v = J.v;
      if (!v || v.turno !== v.yo || v.g) return;
      if (v.fase === "rueda") { J.inp.barre = tipo !== "arriba" && J.ptr.abajo; return; }
      if (v.fase !== "apunta") return;
      if (tipo === "abajo") J.local.arrastra = x < 400;
      if (J.local.arrastra && tipo !== "arriba") {
        const dx = CU.X0 - x, dy = CU.Y0 - y;
        if (dx > 4) { J.inp.ang = clamp(Math.atan2(dy, dx), -0.14, 0.14); J.inp.pot = clamp(Math.hypot(dx, dy) / 260, 0, 1); }
      }
      if (tipo === "arriba" && J.local.arrastra) { J.local.arrastra = false; lanzar(J); }
    },

    pintar(J, v) {
      const L = J.local, yo = v.yo, miTurno = !v.g && v.turno === yo && v.fase === "apunta";
      if (miTurno && !L.listo) { J.inp.ang = 0; J.inp.pot = 0.25; L.listo = true; }
      if (!miTurno) L.listo = false;
      if (miTurno) {
        if (L.k.ArrowUp) J.inp.ang = Math.max(-0.14, J.inp.ang - 0.08 * J.dt);
        if (L.k.ArrowDown) J.inp.ang = Math.min(0.14, J.inp.ang + 0.08 * J.dt);
        if (L.k.ArrowRight) J.inp.pot = Math.min(1, J.inp.pot + 0.35 * J.dt);
        if (L.k.ArrowLeft) J.inp.pot = Math.max(0, J.inp.pot - 0.35 * J.dt);
      }

      // pista
      D.caja(24, CU.Y_MIN - 8, 912, CU.Y_MAX - CU.Y_MIN + 16, { r: 10, fill: "#1e3a4a" });
      const hielo = ctx.createLinearGradient(0, CU.Y_MIN, 0, CU.Y_MAX);
      hielo.addColorStop(0, "#e0f2fe"); hielo.addColorStop(0.5, "#f0f9ff"); hielo.addColorStop(1, "#dbeafe");
      ctx.fillStyle = hielo; ctx.fillRect(30, CU.Y_MIN, 900, CU.Y_MAX - CU.Y_MIN);
      const [cx, cy] = CU.CASA;
      ["#2563eb", "#f8fafc", "#dc2626", "#f8fafc"].forEach((c, k) => D.circ(cx, cy, CU.ANILLOS[k], c, "rgba(0,0,0,0.1)", 1));
      D.linea(cx, CU.Y_MIN, cx, CU.Y_MAX, "rgba(15,23,42,0.35)", 1.5);
      D.linea(30, cy, 930, cy, "rgba(15,23,42,0.18)", 1);
      D.linea(CU.HOG, CU.Y_MIN, CU.HOG, CU.Y_MAX, "#dc2626", 3);
      D.txt("HOG", CU.HOG, CU.Y_MAX + 14, { size: 10, f: "o", color: C.tenue });
      D.linea(CU.FONDO, CU.Y_MIN, CU.FONDO, CU.Y_MAX, "rgba(15,23,42,0.4)", 2);
      D.circ(CU.X0, CU.Y0, 22, null, "rgba(15,23,42,0.25)", 2);

      // mira
      if (v.fase === "apunta" && !v.g) {
        const m = miTurno ? J.inp : v.mira, col = J.color(v.turno);
        const largo = 60 + m.pot * 420;
        ctx.setLineDash([8, 8]); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath();
        ctx.moveTo(CU.X0, CU.Y0);
        // curva aproximada: se abre hacia el lado del giro al final
        const ex = CU.X0 + Math.cos(m.ang) * largo, ey = CU.Y0 + Math.sin(m.ang) * largo;
        ctx.quadraticCurveTo((CU.X0 + ex) / 2, (CU.Y0 + ey) / 2, ex, ey + m.giro * 18 * m.pot);
        ctx.stroke(); ctx.setLineDash([]);
        piedra(CU.X0, CU.Y0, col, 0.9);
        D.txt(m.giro > 0 ? "↻" : "↺", CU.X0, CU.Y0 - 30, { size: 22, color: col });
        D.caja(CU.X0 - 40, CU.Y_MAX + 18, 80, 8, { r: 4, fill: "rgba(255,255,255,0.12)" });
        D.caja(CU.X0 - 40, CU.Y_MAX + 18, 80 * m.pot, 8, { r: 4, fill: col });
      }
      // piedras
      for (const p of v.piedras) piedra(J.s("x" + p.id, p.x, 60), J.s("y" + p.id, p.y, 60), J.color(p.j));
      if (v.fase === "rueda" && v.barre) {
        const p = v.piedras.find((x) => x.id === v.actual);
        if (p) for (let k = 0; k < 3; k++) D.linea(p.x + 22 + k * 6, p.y - 16, p.x + 30 + k * 6, p.y + 16, "rgba(15,23,42,0.5)", 2);
      }

      // HUD
      D.marcador(J, { p1: v.puntos[1], p2: v.puntos[2] });
      D.txt("ENTRADA " + v.entrada + "/" + CU.ENTRADAS, 480, 50, { size: 12, f: "o", color: C.tenue });
      if (!v.g && v.fase === "apunta") D.turno(J, miTurno);
      if (v.fase === "rueda" && v.turno === yo) D.txt(v.barre ? "¡BARRIENDO!" : "Mantén espacio o click para barrer", 480, 140, { size: 15, f: "o", color: v.barre ? C.acento : C.tenue });
      for (const j of [1, 2]) {
        const x0 = j === 1 ? 60 : 760;
        D.txt(J.nombre(j), x0, 100, { align: "left", size: 12, f: "o", color: J.color(j) });
        for (let k = 0; k < v.quedan[j]; k++) piedra(x0 + 70 + k * 26, 100, J.color(j));
      }
      if (miTurno) {
        J.boton(300, 470, 60, 36, "↺", () => { J.inp.giro = -1; }, { activo: J.inp.giro < 0, color: J.miColor(), size: 20 });
        J.boton(370, 470, 60, 36, "↻", () => { J.inp.giro = 1; }, { activo: J.inp.giro > 0, color: J.miColor(), size: 20 });
        J.boton(450, 470, 120, 36, "LANZAR", () => lanzar(J), { lleno: true, color: J.miColor(), f: "o", size: 13 });
      }
      if (v.fase === "cuenta" && v.resumen) {
        const r = v.resumen;
        D.caja(330, 500, 300, 60, { r: 14, fill: "rgba(8,20,30,0.92)", stroke: r.j ? J.color(r.j) : C.tenue });
        D.txt(r.j ? J.nombre(r.j) + " suma " + r.n + (r.n === 1 ? " punto" : " puntos") : "Entrada en blanco", 480, 530, { size: 18, color: r.j ? J.color(r.j) : C.tenue });
      }
    },

    textoFin(J, v) { return { sub: v.puntos[1] + " a " + v.puntos[2] }; },
  });
})();
