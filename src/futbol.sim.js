// ==========================================================================
//  Simulacion de FUTBOL DE AUTOS (tiempo real, 120 Hz). Vista lateral: autos
//  que aceleran, saltan, giran en el aire y usan turbo para pegarle a una
//  pelota gigante. P1 defiende el arco izquierdo. 2 minutos o primero a 5.
// ==========================================================================
const FU = {
  X0: 40, X1: 920, TECHO: 60, SUELO: 540, ARCO: 392, R: 24, G: 1100, GB: 820,
  ACEL: 1300, VMAX: 470, VTURBO: 760, SALTO: 640, GIRO: 4.6, TURBO: 1600, GASTO: 38, RECARGA: 14,
  TIEMPO: 120, GOLES: 5, CH: 12,
};

class FutbolSim extends SimBase {
  constructor(o) {
    super(o);
    this.goles = { 1: 0, 2: 0 };
    this.t = FU.TIEMPO;
    this.saque();
  }
  saque() {
    const auto = (x, dir) => ({ x, y: FU.SUELO - FU.CH, vx: 0, vy: 0, a: dir > 0 ? 0 : Math.PI, dir, turbo: 50, suelo: true, gas: 0, tur: false });
    this.c = { 1: auto(200, 1), 2: auto(760, -1) };
    this.b = { x: 480, y: 220, vx: 0, vy: 0 };
    this.pausa = 1.3;
  }
  input(j, i) { if (!i) return; const c = this.c[j]; c.gas = Kit.num(i.x, -1, 1, 0); c.tur = !!i.turbo; }
  accion(j, a) {
    const c = this.c[j];
    if (a.salto && c.suelo && this.pausa <= 0) { c.vy = -FU.SALTO; c.suelo = false; this.emitir("salto", { j }); }
  }
  step(dt) {
    if (this.pausa > 0) { this.pausa -= dt; return; }
    this.t -= dt;
    if (this.t <= 0) { this.terminar(this.goles[1] > this.goles[2] ? 1 : this.goles[2] > this.goles[1] ? 2 : 3); return; }
    for (const j of [1, 2]) this.auto(this.c[j], dt);
    const A = this.c[1], B = this.c[2], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
    if (d < 52 && d > 1e-6) { const nx = dx / d, ny = dy / d, s = (52 - d) / 2; A.x -= nx * s; A.y -= ny * s; B.x += nx * s; B.y += ny * s; const vr = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny; if (vr < 0) { A.vx += vr * nx; A.vy += vr * ny; B.vx -= vr * nx; B.vy -= vr * ny; } }
    const sub = 3;
    for (let s = 0; s < sub; s++) if (this.pelota(dt / sub)) return;
  }
  auto(c, dt) {
    const v = c.tur && c.turbo > 0;
    if (v) c.turbo = Math.max(0, c.turbo - FU.GASTO * dt);
    if (c.suelo) {
      c.turbo = Math.min(100, c.turbo + FU.RECARGA * dt);
      if (c.gas) { c.vx += c.gas * FU.ACEL * dt; c.dir = Math.sign(c.gas); }
      else c.vx *= Math.exp(-3 * dt);
      if (v) c.vx += c.dir * FU.TURBO * dt;
      c.a = c.dir > 0 ? 0 : Math.PI;
    } else {
      c.a += c.gas * FU.GIRO * dt * (c.dir > 0 ? 1 : -1);
      if (v) { c.vx += Math.cos(c.a) * FU.TURBO * dt; c.vy += Math.sin(c.a) * FU.TURBO * dt; }
      c.vy += FU.G * dt;
    }
    const max = v ? FU.VTURBO : FU.VMAX;
    if (Math.abs(c.vx) > max) c.vx = Math.sign(c.vx) * max;
    c.x += c.vx * dt; c.y += c.vy * dt;
    if (c.x < FU.X0 + 30) { c.x = FU.X0 + 30; c.vx = 0; }
    if (c.x > FU.X1 - 30) { c.x = FU.X1 - 30; c.vx = 0; }
    if (c.y < FU.TECHO + FU.CH) { c.y = FU.TECHO + FU.CH; c.vy = 0; }
    if (c.y >= FU.SUELO - FU.CH) {
      if (!c.suelo) { c.dir = Math.cos(c.a) >= 0 ? 1 : -1; this.emitir("aterriza", {}); }
      c.y = FU.SUELO - FU.CH; c.vy = 0; c.suelo = true;
    } else c.suelo = false;
  }
  pelota(dt) {
    const b = this.b, R = FU.R;
    b.vy += FU.GB * dt;
    b.vx *= Math.exp(-0.15 * dt);
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y > FU.SUELO - R) { b.y = FU.SUELO - R; b.vy = -Math.abs(b.vy) * 0.72; b.vx *= 0.985; if (Math.abs(b.vy) > 80) this.emitir("bote", {}); }
    if (b.y < FU.TECHO + R) { b.y = FU.TECHO + R; b.vy = Math.abs(b.vy) * 0.8; }
    for (const [pared, fondo, lado] of [[FU.X0, 6, 1], [FU.X1, 954, -1]]) {
      const enBoca = b.y > FU.ARCO + R * 0.3;
      if (!enBoca && (lado > 0 ? b.x < pared + R : b.x > pared - R)) { b.x = pared + lado * R; b.vx = lado * Math.abs(b.vx) * 0.8; this.emitir("bote", {}); }
      // dentro del arco: techo del arco y fondo
      if (lado > 0 ? b.x < pared : b.x > pared) {
        if (b.y < FU.ARCO + R) { b.y = FU.ARCO + R; b.vy = Math.abs(b.vy) * 0.6; }
        if (lado > 0 ? b.x < fondo + R : b.x > fondo - R) { b.x = fondo + lado * R; b.vx = lado * Math.abs(b.vx) * 0.4; }
        if (lado > 0 ? b.x < pared - R * 0.9 : b.x > pared + R * 0.9) { this.gol(lado > 0 ? 2 : 1); return true; }
      }
      // travesaño
      const ex = b.x - pared, ey = b.y - FU.ARCO, d = Math.hypot(ex, ey);
      if (d < R && d > 1e-6) { const nx = ex / d, ny = ey / d, vn = b.vx * nx + b.vy * ny; b.x = pared + nx * R; b.y = FU.ARCO + ny * R; if (vn < 0) { b.vx -= 1.7 * vn * nx; b.vy -= 1.7 * vn * ny; } }
    }
    for (const j of [1, 2]) {
      const c = this.c[j];
      for (const [ox, rc] of [[0, 22], [22, 15], [-22, 15]]) {
        const cx = c.x + Math.cos(c.a) * ox, cy = c.y + Math.sin(c.a) * ox, ex = b.x - cx, ey = b.y - cy, d = Math.hypot(ex, ey);
        if (d >= R + rc || d < 1e-6) continue;
        const nx = ex / d, ny = ey / d;
        b.x = cx + nx * (R + rc); b.y = cy + ny * (R + rc);
        const vr = (b.vx - c.vx) * nx + (b.vy - c.vy) * ny;
        if (vr < 0) {
          b.vx -= 1.55 * vr * nx; b.vy -= 1.55 * vr * ny;
          const v = Math.hypot(b.vx, b.vy);
          if (v > 1300) { b.vx *= 1300 / v; b.vy *= 1300 / v; }
          this.emitir("toque", { j, f: Math.min(1, -vr / 900) });
        }
        break;
      }
    }
    return false;
  }
  gol(j) {
    this.goles[j]++;
    this.emitir("gol", { j, x: this.b.x, y: this.b.y });
    if (this.goles[j] >= FU.GOLES) { this.terminar(j); return; }
    this.saque();
  }
  vista(r) {
    const c = (x) => ({ x: Kit.r1(x.x), y: Kit.r1(x.y), a: Kit.r2(x.a), t: Math.round(x.turbo), s: x.suelo, f: x.tur && x.turbo > 0, d: x.dir });
    return { ...this.base(r), c1: c(this.c[1]), c2: c(this.c[2]), b: { x: Kit.r1(this.b.x), y: Kit.r1(this.b.y), vx: Math.round(this.b.vx), vy: Math.round(this.b.vy) }, goles: { ...this.goles }, t: Math.ceil(this.t), pausa: this.pausa > 0 };
  }
}
Kit.SIMS.futbol = FutbolSim;
