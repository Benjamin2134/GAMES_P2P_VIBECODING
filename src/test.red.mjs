// Test de red del kit: un host y un guest en dos contextos separados, unidos
// por un canal que pierde el 30% de los mensajes (como el DataChannel no
// confiable). Verifica que las acciones del guest llegan una sola vez y en
// orden, que su vista converge a la del host y que la revancha funciona.
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const SRC = dirname(fileURLToPath(import.meta.url));
const rd = (f) => readFileSync(join(SRC, f), "utf8");

function navegador(rol, enviar) {
  const oyentes = {};
  const nada = () => {};
  const ctx = new Proxy({}, {
    get: (o, k) => (k in o ? o[k] : k === "measureText" ? () => ({ width: 10 }) : k.startsWith("create") ? () => ({ addColorStop: nada }) : nada),
    set: (o, k, v) => { o[k] = v; return true; },
  });
  const cv = { style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 600 }), addEventListener: nada, removeEventListener: nada, setPointerCapture: nada };
  const sb = {
    Math, JSON, console, performance: { now: () => 0 }, cv, ctx,
    net: { rol, esBot: false, enviar },
    addEventListener: (t, f) => { (oyentes[t] = oyentes[t] || []).push(f); }, removeEventListener: nada,
    document: { getElementById: () => ({ appendChild: nada }), createElement: () => ({ style: {}, addEventListener: nada, remove: nada }) },
  };
  vm.createContext(sb);
  new vm.Script([rd("const.js"), rd("kit.js"), rd("conecta4.sim.js"), rd("kit.ui.js"), rd("conecta4.js")].join("\n") + "\nglobalThis.J = JUEGOS.conecta4;").runInContext(sb);
  sb.tecla = (key) => (oyentes.keydown || []).forEach((f) => f({ key, preventDefault: nada, target: {} }));
  return sb;
}

export function testsRed(t) {
  const colaA = [], colaB = [];
  let semilla = 7;
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
  const pierde = (cola) => (m) => { if (azar() > 0.3) cola.push(m); };
  const host = navegador(1, pierde(colaB)), guest = navegador(2, pierde(colaA));
  host.J.iniciarHost(); guest.J.iniciarGuest();
  let now = 0;
  const frame = (n = 1) => {
    for (let k = 0; k < n; k++) {
      now += 16.7;
      host.J.frame(now, 1 / 60, false); guest.J.frame(now, 1 / 60, false);
      while (colaA.length) host.J.onData(JSON.parse(colaA.shift()));
      while (colaB.length) guest.J.onData(JSON.parse(colaB.shift()));
    }
  };
  frame(10);
  const sim = host.J.sim;
  t("red: el guest recibe la vista pese a la perdida", guest.J.sim === null && sim.turno === 1);
  // juegan alternando: host por su teclado, guest por el suyo
  const jugadas = [[1, "4"], [2, "4"], [1, "3"], [2, "5"], [1, "2"], [2, "6"]];
  for (const [j, k] of jugadas) { (j === 1 ? host : guest).tecla(k); frame(40); }
  const fichas2 = sim.tab.filter((x) => x === 2).length;
  t("red: cada accion del guest llega una sola vez", fichas2 === 3);
  t("red: las acciones del guest llegan en orden", sim.tab[5 * 7 + 3] === 1 && sim.tab[4 * 7 + 3] === 2 && sim.tab[5 * 7 + 4] === 2 && sim.tab[5 * 7 + 5] === 2);
  // forzar fin y revancha pedida por ambos
  host.tecla("1"); frame(40);
  t("red: P1 gana con cuatro en linea", sim.ganador === 1);
  frame(80);
  t("red: el guest ve el resultado", guest.J.overlay() && guest.J.overlay().texto === "PERDISTE");
  guest.J.revancha(); frame(40);
  t("red: la revancha del guest queda pedida", host.J.overlay() && host.J.sim.ganador === 1);
  host.J.revancha(); frame(60);
  t("red: con ambos, empieza otra partida (la abre P2)", host.J.sim !== sim && host.J.sim.turno === 2 && host.J.sim.tab.every((x) => !x));
  t("red: el guest ve la partida nueva", !guest.J.overlay());
}
