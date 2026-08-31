// ==========================================================================
//  ARCADE P2P - Controlador Central del Hub, Transporte WebRTC y Juegos
//  Permite jugar Pong y Spacewar sobre la misma sesión P2P sin reconectar.
// ==========================================================================
"use strict";

window.addEventListener("error", (e) => {
  window.__lastError = (e.message || "") + " @ " + (e.filename || "") + ":" + e.lineno;
});
window.addEventListener("unhandledrejection", (e) => {
  window.__lastRej = String(e.reason);
});

// ---------- CONFIG DE RED ----------
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
];
const PREFIJO_SALA = "arcade-p2p-";
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// ---------- REFS DOM ----------
const $ = (id) => document.getElementById(id);
const seccionSala = $("seccionSala");
const seccionEsperando = $("seccionEsperando");
const seccionConectando = $("seccionConectando");
const hub = $("hub");
const vistaJuego = $("vistaJuego");
const cv = $("cv");
const ctx = cv.getContext("2d", { alpha: false, desynchronized: true });
let DPR = 1;

// ---------- ESTADO GLOBAL DE SESIÓN ----------
let peer = null;
let conn = null;
let esHost = false;
let miCodigoSala = "";
let rttMs = 0;
let pingInterval = null;
let juegoActivo = null; // 'pong' | 'spacewar' | null
let hudOn = false;

// HUD métricas
let accIn = 0, accInMsg = 0, accOut = 0;
let hudIn = 0, hudInMsg = 0, hudOut = 0;
let lastHudCalc = performance.now();

// Instancias de juego
let partidaPong = null;
let partidaSpacewar = null;
let hostLoop = null;
let hostLastTime = 0;
let animFrameId = null;

// ---------- INPUTS DE TECLADO ----------
const inputTeclas = {
  arriba: false,
  abajo: false,
  izquierda: false,
  derecha: false,
  espacio: false,
  w: false,
  s: false,
  a: false,
  d: false
};

// ==========================================================================
//  TIPOS DE MENSAJES P2P MULTIPLEXADOS
// ==========================================================================
const MSG_PING = 10;
const MSG_PONG = 11;
const MSG_SELECT_GAME = 20;
const MSG_RETURN_HUB = 21;

// Mensajes de juego
const MSG_PONG_SNAP = 1;
const MSG_PONG_PALA = 2;
const MSG_SW_SNAP = 30;
const MSG_SW_INPUT = 31;

// ==========================================================================
//  CODECS BINARIOS
// ==========================================================================

// 1. Codec Pong
const _pongSnapAB = new ArrayBuffer(31), _pongSnapV = new DataView(_pongSnapAB);
const _pongPalaAB = new ArrayBuffer(7),  _pongPalaV = new DataView(_pongPalaAB);

function encPongSnap(s) {
  const v = _pongSnapV;
  v.setUint8(0, MSG_PONG_SNAP);
  v.setUint16(1, s.seq, true);
  v.setFloat32(3, s.bx, true);
  v.setFloat32(7, s.by, true);
  v.setFloat32(11, s.bvx, true);
  v.setFloat32(15, s.bvy, true);
  v.setFloat32(19, s.p1, true);
  v.setFloat32(23, s.p2, true);
  v.setUint8(27, s.s1);
  v.setUint8(28, s.s2);
  let f = 0;
  if (s.sirviendo) f |= 1;
  if (s.ganador) { f |= 2; if (s.ganador === 2) f |= 4; }
  if (s.pausa) { f |= 8; if (s.pausa === 2) f |= 16; }
  if (s.rev1) f |= 32;
  if (s.rev2) f |= 64;
  v.setUint8(29, f);
  v.setUint8(30, s.cuenta);
  return _pongSnapAB.slice(0);
}

function decPongSnap(v) {
  const f = v.getUint8(29);
  return {
    seq: v.getUint16(1, true),
    bx: v.getFloat32(3, true), by: v.getFloat32(7, true),
    bvx: v.getFloat32(11, true), bvy: v.getFloat32(15, true),
    p1: v.getFloat32(19, true), p2: v.getFloat32(23, true),
    s1: v.getUint8(27), s2: v.getUint8(28),
    sirviendo: !!(f & 1),
    ganador: (f & 2) ? ((f & 4) ? 2 : 1) : 0,
    pausa: (f & 8) ? ((f & 16) ? 2 : 1) : 0,
    rev1: !!(f & 32), rev2: !!(f & 64),
    cuenta: v.getUint8(30),
  };
}

function encPongPala(seq, y) {
  _pongPalaV.setUint8(0, MSG_PONG_PALA);
  _pongPalaV.setUint16(1, seq & 0xffff, true);
  _pongPalaV.setFloat32(3, y, true);
  return _pongPalaAB.slice(0);
}

// 2. Codec Spacewar (Snapshots y Input)
const _swInputAB = new ArrayBuffer(5), _swInputV = new DataView(_swInputAB);
function encSWInput(seq, rot, thrust, fire) {
  const v = _swInputV;
  v.setUint8(0, MSG_SW_INPUT);
  v.setUint16(1, seq & 0xffff, true);
  let f = 0;
  if (rot === -1) f |= 1;
  else if (rot === 1) f |= 2;
  if (thrust) f |= 4;
  if (fire) f |= 8;
  v.setUint8(3, f);
  return _swInputAB.slice(0);
}

function decSWInput(v) {
  const f = v.getUint8(3);
  return {
    seq: v.getUint16(1, true),
    rot: (f & 1) ? -1 : ((f & 2) ? 1 : 0),
    thrust: !!(f & 4),
    fire: !!(f & 8)
  };
}

// ==========================================================================
//  ESTADO DE NETCODE DEL GUEST
// ==========================================================================
const NetGuest = {
  // Pong
  pongLast: null,
  pongSeq: 0,
  pongPredP2: (CAMPO_ALTO - PALA_ALTO) / 2,
  pongBall: { x: CAMPO_ANCHO / 2, y: CAMPO_ALTO / 2, vx: 0, vy: 0, stamp: 0 },
  pongBallErr: { x: 0, y: 0 },
  pongVistaP1: (CAMPO_ALTO - PALA_ALTO) / 2,

  // Spacewar
  swLast: null,
  swSeq: 0,
  swPredNave2: { x: SW_ANCHO * 0.8, y: SW_ALTO * 0.5, ang: Math.PI, vx: 0, vy: 0 },
  swNave1Vista: { x: SW_ANCHO * 0.2, y: SW_ALTO * 0.5, ang: 0, vx: 0, vy: 0 },
  swBalas: [],
  swParticulas: []
};

// ==========================================================================
//  INICIALIZACIÓN Y NAVEGACIÓN DE VISTAS (Home / Hub / Juego)
// ==========================================================================
function generarCodigo() {
  let s = "";
  for (let i = 0; i < 4; i++) s += ALFABETO[(Math.random() * ALFABETO.length) | 0];
  return s;
}

function mostrarVista(vista) {
  seccionSala.classList.add("oculto");
  seccionEsperando.classList.add("oculto");
  seccionConectando.classList.add("oculto");
  hub.classList.add("oculto");
  vistaJuego.classList.add("oculto");

  if (vista === "sala") seccionSala.classList.remove("oculto");
  else if (vista === "esperando") seccionEsperando.classList.remove("oculto");
  else if (vista === "conectando") seccionConectando.classList.remove("oculto");
  else if (vista === "hub") hub.classList.remove("oculto");
  else if (vista === "juego") vistaJuego.classList.remove("oculto");
}

function actualizarStatusRed(txt, color = "var(--text-muted)") {
  const el = $("statusRed");
  if (el) {
    el.innerText = txt;
    el.style.color = color;
  }
}

// ==========================================================================
//  TRANSPORTE WEBRTC (PeerJS)
// ==========================================================================
function iniciarHost() {
  RetroAudio.init();
  miCodigoSala = generarCodigo();
  $("codigoDisplay").innerText = miCodigoSala;
  $("estadoHost").innerText = "Creando sala P2P...";
  mostrarVista("esperando");

  if (peer) peer.destroy();
  peer = new Peer(PREFIJO_SALA + miCodigoSala, { config: { iceServers: ICE_SERVERS } });

  peer.on("open", () => {
    $("estadoHost").innerText = "Sala lista. Esperando que tu amigo se una...";
  });

  peer.on("connection", (c) => {
    conn = c;
    esHost = true;
    configurarConexion();
  });

  peer.on("error", (err) => {
    $("estadoHost").innerHTML = `<span class="err">Error: ${err.type || err}</span>`;
  });
}

function unirseComoGuest() {
  RetroAudio.init();
  const cod = $("inputCodigo").value.trim().toUpperCase();
  if (cod.length < 3) {
    alert("Ingresa un código de sala válido");
    return;
  }
  miCodigoSala = cod;
  $("estadoGuest").innerText = `Conectando a la sala ${cod}...`;
  mostrarVista("conectando");

  if (peer) peer.destroy();
  peer = new Peer({ config: { iceServers: ICE_SERVERS } });

  peer.on("open", () => {
    conn = peer.connect(PREFIJO_SALA + miCodigoSala, { reliable: false });
    esHost = false;
    configurarConexion();
  });

  peer.on("error", (err) => {
    $("estadoGuest").innerHTML = `<span class="err">Error de conexión: ${err.type || err}</span>`;
  });
}

function configurarConexion() {
  conn.on("open", () => {
    actualizarStatusRed("CONECTADO (P2P)", "var(--green-phosphor)");
    $("hubCodigo").innerText = miCodigoSala;
    $("hubRol").innerText = esHost ? "Rol: HOST (Jugador 1)" : "Rol: GUEST (Jugador 2)";

    // Desactivar botones de lanzar si es Guest (el host decide qué juego inicia)
    if (!esHost) {
      $("btnLanzarPong").disabled = true;
      $("btnLanzarPong").innerText = "Esperando al Host...";
      $("btnLanzarSpacewar").disabled = true;
      $("btnLanzarSpacewar").innerText = "Esperando al Host...";
    } else {
      $("btnLanzarPong").disabled = false;
      $("btnLanzarPong").innerText = "Lanzar Pong";
      $("btnLanzarSpacewar").disabled = false;
      $("btnLanzarSpacewar").innerText = "Lanzar Spacewar";
    }

    iniciarMedicionPing();
    mostrarVista("hub");
  });

  conn.on("data", (data) => {
    procesarDatosEntrantes(data);
  });

  conn.on("close", () => {
    detenerJuegoActivo();
    actualizarStatusRed("DESCONECTADO", "var(--text-muted)");
    alert("El rival se ha desconectado.");
    mostrarVista("sala");
  });

  conn.on("error", (err) => {
    console.error("Error en conexión P2P:", err);
  });
}

function iniciarMedicionPing() {
  if (pingInterval) clearInterval(pingInterval);
  pingInterval = setInterval(() => {
    if (conn && conn.open) {
      const now = performance.now();
      const buf = new ArrayBuffer(9);
      const v = new DataView(buf);
      v.setUint8(0, MSG_PING);
      v.setFloat64(1, now, true);
      conn.send(buf);
    }
  }, 1000);
}

// ==========================================================================
//  RUTEO Y PROCESAMIENTO DE MENSAJES
// ==========================================================================
function procesarDatosEntrantes(data) {
  if (typeof data === "string") {
    try {
      const msg = JSON.parse(data);
      if (msg.tipo === "SELECT_GAME") {
        lanzarJuego(msg.juego, false);
      } else if (msg.tipo === "RETURN_HUB") {
        volverAlHub(false);
      } else if (msg.tipo === "SW_SNAP_JSON") {
        // Snapshot de Spacewar
        NetGuest.swLast = msg.snap;
      }
    } catch (e) {}
    return;
  }

  if (!(data instanceof ArrayBuffer)) return;
  const v = new DataView(data);
  const tipo = v.getUint8(0);

  // 1. PING / PONG
  if (tipo === MSG_PING) {
    const t = v.getFloat64(1, true);
    const resp = new ArrayBuffer(9);
    const rv = new DataView(resp);
    rv.setUint8(0, MSG_PONG);
    rv.setFloat64(1, t, true);
    if (conn && conn.open) conn.send(resp);
    return;
  }
  if (tipo === MSG_PONG) {
    const t = v.getFloat64(1, true);
    rttMs = Math.round(performance.now() - t);
    $("hubPing").innerText = `${rttMs} ms`;
    $("linkPing").innerText = `${rttMs} ms`;
    return;
  }

  // 2. Snapshots de Pong
  if (tipo === MSG_PONG_SNAP) {
    const snap = decPongSnap(v);
    NetGuest.pongLast = snap;
    NetGuest.pongSeq = snap.seq;
    return;
  }

  // 3. Input de Pong (Guest -> Host)
  if (tipo === MSG_PONG_PALA && esHost && partidaPong) {
    const y = v.getFloat32(3, true);
    partidaPong.aplicarPala2(y, 1 / 60);
    return;
  }

  // 4. Input de Spacewar (Guest -> Host)
  if (tipo === MSG_SW_INPUT && esHost && partidaSpacewar) {
    const inpt = decSWInput(v);
    partidaSpacewar.aplicarInputGuest(inpt);
    return;
  }
}

// ==========================================================================
//  CONTROL DE FLUJO: SELECCIÓN DE JUEGO Y SALIDA AL HUB
// ==========================================================================
function lanzarJuego(tipo, notificarRival = true) {
  juegoActivo = tipo;
  detenerJuegoActivo();

  if (notificarRival && conn && conn.open) {
    conn.send(JSON.stringify({ tipo: "SELECT_GAME", juego: tipo }));
  }

  if (tipo === "pong") {
    iniciarPong();
  } else if (tipo === "spacewar") {
    iniciarSpacewar();
  }

  mostrarVista("juego");
}

function volverAlHub(notificarRival = true) {
  detenerJuegoActivo();
  juegoActivo = null;

  if (notificarRival && conn && conn.open) {
    conn.send(JSON.stringify({ tipo: "RETURN_HUB" }));
  }

  $("overlay").classList.add("oculto");
  mostrarVista("hub");
}

function detenerJuegoActivo() {
  if (hostLoop) { clearInterval(hostLoop); hostLoop = null; }
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  partidaPong = null;
  partidaSpacewar = null;
  RetroAudio.stopThrust();
}

// ==========================================================================
//  JUEGO 1: SPACEWAR 1979
// ==========================================================================
function iniciarSpacewar() {
  cv.width = SW_ANCHO;
  cv.height = SW_ALTO;
  DPR = window.devicePixelRatio || 1;
  $("tituloJuegoActivo").innerText = "SPACEWAR 1979";
  $("ayudaControles").innerHTML = `
    Rotación: <kbd>A</kbd>/<kbd>D</kbd> o <kbd>←</kbd>/<kbd>→</kbd> · 
    Empuje: <kbd>W</kbd> o <kbd>↑</kbd> · 
    Disparo: <kbd>ESPACIO</kbd> · 
    P1 (Host): Verde · P2 (Guest): Ámbar
  `;

  if (esHost) {
    partidaSpacewar = new PartidaSpacewar();
    hostLastTime = performance.now();

    // Loop autoritativo a 120 Hz
    hostLoop = setInterval(() => {
      const now = performance.now();
      const dt = Math.min((now - hostLastTime) / 1000, 0.05);
      hostLastTime = now;

      // Aplicar input local de Host (P1)
      const rot = (inputTeclas.izquierda || inputTeclas.a) ? -1 : ((inputTeclas.derecha || inputTeclas.d) ? 1 : 0);
      const thrust = inputTeclas.arriba || inputTeclas.w;
      const fire = inputTeclas.espacio;

      partidaSpacewar.aplicarInputHost({ rot, thrust, fire });
      partidaSpacewar.step(dt);

      // Enviar snapshot al Guest
      if (conn && conn.open) {
        const snap = partidaSpacewar.snapshot();
        conn.send(JSON.stringify({ tipo: "SW_SNAP_JSON", snap }));
      }
    }, 1000 / 120);
  } else {
    // Loop de envío de input del Guest a 60 Hz
    hostLoop = setInterval(() => {
      if (conn && conn.open) {
        const rot = (inputTeclas.izquierda || inputTeclas.a) ? -1 : ((inputTeclas.derecha || inputTeclas.d) ? 1 : 0);
        const thrust = inputTeclas.arriba || inputTeclas.w;
        const fire = inputTeclas.espacio;
        const buf = encSWInput(NetGuest.swSeq++, rot, thrust, fire);
        conn.send(buf);
      }
    }, 1000 / 60);
  }

  // Audio de thrust
  if (inputTeclas.arriba || inputTeclas.w) RetroAudio.startThrust();

  // Iniciar loop de render
  loopRenderSpacewar();
}

function loopRenderSpacewar() {
  renderSpacewarFrame();
  animFrameId = requestAnimationFrame(loopRenderSpacewar);
}

function renderSpacewarFrame() {
  ctx.fillStyle = "#030603";
  ctx.fillRect(0, 0, SW_ANCHO, SW_ALTO);

  // Dibujar cuadrícula tenue de radar
  ctx.strokeStyle = "rgba(57, 255, 20, 0.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < SW_ANCHO; x += 80) { ctx.moveTo(x, 0); ctx.lineTo(x, SW_ALTO); }
  for (let y = 0; y < SW_ALTO; y += 80) { ctx.moveTo(0, y); ctx.lineTo(SW_ANCHO, y); }
  ctx.stroke();

  let snap = esHost ? (partidaSpacewar ? partidaSpacewar.snapshot() : null) : NetGuest.swLast;
  if (!snap) {
    ctx.fillStyle = "var(--green-phosphor)";
    ctx.font = "16px monospace";
    ctx.fillText("Sincronizando naves vectoriales...", SW_ANCHO / 2 - 140, SW_ALTO / 2);
    return;
  }

  // 1. Dibujar Proyectiles
  if (snap.balas) {
    snap.balas.forEach(b => {
      ctx.fillStyle = b.d === 1 ? "#39ff14" : "#ffb000";
      ctx.shadowColor = b.d === 1 ? "#39ff14" : "#ffb000";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(b.x, b.y, SW_BALA_RADIO, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }

  // 2. Dibujar Naves Vectoriales
  if (snap.n1 && snap.n1.viva) {
    dibujarNaveVectorial(snap.n1.x, snap.n1.y, snap.n1.ang, "#39ff14", snap.n1.thrust, snap.n1.invuln);
  }
  if (snap.n2 && snap.n2.viva) {
    dibujarNaveVectorial(snap.n2.x, snap.n2.y, snap.n2.ang, "#ffb000", snap.n2.thrust, snap.n2.invuln);
  }

  // 3. Marcador / Vidas HUD superior
  ctx.font = "bold 16px monospace";
  ctx.fillStyle = "#39ff14";
  ctx.fillText(`P1 (VERDE): ${"▲".repeat(snap.n1 ? snap.n1.vidas : 0)}`, 24, 30);

  ctx.fillStyle = "#ffb000";
  const vidasP2 = snap.n2 ? snap.n2.vidas : 0;
  ctx.fillText(`P2 (ÁMBAR): ${"▲".repeat(vidasP2)}`, SW_ANCHO - 220, 30);

  // 4. Chequear Fin de Partida
  if (snap.ganador) {
    const overlay = $("overlay");
    overlay.classList.remove("oculto");
    const soyP1 = esHost;
    const ganoP1 = snap.ganador === 1;
    const ganeYo = (soyP1 && ganoP1) || (!soyP1 && !ganoP1);

    $("overlayTexto").innerText = ganeYo ? "¡VICTORIA!" : "DERROTA";
    $("overlayTexto").style.color = ganeYo ? "var(--green-phosphor)" : "var(--amber-phosphor)";
    $("overlaySub").innerText = `Jugador ${snap.ganador} destruyó la nave rival`;
  }
}

function dibujarNaveVectorial(x, y, ang, color, thrust, invuln) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);

  if (invuln) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, SW_NAVE_RADIO + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = color;
  ctx.fillStyle = "#050805";
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;

  // Triángulo estilizado de nave espacial (Spacewar / Asteroids)
  ctx.beginPath();
  ctx.moveTo(SW_NAVE_RADIO + 4, 0);                  // Punta
  ctx.lineTo(-SW_NAVE_RADIO, -SW_NAVE_RADIO * 0.75); // Ala izquierda
  ctx.lineTo(-SW_NAVE_RADIO * 0.4, 0);              // Hendidura motor
  ctx.lineTo(-SW_NAVE_RADIO, SW_NAVE_RADIO * 0.75);  // Ala derecha
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Fuego de propulsión
  if (thrust) {
    ctx.strokeStyle = "#ff4400";
    ctx.beginPath();
    ctx.moveTo(-SW_NAVE_RADIO * 0.4, -4);
    ctx.lineTo(-SW_NAVE_RADIO * 0.4 - (6 + Math.random() * 8), 0);
    ctx.lineTo(-SW_NAVE_RADIO * 0.4, 4);
    ctx.stroke();
  }

  ctx.restore();
}

// ==========================================================================
//  JUEGO 2: PONG CLÁSICO
// ==========================================================================
function iniciarPong() {
  cv.width = CAMPO_ANCHO;
  cv.height = CAMPO_ALTO;
  DPR = window.devicePixelRatio || 1;
  $("tituloJuegoActivo").innerText = "PONG CLÁSICO";
  $("ayudaControles").innerHTML = `
    Movimiento: <kbd>W</kbd>/<kbd>S</kbd> o <kbd>↑</kbd>/<kbd>↓</kbd> · 
    P1 (Host): Pala izquierda · P2 (Guest): Pala derecha · Primero a 5 gana
  `;

  if (esHost) {
    partidaPong = new Partida();
    hostLastTime = performance.now();

    hostLoop = setInterval(() => {
      const now = performance.now();
      const dt = Math.min((now - hostLastTime) / 1000, 0.05);
      hostLastTime = now;

      partidaPong.dir1 = (inputTeclas.arriba || inputTeclas.w) ? -1 : ((inputTeclas.abajo || inputTeclas.s) ? 1 : 0);
      partidaPong.step(dt);

      if (conn && conn.open) {
        const snap = partidaPong.snapshot();
        const buf = encPongSnap(snap);
        conn.send(buf);
      }
    }, 1000 / 120);
  } else {
    // Loop de envío de pala del Guest a 60 Hz
    hostLoop = setInterval(() => {
      if (conn && conn.open) {
        const dir = (inputTeclas.arriba || inputTeclas.w) ? -1 : ((inputTeclas.abajo || inputTeclas.s) ? 1 : 0);
        NetGuest.pongPredP2 = clamp(NetGuest.pongPredP2 + dir * PALA_VEL_PS * (1 / 60), 0, CAMPO_ALTO - PALA_ALTO);
        const buf = encPongPala(NetGuest.pongSeq++, NetGuest.pongPredP2);
        conn.send(buf);
      }
    }, 1000 / 60);
  }

  loopRenderPong();
}

function loopRenderPong() {
  renderPongFrame();
  animFrameId = requestAnimationFrame(loopRenderPong);
}

function renderPongFrame() {
  ctx.fillStyle = "#030603";
  ctx.fillRect(0, 0, CAMPO_ANCHO, CAMPO_ALTO);

  // Línea central
  ctx.strokeStyle = "rgba(57, 255, 20, 0.2)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(CAMPO_ANCHO / 2, 0);
  ctx.lineTo(CAMPO_ANCHO / 2, CAMPO_ALTO);
  ctx.stroke();
  ctx.setLineDash([]);

  let snap = esHost ? (partidaPong ? partidaPong.snapshot() : null) : NetGuest.pongLast;
  if (!snap) {
    ctx.fillStyle = "var(--green-phosphor)";
    ctx.font = "16px monospace";
    ctx.fillText("Esperando snapshot de Pong...", CAMPO_ANCHO / 2 - 130, CAMPO_ALTO / 2);
    return;
  }

  // Dibujar palas
  ctx.fillStyle = "#39ff14";
  ctx.fillRect(PALA_MARGEN, snap.p1, PALA_ANCHO, PALA_ALTO);

  ctx.fillStyle = "#ffb000";
  const p2Y = esHost ? snap.p2 : NetGuest.pongPredP2;
  ctx.fillRect(CAMPO_ANCHO - PALA_MARGEN - PALA_ANCHO, p2Y, PALA_ANCHO, PALA_ALTO);

  // Dibujar pelota
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(snap.bx, snap.by, BOLA_RADIO, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Marcador
  ctx.font = "bold 36px monospace";
  ctx.fillStyle = "#39ff14";
  ctx.fillText(snap.s1, CAMPO_ANCHO / 2 - 60, 50);
  ctx.fillStyle = "#ffb000";
  ctx.fillText(snap.s2, CAMPO_ANCHO / 2 + 35, 50);

  // Fin de partida
  if (snap.ganador) {
    const overlay = $("overlay");
    overlay.classList.remove("oculto");
    const soyP1 = esHost;
    const ganoP1 = snap.ganador === 1;
    const ganeYo = (soyP1 && ganoP1) || (!soyP1 && !ganoP1);

    $("overlayTexto").innerText = ganeYo ? "¡VICTORIA!" : "DERROTA";
    $("overlayTexto").style.color = ganeYo ? "var(--green-phosphor)" : "var(--amber-phosphor)";
    $("overlaySub").innerText = `Jugador ${snap.ganador} alcanzó 5 puntos`;
  }
}

// ==========================================================================
//  LISTENERS DE BOTONES Y TECLADO
// ==========================================================================
window.addEventListener("DOMContentLoaded", () => {
  $("btnCrearSala").addEventListener("click", iniciarHost);
  $("btnUnirseSala").addEventListener("click", unirseComoGuest);
  $("btnCancelarHost").addEventListener("click", () => { if (peer) peer.destroy(); mostrarVista("sala"); });
  $("btnCancelarGuest").addEventListener("click", () => { if (peer) peer.destroy(); mostrarVista("sala"); });
  $("btnDesconectar").addEventListener("click", () => { if (conn) conn.close(); if (peer) peer.destroy(); mostrarVista("sala"); });

  $("btnLanzarSpacewar").addEventListener("click", () => lanzarJuego("spacewar"));
  $("btnLanzarPong").addEventListener("click", () => lanzarJuego("pong"));
  $("btnVolverHub").addEventListener("click", () => volverAlHub());
  $("btnOverlayHub").addEventListener("click", () => volverAlHub());

  $("btnRevancha").addEventListener("click", () => {
    $("overlay").classList.add("oculto");
    if (juegoActivo === "spacewar" && esHost && partidaSpacewar) {
      partidaSpacewar.reiniciarTodo();
    } else if (juegoActivo === "pong" && esHost && partidaPong) {
      partidaPong.pedirRevancha(1);
      partidaPong.pedirRevancha(2);
    }
  });

  $("btnMute").addEventListener("click", () => {
    const mute = RetroAudio.toggleMute();
    $("btnMute").innerText = mute ? "🔇 MUTED" : "🔊 SONIDO";
  });

  // Captura de teclado
  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", " "].includes(e.key)) {
      e.preventDefault();
    }
    if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
      inputTeclas.arriba = true;
      if (juegoActivo === "spacewar") RetroAudio.startThrust();
    }
    if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") inputTeclas.abajo = true;
    if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") inputTeclas.izquierda = true;
    if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") inputTeclas.derecha = true;
    if (e.key === " " || e.key === "Spacebar") {
      inputTeclas.espacio = true;
      if (juegoActivo === "spacewar") RetroAudio.playLaser();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
      inputTeclas.arriba = false;
      if (juegoActivo === "spacewar") RetroAudio.stopThrust();
    }
    if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") inputTeclas.abajo = false;
    if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") inputTeclas.izquierda = false;
    if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") inputTeclas.derecha = false;
    if (e.key === " " || e.key === "Spacebar") inputTeclas.espacio = false;
  });
});
