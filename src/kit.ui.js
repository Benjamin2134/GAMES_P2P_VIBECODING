// ==========================================================================
//  KIT de modulos (navegador): Kit.juego(cfg) arma JUEGOS.<id> sobre una Sim.
//  - Host: corre la Sim autoritativa (paso fijo si tiene step), manda la
//    vista del jugador 2 (nunca la info oculta del 1) y aplica sus acciones.
//  - Guest: dibuja la vista que llega. Sus acciones van numeradas y se
//    reenvian hasta que el host las confirma (ack): el canal es no confiable.
//  - Bot: recibe solo vista(2), lo mismo que veria un humano (Fair Play).
//  - UI inmediata: botones dibujados y clickeables, suavizado, chispas.
//
//  cfg = {
//    id, nombre, desc, ayuda, meta:{tag,icono,gradiente,color}, tipo:"real"|"turnos",
//    canvas:{w,h}, Sim, hz (paso de la sim), envioHz, continuo (manda J.inp cada frame),
//    local() -> estado local de UI, inp() -> input continuo inicial,
//    pintar(J, v), teclado(J, e, abajo) -> true si la uso, puntero(J, tipo, x, y, e),
//    evento(J, e) (sonidos/efectos), textoFin(J, v, g) -> {texto, sub}, esperaFin (s)
//  }
//  Usa los globales del shell: cv, ctx, net.
// ==========================================================================
(function () {
  const F = {
    o: "'Orbitron', ui-monospace, monospace",
    u: "'Urbanist', system-ui, sans-serif",
    b: "'Unbounded', 'Urbanist', sans-serif",
    m: "ui-monospace, 'SF Mono', Menlo, monospace",
  };
  const A = () => (typeof RetroAudio !== "undefined" ? RetroAudio : null);
  const tono = (...x) => { const a = A(); if (a && a.tono) a.tono(...x); };
  const ruido = (...x) => { const a = A(); if (a && a.ruido) a.ruido(...x); };

  // ---------- dibujo ----------
  const D = {
    F,
    rr(x, y, w, h, r = 8) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    },
    caja(x, y, w, h, o = {}) {
      D.rr(x, y, w, h, o.r ?? 8);
      if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur ?? 14; }
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      ctx.shadowBlur = 0;
      if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lw ?? 1.5; ctx.stroke(); }
    },
    txt(s, x, y, o = {}) {
      ctx.font = (o.peso ?? 700) + " " + (o.size ?? 16) + "px " + F[o.f ?? "u"];
      ctx.textAlign = o.align ?? "center";
      ctx.textBaseline = o.base ?? "middle";
      if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur ?? 10; }
      ctx.fillStyle = o.color ?? Kit.COL.texto;
      if (o.max) ctx.fillText(String(s), x, y, o.max); else ctx.fillText(String(s), x, y);
      ctx.shadowBlur = 0;
      ctx.textBaseline = "alphabetic";
    },
    ancho(s, size = 16, f = "u", peso = 700) {
      ctx.font = peso + " " + size + "px " + F[f];
      return ctx.measureText(String(s)).width;
    },
    circ(x, y, r, fill, stroke, lw = 2, glow) {
      ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
      if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 12; }
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      ctx.shadowBlur = 0;
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
    },
    // Ficha redonda con volumen: borde oscuro, cuerpo y brillo arriba a la izquierda.
    ficha(x, y, r, color, o = {}) {
      ctx.save();
      if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
      if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = 16; }
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.shadowBlur = 0;
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.45)");
      g.addColorStop(0.45, "rgba(255,255,255,0.05)");
      g.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.08); ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.stroke();
      if (o.anillo) { ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2); ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = Math.max(1, r * 0.07); ctx.stroke(); }
      ctx.restore();
    },
    linea(x1, y1, x2, y2, color, lw = 2, dash) {
      ctx.strokeStyle = color; ctx.lineWidth = lw;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      if (dash) ctx.setLineDash([]);
    },
    // Fondo liso con grilla tenue opcional.
    fondo(W, H, color, paso, colGrilla = "rgba(255,255,255,0.035)") {
      ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
      if (!paso) return;
      ctx.strokeStyle = colGrilla; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = paso; x < W; x += paso) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = paso; y < H; y += paso) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    },
    // Barra superior: P1 a la izquierda, P2 a la derecha, texto central.
    marcador(J, o = {}) {
      const y = o.y ?? 24, c1 = o.c1 ?? Kit.COL.p1, c2 = o.c2 ?? Kit.COL.p2;
      const tam = o.size ?? 17;
      D.txt(J.nombre(1) + (o.p1 !== undefined ? "  " + o.p1 : ""), o.x1 ?? 22, y, { align: "left", color: c1, f: "o", size: tam, glow: J.rol === 1 ? c1 : null });
      // x2 deja libre la esquina del boton de silencio del shell
      D.txt((o.p2 !== undefined ? o.p2 + "  " : "") + J.nombre(2), o.x2 ?? J.W - 64, y, { align: "right", color: c2, f: "o", size: tam, glow: J.rol === 2 ? c2 : null });
      if (o.centro) D.txt(o.centro, J.W / 2, y, { color: o.cc ?? Kit.COL.texto, size: o.sizeC ?? 15, f: "o" });
    },
    // Cartel de turno: "TU TURNO" resaltado o "TURNO DEL RIVAL" tenue.
    turno(J, esMio, x, y, extra = "") {
      const c = J.rol === 1 ? Kit.COL.p1 : Kit.COL.p2;
      D.txt(esMio ? "TU TURNO" + extra : (J.esBot ? "PIENSA EL BOT" : "TURNO DEL RIVAL") + extra, x ?? J.W / 2, y ?? 24,
        { color: esMio ? c : Kit.COL.tenue, f: "o", size: 15, glow: esMio ? c : null });
    },
    // Dado de 1 a 6 con pips.
    dado(x, y, t, n, o = {}) {
      D.caja(x, y, t, t, { r: t * 0.18, fill: o.fill ?? "#f5f5f0", stroke: o.stroke ?? "rgba(0,0,0,0.35)", lw: o.lw ?? 2, glow: o.glow });
      if (!n) return;
      const p = t * 0.24, r = t * 0.085, c = o.pip ?? "#111";
      const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
        5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[n] || [];
      for (const [a, b] of P) D.circ(x + t / 2 + a * p, y + t / 2 + b * p, r, n === 1 && o.as ? "#dc2626" : c);
    },
  };

  // ---------- efectos de sonido ----------
  const SFX = {
    clic: () => tono(880, 0.04, "square", 0.07),
    ficha: () => tono(520, 0.07, "triangle", 0.2, 240),
    golpe: (f = 1) => tono(190 * f, 0.09, "square", 0.15, 80 * f),
    rebote: (f = 1) => tono(460 * f, 0.05, "square", 0.09),
    punto: () => { tono(660, 0.08, "square", 0.11); tono(990, 0.14, "square", 0.11, 0, 0.08); },
    error: () => { const a = A(); if (a) a.playError(); },
    moneda: () => { tono(988, 0.06, "square", 0.09); tono(1319, 0.2, "square", 0.09, 0, 0.06); },
    dados: () => { for (let i = 0; i < 6; i++) ruido(0.035, 0.2, 2600, i * 0.045); },
    carta: () => ruido(0.07, 0.16, 3400),
    explosion: () => { const a = A(); if (a) a.playExplosion(); },
    laser: () => { const a = A(); if (a) a.playLaser(); },
    powerup: () => { const a = A(); if (a) a.playPowerup(); },
    sonar: () => { const a = A(); if (a) a.playSonar(); },
    splash: () => { const a = A(); if (a) a.playSplash(); },
    salto: () => tono(300, 0.13, "square", 0.09, 720),
    caida: () => tono(520, 0.32, "sawtooth", 0.07, 110),
    tic: () => tono(1250, 0.025, "square", 0.045),
    gong: () => { tono(196, 0.7, "triangle", 0.22, 180); tono(392, 0.5, "sine", 0.08); },
    come: () => tono(240, 0.05, "square", 0.07, 480),
    desliza: () => ruido(0.7, 0.09, 520),
    fanfarria: () => { const a = A(); if (a) a.playWin(); },
  };

  Kit.D = D;
  Kit.SFX = SFX;

  Kit.juego = function (cfg) {
    const W = cfg.canvas.w, H = cfg.canvas.h;
    const hz = cfg.hz || 120;
    const envioHz = cfg.envioHz || (cfg.continuo ? 60 : 12);
    const esperaFin = cfg.esperaFin ?? 0.9;

    // host
    let sim = null, bot = null, partida = 1, rev = { 1: false, 2: false }, ult2 = 0;
    let cambio = false, envAcc = 0, acc = 0;
    // ambos
    let v = null, rv = [false, false], vp = 0, evVisto = 0, gDesde = -1;
    // guest
    let seq = 0, pend = [], envAccG = 0;
    // ui
    let botones = [], nuevos = [];
    const suaves = new Map();
    const chispas = [];
    const avisos = [];
    let sacudida = 0, errorVisto = false;

    const J = {
      W, H, D, F, SFX,
      get rol() { return net.rol; },
      get esBot() { return net.esBot; },
      get v() { return v; },
      local: {},
      inp: {},
      ptr: { x: -1, y: -1, abajo: false },
      t: 0, dt: 1 / 60,
      // Accion discreta: el host la aplica directo; el guest la encola numerada.
      accion(a) {
        if (net.rol === 1) aplicar(1, a);
        else { pend.push({ s: ++seq, a }); envAccG = 1; }
      },
      // Boton dibujado; se clickea con el puntero (hit-test sobre el frame anterior).
      boton(x, y, w, h, texto, fn, o = {}) {
        const sobre = !o.off && dentro({ x, y, w, h }, J.ptr);
        const c = o.color ?? Kit.COL.acento;
        D.caja(x, y, w, h, {
          r: o.r ?? 8,
          fill: o.off ? (o.fill ?? "rgba(255,255,255,0.03)") : o.lleno ? c : (sobre ? "rgba(255,255,255,0.10)" : (o.fill ?? "rgba(255,255,255,0.05)")),
          stroke: o.off ? "rgba(255,255,255,0.08)" : (sobre || o.activo ? c : (o.borde ?? "rgba(255,255,255,0.18)")),
          lw: o.activo ? 2.5 : 1.5, glow: o.activo && !o.off ? c : null, blur: 10,
        });
        if (texto !== "" && texto !== null && texto !== undefined)
          D.txt(texto, x + w / 2, y + h / 2 + 1, {
            size: o.size ?? 15, f: o.f ?? "u", peso: o.peso ?? 700, max: w - 8,
            color: o.off ? "rgba(255,255,255,0.25)" : o.lleno ? (o.colorTxt ?? "#111") : (o.colorTxt ?? Kit.COL.texto),
          });
        nuevos.push({ x, y, w, h, fn, off: !!o.off, mudo: !!o.mudo });
        return sobre;
      },
      zona(x, y, w, h, fn, o = {}) {    // area clickeable invisible
        nuevos.push({ x, y, w, h, fn, off: !!o.off, mudo: o.mudo ?? true });
        return !o.off && dentro({ x, y, w, h }, J.ptr);
      },
      // Suavizado de posiciones en el guest (el host dibuja la verdad).
      s(k, x, umbral = 120) {
        if (net.rol === 1) return x;
        let c = suaves.get(k);
        if (c === undefined || Math.abs(x - c) > umbral) c = x;
        else c += (x - c) * (1 - Math.exp(-J.dt * 22));
        suaves.set(k, c);
        return c;
      },
      sa(k, a) {                        // idem para angulos
        if (net.rol === 1) return a;
        let c = suaves.get(k);
        if (c === undefined) c = a;
        let d = ((a - c + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        c += d * (1 - Math.exp(-J.dt * 22));
        suaves.set(k, c);
        return c;
      },
      chispas(x, y, color, n = 12, vel = 160, vida = 0.6, r = 2.5) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, s = vel * (0.3 + Math.random() * 0.7);
          chispas.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vida: vida * (0.6 + Math.random() * 0.4), max: vida, c: color, r });
        }
      },
      sacudir(p) { sacudida = Math.max(sacudida, p); },
      // Aviso flotante abajo al centro (pasa turno, punto, etc.).
      aviso(texto, color = Kit.COL.acento, dur = 2) { avisos.push({ texto, color, t0: J.t, dur }); if (avisos.length > 3) avisos.shift(); },
      sfx(n, ...x) { try { SFX[n] && SFX[n](...x); } catch (e) {} },
      nombre(j) { return j === net.rol ? "TÚ" : (net.esBot ? "BOT" : "RIVAL"); },
      color(j) { return j === 1 ? Kit.COL.p1 : Kit.COL.p2; },
      miColor() { return net.rol === 1 ? Kit.COL.p1 : Kit.COL.p2; },
    };

    const dentro = (b, p) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

    // ---------- host: aplicar acciones / revancha ----------
    function aplicar(j, a) {
      if (!sim || !a || typeof a !== "object") return;
      if (a.__rev) { pedirRev(j); return; }
      if (sim.ganador) return;
      try { sim.accion(j, a); } catch (e) {}
      cambio = true;
    }
    function pedirRev(j) {
      if (!sim || !sim.ganador) return;
      rev[j] = true;
      if (net.esBot) rev[2] = true;
      if (rev[1] && rev[2]) { partida++; nuevaPartida(); }
      cambio = true;
    }
    function nuevaPartida() {
      sim = new cfg.Sim({ partida });
      rev = { 1: false, 2: false };
      acc = 0; cambio = true; evVisto = 0; gDesde = -1;
      bot = net.esBot && typeof BOTS !== "undefined" && BOTS[cfg.id] ? BOTS[cfg.id].nuevo() : null;
      reiniciarLocal();
    }
    function reiniciarLocal() {
      J.local = cfg.local ? cfg.local() : {};
      J.inp = cfg.inp ? cfg.inp() : {};
      suaves.clear(); chispas.length = 0; avisos.length = 0;
    }
    const api2 = {
      accion: (a) => aplicar(2, a),
      input: (i) => { if (sim && !sim.ganador) sim.input(2, i); },
    };

    function enviarSnap() {
      if (net.esBot) return;
      net.enviar(JSON.stringify({ t: "e", v: sim.vista(2), a: ult2, r: [rev[1], rev[2]], p: partida }));
    }

    function procesarEventos(lista) {
      if (!lista) return;
      for (const e of lista) {
        if (e.id <= evVisto) continue;
        evVisto = e.id;
        if (e.tipo === "fin") {
          if (e.g === net.rol) J.sfx("fanfarria"); else if (e.g === 3) J.sfx("sonar"); else J.sfx("error");
        }
        if (cfg.evento) { try { cfg.evento(J, e); } catch (err) {} }
      }
    }

    // ---------- entrada ----------
    function xy(e) {
      const r = cv.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    }
    function pd(e) {
      const p = xy(e);
      J.ptr.x = p.x; J.ptr.y = p.y; J.ptr.abajo = true;
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      for (let i = botones.length - 1; i >= 0; i--) {
        const b = botones[i];
        if (!dentro(b, p)) continue;
        if (b.off) { J.sfx("error"); return; }
        if (!b.mudo) J.sfx("clic");
        if (b.fn) b.fn(p.x, p.y);
        if (!b.pasa) return;
      }
      if (cfg.puntero) cfg.puntero(J, "abajo", p.x, p.y, e);
    }
    function pm(e) {
      const p = xy(e);
      J.ptr.x = p.x; J.ptr.y = p.y;
      if (cfg.puntero) cfg.puntero(J, "mueve", p.x, p.y, e);
    }
    function pu(e) {
      const p = xy(e);
      J.ptr.abajo = false;
      if (cfg.puntero) cfg.puntero(J, "arriba", p.x, p.y, e);
    }
    function pl() { J.ptr.x = -1; J.ptr.y = -1; }
    function kd(e) {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (cfg.teclado && cfg.teclado(J, e, true)) e.preventDefault();
    }
    function ku(e) {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (cfg.teclado && cfg.teclado(J, e, false)) e.preventDefault();
    }
    function blur() { J.inp = cfg.inp ? cfg.inp() : {}; }
    const noMenu = (e) => e.preventDefault();
    function enganchar() {
      cv.addEventListener("pointerdown", pd);
      cv.addEventListener("pointermove", pm);
      cv.addEventListener("pointerup", pu);
      cv.addEventListener("pointercancel", pu);
      cv.addEventListener("pointerleave", pl);
      cv.addEventListener("contextmenu", noMenu);
      addEventListener("keydown", kd);
      addEventListener("keyup", ku);
      addEventListener("blur", blur);
      cv.style.touchAction = "none";
      if (cfg.alIniciar) cfg.alIniciar(J);
    }
    function soltar() {
      cv.removeEventListener("pointerdown", pd);
      cv.removeEventListener("pointermove", pm);
      cv.removeEventListener("pointerup", pu);
      cv.removeEventListener("pointercancel", pu);
      cv.removeEventListener("pointerleave", pl);
      cv.removeEventListener("contextmenu", noMenu);
      removeEventListener("keydown", kd);
      removeEventListener("keyup", ku);
      removeEventListener("blur", blur);
      cv.style.touchAction = "";
      cv.style.cursor = "";
      if (cfg.alDestruir) cfg.alDestruir(J);
    }

    // ---------- render ----------
    function pintar() {
      nuevos = [];
      ctx.save();
      if (sacudida > 0.4) {
        ctx.translate((Math.random() - 0.5) * sacudida, (Math.random() - 0.5) * sacudida);
        sacudida *= Math.pow(0.004, J.dt);
      } else sacudida = 0;
      ctx.fillStyle = cfg.fondo || Kit.COL.fondo;
      ctx.fillRect(-20, -20, W + 40, H + 40);
      if (!v) D.txt("Sincronizando…", W / 2, H / 2, { size: 18, color: Kit.COL.tenue, f: "o" });
      else {
        try { cfg.pintar(J, v); }
        catch (err) { if (!errorVisto) { errorVisto = true; console.error("[" + cfg.id + "]", err); } }
      }
      // chispas encima de todo
      if (chispas.length) {
        ctx.globalCompositeOperation = "lighter";
        for (let i = chispas.length - 1; i >= 0; i--) {
          const p = chispas[i];
          p.vida -= J.dt;
          if (p.vida <= 0) { chispas.splice(i, 1); continue; }
          p.x += p.vx * J.dt; p.y += p.vy * J.dt;
          p.vx *= Math.pow(0.15, J.dt); p.vy *= Math.pow(0.15, J.dt);
          ctx.globalAlpha = Math.max(0, p.vida / p.max);
          ctx.fillStyle = p.c;
          ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
      // avisos (el mas nuevo abajo)
      for (let i = avisos.length - 1, k = 0; i >= 0; i--, k++) {
        const a = avisos[i], e = J.t - a.t0;
        if (e > a.dur) { avisos.splice(i, 1); continue; }
        const al = Math.min(1, e * 6, (a.dur - e) * 3);
        const w = D.ancho(a.texto, 16, "u", 700) + 36, y = H - (cfg.avisoY ?? 46) - k * 40;
        ctx.globalAlpha = al;
        D.caja(W / 2 - w / 2, y - 16, w, 32, { r: 16, fill: "rgba(10,12,18,0.88)", stroke: a.color, lw: 1.5 });
        D.txt(a.texto, W / 2, y + 1, { size: 16, color: a.color });
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      botones = nuevos;
      const sobre = botones.some((b) => !b.off && b.fn && dentro(b, J.ptr));
      cv.style.cursor = sobre ? "pointer" : (typeof cfg.cursor === "function" ? cfg.cursor(J) : cfg.cursor || "default");
    }

    JUEGOS[cfg.id] = {
      nombre: cfg.nombre, desc: cfg.desc, ayuda: cfg.ayuda, meta: cfg.meta, tipo: cfg.tipo,
      canvas: { w: W, h: H },
      get sim() { return sim; },

      iniciarHost() {
        partida = 1; ult2 = 0; v = null; rv = [false, false]; errorVisto = false;
        nuevaPartida();
        v = sim.vista(1);
        enganchar();
      },
      iniciarGuest() {
        sim = null; bot = null; v = null; vp = 0; seq = 0; pend = []; rv = [false, false];
        evVisto = 0; gDesde = -1; errorVisto = false;
        reiniciarLocal();
        enganchar();
      },
      destruir() { soltar(); sim = null; bot = null; v = null; pend = []; },

      onData(m) {
        if (!m || typeof m !== "object") return;
        if (net.rol === 1) {
          if (!sim || m.t !== "c") return;
          if (cfg.continuo && m.i && typeof m.i === "object" && !sim.ganador) sim.input(2, m.i);
          if (Array.isArray(m.l)) {
            for (const x of m.l) {
              if (!x || !Number.isInteger(x.s) || x.s <= ult2) continue;
              if (x.s !== ult2 + 1) break;
              ult2 = x.s;
              aplicar(2, x.a);
            }
          }
        } else if (m.t === "e" && m.v) {
          if (m.p !== vp) { vp = m.p; evVisto = 0; gDesde = -1; reiniciarLocal(); }
          v = m.v; rv = m.r || [false, false];
          if (pend.length) pend = pend.filter((x) => x.s > m.a);
        }
      },

      botStep(dt) {
        if (net.rol === 1 && sim && bot && !sim.ganador) {
          try { bot.step(sim.vista(2), api2, dt); } catch (e) { if (!errorVisto) { errorVisto = true; console.error("[bot " + cfg.id + "]", e); } }
        }
      },

      frame(now, dt, pausado) {
        J.t = now / 1000; J.dt = dt;
        if (net.rol === 1 && sim) {
          if (!pausado) {
            if (cfg.continuo && !sim.ganador) sim.input(1, J.inp);
            if (sim.step) {
              acc += dt;
              const paso = 1 / hz;
              let k = 0;
              while (acc >= paso && k < 40) { sim.step(paso); acc -= paso; k++; }
              if (k >= 40) acc = 0;
            }
          }
          envAcc += dt;
          if (cambio || envAcc >= 1 / envioHz) { envAcc = 0; cambio = false; enviarSnap(); }
          v = sim.vista(1);
          rv = [rev[1], rev[2]];
        } else if (net.rol === 2) {
          envAccG += dt;
          if (!pausado && (cfg.continuo || (pend.length && envAccG >= 0.06))) {
            envAccG = 0;
            net.enviar(JSON.stringify({ t: "c", i: cfg.continuo ? J.inp : undefined, l: pend.length ? pend : undefined }));
          }
        }
        if (v) {
          procesarEventos(v.ev);
          if (v.g && gDesde < 0) gDesde = J.t;
          if (!v.g) gDesde = -1;
        }
        pintar();
      },

      overlay() {
        if (!v || !v.g || gDesde < 0 || J.t - gDesde < esperaFin) return null;
        const yo = rv[net.rol - 1];
        const o = cfg.textoFin ? cfg.textoFin(J, v, v.g) || {} : {};
        return {
          texto: o.texto ?? (v.g === 3 ? "EMPATE" : v.g === net.rol ? "GANASTE" : "PERDISTE"),
          sub: yo ? "Esperando al rival…" : (o.sub ?? ""),
          revancha: true, revanchaPedida: yo,
        };
      },
      revancha() { J.accion({ __rev: true }); },
    };
    return J;
  };
})();
