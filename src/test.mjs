// ==========================================================================
//  Tests unitarios de lógica pura (Pong y Spacewar)
//  Ejecutar: node src/test.mjs
// ==========================================================================
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dir = dirname(fileURLToPath(import.meta.url));
const load = (f) => readFileSync(join(__dir, f), "utf8");

const sandbox = {
  console,
  setTimeout: (fn) => fn(),
  clearTimeout: () => {},
  Math
};
sandbox.globalThis = sandbox;
const context = vm.createContext(sandbox);

const fullCode = [
  load("const.js"),
  load("const-spacewar.js"),
  load("sim.js"),
  load("sim-spacewar.js"),
  "globalThis.Partida = Partida; globalThis.PartidaSpacewar = PartidaSpacewar;"
].join("\n");

vm.runInContext(fullCode, context);

const { Partida, PartidaSpacewar } = context;

console.log("--- INICIANDO TESTS DE SIMULACIÓN Y LÓGICA ---");

// Test 1: Pong - Inicialización y física
{
  const p = new Partida();
  assert.equal(p.puntos[1], 0);
  assert.equal(p.puntos[2], 0);
  assert.equal(p.sirviendo, true);

  // Avanzar tiempo para saque
  for (let i = 0; i < 300; i++) p.step(1 / 120);
  assert.notEqual(p.bola.vx, 0, "La pelota de Pong debe haberse lanzado");
  console.log("✓ Test Pong: Inicialización y saque correctos.");
}

// Test 2: Spacewar - Inercia y rotación
{
  const sw = new PartidaSpacewar();
  assert.equal(sw.vidas[1], 5);
  assert.equal(sw.vidas[2], 5);
  assert.equal(sw.naves[1].viva, true);

  const angIni = sw.naves[1].ang;
  // Aplicar rotación
  sw.aplicarInputHost({ rot: 1, thrust: false, fire: false });
  sw.step(0.1);
  assert.notEqual(sw.naves[1].ang, angIni, "La nave debe rotar");

  // Aplicar thrust
  sw.aplicarInputHost({ rot: 0, thrust: true, fire: false });
  sw.step(0.5);
  const vel = Math.hypot(sw.naves[1].vx, sw.naves[1].vy);
  assert.ok(vel > 50, "La nave debe ganar velocidad con thrust");
  console.log("✓ Test Spacewar: Rotación y aceleración inercial correctas.");
}

// Test 3: Spacewar - Disparo y colisiones
{
  const sw = new PartidaSpacewar();
  // Colocar Nave 2 en trayectoria de disparo de Nave 1
  sw.naves[1].x = 100;
  sw.naves[1].y = 200;
  sw.naves[1].ang = 0; // Apuntando al este
  sw.naves[1].invuln = 0;

  sw.naves[2].x = 250;
  sw.naves[2].y = 200;
  sw.naves[2].invuln = 0;

  // Disparar
  sw.disparar(1, sw.naves[1]);
  assert.equal(sw.balas.length, 1, "Debe existir 1 proyectil en vuelo");

  // Avanzar simulación hasta impacto
  for (let i = 0; i < 60; i++) {
    sw.step(1 / 120);
  }

  assert.equal(sw.vidas[2], 4, "Nave 2 debe perder 1 vida al ser impactada");
  console.log("✓ Test Spacewar: Balística y detección de colisiones correctas.");
}

console.log("\n==========================================");
console.log(" TODOS LOS TESTS PASARON EXITOSAMENTE (3/3)");
console.log("==========================================\n");
