// ==========================================================================
//  Simulacion de AIR HOCKEY (tiempo real, 120 Hz). Mesa horizontal: P1
//  defiende el arco izquierdo, P2 el derecho. Cada mazo sigue al puntero de
//  su jugador con velocidad maxima (anti-cheat). Primero a 7 goles.
// ==========================================================================
const HOC = {
  X0: 40, X1: 920, Y0: 64, Y1: 580, ARCO: [252, 392],
  R_MAZO: 30, R_DISCO: 18, V_MAZO: 1500, V_DISCO: 1350, GOLES: 7, SAQUE: 1.0,
  get CX() { return (HOC.X0 + HOC.X1) / 2; },
  get CY() { return (HOC.Y0 + HOC.Y1) / 2; },
  // Zona permitida de cada mazo (su mitad).
  limitar(j, x, y) {
    const r = HOC.R_MAZO;
    return {
      x: j === 1 ? clamp(x, HOC.X0 + r, HOC.CX - r) : clamp(x, HOC.CX + r, HOC.X1 - r),
      y: clamp(y, HOC.Y0 + r, HOC.Y1 - r),
    };
  },
};

class AirHockeySim extends SimBase {
  constructor(o) {
    super(o);
    this.goles = { 1: 0, 2: 0 };
    this.mazos = {
      1: { x: HOC.X0 + 90, y: HOC.CY, vx: 0, vy: 0, tx: HOC.X0 + 90, ty: HOC.CY },
      2: { x: HOC.X1 - 90, y: HOC.CY, vx: 0, vy: 0, tx: HOC.X1 - 90, ty: HOC.CY },
    };
    this.saque(this.primero);
  }
  saque(j) {
    this.disco = { x: HOC.CX + (j === 1 ? -150 : 150), y: HOC.CY, vx: 0, vy: 0 };
    this.pausa = HOC.SAQUE;
  }
  input(j, i) {
    const m = this.mazos[j];
    if (!i || !m) return;
    const p = HOC.limitar(j, Kit.num(i.x, 0, 960, m.tx), Kit.num(i.y, 0, 640, m.ty));
    m.tx = p.x; m.ty = p.y;
  }
  step(dt) {
    for (const j of [1, 2]) {
      const m = this.mazos[j];
      const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy), max = HOC.V_MAZO * dt;
      const k = d > max ? max / d : 1;
      m.vx = (dx * k) / dt; m.vy = (dy * k) / dt;
      m.x += dx * k; m.y += dy * k;
    }
    if (this.pausa > 0) { this.pausa -= dt; return; }
    const b = this.disco, R = HOC.R_DISCO;
    b.vx *= Math.exp(-0.22 * dt); b.vy *= Math.exp(-0.22 * dt);
    const sub = 3, d = dt / sub;
    for (let s = 0; s < sub; s++) {
      b.x += b.vx * d; b.y += b.vy * d;
      // bandas
      if (b.y < HOC.Y0 + R) { b.y = HOC.Y0 + R; b.vy = Math.abs(b.vy) * 0.92; this.emitir("banda", {}); }
      if (b.y > HOC.Y1 - R) { b.y = HOC.Y1 - R; b.vy = -Math.abs(b.vy) * 0.92; this.emitir("banda", {}); }
      const enArco = b.y > HOC.ARCO[0] && b.y < HOC.ARCO[1];
      if (!enArco) {
        if (b.x < HOC.X0 + R) { b.x = HOC.X0 + R; b.vx = Math.abs(b.vx) * 0.92; this.emitir("banda", {}); }
        if (b.x > HOC.X1 - R) { b.x = HOC.X1 - R; b.vx = -Math.abs(b.vx) * 0.92; this.emitir("banda", {}); }
      } else {
        // postes del arco
        for (const px of [HOC.X0, HOC.X1]) for (const py of HOC.ARCO) {
          const ex = b.x - px, ey = b.y - py, dd = Math.hypot(ex, ey);
          if (dd < R && dd > 1e-6) { const nx = ex / dd, ny = ey / dd, vn = b.vx * nx + b.vy * ny; b.x = px + nx * R; b.y = py + ny * R; if (vn < 0) { b.vx -= 1.9 * vn * nx; b.vy -= 1.9 * vn * ny; } }
        }
        if (b.x < HOC.X0 - R) { this.gol(2); return; }
        if (b.x > HOC.X1 + R) { this.gol(1); return; }
      }
      // mazos
      for (const j of [1, 2]) {
        const m = this.mazos[j], ex = b.x - m.x, ey = b.y - m.y, dd = Math.hypot(ex, ey), min = R + HOC.R_MAZO;
        if (dd < min && dd > 1e-6) {
          const nx = ex / dd, ny = ey / dd;
          b.x = m.x + nx * min; b.y = m.y + ny * min;
          const vr = (b.vx - m.vx) * nx + (b.vy - m.vy) * ny;
          if (vr < 0) {
            b.vx -= 1.9 * vr * nx; b.vy -= 1.9 * vr * ny;
            const v = Math.hypot(b.vx, b.vy);
            if (v > HOC.V_DISCO) { b.vx *= HOC.V_DISCO / v; b.vy *= HOC.V_DISCO / v; }
            this.emitir("golpe", { j, f: Math.min(1, v / HOC.V_DISCO) });
          }
        }
      }
    }
  }
  gol(j) {
    this.goles[j]++;
    this.emitir("gol", { j, x: this.disco.x, y: this.disco.y });
    if (this.goles[j] >= HOC.GOLES) { this.terminar(j); this.disco.vx = 0; this.disco.vy = 0; return; }
    this.saque(Kit.otro(j));
  }
  vista(r) {
    const m = (x) => ({ x: Kit.r1(x.x), y: Kit.r1(x.y) });
    return {
      ...this.base(r), m1: m(this.mazos[1]), m2: m(this.mazos[2]),
      d: { x: Kit.r1(this.disco.x), y: Kit.r1(this.disco.y), vx: Math.round(this.disco.vx), vy: Math.round(this.disco.vy) },
      goles: { ...this.goles }, pausa: this.pausa > 0,
    };
  }
}
Kit.SIMS.airhockey = AirHockeySim;
