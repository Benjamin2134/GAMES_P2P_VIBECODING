// Test rapido de la logica pura (sin navegador): codec binario, extrapolacion,
// fisica de la simulacion y limite de velocidad de la pala rival.
//   node src/test.mjs
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const SRC = dirname(fileURLToPath(import.meta.url));
const rd = (f) => readFileSync(join(SRC, f), "utf8");

// const.js + sim.js + (solo la parte pura de app.js: hasta "UI helpers")
const appPuro = rd("app.js").split('//  Input + pausa')[0]
  .replace(/^window\.addEventListener.*$/gm, "")
  .replace('const cv = $("cv");', "")
  .replace('const ctx = cv.getContext("2d", { alpha: false, desynchronized: true });', "")
  .replace('const $ = (id) => document.getElementById(id);', "const $ = () => ({});");

const codigo = rd("const.js") + "\n" + rd("sim.js") + "\n" + appPuro +
  "\nglobalThis.__api = { encSnap, decSnap, comoView, extrapBola, seqMasNuevo, Partida," +
  " SIM_DT, CAMPO_ALTO, CAMPO_ANCHO, BOLA_RADIO, PALA_VEL_PS, PALA_ALTO };";

const sandbox = { performance: { now: () => Date.now() }, window: {}, document: {}, console };
vm.createContext(sandbox);
new vm.Script(codigo).runInContext(sandbox);
const A = sandbox.__api;

let ok = 0, fail = 0;
const t = (n, c) => { c ? ok++ : (fail++, console.log("  FAIL: " + n)); };
const pasos = (seg) => Math.ceil(seg / A.SIM_DT);

// 1. codec round-trip
const s = { seq: 40000, bx: 123.5, by: 77.25, bvx: -312.5, bvy: 88, p1: 200.5, p2: 30,
  s1: 3, s2: 4, sirviendo: true, cuenta: 2, ganador: 2, pausa: 1, rev1: true, rev2: false };
const d = A.decSnap(A.comoView(A.encSnap(s)));
t("seq", d.seq === 40000);
t("bx float", Math.abs(d.bx - 123.5) < 0.01);
t("bvx float", Math.abs(d.bvx + 312.5) < 0.01);
t("p1 float", Math.abs(d.p1 - 200.5) < 0.01);
t("scores", d.s1 === 3 && d.s2 === 4);
t("sirviendo+cuenta", d.sirviendo === true && d.cuenta === 2);
t("ganador=2", d.ganador === 2);
t("pausa=host", d.pausa === 1);
t("rev", d.rev1 === true && d.rev2 === false);

// 2. secuencias con wrap
t("seq nuevo", A.seqMasNuevo(10, 5));
t("seq viejo", !A.seqMasNuevo(5, 10));
t("seq igual", !A.seqMasNuevo(7, 7));
t("seq wrap", A.seqMasNuevo(1, 65535));

// 3. extrapolacion de la pelota con rebote
let e = A.extrapBola({ x: 100, y: 5, vx: 0, vy: -600 }, 0.05);
t("extrap y dentro de cancha", e.y >= A.BOLA_RADIO - 0.001 && e.y <= A.CAMPO_ALTO);
e = A.extrapBola({ x: 100, y: 100, vx: 1000, vy: 0 }, 0.05);
t("extrap avanza en x", Math.abs(e.x - 150) < 1);
e = A.extrapBola({ x: 100, y: 100, vx: 1000, vy: 0 }, 999);
t("extrap capea dt (0.25s)", Math.abs(e.x - (100 + 1000 * 0.25)) < 1);

// 4. fisica: la bola se lanza tras la cuenta regresiva
let p = new A.Partida();
for (let i = 0; i < pasos(2.4); i++) p.step(A.SIM_DT);
t("bola lanzada tras 2.4s", p.bola.vx !== 0 || p.bola.vy !== 0);

// 5. fisica: sin palas, hay goles y el juego avanza
p = new A.Partida();
for (let i = 0; i < pasos(14); i++) p.step(A.SIM_DT);
t("hubo goles en 14s", p.puntos[1] + p.puntos[2] >= 1);

// 6. limite de velocidad de la pala rival
p = new A.Partida();
p.pala[2] = 100;
p.aplicarPala2(400, 0.05);
t("limita salto (50ms)", Math.abs(p.pala[2] - 100) <= A.PALA_VEL_PS * 0.05 + 2.001);
p.aplicarPala2(300, 100);
t("dt grande -> llega", Math.abs(p.pala[2] - 300) < 1);
p.aplicarPala2(99999, 0.016);
t("clamp al campo", p.pala[2] <= A.CAMPO_ALTO - A.PALA_ALTO + 0.001);

// 7. pausa congela la fisica
p = new A.Partida();
p.pausas.host = true;
const antes = p.sirveMs;
for (let i = 0; i < pasos(1); i++) p.step(A.SIM_DT);
t("pausa congela cuenta de saque", p.sirveMs === antes);

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
