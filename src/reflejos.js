// ==========================================================================
//  Modulo de juego: DUELO DE REFLEJOS (JUEGOS.reflejos). El tiempo de
//  reaccion se mide en este navegador desde que se dibuja la señal.
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL;

  function apretar(J) {
    const v = J.v, L = J.local;
    if (!v || v.g || v.fase === "res" || L.enviado === v.r) return;
    L.enviado = v.r;
    if (v.fase === "ya" && L.vioYa === v.r) {
      L.mio = Math.round((performance.now() - L.t0) );
      J.accion({ r: v.r, ms: L.mio });
    } else J.accion({ r: v.r, falso: 1 });
  }

  Kit.juego({
    id: "reflejos",
    nombre: "Duelo de Reflejos",
    desc: "Espera la señal verde y aprieta antes que tu rival. Si te adelantas, pierdes la ronda.",
    ayuda: "<b>Reflejos:</b> cuando el círculo se ponga <b style='color:#4ade80'>VERDE</b>, aprieta <kbd>espacio</kbd> o haz click/toca. Si aprietas antes (o en el amarillo, que es trampa), pierdes la ronda. Primero a 5.",
    meta: { tag: "FAST", icono: "⚡", gradiente: "linear-gradient(135deg, #854d0e 0%, #1a1405 100%)", color: "#fde047" },
    tipo: "real",
    canvas: { w: 960, h: 600 },
    Sim: ReflejosSim,
    hz: 240,
    fondo: "#0a0a0a",
    local: () => ({ vioYa: 0, t0: 0, enviado: 0, mio: 0 }),

    evento(J, e) {
      if (e.tipo === "res") {
        if (e.falso) { J.sfx("error"); J.aviso(e.falso === J.rol ? "¡Salida en falso!" : (J.esBot ? "El bot" : "El rival") + " se adelantó", C.mal, 1.8); }
        else J.sfx(e.g === J.rol ? "punto" : e.g ? "error" : "sonar");
      }
    },
    teclado(J, e, abajo) {
      if (e.key !== " " && e.key !== "Enter") return false;
      if (abajo && !e.repeat) apretar(J);
      return true;
    },
    puntero(J, tipo) { if (tipo === "abajo") apretar(J); },

    pintar(J, v) {
      const L = J.local;
      // el instante en que ESTE navegador dibuja la señal es el cero del cronometro
      if (v.fase === "ya" && L.vioYa !== v.r) { L.vioYa = v.r; L.t0 = performance.now(); J.sfx("gong"); }
      const col = { espera: "#7f1d1d", trampa: "#ca8a04", ya: "#16a34a", res: "#1f2937" }[v.fase];
      const brillo = { espera: "#ef4444", trampa: "#facc15", ya: "#4ade80", res: "#6b7280" }[v.fase];
      const txt = { espera: "ESPERA…", trampa: "¿YA?", ya: "¡YA!", res: "" }[v.fase];
      const pulso = v.fase === "ya" ? 1 + Math.sin(J.t * 30) * 0.02 : 1;
      D.circ(480, 320, 170 * pulso, col, brillo, 6, brillo);
      D.txt(txt, 480, 322, { size: 54, f: "b", color: "#fff" });
      if (v.fase === "ya" && L.enviado === v.r && L.mio) D.txt(L.mio + " ms", 480, 380, { size: 20, f: "o" });
      if (v.fase === "res" && v.res) {
        const r = v.res;
        if (r.falso) D.txt(J.nombre(r.falso) + " salió en falso", 480, 290, { size: 26, f: "b", color: C.mal });
        else {
          D.txt(r.g ? "Ronda para " + J.nombre(r.g) : "Nadie apretó", 480, 280, { size: 28, f: "b", color: r.g ? J.color(r.g) : C.tenue });
          for (const j of [1, 2]) D.txt(J.nombre(j) + ": " + (r.ms[j] === null ? "—" : r.ms[j] + " ms"), 480, 330 + (j - 1) * 34, { size: 20, f: "o", color: J.color(j) });
        }
      }
      for (const j of [1, 2]) if (v.ya[j] && v.fase === "ya") D.txt("✓ " + J.nombre(j), j === 1 ? 200 : 760, 320, { size: 22, f: "o", color: J.color(j) });
      D.marcador(J, { p1: v.puntos[1], p2: v.puntos[2], centro: "A " + RF.RONDAS + " · RONDA " + v.r, y: 30 });
    },
    textoFin(J, v) { return { sub: v.puntos[1] + " a " + v.puntos[2] }; },
  });
})();
