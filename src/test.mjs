// Tests de logica pura (sin navegador): sims de Pong y Billar.
//   node src/test.mjs
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const SRC = dirname(fileURLToPath(import.meta.url));
const rd = (f) => readFileSync(join(SRC, f), "utf8");

const codigo = [rd("const.js"), rd("pong.sim.js"), rd("billar.sim.js")].join("\n") +
  "\nglobalThis.__api = { PONG, PongSim, BILLAR, BillarSim, _tipo, _otro };";
const sb = { performance: { now: () => Date.now() }, Math };
vm.createContext(sb);
new vm.Script(codigo).runInContext(sb);
const A = sb.__api;

let ok = 0, fail = 0;
const t = (n, c) => { c ? ok++ : (fail++, console.log("  FAIL: " + n)); };

// ================= PONG =================
{
  const p = new A.PongSim();
  const dt = 1 / 120;
  for (let i = 0; i < 120 * 3; i++) p.step(dt);
  t("pong: bola lanzada tras 3s", p.bola.vx !== 0 || p.bola.vy !== 0);

  const q = new A.PongSim();
  for (let i = 0; i < 120 * 18; i++) q.step(1 / 120);
  t("pong: hay goles sin palas", q.puntos[1] + q.puntos[2] >= 1);

  const r = new A.PongSim();
  r.pala[2] = 100;
  r.aplicarPala2(400, 0.05);
  t("pong: aplicarPala2 limita salto", Math.abs(r.pala[2] - 100) <= A.PONG.PALA_VEL * 0.05 + 2.001);
  r.aplicarPala2(300, 100);
  t("pong: aplicarPala2 dt grande llega", Math.abs(r.pala[2] - 300) < 1);
  r.aplicarPala2(1e9, 0.016);
  t("pong: aplicarPala2 clamp campo", r.pala[2] <= A.PONG.CAMPO_H - A.PONG.PALA_H + 0.001);

  const s = new A.PongSim();
  s.puntos[1] = 4;
  s.bola.x = A.PONG.CAMPO_W - 4; s.bola.vx = 500; s.bola.vy = 0; s.pala[2] = -999;
  for (let i = 0; i < 30; i++) s.step(1 / 120);
  t("pong: gana a 5", s.ganador === 1 && s.puntos[1] === 5);
}

// ================= BILLAR =================
{
  const b = new A.BillarSim();
  t("billar: 16 bolas en juego al inicio", b.bolas.filter((x) => x.dentro).length === 16);
  t("billar: hay una 8", !!b._b(8));
  t("billar: blanca a la izquierda del triangulo", b._b(0).x < b._b(8).x);
  t("billar: sin solape inicial", (() => {
    for (let i = 0; i < b.bolas.length; i++) for (let j = i + 1; j < b.bolas.length; j++) {
      const d = Math.hypot(b.bolas[i].x - b.bolas[j].x, b.bolas[i].y - b.bolas[j].y);
      if (d < A.BILLAR.R * 2 - 0.5) return false;
    }
    return true;
  })());

  // un tiro fuerte: las bolas se mueven, se resuelve y vuelve a apuntar
  b.fase = "apuntando"; b.turno = 1;
  b.apuntar(1, 0, 1);
  b.tirar(1);
  t("billar: tras tirar -> simulando", b.fase === "simulando");
  let it = 0;
  while (b.fase === "simulando" && it < 6000) { b.step(1 / 120); it++; }
  t("billar: el tiro termina", b.fase !== "simulando");
  t("billar: todas las bolas quedaron quietas", b.bolas.every((x) => !x.dentro || (x.vx === 0 && x.vy === 0)));
  t("billar: bolas dentro del paño", b.bolas.filter((x) => x.dentro).every((x) =>
    x.x >= A.BILLAR.X0 - 0.6 && x.x <= A.BILLAR.X1 + 0.6 && x.y >= A.BILLAR.Y0 - 0.6 && x.y <= A.BILLAR.Y1 + 0.6));

  // falta por no tocar nada
  const c = new A.BillarSim();
  c.fase = "apuntando"; c.turno = 1;
  // apuntar hacia una banda vacia (hacia arriba) con poca fuerza -> no toca bolas
  c._b(0).x = A.BILLAR.W / 2; c._b(0).y = A.BILLAR.H / 2;
  c.apuntar(1, -Math.PI / 2, 0.25);
  c.tirar(1);
  it = 0;
  while (c.fase === "simulando" && it < 6000) { c.step(1 / 120); it++; }
  t("billar: no tocar bola -> falta y bola en mano al rival", c.fase === "manoLibre" && c.turno === 2);

  // manoLibre coloca la blanca
  c.manoLibre(2, A.BILLAR.W / 2, A.BILLAR.H / 2 + 40);
  t("billar: manoLibre coloca y pasa a apuntando", c.fase === "apuntando" && c._b(0).dentro);

  // meter la 8 con grupo sin limpiar -> pierde el que la metio
  const d = new A.BillarSim();
  d.turno = 1; d.grupo = { 1: 1, 2: 2 }; d.fase = "simulando";
  d._prim = 8; d._cue = false; d._metidas = [8];
  d._resolver();
  t("billar: 8 temprana -> pierde", d.ganador === 2 && d.fase === "fin");

  // meter la 8 legal: grupo limpio
  const e = new A.BillarSim();
  e.turno = 1; e.grupo = { 1: 1, 2: 2 }; e.fase = "simulando";
  for (const n of [1, 2, 3, 4, 5, 6, 7]) e._b(n).dentro = false;
  e._prim = 8; e._cue = false; e._metidas = [8];
  e._resolver();
  t("billar: 8 legal con grupo limpio -> gana", e.ganador === 1 && e.fase === "fin");
}

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
