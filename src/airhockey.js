// ==========================================================================
//  Modulo de juego: AIR HOCKEY (JUEGOS.airhockey).
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL;

  function mazo(x, y, color) {
    D.circ(x + 3, y + 4, HOC.R_MAZO, "rgba(0,0,0,0.35)");
    D.circ(x, y, HOC.R_MAZO, color, "rgba(255,255,255,0.5)", 2, color);
    D.circ(x, y, HOC.R_MAZO * 0.62, "rgba(0,0,0,0.22)");
    D.ficha(x, y, HOC.R_MAZO * 0.42, color);
  }

  Kit.juego({
    id: "airhockey",
    nombre: "Air Hockey",
    desc: "El de los salones de juego: disco a toda velocidad, rebotes en las bandas y primero a 7.",
    ayuda: "<b>Air Hockey:</b> mueve tu mazo con el mouse o el dedo (o <kbd>WASD</kbd>/flechas). Defiendes el arco de tu lado. Primero a 7 goles.",
    meta: { tag: "PUCK", icono: "🏒", gradiente: "linear-gradient(135deg, #0369a1 0%, #0c1222 100%)", color: "#7dd3fc" },
    tipo: "real",
    canvas: { w: 960, h: 600 },
    Sim: AirHockeySim,
    continuo: true,
    fondo: "#070b16",
    cursor: "none",
    local: () => ({ k: {}, puntero: false }),
    inp: () => ({ x: net.rol === 2 ? HOC.X1 - 90 : HOC.X0 + 90, y: HOC.CY }),
    evento(J, e) {
      if (e.tipo === "golpe") J.sfx("golpe", 1.4 + e.f);
      if (e.tipo === "banda") J.sfx("rebote", 0.8);
      if (e.tipo === "gol") {
        J.sfx(e.j === J.rol ? "punto" : "error"); J.sacudir(10);
        J.chispas(e.x, e.y, J.color(e.j), 40, 320, 0.9, 3);
        J.aviso(e.j === J.rol ? "¡GOOOL!" : "Gol del rival", J.color(e.j), 1.4);
      }
    },
    teclado(J, e, abajo) {
      const m = { ArrowUp: "u", w: "u", W: "u", ArrowDown: "d", s: "d", S: "d", ArrowLeft: "l", a: "l", A: "l", ArrowRight: "r", d: "r", D: "r" }[e.key];
      if (!m) return false;
      J.local.k[m] = abajo; J.local.puntero = false;
      return true;
    },
    puntero(J, tipo, x, y) {
      if (x < 0) return;
      J.local.puntero = true;
      const p = HOC.limitar(J.rol, x, y);
      J.inp.x = p.x; J.inp.y = p.y;
    },

    pintar(J, v) {
      const k = J.local.k;
      if (k.u || k.d || k.l || k.r) {
        const s = 700 * J.dt;
        const p = HOC.limitar(J.rol, J.inp.x + ((k.r ? 1 : 0) - (k.l ? 1 : 0)) * s, J.inp.y + ((k.d ? 1 : 0) - (k.u ? 1 : 0)) * s);
        J.inp.x = p.x; J.inp.y = p.y;
      }
      // mesa
      D.caja(HOC.X0 - 16, HOC.Y0 - 16, HOC.X1 - HOC.X0 + 32, HOC.Y1 - HOC.Y0 + 32, { r: 40, fill: "#1e293b", stroke: "#334155", lw: 3 });
      D.caja(HOC.X0, HOC.Y0, HOC.X1 - HOC.X0, HOC.Y1 - HOC.Y0, { r: 26, fill: "#e0f2fe" });
      ctx.fillStyle = "rgba(56,189,248,0.10)"; for (let x = HOC.X0 + 20; x < HOC.X1; x += 24) for (let y = HOC.Y0 + 20; y < HOC.Y1; y += 24) ctx.fillRect(x, y, 2, 2);
      D.linea(HOC.CX, HOC.Y0, HOC.CX, HOC.Y1, "rgba(220,38,38,0.6)", 4);
      D.circ(HOC.CX, HOC.CY, 70, null, "rgba(220,38,38,0.45)", 3);
      for (const [x, c] of [[HOC.X0, Kit.COL.p1], [HOC.X1, Kit.COL.p2]]) {
        ctx.beginPath(); ctx.arc(x, HOC.CY, 110, x === HOC.X0 ? -Math.PI / 2 : Math.PI / 2, x === HOC.X0 ? Math.PI / 2 : Math.PI * 1.5);
        ctx.strokeStyle = c + "88"; ctx.lineWidth = 3; ctx.stroke();
        D.caja(x - 8, HOC.ARCO[0], 16, HOC.ARCO[1] - HOC.ARCO[0], { r: 6, fill: "#020617", stroke: c, lw: 3, glow: c });
      }
      // disco: el guest lo extrapola con su velocidad para que no salte
      const dx = J.s("dx", v.d.x, 90), dy = J.s("dy", v.d.y, 90);
      D.circ(dx + 3, dy + 4, HOC.R_DISCO, "rgba(0,0,0,0.3)");
      D.circ(dx, dy, HOC.R_DISCO, "#111827", "#f4b944", 3, v.pausa ? null : "#f4b944");
      D.circ(dx, dy, HOC.R_DISCO * 0.5, null, "rgba(244,185,68,0.5)", 2);
      // mazos (el propio del guest se dibuja donde apunta, sin esperar al host)
      for (const j of [1, 2]) {
        const m = j === 1 ? v.m1 : v.m2;
        const propio = j === J.rol && J.rol === 2;
        mazo(propio ? J.s("m" + j, m.x, 400) : J.s("m" + j, m.x), J.s("my" + j, m.y), J.color(j));
      }
      if (J.local.puntero && J.inp.x > 0) D.circ(J.inp.x, J.inp.y, 6, null, J.miColor(), 2);
      D.marcador(J, { p1: v.goles[1], p2: v.goles[2], centro: "A " + HOC.GOLES, y: 30 });
    },

    textoFin(J, v) { return { sub: v.goles[1] + " a " + v.goles[2] }; },
  });
})();
