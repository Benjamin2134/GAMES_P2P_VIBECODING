// ==========================================================================
//  Simulacion de SNAKE DUELO (tiempo real por ticks). Dos serpientes en una
//  grilla de 38x22: comer crece, chocar con paredes o cuerpos mata, choque
//  de cabezas mata a ambas. La manzana dorada da 3 s de turbo (doble paso).
//  Rondas: gana la que sobrevive. Primero a 3.
// ==========================================================================
const SN = {
  C: 38, F: 22, TICK: 1 / 9, RONDAS: 3, MANZANAS: 3,
  DIR: { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] },
  OPUESTA: { u: "d", d: "u", l: "r", r: "l" },
};

class SnakeSim extends SimBase {
  constructor(o) {
    super(o);
    this.rondas = { 1: 0, 2: 0 };
    this.nuevaRonda();
  }
  nuevaRonda() {
    const y = Math.floor(SN.F / 2);
    this.s = {
      1: { cuerpo: [[8, y], [7, y], [6, y]], dir: "r", quiere: "r", crece: 0, viva: true, turbo: 0 },
      2: { cuerpo: [[SN.C - 9, y], [SN.C - 8, y], [SN.C - 7, y]], dir: "l", quiere: "l", crece: 0, viva: true, turbo: 0 },
    };
    this.manzanas = [];
    for (let k = 0; k < SN.MANZANAS; k++) this.ponerManzana();
    this.oro = null;
    this.tOro = 6;
    this.acc = 0; this.accT = { 1: 0, 2: 0 };
    this.fase = "cuenta"; this.espera = 1.2;
  }
  ocupada(x, y) {
    for (const j of [1, 2]) for (const [a, b] of this.s[j].cuerpo) if (a === x && b === y) return true;
    return this.manzanas.some(([a, b]) => a === x && b === y) || (this.oro && this.oro[0] === x && this.oro[1] === y);
  }
  libre() {
    for (let k = 0; k < 200; k++) {
      const x = Kit.ri(1, SN.C - 2), y = Kit.ri(1, SN.F - 2);
      if (!this.ocupada(x, y)) return [x, y];
    }
    return null;
  }
  ponerManzana() { const p = this.libre(); if (p) this.manzanas.push(p); }
  input(j, i) {
    const s = this.s[j];
    if (i && SN.DIR[i.d] && i.d !== SN.OPUESTA[s.dir]) s.quiere = i.d;
  }
  step(dt) {
    if (this.fase === "cuenta") { this.espera -= dt; if (this.espera <= 0) this.fase = "juego"; return; }
    if (this.fase === "fin") {
      this.espera -= dt;
      if (this.espera <= 0) {
        const g = this.rondas[1] >= SN.RONDAS ? 1 : this.rondas[2] >= SN.RONDAS ? 2 : 0;
        if (g) this.terminar(g); else this.nuevaRonda();
      }
      return;
    }
    // manzana dorada
    this.tOro -= dt;
    if (!this.oro && this.tOro <= 0) { this.oro = this.libre(); this.tOro = 5; }
    else if (this.oro && this.tOro <= 0) { this.oro = null; this.tOro = 7 + Math.random() * 4; }
    // cada serpiente avanza a su ritmo (turbo = doble)
    const mueven = [];
    for (const j of [1, 2]) {
      const s = this.s[j];
      if (s.turbo > 0) s.turbo -= dt;
      this.accT[j] += dt * (s.turbo > 0 ? 2 : 1);
      if (this.accT[j] >= SN.TICK) { this.accT[j] -= SN.TICK; mueven.push(j); }
    }
    if (mueven.length) this.tick(mueven);
  }
  tick(mueven) {
    const cab = {};
    for (const j of mueven) {
      const s = this.s[j];
      s.dir = s.quiere;
      const [dx, dy] = SN.DIR[s.dir], [x, y] = s.cuerpo[0];
      cab[j] = [x + dx, y + dy];
    }
    // colas que se mueven este tick (dejan su celda libre)
    for (const j of mueven) { const s = this.s[j]; if (s.crece > 0) s.crece--; else s.cuerpo.pop(); }
    const muere = { 1: false, 2: false };
    for (const j of mueven) {
      const [x, y] = cab[j];
      if (x < 0 || y < 0 || x >= SN.C || y >= SN.F) muere[j] = true;
      for (const k of [1, 2]) for (const [a, b] of this.s[k].cuerpo) if (a === x && b === y) muere[j] = true;
    }
    if (mueven.length === 2 && cab[1][0] === cab[2][0] && cab[1][1] === cab[2][1]) { muere[1] = true; muere[2] = true; }
    for (const j of mueven) {
      if (muere[j]) continue;
      const s = this.s[j], [x, y] = cab[j];
      s.cuerpo.unshift([x, y]);
      const m = this.manzanas.findIndex(([a, b]) => a === x && b === y);
      if (m >= 0) { this.manzanas.splice(m, 1); s.crece += 2; this.ponerManzana(); this.emitir("come", { j }); }
      if (this.oro && this.oro[0] === x && this.oro[1] === y) { this.oro = null; this.tOro = 8; s.turbo = 3; s.crece += 3; this.emitir("oro", { j }); }
    }
    if (muere[1] || muere[2]) {
      for (const j of [1, 2]) if (muere[j]) { this.s[j].viva = false; this.emitir("muere", { j, x: cab[j][0], y: cab[j][1] }); }
      const g = muere[1] && muere[2] ? 0 : muere[1] ? 2 : 1;
      if (g) this.rondas[g]++;
      this.fase = "fin"; this.espera = 1.8;
      this.emitir("ronda", { g });
    }
  }
  vista(r) {
    const s = (x) => ({ c: x.cuerpo.map((p) => p.slice()), d: x.dir, v: x.viva, t: x.turbo > 0 });
    return { ...this.base(r), s1: s(this.s[1]), s2: s(this.s[2]), manzanas: this.manzanas.map((p) => p.slice()), oro: this.oro, rondas: { ...this.rondas }, fase: this.fase };
  }
}
Kit.SIMS.snake = SnakeSim;
