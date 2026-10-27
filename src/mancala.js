// ==========================================================================
//  Modulo de juego: MANCALA (JUEGOS.mancala). Tu fila siempre abajo y tu
//  granero a la derecha; se siembra en sentido antihorario.
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL;
  const PX = (k) => 240 + k * 96, Y_AB = 392, Y_AR = 228, R_HOYO = 40;
  const GEMAS = ["#f472b6", "#38bdf8", "#facc15", "#4ade80", "#a78bfa", "#fb923c", "#f87171", "#2dd4bf"];

  // Posicion en pantalla de cada hoyo desde la perspectiva de "yo".
  function lugar(yo, i) {
    const o = yo === 1 ? 2 : 1;
    if (i === MC.granero(yo)) return { x: 838, y: 310, g: true };
    if (i === MC.granero(o)) return { x: 122, y: 310, g: true };
    const mio = i >= MC.inicio(yo) && i < MC.inicio(yo) + 6;
    const k = mio ? i - MC.inicio(yo) : i - MC.inicio(o);
    return mio ? { x: PX(k), y: Y_AB, k } : { x: PX(5 - k), y: Y_AR, k };
  }

  // Semillas en posiciones pseudoaleatorias estables (no tiemblan entre frames).
  function semillas(x, y, n, radio) {
    const max = Math.min(n, 18);
    for (let s = 0; s < max; s++) {
      const h = Math.sin((s + 1) * 12.9898 + n * 0.37 + x * 0.011) * 43758.5453;
      const a = (h - Math.floor(h)) * Math.PI * 2, d = Math.sqrt(((s * 0.618) % 1)) * radio * 0.62;
      D.ficha(x + Math.cos(a) * d, y + Math.sin(a) * d * (radio > 60 ? 2.4 : 1), 6.5, GEMAS[s % GEMAS.length]);
    }
  }

  function jugar(J, k) {
    const v = J.v;
    if (!v || v.g || v.turno !== v.yo) return;
    if (!v.h[MC.inicio(v.yo) + k]) { J.sfx("error"); return; }
    J.accion({ k });
  }

  Kit.juego({
    id: "mancala",
    nombre: "Mancala",
    desc: "Siembra semillas, roba las del rival y encadena turnos extra. Kalah clásico 6×4.",
    ayuda: "<b>Mancala:</b> click en uno de tus hoyos (fila de abajo) o teclas <kbd>1</kbd>-<kbd>6</kbd>. Si la última semilla cae en tu granero, juegas otra vez. Si cae en un hoyo tuyo vacío, capturas lo de enfrente.",
    meta: { tag: "KALAH", icono: "🫘", gradiente: "linear-gradient(135deg, #78350f 0%, #1c0f05 100%)", color: "#fbbf24" },
    tipo: "turnos",
    canvas: { w: 960, h: 600 },
    Sim: MancalaSim,
    fondo: "#120a04",
    local: () => ({ anim: null, paso: -1 }),

    evento(J, e) {
      if (e.tipo !== "siembra") return;
      const u = J.v && J.v.ult;
      J.local.anim = { t0: J.t, camino: u ? u.camino : [], captura: e.captura, j: e.j };
      J.local.paso = -1;
      if (e.extra) J.aviso(e.j === J.rol ? "¡Turno extra!" : "El rival repite turno", C.acento, 1.6);
    },
    teclado(J, e, abajo) {
      if (abajo && e.key >= "1" && e.key <= "6") { jugar(J, +e.key - 1); return true; }
      return false;
    },

    pintar(J, v) {
      const L = J.local, yo = v.yo, o = Kit.otro(yo), miTurno = !v.g && v.turno === yo;
      D.marcador(J, { p1: v.h[6], p2: v.h[13] });
      if (!v.g) D.turno(J, miTurno);

      D.caja(60, 150, 840, 320, { r: 150, fill: "#6b3f1d", stroke: "#a16b3a", lw: 3, glow: "#000", blur: 30 });
      D.caja(74, 164, 812, 292, { r: 140, fill: "#7c4a22" });

      // animacion: resalta el camino de la siembra hoyo por hoyo
      let paso = -1;
      const an = L.anim;
      if (an) {
        paso = Math.floor((J.t - an.t0) / 0.11);
        if (paso >= an.camino.length + 6) L.anim = null;
        else if (paso !== L.paso && paso < an.camino.length) { L.paso = paso; J.sfx("tic"); }
      }

      for (let i = 0; i < 14; i++) {
        const p = lugar(yo, i), n = v.h[i];
        const radio = p.g ? 46 : R_HOYO;
        const resaltado = an && paso >= 0 && an.camino.slice(0, paso + 1).includes(i) && paso < an.camino.length + 6;
        const esMio = !p.g && p.y === Y_AB;
        const jugable = miTurno && esMio && n > 0;
        if (p.g) D.caja(p.x - radio, p.y - 120, radio * 2, 240, { r: radio, fill: "#3b200c", stroke: resaltado ? "#fde68a" : "rgba(0,0,0,0.4)", lw: resaltado ? 3 : 2 });
        else D.circ(p.x, p.y, radio, "#3b200c", resaltado ? "#fde68a" : jugable ? J.miColor() : "rgba(0,0,0,0.4)", resaltado || jugable ? 3 : 2);
        if (an && an.captura === i && paso >= an.camino.length) D.circ(p.x, p.y, radio + 4, null, C.mal, 3, C.mal);
        semillas(p.x, p.y, n, p.g ? 70 : radio);
        const ty = p.g ? p.y + 140 : esMio ? p.y + 58 : p.y - 58;
        D.txt(n, p.x, ty, { size: p.g ? 22 : 17, f: "o", color: p.g ? (i === MC.granero(yo) ? J.miColor() : J.color(o)) : "#fde68a" });
        if (jugable) {
          J.zona(p.x - radio, p.y - radio, radio * 2, radio * 2, () => jugar(J, p.k));
          D.txt(p.k + 1, p.x, p.y + radio + 34, { size: 11, color: C.tenue });
        }
      }
      D.txt("TU GRANERO", 838, 172, { size: 11, color: J.miColor(), f: "o" });
      D.txt(J.esBot ? "BOT" : "RIVAL", 122, 172, { size: 11, color: J.color(o), f: "o" });
    },

    textoFin(J, v) { return { sub: v.h[6] + " a " + v.h[13] + " semillas" }; },
  });
})();
