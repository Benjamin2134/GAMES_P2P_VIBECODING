// ==========================================================================
//  Modulo de juego: SPACEWAR 1979  (JUEGOS.spacewar)
//  Base: PR de @777.dub. Adaptado al shell: loop por rAF (frame), prediccion
//  de tu propia nave, interpolacion de la rival, dead-reckoning de balas,
//  sonido con RetroAudio. Usa los globales del shell: cv, ctx, net.
// ==========================================================================
(function () {
  let sim = null;                     // host
  let hAcc = 0, hSend = 0, hLast = 0;
  let snap = null, snapStamp = 0;     // guest
  const ent = { rot: 0, izq: false, der: false, thrust: false, fire: false };
  let laserPrev = false, thrustPrev = false, ganadorPrev = 0;

  const G = {
    predN2: null,                     // prediccion de tu nave (guest = jugador 2)
    vistaN1: null,                    // interpolacion de la nave rival
  };
  const particulas = [];

  // ---------- teclado ----------
  function tecla(e, v) {
    const k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a") ent.izq = v;
    else if (k === "arrowright" || k === "d") ent.der = v;
    else if (k === "arrowup" || k === "w") ent.thrust = v;
    else if (k === " " || k === "spacebar") { ent.fire = v; e.preventDefault(); }
    else return;
    ent.rot = (ent.der ? 1 : 0) - (ent.izq ? 1 : 0);
    if (k.startsWith("arrow")) e.preventDefault();
  }
  const kd = (e) => tecla(e, true), ku = (e) => tecla(e, false);
  const blur = () => { ent.izq = ent.der = ent.thrust = ent.fire = false; ent.rot = 0; RetroAudio.stopThrust(); };
  function enganchar() { addEventListener("keydown", kd); addEventListener("keyup", ku); addEventListener("blur", blur); }
  function soltar() { removeEventListener("keydown", kd); removeEventListener("keyup", ku); removeEventListener("blur", blur); RetroAudio.stopThrust(); }

  // ---------- fisica local (para predecir tu nave) ----------
  function integrarNave(n, inp, dt) {
    n.ang = (n.ang + inp.rot * SW.ROT_VEL * dt + Math.PI * 2) % (Math.PI * 2);
    if (inp.thrust) {
      n.vx += Math.cos(n.ang) * SW.THRUST * dt;
      n.vy += Math.sin(n.ang) * SW.THRUST * dt;
      const sp = Math.hypot(n.vx, n.vy);
      if (sp > SW.VEL_MAX) { n.vx = n.vx / sp * SW.VEL_MAX; n.vy = n.vy / sp * SW.VEL_MAX; }
    }
    const f = Math.pow(SW.FRICC, dt * 120);
    n.vx *= f; n.vy *= f;
    n.x = (n.x + n.vx * dt + SW.W) % SW.W;
    n.y = (n.y + n.vy * dt + SW.H) % SW.H;
  }
  const angLerp = (a, b, t) => {
    let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
  };
  const wrapDelta = (a, b, tam) => {
    let d = b - a;
    if (d > tam / 2) d -= tam; else if (d < -tam / 2) d += tam;
    return d;
  };

  function explotar(x, y, c) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * 6.283, s = 40 + Math.random() * 130;
      particulas.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vida: 0.5 + Math.random() * 0.4, c });
    }
  }

  function sonidosLocales() {
    if (ent.fire && !laserPrev) RetroAudio.playLaser();
    laserPrev = ent.fire;
    if (ent.thrust && !thrustPrev) RetroAudio.startThrust();
    else if (!ent.thrust && thrustPrev) RetroAudio.stopThrust();
    thrustPrev = ent.thrust;
  }

  JUEGOS.spacewar = {
    nombre: "Spacewar 1979",
    desc: "Duelo de naves con inercia. Girá, empujá, dispará. Primero en quedarse sin vidas pierde.",
    canvas: { w: SW.W, h: SW.H },

    iniciarHost() { sim = new SpacewarSim(); hAcc = 0; hSend = 0; hLast = performance.now(); ganadorPrev = 0; enganchar(); },
    iniciarGuest() {
      sim = null; snap = null;
      G.predN2 = { x: SW.W * 0.8, y: SW.H * 0.5, ang: Math.PI, vx: 0, vy: 0 };
      G.vistaN1 = { x: SW.W * 0.2, y: SW.H * 0.5, ang: 0 };
      ganadorPrev = 0;
      enganchar();
    },
    destruir() { soltar(); sim = null; snap = null; particulas.length = 0; },

    onData(m) {
      if (net.rol === 1) {
        if (!m || !sim) return;
        if (m.t === "in") sim.aplicarInputGuest(m);
        else if (m.t === "rev") sim.pedirRevancha(2);
      } else if (m && m.t === "e") {
        snap = m; snapStamp = performance.now();
        if (m.expl) for (const e of m.expl) { explotar(e.x, e.y, e.c); RetroAudio.playExplosion(); }
      }
    },

    frame(now, dt, pausado) {
      sonidosLocales();

      // ---------- HOST ----------
      if (net.rol === 1 && sim) {
        if (!pausado) {
          let d = now - hLast; if (!(d > 0)) d = 16.7; if (d > 250) d = 250;
          hLast = now;
          hAcc += d;
          sim.aplicarInputHost(ent);
          const paso = 1000 / SW.SIM_HZ;
          let k = 0;
          while (hAcc >= paso && k < 16) { sim.step(paso / 1000); hAcc -= paso; k++; }
        } else hLast = now;

        const s = sim.snapshot();               // vacia sim.expl -> s.expl
        if (s.expl) { for (const e of s.expl) explotar(e.x, e.y, e.c); RetroAudio.playExplosion(); }
        net.enviar(JSON.stringify(s));           // spacewar: snapshot cada frame (~400 B, trivial)
        pintar(s, 1);
        if (s.ganador && !ganadorPrev && s.ganador === 1) RetroAudio.playWin();
        ganadorPrev = s.ganador;
        return;
      }

      // ---------- GUEST ----------
      if (net.rol === 2) {
        if (!pausado) net.enviar(JSON.stringify({ t: "in", rot: ent.rot, thrust: ent.thrust, fire: ent.fire }));
        if (!snap) { pintar(null, 2); return; }

        // prediccion de tu nave (jugador 2): posicion Y angulo locales
        if (!pausado && !snap.ganador && snap.n2.vv) {
          integrarNave(G.predN2, ent, dt);
          const dx = wrapDelta(G.predN2.x, snap.n2.x, SW.W);
          const dy = wrapDelta(G.predN2.y, snap.n2.y, SW.H);
          if (Math.hypot(dx, dy) > 60) {
            G.predN2.x = snap.n2.x; G.predN2.y = snap.n2.y;
            G.predN2.vx = snap.n2.vx; G.predN2.vy = snap.n2.vy; G.predN2.ang = snap.n2.ang;
          } else {
            G.predN2.x = (G.predN2.x + dx * 0.12 + SW.W) % SW.W;
            G.predN2.y = (G.predN2.y + dy * 0.12 + SW.H) % SW.H;
          }
        } else {
          G.predN2.x = snap.n2.x; G.predN2.y = snap.n2.y; G.predN2.ang = snap.n2.ang;
          G.predN2.vx = snap.n2.vx; G.predN2.vy = snap.n2.vy;
        }

        // interpolacion de la nave rival (jugador 1)
        const kx = wrapDelta(G.vistaN1.x, snap.n1.x, SW.W);
        const ky = wrapDelta(G.vistaN1.y, snap.n1.y, SW.H);
        G.vistaN1.x = (G.vistaN1.x + kx * 0.35 + SW.W) % SW.W;
        G.vistaN1.y = (G.vistaN1.y + ky * 0.35 + SW.H) % SW.H;
        G.vistaN1.ang = angLerp(G.vistaN1.ang, snap.n1.ang, 0.4);

        const edad = (now - snapStamp) / 1000;
        const vista = {
          ...snap,
          n1: { ...snap.n1, x: G.vistaN1.x, y: G.vistaN1.y, ang: G.vistaN1.ang },
          n2: { ...snap.n2, x: G.predN2.x, y: G.predN2.y, ang: G.predN2.ang },
          b: snap.b.map(([x, y, vx, vy, d]) => [
            (x + vx * edad + SW.W) % SW.W, (y + vy * edad + SW.H) % SW.H, vx, vy, d,
          ]),
        };
        pintar(vista, 2);
        if (snap.ganador && !ganadorPrev && snap.ganador === 2) RetroAudio.playWin();
        ganadorPrev = snap.ganador;
      }
    },

    overlay() {
      const g = net.rol === 1 && sim ? sim.ganador : (snap && snap.ganador);
      if (!g) return null;
      const yo = net.rol === 1 && sim ? sim.revancha[1] : (snap && (net.rol === 1 ? snap.rev1 : snap.rev2));
      return {
        texto: g === net.rol ? "GANASTE 🚀" : "PERDISTE",
        sub: yo ? "Esperando al rival…" : "Se quedó sin naves",
        revancha: true, revanchaPedida: yo,
      };
    },
    revancha() {
      if (net.rol === 1 && sim) sim.pedirRevancha(1);
      else net.enviar(JSON.stringify({ t: "rev" }));
    },
  };

  // ---------- render ----------
  function nave(x, y, ang, color, thrust, invuln) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    if (invuln) {
      ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, SW.NAVE_R + 6, 0, 6.2832); ctx.stroke();
    }
    ctx.strokeStyle = color; ctx.fillStyle = "#050805"; ctx.lineWidth = 2;
    ctx.shadowColor = color; ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(SW.NAVE_R + 4, 0);
    ctx.lineTo(-SW.NAVE_R, -SW.NAVE_R * 0.75);
    ctx.lineTo(-SW.NAVE_R * 0.4, 0);
    ctx.lineTo(-SW.NAVE_R, SW.NAVE_R * 0.75);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (thrust) {
      ctx.strokeStyle = "#ff4400";
      ctx.beginPath();
      ctx.moveTo(-SW.NAVE_R * 0.4, -4);
      ctx.lineTo(-SW.NAVE_R * 0.4 - (6 + Math.random() * 8), 0);
      ctx.lineTo(-SW.NAVE_R * 0.4, 4);
      ctx.stroke();
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  function pintar(s, miNum) {
    ctx.fillStyle = "#030603"; ctx.fillRect(0, 0, SW.W, SW.H);
    ctx.strokeStyle = "rgba(57,255,20,0.05)"; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x < SW.W; x += 80) { ctx.moveTo(x, 0); ctx.lineTo(x, SW.H); }
    for (let y = 0; y < SW.H; y += 80) { ctx.moveTo(0, y); ctx.lineTo(SW.W, y); }
    ctx.stroke();

    // particulas de explosion (locales)
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= 0.016; if (p.vida <= 0) { particulas.splice(i, 1); continue; }
      p.x += p.vx * 0.016; p.y += p.vy * 0.016;
      ctx.globalAlpha = Math.max(0, p.vida);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;

    if (!s) {
      ctx.fillStyle = "#39ff14"; ctx.font = "15px ui-monospace, monospace"; ctx.textAlign = "center";
      ctx.fillText("Sincronizando naves…", SW.W / 2, SW.H / 2);
      return;
    }

    for (const [x, y, , , d] of s.b) {
      ctx.fillStyle = d === 1 ? SW.COL_P1 : SW.COL_P2;
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(x, y, SW.BALA_R, 0, 6.2832); ctx.fill();
    }
    ctx.shadowBlur = 0;

    if (s.n1.vv) nave(s.n1.x, s.n1.y, s.n1.ang, SW.COL_P1, s.n1.th, s.n1.iv);
    if (s.n2.vv) nave(s.n2.x, s.n2.y, s.n2.ang, SW.COL_P2, s.n2.th, s.n2.iv);

    ctx.font = "bold 15px ui-monospace, monospace"; ctx.textAlign = "left";
    ctx.fillStyle = SW.COL_P1;
    ctx.fillText((miNum === 1 ? "VOS ▸ " : "") + "P1 " + "▲".repeat(Math.max(0, s.n1.vd)), 20, 26);
    ctx.textAlign = "right";
    ctx.fillStyle = SW.COL_P2;
    ctx.fillText("P2 " + "▲".repeat(Math.max(0, s.n2.vd)) + (miNum === 2 ? " ◂ VOS" : ""), SW.W - 20, 26);
    ctx.textAlign = "left";
  }
})();
