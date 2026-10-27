// ==========================================================================
//  Modulo de juego: ARTILLERIA (JUEGOS.artilleria).
// ==========================================================================
(function () {
  const D = Kit.D, C = Kit.COL;
  const GRAD = Math.PI / 180;

  function tanque(x, y, ang, color, hp) {
    ctx.save();
    ctx.translate(x, y);
    // cañon
    ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(Math.cos(ang) * 24, -10 - Math.sin(ang) * 24); ctx.stroke();
    ctx.lineCap = "butt";
    // torreta y casco
    D.circ(0, -10, 9, color);
    D.caja(-17, -10, 34, 12, { r: 4, fill: color, stroke: "rgba(0,0,0,0.4)" });
    D.caja(-19, -1, 38, 7, { r: 3, fill: "#1f2937" });
    for (let k = -2; k <= 2; k++) D.circ(k * 7, 2.5, 2.4, "#6b7280");
    ctx.restore();
    // vida
    D.caja(x - 22, y - 42, 44, 6, { r: 3, fill: "rgba(0,0,0,0.5)" });
    D.caja(x - 22, y - 42, 44 * hp / 100, 6, { r: 3, fill: hp > 50 ? C.ok : hp > 25 ? C.acento : C.mal });
  }

  function disparar(J) {
    const v = J.v;
    if (!v || v.turno !== v.yo || v.fase !== "apunta" || v.g) return;
    J.accion({ fuego: 1, ang: J.inp.ang, pot: J.inp.pot });
  }

  Kit.juego({
    id: "artilleria",
    nombre: "Artillería",
    desc: "Cañones sobre un terreno que se rompe. Calcula ángulo, potencia y viento… y abre un cráter.",
    ayuda: "<b>Artillería:</b> <kbd>←</kbd>/<kbd>→</kbd> ángulo, <kbd>↑</kbd>/<kbd>↓</kbd> potencia, <kbd>espacio</kbd> dispara. Con el mouse: mantén apretado y arrastra para apuntar; suelta para disparar. Mira la flecha del viento.",
    meta: { tag: "BOOM", icono: "💣", gradiente: "linear-gradient(135deg, #9a3412 0%, #1c0a03 100%)", color: "#fdba74" },
    tipo: "turnos",
    canvas: { w: 960, h: 600 },
    Sim: ArtilleriaSim,
    continuo: true,
    envioHz: 30,
    fondo: "#0b1220",
    local: () => ({ estela: [], k: {}, listo: false, arrastra: false }),
    inp: () => ({ ang: Math.PI / 4, pot: 60 }),

    evento(J, e) {
      if (e.tipo === "disparo") { J.local.estela = []; J.sfx("golpe", 0.6); J.sfx("laser"); }
      if (e.tipo === "expl") {
        J.sfx("explosion"); J.sacudir(e.d1 || e.d2 ? 14 : 8);
        J.chispas(e.x, e.y, "#fb923c", 30, 260, 0.8, 3); J.chispas(e.x, e.y, "#fde68a", 16, 160, 0.5, 2);
        for (const j of [1, 2]) if (e["d" + j]) J.aviso((j === J.rol ? "Recibes " : "Daño al rival: ") + e["d" + j], j === J.rol ? C.mal : C.ok, 1.6);
      }
      if (e.tipo === "fuera") J.aviso("Se fue del mapa", C.tenue, 1.2);
    },
    teclado(J, e, abajo) {
      const k = e.key;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(k)) { J.local.k[k] = abajo; return true; }
      if (k === " " && abajo) { disparar(J); return true; }
      return false;
    },
    puntero(J, tipo, x, y) {
      const v = J.v;
      if (!v || v.turno !== v.yo || v.fase !== "apunta" || v.g) { J.local.arrastra = false; return; }
      const t = v.tanques[v.yo];
      if (tipo === "abajo") J.local.arrastra = true;
      if (J.local.arrastra && (tipo === "abajo" || tipo === "mueve")) {
        const dx = x - t.x, dy = t.y - 10 - y;
        J.inp.ang = clamp(Math.atan2(Math.max(2, dy), dx), 0.05, Math.PI - 0.05);
        J.inp.pot = clamp(Math.hypot(dx, dy) / 2.2, 5, 100);
      }
      if (tipo === "arriba" && J.local.arrastra) { J.local.arrastra = false; disparar(J); }
    },

    pintar(J, v) {
      const L = J.local, yo = v.yo, miTurno = !v.g && v.turno === yo && v.fase === "apunta";
      // al empezar mi turno, la mira parte donde la deje
      if (miTurno && !L.listo) { J.inp.ang = v.tanques[yo].ang; J.inp.pot = v.tanques[yo].pot; L.listo = true; }
      if (!miTurno) L.listo = false;
      if (miTurno) {
        const dt = J.dt;
        if (L.k.ArrowLeft) J.inp.ang = Math.min(Math.PI - 0.05, J.inp.ang + 1.2 * dt);
        if (L.k.ArrowRight) J.inp.ang = Math.max(0.05, J.inp.ang - 1.2 * dt);
        if (L.k.ArrowUp) J.inp.pot = Math.min(100, J.inp.pot + 40 * dt);
        if (L.k.ArrowDown) J.inp.pot = Math.max(5, J.inp.pot - 40 * dt);
      }

      // cielo y montañas de fondo
      const g = ctx.createLinearGradient(0, 0, 0, 600);
      g.addColorStop(0, "#0b1220"); g.addColorStop(1, "#3b1d3f");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 600);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.beginPath(); ctx.moveTo(0, 600);
      for (let x = 0; x <= 960; x += 40) ctx.lineTo(x, 330 - Math.sin(x * 0.007) * 60 - Math.sin(x * 0.019) * 25);
      ctx.lineTo(960, 600); ctx.fill();

      // terreno
      ctx.beginPath(); ctx.moveTo(0, 600);
      v.alt.forEach((h, k) => ctx.lineTo(k * ART.PASO, h));
      ctx.lineTo(960, 600); ctx.closePath();
      const tg = ctx.createLinearGradient(0, 260, 0, 600);
      tg.addColorStop(0, "#4d7c0f"); tg.addColorStop(0.12, "#3f3f1d"); tg.addColorStop(1, "#1c1208");
      ctx.fillStyle = tg; ctx.fill();
      ctx.strokeStyle = "#84cc16"; ctx.lineWidth = 3; ctx.beginPath();
      v.alt.forEach((h, k) => (k ? ctx.lineTo(k * ART.PASO, h) : ctx.moveTo(0, h)));
      ctx.stroke();

      // tanques
      for (const j of [1, 2]) {
        const t = v.tanques[j];
        const ang = j === yo && miTurno ? J.inp.ang : J.sa("a" + j, t.ang);
        tanque(t.x, J.s("y" + j, t.y), ang, J.color(j), t.hp);
        D.txt(J.nombre(j) + " " + t.hp, t.x, t.y - 54, { size: 12, f: "o", color: J.color(j) });
      }

      // mira del jugador activo
      const act = v.tanques[v.turno];
      if (v.fase === "apunta" && !v.g) {
        const ang = miTurno ? J.inp.ang : J.sa("a" + v.turno, act.ang), pot = miTurno ? J.inp.pot : act.pot;
        const largo = 30 + pot * 1.2;
        D.linea(act.x + Math.cos(ang) * 26, act.y - 10 - Math.sin(ang) * 26, act.x + Math.cos(ang) * largo, act.y - 10 - Math.sin(ang) * largo, J.color(v.turno), 2, [6, 6]);
        D.txt(Math.round(ang / GRAD) + "° · " + Math.round(pot) + "%", act.x + Math.cos(ang) * (largo + 22), act.y - 10 - Math.sin(ang) * (largo + 22), { size: 13, f: "o", color: J.color(v.turno) });
      }

      // bala y estela
      if (v.bala) {
        L.estela.push([v.bala.x, v.bala.y]);
        if (L.estela.length > 160) L.estela.shift();
      }
      if (L.estela.length > 1) {
        ctx.strokeStyle = "rgba(253,230,138,0.5)"; ctx.lineWidth = 2; ctx.beginPath();
        L.estela.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      if (v.bala) D.circ(J.s("bx", v.bala.x, 60), J.s("by", v.bala.y, 60), 5, "#fde68a", null, 0, "#f59e0b");

      // HUD: turno + viento
      D.marcador(J, {});
      if (!v.g) D.turno(J, v.turno === yo);
      const vx = 480, vy = 56, w = v.viento * 60;
      D.txt("VIENTO", vx, vy - 2, { size: 10, f: "o", color: C.tenue });
      D.linea(vx, vy + 14, vx + w, vy + 14, "#7dd3fc", 3);
      if (Math.abs(w) > 2) {
        const s = Math.sign(w);
        ctx.fillStyle = "#7dd3fc"; ctx.beginPath();
        ctx.moveTo(vx + w + s * 8, vy + 14); ctx.lineTo(vx + w, vy + 8); ctx.lineTo(vx + w, vy + 20); ctx.fill();
      }
      D.txt(Math.abs(v.viento * 10).toFixed(0), vx + w + Math.sign(w || 1) * 22, vy + 14, { size: 12, f: "o", color: "#7dd3fc" });
      if (miTurno) J.boton(860, 548, 84, 36, "DISPARAR", () => disparar(J), { lleno: true, color: J.miColor(), size: 13, f: "o" });
    },

    textoFin(J, v, g) { return { sub: g === 3 ? "Se destruyeron los dos" : g === J.rol ? "Tanque rival destruido" : "Te destruyeron" }; },
  });
})();
