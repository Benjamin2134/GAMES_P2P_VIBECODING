// ==========================================================================
//  Build Script: Ensambla el Arcade Hub y los juegos standalone
//  Uso: node src/build.mjs
// ==========================================================================
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const SRC = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(SRC, "..");
const rd = (f) => readFileSync(join(SRC, f), "utf8");

const peerjs = rd("peerjs.min.js");
const audio = rd("audio.js");

// 1. Ensamblar ARCADE HUB (index.html)
const hubGameCode = [
  rd("const.js"),
  rd("const-spacewar.js"),
  rd("sim.js"),
  rd("sim-spacewar.js"),
  rd("app-hub.js")
].join("\n");

let hubHtml = rd("template-hub.html");
if (!hubHtml.includes("/*__PEERJS__*/") || !hubHtml.includes("/*__AUDIO__*/") || !hubHtml.includes("/*__GAME__*/")) {
  throw new Error("template-hub.html: faltan los marcadores /*__PEERJS__*/, /*__AUDIO__*/ o /*__GAME__*/");
}

hubHtml = hubHtml
  .replace("/*__PEERJS__*/", () => peerjs)
  .replace("/*__AUDIO__*/", () => audio)
  .replace("/*__GAME__*/", () => hubGameCode)
  .replace(/\r\n/g, "\n");

const salidaIndex = join(RAIZ, "index.html");
writeFileSync(salidaIndex, hubHtml);
console.log(`[OK] index.html (Arcade Hub)    -> ${hubHtml.length} bytes`);

// 2. Ensamblar Standalone Pong (pong.html)
const pongGameCode = [rd("const.js"), rd("sim.js"), rd("app.js")].join("\n");
let pongHtml = rd("template.html");
pongHtml = pongHtml
  .replace("/*__PEERJS__*/", () => peerjs)
  .replace("/*__GAME__*/", () => pongGameCode)
  .replace(/\r\n/g, "\n");

const salidaPong = join(RAIZ, "pong.html");
writeFileSync(salidaPong, pongHtml);
console.log(`[OK] pong.html (Standalone)     -> ${pongHtml.length} bytes`);

// 3. Ensamblar Standalone Spacewar (spacewar.html)
if (existsSync(join(SRC, "template-spacewar.html"))) {
  let swHtml = rd("template-spacewar.html");
  swHtml = swHtml
    .replace("/*__PEERJS__*/", () => peerjs)
    .replace("/*__AUDIO__*/", () => audio)
    .replace("/*__GAME__*/", () => hubGameCode)
    .replace(/\r\n/g, "\n");

  const salidaSW = join(RAIZ, "spacewar.html");
  writeFileSync(salidaSW, swHtml);
  console.log(`[OK] spacewar.html (Standalone) -> ${swHtml.length} bytes`);
}
