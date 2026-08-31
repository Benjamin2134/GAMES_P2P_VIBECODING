// ==========================================================================
//  Módulo de juego: BATTLESHIP (Batalla Naval)  -  JUEGOS.battleship
//  Radar táctico sonar militar, 10x10, colocación y combate por turnos.
//  Usa los globales del shell: cv, ctx, net.
// ==========================================================================

(function () {
  const K = BATTLESHIP;
  const CELL = 34; // Tamaño en píxeles de cada casilla
  const GRID_PX = CELL * 10; // 340 px

  // Posiciones de los tableros en el canvas (920 x 560)
  const TAB_PROPIO = { x: 70, y: 110 };  // Mi Flota
  const TAB_RIVAL = { x: 510, y: 110 };  // Radar Enemigo

  let sim = null;
  let snap = null;
  let ultimoSeqVisto = -1;

  // Estado local para colocación de barcos
  const L = {
    flotaLocal: [],
    barcoSeleccionadoIdx: 0,
    horiz: true,
    confirmadoLocal: false,
    hoverX: -1,
    hoverY: -1,
    hoverTablero: null, // "propio" | "rival"
    sonarSweepAng: 0,
    animImpacto: null
  };

  function inicializarFlotaLocal() {
    L.flotaLocal = [
      { id: "carrier", nombre: "Portaaviones", tam: 5, x: 0, y: 0, horiz: true },
      { id: "battleship", nombre: "Acorazado", tam: 4, x: 0, y: 2, horiz: true },
      { id: "cruiser", nombre: "Crucero", tam: 3, x: 0, y: 4, horiz: true },
      { id: "submarine", nombre: "Submarino", tam: 3, x: 0, y: 6, horiz: true },
      { id: "destroyer", nombre: "Destructor", tam: 2, x: 0, y: 8, horiz: true }
    ];
    L.confirmadoLocal = false;
  }

  function mouseXY(e) {
    const r = cv.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * K.W,
      y: ((e.clientY - r.top) / r.height) * K.H
    };
  }

  function celdaDesdePos(px, py, tab) {
    if (px >= tab.x && px < tab.x + GRID_PX && py >= tab.y && py < tab.y + GRID_PX) {
      return {
        cx: Math.floor((px - tab.x) / CELL),
        cy: Math.floor((py - tab.y) / CELL)
      };
    }
    return null;
  }

  // --- Handlers de Eventos ---
  function onPointerMove(e) {
    const m = mouseXY(e);
    const cRival = celdaDesdePos(m.x, m.y, TAB_RIVAL);
    const cPropio = celdaDesdePos(m.x, m.y, TAB_PROPIO);

    if (cRival) {
      L.hoverX = cRival.cx;
      L.hoverY = cRival.cy;
      L.hoverTablero = "rival";
    } else if (cPropio) {
      L.hoverX = cPropio.cx;
      L.hoverY = cPropio.cy;
      L.hoverTablero = "propio";
    } else {
      L.hoverX = -1;
      L.hoverY = -1;
      L.hoverTablero = null;
    }
  }

  function onPointerDown(e) {
    const m = mouseXY(e);
    const fase = getFase();

    // 1. Botones de Fase de Colocación
    if (fase === "colocacion" && !L.confirmadoLocal) {
      // Botón Aleatorio (x: 70, y: 470, w: 140, h: 36)
      if (m.x >= 70 && m.x <= 210 && m.y >= 470 && m.y <= 506) {
        if (net.rol === 1 && sim) {
          L.flotaLocal = sim.generarFlotaAleatoria();
        } else {
          // Generar aleatorio localmente para Guest
          const tempSim = new BattleshipSim();
          L.flotaLocal = tempSim.generarFlotaAleatoria();
        }
        RetroAudio.playPongBeep(true);
        return;
      }

      // Botón Rotar (x: 220, y: 470, w: 100, h: 36)
      if (m.x >= 220 && m.x <= 320 && m.y >= 470 && m.y <= 506) {
        L.horiz = !L.horiz;
        RetroAudio.playPongBeep(false);
        return;
      }

      // Botón Confirmar Flota (x: 330, y: 470, w: 180, h: 36)
      if (m.x >= 330 && m.x <= 510 && m.y >= 470 && m.y <= 506) {
        confirmarFlota();
        return;
      }

      // Clic en tablero propio para reposicionar barco
      const cPropio = celdaDesdePos(m.x, m.y, TAB_PROPIO);
      if (cPropio) {
        const barco = L.flotaLocal[L.barcoSeleccionadoIdx];
        if (barco) {
          const maxX = L.horiz ? 10 - barco.tam : 9;
          const maxY = L.horiz ? 9 : 10 - barco.tam;
          if (cPropio.cx <= maxX && cPropio.cy <= maxY) {
            barco.x = cPropio.cx;
            barco.y = cPropio.cy;
            barco.horiz = L.horiz;
            L.barcoSeleccionadoIdx = (L.barcoSeleccionadoIdx + 1) % L.flotaLocal.length;
            RetroAudio.playPongBeep(false);
          }
        }
        return;
      }
    }

    // 2. Disparo en Fase de Combate
    if (fase === "combate" && esMiTurno()) {
      const cRival = celdaDesdePos(m.x, m.y, TAB_RIVAL);
      if (cRival) {
        ejecutarDisparo(cRival.cx, cRival.cy);
      }
    }
  }

  function onKeyDown(e) {
    if (e.key === "r" || e.key === "R") {
      L.horiz = !L.horiz;
      RetroAudio.playPongBeep(false);
    }
  }

  function confirmarFlota() {
    L.confirmadoLocal = true;
    RetroAudio.playSonar();

    if (net.rol === 1 && sim) {
      sim.confirmarFlota(1, L.flotaLocal);
      enviarSnapshot();
    } else {
      net.enviar({ t: "bs_confirm", flota: L.flotaLocal });
    }
  }

  function ejecutarDisparo(cx, cy) {
    if (net.rol === 1 && sim) {
      const res = sim.disparar(1, cx, cy);
      if (res.ok) {
        reproducirAudioResultado(res.resultado);
        enviarSnapshot();
      }
    } else {
      net.enviar({ t: "bs_fire", x: cx, y: cy });
    }
  }

  function reproducirAudioResultado(res) {
    if (res === "agua") RetroAudio.playSplash();
    else if (res === "impacto") RetroAudio.playExplosion();
    else if (res === "hundido" || res === "victoria") {
      RetroAudio.playExplosion();
      setTimeout(() => RetroAudio.playSonar(), 300);
    }
  }

  function getFase() {
    if (net.rol === 1 && sim) return sim.fase;
    if (snap) return snap.fase;
    return "colocacion";
  }

  function esMiTurno() {
    const turno = (net.rol === 1 && sim) ? sim.turno : (snap ? snap.turno : 1);
    return turno === net.rol;
  }

  function enviarSnapshot() {
    if (net.rol !== 1 || !sim) return;
    const snapHost = sim.snapshot(1);
    snap = snapHost;
    // Enviar snapshot con niebla al Guest (jugador 2)
    const snapGuest = sim.snapshot(2);
    net.enviar({ t: "e", snap: snapGuest });
  }

  // --- Registro del Juego en JUEGOS ---
  JUEGOS.battleship = {
    nombre: "BATTLESHIP",
    desc: "Batalla naval clásica 10x10. Flota completa, radar de sonar, disparos balísticos y niebla de guerra.",
    canvas: { w: K.W, h: K.H },

    iniciarHost() {
      sim = new BattleshipSim();
      snap = null;
      inicializarFlotaLocal();
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("keydown", onKeyDown);
    },

    iniciarGuest() {
      sim = null;
      snap = null;
      inicializarFlotaLocal();
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("keydown", onKeyDown);
    },

    destruir() {
      sim = null;
      snap = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    },

    onData(msg) {
      if (typeof msg !== "object" || !msg) return;

      // Mensajes recibidos por el Host
      if (net.rol === 1 && sim) {
        if (msg.t === "bs_confirm") {
          sim.confirmarFlota(2, msg.flota);
          enviarSnapshot();
        } else if (msg.t === "bs_fire") {
          const res = sim.disparar(2, msg.x, msg.y);
          if (res.ok) {
            reproducirAudioResultado(res.resultado);
            enviarSnapshot();
          }
        } else if (msg.t === "bs_rev") {
          sim.pedirRevancha(2);
          enviarSnapshot();
        }
        return;
      }

      // Mensajes recibidos por el Guest
      if (net.rol === 2 && msg.t === "e" && msg.snap) {
        const prevSnap = snap;
        snap = msg.snap;

        // Feedback sonoro ante nuevos eventos
        if (snap.ultimoEvento && (!prevSnap || prevSnap.seq !== snap.seq)) {
          if (snap.ultimoEvento.resultado) {
            reproducirAudioResultado(snap.ultimoEvento.resultado);
          } else if (snap.ultimoEvento.tipo === "INICIO_COMBATE") {
            RetroAudio.playSonar();
          }
        }
      }
    },

    frame(now, dtSeg, pausado) {
      L.sonarSweepAng = (L.sonarSweepAng + dtSeg * 1.8) % (Math.PI * 2);
      renderBattleship();
    },

    overlay() {
      const fase = getFase();
      if (fase === "fin") {
        const ganador = (net.rol === 1 && sim) ? sim.ganador : (snap ? snap.ganador : 0);
        const ganeYo = ganador === net.rol;
        const revanchaPedida = (net.rol === 1 && sim) ? sim.revancha[net.rol] : (snap ? snap.revancha[net.rol] : false);

        return {
          texto: ganeYo ? "¡VICTORIA NAVAL!" : "FLOTA HUNDIDA",
          sub: ganeYo ? "Has destruido todas las naves enemigas" : "El enemigo dominó los mares",
          revancha: true,
          revanchaPedida
        };
      }
      return null;
    },

    revancha() {
      if (net.rol === 1 && sim) {
        sim.pedirRevancha(1);
        inicializarFlotaLocal();
        enviarSnapshot();
      } else {
        inicializarFlotaLocal();
        net.enviar({ t: "bs_rev" });
      }
    }
  };

  // ==========================================================================
  //  RENDERIZADO CANVAS 2D (Estética Sonar Táctico Militar)
  // ==========================================================================
  function renderBattleship() {
    // Fondo azul marino / verde sonar muy oscuro
    ctx.fillStyle = "#050d09";
    ctx.fillRect(0, 0, K.W, K.H);

    // Cuadrículas de fondo decorativo
    ctx.strokeStyle = "rgba(0, 255, 102, 0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x < K.W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, K.H); ctx.stroke(); }
    for (let y = 0; y < K.H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(K.W, y); ctx.stroke(); }

    const fase = getFase();

    // 1. Render Encabezado de Estado y Turnos
    renderHeader(fase);

    // 2. Render Tablero Propio (Mi Flota)
    renderTablero(TAB_PROPIO, "TU FLOTA / BASE NAVAL", true);

    // 3. Render Tablero Rival (Radar de Sonar)
    renderTablero(TAB_RIVAL, "RADAR ENEMIGO (SONAR)", false);

    // 4. Render Controles de Colocación
    if (fase === "colocacion") {
      renderPanelColocacion();
    }
  }

  function renderHeader(fase) {
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";

    if (fase === "colocacion") {
      const listos = (net.rol === 1 && sim) ? sim.listos : (snap ? snap.listos : { 1: false, 2: false });
      const miListo = listos[net.rol];
      const rivalListo = listos[net.rol === 1 ? 2 : 1];

      ctx.fillStyle = "#39ff14";
      ctx.fillText("FASE DE DESPLIEGUE TÁCTICO", K.W / 2, 40);

      ctx.font = "13px monospace";
      ctx.fillStyle = "#88b090";
      const estadoMsg = miListo
        ? (rivalListo ? "¡Ambas flotas listas! Iniciando combate..." : "Esperando que el rival confirme su flota...")
        : "Posiciona tus 5 buques de combate y presiona [CONFIRMAR FLOTA]";
      ctx.fillText(estadoMsg, K.W / 2, 65);
    } else if (fase === "combate") {
      const miTurno = esMiTurno();
      ctx.fillStyle = miTurno ? "#39ff14" : "#ffb000";
      ctx.fillText(miTurno ? "🎯 TU TURNO — DISPARA AL RADAR ENEMIGO" : "⏳ TURNO DEL RIVAL — ESPERANDO IMPACTO...", K.W / 2, 40);

      ctx.font = "13px monospace";
      ctx.fillStyle = "#88b090";
      ctx.fillText("Portaaviones (5) · Acorazado (4) · Crucero (3) · Submarino (3) · Destructor (2)", K.W / 2, 65);
    }
  }

  function renderTablero(tab, titulo, esPropio) {
    ctx.save();
    ctx.translate(tab.x, tab.y);

    // Título del tablero
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = esPropio ? "#88b090" : "#39ff14";
    ctx.textAlign = "left";
    ctx.fillText(titulo, 0, -14);

    // Fondo del tablero con marco
    ctx.fillStyle = "#020704";
    ctx.fillRect(0, 0, GRID_PX, GRID_PX);
    ctx.strokeStyle = esPropio ? "#1a4025" : "#00ff66";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, GRID_PX, GRID_PX);

    // Coordenadas A-J (arriba) y 1-10 (izquierda)
    ctx.font = "10px monospace";
    ctx.fillStyle = "#558860";
    ctx.textAlign = "center";
    const letras = "ABCDEFGHIJ";
    for (let i = 0; i < 10; i++) {
      ctx.fillText(letras[i], i * CELL + CELL / 2, -4);
      ctx.fillText(i + 1, -12, i * CELL + CELL / 2 + 3);
    }

    // Líneas de la cuadrícula
    ctx.strokeStyle = "rgba(0, 255, 102, 0.12)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, GRID_PX);
      ctx.moveTo(0, i * CELL); ctx.lineTo(GRID_PX, i * CELL);
      ctx.stroke();
    }

    // Efecto de barrido de Sonar en el radar enemigo
    if (!esPropio) {
      const cx = GRID_PX / 2, cy = GRID_PX / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, GRID_PX, GRID_PX);
      ctx.clip();

      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, GRID_PX * 0.7);
      grad.addColorStop(0, "rgba(0, 255, 102, 0.05)");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, GRID_PX, GRID_PX);

      // Línea de barrido rotatoria
      ctx.strokeStyle = "rgba(57, 255, 20, 0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(L.sonarSweepAng) * GRID_PX, cy + Math.sin(L.sonarSweepAng) * GRID_PX);
      ctx.stroke();
      ctx.restore();
    }

    // Dibujar Barcos Propios
    if (esPropio) {
      const flota = (getFase() === "colocacion" && !L.confirmadoLocal)
        ? L.flotaLocal
        : ((net.rol === 1 && sim) ? sim.flotas[1] : (snap ? snap.miFlota : L.flotaLocal));

      if (flota) {
        flota.forEach((b, idx) => {
          const w = b.horiz ? b.tam * CELL - 4 : CELL - 4;
          const h = b.horiz ? CELL - 4 : b.tam * CELL - 4;
          const bx = b.x * CELL + 2;
          const by = b.y * CELL + 2;

          ctx.fillStyle = b.hundido ? "rgba(255, 51, 51, 0.3)" : "rgba(0, 229, 255, 0.25)";
          ctx.strokeStyle = b.hundido ? "#ff3333" : "#00e5ff";
          ctx.lineWidth = 2;
          ctx.strokeRect(bx, by, w, h);
          ctx.fillRect(bx, by, w, h);

          // Detalles decorativos del barco
          ctx.fillStyle = b.hundido ? "#ff3333" : "#00e5ff";
          ctx.fillRect(bx + 4, by + 4, 4, 4);
        });
      }
    }

    // Dibujar Disparos Recibidos / Realizados
    const disparosMatriz = esPropio
      ? ((net.rol === 1 && sim) ? sim.disparos[1] : (snap ? snap.misDisparosRecibidos : null))
      : ((net.rol === 1 && sim) ? sim.disparos[2] : (snap ? snap.disparosAlRival : null));

    if (disparosMatriz) {
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          const val = disparosMatriz[y][x];
          const px = x * CELL + CELL / 2;
          const py = y * CELL + CELL / 2;

          if (val === 1) {
            // Agua (Punto cian con onda)
            ctx.fillStyle = "#3399ff";
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "rgba(51, 153, 255, 0.4)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(px, py, 8, 0, Math.PI * 2);
            ctx.stroke();
          } else if (val === 2) {
            // Impacto (Cruz roja brillante con resplandor)
            ctx.strokeStyle = "#ff3333";
            ctx.lineWidth = 2.5;
            ctx.shadowColor = "#ff3333";
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(px - 7, py - 7); ctx.lineTo(px + 7, py + 7);
            ctx.moveTo(px + 7, py - 7); ctx.lineTo(px - 7, py + 7);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }
      }
    }

    // Hover de Puntería / Retícula
    if (!esPropio && L.hoverTablero === "rival" && L.hoverX >= 0 && L.hoverY >= 0) {
      const hx = L.hoverX * CELL;
      const hy = L.hoverY * CELL;

      ctx.strokeStyle = "#39ff14";
      ctx.lineWidth = 2;
      ctx.strokeRect(hx + 2, hy + 2, CELL - 4, CELL - 4);

      // Cruz de puntería
      const cx = hx + CELL / 2, cy = hy + CELL / 2;
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
      ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
      ctx.stroke();
    }

    ctx.restore();
  }

  function renderPanelColocacion() {
    if (L.confirmadoLocal) return;

    ctx.save();
    // Botón 1: Despliegue Aleatorio
    ctx.fillStyle = "rgba(0, 255, 102, 0.1)";
    ctx.strokeStyle = "#39ff14";
    ctx.lineWidth = 1.5;
    ctx.fillRect(70, 470, 140, 36);
    ctx.strokeRect(70, 470, 140, 36);

    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#39ff14";
    ctx.textAlign = "center";
    ctx.fillText("🎲 ALEATORIO", 140, 493);

    // Botón 2: Rotar
    ctx.fillStyle = "rgba(0, 255, 102, 0.1)";
    ctx.fillRect(220, 470, 100, 36);
    ctx.strokeRect(220, 470, 100, 36);
    ctx.fillText(L.horiz ? "🔄 HORIZ (R)" : "🔄 VERT (R)", 270, 493);

    // Botón 3: Confirmar Flota
    ctx.fillStyle = "#39ff14";
    ctx.fillRect(330, 470, 180, 36);
    ctx.fillStyle = "#000000";
    ctx.fillText("⚓ CONFIRMAR FLOTA", 420, 493);

    ctx.restore();
  }
})();
