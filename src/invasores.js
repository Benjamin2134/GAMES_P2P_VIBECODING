// ==========================================================================
//  Modulo de juego: INVASORES VERSUS (JUEGOS.invasores).
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL;
  // invasores en pixel art 8x6 (dos cuadros de animacion)
  const SPR = [
    ["00111100", "01111110", "11011011", "11111111", "00100100", "01011010"],
    ["00111100", "01111110", "11011011", "11111111", "01011010", "10100101"],
  ];
  const COLF = ["#f472b6", "#a78bfa", "#a78bfa", "#4ade80", "#4ade80"];

  function sprite(x, y, f, col) {
    ctx.fillStyle = col;
    SPR[f].forEach((fila, r) => { for (let c = 0; c < 8; c++) if (fila[c] === "1") ctx.fillRect(x + c * 4, y + r * 4, 4, 4); });
  }
  function canon(x, color, alfa) {
    ctx.globalAlpha = alfa;
    D.caja(x - 20, IV.Y_SUELO - 10, 40, 14, { r: 3, fill: color, glow: color });
    D.caja(x - 4, IV.Y_SUELO - 20, 8, 12, { r: 2, fill: color });
    ctx.globalAlpha = 1;
  }

  Kit.juego({
    id: "invasores",
    nombre: "Invasores Versus",
    desc: "La misma invasión para los dos: gana quien derriba más naves. Cuidado con los disparos.",
    ayuda: "<b>Invasores:</b> <kbd>←</kbd>/<kbd>→</kbd> (o <kbd>A</kbd>/<kbd>D</kbd>) moverse, <kbd>espacio</kbd> disparar. Con el dedo: arrastra para moverte, se dispara solo. Si te dan, pierdes 100 puntos. Dos oleadas.",
    meta: { tag: "INVADE", icono: "👾", gradiente: "linear-gradient(135deg, #4c1d95 0%, #0a0418 100%)", color: "#d8b4fe" },
    tipo: "real",
    canvas: { w: 960, h: 600 },
    Sim: InvasoresSim,
    continuo: true,
    fondo: "#04020a",
    local: () => ({ k: {}, toque: false }),
    inp: () => ({ dx: 0, fuego: false }),

    evento(J, e) {
      if (e.tipo === "disparo" && e.j === J.rol) J.sfx("laser");
      if (e.tipo === "muere") { J.sfx("come"); J.chispas(e.x, e.y, COLF[e.f], 10, 140, 0.4); }
      if (e.tipo === "ovni") { J.sfx("moneda"); J.aviso(J.nombre(e.j) + " derribó el platillo: +100", J.color(e.j), 1.6); }
      if (e.tipo === "golpe") { J.sfx("explosion"); J.sacudir(8); J.chispas(e.x, IV.Y_SUELO, J.color(e.j), 26, 200); }
      if (e.tipo === "marcha") J.sfx("rebote", e.f ? 0.25 : 0.22);
      if (e.tipo === "oleada") J.aviso("¡Oleada " + e.n + "!", C.acento, 1.6);
    },
    teclado(J, e, abajo) {
      if (e.key === " ") { J.inp.fuego = abajo; return true; }
      const d = { ArrowLeft: "l", a: "l", A: "l", ArrowRight: "r", d: "r", D: "r" }[e.key];
      if (!d) return false;
      J.local.k[d] = abajo; J.inp.dx = (J.local.k.r ? 1 : 0) - (J.local.k.l ? 1 : 0); return true;
    },
    puntero(J, tipo, x) {
      const v = J.v; if (!v) return;
      if (tipo === "arriba") { J.local.toque = false; J.inp.dx = 0; J.inp.fuego = false; return; }
      if (tipo === "abajo") J.local.toque = true;
      if (!J.local.toque) return;
      const yo = J.rol === 1 ? v.c1 : v.c2;
      J.inp.dx = Math.abs(x - yo.x) > 10 ? Math.sign(x - yo.x) : 0; J.inp.fuego = true;
    },

    pintar(J, v) {
      for (let k = 0; k < 60; k++) { const sx = (k * 157) % 960, sy = (k * 89) % 520 + 40; ctx.fillStyle = "rgba(255,255,255," + (0.15 + (k % 3) * 0.1) + ")"; ctx.fillRect(sx, sy, 2, 2); }
      for (let k = 0; k < IV.COLS * IV.FILAS; k++) {
        if (v.inv[k] !== "1") continue;
        const c = k % IV.COLS, f = Math.floor(k / IV.COLS);
        sprite(v.fx + c * IV.DX, v.fy + f * IV.DY, v.frame, COLF[f]);
      }
      if (v.ovni !== null) { D.caja(v.ovni - 24, 56, 48, 14, { r: 7, fill: C.mal, glow: C.mal }); D.caja(v.ovni - 10, 48, 20, 10, { r: 5, fill: "#fecaca" }); }
      const B = IV.BUNKER;
      ctx.fillStyle = "#22c55e";
      for (let i = 0; i < B.n * B.w * B.h; i++) {
        if (v.bunker[i] !== "1") continue;
        const k = Math.floor(i / (B.w * B.h)), r = Math.floor((i % (B.w * B.h)) / B.w), c = i % B.w;
        ctx.fillRect(150 + k * 200 + c * B.t, B.y + r * B.t, B.t, B.t);
      }
      for (const [x, y, j] of v.balas) D.caja(x - 2, y - 8, 4, 14, { r: 2, fill: J.color(j), glow: J.color(j) });
      for (const [x, y] of v.bi) { ctx.strokeStyle = "#fde047"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 3, y - 4); ctx.lineTo(x - 3, y); ctx.lineTo(x, y + 4); ctx.stroke(); }
      for (const j of [1, 2]) { const c = j === 1 ? v.c1 : v.c2; canon(J.s("x" + j, c.x), J.color(j), c.m ? 0.15 : c.i ? 0.5 + Math.sin(J.t * 20) * 0.3 : 1); }
      D.linea(0, IV.Y_SUELO + 8, 960, IV.Y_SUELO + 8, "#22c55e", 2);
      D.marcador(J, { p1: v.puntos[1], p2: v.puntos[2], centro: "OLEADA " + v.oleada + "/" + IV.OLEADAS, y: 26 });
    },
    textoFin(J, v) { return { sub: v.puntos[1] + " a " + v.puntos[2] + " puntos" }; },
  });
})();
