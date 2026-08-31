// Constantes compartidas por el worker (simulacion) y el hilo principal (render).
// build.mjs las antepone a ambos.
const CAMPO_ANCHO = 820, CAMPO_ALTO = 480;
const PALA_ANCHO = 12, PALA_ALTO = 84, PALA_MARGEN = 24, PALA_VEL = 6;
const BOLA_RADIO = 7, BOLA_VEL_INI = 5.2, BOLA_VEL_MAX = 13;
const TICK_MS = 1000 / 60;
const PUNTOS_PARA_GANAR = 5;
const PAUSA_SERVE_MS = 2200;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
