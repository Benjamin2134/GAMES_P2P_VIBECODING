// ==========================================================================
//  Modulo de juego: AJEDREZ (JUEGOS.ajedrez). Cada jugador ve su color abajo.
// ==========================================================================
(function () {
  const T = 64, BX = (960 - T * 8) / 2, BY = 66;
  const D = Kit.D, C = Kit.COL;
  const GLIFO = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
  const pant = (v, i) => (v.color === "b" ? 63 - i : i);
  const NOMBRE = "abcdefgh";

  function pieza(p, x, y, tam = 46, alfa = 1) {
    const blanca = p === p.toUpperCase();
    ctx.globalAlpha = alfa;
    ctx.font = tam + "px 'Segoe UI Symbol', 'Apple Symbols', 'DejaVu Sans', serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const g = GLIFO[p.toLowerCase()] + "︎";
    ctx.lineWidth = 3; ctx.strokeStyle = blanca ? "#1f2937" : "#e5e7eb";
    ctx.strokeText(g, x, y + 2);
    ctx.fillStyle = blanca ? "#fafaf9" : "#111827";
    ctx.fillText(g, x, y + 2);
    ctx.textBaseline = "alphabetic"; ctx.globalAlpha = 1;
  }

  function click(J, i) {
    const v = J.v, L = J.local;
    if (!v || v.g || v.turno !== v.yo || L.promo) return;
    const llega = v.movs.filter(([d, a]) => d === L.sel && a === i);
    if (L.sel >= 0 && llega.length) {
      if (llega.length > 1) { L.promo = { de: L.sel, a: i }; return; }   // promocion: elegir pieza
      J.accion({ de: L.sel, a: i }); L.sel = -1; return;
    }
    if (v.movs.some(([d]) => d === i)) { L.sel = i; J.sfx("tic"); return; }
    if (v.tab[i] && AJ.color(v.tab[i]) === v.color) J.aviso(v.jaque ? "Estás en jaque" : "Esa pieza no puede moverse", C.mal, 1.5);
    L.sel = -1;
  }

  Kit.juego({
    id: "ajedrez",
    nombre: "Ajedrez",
    desc: "El clásico completo: enroque, al paso, promoción, jaque mate y tablas.",
    ayuda: "<b>Ajedrez:</b> click en tu pieza y luego en la casilla destino (se marcan las legales). Al coronar eliges la pieza. Se alternan blancas y negras en cada revancha.",
    meta: { tag: "CHESS", icono: "♞", gradiente: "linear-gradient(135deg, #44403c 0%, #0c0a09 100%)", color: "#e7e5e4" },
    tipo: "turnos",
    canvas: { w: 960, h: 600 },
    Sim: AjedrezSim,
    fondo: "#0d0c0b",
    local: () => ({ sel: -1, promo: null }),

    evento(J, e) {
      if (e.cap) J.sfx("golpe"); else J.sfx("ficha");
      if (e.jaque) { J.sfx("sonar"); if (!J.v || !J.v.g) J.aviso("¡Jaque!", C.mal, 1.4); }
      J.local.sel = -1;
    },

    pintar(J, v) {
      const L = J.local, miTurno = !v.g && v.turno === v.yo;
      const c1 = v.colores[1] === "w" ? "blancas" : "negras", c2 = v.colores[2] === "w" ? "blancas" : "negras";
      D.marcador(J, { p1: "(" + c1 + ")", p2: "(" + c2 + ")" });
      if (!v.g) D.turno(J, miTurno);

      D.caja(BX - 22, BY - 14, T * 8 + 44, T * 8 + 32, { r: 12, fill: "#292524", stroke: "#57534e", lw: 2 });
      const destinos = new Set(v.movs.filter(([d]) => d === L.sel).map(([, a]) => a));
      const movibles = new Set(v.movs.map(([d]) => d));
      const reyJaque = v.jaque ? v.tab.indexOf(v.turnoColor === "w" ? "K" : "k") : -1;

      for (let i = 0; i < 64; i++) {
        const p = pant(v, i), x = BX + (p & 7) * T, y = BY + (p >> 3) * T;
        const clara = ((i >> 3) + (i & 7)) % 2 === 0;
        ctx.fillStyle = clara ? "#eeeed2" : "#769656";
        ctx.fillRect(x, y, T, T);
        if (v.ult && (v.ult.de === i || v.ult.a === i)) { ctx.fillStyle = "rgba(246,246,105,0.45)"; ctx.fillRect(x, y, T, T); }
        if (i === L.sel) { ctx.fillStyle = "rgba(56,189,248,0.45)"; ctx.fillRect(x, y, T, T); }
        if (i === reyJaque) {
          const g = ctx.createRadialGradient(x + T / 2, y + T / 2, 4, x + T / 2, y + T / 2, T * 0.6);
          g.addColorStop(0, "rgba(239,68,68,0.95)"); g.addColorStop(1, "rgba(239,68,68,0)");
          ctx.fillStyle = g; ctx.fillRect(x, y, T, T);
        }
        J.zona(x, y, T, T, () => click(J, i), { off: !miTurno || !!L.promo });
      }
      // coordenadas
      for (let k = 0; k < 8; k++) {
        const col = v.color === "b" ? 7 - k : k, fil = v.color === "b" ? k + 1 : 8 - k;
        D.txt(NOMBRE[col], BX + k * T + T / 2, BY + 8 * T + 9, { size: 11, color: "#a8a29e" });
        D.txt(fil, BX - 11, BY + k * T + T / 2, { size: 11, color: "#a8a29e" });
      }
      for (let i = 0; i < 64; i++) {
        if (!v.tab[i]) continue;
        const p = pant(v, i);
        pieza(v.tab[i], BX + (p & 7) * T + T / 2, BY + (p >> 3) * T + T / 2, 48);
        if (miTurno && movibles.has(i) && L.sel < 0 && J.ptr.x >= BX + (p & 7) * T && J.ptr.x < BX + (p & 7) * T + T &&
            J.ptr.y >= BY + (p >> 3) * T && J.ptr.y < BY + (p >> 3) * T + T) {
          ctx.strokeStyle = J.miColor(); ctx.lineWidth = 3; ctx.strokeRect(BX + (p & 7) * T + 2, BY + (p >> 3) * T + 2, T - 4, T - 4);
        }
      }
      for (const a of destinos) {
        const p = pant(v, a), x = BX + (p & 7) * T + T / 2, y = BY + (p >> 3) * T + T / 2;
        if (v.tab[a]) D.circ(x, y, T * 0.44, null, "rgba(0,0,0,0.35)", 5);
        else D.circ(x, y, 10, "rgba(0,0,0,0.28)");
      }

      // piezas capturadas a los costados (las de mi color perdidas a la derecha)
      const capturas = (lista, x) => {
        lista.slice().sort((a, b) => AJ.VAL[b.toLowerCase()] - AJ.VAL[a.toLowerCase()]).forEach((p, k) =>
          pieza(p, x + (k % 3) * 30, BY + 30 + Math.floor(k / 3) * 34, 28, 0.9));
      };
      const rival = v.color === "w" ? "b" : "w";
      capturas(v.capt[v.color], 70);     // lo que yo capture
      capturas(v.capt[rival], 800);      // lo que me capturaron

      // selector de promocion
      if (L.promo) {
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(BX, BY, T * 8, T * 8);
        D.txt("Corona en…", 480, BY + 170, { size: 22, f: "o" });
        "qrbn".split("").forEach((pr, k) => {
          const x = 480 - 150 + k * 78, y = BY + 210;
          J.boton(x, y, 66, 66, "", () => { J.accion({ de: L.promo.de, a: L.promo.a, pr }); L.promo = null; L.sel = -1; }, { color: J.miColor() });
          pieza(v.color === "w" ? pr.toUpperCase() : pr, x + 33, y + 33, 44);
        });
        J.boton(480 - 60, BY + 300, 120, 34, "Cancelar", () => { L.promo = null; }, { size: 13 });
      }
    },

    textoFin(J, v, g) {
      return { sub: v.motivo || "" };
    },
  });
})();
