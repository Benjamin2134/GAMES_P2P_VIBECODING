// ==========================================================================
//  Modulo de juego: SUMO (JUEGOS.sumo).
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL;
  const K = { ArrowUp: "u", w: "u", W: "u", ArrowDown: "d", s: "d", S: "d", ArrowLeft: "l", a: "l", A: "l", ArrowRight: "r", d: "r", D: "r" };

  function actualizar(J) {
    const k = J.local.k;
    if (J.local.apunta) return;
    J.inp.ax = (k.r ? 1 : 0) - (k.l ? 1 : 0); J.inp.ay = (k.d ? 1 : 0) - (k.u ? 1 : 0);
  }

  Kit.juego({
    id: "sumo",
    nombre: "Sumo",
    desc: "Empuja al rival fuera del plato antes de que se achique. Inercia, choques y embestidas.",
    ayuda: "<b>Sumo:</b> <kbd>WASD</kbd>/flechas para moverte, <kbd>espacio</kbd> embiste (se recarga). Con mouse o dedo: mantén apretado hacia donde quieres ir y usa el botón EMBESTIR. El plato se achica: ¡no te caigas!",
    meta: { tag: "PUSH", icono: "🔴", gradiente: "linear-gradient(135deg, #b91c1c 0%, #1f0505 100%)", color: "#fca5a5" },
    tipo: "real",
    canvas: { w: 960, h: 600 },
    Sim: SumoSim,
    continuo: true,
    fondo: "#0d0707",
    local: () => ({ k: {}, apunta: false }),
    inp: () => ({ ax: 0, ay: 0 }),

    evento(J, e) {
      if (e.tipo === "choque") { J.sfx("golpe", 0.8 + e.f); J.sacudir(4 + e.f * 10); J.chispas(e.x, e.y, "#fde68a", 8 + Math.round(e.f * 20), 200); }
      if (e.tipo === "dash") J.sfx("salto");
      if (e.tipo === "cae") J.sfx("caida");
      if (e.tipo === "ronda" && J.v && !J.v.g) J.aviso(e.g ? (e.g === J.rol ? "¡Ronda tuya!" : "Ronda para " + J.nombre(e.g)) : "¡Cayeron los dos!", e.g ? J.color(e.g) : C.tenue, 1.6);
    },
    teclado(J, e, abajo) {
      if (e.key === " ") { if (abajo && !e.repeat) J.accion({ dash: 1 }); return true; }
      const d = K[e.key]; if (!d) return false;
      J.local.k[d] = abajo; J.local.apunta = false; actualizar(J); return true;
    },
    puntero(J, tipo, x, y) {
      const v = J.v; if (!v) return;
      if (tipo === "arriba") { J.local.apunta = false; J.inp.ax = 0; J.inp.ay = 0; return; }
      if (tipo === "abajo") J.local.apunta = true;
      if (!J.local.apunta) return;
      const yo = J.rol === 1 ? v.b1 : v.b2, dx = x - yo.x, dy = y - yo.y, l = Math.hypot(dx, dy);
      J.inp.ax = l > 20 ? dx / l : 0; J.inp.ay = l > 20 ? dy / l : 0;
    },

    pintar(J, v) {
      // plato: el borde original tenue y el actual brillante
      D.circ(SU.CX, SU.CY, SU.R0 + 14, "#1c1210");
      D.circ(SU.CX, SU.CY, SU.R0, "rgba(255,255,255,0.03)", "rgba(255,255,255,0.06)", 2);
      const g = ctx.createRadialGradient(SU.CX, SU.CY, 10, SU.CX, SU.CY, v.radio);
      g.addColorStop(0, "#e7d3a8"); g.addColorStop(1, "#b48a52");
      D.circ(SU.CX, SU.CY, v.radio, g, "#fef3c7", 4, "#f59e0b");
      D.circ(SU.CX, SU.CY, v.radio * 0.35, null, "rgba(120,53,15,0.4)", 2);
      for (const j of [1, 2]) {
        const b = j === 1 ? v.b1 : v.b2;
        const x = J.s("x" + j, b.x), y = J.s("y" + j, b.y), escala = b.d ? 1 : 0.7;
        D.circ(x + 4, y + 6, SU.R * escala, "rgba(0,0,0,0.3)");
        D.ficha(x, y, SU.R * escala, J.color(j), { glow: b.e ? "#fff" : J.color(j) });
        // recarga del dash
        if (b.cd > 0) { ctx.beginPath(); ctx.arc(x, y, SU.R + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - b.cd / SU.DASH_CD)); ctx.strokeStyle = J.color(j); ctx.lineWidth = 3; ctx.stroke(); }
        if (j === J.rol) D.txt("▼", x, y - SU.R - 14, { size: 14, color: J.color(j) });
      }
      D.marcador(J, { p1: v.rondas[1], p2: v.rondas[2], centro: "A " + SU.RONDAS + " RONDAS", y: 30 });
      if (v.fase === "cuenta") D.txt("¡HAKKEYOI!", 480, 330, { size: 42, f: "b", color: C.acento, glow: C.acento });
      J.boton(820, 520, 120, 56, "EMBESTIR", () => J.accion({ dash: 1 }), { lleno: true, color: J.miColor(), f: "o", size: 14 });
    },
    textoFin(J, v) { return { sub: v.rondas[1] + " a " + v.rondas[2] + " rondas" }; },
  });
})();
