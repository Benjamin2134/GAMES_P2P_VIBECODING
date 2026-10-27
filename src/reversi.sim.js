// ==========================================================================
//  Simulacion de REVERSI / OTHELLO (turnos). Tablero 8x8: cada ficha que
//  encierra fichas rivales en linea recta las voltea. Si no tenes jugada,
//  pasas; si nadie puede jugar, gana quien tiene mas fichas.
// ==========================================================================
const RV = {
  DIRS: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
  // Indices que voltea jugar j en i (vacio = jugada invalida).
  volteos(tab, i, j) {
    if (tab[i]) return [];
    const o = j === 1 ? 2 : 1, f0 = i >> 3, c0 = i & 7, res = [];
    for (const [df, dc] of RV.DIRS) {
      let f = f0 + df, c = c0 + dc;
      const linea = [];
      while (f >= 0 && f < 8 && c >= 0 && c < 8 && tab[f * 8 + c] === o) { linea.push(f * 8 + c); f += df; c += dc; }
      if (linea.length && f >= 0 && f < 8 && c >= 0 && c < 8 && tab[f * 8 + c] === j) for (const k of linea) res.push(k);
    }
    return res;
  },
  validas(tab, j) {
    const r = [];
    for (let i = 0; i < 64; i++) if (!tab[i] && RV.volteos(tab, i, j).length) r.push(i);
    return r;
  },
  // Posicion inicial: el que empieza tiene d5 y e4.
  inicial(primero) {
    const t = Array(64).fill(0), o = primero === 1 ? 2 : 1;
    t[27] = o; t[36] = o; t[28] = primero; t[35] = primero;
    return t;
  },
  cuenta(tab) {
    let a = 0, b = 0;
    for (const x of tab) { if (x === 1) a++; else if (x === 2) b++; }
    return { 1: a, 2: b };
  },
};

class ReversiSim extends SimBase {
  constructor(o) {
    super(o);
    this.tab = RV.inicial(this.primero);
    this.turno = this.primero;
    this.ult = -1;
    this.volt = [];
  }
  accion(j, a) {
    if (j !== this.turno) return;
    const i = Kit.ent(a.i, 0, 63);
    if (i === null) return;
    const v = RV.volteos(this.tab, i, j);
    if (!v.length) return;
    this.tab[i] = j;
    for (const k of v) this.tab[k] = j;
    this.ult = i; this.volt = v;
    this.emitir("ficha", { i, j, n: v.length });
    const o = Kit.otro(j);
    if (RV.validas(this.tab, o).length) this.turno = o;
    else if (RV.validas(this.tab, j).length) this.emitir("paso", { j: o });
    else {
      const c = RV.cuenta(this.tab);
      this.terminar(c[1] > c[2] ? 1 : c[2] > c[1] ? 2 : 3);
    }
  }
  vista(r) {
    return {
      ...this.base(r), tab: this.tab.slice(), turno: this.turno, ult: this.ult, volt: this.volt.slice(),
      cuenta: RV.cuenta(this.tab), validas: this.turno === r && !this.ganador ? RV.validas(this.tab, r) : [],
    };
  }
}
Kit.SIMS.reversi = ReversiSim;
