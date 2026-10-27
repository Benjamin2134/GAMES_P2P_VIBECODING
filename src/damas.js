// ==========================================================================
//  Modulo de juego: DAMAS (JUEGOS.damas). Cada jugador ve sus piezas abajo.
// ==========================================================================
(function () {
  const T = 64, BX = (960 - T * 8) / 2, BY = 66;
  const D = Kit.D, C = Kit.COL;
  // indice de tablero -> casilla en pantalla (el guest ve el tablero girado)
  const pant = (J, i) => (J.rol === 2 ? 63 - i : i);

  function click(J, i) {
    const v = J.v;
    if (!v || v.g || v.turno !== v.yo) return;
    const L = J.local;
    const desde = v.enc >= 0 ? v.enc : L.sel;
    if (desde >= 0 && v.movs.some(([d, a]) => d === desde && a === i)) { J.accion({ de: desde, a: i }); L.sel = -1; return; }
    if (v.movs.some(([d]) => d === i)) { L.sel = i; J.sfx("tic"); return; }
    // destino unico sin seleccionar
    const llegan = v.movs.filter(([, a]) => a === i);
    if (llegan.length === 1) { J.accion({ de: llegan[0][0], a: i }); L.sel = -1; return; }
    if (DM.dueno(v.tab[i]) === v.yo) J.aviso(v.movs.some((m) => m[2] >= 0) ? "Captura obligatoria" : "Esa pieza no tiene jugada", C.mal, 1.6);
    L.sel = -1;
  }

  Kit.juego({
    id: "damas",
    nombre: "Damas",
    desc: "Clásicas damas chilenas: captura obligatoria, saltos múltiples y dama voladora.",
    ayuda: "<b>Damas:</b> click en tu pieza y luego en el destino. Capturar es obligatorio; si puedes seguir saltando, sigues. El peón corona en la última fila y la dama se mueve a cualquier distancia.",
    meta: { tag: "DAMAS", icono: "⛀", gradiente: "linear-gradient(135deg, #7c2d12 0%, #1c1917 100%)", color: "#fb923c" },
    tipo: "turnos",
    canvas: { w: 960, h: 600 },
    Sim: DamasSim,
    fondo: "#120c08",
    local: () => ({ sel: -1, anim: null }),

    evento(J, e) {
      if (e.tipo === "mueve") J.sfx("ficha");
      if (e.tipo === "captura") {
        J.sfx("golpe");
        const i = pant(J, e.cap);
        J.chispas(BX + (i & 7) * T + T / 2, BY + (i >> 3) * T + T / 2, J.color(Kit.otro(e.j)), 16, 180);
      }
      if (e.corona) { J.sfx("powerup"); J.aviso("¡Coronó una dama!", C.acento, 1.8); }
      J.local.anim = { t0: J.t };
    },

    pintar(J, v) {
      const L = J.local, miTurno = !v.g && v.turno === v.yo;
      D.marcador(J, { p1: v.cuenta[1], p2: v.cuenta[2] });
      if (!v.g) D.turno(J, miTurno, null, null, v.enc >= 0 && miTurno ? " · SIGUE CAPTURANDO" : "");
      if (v.sinAvance >= 30 && !v.g) D.txt("Empate en " + (50 - v.sinAvance) + " jugadas sin capturas", 480, 586, { size: 13, color: C.tenue });

      D.caja(BX - 14, BY - 14, T * 8 + 28, T * 8 + 28, { r: 12, fill: "#3b2414", stroke: "#8a5a32", lw: 2 });
      const desde = v.enc >= 0 ? v.enc : L.sel;
      const destinos = new Set(v.movs.filter(([d]) => d === desde).map(([, a]) => a));
      const movibles = new Set(v.movs.map(([d]) => d));

      for (let i = 0; i < 64; i++) {
        const p = pant(J, i), x = BX + (p & 7) * T, y = BY + (p >> 3) * T;
        const oscura = ((i >> 3) + (i & 7)) % 2 === 1;
        ctx.fillStyle = oscura ? "#5b3a1f" : "#e8d3a9";
        ctx.fillRect(x, y, T, T);
        if (v.ult && (v.ult.de === i || v.ult.a === i)) { ctx.fillStyle = "rgba(244,185,68,0.28)"; ctx.fillRect(x, y, T, T); }
        if (oscura) J.zona(x, y, T, T, () => click(J, i), { off: !miTurno });
      }
      for (let i = 0; i < 64; i++) {
        const x0 = v.tab[i];
        if (!x0) continue;
        const p = pant(J, i), x = BX + (p & 7) * T + T / 2, y = BY + (p >> 3) * T + T / 2, d = DM.dueno(x0);
        const sel = i === desde && miTurno;
        D.ficha(x, y, T * 0.38, J.color(d), { anillo: true, glow: sel ? "#fff" : (miTurno && movibles.has(i) ? J.color(d) : null) });
        if (DM.rey(x0)) D.txt("♛", x, y + 2, { size: 28, color: "#fde68a", glow: "#f59e0b" });
      }
      if (miTurno) for (const a of destinos) {
        const p = pant(J, a);
        D.circ(BX + (p & 7) * T + T / 2, BY + (p >> 3) * T + T / 2, 10, J.miColor() + "aa", "#fff", 1.5);
      }
    },

    textoFin(J, v, g) {
      if (g === 3) return { sub: "50 jugadas sin capturas" };
      return { sub: g === J.rol ? "El rival se quedó sin jugadas" : "Te quedaste sin jugadas" };
    },
  });
})();
