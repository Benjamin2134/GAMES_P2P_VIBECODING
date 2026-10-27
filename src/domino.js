// ==========================================================================
//  Modulo de juego: DOMINO (JUEGOS.domino). La mesa se arma en serpiente.
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL;
  const AREA = { x: 50, y: 92, w: 860, h: 300 };
  // posiciones de pips en una grilla 3x3 (-1, 0, 1)
  const PIPS = {
    0: [], 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
  };

  function mitad(cx, cy, t, n, vertical) {
    const p = t * 0.27, r = t * 0.085;
    for (const [a, b] of PIPS[n]) {
      const dx = vertical ? a : b, dy = vertical ? b : a;
      D.circ(cx + dx * p, cy + dy * p, r, n === 6 || n === 5 ? "#1e3a8a" : "#111827");
    }
  }
  // Ficha: horizontal si w > h (a izquierda, b derecha); vertical: a arriba, b abajo.
  function ficha(x, y, w, h, a, b, o = {}) {
    const t = Math.min(w, h);
    D.caja(x, y, w, h, { r: t * 0.16, fill: o.dorso ? "#1e293b" : "#f8f5ec", stroke: o.borde || "#0f172a", lw: o.lw || 1.5, glow: o.glow });
    if (o.dorso) { D.circ(x + w / 2, y + h / 2, t * 0.18, null, "#475569", 2); return; }
    ctx.strokeStyle = "rgba(15,23,42,0.6)"; ctx.lineWidth = Math.max(1, t * 0.05); ctx.beginPath();
    if (w > h) { ctx.moveTo(x + w / 2, y + 4); ctx.lineTo(x + w / 2, y + h - 4); }
    else { ctx.moveTo(x + 4, y + h / 2); ctx.lineTo(x + w - 4, y + h / 2); }
    ctx.stroke();
    if (w > h) { mitad(x + w / 4, y + h / 2, t, a, false); mitad(x + 3 * w / 4, y + h / 2, t, b, false); }
    else { mitad(x + w / 2, y + h / 4, t, a, true); mitad(x + w / 2, y + 3 * h / 4, t, b, true); }
  }

  // Serpiente: filas que alternan direccion; los dobles van atravesados.
  function armar(mesa) {
    for (const s of [1, 0.86, 0.74, 0.64, 0.55, 0.48]) {
      const L = 58 * s, S = 29 * s, gap = 2 * s, altoFila = L + 10 * s;
      const pos = [];
      let x = AREA.x, dir = 1, fila = 0;
      for (const t of mesa) {
        const doble = t.a === t.b, w = doble ? S : L;
        if (dir === 1 && x + w > AREA.x + AREA.w) { fila++; dir = -1; x = AREA.x + AREA.w; }
        else if (dir === -1 && x - w < AREA.x) { fila++; dir = 1; x = AREA.x; }
        const x0 = dir === 1 ? x : x - w;
        pos.push({ x: x0, fila, w, h: doble ? L : S, doble, inv: dir === -1, t });
        x += dir * (w + gap);
      }
      const filas = fila + 1;
      if (filas * altoFila <= AREA.h || s === 0.48) {
        const y0 = AREA.y + (AREA.h - filas * altoFila) / 2;
        for (const p of pos) p.y = y0 + p.fila * altoFila + (p.doble ? 0 : (L - S) / 2);
        // centrar horizontalmente si es una sola fila
        if (filas === 1 && pos.length) {
          const ancho = pos[pos.length - 1].x + pos[pos.length - 1].w - AREA.x;
          for (const p of pos) p.x += (AREA.w - ancho) / 2;
        }
        return { pos, L, S };
      }
    }
    return { pos: [], L: 58, S: 29 };
  }

  function jugar(J, i, lado) {
    const v = J.v;
    if (!v || v.fase !== "juego" || v.turno !== v.yo || !v.jugables.includes(i)) return;
    const lados = DOM.lados(v.mano[i], v.mesa);
    const ext = v.mesa.length ? [v.mesa[0].a, v.mesa[v.mesa.length - 1].b] : [];
    if (!lado && lados.length === 2 && ext[0] !== ext[1]) { J.local.elige = i; return; }
    J.accion({ i, lado: lado || lados[0] });
    J.local.elige = -1;
  }

  Kit.juego({
    id: "domino",
    nombre: "Dominó",
    desc: "Doble seis a 50 puntos. Roba del pozo, cierra el juego o haz dominó.",
    ayuda: "<b>Dominó:</b> click en una ficha iluminada de tu mano. Si entra por los dos lados, eliges izquierda o derecha. Sin jugada: roba del pozo; con el pozo vacío, pasa. Gana quien llegue a 50 puntos.",
    meta: { tag: "DOBLE 6", icono: "🁫", gradiente: "linear-gradient(135deg, #065f46 0%, #022c22 100%)", color: "#6ee7b7" },
    tipo: "turnos",
    canvas: { w: 960, h: 600 },
    Sim: DominoSim,
    hz: 30,
    fondo: "#06281d",
    local: () => ({ elige: -1 }),

    evento(J, e) {
      if (e.tipo === "juega") { J.sfx(e.doble ? "golpe" : "ficha"); J.local.elige = -1; }
      if (e.tipo === "roba") J.sfx("carta");
      if (e.tipo === "pasa") { J.sfx("error"); J.aviso(e.j === J.rol ? "Pasas" : (J.esBot ? "El bot pasa" : "El rival pasa"), C.tenue, 1.6); }
      if (e.tipo === "cierre") J.sfx(e.g === J.rol ? "moneda" : "sonar");
      if (e.tipo === "ronda" && e.n > 1) J.aviso("Ronda " + e.n, C.acento, 1.6);
    },

    pintar(J, v) {
      const L = J.local, miTurno = v.fase === "juego" && v.turno === v.yo && !v.g;
      D.marcador(J, { p1: v.puntos[1], p2: v.puntos[2], centro: v.fase === "juego" && !v.g ? null : "" });
      if (v.fase === "juego" && !v.g) D.turno(J, miTurno);
      D.txt("A " + DOM.META + " PUNTOS · RONDA " + v.ronda, 480, 50, { size: 11, color: C.tenue, f: "o" });

      // tapete
      D.caja(30, 70, 900, 340, { r: 18, fill: "#0b3b2a", stroke: "#14532d", lw: 2 });
      const { pos } = armar(v.mesa);
      for (const p of pos) {
        // en las filas que van hacia la izquierda la ficha se dibuja invertida para que calcen los numeros
        const a = p.inv ? p.t.b : p.t.a, b = p.inv ? p.t.a : p.t.b;
        ficha(p.x, p.y, p.w, p.h, a, b);
      }
      if (!v.mesa.length) D.txt(miTurno ? "Abre la mesa con cualquier ficha" : "Mesa vacía", 480, 240, { size: 16, color: "rgba(255,255,255,0.35)" });

      // elegir lado
      if (L.elige >= 0 && miTurno && pos.length) {
        const pi = pos[0], pd = pos[pos.length - 1];
        J.boton(pi.x - 6, pi.y - 40, 70, 30, "◀ aquí", () => jugar(J, L.elige, "i"), { lleno: true, color: J.miColor(), size: 13 });
        J.boton(pd.x + pd.w - 64, pd.y + pd.h + 10, 70, 30, "aquí ▶", () => jugar(J, L.elige, "d"), { lleno: true, color: J.miColor(), size: 13 });
      }

      // rival y pozo
      D.txt((J.esBot ? "BOT" : "RIVAL") + ": " + v.rival + " fichas", 70, 440, { align: "left", size: 14, color: J.color(Kit.otro(v.yo)), f: "o" });
      for (let k = 0; k < Math.min(v.rival, 14); k++) ficha(250 + k * 18, 428, 14, 26, 0, 0, { dorso: true, lw: 1 });
      D.txt("POZO: " + v.pozo, 890, 440, { align: "right", size: 14, color: C.tenue, f: "o" });

      // mi mano
      const n = v.mano.length, ancho = Math.min(46, 800 / Math.max(1, n)), x0 = 480 - (n * ancho) / 2;
      v.mano.forEach((f, i) => {
        const juega = miTurno && v.jugables.includes(i);
        const x = x0 + i * ancho + (ancho - 36) / 2, y = 486 - (juega ? 8 : 0) - (L.elige === i ? 10 : 0);
        const sobre = juega && J.zona(x, y, 36, 72, () => jugar(J, i));
        ficha(x, y - (sobre ? 4 : 0), 36, 72, f[0], f[1], { glow: juega ? J.miColor() : null, borde: L.elige === i ? "#fff" : null, lw: L.elige === i ? 3 : 1.5 });
        if (!juega && miTurno) { ctx.fillStyle = "rgba(6,40,29,0.45)"; ctx.fillRect(x, y, 36, 72); }
      });
      if (v.puedeRobar) J.boton(800, 500, 120, 40, "Robar del pozo", () => J.accion({ robar: 1 }), { lleno: true, color: C.acento, size: 14 });
      if (v.puedePasar) J.boton(800, 500, 120, 40, "Pasar", () => J.accion({ pasar: 1 }), { lleno: true, color: C.acento, size: 14 });

      // resumen de ronda
      if (v.fase === "resumen" && v.res) {
        const r = v.res;
        D.caja(200, 130, 560, 250, { r: 16, fill: "rgba(3,20,14,0.95)", stroke: C.acento, lw: 2 });
        D.txt(r.tipo === "tranque" ? "¡TRANQUE!" : "¡DOMINÓ!", 480, 168, { size: 28, f: "b", color: C.acento });
        D.txt(r.g ? (r.g === J.rol ? "Ganas la ronda: +" : (J.esBot ? "El bot suma +" : "El rival suma +")) + r.pts : "Empate de puntos: nadie suma", 480, 204, { size: 17 });
        for (const j of [1, 2]) {
          const y = j === 1 ? 236 : 304;
          D.txt(J.nombre(j), 230, y + 18, { align: "left", size: 13, color: J.color(j), f: "o" });
          r.manos[j].slice(0, 7).forEach((f, k) => ficha(300 + k * 54, y + 6, 48, 24, f[0], f[1]));
          D.txt(DOM.suma(r.manos[j]), 730, y + 18, { align: "right", size: 15, f: "o" });
        }
      }
    },

    textoFin(J, v) { return { sub: v.puntos[1] + " a " + v.puntos[2] + " puntos" }; },
  });
})();
