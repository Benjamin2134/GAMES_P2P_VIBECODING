// ==========================================================================
//  App (hilo principal): menu, transporte P2P (PeerJS/WebRTC), render.
//  El HOST ademas corre la simulacion (clase Partida de sim.js).
//  build.mjs arma el <script> de la pagina como: const.js + sim.js + este.
// ==========================================================================
"use strict";

// ---------- CONFIG DE RED ----------
// STUN = para conectar directo (gratis, sin cuenta).
// TURN = relay para NAT duro / CGNAT. Si "Conexion" queda en "via relay" o no
//        conecta, crea una cuenta gratis en https://www.metered.ca/tools/openrelay/
//        (o levanta tu propio coturn) y descomenta las lineas turn: con tus datos.
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
  // { urls: "turn:TU_HOST:3478", username: "usuario", credential: "clave" },
  // { urls: "turn:TU_HOST:3478?transport=tcp", username: "usuario", credential: "clave" },
];
const PREFIJO = "pong-";
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// ---------- refs ----------
const $ = (id) => document.getElementById(id);
const cv = $("cv"), ctx = cv.getContext("2d");

let peer = null, conn = null, miNumero = null;
let partida = null;            // solo host
let ultimoEstado = null;
let rivalCortado = false;
let hbInput = null;
let hbRevancha = null;
const teclas = { arriba: false, abajo: false };
const vista = { bx: CAMPO_ANCHO / 2, by: CAMPO_ALTO / 2, p1: (CAMPO_ALTO - PALA_ALTO) / 2, p2: (CAMPO_ALTO - PALA_ALTO) / 2 };

function verPanel(id) {
  for (const p of ["menu", "esperando", "conectando", "juego"]) $(p).classList.toggle("oculto", p !== id);
}
function azar4() {
  let s = "";
  for (let i = 0; i < 4; i++) s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  return s;
}
function limpiar() {
  if (partida) { partida.detener(); if (partida._empujarLocal) clearInterval(partida._empujarLocal); partida = null; }
  if (hbInput) { clearInterval(hbInput); hbInput = null; }
  if (hbRevancha) { clearInterval(hbRevancha); hbRevancha = null; }
  try { if (conn) conn.close(); } catch (e) {}
  try { if (peer) peer.destroy(); } catch (e) {}
  conn = null; peer = null; miNumero = null; ultimoEstado = null; rivalCortado = false;
}

// ---------- HOST ----------
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
      partida = new Partida((estado) => {
        ultimoEstado = estado;
        try { if (conn && conn.open) conn.send(estado); } catch (e) {}
        refrescarOverlay();
      });
      partida._empujarLocal = setInterval(() => { if (partida) partida.input[1] = { ...teclas }; }, TICK_MS);
    });
    c.on("data", (m) => {
      if (typeof m === "string") { try { m = JSON.parse(m); } catch (e) { return; } }
      if (!m || !partida) return;
      if (m.t === "input") partida.input[2] = { arriba: !!m.arriba, abajo: !!m.abajo };
      else if (m.t === "reiniciar") partida.pedirRevancha(2);
      else if (m.t === "pausa") partida.pausas.guest = !!m.on;
    });
    c.on("close", () => rivalSeFue());
    c.on("error", () => rivalSeFue());
  });
}

// ---------- GUEST ----------
function unirse(codigoVisible) {
  const codigo = PREFIJO + codigoVisible.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (codigoVisible.trim().length < 3) { $("inputCodigo").focus(); return; }
  limpiar();
  verPanel("conectando");
  $("estadoGuest").textContent = "Conectando al servidor de saludo…";
  peer = new Peer({ config: { iceServers: ICE_SERVERS } });

  peer.on("open", () => {
    $("estadoGuest").textContent = "Buscando la sala " + codigoVisible.toUpperCase() + "…";
    conn = peer.connect(codigo, { reliable: true });
    conn.on("open", () => {
      miNumero = 2;
      rivalCortado = false;
      verPanel("juego");
      reportarViaRelay(conn);
      hbInput = setInterval(enviarInput, 250);
    });
    conn.on("data", (m) => {
      if (typeof m === "string") { try { m = JSON.parse(m); } catch (e) { return; } }
      if (m && m.t === "estado") { ultimoEstado = m; refrescarOverlay(); }
    });
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

function enviarInput() {
  try { if (conn && conn.open) conn.send({ t: "input", arriba: teclas.arriba, abajo: teclas.abajo }); } catch (e) {}
}

function rivalSeFue() {
  rivalCortado = true;
  if (partida) { partida.detener(); if (partida._empujarLocal) clearInterval(partida._empujarLocal); partida = null; }
  if (hbInput) { clearInterval(hbInput); hbInput = null; }
  ultimoEstado = null;
  verPanel("juego");
  refrescarOverlay();
}

// ---------- pausa al minimizar / cambiar de pestana ----------
document.addEventListener("visibilitychange", () => {
  const oculto = document.hidden;
  if (miNumero === 1 && partida) partida.pausas.host = oculto;
  if (miNumero === 2) { try { if (conn && conn.open) conn.send({ t: "pausa", on: oculto }); } catch (e) {} }
  if (oculto) { teclas.arriba = teclas.abajo = false; if (miNumero === 2) enviarInput(); }
});

// ---------- overlay (fin de partida / pausa / desconexion) ----------
function refrescarOverlay() {
  const ov = $("overlay");
  const e = ultimoEstado;

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
    const yo = !!e.revancha[miNumero];
    ov.classList.remove("oculto");
    $("overlayTexto").textContent = gane ? "GANASTE 🏆" : "PERDISTE";
    $("overlaySub").textContent = yo ? "Esperando al rival…" : "Marcador " + e.s[1] + " - " + e.s[2];
    $("btnRevancha").classList.remove("oculto");
    $("btnMenu").classList.add("oculto");
    $("btnRevancha").disabled = yo;
    return;
  }
  if (e.pausa) {
    const fuiYo = (e.pausa === "host" && miNumero === 1) || (e.pausa === "guest" && miNumero === 2);
    ov.classList.remove("oculto");
    $("overlayTexto").textContent = "⏸ Pausa";
    $("overlaySub").textContent = fuiYo ? "Volvé a esta pestaña para seguir." : "El otro jugador salió de la pestaña.";
    $("btnRevancha").classList.add("oculto");
    $("btnMenu").classList.add("oculto");
    return;
  }
  ov.classList.add("oculto");
  $("btnRevancha").disabled = false;
  if (hbRevancha) { clearInterval(hbRevancha); hbRevancha = null; }
}

// ---------- diagnostico: directo o via relay ----------
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
      $("linkEstado").textContent = "Conexión: " + (tipo === "relay" ? "vía relay (TURN)" : "directa P2P");
      $("linkEstado").className = tipo === "relay" ? "" : "ok";
    }, 1500);
  } catch (e) {}
}

// ---------- teclado ----------
function tecla(e, abajo) {
  const k = e.key.toLowerCase();
  let cambio = false;
  if (k === "arrowup" || k === "w") { if (teclas.arriba !== abajo) { teclas.arriba = abajo; cambio = true; } }
  if (k === "arrowdown" || k === "s") { if (teclas.abajo !== abajo) { teclas.abajo = abajo; cambio = true; } }
  if (k === "arrowup" || k === "arrowdown") e.preventDefault();
  if (cambio && miNumero === 2) enviarInput();
}
window.addEventListener("keydown", (e) => tecla(e, true));
window.addEventListener("keyup", (e) => tecla(e, false));
window.addEventListener("blur", () => { teclas.arriba = teclas.abajo = false; if (miNumero === 2) enviarInput(); });

// ---------- botones ----------
$("btnCrear").onclick = () => crearSala();
$("btnUnirse").onclick = () => unirse($("inputCodigo").value);
$("inputCodigo").addEventListener("keydown", (e) => { if (e.key === "Enter") unirse($("inputCodigo").value); });
$("btnCancelar").onclick = () => { limpiar(); verPanel("menu"); };
$("btnCancelar2").onclick = () => { limpiar(); verPanel("menu"); };
$("btnMenu").onclick = () => { limpiar(); $("overlay").classList.add("oculto"); verPanel("menu"); };
$("btnRevancha").onclick = () => {
  if (miNumero === 1 && partida) { partida.pedirRevancha(1); }
  else if (miNumero === 2) {
    const enviar = () => { try { if (conn && conn.open) conn.send({ t: "reiniciar" }); } catch (e) {} };
    enviar();
    if (!hbRevancha) hbRevancha = setInterval(enviar, 400);
  }
  $("btnRevancha").disabled = true;
  $("overlaySub").textContent = "Esperando al rival…";
};

// ---------- render ----------
const lerp = (a, b, t) => a + (b - a) * t;
function dibujar() {
  requestAnimationFrame(dibujar);
  ctx.clearRect(0, 0, CAMPO_ANCHO, CAMPO_ALTO);
  ctx.strokeStyle = "#202733";
  ctx.setLineDash([10, 14]); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(CAMPO_ANCHO / 2, 0); ctx.lineTo(CAMPO_ANCHO / 2, CAMPO_ALTO); ctx.stroke();
  ctx.setLineDash([]);

  const e = ultimoEstado;
  if (!e) return;
  vista.p1 = lerp(vista.p1, e.p[1], 0.4);
  vista.p2 = lerp(vista.p2, e.p[2], 0.4);
  const salto = Math.hypot(e.b.x - vista.bx, e.b.y - vista.by) > 220;
  vista.bx = salto ? e.b.x : lerp(vista.bx, e.b.x, 0.5);
  vista.by = salto ? e.b.y : lerp(vista.by, e.b.y, 0.5);

  ctx.fillStyle = "#e8ecf1";
  ctx.font = "bold 48px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(e.s[1], CAMPO_ANCHO / 2 - 64, 62);
  ctx.fillText(e.s[2], CAMPO_ANCHO / 2 + 64, 62);

  ctx.fillStyle = miNumero === 1 ? "#5be0e0" : "#2f7d7d";
  ctx.fillRect(PALA_MARGEN, vista.p1, PALA_ANCHO, PALA_ALTO);
  ctx.fillStyle = miNumero === 2 ? "#e05be0" : "#7d2f7d";
  ctx.fillRect(CAMPO_ANCHO - PALA_MARGEN - PALA_ANCHO, vista.p2, PALA_ANCHO, PALA_ALTO);

  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(vista.bx, vista.by, BOLA_RADIO, 0, Math.PI * 2); ctx.fill();

  if (e.sirviendo && e.cuenta > 0 && !e.pausa) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 92px ui-monospace, monospace";
    ctx.fillText(e.cuenta, CAMPO_ANCHO / 2, CAMPO_ALTO / 2 + 32);
  }
}
requestAnimationFrame(dibujar);
