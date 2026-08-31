// ==========================================================================
//  SHELL: selector de juego + transporte P2P (PeerJS/WebRTC) + loop maestro.
//  Cada juego es un modulo en JUEGOS.xxx con:
//    nombre, desc, canvas:{w,h}
//    iniciarHost(), iniciarGuest(), destruir()
//    onData(msg)            msg = objeto JSON ya parseado, o ArrayBuffer
//    frame(now, dtSeg, pausado)
//    overlay() -> null | {texto, sub, revancha:bool, revanchaPedida:bool}
//    revancha()
//  Globales que exponen a los juegos: cv, ctx, net  ({rol, enviar}).
// ==========================================================================
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
  // TURN (relay) para NAT duro / CGNAT. Cuenta gratis: metered.ca/tools/openrelay
  // { urls: "turn:TU_HOST:3478", username: "usuario", credential: "clave" },
];
const PREFIJO = "g2p-";
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const $ = (id) => document.getElementById(id);
const cv = $("cv");
const ctx = cv.getContext("2d", { alpha: false, desynchronized: true });
let DPR = 1;

let peer = null, conn = null, rol = null;
let juego = null, juegoId = null;
let enJuego = false, rivalCortado = false;
let pausa = { host: false, guest: false };
const pausado = () => pausa.host || pausa.guest;

const net = {
  get rol() { return rol; },
  enviar(x) { try { if (conn && conn.open) conn.send(x); } catch (e) {} },
};

// audio: arranca con el primer gesto del usuario (politica de autoplay)
function _iniAudio() {
  try { RetroAudio.init(); } catch (e) {}
  window.removeEventListener("pointerdown", _iniAudio);
  window.removeEventListener("keydown", _iniAudio);
}
window.addEventListener("pointerdown", _iniAudio);
window.addEventListener("keydown", _iniAudio);

function azar4() {
  let s = "";
  for (let i = 0; i < 4; i++) s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  return s;
}
function verPanel(id) {
  for (const p of ["seljuego", "esperando", "conectando", "juego"]) $(p).classList.toggle("oculto", p !== id);
}
function ajustarCanvas(w, h) {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = w * DPR; cv.height = h * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.textBaseline = "alphabetic";
  $("lienzoWrap").style.width = "min(" + w + "px, 96vw)";
}
window.addEventListener("resize", () => { if (juego && enJuego) ajustarCanvas(juego.canvas.w, juego.canvas.h); });

function limpiar() {
  if (juego && juego.destruir) { try { juego.destruir(); } catch (e) {} }
  juego = null; enJuego = false; rivalCortado = false; pausa = { host: false, guest: false }; _fw = "";
  try { if (conn) conn.close(); } catch (e) {}
  try { if (peer) peer.destroy(); } catch (e) {}
  conn = null; peer = null; rol = null;
}
function volverAlMenu() { limpiar(); $("overlay").classList.add("oculto"); verPanel("seljuego"); }

// ---------- crear / unirse ----------
function crearSala(id) {
  limpiar();
  juegoId = id;
  rol = 1;
  verPanel("esperando");
  const codigo = PREFIJO + azar4().toLowerCase();
  $("codigoSala").textContent = codigo.replace(PREFIJO, "").toUpperCase();
  $("nombreJuegoSala").textContent = JUEGOS[id].nombre;
  $("estadoHost").textContent = "Conectando al servidor de saludo…";
  peer = new Peer(codigo, { config: { iceServers: ICE_SERVERS } });

  peer.on("open", () => { $("estadoHost").textContent = "Esperando a tu amigo…"; });
  peer.on("error", (e) => {
    if (e && e.type === "unavailable-id") { crearSala(id); return; }
    $("estadoHost").innerHTML = '<span class="err">Error: ' + (e && e.type || e) + "</span>";
  });
  peer.on("disconnected", () => { try { peer.reconnect(); } catch (e) {} });

  peer.on("connection", (c) => {
    if (conn) { c.close(); return; }
    conn = c; rol = 1;
    c.on("open", () => {
      net.enviar(JSON.stringify({ t: "__hola", juego: juegoId }));
      empezarJuego(juegoId, 1);
    });
    c.on("data", (d) => rutearData(d));
    c.on("close", () => rivalSeFue());
    c.on("error", () => rivalSeFue());
  });
}

function unirse(codVis) {
  if (!codVis || codVis.trim().length < 3) { $("inputCodigo").focus(); return; }
  const cod = PREFIJO + codVis.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  limpiar();
  rol = 2;
  verPanel("conectando");
  $("estadoGuest").textContent = "Conectando al servidor de saludo…";
  peer = new Peer({ config: { iceServers: ICE_SERVERS } });

  peer.on("open", () => {
    $("estadoGuest").textContent = "Buscando la sala " + codVis.toUpperCase() + "…";
    conn = peer.connect(cod, { reliable: false });
    conn.on("open", () => { $("estadoGuest").textContent = "Conectado — cargando el juego…"; });
    conn.on("data", (d) => rutearData(d));
    conn.on("close", () => rivalSeFue());
    conn.on("error", () => rivalSeFue());
  });
  peer.on("error", (e) => {
    const t = e && e.type;
    let m = "Error: " + (t || e);
    if (t === "peer-unavailable") m = "No existe una sala con ese código (¿bien escrito? ¿ya la creó tu amigo?).";
    $("estadoGuest").innerHTML = '<span class="err">' + m + "</span>";
  });
  peer.on("disconnected", () => { try { peer.reconnect(); } catch (e) {} });
}

function empezarJuego(id, r) {
  juego = JUEGOS[id];
  if (!juego) { $("estadoGuest").innerHTML = '<span class="err">Juego desconocido: ' + id + "</span>"; return; }
  juegoId = id; rol = r;
  enJuego = true; rivalCortado = false; pausa = { host: false, guest: false }; _fw = "";
  ajustarCanvas(juego.canvas.w, juego.canvas.h);
  verPanel("juego");
  if (r === 1) juego.iniciarHost(); else juego.iniciarGuest();
}

function rutearData(d) {
  if (typeof d === "string") {
    let m;
    try { m = JSON.parse(d); } catch (e) { if (juego) juego.onData(d); return; }
    if (m.t === "__hola") { if (rol === 2 && !enJuego) empezarJuego(m.juego, 2); return; }
    if (m.t === "__pausa") { pausa[m.quien] = !!m.on; return; }
    if (juego) juego.onData(m);
    return;
  }
  if (juego) juego.onData(d);
}

function rivalSeFue() {
  if (rivalCortado) return;
  rivalCortado = true;
  if (juego && juego.destruir) { try { juego.destruir(); } catch (e) {} }
  juego = null; enJuego = false; _fw = "";
  verPanel("juego");
}

document.addEventListener("visibilitychange", () => {
  if (!enJuego) return;
  const oc = document.hidden;
  const yo = rol === 1 ? "host" : "guest";
  pausa[yo] = oc;
  for (let i = 0; i < 3; i++) net.enviar(JSON.stringify({ t: "__pausa", quien: yo, on: oc }));
});

// ---------- overlay (shell) ----------
let _fw = "";
function refrescarOverlay() {
  let firma, texto = "", sub = "", rev = false, menu = false, hide = false, revDis = false;
  if (rivalCortado) {
    firma = "corte"; texto = "Se cortó la conexión"; sub = "El otro jugador se desconectó."; menu = true;
  } else if (!enJuego) {
    firma = "off"; hide = true;
  } else if (pausado()) {
    const mio = (rol === 1 && pausa.host) || (rol === 2 && pausa.guest);
    firma = "p" + (pausa.host ? "h" : "") + (pausa.guest ? "g" : "");
    texto = "⏸ Pausa"; sub = mio ? "Volvé a esta pestaña para seguir." : "El otro jugador salió de la pestaña.";
  } else {
    const o = juego && juego.overlay && juego.overlay();
    if (o) {
      firma = "o|" + o.texto + "|" + o.sub + "|" + o.revanchaPedida;
      texto = o.texto; sub = o.sub; rev = !!o.revancha; revDis = !!o.revanchaPedida;
    } else { firma = "juego"; hide = true; }
  }
  if (firma === _fw) return;
  _fw = firma;
  const ov = $("overlay");
  if (hide) { ov.classList.add("oculto"); return; }
  ov.classList.remove("oculto");
  $("overlayTexto").textContent = texto;
  $("overlaySub").textContent = sub;
  $("btnRevancha").classList.toggle("oculto", !rev);
  $("btnRevancha").disabled = revDis;
  $("btnMenu").classList.toggle("oculto", !menu);
}

// ---------- botones ----------
$("btnUnirse").onclick = () => unirse($("inputCodigo").value);
$("inputCodigo").addEventListener("keydown", (e) => { if (e.key === "Enter") unirse($("inputCodigo").value); });
$("btnCancelar").onclick = volverAlMenu;
$("btnCancelar2").onclick = volverAlMenu;
$("btnMenu").onclick = volverAlMenu;
$("btnRevancha").onclick = () => { if (juego && juego.revancha) juego.revancha(); _fw = ""; };
$("btnMute").onclick = () => {
  try { RetroAudio.init(); $("btnMute").textContent = RetroAudio.toggleMute() ? "🔇" : "🔊"; } catch (e) {}
};

// ---------- selector ----------
function pintarSelector() {
  const c = $("listaJuegos");
  c.innerHTML = "";
  for (const id of Object.keys(JUEGOS)) {
    const j = JUEGOS[id];
    const b = document.createElement("button");
    b.className = "juegoBtn";
    b.innerHTML = "<b>" + j.nombre + "</b><span>" + (j.desc || "") + "</span>";
    b.onclick = () => crearSala(id);
    c.appendChild(b);
  }
}

// ---------- loop maestro ----------
let _mLast = performance.now();
function master(now) {
  requestAnimationFrame(master);
  let dt = (now - _mLast) / 1000;
  _mLast = now;
  if (!(dt > 0)) dt = 1 / 60;
  if (dt > 0.25) dt = 0.25;
  if (enJuego && juego) { try { juego.frame(now, dt, pausado()); } catch (e) {} }
  refrescarOverlay();
}

pintarSelector();
verPanel("seljuego");
requestAnimationFrame(master);
