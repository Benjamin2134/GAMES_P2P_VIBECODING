// ==========================================================================
//  Modulo de juego: TRES EN RAYA ULTIMATE (JUEGOS.ultimate).
// ==========================================================================
(function () {
  const CEL = 52, GAP = 14, CH = CEL * 3, TOT = CH * 3 + GAP * 2, BX = (960 - TOT) / 2, BY = 72;
  const D = Kit.D, C = Kit.COL;
  const pos = (b, k) => ({
    x: BX + (b % 3) * (CH + GAP) + (k % 3) * CEL,
    y: BY + Math.floor(b / 3) * (CH + GAP) + Math.floor(k / 3) * CEL,
  });

  function marca(j, x, y, t, color, grosor = 5, alfa = 1) {
    ctx.globalAlpha = alfa;
    ctx.strokeStyle = color; ctx.lineWidth = grosor; ctx.lineCap = "round";
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    const m = t * 0.26;
    ctx.beginPath();
    if (j === 1) { ctx.moveTo(x + m, y + m); ctx.lineTo(x + t - m, y + t - m); ctx.moveTo(x + t - m, y + m); ctx.lineTo(x + m, y + t - m); }
    else ctx.arc(x + t / 2, y + t / 2, t / 2 - m, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.lineCap = "butt";
  }

  Kit.juego({
    id: "ultimate",
    nombre: "Tres en Raya Ultimate",
    desc: "Nueve gatos en uno: donde juegas decide dónde juega tu rival. Táctico y adictivo.",
    ayuda: "<b>Ultimate:</b> juega en el tablero chico iluminado. La casilla que eliges manda al rival al tablero chico en esa misma posición. Si ese tablero ya está decidido, el rival elige libre. Gana tres tableros en línea.",
    meta: { tag: "9×9", icono: "#️⃣", gradiente: "linear-gradient(135deg, #312e81 0%, #0f0a1f 100%)", color: "#a5b4fc" },
    tipo: "turnos",
    canvas: { w: 960, h: 600 },
    Sim: UltimateSim,
    fondo: "#0c0a1a",

    evento(J, e) {
      if (e.tipo === "marca") {
        J.sfx("ficha");
        if (e.chico === 1 || e.chico === 2) {
          J.sfx("moneda");
          const p = pos(e.b, 4);
          J.chispas(p.x + CEL / 2, p.y + CEL / 2, J.color(e.chico), 24, 220);
        }
      }
    },

    pintar(J, v) {
      const miTurno = !v.g && v.turno === v.yo;
      D.marcador(J, { p1: "✕", p2: "◯" });
      if (!v.g) D.turno(J, miTurno);
      const jugables = new Set(miTurno ? UT.movs(v.tab, v.gane, v.activo).map(([b, k]) => b * 9 + k) : []);

      for (let b = 0; b < 9; b++) {
        const p = pos(b, 0);
        const activo = !v.g && !v.gane[b] && (v.activo < 0 || v.activo === b);
        D.caja(p.x - 4, p.y - 4, CH + 8, CH + 8, {
          r: 10, fill: activo ? (miTurno ? J.miColor() + "1f" : "rgba(255,255,255,0.05)") : "rgba(255,255,255,0.02)",
          stroke: activo ? (miTurno ? J.miColor() : "rgba(255,255,255,0.25)") : "rgba(255,255,255,0.06)", lw: activo ? 2 : 1,
        });
        ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 2; ctx.beginPath();
        for (let k = 1; k < 3; k++) {
          ctx.moveTo(p.x + k * CEL, p.y + 6); ctx.lineTo(p.x + k * CEL, p.y + CH - 6);
          ctx.moveTo(p.x + 6, p.y + k * CEL); ctx.lineTo(p.x + CH - 6, p.y + k * CEL);
        }
        ctx.stroke();
        for (let k = 0; k < 9; k++) {
          const q = pos(b, k), j = v.tab[b * 9 + k];
          if (j) marca(j, q.x, q.y, CEL, J.color(j), 4, v.gane[b] ? 0.3 : 1);
          else if (jugables.has(b * 9 + k)) {
            const sobre = J.zona(q.x, q.y, CEL, CEL, () => J.accion({ b, k }));
            if (sobre) marca(v.yo, q.x, q.y, CEL, J.miColor(), 4, 0.45);
          }
        }
        if (v.ult && v.ult.b === b) {
          const q = pos(b, v.ult.k);
          ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5; ctx.strokeRect(q.x + 3, q.y + 3, CEL - 6, CEL - 6);
        }
        if (v.gane[b] === 1 || v.gane[b] === 2) marca(v.gane[b], p.x, p.y, CH, J.color(v.gane[b]), 10);
        else if (v.gane[b] === 3) D.txt("—", p.x + CH / 2, p.y + CH / 2, { size: 40, color: C.tenue });
      }
      if (miTurno) D.txt(v.activo < 0 ? "Puedes jugar en cualquier tablero libre" : "Juega en el tablero iluminado", 480, 588, { size: 13, color: C.tenue });
    },
  });
})();
