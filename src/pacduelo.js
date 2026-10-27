// ==========================================================================
//  Modulo de juego: PAC-DUELO (JUEGOS.pacduelo).
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL, T = 25, X0 = (960 - PD.C * T) / 2, Y0 = 62;
  const K = { ArrowUp: "u", w: "u", W: "u", ArrowDown: "d", s: "d", S: "d", ArrowLeft: "l", a: "l", A: "l", ArrowRight: "r", d: "r", D: "r" };
  const ANG = { r: 0, d: Math.PI / 2, l: Math.PI, u: -Math.PI / 2 };
  const px = (x) => X0 + x * T + T / 2, py = (y) => Y0 + y * T + T / 2;

  function pacman(x, y, d, color, t) {
    const boca = 0.25 + Math.abs(Math.sin(t * 12)) * 0.5, a = ANG[d] || 0;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, T * 0.45, a + boca, a + Math.PI * 2 - boca); ctx.closePath();
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
  }
  function fantasma(x, y, d, color, susto, t) {
    const r = T * 0.45, col = susto > 0 ? (susto < 1.5 && Math.sin(t * 20) > 0 ? "#f8fafc" : "#2563eb") : color;
    ctx.beginPath(); ctx.arc(x, y - 2, r, Math.PI, 0);
    for (let k = 0; k <= 4; k++) ctx.lineTo(x + r - (k * 2 * r) / 4, y + r - (k % 2 ? 5 : 0));
    ctx.closePath(); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
    const [dx, dy] = PD.DIR[d] || [0, 0];
    for (const s of [-1, 1]) { D.circ(x + s * 4.5, y - 4, 4, "#fff"); if (!susto) D.circ(x + s * 4.5 + dx * 1.8, y - 4 + dy * 1.8, 2, "#1e3a8a"); }
  }

  Kit.juego({
    id: "pacduelo",
    nombre: "Pac-Duelo",
    desc: "Uno es el comecocos y el otro el fantasma. Cada ronda se cambian los papeles.",
    ayuda: "<b>Pac-Duelo:</b> <kbd>WASD</kbd> o flechas (en celular: desliza). El comecocos gana si limpia el laberinto o se come al fantasma con una píldora. El fantasma gana si lo atrapa o se acaba el tiempo. Primero a 3 rondas.",
    meta: { tag: "WAKA", icono: "👻", gradiente: "linear-gradient(135deg, #1e3a8a 0%, #050816 100%)", color: "#fde047" },
    tipo: "real",
    canvas: { w: 960, h: 600 },
    Sim: PacDueloSim,
    continuo: true, envioHz: 40,
    fondo: "#020410",
    local: () => ({ toque: null }),
    inp: () => ({ d: "" }),

    evento(J, e) {
      if (e.tipo === "punto") J.sfx("come");
      if (e.tipo === "pildora") { J.sfx("powerup"); J.aviso("¡Píldora! El fantasma huye", C.acento, 1.4); }
      if (e.tipo === "ronda" && J.v) {
        J.sfx(e.g === J.rol ? "punto" : "error");
        J.chispas(px(e.x), py(e.y), J.color(e.g), 30, 200);
        const txt = { comio: "¡Se comió al fantasma!", limpio: "¡Laberinto limpio!", tiempo: "Se acabó el tiempo", atrapo: "¡Atrapado!" }[e.como];
        if (!J.v.g) J.aviso(txt + " · ronda para " + J.nombre(e.g), J.color(e.g), 2);
      }
    },
    teclado(J, e, abajo) { const d = K[e.key]; if (!d) return false; if (abajo) J.inp.d = d; return true; },
    puntero(J, tipo, x, y) {
      if (tipo === "abajo") J.local.toque = [x, y];
      else if (tipo === "mueve" && J.local.toque) {
        const dx = x - J.local.toque[0], dy = y - J.local.toque[1];
        if (Math.hypot(dx, dy) > 28) { J.inp.d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "r" : "l") : (dy > 0 ? "d" : "u"); J.local.toque = [x, y]; }
      } else if (tipo === "arriba") J.local.toque = null;
    },

    pintar(J, v) {
      // laberinto
      ctx.fillStyle = "#1d4ed8";
      for (let y = 0; y < PD.F; y++) for (let x = 0; x < PD.C; x++) {
        const ch = PD.MAPA[y][x];
        if (ch === "#") { D.caja(X0 + x * T + 3, Y0 + y * T + 3, T - 6, T - 6, { r: 5, fill: "#0b1a4a", stroke: "#3b82f6", lw: 1.5 }); }
        else if (ch === "-") D.linea(X0 + x * T, Y0 + y * T + T / 2, X0 + x * T + T, Y0 + y * T + T / 2, "#f9a8d4", 3);
        const p = v.puntos[y * PD.C + x];
        if (p === ".") D.circ(px(x), py(y), 2.6, "#fde68a");
        else if (p === "o") D.circ(px(x), py(y), 6 + Math.sin(J.t * 6) * 1.5, "#fde68a", null, 0, "#fde68a");
      }
      pacman(px(J.s("px", v.ep.x, 3)), py(J.s("py", v.ep.y, 3)), v.ep.d, "#facc15", J.t);
      fantasma(px(J.s("fx", v.ef.x, 3)), py(J.s("fy", v.ef.y, 3)), v.ef.d, J.color(v.fant), v.susto, J.t);
      // marcos de rol
      D.marcador(J, { p1: v.rondas[1], p2: v.rondas[2], centro: "⏱ " + v.t, y: 28 });
      const soyPac = v.pac === v.yo;
      D.txt(soyPac ? "ERES EL COMECOCOS" : "ERES EL FANTASMA", 480, 50, { size: 12, f: "o", color: soyPac ? "#facc15" : J.color(v.fant) });
      D.txt("Ronda " + v.r, 120, 300, { size: 14, f: "o", color: C.tenue });
      if (v.fase === "cuenta") D.txt(soyPac ? "¡Come todo!" : "¡Atrápalo!", 480, 322, { size: 36, f: "b", color: C.acento, glow: C.acento });
    },
    textoFin(J, v) { return { sub: v.rondas[1] + " a " + v.rondas[2] + " rondas" }; },
  });
})();
