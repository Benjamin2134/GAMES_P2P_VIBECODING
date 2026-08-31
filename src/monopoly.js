// ==========================================================================
//  Módulo de juego: MONOPOLY DUEL (Board Tycoon)  -  JUEGOS.monopoly
//  Tablero perimetral 24 casillas, tirada de dados, compras, casas y bancarrota.
//  Usa los globales del shell: cv, ctx, net.
// ==========================================================================

(function () {
  const K = MONOPOLY;

  let sim = null;
  let snap = null;
  let animDados = 0; // Temporizador para animación visual de dados

  // Posiciones de las 24 casillas en el canvas (Centro: x: 230..730, y: 50..550)
  const BOARD_X = 230;
  const BOARD_Y = 30;
  const BOARD_SIZE = 500;
  const CASILLAS_POS = [];

  // Calcular posiciones (x, y, w, h) de las 24 casillas alrededor del perímetro 6x6
  (function calcularPosicionesCasillas() {
    const nLado = 6; // 6 casillas por lado (esquinas compartidas)
    const esquinaSize = 90;
    const calleSize = (BOARD_SIZE - esquinaSize * 2) / 4; // 80px cada calle intermedia

    // 0: Abajo-Derecha (SALIDA)
    // 0..6: Borde Inferior (de derecha a izquierda)
    // 6..12: Borde Izquierdo (de abajo a arriba)
    // 12..18: Borde Superior (de izquierda a derecha)
    // 18..23: Borde Derecho (de arriba a abajo)

    for (let i = 0; i < 24; i++) {
      let x = 0, y = 0, w = calleSize, h = calleSize;
      if (i === 0) {
        // Salida (Abajo-Derecha)
        x = BOARD_X + BOARD_SIZE - esquinaSize;
        y = BOARD_Y + BOARD_SIZE - esquinaSize;
        w = esquinaSize; h = esquinaSize;
      } else if (i >= 1 && i <= 5) {
        // Borde Inferior
        x = BOARD_X + BOARD_SIZE - esquinaSize - i * calleSize;
        y = BOARD_Y + BOARD_SIZE - esquinaSize;
        w = calleSize; h = esquinaSize;
      } else if (i === 6) {
        // Cárcel (Abajo-Izquierda)
        x = BOARD_X;
        y = BOARD_Y + BOARD_SIZE - esquinaSize;
        w = esquinaSize; h = esquinaSize;
      } else if (i >= 7 && i <= 11) {
        // Borde Izquierdo
        x = BOARD_X;
        y = BOARD_Y + BOARD_SIZE - esquinaSize - (i - 6) * calleSize;
        w = esquinaSize; h = calleSize;
      } else if (i === 12) {
        // Parking Libre (Arriba-Izquierda)
        x = BOARD_X;
        y = BOARD_Y;
        w = esquinaSize; h = esquinaSize;
      } else if (i >= 13 && i <= 17) {
        // Borde Superior
        x = BOARD_X + esquinaSize + (i - 13) * calleSize;
        y = BOARD_Y;
        w = calleSize; h = esquinaSize;
      } else if (i === 18) {
        // Ve a la Cárcel (Arriba-Derecha)
        x = BOARD_X + BOARD_SIZE - esquinaSize;
        y = BOARD_Y;
        w = esquinaSize; h = esquinaSize;
      } else if (i >= 19 && i <= 23) {
        // Borde Derecho
        x = BOARD_X + BOARD_SIZE - esquinaSize;
        y = BOARD_Y + esquinaSize + (i - 19) * calleSize;
        w = esquinaSize; h = calleSize;
      }
      CASILLAS_POS.push({ x, y, w, h });
    }
  })();

  function mouseXY(e) {
    const r = cv.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * K.W,
      y: ((e.clientY - r.top) / r.height) * K.H
    };
  }

  function onPointerDown(e) {
    const m = mouseXY(e);
    if (!snap || snap.ganador) return;
    const miTurno = snap.turno === net.rol;
    if (!miTurno) return;

    // 1. Botón Tirar Dados en el centro (x: 410, y: 310, w: 140, h: 42)
    if (snap.fase === "tirar") {
      if (m.x >= 410 && m.x <= 550 && m.y >= 310 && m.y <= 352) {
        ejecutarTirada();
        return;
      }
    }

    // 2. Botón Comprar Propiedad (x: 350, y: 380, w: 120, h: 36)
    if (snap.fase === "accion") {
      const j = net.rol === 1 ? snap.j1 : snap.j2;
      const c = K.CASILLAS[j.pos];
      const esComprable = (c.t === "calle" || c.t === "estacion") && !snap.props[c.idx] && j.dinero >= c.precio;

      if (esComprable && m.x >= 350 && m.x <= 470 && m.y >= 380 && m.y <= 416) {
        ejecutarCompra();
        return;
      }

      // Botón Pasar Turno (x: 490, y: 380, w: 120, h: 36)
      if (m.x >= 490 && m.x <= 610 && m.y >= 380 && m.y <= 416) {
        ejecutarPasarTurno();
        return;
      }

      // Botón Construir Casa si corresponde (x: 410, y: 425, w: 140, h: 32)
      const propMía = snap.props[c.idx] && snap.props[c.idx].duenio === net.rol && c.t === "calle" && snap.props[c.idx].casas < 3 && j.dinero >= c.casa;
      if (propMía && m.x >= 410 && m.x <= 550 && m.y >= 425 && m.y <= 457) {
        ejecutarConstruir(c.idx);
        return;
      }
    }
  }

  function ejecutarTirada() {
    animDados = 0.5;
    RetroAudio.playPongBeep(true);

    if (net.rol === 1 && sim) {
      sim.tirarDados(1);
    } else {
      net.enviar({ t: "mono_roll" });
    }
  }

  function ejecutarCompra() {
    RetroAudio.playSonar();
    if (net.rol === 1 && sim) {
      sim.comprarPropiedad(1);
    } else {
      net.enviar({ t: "mono_buy" });
    }
  }

  function ejecutarConstruir(idx) {
    RetroAudio.playSonar();
    if (net.rol === 1 && sim) {
      sim.construirCasa(1, idx);
    } else {
      net.enviar({ t: "mono_build", idx });
    }
  }

  function ejecutarPasarTurno() {
    RetroAudio.playPongBeep(false);
    if (net.rol === 1 && sim) {
      sim.pasarTurno(1);
    } else {
      net.enviar({ t: "mono_pass" });
    }
  }

  // --- Registro del Juego en JUEGOS ---
  JUEGOS.monopoly = {
    nombre: "MONOPOLY DUEL",
    desc: "Duelo de magnates en tablero de 24 casillas. Compra calles, construye casas, cobra alquileres y arruina al rival.",
    canvas: { w: K.W, h: K.H },

    iniciarHost() {
      sim = new MonopolySim();
      snap = null;
      window.addEventListener("pointerdown", onPointerDown);
    },

    iniciarGuest() {
      sim = null;
      snap = null;
      window.addEventListener("pointerdown", onPointerDown);
    },

    destruir() {
      sim = null;
      snap = null;
      window.removeEventListener("pointerdown", onPointerDown);
    },

    onData(msg) {
      if (typeof msg !== "object" || !msg) return;

      if (net.rol === 1 && sim) {
        if (msg.t === "mono_roll") {
          sim.tirarDados(2);
        } else if (msg.t === "mono_buy") {
          sim.comprarPropiedad(2);
        } else if (msg.t === "mono_build") {
          sim.construirCasa(2, msg.idx);
        } else if (msg.t === "mono_pass") {
          sim.pasarTurno(2);
        } else if (msg.t === "mono_rev") {
          sim.pedirRevancha(2);
        }
        return;
      }

      if (net.rol === 2 && msg.t === "e" && msg.snap) {
        snap = msg.snap;
      }
    },

    frame(now, dtSeg, pausado) {
      if (net.rol === 1 && sim) {
        snap = sim.snapshot();
        net.enviar({ t: "e", snap });
      }

      if (animDados > 0) animDados -= dtSeg;
      renderMonopoly();
    },

    overlay() {
      if (!snap) return null;
      if (snap.ganador) {
        const ganeYo = snap.ganador === net.rol;
        const revanchaPedida = (net.rol === 1 && sim) ? sim.revancha[net.rol] : (snap ? snap.revancha[net.rol] : false);

        return {
          texto: ganeYo ? "¡MAGNATE VICTORIOSO!" : "BANCARROTA",
          sub: ganeYo ? "Has dominado el mercado inmobiliario" : "Te quedaste sin fondos para operar",
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
        net.enviar({ t: "mono_rev" });
      }
    }
  };

  // ==========================================================================
  //  RENDERIZADO CANVAS 2D (Estética Board Tycoon Art Decó)
  // ==========================================================================
  function renderMonopoly() {
    // Fondo de mesa de paño verde oscuro
    ctx.fillStyle = "#0c1813";
    ctx.fillRect(0, 0, K.W, K.H);

    if (!snap) return;

    // 1. Render Tablero Perimetral
    renderTablero();

    // 2. Render Fichas de Jugadores
    renderFichas();

    // 3. Render Centro del Tablero (Dados, Acciones y Eventos)
    renderCentro();

    // 4. Render Paneles Laterales (Patrimonio J1 y J2)
    renderPanelesLaterales();
  }

  function renderTablero() {
    // Fondo central del tablero
    ctx.fillStyle = "#12241d";
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE);
    ctx.strokeStyle = "#2d5243";
    ctx.lineWidth = 3;
    ctx.strokeRect(BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE);

    // Dibujar cada casilla
    for (let i = 0; i < 24; i++) {
      const c = K.CASILLAS[i];
      const pos = CASILLAS_POS[i];

      // Fondo de casilla
      ctx.fillStyle = "#e9dec9";
      ctx.fillRect(pos.x, pos.y, pos.w, pos.h);
      ctx.strokeStyle = "#382e25";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pos.x, pos.y, pos.w, pos.h);

      // Franja de color del grupo de la calle
      if (c.col && c.t === "calle") {
        ctx.fillStyle = c.col;
        ctx.fillRect(pos.x + 1, pos.y + 1, pos.w - 2, 14);
      }

      // Nombre y precio
      ctx.font = "bold 9px sans-serif";
      ctx.fillStyle = "#1a1a1a";
      ctx.textAlign = "center";

      // Abreviar o ajustar nombre
      const nombreCorto = c.nombre.length > 12 ? c.nombre.substring(0, 11) + "." : c.nombre;
      ctx.fillText(nombreCorto, pos.x + pos.w / 2, pos.y + pos.h / 2);

      if (c.precio) {
        ctx.font = "bold 9px sans-serif";
        ctx.fillStyle = "#27ae60";
        ctx.fillText(`$${c.precio}`, pos.x + pos.w / 2, pos.y + pos.h - 6);
      }

      // Marcador de Dueño y Casas
      const prop = snap.props[i];
      if (prop) {
        const colDuenio = prop.duenio === 1 ? "#00e5ff" : "#ff0055";
        ctx.fillStyle = colDuenio;
        ctx.fillRect(pos.x + pos.w - 12, pos.y + 2, 10, 10);

        if (prop.casas > 0) {
          ctx.font = "bold 10px sans-serif";
          ctx.fillStyle = "#f1c40f";
          ctx.fillText("★".repeat(prop.casas), pos.x + pos.w / 2, pos.y + pos.h - 18);
        }
      }
    }
  }

  function renderFichas() {
    // Posición J1 (Cian)
    const p1 = CASILLAS_POS[snap.j1.pos];
    ctx.fillStyle = "#00e5ff";
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p1.x + p1.w * 0.35, p1.y + p1.h * 0.7, 8, 0, Math.PI * 2);
    ctx.fill();

    // Posición J2 (Magenta)
    const p2 = CASILLAS_POS[snap.j2.pos];
    ctx.fillStyle = "#ff0055";
    ctx.shadowColor = "#ff0055";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p2.x + p2.w * 0.65, p2.y + p2.h * 0.7, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function renderCentro() {
    const miTurno = snap.turno === net.rol;
    const jAct = snap.turno === 1 ? snap.j1 : snap.j2;
    const cAct = K.CASILLAS[jAct.pos];

    // Título del Centro
    ctx.font = "bold 18px sans-serif";
    ctx.fillStyle = snap.turno === 1 ? "#00e5ff" : "#ff0055";
    ctx.textAlign = "center";
    ctx.fillText(`TURNO: JUGADOR ${snap.turno}`, BOARD_X + BOARD_SIZE / 2, BOARD_Y + 110);

    // Evento reciente
    if (snap.evento) {
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#e0e0e0";
      ctx.fillText(snap.evento.msg, BOARD_X + BOARD_SIZE / 2, BOARD_Y + 140);
    }

    // Bote de Parking
    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "#f39c12";
    ctx.fillText(`🅿️ BOTE PARKING: $${snap.parking}`, BOARD_X + BOARD_SIZE / 2, BOARD_Y + 175);

    // Dados
    const d1 = animDados > 0 ? Math.floor(Math.random() * 6) + 1 : snap.dados[0];
    const d2 = animDados > 0 ? Math.floor(Math.random() * 6) + 1 : snap.dados[1];
    dibujarDado(BOARD_X + BOARD_SIZE / 2 - 40, BOARD_Y + 220, d1);
    dibujarDado(BOARD_X + BOARD_SIZE / 2 + 10, BOARD_Y + 220, d2);

    // Botones según fase
    if (snap.fase === "tirar" && miTurno) {
      ctx.fillStyle = "#2ecc71";
      ctx.fillRect(410, 310, 140, 42);
      ctx.font = "bold 14px sans-serif";
      ctx.fillStyle = "#000000";
      ctx.fillText("🎲 TIRAR DADOS", 480, 336);
    }

    if (snap.fase === "accion" && miTurno) {
      const prop = snap.props[cAct.idx];
      const esComprable = (cAct.t === "calle" || cAct.t === "estacion") && !prop && jAct.dinero >= cAct.precio;

      if (esComprable) {
        ctx.fillStyle = "#27ae60";
        ctx.fillRect(350, 380, 120, 36);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText(`COMPRAR ($${cAct.precio})`, 410, 402);
      }

      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(490, 380, 120, 36);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("PASAR TURNO", 550, 402);

      // Mejorar casa si tiene monopolio
      if (prop && prop.duenio === net.rol && cAct.t === "calle" && prop.casas < 3 && jAct.dinero >= cAct.casa) {
        ctx.fillStyle = "#f39c12";
        ctx.fillRect(410, 425, 140, 32);
        ctx.fillStyle = "#000000";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText(`+1 CASA ($${cAct.casa})`, 480, 445);
      }
    }
  }

  function dibujarDado(x, y, val) {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, 32, 32);
    ctx.strokeRect(x, y, 32, 32);

    ctx.fillStyle = "#000000";
    const cx = x + 16, cy = y + 16;
    if (val % 2 === 1) ctx.fillRect(cx - 2, cy - 2, 4, 4); // Centro
    if (val > 1) { ctx.fillRect(x + 5, y + 5, 4, 4); ctx.fillRect(x + 23, y + 23, 4, 4); }
    if (val > 3) { ctx.fillRect(x + 23, y + 5, 4, 4); ctx.fillRect(x + 5, y + 23, 4, 4); }
    if (val === 6) { ctx.fillRect(x + 5, cy - 2, 4, 4); ctx.fillRect(x + 23, cy - 2, 4, 4); }
  }

  function renderPanelesLaterales() {
    // Panel J1 (Izquierda: x: 20..210, y: 30..530)
    renderPanelJugador(20, 30, 190, 500, snap.j1, 1, "#00e5ff");

    // Panel J2 (Derecha: x: 750..940, y: 30..530)
    renderPanelJugador(750, 30, 190, 500, snap.j2, 2, "#ff0055");
  }

  function renderPanelJugador(x, y, w, h, j, id, col) {
    ctx.fillStyle = "#0d1a15";
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    ctx.font = "bold 15px sans-serif";
    ctx.fillStyle = col;
    ctx.textAlign = "left";
    ctx.fillText(`JUGADOR ${id} ${id === net.rol ? '(TÚ)' : ''}`, x + 12, y + 28);

    ctx.font = "bold 18px monospace";
    ctx.fillStyle = "#2ecc71";
    ctx.fillText(`$${j.dinero}`, x + 12, y + 58);

    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#88b090";
    ctx.fillText(`Patrimonio: $${j.pat}`, x + 12, y + 80);

    if (j.enCarcel) {
      ctx.fillStyle = "#e74c3c";
      ctx.fillText(`🚨 EN CÁRCEL (${j.turnosCarcel}/3)`, x + 12, y + 104);
    }

    // Listado de Propiedades
    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("PROPIEDADES:", x + 12, y + 130);

    let py = y + 150;
    for (let idx in snap.props) {
      const p = snap.props[idx];
      if (p.duenio === id) {
        const c = K.CASILLAS[idx];
        ctx.fillStyle = c.col || "#bdc3c7";
        ctx.fillRect(x + 12, py - 10, 8, 8);

        ctx.font = "11px sans-serif";
        ctx.fillStyle = "#e0e0e0";
        const estrellas = p.casas > 0 ? ` (${"★".repeat(p.casas)})` : "";
        ctx.fillText(`${c.nombre}${estrellas}`, x + 24, py - 2);
        py += 18;
      }
    }
  }
})();
