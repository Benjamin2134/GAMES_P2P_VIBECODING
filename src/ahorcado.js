// ==========================================================================
//  Modulo de juego: AHORCADO (JUEGOS.ahorcado).
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL;
  const FILAS = ["ABCDEFGHI", "JKLMNÑOPQ", "RSTUVWXYZ"];

  function monigote(x, y, err, color) {
    ctx.strokeStyle = "#a8a29e"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - 70, y + 230); ctx.lineTo(x + 70, y + 230);      // base
    ctx.moveTo(x - 40, y + 230); ctx.lineTo(x - 40, y);            // poste
    ctx.lineTo(x + 50, y); ctx.lineTo(x + 50, y + 30);             // viga y cuerda
    ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.shadowColor = color; ctx.shadowBlur = 8;
    const partes = [
      () => { ctx.beginPath(); ctx.arc(x + 50, y + 52, 22, 0, Math.PI * 2); ctx.stroke(); },
      () => { ctx.beginPath(); ctx.moveTo(x + 50, y + 74); ctx.lineTo(x + 50, y + 150); ctx.stroke(); },
      () => { ctx.beginPath(); ctx.moveTo(x + 50, y + 95); ctx.lineTo(x + 18, y + 125); ctx.stroke(); },
      () => { ctx.beginPath(); ctx.moveTo(x + 50, y + 95); ctx.lineTo(x + 82, y + 125); ctx.stroke(); },
      () => { ctx.beginPath(); ctx.moveTo(x + 50, y + 150); ctx.lineTo(x + 24, y + 195); ctx.stroke(); },
      () => { ctx.beginPath(); ctx.moveTo(x + 50, y + 150); ctx.lineTo(x + 76, y + 195); ctx.stroke(); },
    ];
    for (let k = 0; k < Math.min(err, 6); k++) partes[k]();
    ctx.shadowBlur = 0; ctx.lineCap = "butt";
  }

  function letra(J, l) {
    const v = J.v;
    if (!v || v.fase !== "adivina" || v.adivina !== v.yo || v.letras.includes(l)) return;
    J.accion({ letra: l });
  }

  Kit.juego({
    id: "ahorcado",
    nombre: "Ahorcado",
    desc: "Por turnos uno elige la palabra y el otro la adivina letra a letra antes de completar el monigote.",
    ayuda: "<b>Ahorcado:</b> si te toca elegir, toca una sugerencia o escribe tu propia palabra y presiona <kbd>Enter</kbd>. Si te toca adivinar, usa el teclado en pantalla o el del computador. 6 errores y gana el que eligió.",
    meta: { tag: "PALABRAS", icono: "🪢", gradiente: "linear-gradient(135deg, #57534e 0%, #1c1917 100%)", color: "#e7e5e4" },
    tipo: "turnos",
    canvas: { w: 960, h: 600 },
    Sim: AhorcadoSim,
    hz: 30,
    fondo: "#12100e",
    local: () => ({ escrito: "" }),

    evento(J, e) {
      if (e.tipo === "acierto") J.sfx("moneda");
      if (e.tipo === "error") { J.sfx("error"); J.sacudir(5); }
      if (e.tipo === "elegida") J.sfx("ficha");
      if (e.tipo === "cierre") J.sfx(e.g === J.rol ? "punto" : "sonar");
      if (e.tipo === "ronda") { J.local.escrito = ""; if (e.n > 1) J.aviso("Ronda " + e.n + " de " + AH.RONDAS, C.acento, 1.6); }
    },
    teclado(J, e, abajo) {
      const v = J.v;
      if (!abajo || !v) return false;
      const l = AH.limpiar(e.key);
      if (v.fase === "adivina" && v.adivina === v.yo) {
        if (e.key.length === 1 && l.length === 1) { letra(J, l); return true; }
        return false;
      }
      if (v.fase === "elige" && v.elige === v.yo) {
        if (e.key === "Backspace") { J.local.escrito = J.local.escrito.slice(0, -1); return true; }
        if (e.key === "Enter") { if (J.local.escrito.length >= 3) J.accion({ palabra: J.local.escrito }); return true; }
        if (e.key.length === 1 && l.length === 1 && J.local.escrito.length < 14) { J.local.escrito += l; return true; }
      }
      return false;
    },

    pintar(J, v) {
      const o = Kit.otro(v.yo);
      D.marcador(J, { p1: v.puntos[1], p2: v.puntos[2] });
      D.txt("RONDA " + v.ronda + " / " + AH.RONDAS, 480, 24, { size: 13, f: "o", color: C.tenue });

      monigote(130, 120, v.errores, v.fase === "resumen" && !v.res.adivino ? C.mal : J.color(v.adivina));
      D.txt("Errores " + v.errores + " / " + AH.ERRORES, 150, 392, { size: 13, color: C.tenue });

      const rolTxt = v.elige === v.yo ? "Eliges la palabra" : "Adivinas tú";
      D.txt(rolTxt, 600, 70, { size: 15, f: "o", color: J.miColor() });

      if (v.fase === "elige") {
        if (v.elige === v.yo) {
          D.txt("Elige una palabra para tu rival:", 600, 116, { size: 17 });
          v.sugerencias.forEach((p, k) => J.boton(420 + k * 124, 140, 116, 44, p, () => J.accion({ palabra: p }), { size: 13, color: J.miColor() }));
          D.txt("…o escribe la tuya:", 600, 222, { size: 15, color: C.tenue });
          D.caja(440, 242, 320, 48, { r: 10, fill: "rgba(255,255,255,0.05)", stroke: J.miColor() });
          const cursor = Math.floor(J.t * 2) % 2 ? "▏" : "";
          D.txt((J.local.escrito || "") + cursor, 600, 267, { size: 22, f: "o" });
          J.boton(520, 304, 160, 40, "Usar mi palabra", () => J.accion({ palabra: J.local.escrito }), { off: J.local.escrito.length < 3, lleno: true, color: J.miColor(), size: 14 });
        } else D.txt((J.esBot ? "El bot" : "Tu rival") + " está eligiendo la palabra…", 600, 240, { size: 18, color: C.tenue });
        return;
      }

      // palabra
      const pal = v.fase === "resumen" ? v.res.palabra : v.mascara;
      const n = pal.length, w = Math.min(50, 520 / n), x0 = 600 - (n * w) / 2;
      for (let k = 0; k < n; k++) {
        const ch = pal[k], x = x0 + k * w + w / 2;
        D.linea(x - w * 0.36, 190, x + w * 0.36, 190, "#a8a29e", 3);
        const oculta = v.mascara[k] === "_";
        if (ch !== "_") D.txt(ch, x, 166, { size: Math.min(36, w * 0.8), f: "o", color: oculta ? (v.res && !v.res.adivino ? C.mal : C.acento) : Kit.COL.texto });
        else if (v.palabra) D.txt(v.palabra[k], x, 166, { size: Math.min(36, w * 0.8), f: "o", color: "rgba(255,255,255,0.22)" });
      }

      if (v.fase === "resumen") {
        const r = v.res;
        D.txt(r.adivino ? (r.g === v.yo ? "¡La adivinaste!" : "El rival la adivinó") : (r.g === v.yo ? "¡No la adivinó!" : "Ahorcado…"), 600, 250, { size: 24, f: "b", color: r.g === v.yo ? C.ok : C.mal });
        D.txt("Punto para " + J.nombre(r.g), 600, 286, { size: 15, color: C.tenue });
      }

      // teclado
      const miTurno = v.fase === "adivina" && v.adivina === v.yo;
      FILAS.forEach((fila, f) => fila.split("").forEach((l, k) => {
        const x = 372 + k * 50, y = 360 + f * 56, usada = v.letras.includes(l);
        const bien = usada && v.mascara.includes(l);
        J.boton(x, y, 44, 48, l, () => letra(J, l), {
          off: !miTurno || usada, size: 18, f: "o",
          fill: usada ? (bien ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.2)") : undefined, mudo: true,
        });
      }));
      if (v.fase === "adivina" && !miTurno) D.txt((J.esBot ? "El bot" : "El rival") + " está adivinando tu palabra", 600, 322, { size: 14, color: C.tenue });
    },

    textoFin(J, v) { return { sub: v.puntos[1] + " a " + v.puntos[2] }; },
  });
})();
