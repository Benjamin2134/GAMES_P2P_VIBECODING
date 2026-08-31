// Ensambla src/* en un unico pong.html autocontenido (para jugar y para servir).
// Uso:  node src/build.mjs        (desde la raiz del repo o desde src/)
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const SRC = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(SRC, "..");
const rd = (f) => readFileSync(join(SRC, f), "utf8");

const peerjs = rd("peerjs.min.js");
const game = [rd("const.js"), rd("sim.js"), rd("app.js")].join("\n");

let html = rd("template.html");
if (!html.includes("/*__PEERJS__*/") || !html.includes("/*__GAME__*/"))
  throw new Error("template.html: faltan los marcadores /*__PEERJS__*/ o /*__GAME__*/");

html = html
  .replace("/*__PEERJS__*/", () => peerjs)
  .replace("/*__GAME__*/", () => game)
  .replace(/\r\n/g, "\n");

const salida = join(RAIZ, "pong.html");
writeFileSync(salida, html);
console.log("OK  ->  " + salida + "  (" + html.length + " bytes)");
