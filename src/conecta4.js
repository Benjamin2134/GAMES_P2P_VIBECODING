// ==========================================================================
//  Modulo de juego: CONECTA 4 (JUEGOS.conecta4). Render + input sobre el kit.
// ==========================================================================
(function () {
  const T = 72, BW = T * 7, BH = T * 6, BX = (960 - BW) / 2, BY = 120;
  const D = Kit.D, C = Kit.COL;

  function soltar(J, v, c) {
    if (!v || v.g || v.turno !== v.yo) return;
    if (C4.caer(v.tab, c) < 0) { J.sfx("error"); return; }
    J.accion({ col: c });
  }

  Kit.juego({
    id: "conecta4",
    nombre: "Conecta 4",
    desc: "Deja caer fichas y alinea cuatro antes que tu rival: horizontal, vertical o diagonal.",
    ayuda: "<b>Conecta 4:</b> click en una columna o teclas <kbd>1</kbd>-<kbd>7</kbd>. También <kbd>←</kbd>/<kbd>→</kbd> y <kbd>espacio</kbd>.",
    meta: { tag: "4ROW", icono: "🔴", gradiente: "linear-gradient(135deg, #1e3a8a 0%, #0b1020 100%)", color: "#60a5fa" },
    tipo: "turnos",
    canvas: { w: 960, h: 600 },
    Sim: Conecta4Sim,
    fondo: "#0a0f1f",
    local: () => ({ sel: 3, anim: null }),

    evento(J, e) {
      if (e.tipo === "ficha") { J.local.anim = { c: e.c, f: e.f, j: e.j, t0: J.t }; J.sfx("caida"); }
    },

    teclado(J, e, abajo) {
      if (!abajo) return false;
      const v = J.v, k = e.key;
      if (k >= "1" && k <= "7") { soltar(J, v, +k - 1); return true; }
      if (k === "ArrowLeft") { J.local.sel = (J.local.sel + 6) % 7; return true; }
      if (k === "ArrowRight") { J.local.sel = (J.local.sel + 1) % 7; return true; }
      if (k === " " || k === "Enter" || k === "ArrowDown") { soltar(J, v, J.local.sel); return true; }
      return false;
    },
    puntero(J, tipo, x) {
      if (x >= BX && x < BX + BW) J.local.sel = Math.floor((x - BX) / T);
    },

    pintar(J, v) {
      const L = J.local, miTurno = !v.g && v.turno === v.yo;
      D.marcador(J, {});
      if (!v.g) D.turno(J, miTurno);

      // zona de click por columna (encima del tablero tambien)
      for (let c = 0; c < 7; c++) J.zona(BX + c * T, BY - 70, T, BH + 70, () => soltar(J, J.v, c), { off: !miTurno });

      // ficha fantasma
      if (miTurno && J.ptr.y > 0) {
        const c = L.sel;
        D.ficha(BX + c * T + T / 2, BY - 40, T * 0.4, J.miColor(), { alpha: 0.55, anillo: true });
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fillRect(BX + c * T, BY, T, BH);
      }

      // fichas
      const an = L.anim;
      let animando = false;
      for (let f = 0; f < 6; f++) for (let c = 0; c < 7; c++) {
        const j = v.tab[f * 7 + c];
        if (!j) continue;
        if (an && an.c === c && an.f === f && J.t - an.t0 < 0.4) { animando = true; continue; }
        D.ficha(BX + c * T + T / 2, BY + f * T + T / 2, T * 0.4, J.color(j), { anillo: true });
      }
      if (animando) {
        const p = Math.min(1, (J.t - an.t0) / 0.4), y0 = BY - 40, y1 = BY + an.f * T + T / 2;
        D.ficha(BX + an.c * T + T / 2, y0 + (y1 - y0) * p * p, T * 0.4, J.color(an.j), { anillo: true });
      }

      // tablero con agujeros (evenodd)
      ctx.beginPath();
      ctx.rect(BX - 12, BY - 12, BW + 24, BH + 24);
      for (let f = 0; f < 6; f++) for (let c = 0; c < 7; c++) {
        ctx.moveTo(BX + c * T + T / 2 + T * 0.4, BY + f * T + T / 2);
        ctx.arc(BX + c * T + T / 2, BY + f * T + T / 2, T * 0.4, 0, Math.PI * 2);
      }
      ctx.fillStyle = "#1d4ed8";
      ctx.shadowColor = "#3b82f6"; ctx.shadowBlur = 18;
      ctx.fill("evenodd");
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#60a5fa"; ctx.lineWidth = 2;
      D.rr(BX - 12, BY - 12, BW + 24, BH + 24, 14); ctx.stroke();

      // ultima jugada y linea ganadora
      if (v.ult && !animando && !v.linea)
        D.circ(BX + v.ult.c * T + T / 2, BY + v.ult.f * T + T / 2, T * 0.12, "rgba(255,255,255,0.6)");
      if (v.linea && !animando) {
        const pulso = 0.5 + 0.5 * Math.sin(J.t * 8);
        for (const [f, c] of v.linea)
          D.circ(BX + c * T + T / 2, BY + f * T + T / 2, T * 0.42, null, "#fff", 3 + pulso * 3, "#fff");
      }
    },

    textoFin(J, v, g) {
      return g === 3 ? { texto: "EMPATE", sub: "Tablero lleno" } : { sub: g === J.rol ? "Cuatro en línea" : "Te alinearon cuatro" };
    },
  });
})();
