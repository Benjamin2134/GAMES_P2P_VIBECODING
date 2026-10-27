// ==========================================================================
//  Simulacion de PAC-DUELO (tiempo real). Uno es el comecocos, el otro el
//  fantasma; los roles se turnan cada ronda. El comecocos gana la ronda si
//  se come todos los puntos o, con una pildora activa, al fantasma. El
//  fantasma gana si lo atrapa o si se acaba el tiempo. Primero a 3 rondas.
//  Movimiento por casillas con giro "precargado" (como el original).
// ==========================================================================
const PD = {
  MAPA: [
    "###################",
    "#........#........#",
    "#o##.###.#.###.##o#",
    "#.................#",
    "#.##.#.#####.#.##.#",
    "#....#...#...#....#",
    "####.###.#.###.####",
    "   #.#.......#.#   ",
    "####.#.##-##.#.####",
    ".......#   #.......",
    "####.#.#####.#.####",
    "   #.#.......#.#   ",
    "####.#.#####.#.####",
    "#........#........#",
    "#.##.###.#.###.##.#",
    "#o.#...........#.o#",
    "##.#.#.#####.#.#.##",
    "#....#...#...#....#",
    "#.######.#.######.#",
    "#.................#",
    "###################",
  ],
  C: 19, F: 21, V_PAC: 6.2, V_FANT: 6.5, V_SUSTO: 4.3, SUSTO: 6, TIEMPO: 100, RONDAS: 3,
  DIR: { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] },
  OPUESTA: { u: "d", d: "u", l: "r", r: "l" },
  INICIO: { pac: [9, 15], fant: [9, 7] },
  pisable(x, y) {
    if (y < 0 || y >= PD.F) return false;
    x = (x + PD.C) % PD.C;
    const ch = PD.MAPA[y][x];
    return ch === "." || ch === "o";
  },
  // Avanza una entidad {cx, cy, p, dir, quiere} a velocidad v (casillas/s).
  mover(e, v, dt) {
    if (e.quiere && e.dir && e.quiere === PD.OPUESTA[e.dir]) {
      const [dx, dy] = PD.DIR[e.dir];
      e.cx = (e.cx + dx + PD.C) % PD.C; e.cy += dy; e.p = 1 - e.p; e.dir = e.quiere;
    }
    if (!e.dir) {
      if (e.quiere && PD.pisable(e.cx + PD.DIR[e.quiere][0], e.cy + PD.DIR[e.quiere][1])) e.dir = e.quiere;
      else return;
    }
    e.p += v * dt;
    while (e.p >= 1) {
      const [dx, dy] = PD.DIR[e.dir];
      e.cx = (e.cx + dx + PD.C) % PD.C; e.cy += dy; e.p -= 1;
      const ok = (d) => d && PD.pisable(e.cx + PD.DIR[d][0], e.cy + PD.DIR[d][1]);
      if (ok(e.quiere)) e.dir = e.quiere;
      else if (!ok(e.dir)) { e.dir = null; e.p = 0; break; }
    }
  },
  pos(e) {
    const [dx, dy] = e.dir ? PD.DIR[e.dir] : [0, 0];
    let x = e.cx + dx * e.p;
    if (x < -0.5) x += PD.C; if (x > PD.C - 0.5) x -= PD.C;
    return { x, y: e.cy + dy * e.p };
  },
};

class PacDueloSim extends SimBase {
  constructor(o) {
    super(o);
    this.rondas = { 1: 0, 2: 0 };
    this.r = 0;
    this.nuevaRonda();
  }
  nuevaRonda() {
    this.r++;
    this.pac = this.r % 2 ? this.primero : Kit.otro(this.primero);
    this.fant = Kit.otro(this.pac);
    this.puntos = PD.MAPA.map((f) => f.replace(/[^.o]/g, " ")).join("");
    const e = ([x, y], d) => ({ cx: x, cy: y, p: 0, dir: null, quiere: d });
    this.e = { [this.pac]: e(PD.INICIO.pac, "l"), [this.fant]: e(PD.INICIO.fant, "r") };
    this.susto = 0; this.t = PD.TIEMPO;
    this.fase = "cuenta"; this.espera = 1.6;
  }
  input(j, i) { if (i && PD.DIR[i.d]) this.e[j].quiere = i.d; }
  step(dt) {
    if (this.fase === "cuenta") { this.espera -= dt; if (this.espera <= 0) this.fase = "juego"; return; }
    if (this.fase === "fin") {
      this.espera -= dt;
      if (this.espera <= 0) { const g = this.rondas[1] >= PD.RONDAS ? 1 : this.rondas[2] >= PD.RONDAS ? 2 : 0; if (g) this.terminar(g); else this.nuevaRonda(); }
      return;
    }
    this.t -= dt;
    this.susto = Math.max(0, this.susto - dt);
    const pac = this.e[this.pac], fant = this.e[this.fant];
    PD.mover(pac, PD.V_PAC, dt);
    PD.mover(fant, this.susto > 0 ? PD.V_SUSTO : PD.V_FANT, dt);
    const k = pac.cy * PD.C + pac.cx, ch = this.puntos[k];
    if (ch === "." || ch === "o") {
      this.puntos = this.puntos.slice(0, k) + " " + this.puntos.slice(k + 1);
      if (ch === "o") { this.susto = PD.SUSTO; this.emitir("pildora", {}); }
      else this.emitir("punto", {});
    }
    const a = PD.pos(pac), b = PD.pos(fant);
    let g = 0;
    if (Math.hypot(a.x - b.x, a.y - b.y) < 0.7) g = this.susto > 0 ? this.pac : this.fant;
    else if (!/[.o]/.test(this.puntos)) g = this.pac;
    else if (this.t <= 0) g = this.fant;
    if (g) {
      this.rondas[g]++;
      this.fase = "fin"; this.espera = 2;
      this.emitir("ronda", { g, como: g === this.pac ? (this.susto > 0 && Math.hypot(a.x - b.x, a.y - b.y) < 0.7 ? "comio" : "limpio") : this.t <= 0 ? "tiempo" : "atrapo", x: a.x, y: a.y });
    }
  }
  vista(r) {
    const e = (x) => { const p = PD.pos(x); return { x: Kit.r2(p.x), y: Kit.r2(p.y), d: x.dir || x.quiere }; };
    return {
      ...this.base(r), puntos: this.puntos, pac: this.pac, fant: this.fant, ep: e(this.e[this.pac]), ef: e(this.e[this.fant]),
      susto: Kit.r1(this.susto), t: Math.ceil(this.t), rondas: { ...this.rondas }, fase: this.fase, r: this.r,
    };
  }
}
Kit.SIMS.pacduelo = PacDueloSim;
