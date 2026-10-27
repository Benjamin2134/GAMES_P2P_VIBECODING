// ==========================================================================
//  Simulacion de TANQUES (tiempo real, 120 Hz). Vista cenital con muros.
//  Giras y avanzas; las balas rebotan 2 veces en las paredes (cuidado con
//  las tuyas). Minas: se arman al segundo y explotan si alguien se acerca.
//  Un impacto destruye el tanque. Rondas a 5.
// ==========================================================================
const TQ = {
  X0: 20, X1: 940, Y0: 56, Y1: 584, R: 17,
  GIRO: 2.8, VEL: 165, VEL_ATRAS: 110, BALA: 340, CD: 0.38, MAX_BALAS: 4, REBOTES: 2, VIDA_BALA: 6,
  R_MINA: 36, ARMADO: 1.0, RONDAS: 5, SUBITA: 45,
  MUROS: [
    [180, 150, 40, 140], [740, 150, 40, 140], [180, 350, 40, 140], [740, 350, 40, 140],
    [400, 120, 160, 30], [400, 490, 160, 30], [455, 260, 50, 120], [300, 300, 60, 40], [600, 300, 60, 40],
  ],
  dentroMuro(x, y, m = 0) {
    if (x < TQ.X0 + m || x > TQ.X1 - m || y < TQ.Y0 + m || y > TQ.Y1 - m) return true;
    return TQ.MUROS.some(([mx, my, w, h]) => x > mx - m && x < mx + w + m && y > my - m && y < my + h + m);
  },
  // Mueve una bala con rebote. Devuelve true si reboto.
  mover(b, dt) {
    const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
    if (!TQ.dentroMuro(nx, ny)) { b.x = nx; b.y = ny; return false; }
    if (!TQ.dentroMuro(b.x, ny)) b.vx = -b.vx;
    else if (!TQ.dentroMuro(nx, b.y)) b.vy = -b.vy;
    else { b.vx = -b.vx; b.vy = -b.vy; }
    return true;
  },
  // Empuja un circulo fuera de muros y bordes.
  empujar(t) {
    t.x = clamp(t.x, TQ.X0 + TQ.R, TQ.X1 - TQ.R); t.y = clamp(t.y, TQ.Y0 + TQ.R, TQ.Y1 - TQ.R);
    for (const [mx, my, w, h] of TQ.MUROS) {
      const cx = clamp(t.x, mx, mx + w), cy = clamp(t.y, my, my + h), dx = t.x - cx, dy = t.y - cy, d = Math.hypot(dx, dy);
      if (d < TQ.R) {
        if (d > 1e-6) { t.x = cx + (dx / d) * TQ.R; t.y = cy + (dy / d) * TQ.R; }
        else t.y = my - TQ.R;
      }
    }
  },
};

class TanquesSim extends SimBase {
  constructor(o) {
    super(o);
    this.rondas = { 1: 0, 2: 0 };
    this.nuevaRonda();
  }
  nuevaRonda() {
    this.t = {
      1: { x: 80, y: 320, a: 0, vivo: true, cd: 0, giro: 0, mov: 0, fuego: false },
      2: { x: 880, y: 320, a: Math.PI, vivo: true, cd: 0, giro: 0, mov: 0, fuego: false },
    };
    this.balas = []; this.minas = [];
    this.fase = "cuenta"; this.espera = 1.2; this.tRonda = 0;
  }
  // Muerte subita: a los 45 s de ronda las balas van mas rapido y recargan antes.
  get subita() { return this.tRonda > TQ.SUBITA; }
  input(j, i) {
    const t = this.t[j];
    if (!i) return;
    t.giro = Kit.num(i.giro, -1, 1, 0); t.mov = Kit.num(i.mov, -1, 1, 0); t.fuego = !!i.fuego;
  }
  accion(j, a) {
    const t = this.t[j];
    if (!a.mina || !t.vivo || this.fase !== "juego" || this.minas.some((m) => m.j === j)) return;
    this.minas.push({ j, x: t.x - Math.cos(t.a) * 22, y: t.y - Math.sin(t.a) * 22, arma: TQ.ARMADO });
    this.emitir("mina", { j });
  }
  step(dt) {
    if (this.fase === "cuenta") { this.espera -= dt; if (this.espera <= 0) this.fase = "juego"; return; }
    if (this.fase === "fin") {
      this.espera -= dt;
      for (const b of this.balas) TQ.mover(b, dt);
      if (this.espera <= 0) { const g = this.rondas[1] >= TQ.RONDAS ? 1 : this.rondas[2] >= TQ.RONDAS ? 2 : 0; if (g) this.terminar(g); else this.nuevaRonda(); }
      return;
    }
    const muertos = [];
    const antes = this.subita;
    this.tRonda += dt;
    if (this.subita && !antes) this.emitir("subita", {});
    const vb = TQ.BALA * (this.subita ? 1.6 : 1);
    for (const j of [1, 2]) {
      const t = this.t[j];
      if (!t.vivo) continue;
      t.a += t.giro * TQ.GIRO * dt;
      const v = t.mov > 0 ? TQ.VEL * t.mov : TQ.VEL_ATRAS * t.mov;
      t.x += Math.cos(t.a) * v * dt; t.y += Math.sin(t.a) * v * dt;
      TQ.empujar(t);
      t.cd = Math.max(0, t.cd - dt);
      if (t.fuego && t.cd <= 0 && this.balas.filter((b) => b.j === j).length < TQ.MAX_BALAS) {
        const px = t.x + Math.cos(t.a) * (TQ.R + 6), py = t.y + Math.sin(t.a) * (TQ.R + 6);
        if (!TQ.dentroMuro(px, py)) {
          this.balas.push({ j, x: px, y: py, vx: Math.cos(t.a) * vb, vy: Math.sin(t.a) * vb, reb: 0, vida: TQ.VIDA_BALA });
          t.cd = TQ.CD * (this.subita ? 0.5 : 1);
          this.emitir("disparo", { j });
        }
      }
    }
    // choque entre tanques
    const a = this.t[1], c = this.t[2], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
    if (a.vivo && c.vivo && d < TQ.R * 2 && d > 1e-6) { const s = (TQ.R * 2 - d) / 2; a.x -= (dx / d) * s; a.y -= (dy / d) * s; c.x += (dx / d) * s; c.y += (dy / d) * s; TQ.empujar(a); TQ.empujar(c); }
    for (let k = this.balas.length - 1; k >= 0; k--) {
      const b = this.balas[k];
      b.vida -= dt;
      if (TQ.mover(b, dt)) { b.reb++; this.emitir("rebote", {}); }
      if (b.reb > TQ.REBOTES || b.vida <= 0) { this.balas.splice(k, 1); continue; }
      for (const j of [1, 2]) {
        const t = this.t[j];
        if (t.vivo && Math.hypot(b.x - t.x, b.y - t.y) < TQ.R + 3) { muertos.push(j); this.balas.splice(k, 1); break; }
      }
    }
    for (let k = this.minas.length - 1; k >= 0; k--) {
      const m = this.minas[k];
      m.arma -= dt;
      if (m.arma > 0) continue;
      if ([1, 2].some((j) => this.t[j].vivo && Math.hypot(this.t[j].x - m.x, this.t[j].y - m.y) < TQ.R_MINA)) {
        for (const j of [1, 2]) if (this.t[j].vivo && Math.hypot(this.t[j].x - m.x, this.t[j].y - m.y) < TQ.R_MINA + 26) muertos.push(j);
        this.minas.splice(k, 1);
        this.emitir("boom", { x: m.x, y: m.y });
      }
    }
    if (muertos.length) {
      const set = new Set(muertos);
      for (const j of set) { this.t[j].vivo = false; this.emitir("muere", { j, x: this.t[j].x, y: this.t[j].y }); }
      const g = set.size === 2 ? 0 : set.has(1) ? 2 : 1;
      if (g) this.rondas[g]++;
      this.fase = "fin"; this.espera = 1.8;
      this.emitir("ronda", { g });
    }
  }
  vista(r) {
    const t = (x) => ({ x: Kit.r1(x.x), y: Kit.r1(x.y), a: Kit.r2(x.a), v: x.vivo });
    return {
      ...this.base(r), t1: t(this.t[1]), t2: t(this.t[2]),
      balas: this.balas.map((b) => [Math.round(b.x), Math.round(b.y), b.j, Math.round(b.vx), Math.round(b.vy)]),
      minas: this.minas.map((m) => [Math.round(m.x), Math.round(m.y), m.j, m.arma <= 0 ? 1 : 0]),
      rondas: { ...this.rondas }, fase: this.fase, sd: this.subita,
    };
  }
}
Kit.SIMS.tanques = TanquesSim;
