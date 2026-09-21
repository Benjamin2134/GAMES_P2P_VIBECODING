// ==========================================================================
//  Bot Universal: BATTLESHIP (src/battleship.bot.js)
//  Heurística clásica Hunt & Target con paridad de tablero (Checkerboard)
//  y seguimiento direccional ortogonal. Cumple Fair Play (cero trampas).
// ==========================================================================
"use strict";

const BattleshipBot = {
  // Estado interno del bot
  _timerAcc: 0,
  _delayActual: 0.6,
  _impactosPendientes: [], // Array de {x, y} de impactos vivos sin hundir
  _colaObjetivos: [],     // Array de {x, y} prioritarios en modo Target
  _modo: "hunt",          // "hunt" | "target"
  _flotaConfirmada: false,

  reset() {
    this._timerAcc = 0;
    this._delayActual = 0.5 + Math.random() * 0.4;
    this._impactosPendientes = [];
    this._colaObjetivos = [];
    this._modo = "hunt";
    this._flotaConfirmada = false;
  },

  // Genera candidatos ortogonales válidos y no disparados
  _obtenerVecinosValidos(cx, cy, tablero) {
    const deltas = [
      { x: cx + 1, y: cy },
      { x: cx - 1, y: cy },
      { x: cx, y: cy + 1 },
      { x: cx, y: cy - 1 }
    ];
    return deltas.filter(p =>
      p.x >= 0 && p.x < 10 &&
      p.y >= 0 && p.y < 10 &&
      tablero[p.y][p.x] === 0
    );
  },

  // Selecciona la siguiente coordenada de disparo cumpliendo Fair Play
  // tablero = sim.disparos[1] (disparos recibidos por el humano; 0=libre, 1=agua, 2=impacto)
  obtenerSiguienteDisparo(tablero) {
    // 1. MODO TARGET: Si hay objetivos en cola, usar el primero libre
    while (this._colaObjetivos.length > 0) {
      const cand = this._colaObjetivos.shift();
      if (cand.x >= 0 && cand.x < 10 && cand.y >= 0 && cand.y < 10) {
        if (tablero[cand.y][cand.x] === 0) {
          return cand;
        }
      }
    }

    // 2. Si no hay cola pero hay impactos pendientes:
    if (this._impactosPendientes.length > 0) {
      // Si hay 2 o más impactos, inferir la línea (Horizontal o Vertical)
      if (this._impactosPendientes.length >= 2) {
        const prim = this._impactosPendientes[0];
        const todosMismoY = this._impactosPendientes.every(p => p.y === prim.y);
        const todosMismoX = this._impactosPendientes.every(p => p.x === prim.x);

        if (todosMismoY) {
          // Línea horizontal: buscar extremos izquierdo y derecho
          const xs = this._impactosPendientes.map(p => p.x).sort((a, b) => a - b);
          const y = prim.y;
          const extIzq = { x: xs[0] - 1, y };
          const extDer = { x: xs[xs.length - 1] + 1, y };

          const candidatos = [];
          if (extIzq.x >= 0 && tablero[y][extIzq.x] === 0) candidatos.push(extIzq);
          if (extDer.x < 10 && tablero[y][extDer.x] === 0) candidatos.push(extDer);

          if (candidatos.length > 0) {
            const elegido = candidatos.shift();
            this._colaObjetivos = candidatos;
            return elegido;
          }
        } else if (todosMismoX) {
          // Línea vertical: buscar extremos arriba y abajo
          const ys = this._impactosPendientes.map(p => p.y).sort((a, b) => a - b);
          const x = prim.x;
          const extArr = { x, y: ys[0] - 1 };
          const extAba = { x, y: ys[ys.length - 1] + 1 };

          const candidatos = [];
          if (extArr.y >= 0 && tablero[extArr.y][x] === 0) candidatos.push(extArr);
          if (extAba.y < 10 && tablero[extAba.y][x] === 0) candidatos.push(extAba);

          if (candidatos.length > 0) {
            const elegido = candidatos.shift();
            this._colaObjetivos = candidatos;
            return elegido;
          }
        }
      }

      // Si no están alineados o los extremos están bloqueados, buscar vecinos de cualquier impacto
      for (const imp of this._impactosPendientes) {
        const vecinos = this._obtenerVecinosValidos(imp.x, imp.y, tablero);
        if (vecinos.length > 0) {
          const elegido = vecinos.shift();
          this._colaObjetivos = vecinos;
          return elegido;
        }
      }
    }

    // 3. MODO HUNT: Caza por tablero de ajedrez / paridad (x + y) % 2 === 0
    // Como el barco más pequeño mide 2 celdas, cualquier barco ocupa al menos una casilla par.
    const casillasPar = [];
    const casillasImpar = [];

    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        if (tablero[y][x] === 0) {
          if ((x + y) % 2 === 0) casillasPar.push({ x, y });
          else casillasImpar.push({ x, y });
        }
      }
    }

    const bolsa = casillasPar.length > 0 ? casillasPar : casillasImpar;
    if (bolsa.length === 0) return null;

    // Seleccionar casilla al azar de la bolsa para variedad arcade
    const idx = Math.floor(Math.random() * bolsa.length);
    return bolsa[idx];
  },

  // Elimina de _impactosPendientes las celdas contiguas conectadas al último impacto
  _removerBarcoHundido(ultimoX, ultimoY) {
    if (this._impactosPendientes.length === 0) return;

    // Buscar componente conexo ortogonal alrededor de (ultimoX, ultimoY)
    const aRemover = new Set();
    const cola = [{ x: ultimoX, y: ultimoY }];
    aRemover.add(`${ultimoX},${ultimoY}`);

    while (cola.length > 0) {
      const act = cola.shift();
      for (const p of this._impactosPendientes) {
        const key = `${p.x},${p.y}`;
        if (!aRemover.has(key)) {
          const distManhattan = Math.abs(p.x - act.x) + Math.abs(p.y - act.y);
          if (distManhattan === 1) {
            aRemover.add(key);
            cola.push(p);
          }
        }
      }
    }

    this._impactosPendientes = this._impactosPendientes.filter(
      p => !aRemover.has(`${p.x},${p.y}`)
    );
    this._colaObjetivos = [];

    if (this._impactosPendientes.length === 0) {
      this._modo = "hunt";
    }
  },

  // Bucle de decisión por frame (llamado desde shell.js vía juego.botStep(dt))
  step(sim, dt, onDisparo) {
    if (!sim || sim.ganador) return;

    // 1. FASE DE COLOCACIÓN: Confirmar flota automáticamente tras pequeño retardo
    if (sim.fase === "colocacion") {
      if (!sim.listos[2]) {
        this._timerAcc += dt;
        if (this._timerAcc >= 0.3) {
          const flota = sim.generarFlotaAleatoria();
          sim.confirmarFlota(2, flota);
          this._flotaConfirmada = true;
          this._timerAcc = 0;
          this._delayActual = 0.7 + Math.random() * 0.4; // 700ms - 1100ms
        }
      }
      return;
    }

    // 2. FASE DE COMBATE: Disparar en el turno del bot (Jugador 2)
    if (sim.fase === "combate") {
      if (sim.turno !== 2) {
        this._timerAcc = 0;
        return;
      }

      this._timerAcc += dt;
      if (this._timerAcc < this._delayActual) {
        return; // Esperando latencia de radar/sonar
      }

      // Tiempo cumplido: calcular disparo
      const tableroRival = sim.disparos[1]; // Disparos recibidos por J1
      const coord = this.obtenerSiguienteDisparo(tableroRival);
      if (!coord) return;

      const res = sim.disparar(2, coord.x, coord.y);
      if (res.ok) {
        if (res.resultado === "impacto") {
          this._impactosPendientes.push({ x: coord.x, y: coord.y });
          this._modo = "target";
          // Mantiene turno: preparar siguiente tiro tras breve pausa
          this._timerAcc = 0;
          this._delayActual = 0.7 + Math.random() * 0.3;
        } else if (res.resultado === "hundido" || res.resultado === "victoria") {
          this._impactosPendientes.push({ x: coord.x, y: coord.y });
          this._removerBarcoHundido(coord.x, coord.y);
          // Mantiene turno (o fin de juego)
          this._timerAcc = 0;
          this._delayActual = 0.8 + Math.random() * 0.3;
        } else {
          // Agua: cambio de turno automático a Jugador 1
          this._timerAcc = 0;
          this._delayActual = 0.7 + Math.random() * 0.4;
        }

        if (typeof onDisparo === "function") {
          onDisparo(coord.x, coord.y, res);
        }
      }
    }
  }
};

// Registro automático en el motor arcade
if (typeof BOTS !== "undefined") {
  BOTS.battleship = BattleshipBot;
}

// Export para Node.js / test.mjs
if (typeof module !== "undefined" && module.exports) {
  module.exports = { BattleshipBot };
}
