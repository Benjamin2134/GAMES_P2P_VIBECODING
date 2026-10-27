// ==========================================================================
//  Simulacion de MANCALA (Kalah 6x4, turnos).
//  Hoyos: 0-5 de P1, 6 = granero de P1, 7-12 de P2, 13 = granero de P2.
//  Sembras de a una en sentido antihorario saltando el granero rival.
//  - Ultima semilla en tu granero: vuelves a jugar.
//  - Ultima en un hoyo tuyo vacio con semillas enfrente: capturas ambas.
//  - Si un lado queda vacio, el otro guarda lo que le queda. Gana el granero mayor.
// ==========================================================================
const MC = {
  granero: (j) => (j === 1 ? 6 : 13),
  inicio: (j) => (j === 1 ? 0 : 7),
  inicial() { const h = Array(14).fill(4); h[6] = 0; h[13] = 0; return h; },
  // Siembra desde el hoyo propio k (0-5) de j. Devuelve {h, extra, camino, captura}.
  sembrar(h0, j, k) {
    const h = h0.slice(), desde = MC.inicio(j) + k;
    let n = h[desde];
    if (!n) return null;
    h[desde] = 0;
    let i = desde;
    const camino = [];
    const rival = MC.granero(j === 1 ? 2 : 1);
    while (n > 0) {
      i = (i + 1) % 14;
      if (i === rival) continue;
      h[i]++; n--; camino.push(i);
    }
    let captura = -1;
    const propio = j === 1 ? i >= 0 && i <= 5 : i >= 7 && i <= 12;
    if (propio && h[i] === 1 && h[12 - i] > 0) {
      captura = 12 - i;
      h[MC.granero(j)] += h[i] + h[12 - i];
      h[i] = 0; h[12 - i] = 0;
    }
    const extra = i === MC.granero(j);
    // fin: un lado vacio -> el otro guarda lo suyo
    const lado1 = h.slice(0, 6).reduce((a, b) => a + b, 0), lado2 = h.slice(7, 13).reduce((a, b) => a + b, 0);
    let fin = false;
    if (!lado1 || !lado2) {
      for (let x = 0; x < 6; x++) { h[6] += h[x]; h[x] = 0; }
      for (let x = 7; x < 13; x++) { h[13] += h[x]; h[x] = 0; }
      fin = true;
    }
    return { h, extra: extra && !fin, camino, captura, fin };
  },
};

class MancalaSim extends SimBase {
  constructor(o) {
    super(o);
    this.h = MC.inicial();
    this.turno = this.primero;
    this.ult = null;
  }
  accion(j, a) {
    if (j !== this.turno) return;
    const k = Kit.ent(a.k, 0, 5);
    if (k === null) return;
    const r = MC.sembrar(this.h, j, k);
    if (!r) return;
    this.h = r.h;
    this.ult = { j, k, camino: r.camino, captura: r.captura };
    this.emitir("siembra", { j, k, n: r.camino.length, captura: r.captura, extra: r.extra });
    if (r.fin) { this.terminar(this.h[6] > this.h[13] ? 1 : this.h[13] > this.h[6] ? 2 : 3); return; }
    if (!r.extra) this.turno = Kit.otro(j);
  }
  vista(r) {
    return { ...this.base(r), h: this.h.slice(), turno: this.turno, ult: this.ult };
  }
}
Kit.SIMS.mancala = MancalaSim;
