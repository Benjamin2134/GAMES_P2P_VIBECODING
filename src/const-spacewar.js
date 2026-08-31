// ==========================================================================
//  SPACEWAR 1979 - Constantes de Simulación y Render
//  Unidades en píxeles, radianes y SEGUNDOS (física fija a 120 Hz).
// ==========================================================================

const SW_ANCHO = 880;
const SW_ALTO = 540;

// Naves
const SW_NAVE_RADIO = 14;          // Radio del colisionador circular
const SW_ROT_VEL = 4.2;            // Radianes por segundo (~240°/s)
const SW_THRUST_ACC = 380;         // Píxeles / seg^2
const SW_VEL_MAX = 420;            // Píxeles / seg
const SW_FRICCION = 0.992;         // Inercia casi pura del espacio profundo (decay por paso 120Hz)

// Proyectiles / Balas
const SW_BALA_VEL = 560;           // Píxeles / seg (relativa a la nave)
const SW_BALA_VIDA_S = 1.4;        // Duración en segundos antes de disiparse
const SW_BALA_COOLDOWN = 0.22;     // Segundos entre disparos (~4.5 disparos/s)
const SW_BALA_RADIO = 3;           // Radio del proyectil
const SW_MAX_BALAS = 6;            // Máximo de proyectiles simultáneos por nave

// Sistema de Combate
const SW_VIDAS_MAX = 5;            // Vidas para ganar la partida
const SW_INVULN_SPAWN_S = 2.0;     // Segundos de escudo/invulnerabilidad tras respawn

// Entorno
const SW_GRAVEDAD_SOL = 0;         // Gravedad opcional hacia el centro (0 = espacio abierto clásico)
const SW_WRAP_AROUND = true;       // Salir por un borde y entrar por el opuesto

// Exportación para Node.js / Tests si aplica
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SW_ANCHO, SW_ALTO, SW_NAVE_RADIO, SW_ROT_VEL, SW_THRUST_ACC, SW_VEL_MAX,
    SW_FRICCION, SW_BALA_VEL, SW_BALA_VIDA_S, SW_BALA_COOLDOWN, SW_BALA_RADIO,
    SW_MAX_BALAS, SW_VIDAS_MAX, SW_INVULN_SPAWN_S, SW_GRAVEDAD_SOL, SW_WRAP_AROUND
  };
}
