// ==========================================================================
//  Simulacion de CONECTA 4 (turnos). Tablero 7x6, la ficha cae por gravedad.
//  Gana quien alinea 4 (horizontal, vertical o diagonal). Tablero lleno = empate.
//  Reglas puras en C4 (las usa tambien el bot).
// ==========================================================================
const C4 = {
  COLS: 7, FILAS: 6,
  // tablero plano de 42: indice = fila * 7 + col, fila 0 arriba
  caer(tab, c) {
    for (let f = 5; f >= 0; f--) if (!tab[f * 7 + c]) return f;
    return -1;
  },
  // Devuelve las celdas [f, c] de la linea ganadora que pasa por (f, c), o null.
  linea(tab, f, c) {
    const j = tab[f * 7 + c];
    if (!j) return null;
    for (const [df, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const celdas = [[f, c]];
      for (const s of [1, -1]) {
        let ff = f + df * s, cc = c + dc * s;
        while (ff >= 0 && ff < 6 && cc >= 0 && cc < 7 && tab[ff * 7 + cc] === j) {
          celdas.push([ff, cc]); ff += df * s; cc += dc * s;
        }
      }
      if (celdas.length >= 4) return celdas;
    }
    return null;
  },
  lleno(tab) { for (let c = 0; c < 7; c++) if (!tab[c]) return false; return true; },
};

class Conecta4Sim extends SimBase {
  constructor(o) {
    super(o);
    this.tab = Array(42).fill(0);
    this.turno = this.primero;
    this.ult = null;
    this.linea = null;
  }
  accion(j, a) {
    if (j !== this.turno) return;
    const c = Kit.ent(a.col, 0, 6);
    if (c === null) return;
    const f = C4.caer(this.tab, c);
    if (f < 0) return;
    this.tab[f * 7 + c] = j;
    this.ult = { c, f };
    this.emitir("ficha", { c, f, j });
    const l = C4.linea(this.tab, f, c);
    if (l) { this.linea = l; this.terminar(j); }
    else if (C4.lleno(this.tab)) this.terminar(3);
    else this.turno = Kit.otro(j);
  }
  vista(r) {
    return { ...this.base(r), tab: this.tab.slice(), turno: this.turno, ult: this.ult, linea: this.linea };
  }
}
Kit.SIMS.conecta4 = Conecta4Sim;
