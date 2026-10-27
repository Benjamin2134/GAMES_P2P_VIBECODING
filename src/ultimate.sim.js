// ==========================================================================
//  Simulacion de TRES EN RAYA ULTIMATE (turnos). Un 3x3 de tableros 3x3.
//  La casilla donde juegas decide en que tablero chico juega el rival; si
//  ese tablero ya esta decidido, el rival elige cualquiera. Ganar un chico =
//  tenerlo en el tablero grande. Gana quien hace 3 en raya de tableros.
//  tab[81]: indice = tablero * 9 + casilla. gane[9]: 0, 1, 2 o 3 (empate).
// ==========================================================================
const UT = {
  LINEAS: [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]],
  tres(a, j) { return UT.LINEAS.some((l) => a[l[0]] === j && a[l[1]] === j && a[l[2]] === j); },
  // Casillas jugables: [tablero, casilla]
  movs(tab, gane, activo) {
    const res = [];
    for (let b = 0; b < 9; b++) {
      if (gane[b] || (activo >= 0 && b !== activo)) continue;
      for (let k = 0; k < 9; k++) if (!tab[b * 9 + k]) res.push([b, k]);
    }
    return res;
  },
  // Aplica sobre copias; devuelve el estado nuevo y el resultado global (0 sigue).
  jugar(s, b, k, j) {
    const tab = s.tab.slice(), gane = s.gane.slice();
    tab[b * 9 + k] = j;
    const chico = tab.slice(b * 9, b * 9 + 9);
    if (UT.tres(chico, j)) gane[b] = j;
    else if (chico.every((x) => x)) gane[b] = 3;
    const activo = gane[k] ? -1 : k;
    let res = 0;
    if (UT.tres(gane, j)) res = j;
    else if (!UT.movs(tab, gane, activo).length) res = 3;
    return { tab, gane, activo, res };
  },
};

class UltimateSim extends SimBase {
  constructor(o) {
    super(o);
    this.tab = Array(81).fill(0);
    this.gane = Array(9).fill(0);
    this.activo = -1;
    this.turno = this.primero;
    this.ult = null;
  }
  accion(j, a) {
    if (j !== this.turno) return;
    const b = Kit.ent(a.b, 0, 8), k = Kit.ent(a.k, 0, 8);
    if (b === null || k === null) return;
    if (!UT.movs(this.tab, this.gane, this.activo).some(([x, y]) => x === b && y === k)) return;
    const antes = this.gane[b];
    const r = UT.jugar(this, b, k, j);
    this.tab = r.tab; this.gane = r.gane; this.activo = r.activo;
    this.ult = { b, k };
    this.emitir("marca", { j, b, k, chico: !antes && this.gane[b] ? this.gane[b] : 0 });
    if (r.res) this.terminar(r.res);
    else this.turno = Kit.otro(j);
  }
  vista(r) {
    return { ...this.base(r), tab: this.tab.slice(), gane: this.gane.slice(), activo: this.activo, turno: this.turno, ult: this.ult };
  }
}
Kit.SIMS.ultimate = UltimateSim;
