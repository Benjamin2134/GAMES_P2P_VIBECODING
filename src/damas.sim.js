// ==========================================================================
//  Simulacion de DAMAS (turnos), reglas chilenas/espanolas:
//  - Peon: avanza 1 en diagonal y captura solo hacia adelante.
//  - Dama: vuela (cualquier distancia en diagonal), captura a distancia.
//  - Captura obligatoria; si la misma pieza puede seguir capturando, sigue.
//  - Coronar termina la jugada. Pierde quien no tiene piezas o jugadas.
//  - 50 jugadas seguidas solo de damas y sin capturas = empate.
//  Casillas: tab[64], 0 vacia, 1/2 peon de P1/P2, 3/4 dama de P1/P2.
//  P1 empieza abajo (filas 5-7) y sube; P2 arriba (filas 0-2) y baja.
// ==========================================================================
const DM = {
  dueno: (x) => (x === 1 || x === 3 ? 1 : x === 2 || x === 4 ? 2 : 0),
  rey: (x) => x >= 3,
  dir: (j) => (j === 1 ? -1 : 1),
  dentro: (f, c) => f >= 0 && f < 8 && c >= 0 && c < 8,
  DIAG: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
  inicial() {
    const t = Array(64).fill(0);
    for (let f = 0; f < 8; f++) for (let c = 0; c < 8; c++)
      if ((f + c) % 2 === 1) { if (f < 3) t[f * 8 + c] = 2; else if (f > 4) t[f * 8 + c] = 1; }
    return t;
  },
  capturas(tab, i) {
    const x = tab[i], j = DM.dueno(x), o = j === 1 ? 2 : 1, res = [];
    const f0 = i >> 3, c0 = i & 7;
    const dirs = DM.rey(x) ? DM.DIAG : [[DM.dir(j), -1], [DM.dir(j), 1]];
    for (const [df, dc] of dirs) {
      if (DM.rey(x)) {
        let f = f0 + df, c = c0 + dc;
        while (DM.dentro(f, c) && !tab[f * 8 + c]) { f += df; c += dc; }
        if (!DM.dentro(f, c) || DM.dueno(tab[f * 8 + c]) !== o) continue;
        const cap = f * 8 + c;
        f += df; c += dc;
        while (DM.dentro(f, c) && !tab[f * 8 + c]) { res.push({ de: i, a: f * 8 + c, cap }); f += df; c += dc; }
      } else {
        const f2 = f0 + 2 * df, c2 = c0 + 2 * dc;
        if (DM.dentro(f2, c2) && DM.dueno(tab[(f0 + df) * 8 + c0 + dc]) === o && !tab[f2 * 8 + c2])
          res.push({ de: i, a: f2 * 8 + c2, cap: (f0 + df) * 8 + c0 + dc });
      }
    }
    return res;
  },
  simples(tab, i) {
    const x = tab[i], j = DM.dueno(x), res = [], f0 = i >> 3, c0 = i & 7;
    const dirs = DM.rey(x) ? DM.DIAG : [[DM.dir(j), -1], [DM.dir(j), 1]];
    for (const [df, dc] of dirs) {
      let f = f0 + df, c = c0 + dc;
      while (DM.dentro(f, c) && !tab[f * 8 + c]) {
        res.push({ de: i, a: f * 8 + c, cap: -1 });
        if (!DM.rey(x)) break;
        f += df; c += dc;
      }
    }
    return res;
  },
  // Jugadas legales de j (si encadena >= 0, solo capturas de esa pieza).
  movs(tab, j, encadena = -1) {
    if (encadena >= 0) return DM.capturas(tab, encadena);
    const caps = [];
    for (let i = 0; i < 64; i++) if (DM.dueno(tab[i]) === j) for (const m of DM.capturas(tab, i)) caps.push(m);
    if (caps.length) return caps;
    const res = [];
    for (let i = 0; i < 64; i++) if (DM.dueno(tab[i]) === j) for (const m of DM.simples(tab, i)) res.push(m);
    return res;
  },
  // Aplica una jugada: devuelve el tablero nuevo, si corono y si debe seguir capturando.
  aplicar(tab, m) {
    const t = tab.slice(), x = t[m.de];
    t[m.de] = 0;
    if (m.cap >= 0) t[m.cap] = 0;
    let y = x;
    const fila = m.a >> 3;
    if (x === 1 && fila === 0) y = 3;
    if (x === 2 && fila === 7) y = 4;
    t[m.a] = y;
    const corona = y !== x;
    const sigue = m.cap >= 0 && !corona && DM.capturas(t, m.a).length > 0;
    return { tab: t, corona, sigue };
  },
  cuenta(tab) {
    const r = { 1: 0, 2: 0 };
    for (const x of tab) if (x) r[DM.dueno(x)]++;
    return r;
  },
};

class DamasSim extends SimBase {
  constructor(o) {
    super(o);
    this.tab = DM.inicial();
    this.turno = this.primero;
    this.enc = -1;           // pieza que esta encadenando capturas
    this.ult = null;
    this.sinAvance = 0;
  }
  accion(j, a) {
    if (j !== this.turno) return;
    const m = DM.movs(this.tab, j, this.enc).find((x) => x.de === a.de && x.a === a.a);
    if (!m) return;
    const peon = !DM.rey(this.tab[m.de]);
    const r = DM.aplicar(this.tab, m);
    this.tab = r.tab;
    this.ult = { de: m.de, a: m.a, cap: m.cap };
    this.emitir(m.cap >= 0 ? "captura" : "mueve", { j, a: m.a, cap: m.cap, corona: r.corona });
    this.sinAvance = m.cap >= 0 || peon ? 0 : this.sinAvance + 1;
    if (r.sigue) { this.enc = m.a; return; }
    this.enc = -1;
    const o = Kit.otro(j);
    if (!DM.movs(this.tab, o).length) { this.terminar(j); return; }
    if (this.sinAvance >= 50) { this.terminar(3); return; }
    this.turno = o;
  }
  vista(r) {
    return {
      ...this.base(r), tab: this.tab.slice(), turno: this.turno, enc: this.enc, ult: this.ult,
      cuenta: DM.cuenta(this.tab), sinAvance: this.sinAvance,
      movs: this.turno === r && !this.ganador ? DM.movs(this.tab, r, this.enc).map((m) => [m.de, m.a, m.cap]) : [],
    };
  }
}
Kit.SIMS.damas = DamasSim;
