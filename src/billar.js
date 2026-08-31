// ==========================================================================
//  Modulo de juego: BILLAR (8-ball)  -  JUEGOS.billar
//  Por turnos, host autoritativo. Apuntas con el mouse, mantenes apretado
//  para cargar fuerza, soltas para tirar. Circulo de efecto (abajo a la
//  derecha) para follow / draw / lateral. Falta -> bola en mano (click).
//  La linea de puntería es CORTA y se desvanece: solo indica la direccion.
//  Usa los globales del shell: cv, ctx, net.
// ==========================================================================
(function () {
  const K = BILLAR;
  const COLS = {
    0: "#f7f5ef", 1: "#f2c200", 2: "#1f49b8", 3: "#d02f2f", 4: "#6a2fae",
    5: "#e5771c", 6: "#1f8a4c", 7: "#7a1f1f", 8: "#131313",
    9: "#f2c200", 10: "#1f49b8", 11: "#d02f2f", 12: "#6a2fae", 13: "#e5771c", 14: "#1f8a4c", 15: "#7a1f1f",
  };
  const CARGA_S = 1.25;
  const LINEA_LARGO = 58;              // linea de puntería corta
  const PICKER = { x: K.X1 - 4, y: K.Y1 + 20, r: 15 };  // circulo de efecto

  let sim = null, hAcc = 0, hSend = 0, hLast = 0;
  let snap = null;
  const vista = {};                    // guest: n -> {x,y,rot}
  const M = {
    mx: K.W / 2, my: K.H / 2, dentro: false,
    ang: 0, pot: 0, cargando: false,
    ox: 0, oy: 0, dragPicker: false,
    dispHasta: 0, _potDisp: 0,
    manoHasta: 0, manoXY: null, revHasta: 0,
  };

  function mouse(e) {
    const r = cv.getBoundingClientRect();
    M.mx = (e.clientX - r.left) / r.width * K.W;
    M.my = (e.clientY - r.top) / r.height * K.H;
    M.dentro = true;
  }
  function cueXY() {
    if (net.rol === 1 && sim) { const c = sim._b(0); return c && c.dentro ? c : { x: K.W / 2, y: K.H / 2 }; }
    if (snap) { const c = snap.b.find((b) => b[0] === 0); if (c) return { x: c[1], y: c[2] }; }
    return { x: K.W / 2, y: K.H / 2 };
  }
  const turnoAct = () => net.rol === 1 && sim ? sim.turno : (snap && snap.turno);
  const faseAct = () => net.rol === 1 && sim ? sim.fase : (snap && snap.fase);
  const miTurno = () => turnoAct() === net.rol;

  function onMove(e) {
    mouse(e);
    if (M.dragPicker) {
      const dx = (M.mx - PICKER.x) / PICKER.r, dy = (M.my - PICKER.y) / PICKER.r;
      const m = Math.hypot(dx, dy) || 1, k = Math.min(1, m);
      M.ox = dx / m * k; M.oy = -dy / m * k;   // arriba = follow (oy>0)
      return;
    }
    if (faseAct() === "apuntando" && miTurno()) {
      const c = cueXY();
      M.ang = Math.atan2(M.my - c.y, M.mx - c.x);
    }
  }
  function onDown(e) {
    mouse(e);
    if (!miTurno()) return;
    if (Math.hypot(M.mx - PICKER.x, M.my - PICKER.y) < PICKER.r + 6 && faseAct() === "apuntando") {
      M.dragPicker = true; onMove(e); return;
    }
    const f = faseAct();
    if (f === "manoLibre") {
      const x = clamp(M.mx, K.X0 + K.R, K.X1 - K.R), y = clamp(M.my, K.Y0 + K.R, K.Y1 - K.R);
      if (net.rol === 1) sim.manoLibre(1, x, y);
      else { M.manoXY = { x, y }; M.manoHasta = performance.now() + 900; }
    } else if (f === "apuntando") { M.cargando = true; M.pot = 0; }
  }
  function onUp() {
    M.dragPicker = false;
    if (M.cargando) {
      M.cargando = false;
      const pot = M.pot; M.pot = 0;
      if (pot >= 0.03) disparar(pot);
    }
  }
  function onLeave() { M.dentro = false; }
  function onKey(e) {
    if (!miTurno() || faseAct() !== "apuntando") return;
    const k = e.key;
    if (k === "ArrowLeft") M.ang -= 0.02;
    else if (k === "ArrowRight") M.ang += 0.02;
    else if (k === "ArrowUp") M.pot = clamp(M.pot + 0.04, 0, 1);
    else if (k === "ArrowDown") M.pot = clamp(M.pot - 0.04, 0, 1);
    else if (k === " " || k === "Spacebar") disparar(M.pot > 0.03 ? M.pot : 0.5);
    else return;
    e.preventDefault();
  }
  function disparar(pot) {
    if (net.rol === 1 && sim) { sim.apuntar(1, M.ang, pot, M.ox, M.oy); sim.tirar(1); }
    else { M._potDisp = pot; M.dispHasta = performance.now() + 1000; }
    M.pot = 0;
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

  JUEGOS.billar = {
    nombre: "Billar 8-ball",
    desc: "Física realista. Mouse para apuntar, mantené apretado la fuerza, soltá para tirar. Efecto con el círculo de abajo.",
    canvas: { w: K.W, h: K.H },

    iniciarHost() { sim = new BillarSim(); hAcc = hSend = 0; hLast = performance.now(); M.ox = M.oy = 0; enganchar(); },
    iniciarGuest() { sim = null; snap = null; for (const k in vista) delete vista[k]; M.ox = M.oy = 0; enganchar(); },
    destruir() { soltar(); sim = null; snap = null; },

    onData(m) {
      if (net.rol === 1) {
        if (!m || !sim) return;
        if (m.t === "aim") { sim.apuntar(2, m.ang, m.pot, m.ox, m.oy); if (m.disp) sim.tirar(2); }
        else if (m.t === "mano") sim.manoLibre(2, m.x, m.y);
        else if (m.t === "rev") sim.pedirRevancha(2);
      } else if (m && m.t === "e") snap = m;
    },

    frame(now, dt, pausado) {
      if (M.cargando) M.pot = Math.min(1, M.pot + dt / CARGA_S);

      // HOST: simular + enviar
      if (net.rol === 1 && sim) {
        if (!pausado) {
          let d = now - hLast; if (!(d > 0)) d = 16.7; if (d > 250) d = 250;
          hLast = now; hAcc += d; hSend += d;
          if (miTurno() && sim.fase === "apuntando") sim.apuntar(1, M.ang, M.cargando ? M.pot : 0, M.ox, M.oy);
          const paso = 1000 / K.SIM_HZ;
          let k = 0;
          while (hAcc >= paso && k < 24) { sim.step(paso / 1000); hAcc -= paso; k++; }
        } else hLast = now;
        if (hSend >= 1000 / K.SEND_HZ) { hSend = 0; net.enviar(JSON.stringify(sim.snapshot())); }
        if (sim.fase !== "apuntando") { M.ox = 0; M.oy = 0; }
      }

      // GUEST: self-healing + suavizado
      if (net.rol === 2) {
        if (snap && snap.fase === "apuntando" && miTurno() && !pausado) {
          const disp = M.dispHasta > now;
          net.enviar(JSON.stringify({ t: "aim", ang: M.ang, ox: M.ox, oy: M.oy, pot: M.cargando ? M.pot : (disp ? M._potDisp : 0), disp }));
        }
        if (M.dispHasta > now && snap && snap.fase !== "apuntando") { M.dispHasta = 0; M.ox = 0; M.oy = 0; }
        if (M.manoHasta > now && M.manoXY) {
          if (snap && snap.fase === "manoLibre") net.enviar(JSON.stringify({ t: "mano", x: M.manoXY.x, y: M.manoXY.y }));
          else M.manoHasta = 0;
        }
        if (M.revHasta > now) { if (snap && snap.ganador) net.enviar(JSON.stringify({ t: "rev" })); else M.revHasta = 0; }
      }

      // ---- reunir estado para dibujar ----
      let bolas, turno, g1, g2, m1, m2, fase, ganador, falta, aimRemota;
      if (net.rol === 1 && sim) {
        bolas = sim.bolas.filter((b) => b.dentro).map((b) => [b.n, b.x, b.y, b.rot]);
        turno = sim.turno; g1 = sim.grupo[1]; g2 = sim.grupo[2];
        m1 = sim.metidasDe(1); m2 = sim.metidasDe(2);
        fase = sim.fase; ganador = sim.ganador; falta = sim.falta;
        aimRemota = (sim.fase === "apuntando" && sim.turno === 2) ? { ang: sim.aim.ang } : null;
      } else if (snap) {
        for (const [n, x, y, rot] of snap.b) {
          if (!vista[n]) vista[n] = { x, y, rot };
          vista[n].x = lerp(vista[n].x, x, 0.4);
          vista[n].y = lerp(vista[n].y, y, 0.4);
          vista[n].rot = rot;
        }
        const vivos = new Set(snap.b.map((b) => b[0]));
        for (const kk in vista) if (!vivos.has(+kk)) delete vista[kk];
        bolas = snap.b.map((b) => [b[0], vista[b[0]].x, vista[b[0]].y, vista[b[0]].rot]);
        turno = snap.turno; g1 = snap.g1; g2 = snap.g2; m1 = snap.m1; m2 = snap.m2;
        fase = snap.fase; ganador = snap.ganador; falta = snap.falta;
        aimRemota = (snap.aim && snap.aim.por !== net.rol) ? snap.aim : null;
      } else { bolas = []; turno = 0; g1 = g2 = m1 = m2 = 0; fase = ""; ganador = 0; falta = ""; }

      pintar({ bolas, turno, g1, g2, m1, m2, fase, ganador, falta, aimRemota });
    },

    overlay() {
      const ganador = net.rol === 1 && sim ? sim.ganador : (snap && snap.ganador);
      if (!ganador) return null;
      const yo = net.rol === 1 && sim ? sim.revancha[1] : (snap && (net.rol === 1 ? snap.rev1 : snap.rev2));
      return { texto: ganador === net.rol ? "GANASTE 🎱" : "PERDISTE", sub: yo ? "Esperando al rival…" : "Revancha para otra", revancha: true, revanchaPedida: yo };
    },
    revancha() {
      if (net.rol === 1 && sim) sim.pedirRevancha(1);
      else { net.enviar(JSON.stringify({ t: "rev" })); M.revHasta = performance.now() + 1500; }
    },
  };

  // ======================= RENDER =======================
  function paño() {
    const { X0, X1, Y0, Y1, W, H } = K;
    // marco de madera
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#7a4a24"); g.addColorStop(0.5, "#5e3719"); g.addColorStop(1, "#43260f");
    ctx.fillStyle = g;
    _roundRect(2, 2, W - 4, H - 4, 16); ctx.fill();
    // bisel interior del riel
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 3;
    ctx.strokeRect(X0 - 3, Y0 - 3, X1 - X0 + 6, Y1 - Y0 + 6);
    ctx.strokeStyle = "rgba(255,220,170,0.15)"; ctx.lineWidth = 1;
    ctx.strokeRect(X0 - 5, Y0 - 5, X1 - X0 + 10, Y1 - Y0 + 10);
    // paño
    ctx.fillStyle = "#0c7a44";
    ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    const rg = ctx.createRadialGradient((X0 + X1) / 2, (Y0 + Y1) / 2, 40, (X0 + X1) / 2, (Y0 + Y1) / 2, (X1 - X0) * 0.62);
    rg.addColorStop(0, "rgba(255,255,255,0.06)"); rg.addColorStop(0.6, "rgba(0,0,0,0)"); rg.addColorStop(1, "rgba(0,0,0,0.32)");
    ctx.fillStyle = rg; ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    // sombra interior de los rieles
    ctx.strokeStyle = "rgba(0,0,0,0.22)"; ctx.lineWidth = 8;
    ctx.strokeRect(X0 + 4, Y0 + 4, X1 - X0 - 8, Y1 - Y0 - 8);
    // diamantes (sights)
    ctx.fillStyle = "rgba(240,235,220,0.8)";
    for (let i = 1; i <= 7; i++) if (i !== 4) { _diam(X0 + (X1 - X0) * i / 8, Y0 - 14); _diam(X0 + (X1 - X0) * i / 8, Y1 + 14); }
    for (let i = 1; i <= 3; i++) { _diam(X0 - 14, Y0 + (Y1 - Y0) * i / 4); _diam(X1 + 14, Y0 + (Y1 - Y0) * i / 4); }
    // troneras
    for (const p of K.TRONERAS) {
      const pg = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.cap + 6);
      pg.addColorStop(0, "#000"); pg.addColorStop(0.7, "#050505"); pg.addColorStop(1, "#241505");
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.cap + 5, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.cap + 5, 0, 6.2832); ctx.stroke();
    }
    // punto de saque
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.arc(X0 + (X1 - X0) * 0.72, (Y0 + Y1) / 2, 2.5, 0, 6.2832); ctx.fill();
  }
  function _diam(x, y) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore(); }
  function _roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function bola(n, x, y, rot) {
    const r = K.R;
    // sombra
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(x + 2.5, y + 3.5, r * 1.02, r * 0.92, 0, 0, 6.2832); ctx.fill();
    // esfera
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.clip();
    ctx.fillStyle = n >= 9 ? "#f7f5ef" : COLS[n];
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    if (n >= 9) {   // franja, girando con la bola
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot * 0.9);
      ctx.fillStyle = COLS[n]; ctx.fillRect(-r, -r * 0.46, r * 2, r * 0.92);
      ctx.restore();
    }
    if (n > 0) {   // circulo del numero
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot * 0.5);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, 6.2832); ctx.fillStyle = "#fbfbf7"; ctx.fill();
      ctx.fillStyle = "#161616"; ctx.font = "bold " + ((r * 0.78) | 0) + "px ui-monospace, monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(n, 0, 0.5);
      ctx.restore(); ctx.textBaseline = "alphabetic";
    }
    // sombreado esferico
    const sg = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
    sg.addColorStop(0, "rgba(255,255,255,0.55)"); sg.addColorStop(0.35, "rgba(255,255,255,0.08)");
    sg.addColorStop(0.7, "rgba(0,0,0,0.05)"); sg.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = sg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
    // brillo puntual
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath(); ctx.ellipse(x - r * 0.34, y - r * 0.4, r * 0.22, r * 0.16, -0.6, 0, 6.2832); ctx.fill();
  }

  function marcador(S) {
    const { X0, X1, Y0 } = K;
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    const fila = (cx, lado, etq, grupo, met, activo) => {
      ctx.textAlign = lado;
      const yy = Y0 - 22;
      ctx.fillStyle = activo ? "#fff" : "rgba(230,235,240,0.55)";
      let txt = etq;
      if (grupo) txt += "  " + (grupo === 1 ? "●" : "◐") + " " + met + "/" + K.GANA_BOLAS;
      else txt += "  –";
      ctx.fillText(txt, cx, yy);
      if (activo) {
        const w = ctx.measureText(txt).width;
        ctx.strokeStyle = "#f2c200"; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lado === "left" ? cx : cx - w, yy + 10);
        ctx.lineTo(lado === "left" ? cx + w : cx, yy + 10);
        ctx.stroke();
      }
    };
    const yo = net.rol;
    fila(X0 + 4, "left", yo === 1 ? "VOS" : "RIVAL", S.g1, S.m1, S.turno === 1);
    fila(X1 - 4, "right", yo === 2 ? "VOS" : "RIVAL", S.g2, S.m2, S.turno === 2);
    ctx.textBaseline = "alphabetic";
  }

  function lineaPunteria(cx, cy, ang) {
    const x2 = cx + Math.cos(ang) * (K.R + 4 + LINEA_LARGO);
    const y2 = cy + Math.sin(ang) * (K.R + 4 + LINEA_LARGO);
    const x1 = cx + Math.cos(ang) * (K.R + 4);
    const y1 = cy + Math.sin(ang) * (K.R + 4);
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, "rgba(255,255,255,0.85)");
    g.addColorStop(0.5, "rgba(255,255,255,0.28)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.lineCap = "butt";
  }
  function taco(cx, cy, ang, pot) {
    const atras = K.R + 6 + pot * 46;
    const bx = cx - Math.cos(ang) * atras, by = cy - Math.sin(ang) * atras;
    const tx = bx - Math.cos(ang) * 150, ty = by - Math.sin(ang) * 150;
    const g = ctx.createLinearGradient(bx, by, tx, ty);
    g.addColorStop(0, "#f5e6c8"); g.addColorStop(0.08, "#caa46a"); g.addColorStop(1, "#5b3d1e");
    ctx.strokeStyle = g; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = "#2a3a6b"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - Math.cos(ang) * 5, by - Math.sin(ang) * 5); ctx.stroke();
    ctx.lineCap = "butt";
  }
  function circuloEfecto() {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath(); ctx.arc(PICKER.x, PICKER.y, PICKER.r + 3, 0, 6.2832); ctx.fill();
    ctx.fillStyle = "#f7f5ef";
    ctx.beginPath(); ctx.arc(PICKER.x, PICKER.y, PICKER.r, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PICKER.x - PICKER.r, PICKER.y); ctx.lineTo(PICKER.x + PICKER.r, PICKER.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PICKER.x, PICKER.y - PICKER.r); ctx.lineTo(PICKER.x, PICKER.y + PICKER.r); ctx.stroke();
    ctx.fillStyle = "#d02f2f";
    ctx.beginPath(); ctx.arc(PICKER.x + M.ox * PICKER.r * 0.8, PICKER.y - M.oy * PICKER.r * 0.8, 3.4, 0, 6.2832); ctx.fill();
  }

  function pintar(S) {
    ctx.fillStyle = "#08110c"; ctx.fillRect(0, 0, K.W, K.H);
    paño();
    marcador(S);

    for (const [n, x, y, rot] of S.bolas) if (n !== 0) bola(n, x, y, rot);
    const cue = S.bolas.find((b) => b[0] === 0);
    if (cue) bola(0, cue[1], cue[2], cue[3]);

    if (S.fase === "apuntando" && cue && !S.ganador) {
      if (miTurno()) {
        lineaPunteria(cue[1], cue[2], M.ang);
        taco(cue[1], cue[2], M.ang, M.cargando ? M.pot : 0);
        circuloEfecto();
        // barra de fuerza
        const bh = K.Y1 - K.Y0, bx = K.X1 + 22, by = K.Y0;
        ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(bx, by, 10, bh);
        ctx.fillStyle = "#f2c200"; ctx.fillRect(bx, by + bh * (1 - M.pot), 10, bh * M.pot);
      } else if (S.aimRemota) {
        lineaPunteria(cue[1], cue[2], S.aimRemota.ang);
      }
    }

    if (S.fase === "manoLibre" && miTurno() && M.dentro && !S.ganador) {
      const gx = clamp(M.mx, K.X0 + K.R, K.X1 - K.R), gy = clamp(M.my, K.Y0 + K.R, K.Y1 - K.R);
      ctx.globalAlpha = 0.55; bola(0, gx, gy, 0); ctx.globalAlpha = 1;
    }

    // texto de turno / falta (abajo)
    ctx.font = "13px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#dfe7ee";
    let msg = S.ganador ? "" : (miTurno() ? "Tu turno" : "Turno del rival");
    if (!S.ganador && S.fase === "manoLibre") msg = miTurno() ? "Bola en mano — click para ubicar la blanca" : "El rival acomoda la blanca";
    if (S.falta && !S.ganador) msg = S.falta;
    ctx.fillText(msg, K.W / 2, K.Y1 + 22);
    ctx.textAlign = "left";
  }
})();
