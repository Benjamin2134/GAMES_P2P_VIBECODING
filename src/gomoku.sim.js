// ==========================================================================
//  Simulacion de GOMOKU (turnos). Tablero 15x15, piedras en las
//  intersecciones. Gana quien alinea cinco o mas (estilo libre).
// ==========================================================================
const GK = {
  N: 15,
  // Celdas de la linea de 5+ que pasa por i, o null.
  linea(tab, i) {
    const j = tab[i], N = GK.N, f = Math.floor(i / N), c = i % N;
    if (!j) return null;
    for (const [df, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const cel = [i];
      for (const s of [1, -1]) {
        let ff = f + df * s, cc = c + dc * s;
        while (ff >= 0 && ff < N && cc >= 0 && cc < N && tab[ff * N + cc] === j) { cel.push(ff * N + cc); ff += df * s; cc += dc * s; }
      }
      if (cel.length >= 5) return cel;
    }
    return null;
  },
};

class GomokuSim extends SimBase {
  constructor(o) {
    super(o);
    this.tab = Array(GK.N * GK.N).fill(0);
    this.turno = this.primero;
    this.ult = -1;
    this.linea = null;
    this.n = 0;
  }
  accion(j, a) {
    if (j !== this.turno) return;
    const i = Kit.ent(a.i, 0, GK.N * GK.N - 1);
    if (i === null || this.tab[i]) return;
    this.tab[i] = j; this.ult = i; this.n++;
    this.emitir("piedra", { i, j });
    const l = GK.linea(this.tab, i);
    if (l) { this.linea = l; this.terminar(j); }
    else if (this.n >= GK.N * GK.N) this.terminar(3);
    else this.turno = Kit.otro(j);
  }
  vista(r) {
    return { ...this.base(r), tab: this.tab.slice(), turno: this.turno, ult: this.ult, linea: this.linea };
  }
}
Kit.SIMS.gomoku = GomokuSim;
