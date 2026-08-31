// Tests de logica pura (sin navegador): sims de Pong, Billar y Spacewar.
//   node src/test.mjs
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const SRC = dirname(fileURLToPath(import.meta.url));
const rd = (f) => readFileSync(join(SRC, f), "utf8");

const codigo = [rd("const.js"), rd("pong.sim.js"), rd("billar.sim.js"), rd("spacewar.sim.js"), rd("tron.sim.js")].join("\n") +
  "\nglobalThis.__api = { PONG, PongSim, BILLAR, BillarSim, _tipo, _otro, SW, SpacewarSim, TRON, TronSim };";
const sb = { performance: { now: () => Date.now() }, Math, setTimeout: (fn) => fn() };
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

  // un tiro fuerte (rompe): las bolas se mueven, se resuelve y vuelve a apuntar
  b.fase = "apuntando"; b.turno = 1;
  b.apuntar(1, 0, 1, 0, 0);
  b.tirar(1);
  t("billar: tras tirar -> simulando", b.fase === "simulando");
  let it = 0;
  while (b.fase === "simulando" && it < 9000) { b.step(1 / 120); it++; }
  t("billar: el tiro termina (< ~6s sim)", b.fase !== "simulando" && it < 8000);
  t("billar: todas las bolas quedaron quietas", b.bolas.every((x) => !x.dentro || (x.vx === 0 && x.vy === 0)));
  t("billar: bolas dentro del paño", b.bolas.filter((x) => x.dentro).every((x) =>
    x.x >= A.BILLAR.X0 - 1 && x.x <= A.BILLAR.X1 + 1 && x.y >= A.BILLAR.Y0 - 1 && x.y <= A.BILLAR.Y1 + 1));

  // FISICA: dos fases. Un tiro a boca de jarro debe patinar primero (u != 0) y
  // despues rodar (v ~= R*w en el punto de contacto).
  const ph = new A.BillarSim();
  for (const bb of ph.bolas) if (bb.n !== 0) bb.dentro = false;   // sin obstaculos ni rieles en el trayecto
  ph.fase = "simulando"; ph._b(0).x = 120; ph._b(0).y = 265;
  ph._b(0).vx = 520; ph._b(0).vy = 0; ph._b(0).wx = 0; ph._b(0).wy = 0;
  ph._sub(1 / 240);
  const u0 = Math.hypot(ph._b(0).vx - A.BILLAR.R * ph._b(0).wy, ph._b(0).vy + A.BILLAR.R * ph._b(0).wx);
  t("billar: al inicio patina (deslizamiento > 0)", u0 > 50);
  for (let i = 0; i < 240 * 1.5; i++) ph._sub(1 / 240);
  const c0 = ph._b(0);
  const uN = Math.hypot(c0.vx - A.BILLAR.R * c0.wy, c0.vy + A.BILLAR.R * c0.wx);
  t("billar: despues rueda (deslizamiento ~ 0)", uN < A.BILLAR.SLIP_EPS + 1 && Math.hypot(c0.vx, c0.vy) > 5 && c0.x < A.BILLAR.X1);

  // EFECTO: draw (oy < 0) deja retroceso -> tras chocar de frente, la blanca vuelve
  const dr = new A.BillarSim();
  dr.fase = "apuntando"; dr.turno = 1;
  dr._b(0).x = 300; dr._b(0).y = 265;
  for (const bb of dr.bolas) if (bb.n !== 0) bb.dentro = false;
  const obj = dr._b(1); obj.dentro = true; obj.x = 420; obj.y = 265;
  dr.apuntar(1, 0, 0.6, 0, -1);   // full draw
  dr.tirar(1);
  let choco = false, cueVolvio = false;
  for (let i = 0; i < 900 && dr.fase === "simulando"; i++) {
    dr.step(1 / 120);
    if (dr._prim === 1) choco = true;
    if (choco && dr._b(0).dentro && dr._b(0).vx < -8) cueVolvio = true;
  }
  t("billar: draw -> la blanca retrocede tras el choque", choco && cueVolvio);

  // falta por no tocar nada: tiro corto hacia una zona vacia sin troneras en linea
  const c = new A.BillarSim();
  c.fase = "apuntando"; c.turno = 1;
  for (const bb of c.bolas) if (bb.n !== 0) bb.dentro = false;   // despejar la mesa
  c._b(0).x = A.BILLAR.W / 2 + 30; c._b(0).y = A.BILLAR.H / 2;
  c.apuntar(1, Math.PI * 0.75, 0.18, 0, 0);
  c.tirar(1);
  it = 0;
  while (c.fase === "simulando" && it < 9000) { c.step(1 / 120); it++; }
  t("billar: no tocar bola -> falta y bola en mano al rival", c.fase === "manoLibre" && c.turno === 2 && !c._cue);

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

// ================= SPACEWAR =================
{
  const dt = 1 / 120;
  const s = new A.SpacewarSim();
  t("spacewar: 2 naves vivas y 5 vidas", s.naves[1].viva && s.naves[2].viva && s.vidas[1] === 5 && s.vidas[2] === 5);

  // empuje: la nave 1 acelera hacia su angulo (0 = este)
  s.aplicarInputHost({ rot: 0, thrust: true, fire: false });
  for (let i = 0; i < 30; i++) s.step(dt);
  t("spacewar: el empuje mueve la nave", s.naves[1].x > A.SW.W * 0.2 + 1 && Math.hypot(s.naves[1].vx, s.naves[1].vy) > 1);
  t("spacewar: respeta VEL_MAX", Math.hypot(s.naves[1].vx, s.naves[1].vy) <= A.SW.VEL_MAX + 1);

  // rotacion
  const s2 = new A.SpacewarSim();
  s2.aplicarInputHost({ rot: 1, thrust: false, fire: false });
  const a0 = s2.naves[1].ang;
  for (let i = 0; i < 12; i++) s2.step(dt);
  t("spacewar: rota con rot=1", Math.abs(s2.naves[1].ang - a0) > 0.1);

  // disparo con cooldown
  const s3 = new A.SpacewarSim();
  s3.naves[1].invuln = 0; s3.naves[2].invuln = 0;
  s3.aplicarInputHost({ rot: 0, thrust: false, fire: true });
  s3.step(dt);
  t("spacewar: dispara una bala", s3.balas.length === 1);
  for (let i = 0; i < 5; i++) s3.step(dt);
  t("spacewar: respeta el cooldown", s3.balas.length === 1);

  // impacto: bala pegada a la nave 2 -> pierde una vida
  const s4 = new A.SpacewarSim();
  s4.naves[2].invuln = 0;
  s4.balas.push({ x: s4.naves[2].x, y: s4.naves[2].y, vx: 0, vy: 0, d: 1, vida: 1 });
  s4.step(dt);
  t("spacewar: impacto quita vida", s4.vidas[2] === 4 && !s4.naves[2].viva);
  const s4snap = s4.snapshot();
  t("spacewar: explosion en el snapshot", Array.isArray(s4snap.expl) && s4snap.expl.length === 1);
  t("spacewar: snapshot vacia expl", s4.snapshot().expl === null);

  // sin vidas -> gana el otro
  const s5 = new A.SpacewarSim();
  s5.naves[2].invuln = 0; s5.vidas[2] = 1;
  s5.balas.push({ x: s5.naves[2].x, y: s5.naves[2].y, vx: 0, vy: 0, d: 1, vida: 1 });
  s5.step(dt);
  t("spacewar: sin vidas gana el rival", s5.ganador === 1);

  // snapshot serializable
  const snap = new A.SpacewarSim().snapshot();
  t("spacewar: snapshot JSON valido", JSON.parse(JSON.stringify(snap)).n1.vd === 5);

  // wrap-around
  const s6 = new A.SpacewarSim();
  s6.naves[1].x = A.SW.W - 1; s6.naves[1].vx = 400; s6.naves[1].invuln = 0;
  s6.aplicarInputHost({ rot: 0, thrust: false, fire: false });
  for (let i = 0; i < 30; i++) s6.step(dt);
  t("spacewar: wrap-around horizontal", s6.naves[1].x >= 0 && s6.naves[1].x < A.SW.W);
}

// ================= TRON =================
{
  const tr = new A.TronSim();
  t("tron: cuenta regresiva inicial", tr.sirviendo === true && tr.pausaRonda > 0);
  t("tron: motos en posiciones iniciales opuestas", tr.motos[1].x === 160 && tr.motos[2].x === A.TRON.W - 160);

  // Avanzar cuenta regresiva
  for (let i = 0; i < 120 * 2; i++) tr.step(1 / 120);
  t("tron: arranca movimiento tras cuenta", tr.sirviendo === false);

  // Movimiento y avance
  const x0 = tr.motos[1].x;
  for (let i = 0; i < 30; i++) tr.step(1 / 120);
  t("tron: moto 1 avanza hacia el este", tr.motos[1].x > x0);

  // Giro ortogonal hacia el norte
  tr.aplicarInputHost({ dir: "N", turbo: false });
  tr.step(1 / 120);
  t("tron: moto gira al norte", tr.motos[1].dir === "N");
  t("tron: estela registra punto de giro", tr.estelas[1].length >= 2);

  // Bloqueo de 180° (estando en N, intentar girar a S no tiene efecto)
  tr.aplicarInputHost({ dir: "S", turbo: false });
  tr.step(1 / 120);
  t("tron: prohibido giro 180 sobre si mismo", tr.motos[1].dir === "N");

  // Turbo incrementa velocidad
  const trTurbo = new A.TronSim();
  trTurbo.sirviendo = false;
  trTurbo.aplicarInputHost({ dir: "E", turbo: true });
  const xPre = trTurbo.motos[1].x;
  for (let i = 0; i < 60; i++) trTurbo.step(1 / 120);
  const avanceConTurbo = trTurbo.motos[1].x - xPre;
  t("tron: turbo aumenta velocidad", avanceConTurbo > (A.TRON.VEL_BASE * 0.5));
  t("tron: turbo gasta energia", trTurbo.motos[1].turboVal < A.TRON.TURBO_MAX);

  // Colision con limites de arena destruye moto
  const trBorde = new A.TronSim();
  trBorde.sirviendo = false;
  trBorde.motos[1].x = A.TRON.W - 5;
  trBorde.motos[1].dir = "E";
  for (let i = 0; i < 10; i++) trBorde.step(1 / 120);
  t("tron: choque con borde destruye moto", !trBorde.motos[1].viva);
  t("tron: destruccion da punto a moto rival", trBorde.puntos[2] === 1);
}

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
