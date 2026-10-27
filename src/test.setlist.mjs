// Tests de los juegos del setlist (kit). Los llama test.mjs.
//   - Comunes a todos: la vista se serializa, no pesa de mas y una partida
//     bot contra bot (cada lado con su propia vista) termina con resultado.
//   - Especificos por juego: reglas puntuales y que la vista no filtre info oculta.
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import vm from "vm";
import { SETLIST, CON_BOT } from "./setlist.mjs";

const SRC = dirname(fileURLToPath(import.meta.url));
const rd = (f) => readFileSync(join(SRC, f), "utf8");

// Opciones de la partida de prueba: dt del bucle y tiempo maximo simulado (s).
// sinPartida: el juego se prueba con casos puntuales (una partida entera seria muy lenta).
const OPC = {
  conecta4: { dt: 1.4, maxT: 200 },
  reversi: { dt: 1.4, maxT: 200 },
  damas: { dt: 1.4, maxT: 600 },
  ajedrez: { sinPartida: true },
  ultimate: { dt: 1.4, maxT: 300 },
  gomoku: { dt: 1.4, maxT: 400 },
  mancala: { dt: 1.4, maxT: 300 },
  memorice: { dt: 0.25, maxT: 600 },
  domino: { dt: 0.5, maxT: 3000 },
  dudo: { dt: 0.5, maxT: 2000 },
  generala: { dt: 1.4, maxT: 1500 },
  ahorcado: { dt: 0.5, maxT: 1500 },
  artilleria: { dt: 1 / 30, maxT: 600 },
  minigolf: { dt: 1 / 30, maxT: 900 },
  curling: { dt: 1 / 30, maxT: 600 },
  airhockey: { dt: 1 / 60, maxT: 900 },
  snake: { dt: 1 / 30, maxT: 600 },
  sumo: { dt: 1 / 60, maxT: 600 },
  reflejos: { dt: 1 / 60, maxT: 300 },
  tanques: { dt: 1 / 60, maxT: 900 },
  pacduelo: { dt: 1 / 60, maxT: 900 },
  bomber: { dt: 1 / 60, maxT: 900 },
  tetris: { dt: 1 / 30, maxT: 1200 },
  breakout: { dt: 1 / 60, maxT: 900 },
  futbol: { dt: 1 / 60, maxT: 200 },
  invasores: { dt: 1 / 60, maxT: 600 },
  carrera: { dt: 1 / 60, maxT: 400 },
};

// FEN -> estado AJ (para perft y posiciones de prueba del ajedrez)
function fen(f) {
  const [pos, turno, enr, ep] = f.split(" ");
  const tab = [];
  for (const ch of pos.replace(/\//g, "")) {
    if (/\d/.test(ch)) for (let k = 0; k < +ch; k++) tab.push("");
    else tab.push(ch);
  }
  const epi = ep && ep !== "-" ? (8 - +ep[1]) * 8 + "abcdefgh".indexOf(ep[0]) : -1;
  return { tab, turno, enr: enr === "-" ? "" : enr, ep: epi, medio: 0 };
}
function perft(AJ, s, d) {
  if (d === 0) return 1;
  let n = 0;
  for (const m of AJ.legales(s)) n += d === 1 ? 1 : perft(AJ, AJ.aplicar(s, m), d - 1);
  return n;
}

// Partida completa: cada bot recibe solo vista(j) y actua por su api.
export function partida(A, id, o = {}) {
  const sim = new A.Kit.SIMS[id]({ partida: o.partida || 1 });
  const dt = o.dt || 1 / 60, maxT = o.maxT || 300, paso = o.paso || 1 / 120;
  const bots = { 1: A.BOTS[id].nuevo(), 2: A.BOTS[id].nuevo() };
  const api = (j) => ({
    accion: (a) => { if (!sim.ganador) sim.accion(j, a); },
    input: (i) => { if (!sim.ganador) sim.input(j, i); },
  });
  const apis = { 1: api(1), 2: api(2) };
  let t = 0;
  while (!sim.ganador && t < maxT) {
    for (const j of [1, 2]) if (!o.solo || o.solo === j) bots[j].step(sim.vista(j), apis[j], dt);
    if (sim.step) { let r = dt; while (r > 1e-9) { const p = Math.min(paso, r); sim.step(p); r -= p; } }
    t += dt;
  }
  return { sim, t };
}

const ESPECIFICOS = {
  conecta4(A, t) {
    const S = A.Kit.SIMS.conecta4;
    const s = new S({ partida: 1 });
    t("conecta4: empieza P1 en partida impar", s.turno === 1);
    t("conecta4: P2 empieza en partida par", new S({ partida: 2 }).turno === 2);
    s.accion(2, { col: 3 });
    t("conecta4: no se juega fuera de turno", s.tab.every((x) => !x));
    s.accion(1, { col: 9 });
    t("conecta4: columna invalida se ignora", s.tab.every((x) => !x) && s.turno === 1);
    s.accion(1, { col: 3 });
    t("conecta4: la ficha cae al fondo", s.tab[5 * 7 + 3] === 1 && s.turno === 2);
    for (let i = 0; i < 3; i++) { s.accion(2, { col: 0 }); s.accion(1, { col: 4 + (i === 2 ? 2 : i) }); }
    t("conecta4: cuatro horizontales ganan", s.ganador === 1 && s.linea.length >= 4);
    const q = new S({ partida: 1 });
    for (let i = 0; i < 6; i++) q.accion(q.turno, { col: 0 });
    const antes = q.turno;
    q.accion(q.turno, { col: 0 });
    t("conecta4: columna llena se rechaza", q.turno === antes);
    // el bot bloquea un 3 en linea evidente
    const b = new S({ partida: 1 });
    b.accion(1, { col: 0 }); b.accion(2, { col: 6 }); b.accion(1, { col: 1 }); b.accion(2, { col: 6 }); b.accion(1, { col: 2 });
    const m = A.BOTS.conecta4.elegir(b.vista(2));
    t("conecta4 bot: bloquea el cuarto en linea", m.col === 3);
    const w = new S({ partida: 2 });
    w.accion(2, { col: 0 }); w.accion(1, { col: 6 }); w.accion(2, { col: 1 }); w.accion(1, { col: 6 }); w.accion(2, { col: 2 }); w.accion(1, { col: 5 });
    t("conecta4 bot: remata cuando puede", A.BOTS.conecta4.elegir(w.vista(2)).col === 3);
  },

  reversi(A, t) {
    const s = new A.Kit.SIMS.reversi({ partida: 1 });
    t("reversi: 4 jugadas al inicio", s.vista(1).validas.length === 4);
    t("reversi: el rival no ve jugadas fuera de su turno", s.vista(2).validas.length === 0);
    const i = s.vista(1).validas[0];
    s.accion(1, { i });
    t("reversi: jugar voltea y pasa el turno", RVcuenta(s, 1) === 4 && RVcuenta(s, 2) === 1 && s.turno === 2);
    s.accion(2, { i: 0 });
    t("reversi: jugada sin volteo se rechaza", s.tab[0] === 0 && s.turno === 2);
    // paso forzado: P2 sin jugadas, P1 sigue
    const p = new A.Kit.SIMS.reversi({ partida: 1 });
    p.tab = Array(64).fill(0); p.tab[0] = 1; p.tab[1] = 2; p.tab[3] = 2; p.tab[63] = 1; p.turno = 1;
    p.accion(1, { i: 2 });
    t("reversi: si el rival no tiene jugadas, pasa", p.turno === 1 && !p.ganador);
    p.accion(1, { i: 4 });
    t("reversi: si nadie puede jugar, termina por fichas", p.ganador === 1);
    function RVcuenta(x, j) { return x.tab.filter((y) => y === j).length; }
  },

  damas(A, t) {
    const DM = A.g("DM");
    const S = A.Kit.SIMS.damas;
    const s = new S({ partida: 1 });
    t("damas: 12 piezas por lado", s.vista(1).cuenta[1] === 12 && s.vista(1).cuenta[2] === 12);
    t("damas: 7 jugadas iniciales", DM.movs(s.tab, 1).length === 7);
    // captura obligatoria
    const c = new S({ partida: 1 });
    c.tab = Array(64).fill(0); c.tab[5 * 8 + 2] = 1; c.tab[4 * 8 + 3] = 2; c.tab[7 * 8 + 6] = 1; c.tab[0 * 8 + 1] = 2;
    const ms = DM.movs(c.tab, 1);
    t("damas: si hay captura, es la unica jugada", ms.length === 1 && ms[0].cap === 4 * 8 + 3);
    c.accion(1, { de: 7 * 8 + 6, a: 6 * 8 + 5 });
    t("damas: jugada simple con captura pendiente se rechaza", c.tab[7 * 8 + 6] === 1 && c.turno === 1);
    // doble salto: la misma pieza sigue
    const d = new S({ partida: 1 });
    d.tab = Array(64).fill(0); d.tab[6 * 8 + 1] = 1; d.tab[5 * 8 + 2] = 2; d.tab[3 * 8 + 4] = 2; d.tab[0] = 2;
    d.accion(1, { de: 6 * 8 + 1, a: 4 * 8 + 3 });
    t("damas: tras capturar, si puede seguir, sigue su turno", d.turno === 1 && d.enc === 4 * 8 + 3);
    d.accion(1, { de: 4 * 8 + 3, a: 2 * 8 + 5 });
    t("damas: doble salto completo", d.vista(1).cuenta[2] === 1 && d.turno === 2);
    // peon no captura hacia atras
    const b = new S({ partida: 1 });
    b.tab = Array(64).fill(0); b.tab[3 * 8 + 2] = 1; b.tab[4 * 8 + 3] = 2;
    t("damas: el peon no captura hacia atras", DM.capturas(b.tab, 3 * 8 + 2).length === 0);
    // coronacion y dama voladora
    const k = new S({ partida: 1 });
    k.tab = Array(64).fill(0); k.tab[1 * 8 + 2] = 1; k.tab[7 * 8 + 0] = 2;
    k.accion(1, { de: 1 * 8 + 2, a: 0 * 8 + 1 });
    t("damas: corona al llegar al fondo", k.tab[1] === 3);
    t("damas: la dama vuela por toda la diagonal", DM.simples(k.tab, 1).length === 7);
  },

  ajedrez(A, t) {
    const AJ = A.g("AJ");
    t("ajedrez perft: inicial d1 = 20", perft(AJ, AJ.nuevo(), 1) === 20);
    t("ajedrez perft: inicial d2 = 400", perft(AJ, AJ.nuevo(), 2) === 400);
    t("ajedrez perft: inicial d3 = 8902", perft(AJ, AJ.nuevo(), 3) === 8902);
    const kiwi = fen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -");
    t("ajedrez perft: kiwipete d1 = 48", perft(AJ, kiwi, 1) === 48);
    t("ajedrez perft: kiwipete d2 = 2039", perft(AJ, kiwi, 2) === 2039);
    const p3 = fen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -");
    t("ajedrez perft: posicion 3 d3 = 2812", perft(AJ, p3, 3) === 2812);
    const p4 = fen("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq -");
    t("ajedrez perft: posicion 4 d2 = 264", perft(AJ, p4, 2) === 264);
    // el bot encuentra mate en 1 (mate de pasillo)
    const S = A.Kit.SIMS.ajedrez;
    const m = new S({ partida: 1 });
    m.s = fen("6k1/5ppp/8/8/8/8/8/R5K1 w - -"); m.leg = AJ.legales(m.s);
    const j = A.BOTS.ajedrez.elegir(m.vista(1));
    m.accion(1, j);
    t("ajedrez bot: da mate en 1", m.ganador === 1 && m.motivo === "Jaque mate");
    // ahogado = tablas
    const ah2 = new S({ partida: 1 });
    ah2.s = fen("7k/8/5Q2/8/8/8/8/K7 w - -"); ah2.leg = AJ.legales(ah2.s);
    ah2.accion(1, { de: 21, a: 13 });  // Qf6-f7: rey negro en h8 sin jugadas y sin jaque
    t("ajedrez: rey ahogado es empate", ah2.ganador === 3 && ah2.motivo === "Rey ahogado");
    // la vista del rival no trae jugadas
    t("ajedrez: el rival no ve jugadas fuera de su turno", new S({ partida: 1 }).vista(2).movs.length === 0);
    t("ajedrez: en partida par P2 juega con blancas", new S({ partida: 2 }).vista(2).color === "w");
  },

  ultimate(A, t) {
    const S = A.Kit.SIMS.ultimate;
    const s = new S({ partida: 1 });
    s.accion(1, { b: 4, k: 2 });
    t("ultimate: la casilla manda al tablero del mismo numero", s.activo === 2 && s.turno === 2);
    s.accion(2, { b: 5, k: 0 });
    t("ultimate: jugar fuera del tablero activo se rechaza", s.tab[5 * 9] === 0 && s.turno === 2);
    // ganar un chico
    const g = new S({ partida: 1 });
    g.tab[0] = 1; g.tab[1] = 1; g.activo = 0; g.turno = 1;
    g.accion(1, { b: 0, k: 2 });
    t("ultimate: tres en un chico lo gana", g.gane[0] === 1);
    t("ultimate: si el tablero destino esta decidido, eleccion libre", (() => { const h = new S({ partida: 1 }); h.gane[3] = 2; h.accion(1, { b: 0, k: 3 }); return h.activo === -1; })());
  },

  gomoku(A, t) {
    const S = A.Kit.SIMS.gomoku;
    const s = new S({ partida: 1 });
    for (let k = 0; k < 4; k++) { s.accion(1, { i: 7 * 15 + k }); s.accion(2, { i: 0 * 15 + k }); }
    s.accion(1, { i: 7 * 15 + 4 });
    t("gomoku: cinco en linea gana", s.ganador === 1 && s.linea.length === 5);
    const b = new S({ partida: 1 });
    b.accion(1, { i: 7 * 15 + 5 }); b.accion(2, { i: 0 });
    b.accion(1, { i: 7 * 15 + 6 }); b.accion(2, { i: 14 });
    b.accion(1, { i: 7 * 15 + 7 }); b.accion(2, { i: 224 });
    b.accion(1, { i: 7 * 15 + 8 });
    const m = A.BOTS.gomoku.elegir(b.vista(2)).i;
    t("gomoku bot: tapa un cuatro", m === 7 * 15 + 4 || m === 7 * 15 + 9);
  },

  mancala(A, t) {
    const MC = A.g("MC");
    const S = A.Kit.SIMS.mancala;
    const s = new S({ partida: 1 });
    s.accion(1, { k: 2 });  // 4 semillas desde el hoyo 2: 3,4,5,granero -> turno extra
    t("mancala: ultima en tu granero repite turno", s.turno === 1 && s.h[6] === 1);
    s.accion(1, { k: 5 });
    t("mancala: si no, pasa la mano", s.turno === 2);
    const c = new S({ partida: 1 });
    c.h = [0, 0, 1, 0, 0, 0, 0, 2, 2, 2, 5, 2, 2, 0];
    c.accion(1, { k: 2 });   // cae en el hoyo 3 vacio, enfrente (9) hay 2
    t("mancala: captura lo de enfrente", c.h[6] === 3 && c.h[9] === 0 && c.h[3] === 0);
    const f = new S({ partida: 1 });
    f.h = [0, 0, 0, 0, 0, 1, 20, 3, 0, 0, 0, 0, 0, 10];
    f.accion(1, { k: 5 });
    t("mancala: lado vacio termina y el otro guarda lo suyo", f.ganador === 1 && f.h[13] === 13 && f.h[6] === 21);
    t("mancala: 48 semillas siempre", MC.inicial().reduce((a, b) => a + b, 0) === 48);
  },

  memorice(A, t) {
    const S = A.Kit.SIMS.memorice;
    const s = new S({ partida: 1 });
    t("memorice: ninguna cara visible al inicio", s.vista(1).cartas.every((c) => c === -1) && s.vista(2).cartas.every((c) => c === -1));
    const a = s.cartas.indexOf(0), b = s.cartas.lastIndexOf(0);
    s.accion(1, { i: a });
    t("memorice: la carta volteada se ve para ambos", s.vista(2).cartas[a] === 0);
    s.accion(1, { i: b });
    t("memorice: par acertado suma y sigue el turno", s.puntos[1] === 1 && s.turno === 1);
    const x = s.cartas.indexOf(1), y = s.cartas.indexOf(2);
    s.accion(1, { i: x }); s.accion(1, { i: y });
    t("memorice: fallo espera antes de pasar", s.turno === 1 && s.espera > 0);
    s.accion(1, { i: s.cartas.indexOf(3) });
    t("memorice: no se voltea durante la espera", s.arriba.length === 2);
    for (let k = 0; k < 200; k++) s.step(1 / 120);
    t("memorice: tras la espera pasa el turno y se tapan", s.turno === 2 && s.vista(1).cartas[x] === -1);
  },

  domino(A, t) {
    const DOM = A.g("DOM");
    const S = A.Kit.SIMS.domino;
    const s = new S({ partida: 1 });
    t("domino: 28 fichas repartidas 7+7+14", s.manos[1].length === 7 && s.manos[2].length === 7 && s.pozo.length === 14);
    const v2 = s.vista(2);
    t("domino: la vista no trae la mano rival", v2.rival === 7 && !JSON.stringify(v2).includes(JSON.stringify(s.manos[1])));
    // abre quien tiene el doble mas alto
    const dobles = (m) => Math.max(-1, ...m.filter((f) => f[0] === f[1]).map((f) => f[0]));
    const d1 = dobles(s.manos[1]), d2 = dobles(s.manos[2]);
    if (d1 >= 0 || d2 >= 0) t("domino: abre el doble mas alto", s.turno === (d1 > d2 ? 1 : 2));
    // encaje y orientacion
    const m = new S({ partida: 1 });
    m.mesa = [{ a: 3, b: 5 }]; m.turno = 1; m.manos[1] = [[5, 6], [1, 2]]; m.pozo = [];
    m.accion(1, { i: 0, lado: "d" });
    t("domino: la ficha se orienta para calzar", m.mesa[1].a === 5 && m.mesa[1].b === 6);
    t("domino: no se puede robar con jugada", (() => { const q = new S({ partida: 1 }); q.mesa = [{ a: 6, b: 6 }]; q.turno = 1; q.manos[1] = [[6, 1]]; const n = q.pozo.length; q.accion(1, { robar: 1 }); return q.pozo.length === n; })());
    // domino suma la mano del rival
    const f = new S({ partida: 1 });
    f.mesa = [{ a: 2, b: 4 }]; f.turno = 1; f.manos[1] = [[4, 4]]; f.manos[2] = [[6, 6], [1, 0]];
    f.accion(1, { i: 0 });
    t("domino: quedarse sin fichas suma lo del rival", f.puntos[1] === 13 && f.fase === "resumen");
    t("domino: suma de pips", DOM.suma([[6, 6], [1, 0]]) === 13);
  },

  dudo(A, t) {
    const DUDO = A.g("DUDO");
    t("dudo: subir cantidad vale", DUDO.valida({ q: 3, c: 4 }, 4, 2, 5));
    t("dudo: misma cantidad, pinta mayor vale", DUDO.valida({ q: 3, c: 4 }, 3, 5, 5));
    t("dudo: misma cantidad, pinta menor no", !DUDO.valida({ q: 3, c: 4 }, 3, 3, 5));
    t("dudo: pasar a ases = mitad + 1", DUDO.valida({ q: 5, c: 4 }, 3, 1, 5) && !DUDO.valida({ q: 5, c: 4 }, 2, 1, 5));
    t("dudo: salir de ases = doble + 1", DUDO.valida({ q: 2, c: 1 }, 5, 3, 5) && !DUDO.valida({ q: 2, c: 1 }, 4, 3, 5));
    t("dudo: no se abre con ases (salvo 1 dado)", !DUDO.valida(null, 2, 1, 5) && DUDO.valida(null, 1, 1, 1));
    t("dudo: ases son comodines", DUDO.cuenta([1, 1, 4, 4, 6], 4) === 4 && DUDO.cuenta([1, 1, 4], 1) === 2);
    const S = A.Kit.SIMS.dudo;
    const s = new S({ partida: 1 });
    const v2 = JSON.stringify(s.vista(2));
    t("dudo: la vista no trae los dados del rival", !v2.includes('"dados"') && s.vista(2).mios.length === 5);
    s.dados = { 1: [2, 2, 3, 5, 6], 2: [1, 2, 4, 4, 6] };
    s.accion(1, { q: 4, c: 2 });
    s.accion(2, { dudo: 1 });
    t("dudo: si hay al menos Q, pierde el que dudo", s.n[2] === 4 && s.fase === "revela" && s.res.hay === 4);
    for (let k = 0; k < 120 * 5; k++) s.step(1 / 120);
    t("dudo: abre la ronda siguiente el que perdio", s.fase === "apuesta" && s.turno === 2 && s.dados[2].length === 4);
    const c = new S({ partida: 1 });
    c.n = { 1: 3, 2: 5 };
    c.dados = { 1: [3, 3, 3], 2: [1, 2, 2, 5, 6] };
    c.accion(1, { q: 2, c: 3 });
    c.accion(2, { q: 4, c: 3 });
    c.accion(1, { calzo: 1 });
    t("dudo: calzar exacto recupera un dado", c.n[1] === 4);
  },

  generala(A, t) {
    const GEN = A.g("GEN");
    t("generala: escalera", GEN.puntaje("esc", [1, 2, 3, 4, 5], false) === 20 && GEN.puntaje("esc", [6, 2, 3, 4, 5], true) === 25);
    t("generala: full", GEN.puntaje("full", [2, 2, 5, 5, 5], false) === 30 && GEN.puntaje("full", [2, 2, 2, 2, 5], false) === 0);
    t("generala: poker", GEN.puntaje("poker", [4, 4, 4, 4, 1], false) === 40);
    t("generala: numeros", GEN.puntaje("6", [6, 6, 1, 6, 2], false) === 18);
    t("generala: doble generala requiere generala anotada", GEN.puntaje("dgen", [3, 3, 3, 3, 3], false, { gen: 50 }) === 100 && GEN.puntaje("dgen", [3, 3, 3, 3, 3], false, { gen: null }) === 0);
    const S = A.Kit.SIMS.generala;
    const s = new S({ partida: 1 });
    s.accion(1, { anotar: "6" });
    t("generala: no se anota sin tirar", s.planillas[1]["6"] === null);
    s.accion(1, { tirar: 1 }); s.accion(1, { tirar: 1 }); s.accion(1, { tirar: 1 }); s.accion(1, { tirar: 1 });
    t("generala: maximo 3 tiradas", s.tiradas === 3 || s.ganador);
    if (!s.ganador) {
      s.accion(1, { anotar: "1" });
      t("generala: anotar pasa el turno", s.turno === 2 && s.planillas[1]["1"] !== null);
      s.accion(2, { tirar: 1 });
      if (!s.ganador) {
        const d = s.dados.slice();
        s.accion(2, { guardar: 0 }); s.accion(2, { tirar: 1 });
        t("generala: el dado guardado no cambia", s.dados[0] === d[0]);
      }
    }
  },

  ahorcado(A, t) {
    const AH = A.g("AH");
    t("ahorcado: limpiar quita tildes y conserva la Ñ", AH.limpiar("Camión ñandú!") === "CAMIONÑANDU");
    const S = A.Kit.SIMS.ahorcado;
    const s = new S({ partida: 1 });
    t("ahorcado: P1 elige en la ronda 1", s.elige === 1 && s.turno === 1);
    t("ahorcado: el que adivina no ve sugerencias", s.vista(2).sugerencias.length === 0 && s.vista(1).sugerencias.length === 3);
    s.accion(1, { palabra: "gato" });
    t("ahorcado: el que adivina no recibe la palabra", s.vista(2).palabra === "" && !JSON.stringify(s.vista(2)).includes("GATO") && s.vista(2).mascara === "____");
    s.accion(2, { letra: "a" });
    t("ahorcado: acierto destapa la letra", s.vista(2).mascara === "_A__");
    for (const l of "BCDEFH") s.accion(2, { letra: l });
    t("ahorcado: 6 errores dan punto al que eligio", s.puntos[1] === 1 && s.fase === "resumen");
    for (let k = 0; k < 120 * 4; k++) s.step(1 / 120);
    t("ahorcado: en la ronda 2 elige el otro", s.ronda === 2 && s.elige === 2);
  },

  artilleria(A, t) {
    const ART = A.g("ART");
    const S = A.Kit.SIMS.artilleria;
    const s = new S({ partida: 1 });
    t("artilleria: tanques apoyados en el suelo", [1, 2].every((j) => Math.abs(s.tanques[j].y - ART.suelo(s.alt, s.tanques[j].x)) < 0.01));
    s.input(2, { ang: 1, pot: 90 });
    t("artilleria: el que no juega no mueve la mira", s.tanques[2].pot === 60);
    s.input(1, { ang: 99, pot: -5 });
    t("artilleria: la mira se acota", s.tanques[1].ang <= Math.PI && s.tanques[1].pot >= 5);
    s.accion(1, { fuego: 1, ang: Math.PI / 3, pot: 70 });
    t("artilleria: disparar pone la bala en vuelo", s.fase === "vuela" && !!s.bala);
    for (let k = 0; k < 120 * 15 && s.fase !== "apunta"; k++) s.step(1 / 120);
    t("artilleria: tras el disparo pasa el turno", s.turno === 2 && s.fase === "apunta");
    const c = new S({ partida: 1 }), antes = c.alt.slice(), xk = 480;
    c.explotar(xk, ART.suelo(c.alt, xk), 0);
    t("artilleria: la explosion abre un crater", c.alt[xk / ART.PASO] > antes[xk / ART.PASO]);
    // impacto directo
    const d = new S({ partida: 1 });
    d.explotar(d.tanques[2].x, d.tanques[2].y - 8, 2);
    t("artilleria: impacto directo daña", d.tanques[2].hp === 100 - ART.DANO);
    // vuelo del bot = vuelo de la sim
    const q = new S({ partida: 1 });
    const imp = ART.vuelo(q.alt, q.tanques, 1, 1.0, 65, q.viento);
    q.accion(1, { fuego: 1, ang: 1.0, pot: 65 });
    let ex = null;
    for (let k = 0; k < 120 * 15 && q.fase === "vuela"; k++) { q.step(1 / 120); const e = q._ev.find((x) => x.tipo === "expl"); if (e) ex = e; }
    t("artilleria: el bot predice el mismo impacto", !imp ? !ex : !!ex && Math.abs(ex.x - imp.x) < 3);
  },

  minigolf(A, t) {
    const MG = A.g("MG");
    t("minigolf: 6 hoyos con paredes", MG.HOYOS.length === 6 && MG.HOYOS.every((h) => h.seg.length >= 4));
    const S = A.Kit.SIMS.minigolf;
    const s = new S({ partida: 1 });
    t("minigolf: empieza P1 en el primer hoyo", s.turno === 1 && s.fase === "apunta");
    s.accion(1, { tiro: 1, ang: 0, pot: 0.6 });
    for (let k = 0; k < 120 * 12 && s.fase === "rueda"; k++) s.step(1 / 120);
    t("minigolf: tras el tiro la bola queda dentro de la cancha", s.bolas[1].x > 120 && s.bolas[1].x < 840 && s.bolas[1].y > 200 && s.bolas[1].y < 400);
    t("minigolf: en el tee le toca al que no ha pegado", s.turno === 2 || s.bolas[1].dentro);
    // la bola rebota en la pared y no la atraviesa
    const h = MG.HOYOS[0], bolas = { 1: { x: 600, y: 300, vx: 0, vy: 0, dentro: false }, 2: { x: 200, y: 250, vx: 0, vy: 0, dentro: true } };
    const b = MG.simular(h, bolas, 1, Math.PI / 2, 1);
    t("minigolf: rebote contra la pared", b.y > 200 && b.y < 400);
    // un tiro directo y suave al hoyo entra
    const h1 = MG.HOYOS[0];
    const b2 = MG.simular(h1, { 1: { x: 700, y: 300, vx: 0, vy: 0, dentro: false }, 2: { x: 0, y: 0, vx: 0, vy: 0, dentro: true } }, 1, 0, 0.3);
    t("minigolf: tiro suave y recto entra", b2.dentro === true);
    // tope de golpes
    const m = new S({ partida: 1 });
    m.golpes[1] = 7; m.bolas[2].dentro = true; m.siguiente();
    t("minigolf: con 7 golpes se levanta (anota 8)", m.tarjeta[1][0] === 8 && m.fase === "entre");
  },

  curling(A, t) {
    const CU = A.g("CU");
    const pts = CU.puntaje([{ j: 1, x: 790, y: 300 }, { j: 1, x: 800, y: 320 }, { j: 2, x: 790, y: 350 }, { j: 1, x: 790, y: 370 }]);
    t("curling: cuentan las piedras mas cerca que la mejor rival", pts[0] === 1 && pts[1] === 2);
    t("curling: casa vacia = entrada en blanco", CU.puntaje([{ j: 1, x: 640, y: 300 }])[0] === 0);
    const S = A.Kit.SIMS.curling;
    const s = new S({ partida: 1 });
    s.accion(1, { lanza: 1, ang: 0, pot: 0.255, giro: 1 });
    for (let k = 0; k < 120 * 20 && s.fase === "rueda"; k++) s.step(1 / 120);
    t("curling: un lanzamiento de peso de casa queda en juego", s.piedras.length === 1 && s.piedras[0].x > CU.HOG);
    t("curling: luego tira el rival", s.turno === 2 && s.quedan[1] === 3);
    s.accion(2, { lanza: 1, ang: 0, pot: 0.02, giro: 1 });
    for (let k = 0; k < 120 * 20 && s.fase === "rueda"; k++) s.step(1 / 120);
    t("curling: una piedra que no pasa el hog sale", s.piedras.length === 1);
    // barrer alarga
    const lejos = (barre) => {
      const ps = [{ id: 1, j: 1, x: CU.X0, y: CU.Y0, vx: CU.V0(0.2), vy: 0, giro: 1 }];
      for (let k = 0; k < 120 * 20 && !CU.quietas(ps); k++) CU.paso(ps, 1 / 120, barre, 1);
      return ps[0].x;
    };
    t("curling: barrer alarga la piedra", lejos(true) > lejos(false) + 40);
  },

  airhockey(A, t) {
    const HOC = A.g("HOC"), S = A.Kit.SIMS.airhockey, s = new S({ partida: 1 });
    s.input(1, { x: 900, y: 300 });
    t("airhockey: el mazo no cruza a la mitad rival", s.mazos[1].tx <= HOC.CX - HOC.R_MAZO);
    s.pausa = 0; s.disco = { x: HOC.X1 - 30, y: HOC.CY, vx: 900, vy: 0 };
    s.mazos[2].x = s.mazos[2].tx = HOC.X1 - 60; s.mazos[2].y = s.mazos[2].ty = HOC.Y0 + 40;
    for (let k = 0; k < 60; k++) s.step(1 / 120);
    t("airhockey: disco dentro del arco = gol", s.goles[1] === 1 && s.pausa > 0);
    const b = new S({ partida: 1 }); b.pausa = 0; b.disco = { x: 480, y: 300, vx: 0, vy: -900 };
    for (let k = 0; k < 60; k++) b.step(1 / 120);
    t("airhockey: rebota en la banda", b.disco.vy > 0 && b.disco.y > HOC.Y0);
  },

  snake(A, t) {
    const S = A.Kit.SIMS.snake, s = new S({ partida: 1 });
    s.input(1, { d: "l" });
    t("snake: no se puede dar media vuelta", s.s[1].quiere === "r");
    s.fase = "juego"; s.manzanas = [[9, 11]];
    s.tick([1]);
    t("snake: comer crece", s.s[1].crece === 2 && s.s[1].cuerpo[0][0] === 9);
    const c = new S({ partida: 1 }); c.fase = "juego";
    c.s[1].cuerpo = [[5, 5], [4, 5]]; c.s[1].dir = c.s[1].quiere = "r";
    c.s[2].cuerpo = [[7, 5], [8, 5]]; c.s[2].dir = c.s[2].quiere = "l";
    c.tick([1, 2]);
    t("snake: choque de cabezas = nadie suma", c.rondas[1] === 0 && c.rondas[2] === 0 && c.fase === "fin");
    const w = new S({ partida: 1 }); w.fase = "juego"; w.s[1].cuerpo = [[0, 3], [1, 3]]; w.s[1].dir = w.s[1].quiere = "l";
    w.tick([1]);
    t("snake: pared mata y la ronda va al otro", w.rondas[2] === 1);
  },

  sumo(A, t) {
    const SU = A.g("SU"), S = A.Kit.SIMS.sumo, s = new S({ partida: 1 });
    s.fase = "juego"; s.b[1].x = SU.CX + SU.R0 + 40;
    s.step(1 / 120);
    t("sumo: salir del plato = ronda al rival", s.rondas[2] === 1);
    const d = new S({ partida: 1 }); d.fase = "juego"; d.input(1, { ax: 1, ay: 0 }); d.accion(1, { dash: 1 });
    const v0 = d.b[1].vx; d.accion(1, { dash: 1 });
    t("sumo: embestida con recarga", v0 >= SU.DASH && d.b[1].vx === v0);
    const r = new S({ partida: 1 }); r.t = SU.ACHICA;
    const enMin = Math.abs(r.radio - SU.R1) < 1e-6; r.t = 1000;
    t("sumo: el plato se achica y luego hay muerte subita", enMin && r.radio < SU.R1 && r.radio > 0);
  },

  reflejos(A, t) {
    const S = A.Kit.SIMS.reflejos, s = new S({ partida: 1 });
    s.accion(1, { r: s.r, falso: 1 });
    t("reflejos: apretar antes = salida en falso", s.puntos[2] === 1 && s.fase === "res");
    const q = new S({ partida: 1 }); q.fase = "ya";
    q.accion(1, { r: q.r, ms: 300 }); q.accion(2, { r: q.r, ms: 250 });
    t("reflejos: gana el menor tiempo medido en cada lado", q.puntos[2] === 1);
    const v = new S({ partida: 1 }); v.fase = "ya";
    v.accion(1, { r: v.r + 5, ms: 100 });
    t("reflejos: respuestas de otra ronda se ignoran", v.ms[1] === null);
  },

  tanques(A, t) {
    const TQ = A.g("TQ"), S = A.Kit.SIMS.tanques, s = new S({ partida: 1 });
    s.fase = "juego"; s.input(1, { giro: 0, mov: 0, fuego: true });
    s.step(1 / 120); s.step(1 / 120);
    t("tanques: disparar respeta la recarga", s.balas.length === 1);
    const b = { x: TQ.X0 + 5, y: 300, vx: -300, vy: 0 };
    for (let k = 0; k < 5; k++) TQ.mover(b, 1 / 60);
    t("tanques: la bala rebota en el borde", b.vx > 0);
    const m = new S({ partida: 1 }); m.fase = "juego";
    m.accion(1, { mina: 1 }); m.accion(1, { mina: 1 });
    t("tanques: una mina a la vez", m.minas.length === 1);
    m.t[2].x = m.minas[0].x; m.t[2].y = m.minas[0].y + 10;
    for (let k = 0; k < 140; k++) m.step(1 / 120);
    t("tanques: la mina armada explota", m.minas.length === 0 && !m.t[2].vivo);
  },

  pinturillo(A, t) {
    const S = A.Kit.SIMS.pinturillo, s = new S({ partida: 1 });
    t("pinturillo: P1 dibuja en la ronda 1", s.dibuja === 1);
    t("pinturillo: solo el que dibuja ve las opciones", s.vista(1).opciones.length === 3 && s.vista(2).opciones.length === 0);
    s.accion(1, { palabra: s.opciones[1] });
    t("pinturillo: el que adivina no recibe la palabra", s.vista(2).palabra === "" && !JSON.stringify(s.vista(2)).includes('"' + s.palabra + '"'));
    s.accion(1, { ops: [[10, 10, 1, 0, 1], [20, 20, 0, 0, 1], [9999, 5, 0, 0, 1]] });
    t("pinturillo: trazos validados", s.trazos.length === 2);
    s.input(2, { v: s.version, n: 1 });
    const l = s.vista(2).lienzo;
    t("pinturillo: al guest le llegan solo los trazos que le faltan", l.desde === 1 && l.ops.length === 1);
    s.accion(2, { adivina: "xyz" });
    t("pinturillo: intento fallido va al chat", s.chat.length === 1 && s.fase === "dibuja");
    s.accion(2, { adivina: s.palabra.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "") });
    t("pinturillo: adivinar (sin tildes ni mayusculas) suma a ambos", s.fase === "resumen" && s.puntos[2] > 50 && s.puntos[1] === 40);
    const b = new S({ partida: 1 }); b.accion(1, { palabra: b.opciones[0] }); b.accion(1, { ops: [[1, 1, 1, 0, 0]] }); const v0 = b.version; b.accion(1, { borrar: 1 });
    t("pinturillo: borrar cambia la version del lienzo", b.trazos.length === 0 && b.version === v0 + 1);
    const c = new S({ partida: 1 }); for (let k = 0; k < 120 * 20; k++) c.step(1 / 120);
    t("pinturillo: si no elige a tiempo, se elige sola", c.fase === "dibuja" && c.palabra === c.opciones[0]);
    t("pinturillo: casi = distancia 1", A.g("PT").lev("perro", "pero") === 1);
  },
};

export function testsSetlist(t) {
  const codigo = [rd("const.js"), rd("kit.js"),
    ...SETLIST.map((id) => rd(id + ".sim.js")),
    ...CON_BOT.map((id) => rd(id + ".bot.js")),
  ].join("\n") +
    // g(nombre): acceso a las constantes de reglas de cada juego (C4, ...) desde los tests
    "\nglobalThis.__api = { Kit, SimBase, BOTS, g: (n) => eval(n) };";
  // Azar con semilla fija: las partidas bot contra bot son reproducibles (sin tests intermitentes).
  let semilla = 20261027;
  const M = Object.create(Math);
  M.random = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646; };
  const sb = { performance: { now: () => Date.now() }, Math: M, console };
  vm.createContext(sb);
  new vm.Script(codigo).runInContext(sb);
  const A = sb.__api;

  for (const id of SETLIST) {
    const S = A.Kit.SIMS[id];
    t(id + ": registra su Sim", typeof S === "function");
    if (!S) continue;
    const s = new S({ partida: 1 });
    let j1 = "", j2 = "";
    try { j1 = JSON.stringify(s.vista(1)); j2 = JSON.stringify(s.vista(2)); } catch (e) {}
    t(id + ": la vista se serializa", j1.length > 0 && j2.length > 0);
    t(id + ": la vista pesa menos de 24 KB", j1.length < 24000 && j2.length < 24000);
    t(id + ": vista con yo y g", s.vista(2).yo === 2 && s.vista(1).g === 0);
    if (CON_BOT.includes(id)) {
      t(id + ": registra su bot", !!(A.BOTS[id] && A.BOTS[id].nuevo));
      if (A.BOTS[id] && !(OPC[id] || {}).sinPartida) {
        const { sim, t: dur } = partida(A, id, OPC[id] || {});
        t(id + ": partida bot contra bot termina (" + Math.round(dur) + " s)", sim.ganador > 0);
      }
    }
    if (ESPECIFICOS[id]) ESPECIFICOS[id](A, t);
  }
}
