// ==========================================================================
//  App (hilo principal): menu, transporte P2P y render.
//
//  TECNICAS DE OPTIMIZACION (netcode) implementadas aca:
//   1. Simulacion de paso fijo con acumulador (120 Hz) desacoplada del render.
//   2. Snapshots BINARIOS de 31 bytes (DataView) en vez de JSON.
//   3. Canal de datos NO confiable + numero de secuencia: sin head-of-line
//      blocking; los paquetes viejos o duplicados se descartan.
//   4. Autoridad de cliente sobre la propia pala (latencia 0 para vos) +
//      "reconciliacion por limite de velocidad" en el host (anti-teleport).
//   5. Interpolacion de la pala rival con retardo de render ADAPTATIVO
//      (se ajusta solo segun el jitter medido) -> sin tirones.
//   6. Dead-reckoning de la pelota con rebote de paredes + correccion de
//      error que decae (projective velocity blending) -> pelota sin lag.
//   7. Render: canvas a devicePixelRatio, contexto opaco y "desynchronized",
//      coordenadas redondeadas.
//   8. HUD de diagnostico (tecla H): FPS, RTT, jitter, Hz y bytes/s.
// ==========================================================================
"use strict";
window.addEventListener("error", (e) => { window.__lastError = (e.message || "") + " @ " + (e.filename || "") + ":" + e.lineno; });
window.addEventListener("unhandledrejection", (e) => { window.__lastRej = String(e.reason); });

// ---------- CONFIG DE RED ----------
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
  // TURN (relay) para NAT duro / CGNAT. Cuenta gratis: metered.ca/tools/openrelay
  // { urls: "turn:TU_HOST:3478", username: "usuario", credential: "clave" },
  // { urls: "turn:TU_HOST:3478?transport=tcp", username: "usuario", credential: "clave" },
];
const PREFIJO = "pong-";
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CANAL_CONFIABLE = false;            // false = no confiable (mejor latencia)
const INTERP_MIN = 35, INTERP_MAX = 140;  // ms, limites del retardo adaptativo

// ---------- refs ----------
const $ = (id) => document.getElementById(id);
const cv = $("cv");
const ctx = cv.getContext("2d", { alpha: false, desynchronized: true });
let DPR = 1;

// ---------- estado global ----------
let peer = null, conn = null, miNumero = null;
let partida = null;                       // solo host
let hostVivo = false, hostLoop = null, hostLast = 0;
let ultimaPala2Ts = 0, ultimaPalaSeq = -1;
let rttMs = 0, pingCada = null;
let rivalCortado = false, hudOn = false, viaRelay = false;
const entrada = { arriba: false, abajo: false };

// contadores para el HUD (se vuelcan a estos cada 1s)
let accIn = 0, accInMsg = 0, accOut = 0;
let hudIn = 0, hudInMsg = 0, hudOut = 0;

// --- estado de netcode del guest ---
const G = {
  buf: [],                 // {stamp, p1} para interpolar la pala rival
  last: null,              // ultimo snapshot decodificado
  lastSeq: -1,
  stampPrev: 0,
  interArr: 16.7,          // ms entre snapshots (EMA)
  jitter: 4,               // ms (EMA)
  interpDelay: 70,         // ms (adaptativo)
  predP2: (CAMPO_ALTO - PALA_ALTO) / 2,
  ball: { x: CAMPO_ANCHO / 2, y: CAMPO_ALTO / 2, vx: 0, vy: 0, stamp: 0 },
  ballErr: { x: 0, y: 0 },
  vistaP1: (CAMPO_ALTO - PALA_ALTO) / 2,
  palaSeq: 0, palaEnvAcc: 0,
};

// ==========================================================================
//  Codec binario
// ==========================================================================
const B_SNAP = 1, B_PALA = 2;
const _snapAB = new ArrayBuffer(31), _snapV = new DataView(_snapAB);
const _palaAB = new ArrayBuffer(7),  _palaV = new DataView(_palaAB);

function encSnap(s) {
  const v = _snapV;
  v.setUint8(0, B_SNAP);
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
  return _snapAB.slice(0);
}
function decSnap(v) {
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
function encPala(seq, y) {
  _palaV.setUint8(0, B_PALA);
  _palaV.setUint16(1, seq & 0xffff, true);
  _palaV.setFloat32(3, y, true);
  return _palaAB.slice(0);
}

// Normaliza lo que llega de PeerJS (ArrayBuffer o vista) a un DataView limpio.
function comoView(d) {
  if (d instanceof ArrayBuffer) return d.byteLength ? new DataView(d) : null;
  if (ArrayBuffer.isView(d)) return new DataView(d.buffer, d.byteOffset, d.byteLength);
  return null;
}
const seqMasNuevo = (n, v) => { const d = (n - v) & 0xffff; return d !== 0 && d < 0x8000; };

function enviar(x) {
  try {
    if (!conn || !conn.open) return;
    conn.send(x);
    accOut += (typeof x === "string") ? x.length : x.byteLength;
  } catch (e) {}
}
function contarEntrada(d) {
  accInMsg++;
  accIn += (typeof d === "string") ? d.length : (d.byteLength || (d.buffer && d.byteLength) || 31);
}

// ==========================================================================
//  UI helpers
// ==========================================================================
function verPanel(id) {
  for (const p of ["menu", "esperando", "conectando", "juego"]) $(p).classList.toggle("oculto", p !== id);
  if (id === "juego") ajustarCanvas();
}
function azar4() {
  let s = "";
  for (let i = 0; i < 4; i++) s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  return s;
}
function limpiar() {
  hostVivo = false;
  if (hostLoop) { clearInterval(hostLoop); hostLoop = null; }
  if (pingCada) { clearInterval(pingCada); pingCada = null; }
  partida = null;
  try { if (conn) conn.close(); } catch (e) {}
  try { if (peer) peer.destroy(); } catch (e) {}
  conn = null; peer = null; miNumero = null; rivalCortado = false;
  G.buf = []; G.last = null; G.lastSeq = -1;
  ultimaPala2Ts = 0; ultimaPalaSeq = -1;
}

// ==========================================================================
//  HOST
// ==========================================================================
function crearSala() {
  limpiar();
  verPanel("esperando");
  const codigo = PREFIJO + azar4().toLowerCase();
  $("codigoSala").textContent = codigo.replace(PREFIJO, "").toUpperCase();
  $("estadoHost").textContent = "Conectando al servidor de saludo…";
  peer = new Peer(codigo, { config: { iceServers: ICE_SERVERS } });

  peer.on("open", () => { $("estadoHost").textContent = "Esperando a tu amigo…"; });
  peer.on("error", (e) => {
    if (e && e.type === "unavailable-id") { crearSala(); return; }
    $("estadoHost").innerHTML = '<span class="err">Error: ' + (e && e.type || e) + "</span>";
  });
  peer.on("disconnected", () => { try { peer.reconnect(); } catch (e) {} });

  peer.on("connection", (c) => {
    if (conn) { c.close(); return; }
    conn = c;
    miNumero = 1;
    c.on("open", () => {
      rivalCortado = false;
      verPanel("juego");
      reportarViaRelay(c);
      arrancarHost();
    });
    c.on("data", (d) => onDataHost(d));
    c.on("close", () => rivalSeFue());
    c.on("error", () => rivalSeFue());
  });
}

function arrancarHost() {
  partida = new Partida();
  hostLast = performance.now();
  ultimaPala2Ts = performance.now();
  hostVivo = true;
  let acc = 0, sendAcc = 0;
  const pasoMs = 1000 / SIM_HZ;
  const enviarCada = 1000 / SEND_HZ;

  // Loop del host por requestAnimationFrame: los setInterval los estrangula el
  // navegador cuando la pestaña no está visible; rAF va a 60/120 Hz reales
  // mientras se ve, y se congela solo al ocultarse (que es justo cuando
  // queremos pausar). El acumulador da paso fijo aunque varíe el framerate.
  function loop(now) {
    if (!hostVivo) return;
    requestAnimationFrame(loop);
    let dtMs = now - hostLast;
    hostLast = now;
    if (!(dtMs > 0)) dtMs = 1000 / 60;
    if (dtMs > 250) dtMs = 250;                 // venís de pausa/lag: no dispares 1000 pasos
    acc += dtMs;
    partida.dir1 = (entrada.abajo ? 1 : 0) - (entrada.arriba ? 1 : 0);
    let pasos = 0;
    while (acc >= pasoMs && pasos < 16) { partida.step(SIM_DT); acc -= pasoMs; pasos++; }
    sendAcc += dtMs;
    if (sendAcc >= enviarCada) { sendAcc = 0; enviar(encSnap(partida.snapshot())); }
  }
  requestAnimationFrame(loop);

  // Mientras la pestaña del host está oculta, rAF no corre: este intervalo
  // (aunque el navegador lo capa a ~1 s) mantiene al guest avisado de la pausa.
  hostLoop = setInterval(() => {
    if (partida && partida.pausada) enviar(encSnap(partida.snapshot()));
  }, 250);
}

function onDataHost(d) {
  contarEntrada(d);
  const v = comoView(d);
  if (v) {
    if (v.getUint8(0) === B_PALA && partida) {
      const seq = v.getUint16(1, true);
      if (ultimaPalaSeq >= 0 && !seqMasNuevo(seq, ultimaPalaSeq)) return;  // reorder
      ultimaPalaSeq = seq;
      const y = v.getFloat32(3, true);
      const now = performance.now();
      const dtReal = (now - ultimaPala2Ts) / 1000;
      ultimaPala2Ts = now;
      partida.aplicarPala2(y, dtReal);
    }
    return;
  }
  let m; try { m = JSON.parse(d); } catch (e) { return; }
  if (!partida) return;
  if (m.t === "reiniciar") partida.pedirRevancha(2);
  else if (m.t === "pausa") partida.pausas.guest = !!m.on;
  else if (m.t === "ping") enviar(JSON.stringify({ t: "pong", ts: m.ts }));
}

// ==========================================================================
//  GUEST
// ==========================================================================
function unirse(codigoVisible) {
  const codigo = PREFIJO + codigoVisible.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (codigoVisible.trim().length < 3) { $("inputCodigo").focus(); return; }
  limpiar();
  verPanel("conectando");
  $("estadoGuest").textContent = "Conectando al servidor de saludo…";
  peer = new Peer({ config: { iceServers: ICE_SERVERS } });

  peer.on("open", () => {
    $("estadoGuest").textContent = "Buscando la sala " + codigoVisible.toUpperCase() + "…";
    conn = peer.connect(codigo, { reliable: CANAL_CONFIABLE });
    conn.on("open", () => {
      miNumero = 2;
      rivalCortado = false;
      G.predP2 = (CAMPO_ALTO - PALA_ALTO) / 2;
      G.ball = { x: CAMPO_ANCHO / 2, y: CAMPO_ALTO / 2, vx: 0, vy: 0, stamp: performance.now() };
      verPanel("juego");
      reportarViaRelay(conn);
      pingCada = setInterval(() => enviar(JSON.stringify({ t: "ping", ts: performance.now() })), 1000);
    });
    conn.on("data", (d) => onDataGuest(d));
    conn.on("close", () => rivalSeFue());
    conn.on("error", () => rivalSeFue());
  });
  peer.on("error", (e) => {
    const tipo = e && e.type;
    let msg = "Error: " + (tipo || e);
    if (tipo === "peer-unavailable") msg = "No existe una sala con ese código (¿ya la creó tu amigo? ¿bien escrito?).";
    $("estadoGuest").innerHTML = '<span class="err">' + msg + "</span>";
  });
  peer.on("disconnected", () => { try { peer.reconnect(); } catch (e) {} });
}

function onDataGuest(d) {
  contarEntrada(d);
  const v = comoView(d);
  if (v) {
    if (v.getUint8(0) !== B_SNAP) return;
    const s = decSnap(v);
    if (G.lastSeq >= 0 && !seqMasNuevo(s.seq, G.lastSeq)) return;   // viejo/duplicado
    const now = performance.now();

    if (G.last) {
      const ia = now - G.stampPrev;
      G.interArr += (ia - G.interArr) * 0.1;
      G.jitter += (Math.abs(ia - G.interArr) - G.jitter) * 0.1;
      G.interpDelay = clamp(G.interArr + G.jitter * 2.5, INTERP_MIN, INTERP_MAX);
    }
    G.stampPrev = now;
    G.lastSeq = s.seq;
    G.last = s;
    G.buf.push({ stamp: now, p1: s.p1 });
    if (G.buf.length > 16) G.buf.shift();

    // correccion de la pelota: mantene continuidad visual y deja que el error decaiga
    const proj = extrapBola(G.ball, (now - G.ball.stamp) / 1000);
    const renderX = proj.x + G.ballErr.x, renderY = proj.y + G.ballErr.y;
    G.ball = { x: s.bx, y: s.by, vx: s.bvx, vy: s.bvy, stamp: now };
    G.ballErr.x = renderX - s.bx;
    G.ballErr.y = renderY - s.by;
    if (Math.hypot(G.ballErr.x, G.ballErr.y) > 260) { G.ballErr.x = 0; G.ballErr.y = 0; }

    // reconciliacion de la pala propia solo si hay desync grande
    if (Math.abs(s.p2 - G.predP2) > 55) G.predP2 = s.p2;
    return;
  }
  let m; try { m = JSON.parse(d); } catch (e) { return; }
  if (m.t === "pong") rttMs += ((performance.now() - m.ts) - rttMs) * 0.25;
}

// rebote de paredes durante la extrapolacion de la pelota
function extrapBola(a, dtSec) {
  dtSec = clamp(dtSec, 0, 0.25);
  let x = a.x + a.vx * dtSec;
  let y = a.y + a.vy * dtSec;
  for (let i = 0; i < 4; i++) {
    if (y - BOLA_RADIO < 0) y = 2 * BOLA_RADIO - y;
    else if (y + BOLA_RADIO > CAMPO_ALTO) y = 2 * (CAMPO_ALTO - BOLA_RADIO) - y;
    else break;
  }
  return { x, y };
}

// ==========================================================================
//  Input + pausa
// ==========================================================================
function tecla(e, abajo) {
  const k = e.key.toLowerCase();
  if (k === "arrowup" || k === "w") entrada.arriba = abajo;
  else if (k === "arrowdown" || k === "s") entrada.abajo = abajo;
  else if (k === "h" && abajo) hudOn = !hudOn;
  if (k === "arrowup" || k === "arrowdown") e.preventDefault();
}
window.addEventListener("keydown", (e) => tecla(e, true));
window.addEventListener("keyup", (e) => tecla(e, false));
window.addEventListener("blur", () => { entrada.arriba = entrada.abajo = false; });

document.addEventListener("visibilitychange", () => {
  const oculto = document.hidden;
  if (oculto) entrada.arriba = entrada.abajo = false;
  if (miNumero === 1 && partida) partida.pausas.host = oculto;
  if (miNumero === 2) for (let i = 0; i < 3; i++) enviar(JSON.stringify({ t: "pausa", on: oculto }));
});

function rivalSeFue() {
  rivalCortado = true;
  hostVivo = false;
  if (hostLoop) { clearInterval(hostLoop); hostLoop = null; }
  if (pingCada) { clearInterval(pingCada); pingCada = null; }
  partida = null; G.last = null; G.buf = [];
  verPanel("juego");
}

// ==========================================================================
//  Overlay (fin / pausa / desconexion) — con guardia de cambios
// ==========================================================================
let _ovFirma = "";
function refrescarOverlay() {
  let e;
  if (miNumero === 1 && partida) {
    e = {
      ganador: partida.ganador || 0, s1: partida.puntos[1], s2: partida.puntos[2],
      rev1: partida.revancha[1], rev2: partida.revancha[2],
      pausa: partida.pausas.host ? 1 : (partida.pausas.guest ? 2 : 0),
    };
  } else if (G.last) {
    e = G.last;
  }
  const firma = rivalCortado ? "corte" :
    !e ? "nada" :
    e.ganador ? "g" + e.ganador + (miNumero === 1 ? e.rev1 : e.rev2) + e.s1 + "-" + e.s2 :
    e.pausa ? "p" + e.pausa : "juego";
  if (firma === _ovFirma) return;
  _ovFirma = firma;

  const ov = $("overlay");
  if (rivalCortado) {
    ov.classList.remove("oculto");
    $("overlayTexto").textContent = "Se cortó la conexión";
    $("overlaySub").textContent = "El otro jugador se desconectó.";
    $("btnRevancha").classList.add("oculto");
    $("btnMenu").classList.remove("oculto");
    return;
  }
  if (!e) { ov.classList.add("oculto"); return; }
  if (e.ganador) {
    const gane = e.ganador === miNumero;
    const yo = miNumero === 1 ? e.rev1 : e.rev2;
    ov.classList.remove("oculto");
    $("overlayTexto").textContent = gane ? "GANASTE 🏆" : "PERDISTE";
    $("overlaySub").textContent = yo ? "Esperando al rival…" : "Marcador " + e.s1 + " - " + e.s2;
    $("btnRevancha").classList.remove("oculto");
    $("btnMenu").classList.add("oculto");
    $("btnRevancha").disabled = yo;
    return;
  }
  if (e.pausa) {
    const fuiYo = (e.pausa === 1 && miNumero === 1) || (e.pausa === 2 && miNumero === 2);
    ov.classList.remove("oculto");
    $("overlayTexto").textContent = "⏸ Pausa";
    $("overlaySub").textContent = fuiYo ? "Volvé a esta pestaña para seguir." : "El otro jugador salió de la pestaña.";
    $("btnRevancha").classList.add("oculto");
    $("btnMenu").classList.add("oculto");
    return;
  }
  ov.classList.add("oculto");
  $("btnRevancha").disabled = false;
}

// ==========================================================================
//  Diagnostico: directo o via relay
// ==========================================================================
async function reportarViaRelay(c) {
  try {
    const pc = c.peerConnection;
    if (!pc || !pc.getStats) return;
    setTimeout(async () => {
      const stats = await pc.getStats();
      let tipo = "?";
      stats.forEach((r) => {
        if (r.type === "candidate-pair" && r.state === "succeeded" && r.nominated) {
          stats.forEach((x) => { if (x.id === r.localCandidateId) tipo = x.candidateType; });
        }
      });
      viaRelay = tipo === "relay";
      $("linkEstado").textContent = "Conexión: " + (viaRelay ? "vía relay (TURN)" : "directa P2P");
      $("linkEstado").className = viaRelay ? "" : "ok";
    }, 1500);
  } catch (e) {}
}

// ==========================================================================
//  Botones
// ==========================================================================
$("btnCrear").onclick = () => crearSala();
$("btnUnirse").onclick = () => unirse($("inputCodigo").value);
$("inputCodigo").addEventListener("keydown", (e) => { if (e.key === "Enter") unirse($("inputCodigo").value); });
$("btnCancelar").onclick = () => { limpiar(); verPanel("menu"); };
$("btnCancelar2").onclick = () => { limpiar(); verPanel("menu"); };
$("btnMenu").onclick = () => { limpiar(); $("overlay").classList.add("oculto"); _ovFirma = ""; verPanel("menu"); };
$("btnRevancha").onclick = () => {
  if (miNumero === 1 && partida) partida.pedirRevancha(1);
  else if (miNumero === 2) enviar(JSON.stringify({ t: "reiniciar" }));
  $("btnRevancha").disabled = true;
  $("overlaySub").textContent = "Esperando al rival…";
};

// ==========================================================================
//  Render
// ==========================================================================
function ajustarCanvas() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = CAMPO_ANCHO * DPR;
  cv.height = CAMPO_ALTO * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.textAlign = "center";
}
window.addEventListener("resize", () => { if (!$("juego").classList.contains("oculto")) ajustarCanvas(); });

const R = Math.round;
let fps = 60, frameLast = performance.now();

function dibujar(now) {
  requestAnimationFrame(dibujar);
  const dt = Math.min((now - frameLast) / 1000, 0.1);
  frameLast = now;
  fps += (1 / Math.max(dt, 1e-3) - fps) * 0.08;

  let p1, p2, bx, by, s1 = 0, s2 = 0, sirviendo = false, cuenta = 0, pausa = 0, ganador = 0;

  if (miNumero === 1 && partida) {
    p1 = partida.pala[1]; p2 = partida.pala[2];
    bx = partida.bola.x; by = partida.bola.y;
    s1 = partida.puntos[1]; s2 = partida.puntos[2];
    sirviendo = partida.sirviendo;
    cuenta = sirviendo ? Math.max(0, Math.ceil(partida.sirveMs / 1000)) : 0;
    pausa = partida.pausas.host ? 1 : (partida.pausas.guest ? 2 : 0);
    ganador = partida.ganador || 0;
  } else if (miNumero === 2 && G.last) {
    const dirLoc = (entrada.abajo ? 1 : 0) - (entrada.arriba ? 1 : 0);
    if (!G.last.pausa && !G.last.ganador)
      G.predP2 = clamp(G.predP2 + dirLoc * PALA_VEL_PS * dt, 0, CAMPO_ALTO - PALA_ALTO);
    p2 = G.predP2;

    G.vistaP1 = interpP1(now - G.interpDelay);
    p1 = G.vistaP1;

    const proj = extrapBola(G.ball, (now - G.ball.stamp) / 1000);
    const k = Math.pow(0.002, dt);           // el error de pelota decae ~99.8%/s
    G.ballErr.x *= k; G.ballErr.y *= k;
    bx = proj.x + G.ballErr.x;
    by = proj.y + G.ballErr.y;

    s1 = G.last.s1; s2 = G.last.s2;
    sirviendo = G.last.sirviendo; cuenta = G.last.cuenta;
    pausa = G.last.pausa; ganador = G.last.ganador;

    G.palaEnvAcc += dt * 1000;
    const cada = dirLoc !== 0 ? (1000 / SEND_HZ) : 80;
    if (G.palaEnvAcc >= cada) { G.palaEnvAcc = 0; enviar(encPala(++G.palaSeq, G.predP2)); }
  } else {
    p1 = p2 = (CAMPO_ALTO - PALA_ALTO) / 2;
    bx = CAMPO_ANCHO / 2; by = CAMPO_ALTO / 2;
  }

  ctx.fillStyle = "#05070b";
  ctx.fillRect(0, 0, CAMPO_ANCHO, CAMPO_ALTO);

  ctx.strokeStyle = "#202733";
  ctx.setLineDash([10, 14]); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(CAMPO_ANCHO / 2, 0); ctx.lineTo(CAMPO_ANCHO / 2, CAMPO_ALTO); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#e8ecf1";
  ctx.font = "bold 48px ui-monospace, monospace";
  ctx.fillText(s1, CAMPO_ANCHO / 2 - 64, 62);
  ctx.fillText(s2, CAMPO_ANCHO / 2 + 64, 62);

  ctx.fillStyle = miNumero === 1 ? "#5be0e0" : "#2f7d7d";
  ctx.fillRect(PALA_MARGEN, R(p1), PALA_ANCHO, PALA_ALTO);
  ctx.fillStyle = miNumero === 2 ? "#e05be0" : "#7d2f7d";
  ctx.fillRect(CAMPO_ANCHO - PALA_MARGEN - PALA_ANCHO, R(p2), PALA_ANCHO, PALA_ALTO);

  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(R(bx), R(by), BOLA_RADIO, 0, 6.2832); ctx.fill();

  if (sirviendo && cuenta > 0 && !pausa && !ganador) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 92px ui-monospace, monospace";
    ctx.fillText(cuenta, CAMPO_ANCHO / 2, CAMPO_ALTO / 2 + 32);
  }

  refrescarOverlay();
  if (hudOn) dibujarHUD();
}

function interpP1(rt) {
  const b = G.buf;
  if (b.length === 0) return G.vistaP1;
  if (rt <= b[0].stamp) return b[0].p1;
  for (let i = 0; i < b.length - 1; i++) {
    if (rt <= b[i + 1].stamp) {
      const t = (rt - b[i].stamp) / (b[i + 1].stamp - b[i].stamp || 1);
      return b[i].p1 + (b[i + 1].p1 - b[i].p1) * t;
    }
  }
  return b[b.length - 1].p1;   // starved -> hold
}

function dibujarHUD() {
  const L = [
    "FPS " + fps.toFixed(0),
    "RTT " + rttMs.toFixed(0) + " ms",
    "jitter " + G.jitter.toFixed(1) + " ms",
    "interp " + G.interpDelay.toFixed(0) + " ms",
    "in  " + (hudIn / 1024).toFixed(1) + " KB/s  " + hudInMsg + "/s",
    "out " + (hudOut / 1024).toFixed(1) + " KB/s",
    (viaRelay ? "RELAY" : "P2P directo") + " · " + (CANAL_CONFIABLE ? "reliable" : "unreliable"),
    "rol " + (miNumero === 1 ? "host · sim 120Hz" : "guest"),
  ];
  ctx.font = "11px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(6, 74, 196, L.length * 14 + 10);
  ctx.fillStyle = "#8affc8";
  L.forEach((l, i) => ctx.fillText(l, 14, 92 + i * 14));
  ctx.textAlign = "center";
}

setInterval(() => {
  hudIn = accIn; hudInMsg = accInMsg; hudOut = accOut;
  accIn = accInMsg = accOut = 0;
}, 1000);

window.__d = {
  get peer() { return peer; },
  get conn() { return conn; },
  get connOpen() { return !!(conn && conn.open); },
  get hostLoop() { return !!hostLoop; },
  get partida() { return partida; },
  get miNumero() { return miNumero; },
  G, entrada,
  get hud() { return { fps: fps | 0, rttMs, jitter: G.jitter, interp: G.interpDelay, hudIn, hudInMsg, hudOut }; },
};

requestAnimationFrame(dibujar);
ajustarCanvas();
