// ==========================================================================
//  Modulo de juego: REVERSI (JUEGOS.reversi). Render + input sobre el kit.
// ==========================================================================
(function () {
  const T = 64, BX = (960 - T * 8) / 2, BY = 66;
  const D = Kit.D, C = Kit.COL;

  function jugar(J, i) {
    const v = J.v;
    if (!v || v.g || v.turno !== v.yo) return;
    if (!v.validas.includes(i)) { J.sfx("error"); return; }
    J.accion({ i });
  }

  Kit.juego({
    id: "reversi",
    nombre: "Reversi",
    desc: "Encierra las fichas rivales para darlas vuelta. Las esquinas valen oro.",
    ayuda: "<b>Reversi:</b> click en una casilla marcada. Si no tienes jugada, pasas automáticamente. Gana quien tenga más fichas al final.",
    meta: { tag: "OTHELLO", icono: "⚫", gradiente: "linear-gradient(135deg, #14532d 0%, #052e16 100%)", color: "#4ade80" },
    tipo: "turnos",
    canvas: { w: 960, h: 600 },
    Sim: ReversiSim,
    fondo: "#08130d",
    local: () => ({ anim: null }),

    evento(J, e) {
      if (e.tipo === "ficha") { J.local.anim = { t0: J.t }; J.sfx("ficha"); if (e.n >= 5) J.sfx("moneda"); }
      if (e.tipo === "paso") J.aviso(e.j === J.rol ? "No tienes jugadas: pasas" : "El rival no tiene jugadas: pasa", C.acento, 2.4);
    },

    pintar(J, v) {
      const miTurno = !v.g && v.turno === v.yo;
      D.marcador(J, { p1: v.cuenta[1], p2: v.cuenta[2] });
      if (!v.g) D.turno(J, miTurno);

      // tablero
      D.caja(BX - 14, BY - 14, T * 8 + 28, T * 8 + 28, { r: 14, fill: "#3f2a14", stroke: "#7c5a2e", lw: 2 });
      ctx.fillStyle = "#166534"; ctx.fillRect(BX, BY, T * 8, T * 8);
      ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let k = 0; k <= 8; k++) { ctx.moveTo(BX + k * T, BY); ctx.lineTo(BX + k * T, BY + 8 * T); ctx.moveTo(BX, BY + k * T); ctx.lineTo(BX + 8 * T, BY + k * T); }
      ctx.stroke();
      for (const [f, c] of [[2, 2], [2, 6], [6, 2], [6, 6]]) D.circ(BX + c * T, BY + f * T, 4, "rgba(0,0,0,0.5)");

      // fichas (las volteadas giran 0.35 s)
      const an = v.ult >= 0 && J.local.anim ? (J.t - J.local.anim.t0) / 0.35 : 1;
      for (let i = 0; i < 64; i++) {
        const j = v.tab[i];
        if (!j) continue;
        const x = BX + (i & 7) * T + T / 2, y = BY + (i >> 3) * T + T / 2;
        if (i === v.ult && an < 1) {   // la recien puesta aparece creciendo
          D.ficha(x, y, T * 0.4 * Math.min(1, an * 1.6), J.color(j));
          continue;
        }
        if (an < 1 && v.volt.includes(i)) {
          const p = Math.min(1, an), col = p < 0.5 ? J.color(Kit.otro(j)) : J.color(j);
          ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(0.06, Math.abs(Math.cos(p * Math.PI))), 1);
          D.ficha(0, 0, T * 0.4, col); ctx.restore();
          continue;
        }
        D.ficha(x, y, T * 0.4, J.color(j));
      }
      if (v.ult >= 0 && an >= 1) D.circ(BX + (v.ult & 7) * T + T / 2, BY + (v.ult >> 3) * T + T / 2, 5, "rgba(255,255,255,0.7)");

      // jugadas validas
      if (miTurno) for (const i of v.validas) {
        const x = BX + (i & 7) * T, y = BY + (i >> 3) * T;
        const sobre = J.zona(x, y, T, T, () => jugar(J, i));
        D.circ(x + T / 2, y + T / 2, sobre ? T * 0.36 : 7, sobre ? J.miColor() + "66" : "rgba(255,255,255,0.28)", sobre ? J.miColor() : null, 2);
      }
    },

    textoFin(J, v, g) {
      const c = v.cuenta;
      return { sub: c[1] + " a " + c[2] + (g === 3 ? " — mismas fichas" : "") };
    },
  });
})();
