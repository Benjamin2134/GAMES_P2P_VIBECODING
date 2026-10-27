// ==========================================================================
//  Modulo de juego: TANQUES (JUEGOS.tanques).
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL;
  const K = { ArrowUp: "u", w: "u", W: "u", ArrowDown: "d", s: "d", S: "d", ArrowLeft: "l", a: "l", A: "l", ArrowRight: "r", d: "r", D: "r", " ": "f" };

  function tanque(x, y, a, color, vivo) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.globalAlpha = vivo ? 1 : 0.25;
    D.caja(-TQ.R, -TQ.R + 2, TQ.R * 2, TQ.R * 2 - 4, { r: 5, fill: "#1f2937" });
    D.caja(-TQ.R + 3, -TQ.R + 5, TQ.R * 2 - 6, TQ.R * 2 - 10, { r: 5, fill: color, glow: vivo ? color : null });
    D.caja(0, -3.5, TQ.R + 8, 7, { r: 2, fill: "#e5e7eb" });
    D.circ(0, 0, 7, "rgba(0,0,0,0.35)");
    ctx.restore(); ctx.globalAlpha = 1;
  }

  Kit.juego({
    id: "tanques",
    nombre: "Tanques",
    desc: "Duelo de tanques en un laberinto: las balas rebotan, las minas esperan. Un impacto y fuera.",
    ayuda: "<b>Tanques:</b> <kbd>←</kbd>/<kbd>→</kbd> girar, <kbd>↑</kbd>/<kbd>↓</kbd> avanzar/retroceder, <kbd>espacio</kbd> disparar, <kbd>M</kbd> soltar mina. Las balas rebotan dos veces: ¡te pueden pegar a ti! Rondas a 5.",
    meta: { tag: "TANKS", icono: "🛡️", gradiente: "linear-gradient(135deg, #3f6212 0%, #10180a 100%)", color: "#bef264" },
    tipo: "real",
    canvas: { w: 960, h: 600 },
    Sim: TanquesSim,
    continuo: true,
    fondo: "#0c0f08",
    local: () => ({ k: {} }),
    inp: () => ({ giro: 0, mov: 0, fuego: false }),

    evento(J, e) {
      if (e.tipo === "disparo") J.sfx("laser");
      if (e.tipo === "rebote") J.sfx("rebote", 1.6);
      if (e.tipo === "mina") J.sfx("tic");
      if (e.tipo === "subita") { J.sfx("gong"); J.aviso("¡MUERTE SÚBITA! Balas más rápidas", C.mal, 2.2); }
      if (e.tipo === "boom") { J.sfx("explosion"); J.sacudir(12); J.chispas(e.x, e.y, "#f97316", 36, 260, 0.8, 3); }
      if (e.tipo === "muere") { J.sfx("explosion"); J.sacudir(10); J.chispas(e.x, e.y, J.color(e.j), 30, 220); }
      if (e.tipo === "ronda" && J.v && !J.v.g) J.aviso(e.g ? (e.g === J.rol ? "¡Ronda tuya!" : "Ronda para " + J.nombre(e.g)) : "Cayeron los dos", e.g ? J.color(e.g) : C.tenue, 1.6);
    },
    teclado(J, e, abajo) {
      if ((e.key === "m" || e.key === "M") && abajo) { J.accion({ mina: 1 }); return true; }
      const d = K[e.key]; if (!d) return false;
      const k = J.local.k; k[d] = abajo;
      J.inp.giro = (k.r ? 1 : 0) - (k.l ? 1 : 0); J.inp.mov = (k.u ? 1 : 0) - (k.d ? 1 : 0); J.inp.fuego = !!k.f;
      return true;
    },

    pintar(J, v) {
      ctx.fillStyle = "#1a2210"; ctx.fillRect(TQ.X0, TQ.Y0, TQ.X1 - TQ.X0, TQ.Y1 - TQ.Y0);
      ctx.fillStyle = "rgba(190,242,100,0.04)";
      for (let x = TQ.X0; x < TQ.X1; x += 40) for (let y = TQ.Y0; y < TQ.Y1; y += 40) if (((x + y) / 40) % 2) ctx.fillRect(x, y, 40, 40);
      ctx.strokeStyle = "#4d7c0f"; ctx.lineWidth = 4; ctx.strokeRect(TQ.X0, TQ.Y0, TQ.X1 - TQ.X0, TQ.Y1 - TQ.Y0);
      for (const [x, y, w, h] of TQ.MUROS) D.caja(x, y, w, h, { r: 4, fill: "#57534e", stroke: "#a8a29e", lw: 2 });
      for (const [x, y, j, armada] of v.minas) {
        D.circ(x, y, 9, "#292524", J.color(j), 2);
        if (armada && Math.sin(J.t * 10) > 0) D.circ(x, y, 3, C.mal);
        if (armada) D.circ(x, y, TQ.R_MINA, null, "rgba(248,113,113,0.12)", 1);
      }
      for (const j of [1, 2]) { const t = j === 1 ? v.t1 : v.t2; tanque(J.s("x" + j, t.x), J.s("y" + j, t.y), J.sa("a" + j, t.a), J.color(j), t.v); }
      for (const [x, y, j] of v.balas) D.circ(x, y, 4, "#fef9c3", null, 0, J.color(j));
      D.marcador(J, { p1: v.rondas[1], p2: v.rondas[2], centro: "A " + TQ.RONDAS + " RONDAS", y: 28 });
      if (v.fase === "cuenta") D.txt("¡FUEGO!", 480, 320, { size: 42, f: "b", color: C.acento, glow: C.acento });
    },
    textoFin(J, v) { return { sub: v.rondas[1] + " a " + v.rondas[2] + " rondas" }; },
  });
})();
