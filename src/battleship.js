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
    barcoSeleccionadoIdx: null, // null = ningún barco seleccionado
    confirmadoLocal: false,
    hoverX: -1,
    hoverY: -1,
    hoverTablero: null, // "propio" | "rival"
    sonarSweepAng: 0,
    animImpacto: null
  };

  const FLECHA_R = 13; // radio de los botones circulares de rotación

  function inicializarFlotaLocal() {
    L.flotaLocal = [
      { id: "carrier", nombre: "Portaaviones", tam: 5, x: 0, y: 0, horiz: true },
      { id: "battleship", nombre: "Acorazado", tam: 4, x: 0, y: 2, horiz: true },
      { id: "cruiser", nombre: "Crucero", tam: 3, x: 0, y: 4, horiz: true },
      { id: "submarine", nombre: "Submarino", tam: 3, x: 0, y: 6, horiz: true },
      { id: "destroyer", nombre: "Destructor", tam: 2, x: 0, y: 8, horiz: true }
    ];
    L.barcoSeleccionadoIdx = null;
    L.confirmadoLocal = false;
  }

  // --- Helpers de geometría de la flota (colocación) ---
  function ocupaCelda(barco, cx, cy) {
    for (let i = 0; i < barco.tam; i++) {
      const x = barco.horiz ? barco.x + i : barco.x;
      const y = barco.horiz ? barco.y : barco.y + i;
      if (x === cx && y === cy) return true;
    }
    return false;
  }

  function posicionValida(flota, idxExcluir, x, y, tam, horiz) {
    if (x < 0 || y < 0) return false;
    if (horiz && x + tam > 10) return false;
    if (!horiz && y + tam > 10) return false;
    for (let i = 0; i < tam; i++) {
      const cx = horiz ? x + i : x;
      const cy = horiz ? y : y + i;
      for (let j = 0; j < flota.length; j++) {
        if (j === idxExcluir) continue;
        if (ocupaCelda(flota[j], cx, cy)) return false;
      }
    }
    return true;
  }

  function moverBarcoSeleccionado(cx, cy) {
    const idx = L.barcoSeleccionadoIdx;
    const barco = L.flotaLocal[idx];
    if (!barco) return;
    if (posicionValida(L.flotaLocal, idx, cx, cy, barco.tam, barco.horiz)) {
      barco.x = cx;
      barco.y = cy;
      RetroAudio.playPongBeep(false);
    } else {
      RetroAudio.playError();
    }
  }

  // Rota el barco seleccionado 90° pivotando sobre su propio centro, con
  // ajuste a los límites del tablero y validación de solapamiento. Si no
  // entra en ninguna posición cercana, la rotación se rechaza (sonido de error).
  function rotarBarcoSeleccionado(sentidoHorario) {
    const idx = L.barcoSeleccionadoIdx;
    const barco = L.flotaLocal[idx];
    if (!barco) return;

    const tam = barco.tam;
    const nuevoHoriz = !barco.horiz;
    const w = barco.horiz ? tam : 1;
    const h = barco.horiz ? 1 : tam;
    const centerX = barco.x + (w - 1) / 2;
    const centerY = barco.y + (h - 1) / 2;

    let nx, ny;
    if (nuevoHoriz) {
      nx = Math.round(centerX - (tam - 1) / 2);
      ny = Math.round(centerY);
    } else {
      nx = Math.round(centerX);
      ny = Math.round(centerY - (tam - 1) / 2);
    }
    nx = Math.max(0, Math.min(nx, nuevoHoriz ? 10 - tam : 9));
    ny = Math.max(0, Math.min(ny, nuevoHoriz ? 9 : 10 - tam));

    if (posicionValida(L.flotaLocal, idx, nx, ny, tam, nuevoHoriz)) {
      barco.x = nx;
      barco.y = ny;
      barco.horiz = nuevoHoriz;
      RetroAudio.playPongBeep(sentidoHorario);
    } else {
      RetroAudio.playError();
    }
  }

  // Posición en pantalla de los dos botones de rotación (CCW/CW) del barco
  // seleccionado: justo al costado de su centro, con el eje perpendicular
  // a su orientación actual, y siempre dentro del área del tablero propio.
  function posicionFlechas(barco) {
    const w = barco.horiz ? barco.tam : 1;
    const h = barco.horiz ? 1 : barco.tam;
    let cx = TAB_PROPIO.x + (barco.x + w / 2) * CELL;
    let cy = TAB_PROPIO.y + (barco.y + h / 2) * CELL;
    if (barco.horiz) cy += (h * CELL) / 2 + 20;
    else cx += (w * CELL) / 2 + 20;
    cx = Math.min(Math.max(cx, TAB_PROPIO.x + 18), TAB_PROPIO.x + GRID_PX - 18);
    cy = Math.min(Math.max(cy, TAB_PROPIO.y + 18), TAB_PROPIO.y + GRID_PX - 18);
    return { ccwX: cx - 16, ccwY: cy, cwX: cx + 16, cwY: cy };
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
      // Botón Aleatorio (x: 70, y: 470, w: 160, h: 36)
      if (m.x >= 70 && m.x <= 230 && m.y >= 470 && m.y <= 506) {
        if (net.rol === 1 && sim) {
          L.flotaLocal = sim.generarFlotaAleatoria();
        } else {
          // Generar aleatorio localmente para Guest
          const tempSim = new BattleshipSim();
          L.flotaLocal = tempSim.generarFlotaAleatoria();
        }
        L.barcoSeleccionadoIdx = null;
        RetroAudio.playPongBeep(true);
        return;
      }

      // Botón Confirmar Flota (x: 250, y: 470, w: 220, h: 36)
      if (m.x >= 250 && m.x <= 470 && m.y >= 470 && m.y <= 506) {
        confirmarFlota();
        return;
      }

      // Flechas de rotación del barco seleccionado (si hay uno)
      if (L.barcoSeleccionadoIdx !== null && L.flotaLocal[L.barcoSeleccionadoIdx]) {
        const f = posicionFlechas(L.flotaLocal[L.barcoSeleccionadoIdx]);
        if (Math.hypot(m.x - f.ccwX, m.y - f.ccwY) <= FLECHA_R) { rotarBarcoSeleccionado(false); return; }
        if (Math.hypot(m.x - f.cwX, m.y - f.cwY) <= FLECHA_R) { rotarBarcoSeleccionado(true); return; }
      }

      // Clic en tablero propio: seleccionar un barco, o mover el ya seleccionado
      const cPropio = celdaDesdePos(m.x, m.y, TAB_PROPIO);
      if (cPropio) {
        const idxClic = L.flotaLocal.findIndex(b => ocupaCelda(b, cPropio.cx, cPropio.cy));
        if (idxClic >= 0) {
          L.barcoSeleccionadoIdx = idxClic;
          RetroAudio.playPongBeep(false);
        } else if (L.barcoSeleccionadoIdx !== null) {
          moverBarcoSeleccionado(cPropio.cx, cPropio.cy);
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

  function confirmarFlota() {
    // Chequeo local defensivo: si por algún motivo la flota quedara inválida
    // (solapada o fuera de rango), no la bloqueamos como confirmada — eso
    // dejaría al jugador sin poder editar y a la partida sin arrancar nunca.
    const tempSim = (net.rol === 1 && sim) ? sim : new BattleshipSim();
    if (!tempSim.validarFlota(L.flotaLocal)) {
      RetroAudio.playError();
      return;
    }

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
    },

    iniciarGuest() {
      sim = null;
      snap = null;
      inicializarFlotaLocal();
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerdown", onPointerDown);
    },

    destruir() {
      sim = null;
      snap = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
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
      renderSeleccionYFlechas();
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
        : "Click en un barco para seleccionarlo y rotarlo · click en otra celda para moverlo";
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
    ctx.fillRect(70, 470, 160, 36);
    ctx.strokeRect(70, 470, 160, 36);

    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#39ff14";
    ctx.textAlign = "center";
    ctx.fillText("🎲 ALEATORIO", 150, 493);

    // Botón 2: Confirmar Flota
    ctx.fillStyle = "#39ff14";
    ctx.fillRect(250, 470, 220, 36);
    ctx.fillStyle = "#000000";
    ctx.fillText("⚓ CONFIRMAR FLOTA", 360, 493);

    ctx.restore();
  }

  // Resalta el barco seleccionado y dibuja sus dos botones de rotación
  // (sentido horario / antihorario) justo al costado.
  function renderSeleccionYFlechas() {
    if (L.confirmadoLocal) return;
    if (L.barcoSeleccionadoIdx === null) return;
    const barco = L.flotaLocal[L.barcoSeleccionadoIdx];
    if (!barco) return;

    const w = barco.horiz ? barco.tam * CELL - 4 : CELL - 4;
    const h = barco.horiz ? CELL - 4 : barco.tam * CELL - 4;
    const bx = TAB_PROPIO.x + barco.x * CELL + 2;
    const by = TAB_PROPIO.y + barco.y * CELL + 2;

    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 8;
    ctx.strokeRect(bx - 3, by - 3, w + 6, h + 6);
    ctx.restore();

    const f = posicionFlechas(barco);
    dibujarFlechaRotacion(f.ccwX, f.ccwY, "↺");
    dibujarFlechaRotacion(f.cwX, f.cwY, "↻");
  }

  function dibujarFlechaRotacion(cx, cy, glifo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, FLECHA_R, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 20, 10, 0.9)";
    ctx.fill();
    ctx.strokeStyle = "#39ff14";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#39ff14";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(glifo, cx, cy + 1);
    ctx.restore();
  }
})();
