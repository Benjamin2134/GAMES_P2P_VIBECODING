// ==========================================================================
//  Simulacion de TETRIS VERSUS (tiempo real). Un tablero 10x20 por jugador,
//  la misma secuencia de piezas para ambos (bolsa de 7 con semilla comun).
//  Limpiar 2/3/4 lineas manda 1/2/4 filas de basura al rival (la basura
//  pendiente se cancela con tus propias lineas). Pierde quien se tapa.
// ==========================================================================
const TT = {
  W: 10, H: 20, LOCK: 0.5, RESETS: 12, BASURA: [0, 0, 1, 2, 4],
  // forma base de cada pieza (x, y) dentro de su caja de n x n
  P: {
    1: { n: 4, c: [[0, 1], [1, 1], [2, 1], [3, 1]] },     // I
    2: { n: 2, c: [[0, 0], [1, 0], [0, 1], [1, 1]] },     // O
    3: { n: 3, c: [[1, 0], [0, 1], [1, 1], [2, 1]] },     // T
    4: { n: 3, c: [[1, 0], [2, 0], [0, 1], [1, 1]] },     // S
    5: { n: 3, c: [[0, 0], [1, 0], [1, 1], [2, 1]] },     // Z
    6: { n: 3, c: [[0, 0], [0, 1], [1, 1], [2, 1]] },     // J
    7: { n: 3, c: [[2, 0], [0, 1], [1, 1], [2, 1]] },     // L
  },
  COLOR: ["", "#22d3ee", "#facc15", "#a855f7", "#4ade80", "#f87171", "#3b82f6", "#fb923c", "#6b7280"],
  celdas(t, r) {
    const { n, c } = TT.P[t];
    return c.map(([x, y]) => { for (let k = 0; k < (r & 3); k++) [x, y] = [n - 1 - y, x]; return [x, y]; });
  },
  cabe(tab, t, r, px, py) {
    for (const [x, y] of TT.celdas(t, r)) {
      const X = px + x, Y = py + y;
      if (X < 0 || X >= TT.W || Y >= TT.H) return false;
      if (Y >= 0 && tab[Y * TT.W + X]) return false;
    }
    return true;
  },
  // Fija la pieza y limpia lineas. Devuelve {tab, lineas, tapado}.
  fijar(tab0, t, r, px, py) {
    const tab = tab0.slice();
    let tapado = false;
    for (const [x, y] of TT.celdas(t, r)) { if (py + y < 0) tapado = true; else tab[(py + y) * TT.W + px + x] = t; }
    let lineas = 0;
    for (let y = TT.H - 1; y >= 0; y--) {
      let llena = true;
      for (let x = 0; x < TT.W; x++) if (!tab[y * TT.W + x]) { llena = false; break; }
      if (llena) { tab.splice(y * TT.W, TT.W); tab.unshift(...Array(TT.W).fill(0)); lineas++; y++; }
    }
    return { tab, lineas, tapado };
  },
  caida(tab, t, r, x, y) { while (TT.cabe(tab, t, r, x, y + 1)) y++; return y; },
};

class TetrisSim extends SimBase {
  constructor(o) {
    super(o);
    const semilla = Math.floor(Math.random() * 1e9);
    this.p = { 1: this.jugador(semilla), 2: this.jugador(semilla) };
    for (const j of [1, 2]) this.nuevaPieza(j);
    this.cuenta = 1.5;
  }
  jugador(semilla) {
    return { tab: Array(TT.W * TT.H).fill(0), rnd: Kit.semilla(semilla), bolsa: [], sig: 0, pz: null, n: 0, lineas: 0, basura: 0,
      acc: 0, lock: 0, resets: 0, soft: false, vivo: true };
  }
  sacar(p) {
    if (!p.bolsa.length) { p.bolsa = [1, 2, 3, 4, 5, 6, 7]; for (let i = 6; i > 0; i--) { const k = Math.floor(p.rnd() * (i + 1)); [p.bolsa[i], p.bolsa[k]] = [p.bolsa[k], p.bolsa[i]]; } }
    return p.bolsa.shift();
  }
  nuevaPieza(j) {
    const p = this.p[j];
    if (!p.sig) p.sig = this.sacar(p);
    const t = p.sig; p.sig = this.sacar(p);
    p.pz = { t, r: 0, x: t === 2 ? 4 : 3, y: t === 1 ? -1 : 0 };
    p.n++; p.lock = 0; p.resets = 0; p.acc = 0;
    if (!TT.cabe(p.tab, t, 0, p.pz.x, p.pz.y)) p.vivo = false;
  }
  input(j, i) { if (i) this.p[j].soft = !!i.soft; }
  accion(j, a) {
    const p = this.p[j];
    if (!p.vivo || this.cuenta > 0 || !p.pz) return;
    const z = p.pz;
    const probar = (r, x, y) => { if (TT.cabe(p.tab, z.t, r, x, y)) { z.r = r; z.x = x; z.y = y; if (p.resets < TT.RESETS) { p.lock = 0; p.resets++; } return true; } return false; };
    if (a.m === "l") probar(z.r, z.x - 1, z.y);
    else if (a.m === "r") probar(z.r, z.x + 1, z.y);
    else if (a.m === "rot" || a.m === "rotI") {
      const r = (z.r + (a.m === "rot" ? 1 : 3)) & 3;
      for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [0, 1]]) if (probar(r, z.x + dx, z.y + dy)) { this.emitir("gira", {}, j); break; }
    } else if (a.m === "drop") { z.y = TT.caida(p.tab, z.t, z.r, z.x, z.y); this.bloquear(j, true); }
  }
  bloquear(j, duro) {
    const p = this.p[j], z = p.pz, o = this.p[Kit.otro(j)];
    const r = TT.fijar(p.tab, z.t, z.r, z.x, z.y);
    p.tab = r.tab;
    if (r.tapado) { p.vivo = false; return; }
    if (r.lineas) {
      p.lineas += r.lineas;
      let manda = TT.BASURA[r.lineas];
      const cancela = Math.min(manda, p.basura); p.basura -= cancela; manda -= cancela;
      // las propias lineas tambien cancelan basura pendiente
      if (!manda && r.lineas === 1 && p.basura) p.basura--;
      if (manda) o.basura += manda;
      this.emitir("lineas", { j, n: r.lineas, manda });
    } else this.emitir(duro ? "golpe" : "fija", { j });
    if (p.basura) {
      const n = Math.min(p.basura, 8), hueco = Math.floor(Math.random() * TT.W);
      for (let k = 0; k < p.basura && k < n; k++) {
        if (p.tab.slice(0, TT.W).some((x) => x)) { p.vivo = false; }
        p.tab.splice(0, TT.W);
        const fila = Array(TT.W).fill(8); fila[hueco] = 0;
        p.tab.push(...fila);
      }
      p.basura -= n;
      this.emitir("basura", { j, n });
    }
    if (p.vivo) this.nuevaPieza(j);
  }
  step(dt) {
    if (this.cuenta > 0) { this.cuenta -= dt; return; }
    for (const j of [1, 2]) {
      const p = this.p[j];
      if (!p.vivo) continue;
      const z = p.pz, nivel = Math.floor(p.lineas / 5);
      const intervalo = p.soft ? 0.035 : Math.max(0.07, 0.75 - nivel * 0.07);
      if (TT.cabe(p.tab, z.t, z.r, z.x, z.y + 1)) {
        p.lock = 0;
        p.acc += dt;
        while (p.acc >= intervalo && TT.cabe(p.tab, z.t, z.r, z.x, z.y + 1)) { p.acc -= intervalo; z.y++; }
      } else {
        p.acc = 0;
        p.lock += dt;
        if (p.lock >= TT.LOCK) this.bloquear(j, false);
      }
    }
    const v1 = this.p[1].vivo, v2 = this.p[2].vivo;
    if (!v1 || !v2) this.terminar(v1 ? 1 : v2 ? 2 : 3);
  }
  vista(r) {
    const p = (x) => ({ tab: x.tab.join(""), pz: x.pz ? { ...x.pz } : null, sig: x.sig, n: x.n, lineas: x.lineas, basura: x.basura, vivo: x.vivo });
    return { ...this.base(r), p1: p(this.p[1]), p2: p(this.p[2]), cuenta: this.cuenta > 0 };
  }
}
Kit.SIMS.tetris = TetrisSim;
