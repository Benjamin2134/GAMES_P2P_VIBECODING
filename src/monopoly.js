// ==========================================================================
//  Módulo de juego: MONOPOLY DUEL (Board Tycoon)  -  JUEGOS.monopoly
//  Tablero perimetral 24 casillas cuadradas perfectas, dados, compras y bancarrota.
//  Usa los globales del shell: cv, ctx, net.
// ==========================================================================

(function () {
  const K = MONOPOLY;

  let sim = null;
  let snap = null;
  let animDados = 0;

  // Parámetros de geometría del tablero (Canvas W: 960, H: 600)
  const BOARD_X = 210;
  const BOARD_Y = 30;
  const BOARD_SIZE = 540;
  const ESQUINA_SIZE = 85;
  const N_INTERMEDIAS = 5; // 5 casillas intermedias por lado (5 * 4 + 4 esquinas = 24 casillas)
  const CALLE_SIZE = (BOARD_SIZE - ESQUINA_SIZE * 2) / N_INTERMEDIAS; // (540 - 170) / 5 = 74 px

  const CASILLAS_POS = [];

  // Calcular posiciones exactas sin solape de las 24 casillas
  (function calcularPosiciones() {
    for (let i = 0; i < 24; i++) {
      let x = 0, y = 0, w = CALLE_SIZE, h = CALLE_SIZE;

      if (i === 0) {
        // Esquina Inferior Derecha (SALIDA)
        x = BOARD_X + BOARD_SIZE - ESQUINA_SIZE;
        y = BOARD_Y + BOARD_SIZE - ESQUINA_SIZE;
        w = ESQUINA_SIZE; h = ESQUINA_SIZE;
      } else if (i >= 1 && i <= 5) {
        // Borde Inferior (de derecha a izquierda)
        x = BOARD_X + BOARD_SIZE - ESQUINA_SIZE - i * CALLE_SIZE;
        y = BOARD_Y + BOARD_SIZE - ESQUINA_SIZE;
        w = CALLE_SIZE; h = ESQUINA_SIZE;
      } else if (i === 6) {
        // Esquina Inferior Izquierda (CÁRCEL)
        x = BOARD_X;
        y = BOARD_Y + BOARD_SIZE - ESQUINA_SIZE;
        w = ESQUINA_SIZE; h = ESQUINA_SIZE;
      } else if (i >= 7 && i <= 11) {
        // Borde Izquierdo (de abajo hacia arriba)
        x = BOARD_X;
        y = BOARD_Y + BOARD_SIZE - ESQUINA_SIZE - (i - 6) * CALLE_SIZE;
        w = ESQUINA_SIZE; h = CALLE_SIZE;
      } else if (i === 12) {
        // Esquina Superior Izquierda (PARKING LIBRE)
        x = BOARD_X;
        y = BOARD_Y;
        w = ESQUINA_SIZE; h = ESQUINA_SIZE;
      } else if (i >= 13 && i <= 17) {
        // Borde Superior (de izquierda a derecha)
        x = BOARD_X + ESQUINA_SIZE + (i - 13) * CALLE_SIZE;
        y = BOARD_Y;
        w = CALLE_SIZE; h = ESQUINA_SIZE;
      } else if (i === 18) {
        // Esquina Superior Derecha (VE A LA CÁRCEL)
        x = BOARD_X + BOARD_SIZE - ESQUINA_SIZE;
        y = BOARD_Y;
        w = ESQUINA_SIZE; h = ESQUINA_SIZE;
      } else if (i >= 19 && i <= 23) {
        // Borde Derecho (de arriba hacia abajo)
        x = BOARD_X + BOARD_SIZE - ESQUINA_SIZE;
        y = BOARD_Y + ESQUINA_SIZE + (i - 19) * CALLE_SIZE;
        w = ESQUINA_SIZE; h = CALLE_SIZE;
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

    // 1. Botón Tirar Dados (Centro)
    if (snap.fase === "tirar") {
      if (m.x >= 410 && m.x <= 550 && m.y >= 310 && m.y <= 355) {
        ejecutarTirada();
        return;
      }
    }

    // 2. Fase de Acción
    if (snap.fase === "accion") {
      const j = net.rol === 1 ? snap.j1 : snap.j2;
      const c = K.CASILLAS[j.pos];
      const prop = snap.props[c.idx];
      const esComprable = (c.t === "calle" || c.t === "estacion") && !prop && j.dinero >= c.precio;

      if (esComprable) {
        // Botón Comprar
        if (m.x >= 350 && m.x <= 470 && m.y >= 380 && m.y <= 420) {
          ejecutarCompra();
          return;
        }
        // Botón Pasar Turno (a la derecha)
        if (m.x >= 490 && m.x <= 610 && m.y >= 380 && m.y <= 420) {
          ejecutarPasarTurno();
          return;
        }
      } else {
        // Botón Pasar Turno (centrado)
        if (m.x >= 410 && m.x <= 550 && m.y >= 380 && m.y <= 420) {
          ejecutarPasarTurno();
          return;
        }
      }

      // Botón Construir Casa (+1 Casa)
      if (prop && prop.duenio === net.rol && c.t === "calle" && prop.casas < 3 && j.dinero >= c.casa) {
        if (m.x >= 410 && m.x <= 550 && m.y >= 430 && m.y <= 465) {
          ejecutarConstruir(c.idx);
          return;
        }
      }
    }
  }

  function ejecutarTirada() {
    animDados = 0.45;
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
    ctx.fillStyle = "#0a1610";
    ctx.fillRect(0, 0, K.W, K.H);

    if (!snap) return;

    renderTablero();
    renderFichas();
    renderCentro();
    renderPanelesLaterales();
  }

  function renderTablero() {
    ctx.fillStyle = "#10231b";
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE);
    ctx.strokeStyle = "#294d3c";
    ctx.lineWidth = 3;
    ctx.strokeRect(BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE);

    for (let i = 0; i < 24; i++) {
      const c = K.CASILLAS[i];
      const pos = CASILLAS_POS[i];

      // Fondo de casilla pergamino
      ctx.fillStyle = "#ebdcc2";
      ctx.fillRect(pos.x, pos.y, pos.w, pos.h);
      ctx.strokeStyle = "#423223";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(pos.x, pos.y, pos.w, pos.h);

      // Franja de color del grupo de la calle
      if (c.col && c.t === "calle") {
        ctx.fillStyle = c.col;
        ctx.fillRect(pos.x + 1, pos.y + 1, pos.w - 2, 13);
      }

      // Nombre de la casilla
      ctx.font = "bold 9px sans-serif";
      ctx.fillStyle = "#111111";
      ctx.textAlign = "center";
      const nombreCorto = c.nombre.length > 12 ? c.nombre.substring(0, 11) + "." : c.nombre;
      ctx.fillText(nombreCorto, pos.x + pos.w / 2, pos.y + pos.h / 2);

      // Precio si es comprable
      if (c.precio) {
        ctx.font = "bold 9px monospace";
        ctx.fillStyle = "#1e7e34";
        ctx.fillText(`$${c.precio}`, pos.x + pos.w / 2, pos.y + pos.h - 6);
      }

      // Marcador de Dueño y Casas
      const prop = snap.props[i];
      if (prop) {
        const colDuenio = prop.duenio === 1 ? "#00e5ff" : "#ff0055";
        ctx.fillStyle = colDuenio;
        ctx.fillRect(pos.x + pos.w - 11, pos.y + 2, 9, 9);

        if (prop.casas > 0) {
          ctx.font = "bold 10px sans-serif";
          ctx.fillStyle = "#f39c12";
          ctx.fillText("★".repeat(prop.casas), pos.x + pos.w / 2, pos.y + pos.h - 18);
        }
      }
    }
  }

  function renderFichas() {
    const p1 = CASILLAS_POS[snap.j1.pos];
    ctx.fillStyle = "#00e5ff";
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p1.x + p1.w * 0.35, p1.y + p1.h * 0.7, 7.5, 0, Math.PI * 2);
    ctx.fill();

    const p2 = CASILLAS_POS[snap.j2.pos];
    ctx.fillStyle = "#ff0055";
    ctx.shadowColor = "#ff0055";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p2.x + p2.w * 0.65, p2.y + p2.h * 0.7, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function renderCentro() {
    const miTurno = snap.turno === net.rol;
    const jAct = snap.turno === 1 ? snap.j1 : snap.j2;
    const cAct = K.CASILLAS[jAct.pos];

    // Turno Actual
    ctx.font = "bold 18px sans-serif";
    ctx.fillStyle = snap.turno === 1 ? "#00e5ff" : "#ff0055";
    ctx.textAlign = "center";
    ctx.fillText(`TURNO: JUGADOR ${snap.turno} ${miTurno ? '(TÚ)' : ''}`, BOARD_X + BOARD_SIZE / 2, BOARD_Y + 115);

    // Evento reciente
    if (snap.evento) {
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#e0e0e0";
      ctx.fillText(snap.evento.msg, BOARD_X + BOARD_SIZE / 2, BOARD_Y + 145);
    }

    // Bote de Parking
    ctx.font = "bold 13px sans-serif";
    ctx.fillStyle = "#f39c12";
    ctx.fillText(`🅿️ BOTE PARKING: $${snap.parking}`, BOARD_X + BOARD_SIZE / 2, BOARD_Y + 180);

    // Animación de Dados
    const d1 = animDados > 0 ? Math.floor(Math.random() * 6) + 1 : snap.dados[0];
    const d2 = animDados > 0 ? Math.floor(Math.random() * 6) + 1 : snap.dados[1];
    dibujarDado(BOARD_X + BOARD_SIZE / 2 - 38, BOARD_Y + 215, d1);
    dibujarDado(BOARD_X + BOARD_SIZE / 2 + 6, BOARD_Y + 215, d2);

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
        ctx.fillRect(350, 380, 120, 38);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText(`COMPRAR ($${cAct.precio})`, 410, 403);

        ctx.fillStyle = "#e74c3c";
        ctx.fillRect(490, 380, 120, 38);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText("PASAR TURNO", 550, 403);
      } else {
        ctx.fillStyle = "#e74c3c";
        ctx.fillRect(410, 380, 140, 38);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("PASAR TURNO", 480, 403);
      }

      if (prop && prop.duenio === net.rol && cAct.t === "calle" && prop.casas < 3 && jAct.dinero >= cAct.casa) {
        ctx.fillStyle = "#f39c12";
        ctx.fillRect(410, 430, 140, 32);
        ctx.fillStyle = "#000000";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText(`+1 CASA ($${cAct.casa})`, 480, 450);
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
    if (val % 2 === 1) ctx.fillRect(cx - 2, cy - 2, 4, 4);
    if (val > 1) { ctx.fillRect(x + 5, y + 5, 4, 4); ctx.fillRect(x + 23, y + 23, 4, 4); }
    if (val > 3) { ctx.fillRect(x + 23, y + 5, 4, 4); ctx.fillRect(x + 5, y + 23, 4, 4); }
    if (val === 6) { ctx.fillRect(x + 5, cy - 2, 4, 4); ctx.fillRect(x + 23, cy - 2, 4, 4); }
  }

  function renderPanelesLaterales() {
    renderPanelJugador(15, 30, 180, 540, snap.j1, 1, "#00e5ff");
    renderPanelJugador(765, 30, 180, 540, snap.j2, 2, "#ff0055");
  }

  function renderPanelJugador(x, y, w, h, j, id, col) {
    ctx.fillStyle = "#0d1c15";
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = col;
    ctx.textAlign = "left";
    ctx.fillText(`JUGADOR ${id} ${id === net.rol ? '(TÚ)' : ''}`, x + 10, y + 26);

    ctx.font = "bold 17px monospace";
    ctx.fillStyle = "#2ecc71";
    ctx.fillText(`$${j.dinero}`, x + 10, y + 54);

    ctx.font = "11px sans-serif";
    ctx.fillStyle = "#88b090";
    ctx.fillText(`Patrimonio: $${j.pat}`, x + 10, y + 74);

    if (j.enCarcel) {
      ctx.fillStyle = "#e74c3c";
      ctx.fillText(`🚨 EN CÁRCEL (${j.turnosCarcel}/3)`, x + 10, y + 96);
    }

    ctx.font = "bold 11px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("PROPIEDADES:", x + 10, y + 120);

    let py = y + 140;
    for (let idx in snap.props) {
      const p = snap.props[idx];
      if (p.duenio === id) {
        const c = K.CASILLAS[idx];
        ctx.fillStyle = c.col || "#bdc3c7";
        ctx.fillRect(x + 10, py - 9, 8, 8);

        ctx.font = "10px sans-serif";
        ctx.fillStyle = "#e0e0e0";
        const estrellas = p.casas > 0 ? ` (${"★".repeat(p.casas)})` : "";
        ctx.fillText(`${c.nombre}${estrellas}`, x + 22, py - 2);
        py += 17;
      }
    }
  }
})();
