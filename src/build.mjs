// Ensambla src/* en un unico GAMESP2P.html autocontenido.
//   node src/build.mjs
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { SETLIST, CON_BOT } from "./setlist.mjs";

const SRC = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(SRC, "..");
const rd = (f) => readFileSync(join(SRC, f), "utf8");

// Juegos del setlist: sims y bots junto a los originales, modulos despues de kit.ui.js.
const ORDEN = [
  "const.js", "audio.js", "kit.js",
  "pong.sim.js", "billar.sim.js", "spacewar.sim.js", "battleship.sim.js", "tron.sim.js", "monopoly.sim.js", "techno.sim.js",
  ...SETLIST.map((id) => id + ".sim.js"),
  "spacewar.bot.js", "battleship.bot.js",
  ...CON_BOT.map((id) => id + ".bot.js"),
  "pong.js", "billar.js", "spacewar.js", "battleship.js", "tron.js", "monopoly.js", "techno.js",
  "kit.ui.js",
  ...SETLIST.map((id) => id + ".js"),
  "shell.js",
];
const bundle = ORDEN.map(rd).join("\n\n");
const peerjs = rd("peerjs.min.js");

let html = rd("template.html");
for (const marca of ["/*__PEERJS__*/", "/*__BUNDLE__*/"])
  if (!html.includes(marca)) throw new Error("template.html: falta el marcador " + marca);

html = html
  .replace("/*__PEERJS__*/", () => peerjs)
  .replace("/*__BUNDLE__*/", () => bundle)
  .replace(/\r\n/g, "\n");

const salida = join(RAIZ, "GAMESP2P.html");
const indexSalida = join(RAIZ, "index.html");
writeFileSync(salida, html);
writeFileSync(indexSalida, html);
console.log("OK  ->  " + salida + "  (" + html.length + " bytes)");
console.log("OK  ->  " + indexSalida + " (GitHub Pages ready)");
