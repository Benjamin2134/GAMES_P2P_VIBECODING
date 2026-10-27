// Juegos del setlist hechos sobre el kit (kit.js + kit.ui.js).
// Cada id aporta src/<id>.sim.js, src/<id>.js y, si esta en CON_BOT, src/<id>.bot.js.
// build.mjs y test.mjs leen esta lista: agregar un juego nuevo = sumar su id aca.
export const SETLIST = [
  "conecta4", "reversi", "damas", "ajedrez", "ultimate", "gomoku", "mancala",
  "memorice", "domino", "dudo", "generala", "ahorcado",
  "artilleria", "minigolf", "curling",
  "airhockey", "snake", "sumo", "reflejos", "tanques",
  "pacduelo", "bomber", "tetris", "breakout", "futbol", "invasores", "carrera",
  "pinturillo",
];

export const SIN_BOT = ["pinturillo"];
export const CON_BOT = SETLIST.filter((id) => !SIN_BOT.includes(id));
