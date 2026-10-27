// ==========================================================================
//  Modulo de juego: GENERALA (JUEGOS.generala). Dados a la izquierda,
//  planilla de ambos a la derecha.
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL;
  const DX = 70, DY = 210, DT = 70, DG = 16;
  const PX = 520, PY = 64, FW = 400, FH = 37;

  Kit.juego({
    id: "generala",
    nombre: "Generala",
    desc: "Cinco dados, tres tiradas y once categorías. ¿Escalera, full, póker o generala servida?",
    ayuda: "<b>Generala:</b> <kbd>espacio</kbd> o el botón para tirar (hasta 3 veces). Click en un dado para guardarlo entre tiradas. Click en una casilla de tu columna para anotar (los números grises son lo que sumarías).",
    meta: { tag: "DADOS", icono: "🎯", gradiente: "linear-gradient(135deg, #1e40af 0%, #0b1330 100%)", color: "#93c5fd" },
    tipo: "turnos",
    canvas: { w: 960, h: 600 },
    Sim: GeneralaSim,
    fondo: "#0a0f22",
    local: () => ({ tira: -9 }),

    evento(J, e) {
      if (e.tipo === "tira") { J.local.tira = J.t; J.sfx("dados"); }
      if (e.tipo === "anota") {
        J.sfx(e.pts ? "moneda" : "error");
        const quien = e.j === J.rol ? "Anotas" : (J.esBot ? "El bot anota" : "El rival anota");
        J.aviso(quien + " " + e.pts + " en " + GEN.NOMBRE[e.cat], e.pts ? C.acento : C.tenue, 2);
      }
      if (e.tipo === "servida") { J.sfx("fanfarria"); J.aviso("¡GENERALA SERVIDA!", C.acento, 3); J.sacudir(10); }
    },
    teclado(J, e, abajo) {
      const v = J.v;
      if (!abajo || !v || v.turno !== v.yo || v.g) return false;
      if (e.key === " " && v.tiradas < 3) { J.accion({ tirar: 1 }); return true; }
      if (e.key >= "1" && e.key <= "5" && v.tiradas && v.tiradas < 3) { J.accion({ guardar: +e.key - 1 }); return true; }
      return false;
    },

    pintar(J, v) {
      const miTurno = !v.g && v.turno === v.yo, L = J.local;
      D.marcador(J, { p1: v.totales[1], p2: v.totales[2] });
      if (!v.g) D.turno(J, miTurno);

      // dados
      D.caja(40, 150, 450, 300, { r: 22, fill: "#0f2a1c", stroke: "#166534", lw: 2 });
      const rodando = J.t - L.tira < 0.5;
      for (let k = 0; k < 5; k++) {
        const g = v.guardados[k], x = DX + k * (DT + DG) - 8, y = DY + (g ? -26 : 0);
        const n = !v.tiradas ? 0 : rodando && !g ? Kit.ri(1, 6) : v.dados[k];
        const puede = miTurno && v.tiradas > 0 && v.tiradas < 3;
        if (puede) J.zona(x, y, DT, DT, () => J.accion({ guardar: k }), { mudo: false });
        D.dado(x, y, DT, n || 0, { glow: g ? J.color(v.turno) : null, stroke: g ? J.color(v.turno) : undefined, lw: g ? 3 : 2 });
        if (!v.tiradas) D.txt("?", x + DT / 2, y + DT / 2 + 2, { size: 30, f: "o", color: "#9ca3af" });
      }
      if (v.tiradas && v.tiradas < 3 && miTurno) D.txt("Click en un dado para guardarlo", 265, 318, { size: 13, color: C.tenue });
      D.txt(v.tiradas ? "Tirada " + v.tiradas + " de 3" : (miTurno ? "Tira los dados" : ""), 265, 176, { size: 14, color: C.tenue, f: "o" });
      if (miTurno) {
        J.boton(150, 360, 230, 52, v.tiradas === 0 ? "Tirar dados" : v.tiradas < 3 ? "Volver a tirar (" + (3 - v.tiradas) + ")" : "Anota en la planilla →",
          () => J.accion({ tirar: 1 }), { lleno: v.tiradas < 3, color: J.miColor(), off: v.tiradas >= 3, size: 17 });
      } else if (!v.g) D.txt(J.esBot ? "El bot está tirando…" : "Tira el rival…", 265, 386, { size: 15, color: C.tenue });

      // planilla
      D.caja(PX, PY, FW, FH * 13, { r: 12, fill: "rgba(255,255,255,0.03)", stroke: C.borde });
      D.txt("CATEGORÍA", PX + 16, PY + FH / 2, { size: 11, align: "left", color: C.tenue, f: "o" });
      for (const j of [1, 2]) D.txt(J.nombre(j), PX + 250 + (j - 1) * 90, PY + FH / 2, { size: 12, color: J.color(j), f: "o" });
      GEN.CATS.forEach((k, f) => {
        const y = PY + FH * (f + 1);
        if (f % 2 === 0) { ctx.fillStyle = "rgba(255,255,255,0.03)"; ctx.fillRect(PX + 2, y, FW - 4, FH); }
        D.txt(GEN.NOMBRE[k], PX + 16, y + FH / 2, { size: 15, align: "left", peso: 600 });
        for (const j of [1, 2]) {
          const x = PX + 250 + (j - 1) * 90, val = v.planillas[j][k];
          if (val !== null) D.txt(val === 0 ? "✕" : val, x, y + FH / 2, { size: 16, f: "o", color: val ? Kit.COL.texto : C.tenue });
          else if (j === v.turno && v.tiradas && v.posibles[k] !== undefined) {
            const pts = v.posibles[k];
            if (j === v.yo && !v.g) {
              const sobre = J.zona(x - 40, y + 2, 80, FH - 4, () => J.accion({ anotar: k }), { mudo: false });
              D.caja(x - 36, y + 4, 72, FH - 8, { r: 6, fill: sobre ? J.color(j) + "44" : "transparent", stroke: sobre ? J.color(j) : "rgba(255,255,255,0.12)" });
            }
            D.txt(pts, x, y + FH / 2, { size: 15, f: "o", color: pts ? J.color(j) + "cc" : "rgba(255,255,255,0.25)" });
          }
        }
      });
      const yT = PY + FH * 12;
      D.linea(PX + 10, yT, PX + FW - 10, yT, C.borde, 1);
      D.txt("TOTAL", PX + 16, yT + FH / 2, { size: 14, align: "left", f: "o" });
      for (const j of [1, 2]) D.txt(v.totales[j], PX + 250 + (j - 1) * 90, yT + FH / 2, { size: 18, f: "o", color: J.color(j) });
    },

    textoFin(J, v, g) {
      const servida = v.ev && v.ev.some((e) => e.tipo === "servida");
      if (servida) return { texto: g === J.rol ? "¡GENERALA SERVIDA!" : "PERDISTE", sub: g === J.rol ? "Ganas en el acto" : "El rival sacó generala servida" };
      return { sub: v.totales[1] + " a " + v.totales[2] + " puntos" };
    },
  });
})();
