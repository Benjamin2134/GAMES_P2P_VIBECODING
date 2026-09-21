// Tests de logica pura (sin navegador): Pong, Billar, Spacewar, Battleship, Tron, Monopoly y Techno.
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
  rd("monopoly.sim.js"),
  rd("techno.sim.js")
].join("\n") +
  "\nglobalThis.__api = { PONG, PongSim, BILLAR, BillarSim, _tipo, _otro, SW, SpacewarSim, BATTLESHIP, BattleshipSim, TRON, TronSim, MONOPOLY, MonopolySim, TECHNO, TechnoSim };";

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

  // Regresion: girar no debe autodestruir la moto por un falso positivo de
  // colision consigo misma (bug: dos segmentos perpendiculares que comparten
  // el vertice del giro registraban una interseccion espuria en la mitad de
  // los giros, segun su sentido). Probamos los 4 giros posibles desde cada
  // direccion inicial y confirmamos que la moto sigue viva varios frames despues.
  const direcciones = ["N", "S", "E", "W"];
  for (const dIni of direcciones) {
    for (const dGiro of direcciones) {
      if (dGiro === dIni) continue;
      const opuestos = { N: "S", S: "N", E: "W", W: "E" };
      if (dGiro === opuestos[dIni]) continue; // giro de 180 no esta permitido
      const trg = new A.TronSim();
      trg.motos[1].dir = dIni;
      trg.motos[1].dirPendiente = dIni;
      for (let i = 0; i < 120 * 2; i++) trg.step(1 / 120);
      trg.aplicarInputHost({ dir: dGiro, turbo: false });
      for (let i = 0; i < 15; i++) trg.step(1 / 120);
      t(`tron: girar de ${dIni} a ${dGiro} no autodestruye por falso positivo`, trg.motos[1].viva === true);
    }
  }

  // Una colision real contra la propia estela (bucle cerrado) SI debe matar.
  {
    const trs = new A.TronSim();
    for (let i = 0; i < 120 * 2; i++) trs.step(1 / 120);
    const secuencia = [["S", 60], ["W", 60], ["N", 60], ["E", 200]];
    let murioPorBucle = false;
    for (const [dir, frames] of secuencia) {
      trs.aplicarInputHost({ dir, turbo: false });
      for (let i = 0; i < frames; i++) {
        trs.step(1 / 120);
        if (!trs.motos[1].viva) { murioPorBucle = true; break; }
      }
      if (murioPorBucle) break;
    }
    t("tron: un bucle cerrado real SI colisiona contra la propia estela", murioPorBucle === true);
  }

  // Power-up de acelerón: aparece, se puede recolectar y otorga boost temporal.
  {
    const trp = new A.TronSim();
    for (let i = 0; i < 120 * 2; i++) trp.step(1 / 120);
    trp.powerupEn = 0.001;
    trp.step(1 / 120);
    t("tron: el power-up aparece cuando el contador llega a 0", trp.powerup !== null);

    // Forzamos a la moto 1 justo sobre el power-up y verificamos que lo recoge.
    trp.motos[1].x = trp.powerup.x;
    trp.motos[1].y = trp.powerup.y;
    trp.step(1 / 120);
    t("tron: recoger el power-up otorga boostVal", trp.motos[1].boostVal > 0);
    t("tron: el power-up desaparece tras ser recogido", trp.powerup === null);

    const snap = trp.snapshot();
    t("tron: el snapshot marca a la moto 1 en estado boost", snap.m1.boost === true);
    t("tron: el snapshot informa quien tomo el power-up", Array.isArray(snap.boostTomado) && snap.boostTomado.includes(1));

    const x0 = trp.motos[1].x;
    trp.step(1 / 120);
    const avance = trp.motos[1].x - x0;
    t("tron: durante el boost la moto viaja mas rapido que la velocidad base", avance > (A.TRON.VEL_BASE / 120) * 1.5);
  }
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
  mono.dobles = false;
  mono.pasarTurno(1);
  t("monopoly: turno pasa a J2", mono.turno === 2 && mono.faseTurno === "tirar");
}

// ================= TECHNO =================
{
  const ts = new A.TechnoSim();
  t("techno: grid tiene 11 canales (4 drums + 7 melodia)", ts.grid.length === 11);
  t("techno: cada canal tiene 17 pasos", ts.grid[0].length === 17);
  t("techno: bpm default es 130", ts.bpm === 130);
  t("techno: kick en 4x4 por defecto", ts.grid[0][0] === true && ts.grid[0][4] === true && ts.grid[0][8] === true && ts.grid[0][12] === true);
  t("techno: canales de melodia arrancan en -1 (off)", ts.grid[4][0] === -1 && ts.grid[10][3] === -1);
  t("techno: 7 notas por defecto (bajo x4 + sinte + piano + guitarra)", ts.melodyNotes.length === 7);
  t("techno: nombres de canal cubren los 11", A.TECHNO.NOMBRES_CANAL.length === 11 && A.TECHNO.NOMBRES_CANAL[8] === "SYNTH" && A.TECHNO.NOMBRES_CANAL[10] === "GTR");

  // Reloj avanza steps
  for (let i = 0; i < 120; i++) ts.step(1 / 120);
  t("techno: step avanza tras suficientes dt", ts.currentStep > 0);
  t("techno: seq incrementa", ts.seq > 0);

  // Toggle drum
  const ts2 = new A.TechnoSim();
  t("techno: step 1 de kick arranca off", ts2.grid[0][1] === false);
  ts2.toggleStep(0, 1);
  t("techno: toggle prende step", ts2.grid[0][1] === true);
  ts2.toggleStep(0, 1);
  t("techno: toggle apaga step", ts2.grid[0][1] === false);

  // Toggle canal de melodia (bajo, ch 4)
  t("techno: step 0 de bass1 arranca off", ts2.grid[4][0] === -1);
  ts2.toggleStep(4, 0);
  t("techno: toggle bajo prende con nota", ts2.grid[4][0] === ts2.melodyNotes[0]);
  ts2.toggleStep(4, 0);
  t("techno: toggle bajo apaga", ts2.grid[4][0] === -1);

  // Instrumentos nuevos: sinte (8), piano (9), guitarra (10)
  ts2.toggleStep(8, 2);
  t("techno: toggle sinte prende con su nota", ts2.grid[8][2] === ts2.melodyNotes[4]);
  ts2.toggleStep(9, 2);
  t("techno: toggle piano prende con su nota", ts2.grid[9][2] === ts2.melodyNotes[5]);
  ts2.toggleStep(10, 2);
  t("techno: toggle guitarra prende con su nota", ts2.grid[10][2] === ts2.melodyNotes[6]);
  ts2.toggleStep(10, 16); // ultimo paso: el "1 slot mas" (indice 16, paso 17)
  t("techno: el paso 17 (indice 16) existe y es editable", ts2.grid[10][16] !== -1);

  // setStepValue: aplica un valor ya resuelto (idempotente, para la red)
  const ts3 = new A.TechnoSim();
  ts3.setStepValue(0, 3, true);
  t("techno: setStepValue prende un paso de drum", ts3.grid[0][3] === true);
  ts3.setStepValue(0, 3, true); // aplicar dos veces no debe alternar (no es un toggle)
  t("techno: setStepValue es idempotente", ts3.grid[0][3] === true);
  ts3.setMuteValue(1, true);
  ts3.setMuteValue(1, true);
  t("techno: setMuteValue es idempotente", ts3.mute[1] === true);

  // BPM clamp
  ts2.setBpm(50);
  t("techno: bpm no baja de 100", ts2.bpm === 100);
  ts2.setBpm(200);
  t("techno: bpm no sube de 160", ts2.bpm === 160);
  ts2.setBpm(140);
  t("techno: bpm acepta valor valido", ts2.bpm === 140);

  // Filtro clamp
  ts2.setFilter(50, 50);
  t("techno: cutoff clampeado min", ts2.cutoff === A.TECHNO.CUT_MIN);
  t("techno: resonance clampeado max", ts2.resonance === A.TECHNO.RES_MAX);
  ts2.setFilter(3000, 15);
  t("techno: filtro acepta valores validos", ts2.cutoff === 3000 && ts2.resonance === 15);

  // Nota: una vez puesta en un paso, queda FIJA en ese tono aunque despues
  // cambies la nota "actual" del canal para seguir componiendo.
  ts2.toggleStep(4, 0);                 // prende el paso 0 con la nota actual (indice 0 = C2)
  const notaFijadaEnPaso0 = ts2.grid[4][0];
  ts2.setNote(4, 5);                    // cambio la nota del canal para lo que siga
  t("techno: cambiar la nota del canal NO reescribe pasos ya puestos", ts2.grid[4][0] === notaFijadaEnPaso0);
  t("techno: setNote cambia melodyNotes (para el proximo paso)", ts2.melodyNotes[0] === 5);
  ts2.toggleStep(4, 1);                 // un paso nuevo SI usa la nota recien elegida
  t("techno: un paso nuevo usa la nota actual del canal", ts2.grid[4][1] === 5);
  t("techno: el paso viejo sigue con su nota original", ts2.grid[4][0] === notaFijadaEnPaso0 && notaFijadaEnPaso0 !== 5);
  ts2.setNote(0, 3); // fuera de rango (ch < 4)
  t("techno: setNote ignora canales drum", true); // no crash

  // Mezcla por canal: volumen + EQ (knobs), clampeados
  t("techno: vol/eqLow/eqHigh arrancan neutros", ts2.vol[4] === A.TECHNO.VOL_DEF && ts2.eqLow[4] === 0 && ts2.eqHigh[4] === 0);
  ts2.setVol(4, 2); t("techno: setVol clampea al maximo", ts2.vol[4] === A.TECHNO.VOL_MAX);
  ts2.setVol(4, -1); t("techno: setVol clampea al minimo", ts2.vol[4] === A.TECHNO.VOL_MIN);
  ts2.setVol(4, 1.2); t("techno: setVol acepta un valor valido", ts2.vol[4] === 1.2);
  ts2.setEqLow(0, 99); t("techno: setEqLow clampea", ts2.eqLow[0] === A.TECHNO.EQ_MAX);
  ts2.setEqHigh(0, -99); t("techno: setEqHigh clampea", ts2.eqHigh[0] === A.TECHNO.EQ_MIN);
  t("techno: la mezcla es POR CANAL (no afecta a otros)", ts2.vol[5] === A.TECHNO.VOL_DEF && ts2.eqLow[1] === 0);

  // Mute
  t("techno: canal 0 no muteado", ts2.mute[0] === false);
  ts2.toggleMute(0);
  t("techno: toggleMute mutea", ts2.mute[0] === true);
  ts2.toggleMute(0);
  t("techno: toggleMute desmutea", ts2.mute[0] === false);

  // Snapshot
  const snap = ts2.snapshot();
  t("techno: snapshot tiene tipo e", snap.t === "e");
  t("techno: snapshot tiene grid", Array.isArray(snap.grid));
  t("techno: snapshot tiene bpm", typeof snap.bpm === "number");

  // ---- SINCRONIZACION: dos relojes independientes (host + guest) ----
  // El punto central del arreglo: cada maquina tiene SU PROPIO TechnoSim y
  // el audio depende solo de "step()" local. La red solo debe:
  //  1) mandar ediciones de grid/mute/bpm/filtro/nota (ya cubierto arriba)
  //  2) corregir la FASE del reloj del guest de a poco, sin "tocar" el audio
  const host = new A.TechnoSim(), guest = new A.TechnoSim();
  host.setBpm(130); guest.setBpm(130);
  // avanzamos el host mucho mas que al guest para simular deriva/jitter de red
  for (let i = 0; i < 400; i++) host.step(1 / 120);
  for (let i = 0; i < 40; i++) guest.step(1 / 120);
  const antesStep = guest.currentStep;
  const antesGanancia = Math.abs((host.currentStep * host.stepDuration + host.acc) - (guest.currentStep * guest.stepDuration + guest.acc));
  guest.resyncFromHost(host.currentStep, host.acc, host.bpm);
  const despuesGanancia = Math.abs((host.currentStep * host.stepDuration + host.acc) - (guest.currentStep * guest.stepDuration + guest.acc));
  t("techno: resyncFromHost nunca dispara audio (no toca stepTriggered)", guest.stepTriggered === false);
  t("techno: resyncFromHost acerca la fase del guest a la del host", despuesGanancia < antesGanancia || despuesGanancia < 0.01);

  // Correccion suave: una diferencia chica no debe "saltar" el paso de una
  const g2 = new A.TechnoSim();
  g2.currentStep = 5; g2.acc = 0.01;
  const stepAntes = g2.currentStep;
  g2.resyncFromHost(5, 0.03, 130); // diferencia de 20ms, bien menor a un paso (~115ms @130bpm)
  t("techno: correccion chica no cambia el paso de forma brusca", Math.abs(g2.currentStep - stepAntes) <= 1);

  // Correccion grande (recien conectado): debe corregir directo una vez
  const g3 = new A.TechnoSim();
  g3.currentStep = 0; g3.acc = 0;
  g3.resyncFromHost(9, 0.02, 130);
  t("techno: desvio grande corrige directo al paso del host", g3.currentStep === 9);

  // resyncFromHost tambien alinea el bpm si el host lo cambio
  const g4 = new A.TechnoSim();
  g4.resyncFromHost(g4.currentStep, g4.acc, 150);
  t("techno: resyncFromHost alinea el bpm", g4.bpm === 150);
}

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
