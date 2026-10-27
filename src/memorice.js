// ==========================================================================
//  Modulo de juego: MEMORICE (JUEGOS.memorice).
// ==========================================================================
(function () {
  const CW = 88, CHt = 92, G = 10, BX = (960 - (CW * 6 + G * 5)) / 2, BY = 72;
  const D = Kit.D, C = Kit.COL;
  const pos = (i) => ({ x: BX + (i % 6) * (CW + G), y: BY + Math.floor(i / 6) * (CHt + G) });

  Kit.juego({
    id: "memorice",
    nombre: "Memorice",
    desc: "Encuentra los pares antes que tu rival. Si aciertas, sigues jugando.",
    ayuda: "<b>Memorice:</b> click en dos cartas por turno. Si son pareja te las llevas y vuelves a jugar. Si no, se dan vuelta y le toca al otro.",
    meta: { tag: "PARES", icono: "🃏", gradiente: "linear-gradient(135deg, #be185d 0%, #2e0a1c 100%)", color: "#f9a8d4" },
    tipo: "turnos",
    canvas: { w: 960, h: 600 },
    Sim: MemoriceSim,
    hz: 30,
    fondo: "#14070e",
    local: () => ({ giro: {} }),

    evento(J, e) {
      if (e.tipo === "voltea") { J.sfx("carta"); J.local.giro[e.i] = J.t; }
      if (e.tipo === "par") {
        J.sfx("moneda");
        for (const i of [e.i, e.k]) { const p = pos(i); J.chispas(p.x + CW / 2, p.y + CHt / 2, J.color(e.j), 14, 160); }
      }
      if (e.tipo === "fallo") J.sfx("error");
    },

    pintar(J, v) {
      const miTurno = !v.g && v.turno === v.yo && !v.espera && v.arriba.length < 2;
      D.marcador(J, { p1: v.puntos[1], p2: v.puntos[2] });
      if (!v.g) D.turno(J, v.turno === v.yo);
      for (let i = 0; i < 30; i++) {
        const p = pos(i), cara = v.cartas[i], dueno = v.dueno[i];
        const g0 = J.local.giro[i], prog = g0 ? Math.min(1, (J.t - g0) / 0.22) : 1;
        const sobre = miTurno && cara < 0 && J.zona(p.x, p.y, CW, CHt, () => J.accion({ i }));
        ctx.save();
        ctx.translate(p.x + CW / 2, p.y + CHt / 2 - (sobre ? 3 : 0));
        ctx.scale(cara >= 0 ? Math.max(0.05, Math.abs(Math.cos((1 - prog) * Math.PI / 2))) : 1, 1);
        if (cara >= 0 && prog > 0.5 || cara >= 0 && !g0) {
          D.caja(-CW / 2, -CHt / 2, CW, CHt, {
            r: 10, fill: dueno ? J.color(dueno) + "33" : "#fdf4ff",
            stroke: dueno ? J.color(dueno) : "#f0abfc", lw: dueno ? 2.5 : 2,
          });
          ctx.globalAlpha = dueno ? 0.75 : 1;
          D.txt(MEMO.CARAS[cara], 0, 3, { size: 46, peso: 400 });
          ctx.globalAlpha = 1;
        } else {
          D.caja(-CW / 2, -CHt / 2, CW, CHt, { r: 10, fill: sobre ? "#9d174d" : "#831843", stroke: sobre ? "#f9a8d4" : "#be185d", lw: 2 });
          ctx.strokeStyle = "rgba(249,168,212,0.25)"; ctx.lineWidth = 1.5;
          D.rr(-CW / 2 + 8, -CHt / 2 + 8, CW - 16, CHt - 16, 6); ctx.stroke();
          D.txt("?", 0, 2, { size: 28, f: "o", color: "rgba(249,168,212,0.55)" });
        }
        ctx.restore();
      }
      const quedan = 15 - v.puntos[1] - v.puntos[2];
      if (!v.g) D.txt(quedan + (quedan === 1 ? " par por encontrar" : " pares por encontrar"), 480, 590, { size: 13, color: C.tenue });
    },

    textoFin(J, v) { return { sub: v.puntos[1] + " pares contra " + v.puntos[2] }; },
  });
})();
