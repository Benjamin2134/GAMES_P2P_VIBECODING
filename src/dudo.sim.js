// ==========================================================================
//  Simulacion de DUDO / CACHO (turnos, info oculta), reglas chilenas a 2:
//  - Cada uno con 5 dados bajo el cacho. Se apuesta "hay al menos Q dados de
//    la pinta C" contando los de ambos. Los ases (1) son comodines.
//  - Subir: mas cantidad, o misma cantidad y pinta mayor.
//    Pasar a ases: cantidad >= mitad + 1. Salir de ases: cantidad >= doble + 1.
//    No se abre con ases (salvo que te quede 1 dado).
//  - "Dudo": se levantan los cachos. Si hay al menos Q, pierde un dado el que
//    dudo; si no, el que aposto. "Calzo": si hay exactamente Q, recuperas un
//    dado (max 5); si no, pierdes uno. El que pierde abre la ronda siguiente.
//  - Pierde quien se queda sin dados.
// ==========================================================================
const DUDO = {
  MAX: 5,
  valida(prev, q, c, propios) {
    if (!Number.isInteger(q) || !Number.isInteger(c) || q < 1 || c < 1 || c > 6) return false;
    if (!prev) return c !== 1 || propios === 1;
    const q0 = prev.q, c0 = prev.c;
    if (c0 !== 1 && c !== 1) return q > q0 || (q === q0 && c > c0);
    if (c0 !== 1 && c === 1) return q >= Math.floor(q0 / 2) + 1;
    if (c0 === 1 && c === 1) return q > q0;
    return q >= q0 * 2 + 1;
  },
  // Cantidad minima valida para la pinta c sobre la apuesta anterior.
  minima(prev, c, propios) {
    for (let q = 1; q <= 30; q++) if (DUDO.valida(prev, q, c, propios)) return q;
    return 99;
  },
  cuenta: (dados, c) => dados.filter((d) => d === c || (c !== 1 && d === 1)).length,
  tirar: (n) => Array.from({ length: n }, () => Kit.ri(1, 6)).sort((a, b) => a - b),
};

class DudoSim extends SimBase {
  constructor(o) {
    super(o);
    this.n = { 1: DUDO.MAX, 2: DUDO.MAX };
    this.empieza = this.primero;
    this.ronda = 0;
    this.nuevaRonda();
  }
  nuevaRonda() {
    this.dados = { 1: DUDO.tirar(this.n[1]), 2: DUDO.tirar(this.n[2]) };
    this.apuesta = null;
    this.turno = this.empieza;
    this.fase = "apuesta";
    this.res = null;
    this.ronda++;
    this.emitir("tira", { ronda: this.ronda });
  }
  step(dt) {
    if (this.fase !== "revela") return;
    this.espera -= dt;
    if (this.espera > 0) return;
    if (!this.n[1]) this.terminar(2);
    else if (!this.n[2]) this.terminar(1);
    else this.nuevaRonda();
  }
  accion(j, a) {
    if (this.fase !== "apuesta" || j !== this.turno) return;
    const todos = this.dados[1].concat(this.dados[2]);
    if (a.dudo || a.calzo) {
      if (!this.apuesta) return;
      const { q, c } = this.apuesta, hay = DUDO.cuenta(todos, c);
      let pierde = 0, gana = 0;
      if (a.dudo) pierde = hay >= q ? j : this.apuesta.j;
      else if (hay === q) gana = j;
      else pierde = j;
      if (pierde) this.n[pierde]--;
      if (gana) this.n[gana] = Math.min(DUDO.MAX, this.n[gana] + 1);
      this.res = { tipo: a.dudo ? "dudo" : "calzo", quien: j, hay, apuesta: this.apuesta, pierde, gana, dados: { 1: this.dados[1].slice(), 2: this.dados[2].slice() } };
      this.empieza = pierde || j;
      this.fase = "revela";
      this.espera = 4.5;
      this.emitir(a.dudo ? "dudo" : "calzo", { j, pierde, gana });
      return;
    }
    const q = Kit.ent(a.q, 1, todos.length), c = Kit.ent(a.c, 1, 6);
    if (q === null || c === null || !DUDO.valida(this.apuesta, q, c, this.n[j])) return;
    this.apuesta = { q, c, j };
    this.turno = Kit.otro(j);
    this.emitir("apuesta", { j, q, c });
  }
  vista(r) {
    const o = Kit.otro(r);
    return {
      ...this.base(r), mios: this.dados[r].slice(), nMio: this.n[r], nRival: this.n[o], n: { ...this.n },
      apuesta: this.apuesta, turno: this.turno, fase: this.fase, ronda: this.ronda,
      res: this.fase === "revela" ? this.res : null,
    };
  }
}
Kit.SIMS.dudo = DudoSim;
