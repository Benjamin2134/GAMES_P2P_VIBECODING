// ==========================================================================
//  Modulo de juego: BILLAR (8-ball)
//  Turn-based, host autoritativo. El que tiene el turno apunta con el mouse
//  (o flechas), carga potencia manteniendo apretado y suelta para tirar.
//  Falta -> el rival pone la blanca donde quiera (click). Snapshots JSON.
//  Usa los globales del shell: cv, ctx, net.
// ==========================================================================
(function () {
  const COLS = {
    0: "#f6f6f0", 1: "#f4c430", 2: "#2660c4", 3: "#d02f2f", 4: "#7a3fb0",
    5: "#e07b1f", 6: "#1f9e56", 7: "#8a2b2b", 8: "#141414",
    9: "#f4c430", 10: "#2660c4", 11: "#d02f2f", 12: "#7a3fb0", 13: "#e07b1f", 14: "#1f9e56", 15: "#8a2b2b",
  };
  const CARGA_S = 1.3;            // seg para cargar potencia de 0 a 1

  let sim = null;                 // host
  let hAcc = 0, hSend = 0, hLast = 0;
  let snap = null;                // guest: ultimo snapshot
  const vista = {};               // guest: posiciones suavizadas  n -> {x,y}
  const M = {                     // input local
    mx: BILLAR.W / 2, my: BILLAR.H / 2, dentroCanvas: false,
    ang: 0, pot: 0, cargando: false,
    dispHasta: 0,                 // guest: reenviar "disparo" hasta este ts
    manoHasta: 0, manoXY: null,   // guest: reenviar "bola en mano"
    revHasta: 0,
  };

  // ---- coords del mouse en el sistema logico ----
  function actualizarMouse(e) {
    const r = cv.getBoundingClientRect();
    M.mx = clamp((e.clientX - r.left) / r.width * BILLAR.W, 0, BILLAR.W);
    M.my = clamp((e.clientY - r.top) / r.height * BILLAR.H, 0, BILLAR.H);
    M.dentroCanvas = true;
  }
  function cueXY() {
    if (net.rol === 1 && sim) { const c = sim._b(0); return c && c.dentro ? c : { x: BILLAR.W / 2, y: BILLAR.H / 2 }; }
    if (snap) { const c = snap.b.find((b) => b[0] === 0); if (c) return { x: c[1], y: c[2] }; }
    return { x: BILLAR.W / 2, y: BILLAR.H / 2 };
  }
  function miTurno() {
    const turno = net.rol === 1 && sim ? sim.turno : (snap && snap.turno);
    return turno === net.rol;
  }
  function faseActual() { return net.rol === 1 && sim ? sim.fase : (snap && snap.fase); }

  // ---- eventos ----
  function onMove(e) {
    actualizarMouse(e);
    const c = cueXY();
    if (faseActual() === "apuntando" && miTurno()) M.ang = Math.atan2(M.my - c.y, M.mx - c.x);
  }
  function onDown(e) {
    actualizarMouse(e);
    const fase = faseActual();
    if (!miTurno()) return;
    if (fase === "manoLibre") {
      const x = clamp(M.mx, BILLAR.X0 + BILLAR.R, BILLAR.X1 - BILLAR.R);
      const y = clamp(M.my, BILLAR.Y0 + BILLAR.R, BILLAR.Y1 - BILLAR.R);
      if (net.rol === 1) sim.manoLibre(1, x, y);
      else { M.manoXY = { x, y }; M.manoHasta = performance.now() + 900; }
    } else if (fase === "apuntando") {
      M.cargando = true; M.pot = 0;
    }
  }
  function onUp() {
    if (M.cargando) {
      M.cargando = false;
      const pot = M.pot; M.pot = 0;
      if (pot >= 0.03) {
        if (net.rol === 1 && sim) { sim.apuntar(1, M.ang, pot); sim.tirar(1); }
        else { M._potDisparo = pot; M.dispHasta = performance.now() + 1000; }
      }
    }
  }
  function onLeave() { M.dentroCanvas = false; }
  function onKey(e) {
    if (!miTurno() || faseActual() !== "apuntando") return;
    const k = e.key;
    if (k === "ArrowLeft") M.ang -= 0.02;
    else if (k === "ArrowRight") M.ang += 0.02;
    else if (k === "ArrowUp") M.pot = clamp(M.pot + 0.04, 0, 1);
    else if (k === "ArrowDown") M.pot = clamp(M.pot - 0.04, 0, 1);
    else if (k === " ") {
      e.preventDefault();
      const pot = M.pot > 0.03 ? M.pot : 0.5;
      if (net.rol === 1 && sim) { sim.apuntar(1, M.ang, pot); sim.tirar(1); }
      else { M._potDisparo = pot; M.dispHasta = performance.now() + 1000; }
      M.pot = 0;
    } else return;
    if (k.startsWith("Arrow")) e.preventDefault();
  }

  function enganchar() {
    cv.addEventListener("mousemove", onMove);
    cv.addEventListener("mousedown", onDown);
    addEventListener("mouseup", onUp);
    cv.addEventListener("mouseleave", onLeave);
    addEventListener("keydown", onKey);
  }
  function soltar() {
    cv.removeEventListener("mousemove", onMove);
    cv.removeEventListener("mousedown", onDown);
    removeEventListener("mouseup", onUp);
    cv.removeEventListener("mouseleave", onLeave);
    removeEventListener("keydown", onKey);
  }

  // ---- raycast simple para la linea de puntería ----
  function proyectar(x, y, ang) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let mejor = 900;
    const bolas = net.rol === 1 && sim
      ? sim.bolas.filter((b) => b.dentro && b.n !== 0).map((b) => [b.x, b.y])
      : (snap ? snap.b.filter((b) => b[0] !== 0).map((b) => [b[1], b[2]]) : []);
    for (const [bxp, byp] of bolas) {
      const t = (bxp - x) * dx + (byp - y) * dy;
      if (t <= 0) continue;
      const px = x + dx * t, py = y + dy * t;
      const dd = Math.hypot(px - bxp, py - byp);
      if (dd < BILLAR.R * 2) {
        const back = Math.sqrt(Math.max(0, (BILLAR.R * 2) ** 2 - dd * dd));
        mejor = Math.min(mejor, t - back);
      }
    }
    // bandas
    const { X0, X1, Y0, Y1, R } = BILLAR;
    if (dx > 0) mejor = Math.min(mejor, (X1 - R - x) / dx);
    if (dx < 0) mejor = Math.min(mejor, (X0 + R - x) / dx);
    if (dy > 0) mejor = Math.min(mejor, (Y1 - R - y) / dy);
    if (dy < 0) mejor = Math.min(mejor, (Y0 + R - y) / dy);
    return Math.max(20, mejor);
  }

  function dibujarBola(n, x, y) {
    const r = BILLAR.R, X = Math.round(x), Y = Math.round(y);
    ctx.beginPath(); ctx.arc(X, Y, r, 0, 6.2832);
    ctx.fillStyle = n >= 9 ? "#f6f6f0" : COLS[n]; ctx.fill();
    if (n >= 9) {
      ctx.save(); ctx.beginPath(); ctx.arc(X, Y, r, 0, 6.2832); ctx.clip();
      ctx.fillStyle = COLS[n]; ctx.fillRect(X - r, Y - r * 0.44, r * 2, r * 0.88); ctx.restore();
    }
    if (n > 0) {
      ctx.beginPath(); ctx.arc(X, Y, r * 0.46, 0, 6.2832); ctx.fillStyle = "#fff"; ctx.fill();
      ctx.fillStyle = "#111"; ctx.font = "bold " + ((r * 0.72) | 0) + "px ui-monospace, monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(n, X, Y + 0.5);
      ctx.textBaseline = "alphabetic";
    }
    ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(X, Y, r, 0, 6.2832); ctx.stroke();
  }

  JUEGOS.billar = {
    nombre: "Billar 8-ball",
    desc: "Por turnos. Apuntá con el mouse, mantené apretado para la fuerza, soltá para tirar.",
    canvas: { w: BILLAR.W, h: BILLAR.H },

    iniciarHost() { sim = new BillarSim(); hAcc = 0; hSend = 0; hLast = performance.now(); enganchar(); },
    iniciarGuest() { sim = null; snap = null; for (const k in vista) delete vista[k]; enganchar(); },
    destruir() { soltar(); sim = null; snap = null; },

    onData(m) {
      if (net.rol === 1) {
        if (!m || !sim) return;
        if (m.t === "aim") { sim.apuntar(2, m.ang, m.pot); if (m.disp) sim.tirar(2); }
        else if (m.t === "mano") sim.manoLibre(2, m.x, m.y);
        else if (m.t === "rev") sim.pedirRevancha(2);
      } else {
        if (m && m.t === "e") snap = m;
      }
    },

    frame(now, dt, pausado) {
      // ---- potencia cargando ----
      if (M.cargando) M.pot = Math.min(1, M.pot + dt / CARGA_S);

      // ---- HOST: simular + enviar ----
      if (net.rol === 1 && sim) {
        if (!pausado) {
          let d = now - hLast; if (!(d > 0)) d = 16.7; if (d > 250) d = 250;
          hLast = now; hAcc += d; hSend += d;
          if (miTurno() && sim.fase === "apuntando") sim.apuntar(1, M.ang, M.cargando ? M.pot : 0);
          const paso = 1000 / BILLAR.SIM_HZ;
          let k = 0;
          while (hAcc >= paso && k < 20) { sim.step(paso / 1000); hAcc -= paso; k++; }
        } else hLast = now;
        if (hSend >= 1000 / BILLAR.SEND_HZ) { hSend = 0; net.enviar(JSON.stringify(sim.snapshot())); }
      }

      // ---- GUEST: reenvios self-healing + suavizado ----
      if (net.rol === 2) {
        if (snap && snap.fase === "apuntando" && miTurno() && !pausado) {
          const disp = M.dispHasta > now;
          net.enviar(JSON.stringify({ t: "aim", ang: M.ang, pot: M.cargando ? M.pot : (disp ? M._potDisparo : 0), disp }));
          if (snap.fase !== "apuntando") M.dispHasta = 0;
        }
        if (M.dispHasta > now && snap && snap.fase !== "apuntando") M.dispHasta = 0;
        if (M.manoHasta > now && M.manoXY) {
          if (snap && snap.fase === "manoLibre") net.enviar(JSON.stringify({ t: "mano", x: M.manoXY.x, y: M.manoXY.y }));
          else M.manoHasta = 0;
        }
        if (M.revHasta > now) {
          if (snap && snap.ganador) net.enviar(JSON.stringify({ t: "rev" }));
          else M.revHasta = 0;
        }
      }

      // ---- estado a dibujar ----
      let bolas, turno, g1, g2, fase, ganador, falta, aimRemota;
      if (net.rol === 1 && sim) {
        bolas = sim.bolas.filter((b) => b.dentro).map((b) => [b.n, b.x, b.y]);
        turno = sim.turno; g1 = sim.grupo[1]; g2 = sim.grupo[2];
        fase = sim.fase; ganador = sim.ganador; falta = sim.falta;
        aimRemota = (sim.fase === "apuntando" && sim.turno === 2) ? { ang: sim.aim.ang, pot: sim.aim.pot } : null;
      } else if (snap) {
        for (const [n, x, y] of snap.b) {
          if (!vista[n]) vista[n] = { x, y };
          vista[n].x = lerp(vista[n].x, x, 0.35);
          vista[n].y = lerp(vista[n].y, y, 0.35);
        }
        const vivos = new Set(snap.b.map((b) => b[0]));
        for (const k in vista) if (!vivos.has(+k)) delete vista[k];
        bolas = snap.b.map((b) => [b[0], vista[b[0]].x, vista[b[0]].y]);
        turno = snap.turno; g1 = snap.g1; g2 = snap.g2;
        fase = snap.fase; ganador = snap.ganador; falta = snap.falta;
        aimRemota = (snap.aim && snap.aim.por !== net.rol) ? snap.aim : null;
      } else {
        bolas = []; turno = 0; g1 = g2 = 0; fase = ""; ganador = 0; falta = "";
      }

      // ================= PINTAR =================
      const { W, H, X0, X1, Y0, Y1 } = BILLAR;
      ctx.fillStyle = "#3a271a"; ctx.fillRect(0, 0, W, H);               // marco
      ctx.fillStyle = "#0f6b3f"; ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0); // paño
      ctx.strokeStyle = "#0a4f2e"; ctx.lineWidth = 2; ctx.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
      ctx.fillStyle = "#0a0a0a";
      for (const p of BILLAR.TRONERAS) { ctx.beginPath(); ctx.arc(p.x, p.y, BILLAR.TRONERA * 0.9, 0, 6.2832); ctx.fill(); }

      for (const [n, x, y] of bolas) if (n !== 0) dibujarBola(n, x, y);
      const cue = bolas.find((b) => b[0] === 0);
      if (cue) dibujarBola(0, cue[1], cue[2]);

      // linea de puntería (propia)
      if (fase === "apuntando" && miTurno() && cue) {
        const largo = proyectar(cue[1], cue[2], M.ang);
        ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 2; ctx.setLineDash([7, 7]);
        ctx.beginPath(); ctx.moveTo(cue[1], cue[2]);
        ctx.lineTo(cue[1] + Math.cos(M.ang) * largo, cue[2] + Math.sin(M.ang) * largo);
        ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(cue[1] + Math.cos(M.ang) * largo, cue[2] + Math.sin(M.ang) * largo, BILLAR.R, 0, 6.2832);
        ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.stroke();
      }
      // aim del rival
      if (aimRemota && cue) {
        ctx.strokeStyle = "rgba(255,220,120,0.5)"; ctx.lineWidth = 2; ctx.setLineDash([4, 8]);
        ctx.beginPath(); ctx.moveTo(cue[1], cue[2]);
        ctx.lineTo(cue[1] + Math.cos(aimRemota.ang) * 120, cue[2] + Math.sin(aimRemota.ang) * 120);
        ctx.stroke(); ctx.setLineDash([]);
      }
      // bola en mano: fantasma
      if (fase === "manoLibre" && miTurno() && M.dentroCanvas) {
        const gx = clamp(M.mx, X0 + BILLAR.R, X1 - BILLAR.R), gy = clamp(M.my, Y0 + BILLAR.R, Y1 - BILLAR.R);
        ctx.globalAlpha = 0.5; dibujarBola(0, gx, gy); ctx.globalAlpha = 1;
      }

      // barra de potencia
      if (fase === "apuntando" && miTurno()) {
        const bw = 14, bh = Y1 - Y0, bx = W - 22, by = Y0;
        ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = "#f4c430"; ctx.fillRect(bx, by + bh * (1 - M.pot), bw, bh * M.pot);
        ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
      }

      // HUD de turno (parte del juego, no del shell)
      ctx.fillStyle = "#eafff2"; ctx.font = "bold 15px system-ui, sans-serif"; ctx.textAlign = "left";
      const miGrupo = net.rol === 1 ? g1 : g2;
      const nomG = (g) => g === 1 ? "lisas" : g === 2 ? "rayas" : "sin asignar";
      let txt = ganador ? "" : (turno === net.rol ? "Tu turno" : "Turno del rival");
      if (!ganador && miGrupo) txt += " · vos: " + nomG(miGrupo);
      if (fase === "manoLibre" && !ganador) txt += (turno === net.rol ? " · poné la blanca (click)" : " · el rival acomoda la blanca");
      ctx.fillText(txt, X0 + 4, Y0 - 12);
      if (falta && !ganador) { ctx.fillStyle = "#ffd36a"; ctx.textAlign = "right"; ctx.fillText(falta, X1 - 4, Y0 - 12); }
      ctx.textAlign = "left";
    },

    overlay() {
      const ganador = net.rol === 1 && sim ? sim.ganador : (snap && snap.ganador);
      if (!ganador) return null;
      const yo = net.rol === 1 && sim ? sim.revancha[1] : (snap && (net.rol === 1 ? snap.rev1 : snap.rev2));
      return {
        texto: ganador === net.rol ? "GANASTE 🎱" : "PERDISTE",
        sub: yo ? "Esperando al rival…" : "Revancha para otra",
        revancha: true, revanchaPedida: yo,
      };
    },
    revancha() {
      if (net.rol === 1 && sim) sim.pedirRevancha(1);
      else { net.enviar(JSON.stringify({ t: "rev" })); M.revHasta = performance.now() + 1500; }
    },
  };
})();
