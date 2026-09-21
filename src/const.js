// ==========================================================================
//  Comun a todo. build.mjs antepone este archivo al bundle.
// ==========================================================================
"use strict";
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

// Registro de juegos y bots. Cada modulo hace JUEGOS.xxx = { ... } y BOTS.xxx = { ... }
const JUEGOS = {};
const BOTS = {};

