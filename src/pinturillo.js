// ==========================================================================
//  Modulo de juego: PINTURILLO (JUEGOS.pinturillo). El dibujo se pinta en un
//  canvas aparte de forma incremental; la respuesta se escribe en un <input>
//  real (abre el teclado del celular).
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL, LX = 20, LY = 58;
  const COLORES = ["#111827", "#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#92400e", "#ffffff"];
  const TAM = [3, 8, 18];
  let campo = null;

  // Fuente del dibujo segun quien soy: host = la sim; guest que dibuja = lo suyo; guest que adivina = lo recibido.
  function fuente(J, v) {
    const L = J.local;
    if (J.rol === 1) return { v: v.lienzo.v, ops: v.lienzo.ops };
    if (v.dibuja === v.yo) return { v: "p" + L.propV, ops: L.propios };
    return { v: "r" + L.recibV, ops: L.recib };
  }
  function pintarOps(L, f) {
    if (!L.off) {
      L.off = document.createElement("canvas"); L.off.width = PT.W * 2; L.off.height = PT.H * 2;
      L.octx = L.off.getContext("2d"); L.octx.scale(2, 2); L.octx.lineCap = "round"; L.octx.lineJoin = "round";
    }
    const o = L.octx;
    if (f.v !== L.offV || f.ops.length < L.offN) { o.fillStyle = "#fff"; o.fillRect(0, 0, PT.W, PT.H); L.offV = f.v; L.offN = 0; L.ult = null; }
    for (let k = L.offN; k < f.ops.length; k++) {
      const [x, y, nuevo, c, s] = f.ops[k];
      o.strokeStyle = COLORES[c]; o.fillStyle = COLORES[c]; o.lineWidth = TAM[s];
      if (nuevo || !L.ult) { o.beginPath(); o.arc(x, y, TAM[s] / 2, 0, Math.PI * 2); o.fill(); }
      else { o.beginPath(); o.moveTo(L.ult[0], L.ult[1]); o.lineTo(x, y); o.stroke(); }
      L.ult = [x, y];
    }
    L.offN = f.ops.length;
  }
  function trazo(J, x, y, nuevo) {
    const L = J.local, op = [Math.round(clamp(x - LX, 0, PT.W)), Math.round(clamp(y - LY, 0, PT.H)), nuevo ? 1 : 0, L.color, L.tam];
    if (J.rol === 1) J.accion({ ops: [op] });
    else { L.propios.push(op); L.envio.push(op); }
  }

  Kit.juego({
    id: "pinturillo",
    nombre: "Pinturillo",
    desc: "Uno dibuja, el otro adivina. Adivina rápido para sumar más; el que dibuja también gana si le aciertan.",
    ayuda: "<b>Pinturillo:</b> si dibujas, elige una palabra y dibuja con el mouse o el dedo (colores, grosor y borrar abajo). Si adivinas, escribe en el cuadro de la derecha y presiona <kbd>Enter</kbd>. 6 rondas, se alternan.",
    meta: { tag: "DIBUJA", icono: "🎨", gradiente: "linear-gradient(135deg, #db2777 0%, #3b0764 100%)", color: "#f9a8d4" },
    tipo: "turnos",
    canvas: { w: 960, h: 600 },
    Sim: PinturilloSim,
    continuo: true, envioHz: 15,
    fondo: "#120a1c",
    cursor: (J) => (J.v && J.v.fase === "dibuja" && J.v.dibuja === J.rol && J.ptr.x > LX && J.ptr.x < LX + PT.W && J.ptr.y > LY && J.ptr.y < LY + PT.H ? "crosshair" : "default"),
    local: () => ({ color: 0, tam: 1, dibujando: false, propios: [], propV: 0, envio: [], tEnvio: 0, recib: [], recibV: -1, ult: null }),
    inp: () => ({ n: 0, v: -1 }),

    alIniciar(J) {
      campo = document.createElement("input");
      campo.type = "text"; campo.maxLength = 40; campo.placeholder = "Escribe tu respuesta…"; campo.autocomplete = "off";
      Object.assign(campo.style, { position: "absolute", left: (680 / 960) * 100 + "%", top: (528 / 600) * 100 + "%", width: (260 / 960) * 100 + "%",
        height: (40 / 600) * 100 + "%", boxSizing: "border-box", padding: "0 12px", borderRadius: "10px", border: "2px solid #f9a8d4",
        background: "#1e1030", color: "#fff", font: "600 16px Urbanist, sans-serif", display: "none", zIndex: 2 });
      campo.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter" && campo.value.trim()) { J.accion({ adivina: campo.value }); campo.value = ""; }
      });
      document.getElementById("lienzoWrap").appendChild(campo);
    },
    alDestruir() { if (campo) campo.remove(); campo = null; },

    evento(J, e) {
      if (e.tipo === "ronda") { const L = J.local; L.propios = []; L.propV++; L.envio = []; J.aviso("Ronda " + e.n + ": dibuja " + J.nombre(e.dibuja), J.color(e.dibuja), 2); }
      if (e.tipo === "elegida") J.sfx("ficha");
      if (e.tipo === "pista") J.sfx("tic");
      if (e.tipo === "intento") J.sfx(e.cerca ? "sonar" : "rebote", 0.8);
      if (e.tipo === "cierre") J.sfx(e.g ? "fanfarria" : "error");
    },
    puntero(J, tipo, x, y) {
      const v = J.v, L = J.local;
      if (!v || v.fase !== "dibuja" || v.dibuja !== v.yo) return;
      const dentro = x >= LX && x <= LX + PT.W && y >= LY && y <= LY + PT.H;
      if (tipo === "abajo" && dentro) { L.dibujando = true; trazo(J, x, y, true); L.px = x; L.py = y; }
      else if (tipo === "mueve" && L.dibujando && Math.hypot(x - L.px, y - L.py) > 2.5) { trazo(J, x, y, false); L.px = x; L.py = y; }
      else if (tipo === "arriba") L.dibujando = false;
    },

    pintar(J, v) {
      const L = J.local, yo = v.yo, dibujo = v.dibuja === yo;
      // guest que adivina: junta los trazos que llegan y avisa cuantos tiene
      if (J.rol === 2 && !dibujo) {
        if (v.lienzo.v !== L.recibV) { L.recib = []; L.recibV = v.lienzo.v; }
        const d = v.lienzo.desde;
        if (d <= L.recib.length) for (const op of v.lienzo.ops.slice(L.recib.length - d)) L.recib.push(op);
        J.inp.n = L.recib.length; J.inp.v = L.recibV;
      }
      // guest que dibuja: manda sus trazos en paquetes
      if (J.rol === 2 && dibujo && L.envio.length && J.t - L.tEnvio > 0.06) { J.accion({ ops: L.envio.splice(0, 300) }); L.tEnvio = J.t; }

      D.caja(LX - 4, LY - 4, PT.W + 8, PT.H + 8, { r: 10, fill: "#fff", stroke: dibujo && v.fase === "dibuja" ? J.miColor() : "#4c1d95", lw: 3 });
      pintarOps(L, fuente(J, v));
      ctx.drawImage(L.off, LX, LY, PT.W, PT.H);

      // panel derecho
      D.marcador(J, { p1: v.puntos[1], p2: v.puntos[2], centro: "RONDA " + v.ronda + "/" + PT.RONDAS, y: 26 });
      const px = 680, pw = 260;
      D.caja(px, LY - 4, pw, 156, { r: 12, fill: "rgba(255,255,255,0.04)", stroke: C.borde });
      D.txt(dibujo ? "TE TOCA DIBUJAR" : "TE TOCA ADIVINAR", px + pw / 2, LY + 18, { size: 12, f: "o", color: J.miColor() });
      if (v.fase === "dibuja" || v.fase === "resumen") {
        const txt = dibujo || v.fase === "resumen" ? (v.palabra || "").toUpperCase() : v.pista.split("").join(" ");
        D.txt(txt, px + pw / 2, LY + 62, { size: dibujo ? 24 : 22, f: "o", max: pw - 20, color: C.acento });
        if (!dibujo && v.fase === "dibuja") D.txt(v.pista.replace(/ /g, "").length + " letras", px + pw / 2, LY + 92, { size: 12, color: C.tenue });
      }
      D.txt("⏱ " + v.t, px + pw / 2, LY + 128, { size: 22, f: "o", color: v.t <= 10 && v.fase === "dibuja" ? C.mal : Kit.COL.texto });
      // chat de intentos
      D.caja(px, LY + 162, pw, 300, { r: 12, fill: "rgba(255,255,255,0.03)", stroke: C.borde });
      v.chat.slice(-9).forEach((m, k) => {
        const y = LY + 186 + k * 31;
        if (m.ok) D.txt("✔ " + J.nombre(m.j) + " ¡adivinó!", px + 14, y, { size: 15, align: "left", color: C.ok });
        else D.txt(m.t + (m.cerca ? "  · ¡casi!" : ""), px + 14, y, { size: 15, align: "left", max: pw - 28, color: m.cerca ? C.acento : "#e5e7eb", peso: 600 });
      });
      if (campo) campo.style.display = !dibujo && v.fase === "dibuja" && !v.g ? "block" : "none";

      // herramientas del que dibuja
      if (dibujo && v.fase === "dibuja") {
        COLORES.forEach((c, k) => {
          J.boton(LX + k * 38, 548, 32, 32, "", () => { L.color = k; }, { fill: c, activo: L.color === k, color: "#fff", mudo: true });
          D.caja(LX + k * 38 + 5, 553, 22, 22, { r: 5, fill: c, stroke: "rgba(0,0,0,0.3)" });
        });
        TAM.forEach((t, k) => { J.boton(LX + 392 + k * 40, 548, 34, 32, "", () => { L.tam = k; }, { activo: L.tam === k, color: J.miColor(), mudo: true }); D.circ(LX + 392 + k * 40 + 17, 564, t / 2 + 1, "#e5e7eb"); });
        J.boton(LX + 520, 548, 120, 32, "🗑 Borrar todo", () => {
          if (J.rol === 2) { L.propios = []; L.propV++; L.envio = []; }
          J.accion({ borrar: 1 });
        }, { size: 13 });
      }

      // elegir palabra / esperas
      if (v.fase === "elige") {
        ctx.fillStyle = "rgba(18,10,28,0.85)"; ctx.fillRect(LX, LY, PT.W, PT.H);
        if (dibujo) {
          D.txt("Elige qué vas a dibujar (" + v.t + " s)", LX + PT.W / 2, LY + 150, { size: 20, f: "b" });
          v.opciones.forEach((p, k) => J.boton(LX + 80 + k * 166, LY + 200, 150, 56, p.toUpperCase(), () => J.accion({ palabra: p }), { size: 15, f: "o", color: J.miColor() }));
        } else D.txt((J.esBot ? "El bot" : "Tu rival") + " está eligiendo una palabra…", LX + PT.W / 2, LY + PT.H / 2, { size: 20, color: "#e9d5ff" });
      }
      if (v.fase === "resumen" && v.res) {
        ctx.fillStyle = "rgba(18,10,28,0.7)"; ctx.fillRect(LX, LY + PT.H / 2 - 60, PT.W, 120);
        D.txt("Era: " + v.res.palabra.toUpperCase(), LX + PT.W / 2, LY + PT.H / 2 - 18, { size: 26, f: "b", color: C.acento });
        D.txt(v.res.g ? J.nombre(v.res.g) + " adivinó: +" + v.res.pts + " · el que dibujó +40" : "Nadie adivinó", LX + PT.W / 2, LY + PT.H / 2 + 22, { size: 16 });
      }
    },
    textoFin(J, v) { return { sub: v.puntos[1] + " a " + v.puntos[2] + " puntos" }; },
  });
})();
