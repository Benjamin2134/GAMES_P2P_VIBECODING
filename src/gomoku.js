// ==========================================================================
//  Modulo de juego: GOMOKU (JUEGOS.gomoku). Tablero tipo Go, 15x15.
// ==========================================================================
(function () {
  const N = 15, P = 36, X0 = 480 - (P * (N - 1)) / 2, Y0 = 66;
  const D = Kit.D, C = Kit.COL;
  const xy = (i) => ({ x: X0 + (i % N) * P, y: Y0 + Math.floor(i / N) * P });

  Kit.juego({
    id: "gomoku",
    nombre: "Gomoku",
    desc: "Cinco en línea sobre un tablero de 15×15. Ataca, bloquea y arma dobles amenazas.",
    ayuda: "<b>Gomoku:</b> click en una intersección libre. Gana quien alinea cinco piedras (horizontal, vertical o diagonal).",
    meta: { tag: "5ROW", icono: "⚪", gradiente: "linear-gradient(135deg, #a16207 0%, #422006 100%)", color: "#fde047" },
    tipo: "turnos",
    canvas: { w: 960, h: 600 },
    Sim: GomokuSim,
    fondo: "#140f06",

    evento(J, e) { if (e.tipo === "piedra") { J.sfx("ficha"); J.local.t0 = J.t; } },

    pintar(J, v) {
      const miTurno = !v.g && v.turno === v.yo;
      D.marcador(J, {});
      if (!v.g) D.turno(J, miTurno);
      D.caja(X0 - 26, Y0 - 26, P * (N - 1) + 52, P * (N - 1) + 52, { r: 10, fill: "#d6a75c", stroke: "#8a6326", lw: 2 });
      ctx.strokeStyle = "rgba(60,35,10,0.75)"; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let k = 0; k < N; k++) {
        ctx.moveTo(X0 + k * P, Y0); ctx.lineTo(X0 + k * P, Y0 + (N - 1) * P);
        ctx.moveTo(X0, Y0 + k * P); ctx.lineTo(X0 + (N - 1) * P, Y0 + k * P);
      }
      ctx.stroke();
      for (const [f, c] of [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]]) D.circ(X0 + c * P, Y0 + f * P, 4, "rgba(60,35,10,0.85)");

      for (let i = 0; i < N * N; i++) {
        const p = xy(i), j = v.tab[i];
        if (j) {
          const nueva = i === v.ult && J.local.t0 && J.t - J.local.t0 < 0.2;
          D.ficha(p.x, p.y, P * 0.43 * (nueva ? 0.6 + (J.t - J.local.t0) * 2 : 1), J.color(j));
        } else if (miTurno) {
          const sobre = J.zona(p.x - P / 2, p.y - P / 2, P, P, () => J.accion({ i }));
          if (sobre) D.ficha(p.x, p.y, P * 0.43, J.miColor(), { alpha: 0.45 });
        }
      }
      if (v.ult >= 0 && !v.linea) { const p = xy(v.ult); D.circ(p.x, p.y, 4, "#fff"); }
      if (v.linea) {
        const pulso = 0.5 + 0.5 * Math.sin(J.t * 8);
        for (const i of v.linea) { const p = xy(i); D.circ(p.x, p.y, P * 0.46, null, "#fff", 2 + pulso * 3, "#fff"); }
      }
    },
  });
})();
