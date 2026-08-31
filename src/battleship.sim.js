// ==========================================================================
//  Simulación autoritativa de BATTLESHIP (Batalla Naval P2P).
//  Tablero 10x10, colocación validada, niebla de guerra, combate y turnos.
// ==========================================================================

const BATTLESHIP = {
  W: 920,
  H: 560,
  GRID_SIZE: 10,
  BARCOS_DEF: [
    { id: "carrier", nombre: "Portaaviones", tam: 5, color: "#39ff14" },
    { id: "battleship", nombre: "Acorazado", tam: 4, color: "#00e5ff" },
    { id: "cruiser", nombre: "Crucero", tam: 3, color: "#ffb000" },
    { id: "submarine", nombre: "Submarino", tam: 3, color: "#bd00ff" },
    { id: "destroyer", nombre: "Destructor", tam: 2, color: "#ff3366" }
  ]
};

class BattleshipSim {
  constructor() {
    this.reiniciarTodo();
  }

  reiniciarTodo() {
    this.fase = "colocacion"; // "colocacion" | "combate" | "fin"
    this.listos = { 1: false, 2: false };
    this.flotas = { 1: [], 2: [] };
    // Tableros de impactos: 0 = sin disparar, 1 = agua, 2 = impacto
    this.disparos = {
      1: Array.from({ length: 10 }, () => Array(10).fill(0)), // Disparos recibidos por J1
      2: Array.from({ length: 10 }, () => Array(10).fill(0))  // Disparos recibidos por J2
    };
    this.turno = 1;
    this.ganador = 0;
    this.revancha = { 1: false, 2: false };
    this.ultimoEvento = null;
    this.seq = 0;
  }

  // Genera una disposición aleatoria válida de los 5 barcos
  generarFlotaAleatoria() {
    const flota = [];
    const ocupado = Array.from({ length: 10 }, () => Array(10).fill(false));

    for (const bDef of BATTLESHIP.BARCOS_DEF) {
      let puesto = false;
      let intentos = 0;
      while (!puesto && intentos < 200) {
        intentos++;
        const horiz = Math.random() < 0.5;
        const maxX = horiz ? 10 - bDef.tam : 9;
        const maxY = horiz ? 9 : 10 - bDef.tam;
        const x0 = Math.floor(Math.random() * (maxX + 1));
        const y0 = Math.floor(Math.random() * (maxY + 1));

        let choca = false;
        for (let i = 0; i < bDef.tam; i++) {
          const cx = horiz ? x0 + i : x0;
          const cy = horiz ? y0 : y0 + i;
          if (ocupado[cy][cx]) { choca = true; break; }
        }

        if (!choca) {
          const celdas = [];
          for (let i = 0; i < bDef.tam; i++) {
            const cx = horiz ? x0 + i : x0;
            const cy = horiz ? y0 : y0 + i;
            ocupado[cy][cx] = true;
            celdas.push({ x: cx, y: cy, tocado: false });
          }
          flota.push({
            id: bDef.id,
            nombre: bDef.nombre,
            tam: bDef.tam,
            x: x0,
            y: y0,
            horiz,
            celdas,
            hundido: false
          });
          puesto = true;
        }
      }
    }
    return flota;
  }

  // Valida que una flota contenga los 5 barcos dentro del tablero y sin solaparse
  validarFlota(flota) {
    if (!Array.isArray(flota) || flota.length !== BATTLESHIP.BARCOS_DEF.length) return false;
    const ocupado = Array.from({ length: 10 }, () => Array(10).fill(false));

    for (const b of flota) {
      const def = BATTLESHIP.BARCOS_DEF.find(d => d.id === b.id);
      if (!def || b.tam !== def.tam) return false;
      if (b.x < 0 || b.y < 0) return false;
      if (b.horiz && b.x + b.tam > 10) return false;
      if (!b.horiz && b.y + b.tam > 10) return false;

      for (let i = 0; i < b.tam; i++) {
        const cx = b.horiz ? b.x + i : b.x;
        const cy = b.horiz ? b.y : b.y + i;
        if (cx < 0 || cx >= 10 || cy < 0 || cy >= 10) return false;
        if (ocupado[cy][cx]) return false;
        ocupado[cy][cx] = true;
      }
    }
    return true;
  }

  confirmarFlota(jugadorId, flota) {
    if (this.fase !== "colocacion") return false;
    if (!this.validarFlota(flota)) return false;

    // Normalizar celdas
    this.flotas[jugadorId] = flota.map(b => {
      const celdas = [];
      for (let i = 0; i < b.tam; i++) {
        celdas.push({
          x: b.horiz ? b.x + i : b.x,
          y: b.horiz ? b.y : b.y + i,
          tocado: false
        });
      }
      return { ...b, celdas, hundido: false };
    });

    this.listos[jugadorId] = true;

    // Si ambos están listos, iniciar combate
    if (this.listos[1] && this.listos[2]) {
      this.fase = "combate";
      this.turno = 1; // Host inicia
      this.ultimoEvento = { tipo: "INICIO_COMBATE", turno: 1 };
    }
    return true;
  }

  disparar(jugadorId, x, y) {
    if (this.fase !== "combate") return { ok: false, motivo: "Fase incorrecta" };
    if (this.ganador) return { ok: false, motivo: "Partida finalizada" };
    if (this.turno !== jugadorId) return { ok: false, motivo: "No es tu turno" };
    if (x < 0 || x >= 10 || y < 0 || y >= 10) return { ok: false, motivo: "Coordenadas fuera de rango" };

    const rivalId = jugadorId === 1 ? 2 : 1;
    const tableroRival = this.disparos[rivalId];

    // Ya disparó en esta casilla
    if (tableroRival[y][x] !== 0) return { ok: false, motivo: "Casilla ya disparada" };

    // Buscar si impactó algún barco rival
    const flotaRival = this.flotas[rivalId];
    let barcoImpactado = null;

    for (const b of flotaRival) {
      const celda = b.celdas.find(c => c.x === x && c.y === y);
      if (celda) {
        celda.tocado = true;
        barcoImpactado = b;
        break;
      }
    }

    if (barcoImpactado) {
      tableroRival[y][x] = 2; // Impacto

      // Verificar si se hundió el barco completo
      const hundido = barcoImpactado.celdas.every(c => c.tocado);
      if (hundido) barcoImpactado.hundido = true;

      // Verificar si se hundió toda la flota rival
      const todaFlotaHundida = flotaRival.every(b => b.hundido);

      if (todaFlotaHundida) {
        this.fase = "fin";
        this.ganador = jugadorId;
        this.ultimoEvento = {
          tipo: "VICTORIA",
          por: jugadorId,
          x, y,
          resultado: "victoria",
          barco: barcoImpactado.nombre
        };
      } else {
        this.ultimoEvento = {
          tipo: "DISPARO",
          por: jugadorId,
          x, y,
          resultado: hundido ? "hundido" : "impacto",
          barco: barcoImpactado.nombre
        };
        // Al acertar, mantiene turno (regla clásica)
      }
      return { ok: true, resultado: hundido ? "hundido" : "impacto", barco: barcoImpactado.nombre };
    } else {
      tableroRival[y][x] = 1; // Agua
      this.turno = rivalId;   // Cambio de turno
      this.ultimoEvento = {
        tipo: "DISPARO",
        por: jugadorId,
        x, y,
        resultado: "agua",
        siguienteTurno: rivalId
      };
      return { ok: true, resultado: "agua" };
    }
  }

  pedirRevancha(jugadorId) {
    if (!this.ganador) return;
    this.revancha[jugadorId] = true;
    if (this.revancha[1] && this.revancha[2]) {
      this.reiniciarTodo();
    }
  }

  // Genera snapshot con niebla de guerra respetada según el jugador
  snapshot(paraJugadorId) {
    this.seq = (this.seq + 1) & 0xffff;
    const rivalId = paraJugadorId === 1 ? 2 : 1;

    // Tus barcos completos
    const miFlota = this.flotas[paraJugadorId] || [];

    // Flota rival: solo revelar barcos hundidos (o todos si terminó la partida)
    const flotaRivalRevelada = (this.flotas[rivalId] || []).map(b => {
      if (this.fase === "fin" || b.hundido) {
        return { ...b };
      }
      return {
        id: b.id,
        nombre: b.nombre,
        tam: b.tam,
        hundido: b.hundido
        // Ocultar x, y, horiz, celdas
      };
    });

    return {
      seq: this.seq,
      fase: this.fase,
      listos: this.listos,
      turno: this.turno,
      ganador: this.ganador,
      revancha: this.revancha,
      miFlota,
      flotaRival: flotaRivalRevelada,
      misDisparosRecibidos: this.disparos[paraJugadorId],
      disparosAlRival: this.disparos[rivalId],
      ultimoEvento: this.ultimoEvento
    };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { BattleshipSim, BATTLESHIP };
}
