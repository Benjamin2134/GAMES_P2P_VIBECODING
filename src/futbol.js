// ==========================================================================
//  Modulo de juego: FUTBOL DE AUTOS (JUEGOS.futbol).
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL;

  function auto(x, y, a, color, fuego) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    if (fuego) { ctx.fillStyle = Math.random() > 0.5 ? "#f97316" : "#fde047"; ctx.beginPath(); ctx.moveTo(-30, -6); ctx.lineTo(-30 - 18 - Math.random() * 14, 0); ctx.lineTo(-30, 6); ctx.fill(); }
    D.caja(-30, -12, 60, 20, { r: 6, fill: color, glow: color });
    D.caja(-12, -22, 30, 12, { r: 5, fill: color });
    ctx.fillStyle = "rgba(186,230,253,0.85)"; ctx.fillRect(-6, -19, 20, 7);
    for (const wx of [-18, 18]) { D.circ(wx, 10, 8, "#111827", "#9ca3af", 2); }
    ctx.restore();
  }

  Kit.juego({
    id: "futbol",
    nombre: "Fútbol de Autos",
    desc: "Autos con turbo y saltos contra una pelota gigante. Vuela, gira en el aire y marca.",
    ayuda: "<b>Fútbol de Autos:</b> <kbd>←</kbd>/<kbd>→</kbd> acelerar (en el aire: girar), <kbd>↑</kbd> o <kbd>W</kbd> saltar, <kbd>espacio</kbd> o <kbd>Shift</kbd> turbo. Defiendes el arco de tu lado. 2 minutos o primero a 5.",
    meta: { tag: "CAR BALL", icono: "🚗", gradiente: "linear-gradient(135deg, #0f766e 0%, #021614 100%)", color: "#5eead4" },
    tipo: "real",
    canvas: { w: 960, h: 600 },
    Sim: FutbolSim,
    continuo: true,
    fondo: "#06101a",
    local: () => ({ k: {} }),
    inp: () => ({ x: 0, turbo: false }),

    evento(J, e) {
      if (e.tipo === "toque") J.sfx("golpe", 0.9 + e.f);
      if (e.tipo === "bote") J.sfx("rebote", 0.6);
      if (e.tipo === "salto") J.sfx("salto");
      if (e.tipo === "gol") {
        J.sfx(e.j === J.rol ? "fanfarria" : "error"); J.sacudir(14);
        J.chispas(e.x, e.y, J.color(e.j), 50, 340, 1, 3);
        J.aviso(e.j === J.rol ? "¡GOOOOL!" : "Gol de " + J.nombre(e.j), J.color(e.j), 1.4);
      }
    },
    teclado(J, e, abajo) {
      const k = e.key, L = J.local.k;
      if (k === "ArrowUp" || k === "w" || k === "W") { if (abajo && !e.repeat) J.accion({ salto: 1 }); return true; }
      if (k === " " || k === "Shift") { J.inp.turbo = abajo; return true; }
      const d = { ArrowLeft: "l", a: "l", A: "l", ArrowRight: "r", d: "r", D: "r" }[k];
      if (!d) return false;
      L[d] = abajo; J.inp.x = (L.r ? 1 : 0) - (L.l ? 1 : 0); return true;
    },

    pintar(J, v) {
      // estadio
      const g = ctx.createLinearGradient(0, 0, 0, 600);
      g.addColorStop(0, "#0b1a2e"); g.addColorStop(1, "#08202a");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 600);
      ctx.fillStyle = "#15803d"; ctx.fillRect(0, FU.SUELO, 960, 60);
      for (let x = 0; x < 960; x += 60) { ctx.fillStyle = (x / 60) % 2 ? "#166534" : "#15803d"; ctx.fillRect(x, FU.SUELO, 60, 60); }
      D.linea(480, FU.SUELO, 480, FU.TECHO, "rgba(255,255,255,0.06)", 2);
      D.circ(480, FU.SUELO, 90, null, "rgba(255,255,255,0.06)", 2);
      for (const [x, lado, j] of [[FU.X0, -1, 1], [FU.X1, 1, 2]]) {
        D.linea(x, FU.TECHO, x, FU.ARCO, "#94a3b8", 6);
        ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(lado < 0 ? 0 : x, FU.ARCO, 40, FU.SUELO - FU.ARCO);
        ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1;
        for (let y = FU.ARCO; y < FU.SUELO; y += 14) { ctx.beginPath(); ctx.moveTo(lado < 0 ? 0 : x, y); ctx.lineTo(lado < 0 ? x : 960, y); ctx.stroke(); }
        D.linea(lado < 0 ? 0 : x, FU.ARCO, lado < 0 ? x : 960, FU.ARCO, J.color(j), 5);
      }
      D.linea(0, FU.TECHO, 960, FU.TECHO, "#334155", 3);
      // pelota
      const bx = J.s("bx", v.b.x, 100), by = J.s("by", v.b.y, 100);
      D.circ(bx, FU.SUELO - 2, FU.R * clamp(1 - (FU.SUELO - by) / 500, 0.3, 1), "rgba(0,0,0,0.3)");
      D.ficha(bx, by, FU.R, "#f8fafc", { glow: "#e2e8f0" });
      ctx.save(); ctx.translate(bx, by); ctx.rotate(bx / FU.R);
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; D.circ(Math.cos(a) * 13, Math.sin(a) * 13, 5, "#1f2937"); }
      ctx.restore();
      for (const j of [1, 2]) { const c = j === 1 ? v.c1 : v.c2; auto(J.s("x" + j, c.x, 100), J.s("y" + j, c.y, 100), J.sa("a" + j, c.a), J.color(j), c.f); }
      // turbo
      const yo = v.yo === 1 ? v.c1 : v.c2;
      D.caja(380, 572, 200, 12, { r: 6, fill: "rgba(255,255,255,0.08)" });
      D.caja(380, 572, 2 * yo.t, 12, { r: 6, fill: C.acento, glow: yo.t > 30 ? C.acento : null });
      D.txt("TURBO", 360, 578, { size: 10, f: "o", align: "right", color: C.tenue });
      const m = Math.floor(v.t / 60), s = String(v.t % 60).padStart(2, "0");
      D.marcador(J, { p1: v.goles[1], p2: v.goles[2], centro: m + ":" + s, y: 30 });
      if (v.pausa) D.txt("¡SAQUE!", 480, 300, { size: 36, f: "b", color: C.acento, glow: C.acento });
    },
    textoFin(J, v) { return { sub: v.goles[1] + " a " + v.goles[2] }; },
  });
})();
