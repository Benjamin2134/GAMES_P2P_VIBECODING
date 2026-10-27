// ==========================================================================
//  Simulacion de MEMORICE (turnos). 30 cartas boca abajo = 15 pares.
//  En tu turno das vuelta dos: si son pareja te las llevas y sigues; si no,
//  se ven 1,2 s, vuelven boca abajo y pasa el turno. Gana quien junta mas.
//  La vista solo trae la cara de las cartas que estan a la vista (Fair Play).
// ==========================================================================
const MEMO = {
  CARAS: ["🍎", "🍌", "🍇", "🍉", "🍒", "🍓", "🥝", "🍍", "🥥", "🥑", "🍋", "🍑", "🥕", "🌽", "🍄"],
  COLS: 6, FILAS: 5, ESPERA: 1.2,
};

class MemoriceSim extends SimBase {
  constructor(o) {
    super(o);
    const mazo = [];
    for (let k = 0; k < 15; k++) mazo.push(k, k);
    this.cartas = Kit.mezclar(mazo);
    this.dueno = Array(30).fill(0);
    this.arriba = [];
    this.espera = 0;
    this.turno = this.primero;
    this.puntos = { 1: 0, 2: 0 };
  }
  step(dt) {
    if (this.espera > 0) {
      this.espera -= dt;
      if (this.espera <= 0) { this.espera = 0; this.arriba = []; this.turno = Kit.otro(this.turno); }
    }
  }
  accion(j, a) {
    if (j !== this.turno || this.espera > 0 || this.arriba.length >= 2) return;
    const i = Kit.ent(a.i, 0, 29);
    if (i === null || this.dueno[i] || this.arriba.includes(i)) return;
    this.arriba.push(i);
    this.emitir("voltea", { i });
    if (this.arriba.length < 2) return;
    const [x, y] = this.arriba;
    if (this.cartas[x] === this.cartas[y]) {
      this.dueno[x] = j; this.dueno[y] = j; this.puntos[j]++;
      this.arriba = [];
      this.emitir("par", { j, i: x, k: y });
      if (this.puntos[1] + this.puntos[2] === 15) this.terminar(this.puntos[1] > this.puntos[2] ? 1 : 2);
    } else {
      this.espera = MEMO.ESPERA;
      this.emitir("fallo", { j });
    }
  }
  vista(r) {
    return {
      ...this.base(r),
      cartas: this.cartas.map((c, i) => (this.dueno[i] || this.arriba.includes(i) ? c : -1)),
      dueno: this.dueno.slice(), arriba: this.arriba.slice(), espera: this.espera > 0,
      turno: this.turno, puntos: { ...this.puntos },
    };
  }
}
Kit.SIMS.memorice = MemoriceSim;
