// ==========================================================================
//  Simulacion de SUMO (tiempo real, 120 Hz). Dos bolas en un plato que se
//  achica. Aceleras con inercia y embistes (dash con recarga): quien embiste
//  pesa el doble durante un instante. Sale del plato = pierde la ronda. A 3.
// ==========================================================================
const SU = {
  CX: 480, CY: 330, R0: 250, R1: 110, ACHICA: 40, R: 26,
  ACEL: 950, VMAX: 430, FRENO: 1.7, DASH: 560, DASH_CD: 1.6, RONDAS: 3,
};

class SumoSim extends SimBase {
  constructor(o) {
    super(o);
    this.rondas = { 1: 0, 2: 0 };
    this.nuevaRonda();
  }
  nuevaRonda() {
    this.b = {
      1: { x: SU.CX - 120, y: SU.CY, vx: 0, vy: 0, ax: 0, ay: 0, cd: 0, emb: 0, dentro: true },
      2: { x: SU.CX + 120, y: SU.CY, vx: 0, vy: 0, ax: 0, ay: 0, cd: 0, emb: 0, dentro: true },
    };
    this.t = 0; this.fase = "cuenta"; this.espera = 1.3;
  }
  // Se achica hasta R1 y despues, muerte subita: sigue cerrandose despacio.
  get radio() {
    if (this.t <= SU.ACHICA) return SU.R0 - (SU.R0 - SU.R1) * (this.t / SU.ACHICA);
    return Math.max(SU.R * 0.8, SU.R1 - (this.t - SU.ACHICA) * 5);
  }
  input(j, i) {
    if (!i) return;
    const b = this.b[j], ax = Kit.num(i.ax, -1, 1, 0), ay = Kit.num(i.ay, -1, 1, 0), l = Math.hypot(ax, ay);
    b.ax = l > 1 ? ax / l : ax; b.ay = l > 1 ? ay / l : ay;
  }
  accion(j, a) {
    const b = this.b[j];
    if (!a.dash || this.fase !== "juego" || b.cd > 0) return;
    let dx = b.ax, dy = b.ay;
    if (!dx && !dy) { const v = Math.hypot(b.vx, b.vy) || 1; dx = b.vx / v; dy = b.vy / v; }
    const l = Math.hypot(dx, dy) || 1;
    b.vx += (dx / l) * SU.DASH; b.vy += (dy / l) * SU.DASH;
    b.cd = SU.DASH_CD; b.emb = 0.3;
    this.emitir("dash", { j });
  }
  step(dt) {
    if (this.fase === "cuenta") { this.espera -= dt; if (this.espera <= 0) this.fase = "juego"; return; }
    if (this.fase === "fin") {
      this.espera -= dt;
      if (this.espera <= 0) { const g = this.rondas[1] >= SU.RONDAS ? 1 : this.rondas[2] >= SU.RONDAS ? 2 : 0; if (g) this.terminar(g); else this.nuevaRonda(); }
      // las que cayeron siguen cayendo (solo visual)
      for (const j of [1, 2]) { const b = this.b[j]; b.x += b.vx * dt; b.y += b.vy * dt; }
      return;
    }
    this.t += dt;
    for (const j of [1, 2]) {
      const b = this.b[j];
      b.cd = Math.max(0, b.cd - dt); b.emb = Math.max(0, b.emb - dt);
      b.vx += b.ax * SU.ACEL * dt; b.vy += b.ay * SU.ACEL * dt;
      const f = Math.exp(-SU.FRENO * dt); b.vx *= f; b.vy *= f;
      const v = Math.hypot(b.vx, b.vy), max = b.emb > 0 ? SU.VMAX + SU.DASH : SU.VMAX;
      if (v > max) { b.vx *= max / v; b.vy *= max / v; }
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
    const a = this.b[1], c = this.b[2], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
    if (d < SU.R * 2 && d > 1e-6) {
      const nx = dx / d, ny = dy / d, ma = a.emb > 0 ? 2 : 1, mc = c.emb > 0 ? 2 : 1;
      const sol = SU.R * 2 - d;
      a.x -= nx * sol * mc / (ma + mc); a.y -= ny * sol * mc / (ma + mc);
      c.x += nx * sol * ma / (ma + mc); c.y += ny * sol * ma / (ma + mc);
      const vr = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
      if (vr < 0) {
        const imp = (-(1 + 1.15) * vr) / (1 / ma + 1 / mc);
        a.vx -= (imp / ma) * nx; a.vy -= (imp / ma) * ny; c.vx += (imp / mc) * nx; c.vy += (imp / mc) * ny;
        this.emitir("choque", { f: Math.min(1, -vr / 600), x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 });
      }
    }
    const R = this.radio, fuera = {};
    for (const j of [1, 2]) fuera[j] = Math.hypot(this.b[j].x - SU.CX, this.b[j].y - SU.CY) > R + SU.R * 0.4;
    if (fuera[1] || fuera[2]) {
      for (const j of [1, 2]) if (fuera[j]) { this.b[j].dentro = false; this.emitir("cae", { j }); }
      const g = fuera[1] && fuera[2] ? 0 : fuera[1] ? 2 : 1;
      if (g) this.rondas[g]++;
      this.fase = "fin"; this.espera = 1.8;
      this.emitir("ronda", { g });
    }
  }
  vista(r) {
    const b = (x) => ({ x: Kit.r1(x.x), y: Kit.r1(x.y), vx: Math.round(x.vx), vy: Math.round(x.vy), cd: Kit.r2(x.cd), e: x.emb > 0, d: x.dentro });
    return { ...this.base(r), b1: b(this.b[1]), b2: b(this.b[2]), radio: Kit.r1(this.radio), rondas: { ...this.rondas }, fase: this.fase };
  }
}
Kit.SIMS.sumo = SumoSim;
