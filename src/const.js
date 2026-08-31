// ==========================================================================
//  Constantes compartidas por la simulacion (host) y el render (ambos).
//  Todo en unidades reales: pixeles y SEGUNDOS (no "por tick"), asi la
//  fisica es independiente del framerate.
//  build.mjs antepone este archivo al bundle de juego.
// ==========================================================================
const CAMPO_ANCHO = 820, CAMPO_ALTO = 480;
const PALA_ANCHO = 12, PALA_ALTO = 84, PALA_MARGEN = 24;

const PALA_VEL_PS  = 360;   // px/seg  (antes 6 px por tick @60Hz)
const BOLA_RADIO   = 7;
const BOLA_VEL_INI = 312;   // px/seg  (antes 5.2)
const BOLA_VEL_MAX = 780;   // px/seg  (antes 13)
const BOLA_ACEL    = 1.06;  // multiplicador de velocidad por paletazo

const SIM_HZ   = 120;                 // pasos de fisica por segundo (fijo)
const SIM_DT   = 1 / SIM_HZ;          // seg por paso
const SEND_HZ  = 60;                  // snapshots por segundo al rival
const PUNTOS_PARA_GANAR = 5;
const PAUSA_SERVE_MS = 2200;          // cuenta regresiva antes de cada saque

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
