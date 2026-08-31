// ==========================================================================
//  Modulo de juego: PONG
//  Netcode: paso fijo 120 Hz, snapshots binarios (31 B), canal no confiable,
//  autoridad de cliente sobre la pala propia (0 ms) + limite de velocidad en
//  el host, interpolacion adaptativa de la pala rival y dead-reckoning de la
//  pelota. Usa los globales del shell: cv, ctx, net.
// ==========================================================================
(function () {
  const INTERP_MIN = 35, INTERP_MAX = 140;

  // ---- codec binario ----
  const B_SNAP = 1, B_PALA = 2;
  const _sAB = new ArrayBuffer(31), _sV = new DataView(_sAB);
  const _pAB = new ArrayBuffer(7), _pV = new DataView(_pAB);
  function encSnap(s) {
    const v = _sV;
    v.setUint8(0, B_SNAP); v.setUint16(1, s.seq, true);
    v.setFloat32(3, s.bx, true); v.setFloat32(7, s.by, true);
    v.setFloat32(11, s.bvx, true); v.setFloat32(15, s.bvy, true);
    v.setFloat32(19, s.p1, true); v.setFloat32(23, s.p2, true);
    v.setUint8(27, s.s1); v.setUint8(28, s.s2);
    let f = 0;
    if (s.sirviendo) f |= 1;
    if (s.ganador) { f |= 2; if (s.ganador === 2) f |= 4; }
    if (s.rev1) f |= 32; if (s.rev2) f |= 64;
    v.setUint8(29, f); v.setUint8(30, s.cuenta);
    return _sAB.slice(0);
  }
  function decSnap(v) {
    const f = v.getUint8(29);
    return {
      seq: v.getUint16(1, true),
      bx: v.getFloat32(3, true), by: v.getFloat32(7, true),
      bvx: v.getFloat32(11, true), bvy: v.getFloat32(15, true),
      p1: v.getFloat32(19, true), p2: v.getFloat32(23, true),
      s1: v.getUint8(27), s2: v.getUint8(28),
      sirviendo: !!(f & 1), ganador: (f & 2) ? ((f & 4) ? 2 : 1) : 0,
      rev1: !!(f & 32), rev2: !!(f & 64), cuenta: v.getUint8(30),
    };
  }
  function encPala(seq, y) {
    _pV.setUint8(0, B_PALA); _pV.setUint16(1, seq & 0xffff, true); _pV.setFloat32(3, y, true);
    return _pAB.slice(0);
  }
  function comoView(d) {
    if (d instanceof ArrayBuffer) return d.byteLength ? new DataView(d) : null;
    if (ArrayBuffer.isView(d)) return new DataView(d.buffer, d.byteOffset, d.byteLength);
    return null;
  }
  const seqNuevo = (n, v) => { const d = (n - v) & 0xffff; return d !== 0 && d < 0x8000; };
  const CY = () => (PONG.CAMPO_H - PONG.PALA_H) / 2;

  // ---- estado del modulo ----
  let sim = null;                  // host
  let hAcc = 0, hSend = 0, hLast = 0, palaTs = 0, palaSeqRx = -1;
  const ent = { arriba: false, abajo: false };
  const G = {                      // guest
    buf: [], last: null, lastSeq: -1, stampPrev: 0,
    interArr: 16.7, jitter: 4, interp: 70,
    predP2: 0, ball: { x: 0, y: 0, vx: 0, vy: 0, stamp: 0 }, err: { x: 0, y: 0 },
    vistaP1: 0, palaSeq: 0, palaAcc: 0,
  };

  function tecla(e, v) {
    const k = e.key.toLowerCase();
    if (k === "arrowup" || k === "w") ent.arriba = v;
    else if (k === "arrowdown" || k === "s") ent.abajo = v;
    if (k === "arrowup" || k === "arrowdown") e.preventDefault();
  }
  const kd = (e) => tecla(e, true), ku = (e) => tecla(e, false);
  const blur = () => { ent.arriba = ent.abajo = false; };

  function engancharTeclado() {
    addEventListener("keydown", kd); addEventListener("keyup", ku); addEventListener("blur", blur);
  }
  function soltarTeclado() {
    removeEventListener("keydown", kd); removeEventListener("keyup", ku); removeEventListener("blur", blur);
  }

  function extrapBola(a, dt) {
    dt = clamp(dt, 0, 0.25);
    let x = a.x + a.vx * dt, y = a.y + a.vy * dt;
    for (let i = 0; i < 4; i++) {
      if (y - PONG.BOLA_R < 0) y = 2 * PONG.BOLA_R - y;
      else if (y + PONG.BOLA_R > PONG.CAMPO_H) y = 2 * (PONG.CAMPO_H - PONG.BOLA_R) - y;
      else break;
    }
    return { x, y };
  }
  function interpP1(rt) {
    const b = G.buf;
    if (!b.length) return G.vistaP1;
    if (rt <= b[0].stamp) return b[0].p1;
    for (let i = 0; i < b.length - 1; i++)
      if (rt <= b[i + 1].stamp) {
        const t = (rt - b[i].stamp) / (b[i + 1].stamp - b[i].stamp || 1);
        return b[i].p1 + (b[i + 1].p1 - b[i].p1) * t;
      }
    return b[b.length - 1].p1;
  }

  JUEGOS.pong = {
    nombre: "Pong",
    desc: "Clásico. Primero a 5. W/S o flechas.",
    canvas: { w: PONG.CAMPO_W, h: PONG.CAMPO_H },

    iniciarHost() {
      sim = new PongSim();
      hAcc = 0; hSend = 0; hLast = performance.now(); palaTs = performance.now(); palaSeqRx = -1;
      engancharTeclado();
    },
    iniciarGuest() {
      sim = null;
      Object.assign(G, {
        buf: [], last: null, lastSeq: -1, stampPrev: 0, interArr: 16.7, jitter: 4, interp: 70,
        predP2: CY(), ball: { x: PONG.CAMPO_W / 2, y: PONG.CAMPO_H / 2, vx: 0, vy: 0, stamp: performance.now() },
        err: { x: 0, y: 0 }, vistaP1: CY(), palaSeq: 0, palaAcc: 0,
      });
      engancharTeclado();
    },
    destruir() { soltarTeclado(); sim = null; G.last = null; G.buf = []; },

    onData(m) {
      if (net.rol === 1) {                       // HOST recibe del guest
        const v = comoView(m);
        if (v) {
          if (v.getUint8(0) !== B_PALA || !sim) return;
          const seq = v.getUint16(1, true);
          if (palaSeqRx >= 0 && !seqNuevo(seq, palaSeqRx)) return;
          palaSeqRx = seq;
          const now = performance.now();
          sim.aplicarPala2(v.getFloat32(3, true), (now - palaTs) / 1000);
          palaTs = now;
          return;
        }
        if (m && m.t === "rev") sim.pedirRevancha(2);
      } else {                                   // GUEST recibe del host
        const v = comoView(m);
        if (!v || v.getUint8(0) !== B_SNAP) return;
        const s = decSnap(v);
        if (G.lastSeq >= 0 && !seqNuevo(s.seq, G.lastSeq)) return;
        const now = performance.now();
        if (G.last) {
          const ia = now - G.stampPrev;
          G.interArr += (ia - G.interArr) * 0.1;
          G.jitter += (Math.abs(ia - G.interArr) - G.jitter) * 0.1;
          G.interp = clamp(G.interArr + G.jitter * 2.5, INTERP_MIN, INTERP_MAX);
        }
        G.stampPrev = now; G.lastSeq = s.seq; G.last = s;
        G.buf.push({ stamp: now, p1: s.p1 });
        if (G.buf.length > 16) G.buf.shift();
        const proj = extrapBola(G.ball, (now - G.ball.stamp) / 1000);
        G.err.x = (proj.x + G.err.x) - s.bx;
        G.err.y = (proj.y + G.err.y) - s.by;
        G.ball = { x: s.bx, y: s.by, vx: s.bvx, vy: s.bvy, stamp: now };
        if (Math.hypot(G.err.x, G.err.y) > 260) { G.err.x = 0; G.err.y = 0; }
        if (Math.abs(s.p2 - G.predP2) > 55) G.predP2 = s.p2;
      }
    },

    frame(now, dt, pausado) {
      let p1, p2, bx, by, s1 = 0, s2 = 0, sirviendo = false, cuenta = 0, ganador = 0;

      if (net.rol === 1 && sim) {
        if (!pausado) {
          let d = now - hLast; if (!(d > 0)) d = 16.7; if (d > 250) d = 250;
          hLast = now; hAcc += d; hSend += d;
          sim.dir1 = (ent.abajo ? 1 : 0) - (ent.arriba ? 1 : 0);
          const paso = 1000 / PONG.SIM_HZ;
          let k = 0;
          while (hAcc >= paso && k < 16) { sim.step(paso / 1000); hAcc -= paso; k++; }
        } else { hLast = now; }
        if (hSend >= 1000 / PONG.SEND_HZ) { hSend = 0; net.enviar(encSnap(sim.snapshot())); }
        p1 = sim.pala[1]; p2 = sim.pala[2];
        bx = sim.bola.x; by = sim.bola.y;
        s1 = sim.puntos[1]; s2 = sim.puntos[2];
        sirviendo = sim.sirviendo; cuenta = sirviendo ? Math.max(0, Math.ceil(sim.sirveMs / 1000)) : 0;
        ganador = sim.ganador;
      } else if (net.rol === 2 && G.last) {
        const dir = (ent.abajo ? 1 : 0) - (ent.arriba ? 1 : 0);
        if (!pausado && !G.last.ganador)
          G.predP2 = clamp(G.predP2 + dir * PONG.PALA_VEL * dt, 0, PONG.CAMPO_H - PONG.PALA_H);
        p2 = G.predP2;
        G.vistaP1 = interpP1(now - G.interp); p1 = G.vistaP1;
        const proj = extrapBola(G.ball, (now - G.ball.stamp) / 1000);
        const kk = Math.pow(0.002, dt); G.err.x *= kk; G.err.y *= kk;
        bx = proj.x + G.err.x; by = proj.y + G.err.y;
        s1 = G.last.s1; s2 = G.last.s2;
        sirviendo = G.last.sirviendo; cuenta = G.last.cuenta; ganador = G.last.ganador;
        G.palaAcc += dt * 1000;
        const cada = dir !== 0 ? 1000 / PONG.SEND_HZ : 80;
        if (G.palaAcc >= cada) { G.palaAcc = 0; net.enviar(encPala(++G.palaSeq, G.predP2)); }
      } else {
        p1 = p2 = CY(); bx = PONG.CAMPO_W / 2; by = PONG.CAMPO_H / 2;
      }

      // ---- pintar ----
      const W = PONG.CAMPO_W, H = PONG.CAMPO_H, R = Math.round;
      ctx.fillStyle = "#05070b"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#202733"; ctx.setLineDash([10, 14]); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#e8ecf1"; ctx.font = "bold 48px ui-monospace, monospace"; ctx.textAlign = "center";
      ctx.fillText(s1, W / 2 - 64, 62); ctx.fillText(s2, W / 2 + 64, 62);
      ctx.fillStyle = net.rol === 1 ? "#5be0e0" : "#2f7d7d";
      ctx.fillRect(PONG.PALA_MARGEN, R(p1), PONG.PALA_W, PONG.PALA_H);
      ctx.fillStyle = net.rol === 2 ? "#e05be0" : "#7d2f7d";
      ctx.fillRect(W - PONG.PALA_MARGEN - PONG.PALA_W, R(p2), PONG.PALA_W, PONG.PALA_H);
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(R(bx), R(by), PONG.BOLA_R, 0, 6.2832); ctx.fill();
      if (sirviendo && cuenta > 0 && !pausado && !ganador) {
        ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.font = "bold 92px ui-monospace, monospace";
        ctx.fillText(cuenta, W / 2, H / 2 + 32);
      }
    },

    overlay() {
      let g = 0, s1 = 0, s2 = 0, yo = false;
      if (net.rol === 1 && sim) { g = sim.ganador; s1 = sim.puntos[1]; s2 = sim.puntos[2]; yo = sim.revancha[1]; }
      else if (G.last) { g = G.last.ganador; s1 = G.last.s1; s2 = G.last.s2; yo = G.last.rev2; }
      if (!g) return null;
      return {
        texto: g === net.rol ? "GANASTE 🏆" : "PERDISTE",
        sub: yo ? "Esperando al rival…" : "Marcador " + s1 + " - " + s2,
        revancha: true, revanchaPedida: yo,
      };
    },
    revancha() {
      if (net.rol === 1 && sim) sim.pedirRevancha(1);
      else net.enviar(JSON.stringify({ t: "rev" }));
    },
  };
})();
