// ==========================================================================
//  Modulo de juego: BOMBERMAN DUELO (JUEGOS.bomber).
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL, T = 44, X0 = (960 - BM.C * T) / 2, Y0 = 70;
  const K = { ArrowUp: "u", w: "u", W: "u", ArrowDown: "d", s: "d", S: "d", ArrowLeft: "l", a: "l", A: "l", ArrowRight: "r", d: "r", D: "r" };
  const ICONO = { b: "💣", r: "🔥", v: "👟" };

  function act(J) {
    const k = J.local.k, ord = J.local.orden;
    // la ultima tecla apretada manda (como en el original)
    const ult = ord.filter((d) => k[d]).pop();
    J.inp.dx = ult === "r" ? 1 : ult === "l" ? -1 : 0;
    J.inp.dy = ult === "d" ? 1 : ult === "u" ? -1 : 0;
  }

  Kit.juego({
    id: "bomber",
    nombre: "Bomberman Duelo",
    desc: "Bombas en cruz, cajas que se rompen y mejoras. Encierra a tu rival con las llamas.",
    ayuda: "<b>Bomberman:</b> <kbd>WASD</kbd>/flechas para moverte, <kbd>espacio</kbd> pone una bomba. Mejoras: 💣 más bombas, 🔥 más alcance, 👟 más velocidad. Primero a 3 rondas.",
    meta: { tag: "BOMB", icono: "💣", gradiente: "linear-gradient(135deg, #c2410c 0%, #1c0a03 100%)", color: "#fdba74" },
    tipo: "real",
    canvas: { w: 960, h: 600 },
    Sim: BomberSim,
    continuo: true,
    fondo: "#0f0a06",
    local: () => ({ k: {}, orden: [] }),
    inp: () => ({ dx: 0, dy: 0 }),

    evento(J, e) {
      if (e.tipo === "bomba") J.sfx("tic");
      if (e.tipo === "boom") { J.sfx("explosion"); J.sacudir(7); }
      if (e.tipo === "mejora") J.sfx("powerup");
      if (e.tipo === "muere") J.chispas(X0 + e.x * T + T / 2, Y0 + e.y * T + T / 2, J.color(e.j), 30, 220);
      if (e.tipo === "ronda" && J.v && !J.v.g) J.aviso(e.g ? (e.g === J.rol ? "¡Ronda tuya!" : "Ronda para " + J.nombre(e.g)) : "Volaron los dos", e.g ? J.color(e.g) : C.tenue, 1.8);
    },
    teclado(J, e, abajo) {
      if (e.key === " ") { if (abajo && !e.repeat) J.accion({ bomba: 1 }); return true; }
      const d = K[e.key]; if (!d) return false;
      J.local.k[d] = abajo;
      J.local.orden = J.local.orden.filter((x) => x !== d); if (abajo) J.local.orden.push(d);
      act(J); return true;
    },

    pintar(J, v) {
      for (let y = 0; y < BM.F; y++) for (let x = 0; x < BM.C; x++) {
        const c = v.grid[y * BM.C + x], px = X0 + x * T, py = Y0 + y * T;
        if (c === "1") { D.caja(px + 1, py + 1, T - 2, T - 2, { r: 6, fill: "#44403c", stroke: "#78716c", lw: 2 }); }
        else {
          ctx.fillStyle = (x + y) % 2 ? "#3f6212" : "#4d7c0f"; ctx.fillRect(px, py, T, T);
          if (c === "2") { D.caja(px + 4, py + 4, T - 8, T - 8, { r: 4, fill: "#a16207", stroke: "#713f12", lw: 2 }); D.linea(px + 6, py + 6, px + T - 6, py + T - 6, "#713f12", 2); D.linea(px + T - 6, py + 6, px + 6, py + T - 6, "#713f12", 2); }
        }
      }
      for (const [x, y, t] of v.mejoras) D.txt(ICONO[t], X0 + x * T + T / 2, Y0 + y * T + T / 2 + 2, { size: 24, peso: 400 });
      for (const [x, y, t] of v.bombas) {
        const p = 1 + Math.sin(J.t * (t < 0.8 ? 30 : 10)) * 0.07;
        D.circ(X0 + x * T + T / 2, Y0 + y * T + T / 2 + 2, 15 * p, "#111827", t < 0.8 ? C.mal : "#4b5563", 2);
        D.circ(X0 + x * T + T / 2 + 7, Y0 + y * T + T / 2 - 10, 3, Math.sin(J.t * 25) > 0 ? "#fde047" : "#f97316");
      }
      for (const [x, y] of v.llamas) {
        const g = ctx.createRadialGradient(X0 + x * T + T / 2, Y0 + y * T + T / 2, 2, X0 + x * T + T / 2, Y0 + y * T + T / 2, T * 0.6);
        g.addColorStop(0, "#fef9c3"); g.addColorStop(0.5, "#f97316"); g.addColorStop(1, "rgba(220,38,38,0)");
        ctx.fillStyle = g; ctx.fillRect(X0 + x * T, Y0 + y * T, T, T);
      }
      for (const j of [1, 2]) {
        const p = j === 1 ? v.j1 : v.j2;
        if (!p.v) continue;
        const x = X0 + J.s("x" + j, p.x, 2) * T + T / 2, y = Y0 + J.s("y" + j, p.y, 2) * T + T / 2;
        D.ficha(x, y, T * 0.36, J.color(j), { glow: J.color(j) });
        D.circ(x - 5, y - 3, 3, "#0b0d12"); D.circ(x + 5, y - 3, 3, "#0b0d12");
      }
      D.marcador(J, { p1: v.rondas[1], p2: v.rondas[2], centro: "A " + BM.RONDAS + " RONDAS", y: 28 });
      const yo = v.yo === 1 ? v.j1 : v.j2;
      D.txt("💣 " + yo.b + "   🔥 " + yo.r + "   👟 " + yo.s, 480, 54, { size: 13, peso: 600, color: C.tenue });
      if (v.fase === "cuenta") D.txt("¡A VOLAR!", 480, 320, { size: 42, f: "b", color: C.acento, glow: C.acento });
    },
    textoFin(J, v) { return { sub: v.rondas[1] + " a " + v.rondas[2] + " rondas" }; },
  });
})();
