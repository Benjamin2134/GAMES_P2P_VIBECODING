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
let enJuego = false, rivalCortado = false, esBot = false;
let pausa = { host: false, guest: false };
const pausado = () => pausa.host || pausa.guest;

const net = {
  get rol() { return rol; },
  get esBot() { return esBot; },
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
  const displayW = Math.max(w, 960);
  $("lienzoWrap").style.width = "min(" + displayW + "px, 96vw)";
}
window.addEventListener("resize", () => { if (juego && enJuego) ajustarCanvas(juego.canvas.w, juego.canvas.h); });

function limpiar() {
  if (juego && juego.destruir) { try { juego.destruir(); } catch (e) {} }
  juego = null; enJuego = false; rivalCortado = false; esBot = false; pausa = { host: false, guest: false }; _fw = "";
  try { if (conn) conn.close(); } catch (e) {}
  try { if (peer) peer.destroy(); } catch (e) {}
  conn = null; peer = null; rol = null;
}
function volverAlMenu() { limpiar(); $("overlay").classList.add("oculto"); verPanel("seljuego"); }

function iniciarContraBot(id) {
  if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
  empezarJuego(id, 1, true);
}

// ---------- crear / unirse ----------
function crearSala(id) {
  limpiar();
  juegoId = id;
  rol = 1;
  esBot = false;
  verPanel("esperando");
  const tieneBot = typeof BOTS !== "undefined" && !!BOTS[id];
  const btnBot = $("btnJugarBot");
  if (btnBot) btnBot.classList.toggle("oculto", !tieneBot);
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

let _ayudaBase = null;   // ayuda original del template (juegos que no traen la suya)
function empezarJuego(id, r, contraBot = false) {
  juego = JUEGOS[id];
  if (!juego) { $("estadoGuest").innerHTML = '<span class="err">Juego desconocido: ' + id + "</span>"; return; }
  juegoId = id; rol = r; esBot = !!contraBot;
  enJuego = true; rivalCortado = false; pausa = { host: false, guest: false }; _fw = "";
  ajustarCanvas(juego.canvas.w, juego.canvas.h);
  const ay = $("ayuda");
  if (ay) { if (_ayudaBase === null) _ayudaBase = ay.innerHTML; ay.innerHTML = juego.ayuda || _ayudaBase; }
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
if ($("btnJugarBot")) $("btnJugarBot").onclick = () => iniciarContraBot(juegoId);
$("btnCancelar").onclick = volverAlMenu;
$("btnCancelar2").onclick = volverAlMenu;
$("btnMenu").onclick = volverAlMenu;
$("btnRevancha").onclick = () => { if (juego && juego.revancha) juego.revancha(); _fw = ""; };
$("btnMute").onclick = () => {
  try { RetroAudio.init(); $("btnMute").textContent = RetroAudio.toggleMute() ? "🔇" : "🔊"; } catch (e) {}
};

// ---------- selector ----------
const METADATOS_JUEGOS = {
  pong: { tag: "PONG", icono: "🏓", gradiente: "linear-gradient(135deg, #052e16 0%, #064e3b 100%)", color: "#10b981", tipo: "real" },
  billar: { tag: "POOL", icono: "🎱", gradiente: "linear-gradient(135deg, #064e3b 0%, #0f172a 100%)", color: "#34d399", tipo: "turnos" },
  spacewar: { tag: "1979", icono: "🚀", gradiente: "linear-gradient(135deg, #1e1b4b 0%, #31104b 100%)", color: "#a855f7", tipo: "real" },
  battleship: { tag: "NAVY", icono: "🚢", gradiente: "linear-gradient(135deg, #082f49 0%, #0c4a6e 100%)", color: "#38bdf8", tipo: "turnos" },
  tron: { tag: "LIGHT", icono: "⚡", gradiente: "linear-gradient(135deg, #042f2e 0%, #111827 100%)", color: "#2dd4bf", tipo: "real" },
  monopoly: { tag: "DUEL", icono: "🎩", gradiente: "linear-gradient(135deg, #3f2c06 0%, #1c1917 100%)", color: "#f59e0b", tipo: "turnos" },
  techno: { tag: "JAM", icono: "🎛️", gradiente: "linear-gradient(135deg, #4a044e 0%, #1e1b4b 100%)", color: "#f43f5e", tipo: "real" }
};

// Filtros del selector. Los juegos nuevos traen meta y tipo en su propio modulo.
const FILTROS = [
  { id: "todos", txt: "Todos", f: () => true },
  { id: "real", txt: "Tiempo real", f: (id, j, m) => (j.tipo || m.tipo) === "real" },
  { id: "turnos", txt: "Por turnos", f: (id, j, m) => (j.tipo || m.tipo) === "turnos" },
  { id: "bot", txt: "Con bot", f: (id) => typeof BOTS !== "undefined" && !!BOTS[id] },
];
let filtroActivo = "todos";
function pintarFiltros() {
  const c = $("filtros");
  if (!c) return;
  c.innerHTML = "";
  for (const fl of FILTROS) {
    const b = document.createElement("button");
    b.className = "chip" + (fl.id === filtroActivo ? " activo" : "");
    b.textContent = fl.txt;
    b.onclick = () => { filtroActivo = fl.id; pintarFiltros(); pintarSelector(); };
    c.appendChild(b);
  }
}

function pintarSelector() {
  const c = $("listaJuegos");
  if (!c) return;
  c.innerHTML = "";
  const fl = FILTROS.find((x) => x.id === filtroActivo) || FILTROS[0];
  for (const id of Object.keys(JUEGOS)) {
    const j = JUEGOS[id];
    const meta = j.meta || METADATOS_JUEGOS[id] || { tag: "P2P", icono: "🎮", gradiente: "linear-gradient(135deg, #18181a 0%, #262b36 100%)", color: "#f4b944" };
    if (!fl.f(id, j, meta)) continue;
    const conBot = typeof BOTS !== "undefined" && !!BOTS[id];
    const card = document.createElement("div");
    card.className = "game-card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.innerHTML =
      '<div class="game-cover" style="background: ' + meta.gradiente + ';">' +
        '<span class="game-cover-badge" style="color:' + meta.color + ';">' + meta.tag + '</span>' +
        (conBot ? '<span class="game-cover-bot" title="Se puede jugar contra el BOT">🤖</span>' : '') +
        '<div class="game-cover-icon">' + meta.icono + '</div>' +
      '</div>' +
      '<div class="game-info">' +
        '<div class="game-name">' + j.nombre + '</div>' +
        '<div class="game-desc">' + (j.desc || "") + '</div>' +
      '</div>';
    card.onclick = () => crearSala(id);
    card.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); crearSala(id); } };
    c.appendChild(card);
  }
}
window.volverAlMenu = volverAlMenu;

// ---------- accesos directos: links a juegos externos, guardados en este navegador ----------
const CLAVE_ACCESOS = "g2p-accesos";
function leerAccesos() {
  try {
    const a = JSON.parse(localStorage.getItem(CLAVE_ACCESOS) || "[]");
    return Array.isArray(a) ? a.filter((x) => x && typeof x.nombre === "string" && /^https?:\/\//i.test(x.url)) : [];
  } catch (e) { return []; }
}
function guardarAccesos(a) { try { localStorage.setItem(CLAVE_ACCESOS, JSON.stringify(a)); } catch (e) {} }
// Sugeridos: ports y clasicos gratis y legales en el navegador (oficiales, shareware, freeware)
// y juegos multijugador de navegador. Se agregan una sola vez; despues cada uno los edita.
const ACCESOS_SUGERIDOS = [
  { nombre: "Diablo (shareware)", url: "https://d07riv.github.io/diabloweb/" },
  { nombre: "DOOM (episodio shareware)", url: "https://archive.org/details/DoomsharewareEpisode" },
  { nombre: "Celeste Classic", url: "https://www.lexaloffle.com/bbs/?tid=2145" },
  { nombre: "Minecraft Classic", url: "https://classic.minecraft.net/" },
  { nombre: "Pac-Man (Google)", url: "https://www.google.com/logos/2010/pacman10-i.html" },
  { nombre: "Townscaper", url: "https://oskarstalberg.com/Townscaper/" },
  { nombre: "DOS Games Archive", url: "https://www.dosgamesarchive.com/" },
  { nombre: "EmulatorJS (tus ROMs)", url: "https://emulatorjs.org/" },
  { nombre: "skribbl.io", url: "https://skribbl.io/" },
  { nombre: "Gartic Phone", url: "https://garticphone.com/" },
  { nombre: "Krunker", url: "https://krunker.io/" },
  { nombre: "slither.io", url: "https://slither.io/" },
  { nombre: "Jstris", url: "https://jstris.jezevec10.com/" },
  { nombre: "2048", url: "https://play2048.co/" },
];
(function sembrarAccesos() {
  try {
    if (localStorage.getItem(CLAVE_ACCESOS + "-sembrado")) return;
    const l = leerAccesos(), hay = new Set(l.map((x) => x.url));
    for (const a of ACCESOS_SUGERIDOS) if (!hay.has(a.url)) l.push(a);
    guardarAccesos(l);
    localStorage.setItem(CLAVE_ACCESOS + "-sembrado", "1");
  } catch (e) {}
})();
const colorDe = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360; return "hsl(" + h + ",55%,38%)"; };
function pintarAccesos() {
  const c = $("listaAccesos");
  if (!c) return;
  c.innerHTML = "";
  leerAccesos().forEach((a, i) => {
    // todo con textContent: el nombre y la URL los escribe el usuario
    const card = document.createElement("a");
    card.className = "acceso-card"; card.href = a.url; card.target = "_blank"; card.rel = "noopener noreferrer";
    const ini = document.createElement("span");
    ini.className = "acceso-ini"; ini.textContent = (a.nombre.trim()[0] || "?").toUpperCase(); ini.style.background = colorDe(a.nombre);
    const txt = document.createElement("span"), n = document.createElement("b"), d = document.createElement("small");
    txt.className = "acceso-txt"; n.textContent = a.nombre;
    try { d.textContent = new URL(a.url).hostname; } catch (e) {}
    txt.append(n, d);
    const x = document.createElement("button");
    x.className = "acceso-x"; x.title = "Quitar"; x.textContent = "×";
    x.onclick = (e) => { e.preventDefault(); e.stopPropagation(); const l = leerAccesos(); l.splice(i, 1); guardarAccesos(l); pintarAccesos(); };
    card.append(ini, txt, x);
    c.appendChild(card);
  });
  const mas = document.createElement("button");
  mas.className = "acceso-card acceso-mas"; mas.textContent = "＋ Agregar acceso directo";
  mas.onclick = () => { $("formAcceso").classList.remove("oculto"); $("accNombre").focus(); };
  c.appendChild(mas);
}
if ($("formAcceso")) {
  $("formAcceso").onsubmit = (e) => {
    e.preventDefault();
    const nombre = $("accNombre").value.trim().slice(0, 40);
    let url = $("accUrl").value.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try { new URL(url); } catch (err) { $("accUrl").focus(); return; }
    if (!nombre) { $("accNombre").focus(); return; }
    const l = leerAccesos(); l.push({ nombre, url }); guardarAccesos(l);
    $("accNombre").value = ""; $("accUrl").value = "";
    $("formAcceso").classList.add("oculto");
    pintarAccesos();
  };
  $("accCancelar").onclick = () => $("formAcceso").classList.add("oculto");
}

// ---------- loop maestro ----------
let _mLast = performance.now();
function master(now) {
  requestAnimationFrame(master);
  let dt = (now - _mLast) / 1000;
  _mLast = now;
  if (!(dt > 0)) dt = 1 / 60;
  if (dt > 0.25) dt = 0.25;
  if (enJuego && juego) {
    if (esBot && juego.botStep) { try { juego.botStep(dt); } catch (e) {} }
    try { juego.frame(now, dt, pausado()); } catch (e) {}
  }
  refrescarOverlay();
}

pintarFiltros();
pintarSelector();
pintarAccesos();
verPanel("seljuego");
requestAnimationFrame(master);
