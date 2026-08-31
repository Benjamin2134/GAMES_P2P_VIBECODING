// ==========================================================================
//  Módulo de juego: CYBER TRON (Lightcycles)  -  JUEGOS.tron
//  Arena expandida (1000 x 600 px), estelas continuas de neón y turbo.
//  Usa los globales del shell: cv, ctx, net.
// ==========================================================================

(function () {
  const K = TRON;

  let sim = null;
  let snap = null;
  let animId = null;

  // Estado local de input
  const inputLocal = {
    dir: null,
    turbo: false
  };

  // Partículas de explosión locales para render
  let particulas = [];

  function onKeyDown(e) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", " "].includes(e.key)) {
      e.preventDefault();
    }

    let nuevoDir = null;
    if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") nuevoDir = "N";
    else if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") nuevoDir = "S";
    else if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") nuevoDir = "W";
    else if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") nuevoDir = "E";

    if (nuevoDir && nuevoDir !== inputLocal.dir) {
      inputLocal.dir = nuevoDir;
      RetroAudio.playPongBeep(false);
      enviarInput();
    }

    if (e.key === " " || e.key === "Spacebar" || e.key === "Shift") {
      if (!inputLocal.turbo) {
        inputLocal.turbo = true;
        RetroAudio.startThrust();
        enviarInput();
      }
    }
  }

  function onKeyUp(e) {
    if (e.key === " " || e.key === "Spacebar" || e.key === "Shift") {
      if (inputLocal.turbo) {
        inputLocal.turbo = false;
        RetroAudio.stopThrust();
        enviarInput();
      }
    }
  }

  function enviarInput() {
    if (net.rol === 1 && sim) {
      sim.aplicarInputHost(inputLocal);
    } else {
      net.enviar({ t: "tron_in", dir: inputLocal.dir, turbo: inputLocal.turbo });
    }
  }

  // --- Registro del Juego en JUEGOS ---
  JUEGOS.tron = {
    nombre: "CYBER TRON",
    desc: "Motos de luz en arena expandida de 1000x600 px. Estelas de neón a 120 Hz, giros en 90° y turbo.",
    canvas: { w: K.W, h: K.H },

    iniciarHost() {
      sim = new TronSim();
      snap = null;
      particulas = [];
      inputLocal.dir = "E";
      inputLocal.turbo = false;
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
    },

    iniciarGuest() {
      sim = null;
      snap = null;
      particulas = [];
      inputLocal.dir = "W";
      inputLocal.turbo = false;
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
    },

    destruir() {
      sim = null;
      snap = null;
      particulas = [];
      RetroAudio.stopThrust();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },

    onData(msg) {
      if (typeof msg !== "object" || !msg) return;

      if (net.rol === 1 && sim) {
        if (msg.t === "tron_in") {
          sim.aplicarInputGuest({ dir: msg.dir, turbo: msg.turbo });
        } else if (msg.t === "tron_rev") {
          sim.pedirRevancha(2);
        }
        return;
      }

      if (net.rol === 2 && msg.t === "e" && msg.snap) {
        snap = msg.snap;
        if (snap.expl && snap.expl.length) {
          snap.expl.forEach(exp => crearExplosionParticulas(exp.x, exp.y, exp.col));
          RetroAudio.playExplosion();
        }
      }
    },

    frame(now, dtSeg, pausado) {
      // Loop del Host a 120 Hz
      if (net.rol === 1 && sim) {
        if (!pausado) {
          sim.step(dtSeg);
          if (sim.explosiones.length) {
            sim.explosiones.forEach(exp => crearExplosionParticulas(exp.x, exp.y, exp.col));
            RetroAudio.playExplosion();
          }
        }
        snap = sim.snapshot();
        net.enviar({ t: "e", snap });
      }

      renderTron(dtSeg);
    },

    overlay() {
      if (!snap) return null;
      if (snap.ganador) {
        const ganeYo = snap.ganador === net.rol;
        const revanchaPedida = (net.rol === 1 && sim) ? sim.revancha[net.rol] : (snap ? snap.revancha[net.rol] : false);

        return {
          texto: ganeYo ? "¡DOMINIO DE LA ARENA!" : "DESINTEGRADO",
          sub: ganeYo ? "Has alcanzado 5 victorias de ronda" : "Tu estela de luz fue cortada",
          revancha: true,
          revanchaPedida
        };
      }
      return null;
    },

    revancha() {
      if (net.rol === 1 && sim) {
        sim.pedirRevancha(1);
      } else {
        net.enviar({ t: "tron_rev" });
      }
    }
  };

  // ==========================================================================
  //  RENDERIZADO CANVAS 2D (Estética Cyber Neon 1982)
  // ==========================================================================
  function renderTron(dtSeg) {
    // Fondo de arena oscura
    ctx.fillStyle = "#04060f";
    ctx.fillRect(0, 0, K.W, K.H);

    // Cuadrícula Cyber Grid en perspectiva / neón tenue
    ctx.strokeStyle = "rgba(0, 240, 255, 0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x < K.W; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, K.H); ctx.stroke(); }
    for (let y = 0; y < K.H; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(K.W, y); ctx.stroke(); }

    // Borde perimetral mortal (Arena Boundary)
    ctx.strokeStyle = "rgba(0, 240, 255, 0.3)";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, K.W, K.H);

    if (!snap) return;

    // 1. Dibujar Estelas Vectoriales Continuas
    dibujarEstela(snap.e1, snap.m1, K.COL_P1);
    dibujarEstela(snap.e2, snap.m2, K.COL_P2);

    // 2. Dibujar Motos de Luz
    if (snap.m1 && snap.m1.viva) dibujarMoto(snap.m1.x, snap.m1.y, snap.m1.dir, K.COL_P1, snap.m1.turbo);
    if (snap.m2 && snap.m2.viva) dibujarMoto(snap.m2.x, snap.m2.y, snap.m2.dir, K.COL_P2, snap.m2.turbo);

    // 3. Renderizar Partículas de Explosión
    renderParticulas(dtSeg);

    // 4. Marcador y Turbo HUD Superior
    renderHUD();

    // 5. Cuenta Regresiva al Iniciar Ronda
    if (snap.sirviendo) {
      ctx.save();
      ctx.font = "bold 44px monospace";
      ctx.fillStyle = "#00f0ff";
      ctx.textAlign = "center";
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 14;
      ctx.fillText(`GRID START EN ${snap.cuenta}...`, K.W / 2, K.H / 2);
      ctx.restore();
    }
  }

  function dibujarEstela(puntos, moto, color) {
    if (!puntos || puntos.length === 0 || !moto) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 4;
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";

    ctx.beginPath();
    ctx.moveTo(puntos[0].x, puntos[0].y);
    for (let i = 1; i < puntos.length; i++) {
      ctx.lineTo(puntos[i].x, puntos[i].y);
    }
    // Conectar hasta la cabeza actual de la moto si sigue viva
    if (moto.viva) {
      ctx.lineTo(moto.x, moto.y);
    }
    ctx.stroke();

    // Núcleo blanco brillante en el centro de la estela
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 0;
    ctx.stroke();

    ctx.restore();
  }

  function dibujarMoto(x, y, dir, color, turbo) {
    ctx.save();
    ctx.translate(x, y);

    // Rotación según dirección
    let rad = 0;
    if (dir === "E") rad = 0;
    else if (dir === "S") rad = Math.PI / 2;
    else if (dir === "W") rad = Math.PI;
    else if (dir === "N") rad = -Math.PI / 2;
    ctx.rotate(rad);

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;

    // Cuerpo aerodinámico de la Lightcycle
    ctx.beginPath();
    ctx.moveTo(10, 0);       // Punta delantera
    ctx.lineTo(-8, -5);     // Lateral izquierdo
    ctx.lineTo(-12, -3);    // Rueda trasera izquierda
    ctx.lineTo(-12, 3);     // Rueda trasera derecha
    ctx.lineTo(-8, 5);      // Lateral derecho
    ctx.closePath();
    ctx.fill();

    // Rueda delantera brillante
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(4, -2, 6, 4);

    // Resplandor de Turbo
    if (turbo) {
      ctx.fillStyle = "#ffaa00";
      ctx.fillRect(-16, -3, 5, 6);
    }

    ctx.restore();
  }

  function crearExplosionParticulas(x, y, color) {
    for (let i = 0; i < 35; i++) {
      const ang = Math.random() * Math.PI * 2;
      const vel = 80 + Math.random() * 220;
      particulas.push({
        x, y,
        vx: Math.cos(ang) * vel,
        vy: Math.sin(ang) * vel,
        vida: 0.8 + Math.random() * 0.4,
        vidaMax: 1.2,
        color
      });
    }
  }

  function renderParticulas(dtSeg) {
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= dtSeg;
      if (p.vida <= 0) {
        particulas.splice(i, 1);
        continue;
      }
      p.x += p.vx * dtSeg;
      p.y += p.vy * dtSeg;

      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.shadowBlur = 0;
  }

  function renderHUD() {
    ctx.save();
    // 1. Marcador de Rondas
    ctx.font = "bold 20px monospace";
    ctx.fillStyle = K.COL_P1;
    ctx.textAlign = "left";
    ctx.fillText(`P1 (CIAN): ${"◆ ".repeat(snap.p1)}`, 24, 34);

    ctx.fillStyle = K.COL_P2;
    ctx.textAlign = "right";
    ctx.fillText(`P2 (MAGENTA): ${"◆ ".repeat(snap.p2)}`, K.W - 24, 34);

    // 2. Barra de Turbo de cada jugador
    const tbP1 = snap.m1 ? snap.m1.tb : 0;
    const tbP2 = snap.m2 ? snap.m2.tb : 0;

    // Barra P1 (Izquierda)
    ctx.fillStyle = "rgba(0, 240, 255, 0.15)";
    ctx.fillRect(24, 46, 160, 8);
    ctx.fillStyle = K.COL_P1;
    ctx.fillRect(24, 46, (tbP1 / 100) * 160, 8);

    // Barra P2 (Derecha)
    ctx.fillStyle = "rgba(255, 0, 85, 0.15)";
    ctx.fillRect(K.W - 184, 46, 160, 8);
    ctx.fillStyle = K.COL_P2;
    ctx.fillRect(K.W - 184 + (1 - tbP2 / 100) * 160, 46, (tbP2 / 100) * 160, 8);

    // Controles en el centro superior
    ctx.font = "12px monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.textAlign = "center";
    ctx.fillText("WASD / Flechas = Girar 90° · ESPACIO = Turbo Boost", K.W / 2, 34);

    ctx.restore();
  }
})();
