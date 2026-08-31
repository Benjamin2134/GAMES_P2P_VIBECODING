// ==========================================================================
//  Simulación autoritativa de MONOPOLY DUEL (corre en Host).
//  Tablero perimetral de 24 casillas, distritos, compras, casas, cárcel y bancarrota.
// ==========================================================================

const MONOPOLY = {
  W: 960,
  H: 600,
  DINERO_INICIAL: 1500,
  META_PATRIMONIO: 3500,
  PASAJE_SALIDA: 200,
  FIANZA_CARCEL: 50,
  TOTAL_CASILLAS: 24,

  // Definición de las 24 casillas
  CASILLAS: [
    { idx: 0,  t: "salida",   nombre: "SALIDA",              col: "#2ecc71" },
    { idx: 1,  t: "calle",    nombre: "Calle Lavalle",       col: "#8d6e63", precio: 60,  renta: [10, 30, 70, 150], casa: 50,  grupo: "marron" },
    { idx: 2,  t: "suerte",   nombre: "SUERTE",              col: "#f39c12" },
    { idx: 3,  t: "calle",    nombre: "Av. Corrientes",      col: "#8d6e63", precio: 80,  renta: [15, 45, 100, 200], casa: 50,  grupo: "marron" },
    { idx: 4,  t: "impuesto", nombre: "Impuesto",            col: "#e74c3c", valor: 75 },
    { idx: 5,  t: "estacion", nombre: "Estación Central",    col: "#bdc3c7", precio: 150, rentaBase: 25 },
    { idx: 6,  t: "carcel",   nombre: "CÁRCEL / VISITA",     col: "#e67e22" },
    { idx: 7,  t: "calle",    nombre: "Av. Santa Fe",        col: "#00e5ff", precio: 100, renta: [20, 60, 130, 250], casa: 75,  grupo: "cian" },
    { idx: 8,  t: "calle",    nombre: "Paseo Costero",       col: "#00e5ff", precio: 120, renta: [25, 75, 160, 300], casa: 75,  grupo: "cian" },
    { idx: 9,  t: "suerte",   nombre: "SUERTE",              col: "#f39c12" },
    { idx: 10, t: "calle",    nombre: "Av. San Martín",      col: "#e91e63", precio: 140, renta: [30, 90, 190, 350], casa: 100, grupo: "magenta" },
    { idx: 11, t: "estacion", nombre: "Estación Norte",      col: "#bdc3c7", precio: 150, rentaBase: 25 },
    { idx: 12, t: "parking",  nombre: "PARKING LIBRE",       col: "#3498db" },
    { idx: 13, t: "calle",    nombre: "Av. Belgrano",        col: "#e91e63", precio: 160, renta: [35, 105, 220, 400], casa: 100, grupo: "magenta" },
    { idx: 14, t: "calle",    nombre: "Av. Libertador",      col: "#ff9800", precio: 180, renta: [40, 120, 250, 450], casa: 125, grupo: "naranja" },
    { idx: 15, t: "suerte",   nombre: "SUERTE",              col: "#f39c12" },
    { idx: 16, t: "calle",    nombre: "Av. 9 de Julio",      col: "#ff9800", precio: 200, renta: [45, 135, 280, 500], casa: 125, grupo: "naranja" },
    { idx: 17, t: "estacion", nombre: "Estación Sur",        col: "#bdc3c7", precio: 150, rentaBase: 25 },
    { idx: 18, t: "ir_carcel",nombre: "VE A LA CÁRCEL",      col: "#c0392b" },
    { idx: 19, t: "calle",    nombre: "Av. Alvear",          col: "#f44336", precio: 220, renta: [50, 150, 320, 600], casa: 150, grupo: "rojo" },
    { idx: 20, t: "calle",    nombre: "Av. Quintana",        col: "#f44336", precio: 240, renta: [55, 165, 350, 650], casa: 150, grupo: "rojo" },
    { idx: 21, t: "impuesto", nombre: "Tasa Bancaria",       col: "#e74c3c", valor: 100 },
    { idx: 22, t: "estacion", nombre: "Estación Oeste",      col: "#bdc3c7", precio: 150, rentaBase: 25 },
    { idx: 23, t: "calle",    nombre: "Paseo del Puerto",    col: "#1a237e", precio: 350, renta: [90, 270, 550, 950], casa: 200, grupo: "azul" }
  ]
};

class MonopolySim {
  constructor() {
    this.reiniciarTodo();
    this.seq = 0;
  }

  reiniciarTodo() {
    this.jugadores = {
      1: { dinero: MONOPOLY.DINERO_INICIAL, pos: 0, enCarcel: false, turnosCarcel: 0 },
      2: { dinero: MONOPOLY.DINERO_INICIAL, pos: 0, enCarcel: false, turnosCarcel: 0 }
    };
    // Casillas compradas: idx -> { duenio: 1|2, casas: 0..3 }
    this.propiedades = {};
    this.turno = 1;
    this.faseTurno = "tirar"; // "tirar" | "accion" | "fin"
    this.dados = [1, 1];
    this.dobles = false;
    this.boteParking = 100;
    this.ganador = 0;
    this.revancha = { 1: false, 2: false };
    this.ultimoEvento = { msg: "¡Comienza el duelo inmobiliario!", tipo: "info" };
  }

  pedirRevancha(id) {
    if (!this.ganador) return;
    this.revancha[id] = true;
    if (this.revancha[1] && this.revancha[2]) {
      this.reiniciarTodo();
    }
  }

  // Tirar dados
  tirarDados(jugadorId) {
    if (this.ganador) return { ok: false, msg: "Partida finalizada" };
    if (this.turno !== jugadorId) return { ok: false, msg: "No es tu turno" };
    if (this.faseTurno !== "tirar") return { ok: false, msg: "Ya tiraste dados este turno" };

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    this.dados = [d1, d2];
    this.dobles = (d1 === d2);
    const suma = d1 + d2;

    const j = this.jugadores[jugadorId];

    // Manejo si está en la cárcel
    if (j.enCarcel) {
      if (this.dobles) {
        j.enCarcel = false;
        j.turnosCarcel = 0;
        this.ultimoEvento = { msg: `Jugador ${jugadorId} sacó dobles (${d1}-${d2}) y sale de la cárcel!`, tipo: "suerte" };
      } else {
        j.turnosCarcel++;
        if (j.turnosCarcel >= 3) {
          // Pagar fianza obligatoria
          this._cobrar(jugadorId, MONOPOLY.FIANZA_CARCEL);
          j.enCarcel = false;
          j.turnosCarcel = 0;
          this.ultimoEvento = { msg: `Jugador ${jugadorId} paga $50 de fianza y queda libre.`, tipo: "info" };
        } else {
          this.ultimoEvento = { msg: `Jugador ${jugadorId} sigue en la cárcel (${j.turnosCarcel}/3 turnos).`, tipo: "carcel" };
          this.pasarTurno(jugadorId);
          return { ok: true, dados: this.dados, avanzo: 0 };
        }
      }
    }

    // Avanzar casilla
    const posPrevia = j.pos;
    j.pos = (j.pos + suma) % MONOPOLY.TOTAL_CASILLAS;

    // Pasó por la salida
    if (j.pos < posPrevia || (posPrevia + suma >= MONOPOLY.TOTAL_CASILLAS)) {
      j.dinero += MONOPOLY.PASAJE_SALIDA;
      this.ultimoEvento = { msg: `Jugador ${jugadorId} pasó por la SALIDA y cobró $200!`, tipo: "dinero" };
    }

    // Resolver casilla
    this._resolverCasilla(jugadorId);
    return { ok: true, dados: this.dados, pos: j.pos };
  }

  _resolverCasilla(jugadorId) {
    const j = this.jugadores[jugadorId];
    const casilla = MONOPOLY.CASILLAS[j.pos];
    const rivalId = jugadorId === 1 ? 2 : 1;

    if (casilla.t === "calle" || casilla.t === "estacion") {
      const prop = this.propiedades[casilla.idx];
      if (!prop) {
        // Propiedad libre -> Puede comprar
        this.faseTurno = "accion";
        this.ultimoEvento = { msg: `Jugador ${jugadorId} cayó en ${casilla.nombre} (Libre: $${casilla.precio})`, tipo: "propiedad" };
      } else if (prop.duenio === rivalId) {
        // Propiedad del rival -> Pagar alquiler
        const renta = this._calcularRenta(casilla.idx);
        this._transferir(jugadorId, rivalId, renta);
        this.faseTurno = "accion";
        this.ultimoEvento = { msg: `Jugador ${jugadorId} pagó $${renta} de alquiler a Jugador ${rivalId} en ${casilla.nombre}!`, tipo: "pago" };
      } else {
        // Propiedad propia -> Puede construir si tiene monopolio
        this.faseTurno = "accion";
        this.ultimoEvento = { msg: `Jugador ${jugadorId} visitó su propiedad ${casilla.nombre}.`, tipo: "info" };
      }
    } else if (casilla.t === "impuesto") {
      this._cobrar(jugadorId, casilla.valor);
      this.boteParking += casilla.valor;
      this.faseTurno = "accion";
      this.ultimoEvento = { msg: `Jugador ${jugadorId} pagó $${casilla.valor} en impuestos al Parking.`, tipo: "pago" };
    } else if (casilla.t === "parking") {
      if (this.boteParking > 0) {
        j.dinero += this.boteParking;
        this.ultimoEvento = { msg: `¡PREMIO! Jugador ${jugadorId} se llevó el bote de $${this.boteParking} del Parking Libre!`, tipo: "suerte" };
        this.boteParking = 50;
      }
      this.faseTurno = "accion";
    } else if (casilla.t === "ir_carcel") {
      j.pos = 6; // Cárcel
      j.enCarcel = true;
      j.turnosCarcel = 0;
      this.faseTurno = "accion";
      this.ultimoEvento = { msg: `¡ATRAPADO! Jugador ${jugadorId} fue enviado a la CÁRCEL.`, tipo: "carcel" };
    } else if (casilla.t === "suerte") {
      this._aplicarTarjetaSuerte(jugadorId);
      this.faseTurno = "accion";
    } else {
      this.faseTurno = "accion";
    }

    this._verificarVictoria();
  }

  _aplicarTarjetaSuerte(jugadorId) {
    const j = this.jugadores[jugadorId];
    const cartas = [
      { msg: "¡Dividendos de inversión! Cobras $120.", fn: () => j.dinero += 120 },
      { msg: "¡Multa por exceso de velocidad! Pagas $50.", fn: () => this._cobrar(jugadorId, 50) },
      { msg: "¡Es tu cumpleaños! El rival te regala $60.", fn: () => this._transferir(jugadorId === 1 ? 2 : 1, jugadorId, 60) },
      { msg: "¡Mantenimiento de propiedades! Pagas $40.", fn: () => this._cobrar(jugadorId, 40) },
      { msg: "¡Lotería exprés! Cobras $150.", fn: () => j.dinero += 150 }
    ];
    const c = cartas[Math.floor(Math.random() * cartas.length)];
    c.fn();
    this.ultimoEvento = { msg: `SUERTE: ${c.msg}`, tipo: "suerte" };
  }

  comprarPropiedad(jugadorId) {
    if (this.faseTurno !== "accion" || this.turno !== jugadorId) return false;
    const j = this.jugadores[jugadorId];
    const casilla = MONOPOLY.CASILLAS[j.pos];

    if (!casilla || (casilla.t !== "calle" && casilla.t !== "estacion")) return false;
    if (this.propiedades[casilla.idx]) return false; // Ya tiene dueño
    if (j.dinero < casilla.precio) return false;      // No le alcanza

    j.dinero -= casilla.precio;
    this.propiedades[casilla.idx] = { duenio: jugadorId, casas: 0 };
    this.ultimoEvento = { msg: `¡Jugador ${jugadorId} compró ${casilla.nombre} por $${casilla.precio}!`, tipo: "compra" };

    this._verificarVictoria();
    return true;
  }

  construirCasa(jugadorId, casillaIdx) {
    const prop = this.propiedades[casillaIdx];
    const casilla = MONOPOLY.CASILLAS[casillaIdx];
    const j = this.jugadores[jugadorId];

    if (!prop || prop.duenio !== jugadorId || casilla.t !== "calle") return false;
    if (prop.casas >= 3) return false; // Máximo 3 casas
    if (j.dinero < casilla.casa) return false;

    j.dinero -= casilla.casa;
    prop.casas++;
    this.ultimoEvento = { msg: `¡Jugador ${jugadorId} construyó una mejora en ${casilla.nombre} (Nivel ${prop.casas})!`, tipo: "construccion" };

    this._verificarVictoria();
    return true;
  }

  pasarTurno(jugadorId) {
    if (this.turno !== jugadorId) return false;

    // Si sacó dobles y no está en cárcel, repite turno
    if (this.dobles && !this.jugadores[jugadorId].enCarcel) {
      this.faseTurno = "tirar";
      this.dobles = false;
      this.ultimoEvento = { msg: `¡Dobles! Jugador ${jugadorId} tira de nuevo.`, tipo: "suerte" };
    } else {
      this.turno = jugadorId === 1 ? 2 : 1;
      this.faseTurno = "tirar";
      this.dobles = false;
    }
    return true;
  }

  _calcularRenta(casillaIdx) {
    const prop = this.propiedades[casillaIdx];
    const c = MONOPOLY.CASILLAS[casillaIdx];
    if (!prop) return 0;

    if (c.t === "calle") {
      const rentaNivel = c.renta[prop.casas] || c.renta[0];
      // Si tiene monopolio del grupo de color, duplica renta base si no tiene casas
      const tieneMonopolio = this._tieneMonopolio(prop.duenio, c.grupo);
      if (tieneMonopolio && prop.casas === 0) return rentaNivel * 2;
      return rentaNivel;
    } else if (c.t === "estacion") {
      // Contar cuántas estaciones tiene el dueño
      const ests = [5, 11, 17, 22].filter(idx => this.propiedades[idx] && this.propiedades[idx].duenio === prop.duenio).length;
      return c.rentaBase * Math.pow(2, Math.max(0, ests - 1));
    }
    return 0;
  }

  _tieneMonopolio(jugadorId, grupo) {
    if (!grupo) return false;
    const casillasGrupo = MONOPOLY.CASILLAS.filter(c => c.grupo === grupo);
    return casillasGrupo.every(c => this.propiedades[c.idx] && this.propiedades[c.idx].duenio === jugadorId);
  }

  _cobrar(jugadorId, monto) {
    const j = this.jugadores[jugadorId];
    j.dinero -= monto;
    if (j.dinero < 0) {
      this.ganador = jugadorId === 1 ? 2 : 1;
      this.ultimoEvento = { msg: `¡BANCARROTA! Jugador ${jugadorId} no pudo pagar y quedó eliminado.`, tipo: "bancarrota" };
    }
  }

  _transferir(deId, aId, monto) {
    this._cobrar(deId, monto);
    if (this.jugadores[deId].dinero >= 0) {
      this.jugadores[aId].dinero += monto;
    }
  }

  _calcularPatrimonio(jugadorId) {
    const j = this.jugadores[jugadorId];
    let pat = j.dinero;
    for (const idx in this.propiedades) {
      const p = this.propiedades[idx];
      if (p.duenio === jugadorId) {
        const c = MONOPOLY.CASILLAS[idx];
        pat += (c.precio || 0) + (p.casas * (c.casa || 0));
      }
    }
    return pat;
  }

  _verificarVictoria() {
    if (this.ganador) return;

    for (let id = 1; id <= 2; id++) {
      if (this.jugadores[id].dinero <= 0) {
        this.ganador = id === 1 ? 2 : 1;
        return;
      }
      const pat = this._calcularPatrimonio(id);
      if (pat >= MONOPOLY.META_PATRIMONIO) {
        this.ganador = id;
        this.ultimoEvento = { msg: `¡DOMINIO TOTAL! Jugador ${id} alcanzó $${pat} de patrimonio neto y gana la partida!`, tipo: "victoria" };
        return;
      }
    }
  }

  snapshot() {
    this.seq = (this.seq + 1) & 0xffff;
    return {
      seq: this.seq,
      j1: { ...this.jugadores[1], pat: this._calcularPatrimonio(1) },
      j2: { ...this.jugadores[2], pat: this._calcularPatrimonio(2) },
      props: this.propiedades,
      turno: this.turno,
      fase: this.faseTurno,
      dados: this.dados,
      dobles: this.dobles,
      parking: this.boteParking,
      ganador: this.ganador,
      rev1: this.revancha[1],
      rev2: this.revancha[2],
      evento: this.ultimoEvento
    };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { MonopolySim, MONOPOLY };
}
