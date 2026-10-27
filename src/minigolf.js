// ==========================================================================
//  Modulo de juego: MINIGOLF (JUEGOS.minigolf). Se apunta como honda:
//  arrastras hacia atras desde tu bola y sueltas.
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL;

  function poli(p) { ctx.moveTo(p[0][0], p[0][1]); for (let k = 1; k < p.length; k++) ctx.lineTo(p[k][0], p[k][1]); ctx.closePath(); }

  function tirar(J) {
    const v = J.v;
    if (!v || v.g || v.turno !== v.yo || v.fase !== "apunta" || J.inp.pot < 0.03) return;
    J.accion({ tiro: 1, ang: J.inp.ang, pot: J.inp.pot });
    J.inp.pot = 0.4;
  }

  Kit.juego({
    id: "minigolf",
    nombre: "Minigolf",
    desc: "Seis hoyos con paredes, bumpers y arena. Las dos bolas en la cancha: ¡puedes chocar la del rival!",
    ayuda: "<b>Minigolf:</b> mantén apretado sobre la cancha y arrastra hacia atrás desde tu bola (como honda); suelta para pegar. Teclado: <kbd>←</kbd>/<kbd>→</kbd> apuntar, <kbd>↑</kbd>/<kbd>↓</kbd> fuerza, <kbd>espacio</kbd> pegar. Juega el que está más lejos del hoyo.",
    meta: { tag: "GOLF", icono: "⛳", gradiente: "linear-gradient(135deg, #15803d 0%, #052e16 100%)", color: "#86efac" },
    tipo: "turnos",
    canvas: { w: 960, h: 600 },
    Sim: MinigolfSim,
    continuo: true,
    envioHz: 30,
    fondo: "#06170d",
    local: () => ({ arrastra: false, k: {}, listo: false }),
    inp: () => ({ ang: 0, pot: 0.4 }),

    evento(J, e) {
      if (e.tipo === "tiro") J.sfx("golpe", 1.6);
      if (e.tipo === "pared") J.sfx("rebote", 0.7);
      if (e.tipo === "bump") { J.sfx("rebote", 1.4); }
      if (e.tipo === "choque") J.sfx("golpe", 2.2);
      if (e.tipo === "dentro") {
        J.sfx("moneda");
        const h = MG.HOYOS[J.v.n];
        J.chispas(h.hoyo[0], h.hoyo[1], J.color(e.j), 20, 140);
        const par = h.par, g = e.golpes;
        const txt = g === 1 ? "¡HOYO EN UNO!" : g <= par - 2 ? "¡Eagle!" : g === par - 1 ? "¡Birdie!" : g === par ? "Par" : g === par + 1 ? "Bogey" : g + " golpes";
        J.aviso((e.j === J.rol ? "" : J.nombre(e.j) + ": ") + txt, J.color(e.j), 2);
      }
      if (e.tipo === "levanta") J.aviso(J.nombre(e.j) + " levanta la bola (8)", C.tenue, 1.8);
    },
    teclado(J, e, abajo) {
      const k = e.key;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(k)) { J.local.k[k] = abajo; return true; }
      if (k === " " && abajo) { tirar(J); return true; }
      return false;
    },
    puntero(J, tipo, x, y) {
      const v = J.v;
      if (!v || v.turno !== v.yo || v.fase !== "apunta" || v.g) { J.local.arrastra = false; return; }
      const b = v.bolas[v.yo];
      if (tipo === "abajo") J.local.arrastra = true;
      if (J.local.arrastra && tipo !== "arriba") {
        const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy);
        if (d > 4) { J.inp.ang = Math.atan2(dy, dx); J.inp.pot = clamp(d / 220, 0, 1); }
      }
      if (tipo === "arriba" && J.local.arrastra) { J.local.arrastra = false; tirar(J); }
    },

    pintar(J, v) {
      const L = J.local, h = MG.HOYOS[v.n], yo = v.yo, miTurno = !v.g && v.turno === yo && v.fase === "apunta";
      if (miTurno && !L.listo) {
        const b = v.bolas[yo];
        J.inp.ang = Math.atan2(h.hoyo[1] - b.y, h.hoyo[0] - b.x); J.inp.pot = 0.4; L.listo = true;
      }
      if (!miTurno) L.listo = false;
      if (miTurno) {
        if (L.k.ArrowLeft) J.inp.ang -= 1.4 * J.dt;
        if (L.k.ArrowRight) J.inp.ang += 1.4 * J.dt;
        if (L.k.ArrowUp) J.inp.pot = Math.min(1, J.inp.pot + 0.6 * J.dt);
        if (L.k.ArrowDown) J.inp.pot = Math.max(0, J.inp.pot - 0.6 * J.dt);
      }

      // cancha
      ctx.beginPath(); poli(h.borde);
      ctx.fillStyle = "#3f2a14"; ctx.shadowColor = "#000"; ctx.shadowBlur = 24; ctx.fill(); ctx.shadowBlur = 0;
      ctx.lineWidth = 16; ctx.strokeStyle = "#7c5a2e"; ctx.lineJoin = "round"; ctx.stroke();
      ctx.beginPath(); poli(h.borde);
      const pasto = ctx.createLinearGradient(0, 80, 0, 540);
      pasto.addColorStop(0, "#22a04b"); pasto.addColorStop(1, "#15803d");
      ctx.fillStyle = pasto; ctx.fill();
      // franjas del pasto
      ctx.save(); ctx.beginPath(); poli(h.borde); ctx.clip();
      for (let x = 0; x < 960; x += 48) { ctx.fillStyle = (x / 48) % 2 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.03)"; ctx.fillRect(x, 0, 48, 600); }
      for (const [x0, y0, x1, y1] of h.arena) { D.caja(x0, y0, x1 - x0, y1 - y0, { r: 30, fill: "#e8cf8f" }); }
      ctx.restore();
      for (const o of h.obst) { ctx.beginPath(); poli(o); ctx.fillStyle = "#7c5a2e"; ctx.fill(); ctx.strokeStyle = "#a47a44"; ctx.lineWidth = 2; ctx.stroke(); }
      for (const [cx, cy, cr] of h.bump) { D.circ(cx, cy, cr, "#be185d", "#f9a8d4", 3, "#f472b6"); D.circ(cx, cy, cr * 0.45, "#f9a8d4"); }
      // hoyo y bandera
      D.circ(h.hoyo[0], h.hoyo[1], MG.R_HOYO, "#0a0a0a", "rgba(255,255,255,0.4)", 1.5);
      D.linea(h.hoyo[0], h.hoyo[1], h.hoyo[0], h.hoyo[1] - 46, "#e5e7eb", 2);
      ctx.fillStyle = C.mal; ctx.beginPath(); ctx.moveTo(h.hoyo[0], h.hoyo[1] - 46); ctx.lineTo(h.hoyo[0] + 24, h.hoyo[1] - 39); ctx.lineTo(h.hoyo[0], h.hoyo[1] - 32); ctx.fill();
      D.circ(h.tee[0], h.tee[1], 18, null, "rgba(255,255,255,0.18)", 2);

      // mira del que juega (la del rival tambien se ve)
      if (v.fase === "apunta" && !v.g) {
        const b = v.bolas[v.turno], m = miTurno ? J.inp : v.mira[v.turno];
        const largo = 20 + m.pot * 160, col = J.color(v.turno);
        D.linea(b.x, b.y, b.x + Math.cos(m.ang) * largo, b.y + Math.sin(m.ang) * largo, col, 2.5, [7, 6]);
        D.linea(b.x, b.y, b.x - Math.cos(m.ang) * m.pot * 70, b.y - Math.sin(m.ang) * m.pot * 70, "rgba(255,255,255,0.45)", 5);
        D.caja(b.x - 26, b.y + 16, 52, 6, { r: 3, fill: "rgba(0,0,0,0.4)" });
        D.caja(b.x - 26, b.y + 16, 52 * m.pot, 6, { r: 3, fill: m.pot > 0.8 ? C.mal : col });
      }
      // bolas
      for (const j of [1, 2]) {
        const b = v.bolas[j];
        if (b.d) continue;
        const x = J.s("x" + j, b.x, 80), y = J.s("y" + j, b.y, 80);
        D.circ(x + 2, y + 3, MG.R, "rgba(0,0,0,0.3)");
        D.ficha(x, y, MG.R, j === 1 ? "#f0f9ff" : "#fff1f2", { glow: J.color(j) });
        D.circ(x, y, MG.R + 2.5, null, J.color(j), 2);
      }

      // HUD
      D.marcador(J, { p1: v.totales[1] + (v.fase !== "entre" ? " (+" + v.golpes[1] + ")" : ""), p2: (v.fase !== "entre" ? "(+" + v.golpes[2] + ") " : "") + v.totales[2] });
      D.txt("HOYO " + (v.n + 1) + "/6 · " + h.nombre.toUpperCase() + " · PAR " + h.par, 480, 50, { size: 12, f: "o", color: C.tenue });
      if (!v.g && v.fase === "apunta") D.turno(J, miTurno);
      if (v.fase === "entre") {
        D.caja(300, 230, 360, 140, { r: 16, fill: "rgba(5,20,10,0.92)", stroke: C.acento });
        D.txt("Hoyo " + (v.n + 1) + " terminado", 480, 262, { size: 20, f: "b", color: C.acento });
        for (const j of [1, 2]) D.txt(J.nombre(j) + ": " + v.tarjeta[j][v.n] + " golpes · total " + v.totales[j], 480, 296 + (j - 1) * 30, { size: 15, color: J.color(j) });
      }
    },

    textoFin(J, v) { return { sub: "Total: " + v.totales[1] + " contra " + v.totales[2] + " golpes" }; },
  });
})();
