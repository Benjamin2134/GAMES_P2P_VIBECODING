// ==========================================================================
//  Simulacion de BOMBERMAN DUELO (tiempo real, 120 Hz). Grilla 15x11 con
//  pilares fijos y cajas que se rompen (a veces sueltan mejoras: +bomba,
//  +alcance, +velocidad). Las bombas explotan en cruz y encadenan. Quien
//  toca una llama pierde la ronda. Primero a 3.
//  celdas: 0 libre, 1 pilar, 2 caja.
// ==========================================================================
const BM = {
  C: 15, F: 11, MECHA: 2.2, LLAMA: 0.5, RONDAS: 3, MEJORAS: ["b", "r", "v"],
  libreEn(grid, bombas, x, y) { return x >= 0 && y >= 0 && x < BM.C && y < BM.F && !grid[y * BM.C + x] && !bombas.some((b) => b.x === x && b.y === y); },
  // Celdas que alcanza una bomba en (x, y) con alcance r.
  cruz(grid, x, y, r) {
    const res = [[x, y]];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let k = 1; k <= r; k++) {
        const nx = x + dx * k, ny = y + dy * k;
        if (nx < 0 || ny < 0 || nx >= BM.C || ny >= BM.F) break;
        const c = grid[ny * BM.C + nx];
        if (c === 1) break;
        res.push([nx, ny]);
        if (c === 2) break;
      }
    }
    return res;
  },
};

class BomberSim extends SimBase {
  constructor(o) {
    super(o);
    this.rondas = { 1: 0, 2: 0 };
    this.nuevaRonda();
  }
  nuevaRonda() {
    const g = [];
    for (let y = 0; y < BM.F; y++) for (let x = 0; x < BM.C; x++) {
      const borde = x === 0 || y === 0 || x === BM.C - 1 || y === BM.F - 1, pilar = x % 2 === 0 && y % 2 === 0;
      const esquina = (x <= 2 && y <= 2) || (x >= BM.C - 3 && y >= BM.F - 3);
      g.push(borde || pilar ? 1 : !esquina && Math.random() < 0.72 ? 2 : 0);
    }
    this.grid = g;
    this.j = {
      1: { x: 1, y: 1, vivo: true, bombas: 1, alcance: 2, vel: 3.6, dx: 0, dy: 0 },
      2: { x: BM.C - 2, y: BM.F - 2, vivo: true, bombas: 1, alcance: 2, vel: 3.6, dx: 0, dy: 0 },
    };
    this.bombas = []; this.llamas = []; this.mejoras = [];
    this.fase = "cuenta"; this.espera = 1.3;
  }
  input(j, i) { if (!i) return; this.j[j].dx = Kit.num(i.dx, -1, 1, 0); this.j[j].dy = Kit.num(i.dy, -1, 1, 0); }
  accion(j, a) {
    const p = this.j[j];
    if (!a.bomba || !p.vivo || this.fase !== "juego") return;
    const x = Math.round(p.x), y = Math.round(p.y);
    if (this.bombas.filter((b) => b.j === j).length >= p.bombas || this.bombas.some((b) => b.x === x && b.y === y)) return;
    this.bombas.push({ x, y, j, t: BM.MECHA, r: p.alcance, encima: { 1: true, 2: true } });
    this.emitir("bomba", { j });
  }
  mover(p, j, dt) {
    let dx = p.dx, dy = p.dy;
    if (dx && dy) dy = 0;                 // un eje a la vez
    if (!dx && !dy) return;
    const paso = p.vel * dt;
    const bloquea = (x, y) => {
      if (this.grid[y * BM.C + x]) return true;
      const b = this.bombas.find((q) => q.x === x && q.y === y);
      return b && !b.encima[j];
    };
    if (dx) {
      const ry = Math.round(p.y), off = p.y - ry;
      // asistencia de esquina: si estas casi alineado, te alinea
      if (Math.abs(off) > 0.02) { p.y -= Math.sign(off) * Math.min(Math.abs(off), paso); if (Math.abs(off) > 0.42) return; }
      const nx = p.x + dx * paso, borde = Math.round(nx + dx * 0.5);
      if (bloquea(borde, ry) && Math.abs(nx - Math.round(p.x)) > 0 && dx * (nx - Math.round(p.x)) > 0) p.x = Math.round(p.x);
      else p.x = nx;
    } else {
      const rx = Math.round(p.x), off = p.x - rx;
      if (Math.abs(off) > 0.02) { p.x -= Math.sign(off) * Math.min(Math.abs(off), paso); if (Math.abs(off) > 0.42) return; }
      const ny = p.y + dy * paso, borde = Math.round(ny + dy * 0.5);
      if (bloquea(rx, borde) && dy * (ny - Math.round(p.y)) > 0) p.y = Math.round(p.y);
      else p.y = ny;
    }
  }
  explotar(b) {
    this.bombas.splice(this.bombas.indexOf(b), 1);
    for (const [x, y] of BM.cruz(this.grid, b.x, b.y, b.r)) {
      this.llamas.push({ x, y, t: BM.LLAMA });
      const k = y * BM.C + x;
      if (this.grid[k] === 2) {
        this.grid[k] = 0;
        if (Math.random() < 0.32) this.mejoras.push({ x, y, tipo: Kit.elegir(BM.MEJORAS) });
      } else this.mejoras = this.mejoras.filter((m) => m.x !== x || m.y !== y);
      const otra = this.bombas.find((q) => q.x === x && q.y === y);
      if (otra) otra.t = Math.min(otra.t, 0.05);    // reaccion en cadena
    }
    this.emitir("boom", { x: b.x, y: b.y });
  }
  step(dt) {
    if (this.fase === "cuenta") { this.espera -= dt; if (this.espera <= 0) this.fase = "juego"; return; }
    if (this.fase === "fin") {
      this.espera -= dt;
      this.llamas = this.llamas.filter((l) => (l.t -= dt) > 0);
      if (this.espera <= 0) { const g = this.rondas[1] >= BM.RONDAS ? 1 : this.rondas[2] >= BM.RONDAS ? 2 : 0; if (g) this.terminar(g); else this.nuevaRonda(); }
      return;
    }
    for (const j of [1, 2]) {
      const p = this.j[j];
      if (!p.vivo) continue;
      this.mover(p, j, dt);
      for (const b of this.bombas) if (b.encima[j] && (Math.abs(p.x - b.x) > 0.75 || Math.abs(p.y - b.y) > 0.75)) b.encima[j] = false;
      const cx = Math.round(p.x), cy = Math.round(p.y), m = this.mejoras.findIndex((q) => q.x === cx && q.y === cy);
      if (m >= 0) {
        const t = this.mejoras[m].tipo;
        if (t === "b") p.bombas = Math.min(5, p.bombas + 1);
        if (t === "r") p.alcance = Math.min(7, p.alcance + 1);
        if (t === "v") p.vel = Math.min(6, p.vel + 0.6);
        this.mejoras.splice(m, 1);
        this.emitir("mejora", { j, t });
      }
    }
    for (const b of this.bombas.slice()) { b.t -= dt; if (b.t <= 0 && this.bombas.includes(b)) this.explotar(b); }
    this.llamas = this.llamas.filter((l) => (l.t -= dt) > 0);
    const muertos = [1, 2].filter((j) => this.j[j].vivo && this.llamas.some((l) => l.x === Math.round(this.j[j].x) && l.y === Math.round(this.j[j].y)));
    if (muertos.length) {
      for (const j of muertos) { this.j[j].vivo = false; this.emitir("muere", { j, x: this.j[j].x, y: this.j[j].y }); }
      const g = muertos.length === 2 ? 0 : Kit.otro(muertos[0]);
      if (g) this.rondas[g]++;
      this.fase = "fin"; this.espera = 2;
      this.emitir("ronda", { g });
    }
  }
  vista(r) {
    const p = (x) => ({ x: Kit.r2(x.x), y: Kit.r2(x.y), v: x.vivo, b: x.bombas, r: x.alcance, s: Kit.r1(x.vel) });
    return {
      ...this.base(r), grid: this.grid.join(""), j1: p(this.j[1]), j2: p(this.j[2]),
      bombas: this.bombas.map((b) => [b.x, b.y, Kit.r2(b.t), b.r, b.j]), llamas: this.llamas.map((l) => [l.x, l.y]),
      mejoras: this.mejoras.map((m) => [m.x, m.y, m.tipo]), rondas: { ...this.rondas }, fase: this.fase,
    };
  }
}
Kit.SIMS.bomber = BomberSim;
