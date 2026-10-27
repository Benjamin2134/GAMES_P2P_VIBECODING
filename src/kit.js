// ==========================================================================
//  KIT compartido de los juegos del setlist (logica pura, sin DOM).
//  - SimBase: ganador, eventos (sonidos/efectos que viajan dentro de la vista)
//    y vista base por jugador.
//  - Helpers de azar, grillas y sanitizado de inputs del guest.
//  - Bots: temporizador de turno con latencia humana y negamax alfa-beta.
//  Lo usan los *.sim.js y *.bot.js nuevos; corre igual en Node (test.mjs).
// ==========================================================================
const Kit = {};
Kit.SIMS = {};    // id -> clase Sim (cada *.sim.js se registra; lo usa test.setlist.mjs)

// Paleta comun: P1 celeste, P2 rosa, acento ambar del landing.
Kit.COL = {
  p1: "#38bdf8", p2: "#fb7185", acento: "#f4b944",
  fondo: "#0b0d12", panel: "#16181f", borde: "#2a2d36",
  texto: "#f0f0f0", tenue: "#8b8f99", ok: "#34d399", mal: "#f87171",
};

Kit.rnd = (a, b) => a + Math.random() * (b - a);
Kit.ri = (a, b) => Math.floor(a + Math.random() * (b - a + 1));      // entero en [a, b]
Kit.elegir = (arr) => arr[Math.floor(Math.random() * arr.length)];
Kit.mezclar = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const x = arr[i]; arr[i] = arr[j]; arr[j] = x;
  }
  return arr;
};
Kit.grilla = (w, h, v = 0) => Array.from({ length: h }, () => Array(w).fill(v));
Kit.copia = (o) => JSON.parse(JSON.stringify(o));
Kit.otro = (j) => (j === 1 ? 2 : 1);
Kit.r1 = (x) => Math.round(x * 10) / 10;
Kit.r2 = (x) => Math.round(x * 100) / 100;
// El host nunca confia en lo que manda el guest: numeros finitos y acotados.
Kit.num = (x, a, b, def = 0) => (typeof x === "number" && isFinite(x) ? clamp(x, a, b) : def);
Kit.ent = (x, a, b) => (Number.isInteger(x) && x >= a && x <= b ? x : null);
// Generador con semilla (mulberry32): misma secuencia para ambos jugadores.
Kit.semilla = (s) => () => {
  s |= 0; s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// --------------------------------------------------------------------------
//  SimBase: toda Sim nueva hereda de aca.
//  ganador: 0 en juego, 1 o 2 gano, 3 empate.
//  emitir(): evento con id creciente; viaja en la vista y cada lado lo
//  reproduce una sola vez (aunque se pierdan snapshots en el canal).
//  para: si se indica, solo lo ve ese jugador (info oculta).
// --------------------------------------------------------------------------
class SimBase {
  constructor(o = {}) {
    this.partida = o.partida || 1;
    this.ganador = 0;
    this._ev = [];
    this._evId = 0;
  }
  // En partidas impares empieza P1, en pares P2.
  get primero() { return this.partida % 2 ? 1 : 2; }
  emitir(tipo, datos, para) {
    const e = Object.assign({ id: ++this._evId, tipo }, datos);
    if (para) e.para = para;
    this._ev.push(e);
    if (this._ev.length > 16) this._ev.shift();
  }
  terminar(g) {
    if (this.ganador) return;
    this.ganador = g;
    this.emitir("fin", { g });
  }
  base(r) { return { yo: r, g: this.ganador, ev: this._ev.filter((e) => !e.para || e.para === r) }; }
  vista(r) { return this.base(r); }
  accion(j, a) {}
  input(j, i) {}
}

// --------------------------------------------------------------------------
//  Bot de turnos: espera un tiempo humano (600-1100 ms por defecto) cuando
//  le toca y entonces pide una jugada a elegir(vista). La vista es la misma
//  que veria un humano en el lugar del bot.
//    BOTS.x = Kit.botTurnos(elegir, { espera: [min, max], puede: (v) => bool })
//    BOTS.x.nuevo() -> { step(vista, api, dt) }   api = { accion(a), input(i) }
// --------------------------------------------------------------------------
Kit.botTurnos = function (elegir, o = {}) {
  const espera = o.espera || [0.6, 1.1];
  const puede = o.puede || ((v) => v.turno === v.yo);
  return {
    elegir,
    nuevo() {
      let t = 0, meta = Kit.rnd(espera[0], espera[1]);
      return {
        step(v, api, dt) {
          if (!v || v.g || !puede(v)) { t = 0; return; }
          t += dt;
          if (t < meta) return;
          t = 0; meta = Kit.rnd(espera[0], espera[1]);
          const a = elegir(v);
          if (a) api.accion(a);
        },
      };
    },
  };
};

// --------------------------------------------------------------------------
//  Negamax con poda alfa-beta, generico para los bots de tablero.
//  R = { movs(s), aplicar(s, m) -> s2 nuevo, eval(s) desde el que mueve,
//        fin(s, prof) -> null | valor desde el que mueve,
//        sigue(s, s2) -> true si el mismo jugador vuelve a mover }
// --------------------------------------------------------------------------
Kit.negamax = function (s, prof, alfa, beta, R) {
  const f = R.fin(s, prof);
  if (f !== null && f !== undefined) return { v: f, m: null };
  if (prof <= 0) return { v: R.eval(s), m: null };
  const ms = R.movs(s);
  if (!ms.length) return { v: R.eval(s), m: null };
  let mejor = -Infinity, mm = ms[0];
  for (const m of ms) {
    const s2 = R.aplicar(s, m);
    const v = R.sigue && R.sigue(s, s2)
      ? Kit.negamax(s2, prof - 1, alfa, beta, R).v
      : -Kit.negamax(s2, prof - 1, -beta, -alfa, R).v;
    if (v > mejor) { mejor = v; mm = m; }
    if (mejor > alfa) alfa = mejor;
    if (alfa >= beta) break;
  }
  return { v: mejor, m: mm };
};

// Mueve un valor hacia una meta con velocidad maxima (bots de tiempo real).
Kit.hacia = (x, meta, vmax, dt) => {
  const d = meta - x, m = vmax * dt;
  return Math.abs(d) <= m ? meta : x + Math.sign(d) * m;
};

// Normaliza texto para comparar palabras (sin tildes, minusculas, sin espacios extra).
Kit.normal = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-zñ ]/g, "").replace(/\s+/g, " ").trim();
