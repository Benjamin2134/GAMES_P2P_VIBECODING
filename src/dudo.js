// ==========================================================================
//  Modulo de juego: DUDO / CACHO (JUEGOS.dudo).
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL;
  const filaDados = (dados, y, t, o = {}) => {
    const g = t * 0.25, x0 = 480 - (dados.length * (t + g) - g) / 2;
    dados.forEach((d, k) => D.dado(x0 + k * (t + g), y, t, d, {
      as: true, glow: o.marca && (d === o.marca || (o.marca !== 1 && d === 1)) ? C.acento : null,
      fill: o.marca && !(d === o.marca || (o.marca !== 1 && d === 1)) ? "#9ca3af" : undefined,
    }));
  };
  function cacho(x, y, n, color) {
    // vaso de cuero visto de frente + cuantos dados esconde
    ctx.beginPath();
    ctx.moveTo(x - 46, y - 40); ctx.lineTo(x + 46, y - 40); ctx.lineTo(x + 58, y + 40); ctx.lineTo(x - 58, y + 40); ctx.closePath();
    ctx.fillStyle = "#5b2b12"; ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(x - 40, y - 26, 80, 6);
    D.txt(n, x, y + 8, { size: 30, f: "o", color: "#fde68a" });
  }

  Kit.juego({
    id: "dudo",
    nombre: "Dudo (Cacho)",
    desc: "El cacho chileno a dos: apuesta cuántos dados hay, los ases son comodines… ¿dudas o calzas?",
    ayuda: "<b>Dudo:</b> elige cantidad con <kbd>−</kbd>/<kbd>+</kbd> y una pinta, y apuesta contando los dados de ambos (los ases valen como comodín). Si no te crees la apuesta del rival: <b>¡Dudo!</b> Si crees que es exacta: <b>¡Calzo!</b>",
    meta: { tag: "CACHO", icono: "🎲", gradiente: "linear-gradient(135deg, #7f1d1d 0%, #1f0707 100%)", color: "#fca5a5" },
    tipo: "turnos",
    canvas: { w: 960, h: 600 },
    Sim: DudoSim,
    hz: 30,
    fondo: "#170707",
    local: () => ({ q: 1, c: 2, tira: -9 }),

    evento(J, e) {
      if (e.tipo === "tira") { J.local.tira = J.t; J.sfx("dados"); J.local.q = 0; }
      if (e.tipo === "apuesta") { J.sfx("ficha"); J.local.q = 0; }
      if (e.tipo === "dudo" || e.tipo === "calzo") {
        J.sfx("golpe");
        J.aviso((e.j === J.rol ? "¡" : (J.esBot ? "El bot: ¡" : "El rival: ¡")) + (e.tipo === "dudo" ? "Dudo!" : "Calzo!"), C.acento, 2);
      }
    },

    pintar(J, v) {
      const L = J.local, miTurno = v.fase === "apuesta" && v.turno === v.yo && !v.g, o = Kit.otro(v.yo);
      D.marcador(J, { p1: "🎲" + v.n[1], p2: "🎲" + v.n[2] });
      if (v.fase === "apuesta" && !v.g) D.turno(J, miTurno);
      const total = v.n[1] + v.n[2];
      D.txt("RONDA " + v.ronda + " · " + total + " DADOS EN JUEGO", 480, 50, { size: 11, color: C.tenue, f: "o" });

      // mesa de pano
      D.caja(40, 64, 880, 520, { r: 26, fill: "#14532d", stroke: "#3f6212", lw: 3 });

      const rev = v.fase === "revela" && v.res;
      // rival arriba
      D.txt(J.nombre(o), 480, 92, { size: 14, color: J.color(o), f: "o" });
      if (rev) filaDados(v.res.dados[o], 108, 48, { marca: v.res.apuesta.c });
      else cacho(480, 150, v.nRival, J.color(o));

      // apuesta vigente
      if (v.apuesta) {
        const ap = v.apuesta;
        D.txt(ap.j === v.yo ? "Apostaste" : (J.esBot ? "El bot apuesta" : "El rival apuesta"), 480, 228, { size: 14, color: C.tenue });
        D.txt(ap.q + " ×", 456, 272, { size: 40, f: "o", align: "right", color: J.color(ap.j) });
        D.dado(470, 246, 52, ap.c, { as: true, glow: J.color(ap.j) });
        if (ap.c === 1) D.txt("ases", 540, 272, { size: 15, align: "left", color: C.tenue });
      } else if (v.fase === "apuesta") {
        D.txt(miTurno ? "Abres tú: haz la primera apuesta" : "Esperando la primera apuesta…", 480, 262, { size: 16, color: C.tenue });
      }

      if (rev) {
        const r = v.res;
        const txt = r.tipo === "dudo"
          ? "Había " + r.hay + " · " + (r.pierde === v.yo ? "pierdes un dado" : "el rival pierde un dado")
          : r.gana ? "¡Calzó exacto! " + (r.gana === v.yo ? "recuperas un dado" : "el rival recupera un dado")
            : "Había " + r.hay + " · " + (r.pierde === v.yo ? "pierdes un dado" : "el rival pierde un dado");
        D.caja(250, 306, 460, 44, { r: 22, fill: "rgba(0,0,0,0.45)", stroke: C.acento });
        D.txt(txt, 480, 329, { size: 18, color: C.acento });
      }

      // mis dados (rodando al inicio de la ronda)
      const rodando = J.t - L.tira < 0.6;
      const mios = rodando ? v.mios.map(() => Kit.ri(1, 6)) : v.mios;
      D.txt("TUS DADOS", 480, 372, { size: 11, color: J.miColor(), f: "o" });
      filaDados(rev ? v.res.dados[v.yo] : mios, 386, 56, rev ? { marca: v.res.apuesta.c } : {});

      // controles
      if (miTurno) {
        if (!L.q || !DUDO.valida(v.apuesta, L.q, L.c, v.nMio)) {
          // proponer la apuesta minima valida con la pinta elegida (o la siguiente que sirva)
          let c = L.c;
          for (let k = 0; k < 6 && DUDO.minima(v.apuesta, c, v.nMio) > total; k++) c = c % 6 + 1;
          L.c = c; L.q = Math.min(total, DUDO.minima(v.apuesta, c, v.nMio));
        }
        const y = 478;
        J.boton(90, y, 40, 40, "−", () => { L.q = Math.max(1, L.q - 1); }, { size: 22 });
        D.txt(L.q, 160, y + 21, { size: 28, f: "o" });
        J.boton(190, y, 40, 40, "+", () => { L.q = Math.min(total, L.q + 1); }, { size: 22 });
        for (let c = 1; c <= 6; c++) {
          const x = 262 + (c - 1) * 50;
          J.boton(x, y, 44, 44, "", () => { L.c = c; if (!DUDO.valida(v.apuesta, L.q, c, v.nMio)) L.q = Math.min(total, DUDO.minima(v.apuesta, c, v.nMio)); },
            { activo: L.c === c, color: J.miColor(), mudo: false });
          D.dado(x + 5, y + 5, 34, c, { as: true });
        }
        const ok = DUDO.valida(v.apuesta, L.q, L.c, v.nMio) && L.q <= total;
        J.boton(572, y, 110, 44, "Apostar", () => J.accion({ q: L.q, c: L.c }), { lleno: true, color: J.miColor(), off: !ok });
        J.boton(694, y, 96, 44, "¡Dudo!", () => J.accion({ dudo: 1 }), { lleno: true, color: C.mal, off: !v.apuesta });
        J.boton(800, y, 96, 44, "¡Calzo!", () => J.accion({ calzo: 1 }), { lleno: true, color: C.acento, off: !v.apuesta });
        if (!v.apuesta && v.nMio > 1) D.txt("No se abre con ases", 330, y + 62, { size: 12, color: C.tenue });
      }
    },

    textoFin(J, v, g) { return { sub: g === J.rol ? "El rival se quedó sin dados" : "Te quedaste sin dados" }; },
  });
})();
