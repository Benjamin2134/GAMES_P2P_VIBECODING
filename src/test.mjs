// Tests de logica pura (sin navegador): Pong, Billar, Spacewar, Battleship, Tron y Monopoly.
//   node src/test.mjs
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const SRC = dirname(fileURLToPath(import.meta.url));
const rd = (f) => readFileSync(join(SRC, f), "utf8");

const codigo = [
  rd("const.js"),
  rd("pong.sim.js"),
  rd("billar.sim.js"),
  rd("spacewar.sim.js"),
  rd("battleship.sim.js"),
  rd("tron.sim.js"),
  rd("monopoly.sim.js")
].join("\n") +
  "\nglobalThis.__api = { PONG, PongSim, BILLAR, BillarSim, _tipo, _otro, SW, SpacewarSim, BATTLESHIP, BattleshipSim, TRON, TronSim, MONOPOLY, MonopolySim };";

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

  b.fase = "apuntando"; b.turno = 1;
  b.apuntar(1, 0, 1, 0, 0);
  b.tirar(1);
  t("billar: tras tirar -> simulando", b.fase === "simulando");
  let it = 0;
  while (b.fase === "simulando" && it < 9000) { b.step(1 / 120); it++; }
  t("billar: el tiro termina (< ~6s sim)", b.fase !== "simulando" && it < 8000);
  t("billar: todas las bolas quedaron quietas", b.bolas.every((x) => !x.dentro || (x.vx === 0 && x.vy === 0)));
}

// ================= SPACEWAR =================
{
  const sw = new A.SpacewarSim();
  t("spacewar: 2 naves vivas al inicio", sw.naves[1].viva && sw.naves[2].viva);
  t("spacewar: 5 vidas cada uno", sw.vidas[1] === 5 && sw.vidas[2] === 5);

  const dt = 1 / 120;
  const s1 = new A.SpacewarSim();
  s1.aplicarInputHost({ rot: 0, thrust: true, fire: false });
  for (let i = 0; i < 60; i++) s1.step(dt);
  t("spacewar: aceleracion con thrust", Math.hypot(s1.naves[1].vx, s1.naves[1].vy) > 50);

  const s2 = new A.SpacewarSim();
  s2.aplicarInputHost({ rot: 1, thrust: false, fire: false });
  const a0 = s2.naves[1].ang;
  for (let i = 0; i < 12; i++) s2.step(dt);
  t("spacewar: rota con rot=1", Math.abs(s2.naves[1].ang - a0) > 0.1);

  const s3 = new A.SpacewarSim();
  s3.naves[1].invuln = 0; s3.naves[2].invuln = 0;
  s3.aplicarInputHost({ rot: 0, thrust: false, fire: true });
  s3.step(dt);
  t("spacewar: dispara una bala", s3.balas.length === 1);
}

// ================= BATTLESHIP =================
{
  const bs = new A.BattleshipSim();
  t("battleship: fase inicial colocacion", bs.fase === "colocacion");

  const f1 = bs.generarFlotaAleatoria();
  t("battleship: genera 5 barcos", f1.length === 5);
  t("battleship: flota aleatoria valida", bs.validarFlota(f1));

  const f2 = bs.generarFlotaAleatoria();
  bs.confirmarFlota(1, f1);
  bs.confirmarFlota(2, f2);
  t("battleship: ambos confirmados pasan a combate", bs.fase === "combate" && bs.turno === 1);

  let aguaX = 0, aguaY = 0;
  const ocupadasJ2 = new Set();
  f2.forEach(b => {
    for (let i = 0; i < b.tam; i++) {
      const cx = b.horiz ? b.x + i : b.x;
      const cy = b.horiz ? b.y : b.y + i;
      ocupadasJ2.add(`${cx},${cy}`);
    }
  });

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      if (!ocupadasJ2.has(`${x},${y}`)) { aguaX = x; aguaY = y; break; }
    }
  }

  const resAgua = bs.disparar(1, aguaX, aguaY);
  t("battleship: tiro a agua correcto", resAgua.ok && resAgua.resultado === "agua");
  t("battleship: tiro a agua cambia turno a J2", bs.turno === 2);
}

// ================= TRON =================
{
  const tr = new A.TronSim();
  t("tron: cuenta regresiva inicial", tr.sirviendo === true && tr.pausaRonda > 0);
  t("tron: motos en posiciones iniciales opuestas", tr.motos[1].x === 160 && tr.motos[2].x === A.TRON.W - 160);

  for (let i = 0; i < 120 * 2; i++) tr.step(1 / 120);
  t("tron: arranca movimiento tras cuenta", tr.sirviendo === false);

  const x0 = tr.motos[1].x;
  for (let i = 0; i < 30; i++) tr.step(1 / 120);
  t("tron: moto 1 avanza hacia el este", tr.motos[1].x > x0);

  tr.aplicarInputHost({ dir: "N", turbo: false });
  tr.step(1 / 120);
  t("tron: moto gira al norte", tr.motos[1].dir === "N");
  t("tron: estela registra punto de giro", tr.estelas[1].length >= 2);
}

// ================= MONOPOLY =================
{
  const mono = new A.MonopolySim();
  t("monopoly: dinero inicial $1500", mono.jugadores[1].dinero === 1500 && mono.jugadores[2].dinero === 1500);
  t("monopoly: 24 casillas en el tablero", A.MONOPOLY.CASILLAS.length === 24);
  t("monopoly: turno inicial J1 en fase tirar", mono.turno === 1 && mono.faseTurno === "tirar");

  // Tirar dados
  const resDados = mono.tirarDados(1);
  t("monopoly: tirada de dados exitosa", resDados.ok && resDados.dados.length === 2);
  t("monopoly: ficha avanza de posicion", mono.jugadores[1].pos > 0);
  t("monopoly: fase pasa a accion", mono.faseTurno === "accion");

  // Comprar propiedad si cayo en calle
  const cActual = A.MONOPOLY.CASILLAS[mono.jugadores[1].pos];
  if (cActual.t === "calle" || cActual.t === "estacion") {
    const dineroPre = mono.jugadores[1].dinero;
    const resCompra = mono.comprarPropiedad(1);
    t("monopoly: compra de propiedad exitosa", resCompra === true);
    t("monopoly: dinero descontado tras compra", mono.jugadores[1].dinero === dineroPre - cActual.precio);
  }

  // Pasar turno
  mono.pasarTurno(1);
  t("monopoly: turno pasa a J2", mono.turno === 2 && mono.faseTurno === "tirar");
}

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
