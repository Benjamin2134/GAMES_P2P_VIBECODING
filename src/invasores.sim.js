// ==========================================================================
//  Simulacion de INVASORES VERSUS (tiempo real, 120 Hz). Una formacion
//  compartida baja hacia los dos cañones. Cada invasor vale segun su fila,
//  el platillo 100. Si te disparan pierdes 100 puntos y reapareces. Dos
//  oleadas; gana el que suma mas (si llegan al suelo, se termina ahi).
// ==========================================================================
const IV = {
  COLS: 10, FILAS: 5, DX: 46, DY: 36, Y_SUELO: 548, VEL: 300, BALA: 560, BALA_INV: 250,
  VALOR: [30, 20, 20, 10, 10], OLEADAS: 2, CASTIGO: 100,
  BUNKER: { n: 4, w: 10, h: 5, t: 7, y: 470 },
};

class InvasoresSim extends SimBase {
  constructor(o) {
    super(o);
    this.puntos = { 1: 0, 2: 0 };
    this.c = { 1: { x: 300, dx: 0, fuego: false, cd: 0, muerto: 0, inv: 0 }, 2: { x: 660, dx: 0, fuego: false, cd: 0, muerto: 0, inv: 0 } };
    this.oleada = 0;
    const B = IV.BUNKER;
    this.bunker = Array(B.n * B.w * B.h).fill(1);
    this.nuevaOleada();
  }
  nuevaOleada() {
    this.oleada++;
    this.inv = Array(IV.COLS * IV.FILAS).fill(1);
    this.fx = 140; this.fy = 90 + (this.oleada - 1) * 30; this.dir = 1; this.paso = 0; this.frame = 0;
    this.balas = []; this.balasInv = [];
    this.ovni = null; this.tOvni = Kit.rnd(10, 18);
    this.espera = 1.5;
  }
  input(j, i) { if (!i) return; this.c[j].dx = Kit.num(i.dx, -1, 1, 0); this.c[j].fuego = !!i.fuego; }
  vivos() { return this.inv.reduce((a, b) => a + b, 0); }
  bunkerEn(x, y) {
    const B = IV.BUNKER;
    for (let k = 0; k < B.n; k++) {
      const bx = 150 + k * 200, cx = Math.floor((x - bx) / B.t), cy = Math.floor((y - B.y) / B.t);
      if (cx >= 0 && cx < B.w && cy >= 0 && cy < B.h) { const i = (k * B.h + cy) * B.w + cx; if (this.bunker[i]) return i; }
    }
    return -1;
  }
  step(dt) {
    if (this.espera > 0) { this.espera -= dt; return; }
    for (const j of [1, 2]) {
      const c = this.c[j];
      c.cd -= dt; c.inv -= dt;
      if (c.muerto > 0) { c.muerto -= dt; continue; }
      c.x = clamp(c.x + c.dx * IV.VEL * dt, 30, 930);
      if (c.fuego && c.cd <= 0 && this.balas.filter((b) => b.j === j).length < 2) {
        this.balas.push({ j, x: c.x, y: IV.Y_SUELO - 18 }); c.cd = 0.32; this.emitir("disparo", { j });
      }
    }
    // formacion: avanza a saltos, mas rapido cuantos menos quedan
    const vivos = this.vivos();
    this.paso -= dt;
    if (this.paso <= 0) {
      this.paso = 0.06 + (vivos / (IV.COLS * IV.FILAS)) * 0.6;
      this.frame ^= 1;
      let min = 99, max = -1;
      this.inv.forEach((v, k) => { if (v) { min = Math.min(min, k % IV.COLS); max = Math.max(max, k % IV.COLS); } });
      const nx = this.fx + this.dir * 12;
      if (nx + min * IV.DX < 30 || nx + max * IV.DX + 30 > 930) { this.dir = -this.dir; this.fy += 18; }
      else this.fx = nx;
      this.emitir("marcha", { f: this.frame });
      // disparan los de abajo de cada columna
      if (Math.random() < 0.55) {
        const cols = [];
        for (let c = 0; c < IV.COLS; c++) for (let f = IV.FILAS - 1; f >= 0; f--) if (this.inv[f * IV.COLS + c]) { cols.push([c, f]); break; }
        if (cols.length) { const [c, f] = Kit.elegir(cols); this.balasInv.push({ x: this.fx + c * IV.DX + 15, y: this.fy + f * IV.DY + 26 }); }
      }
    }
    // platillo
    this.tOvni -= dt;
    if (!this.ovni && this.tOvni <= 0) { const d = Math.random() < 0.5 ? 1 : -1; this.ovni = { x: d > 0 ? -40 : 1000, d }; }
    if (this.ovni) { this.ovni.x += this.ovni.d * 150 * dt; if (this.ovni.x < -60 || this.ovni.x > 1020) { this.ovni = null; this.tOvni = Kit.rnd(12, 20); } }
    // balas de jugadores
    for (let k = this.balas.length - 1; k >= 0; k--) {
      const b = this.balas[k];
      b.y -= IV.BALA * dt;
      let fuera = b.y < 40;
      const bi = this.bunkerEn(b.x, b.y);
      if (bi >= 0) { this.bunker[bi] = 0; fuera = true; }
      if (!fuera && this.ovni && Math.abs(b.x - this.ovni.x) < 26 && Math.abs(b.y - 64) < 12) {
        this.puntos[b.j] += 100; this.emitir("ovni", { j: b.j, x: this.ovni.x }); this.ovni = null; this.tOvni = Kit.rnd(12, 20); fuera = true;
      }
      if (!fuera) {
        const c = Math.floor((b.x - this.fx) / IV.DX), f = Math.floor((b.y - this.fy) / IV.DY);
        if (c >= 0 && c < IV.COLS && f >= 0 && f < IV.FILAS && this.inv[f * IV.COLS + c] && (b.x - this.fx) % IV.DX < 32 && (b.y - this.fy) % IV.DY < 26) {
          this.inv[f * IV.COLS + c] = 0; this.puntos[b.j] += IV.VALOR[f]; fuera = true;
          this.emitir("muere", { j: b.j, x: this.fx + c * IV.DX + 15, y: this.fy + f * IV.DY + 12, f });
        }
      }
      if (fuera) this.balas.splice(k, 1);
    }
    // balas invasoras
    for (let k = this.balasInv.length - 1; k >= 0; k--) {
      const b = this.balasInv[k];
      b.y += IV.BALA_INV * dt;
      let fuera = b.y > 590;
      const bi = this.bunkerEn(b.x, b.y);
      if (bi >= 0) { this.bunker[bi] = 0; fuera = true; }
      for (const j of [1, 2]) {
        const c = this.c[j];
        if (!fuera && c.muerto <= 0 && c.inv <= 0 && Math.abs(b.x - c.x) < 20 && Math.abs(b.y - (IV.Y_SUELO - 8)) < 14) {
          c.muerto = 1.4; c.inv = 3; this.puntos[j] = Math.max(0, this.puntos[j] - IV.CASTIGO); fuera = true;
          this.emitir("golpe", { j, x: c.x });
        }
      }
      if (fuera) this.balasInv.splice(k, 1);
    }
    const llegaron = this.inv.some((v, k) => v && this.fy + Math.floor(k / IV.COLS) * IV.DY + 26 > IV.Y_SUELO - 30);
    if (!this.vivos() || llegaron) {
      if (llegaron || this.oleada >= IV.OLEADAS) this.terminar(this.puntos[1] > this.puntos[2] ? 1 : this.puntos[2] > this.puntos[1] ? 2 : 3);
      else { this.emitir("oleada", { n: this.oleada + 1 }); this.nuevaOleada(); }
    }
  }
  vista(r) {
    const c = (x) => ({ x: Kit.r1(x.x), m: x.muerto > 0, i: x.inv > 0 });
    return {
      ...this.base(r), inv: this.inv.join(""), fx: this.fx, fy: this.fy, frame: this.frame, c1: c(this.c[1]), c2: c(this.c[2]),
      balas: this.balas.map((b) => [Math.round(b.x), Math.round(b.y), b.j]), bi: this.balasInv.map((b) => [Math.round(b.x), Math.round(b.y)]),
      ovni: this.ovni ? Math.round(this.ovni.x) : null, bunker: this.bunker.join(""), puntos: { ...this.puntos }, oleada: this.oleada, espera: this.espera > 0,
    };
  }
}
Kit.SIMS.invasores = InvasoresSim;
