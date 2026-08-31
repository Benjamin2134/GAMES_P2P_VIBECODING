// ==========================================================================
//  Simulación autoritativa de CYBER TRON / LIGHTCYCLES (corre en Host a 120 Hz).
//  Física de motos de luz en 90°, estelas vectoriales continuas y turbo.
// ==========================================================================

const TRON = {
  W: 1000,
  H: 600,
  VEL_BASE: 260,        // px / seg
  VEL_TURBO: 420,       // px / seg
  TURBO_MAX: 100,
  TURBO_GASTO: 50,      // unidades / seg
  TURBO_RECARGA: 22,    // unidades / seg
  RONDAS_GANAR: 5,
  PAUSA_RONDA_S: 1.8,
  COL_P1: "#00f0ff",
  COL_P2: "#ff0055"
};

const DIR_VECS = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
  E: { x: 1, y: 0 }
};

const OPUESTO = { N: "S", S: "N", W: "E", E: "W" };

class TronSim {
  constructor() {
    this.reiniciarTodo();
    this.seq = 0;
  }

  reiniciarTodo() {
    this.puntos = { 1: 0, 2: 0 };
    this.ganador = 0;
    this.revancha = { 1: false, 2: false };
    this.iniciarRonda();
  }

  iniciarRonda() {
    const yIni = TRON.H / 2;
    this.motos = {
      1: { x: 160, y: yIni, dir: "E", dirPendiente: "E", turbo: false, turboVal: TRON.TURBO_MAX, viva: true },
      2: { x: TRON.W - 160, y: yIni, dir: "W", dirPendiente: "W", turbo: false, turboVal: TRON.TURBO_MAX, viva: true }
    };
    this.estelas = {
      1: [{ x: 160, y: yIni }],
      2: [{ x: TRON.W - 160, y: yIni }]
    };
    this.pausaRonda = TRON.PAUSA_RONDA_S;
    this.sirviendo = true;
    this.reinicioEn = 0;
    this.explosiones = [];
  }

  aplicarInputHost(inp) { this._procesarInput(1, inp); }
  aplicarInputGuest(inp) { this._procesarInput(2, inp); }

  _procesarInput(id, inp) {
    const m = this.motos[id];
    if (!m || !m.viva) return;

    if (inp.dir && DIR_VECS[inp.dir] && inp.dir !== OPUESTO[m.dir]) {
      m.dirPendiente = inp.dir;
    }
    m.turbo = !!inp.turbo;
  }

  pedirRevancha(id) {
    if (!this.ganador) return;
    this.revancha[id] = true;
    if (this.revancha[1] && this.revancha[2]) {
      this.reiniciarTodo();
    }
  }

  step(dt) {
    if (this.ganador) return;

    if (this.reinicioEn > 0) {
      this.reinicioEn -= dt;
      if (this.reinicioEn <= 0 && !this.ganador) {
        this.iniciarRonda();
      }
      return;
    }

    if (this.sirviendo) {
      this.pausaRonda -= dt;
      if (this.pausaRonda <= 0) {
        this.sirviendo = false;
      }
      return;
    }

    const colisiones = { 1: false, 2: false };

    for (let id = 1; id <= 2; id++) {
      const m = this.motos[id];
      if (!m.viva) continue;

      // Giro en 90°
      if (m.dirPendiente !== m.dir && m.dirPendiente !== OPUESTO[m.dir]) {
        m.dir = m.dirPendiente;
        this.estelas[id].push({ x: m.x, y: m.y });
      }

      let vel = TRON.VEL_BASE;
      if (m.turbo && m.turboVal > 5) {
        vel = TRON.VEL_TURBO;
        m.turboVal = Math.max(0, m.turboVal - TRON.TURBO_GASTO * dt);
      } else {
        m.turboVal = Math.min(TRON.TURBO_MAX, m.turboVal + TRON.TURBO_RECARGA * dt);
      }

      const vec = DIR_VECS[m.dir];
      const prevX = m.x, prevY = m.y;
      m.x += vec.x * vel * dt;
      m.y += vec.y * vel * dt;

      // Límites de arena
      if (m.x <= 8 || m.x >= TRON.W - 8 || m.y <= 8 || m.y >= TRON.H - 8) {
        colisiones[id] = true;
        continue;
      }

      const cabezaSeg = { p1: { x: prevX, y: prevY }, p2: { x: m.x, y: m.y } };
      const rivalId = id === 1 ? 2 : 1;

      // Colisión contra estela del rival
      if (this._colisionaConEstela(cabezaSeg, rivalId, false)) {
        colisiones[id] = true;
        continue;
      }

      // Colisión contra propia estela
      if (this._colisionaConEstela(cabezaSeg, id, true)) {
        colisiones[id] = true;
        continue;
      }
    }

    // Colisión frontal directa entre motos
    const distMotos = Math.hypot(this.motos[1].x - this.motos[2].x, this.motos[1].y - this.motos[2].y);
    if (distMotos < 18) {
      colisiones[1] = true;
      colisiones[2] = true;
    }

    if (colisiones[1] || colisiones[2]) {
      if (colisiones[1]) this.destruirMoto(1);
      if (colisiones[2]) this.destruirMoto(2);

      if (colisiones[1] && colisiones[2]) {
        // Empate en ronda
      } else if (colisiones[1]) {
        this.puntos[2]++;
      } else if (colisiones[2]) {
        this.puntos[1]++;
      }

      if (this.puntos[1] >= TRON.RONDAS_GANAR) this.ganador = 1;
      else if (this.puntos[2] >= TRON.RONDAS_GANAR) this.ganador = 2;
      else {
        this.reinicioEn = 1.2;
      }
    }
  }

  destruirMoto(id) {
    this.motos[id].viva = false;
    this.explosiones.push({
      x: this.motos[id].x,
      y: this.motos[id].y,
      col: id === 1 ? TRON.COL_P1 : TRON.COL_P2
    });
  }

  _colisionaConEstela(segCabeza, idEstela, esPropia) {
    const pts = this.estelas[idEstela];
    const m = this.motos[idEstela];
    if (!pts || pts.length === 0) return false;

    const todos = [...pts, { x: m.x, y: m.y }];
    // Si es la propia estela, ignoramos los 2 últimos segmentos más cercanos a la cabeza
    const limite = esPropia ? todos.length - 2 : todos.length - 1;

    for (let i = 0; i < limite; i++) {
      const pA = todos[i];
      const pB = todos[i + 1];
      if (this._interseccionSegmentos(segCabeza.p1, segCabeza.p2, pA, pB)) {
        return true;
      }
    }
    return false;
  }

  _interseccionSegmentos(a, b, c, d) {
    const ccw = (p1, p2, p3) => (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
    const r1 = ccw(a, c, d);
    const r2 = ccw(b, c, d);
    const r3 = ccw(a, b, c);
    const r4 = ccw(a, b, d);
    return (r1 !== r2) && (r3 !== r4);
  }

  snapshot() {
    this.seq = (this.seq + 1) & 0xffff;
    const m1 = this.motos[1], m2 = this.motos[2];

    return {
      seq: this.seq,
      m1: { x: Math.round(m1.x), y: Math.round(m1.y), dir: m1.dir, turbo: m1.turbo, tb: Math.round(m1.turboVal), viva: m1.viva },
      m2: { x: Math.round(m2.x), y: Math.round(m2.y), dir: m2.dir, turbo: m2.turbo, tb: Math.round(m2.turboVal), viva: m2.viva },
      e1: this.estelas[1],
      e2: this.estelas[2],
      p1: this.puntos[1],
      p2: this.puntos[2],
      sirviendo: this.sirviendo,
      cuenta: Math.max(0, Math.ceil(this.pausaRonda)),
      ganador: this.ganador,
      rev1: this.revancha[1],
      rev2: this.revancha[2],
      expl: this.explosiones.length ? this.explosiones.splice(0) : null
    };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { TronSim, TRON };
}
