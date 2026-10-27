// ==========================================================================
//  Simulacion de CARRERA (tiempo real, 120 Hz). Pista cenital cerrada
//  (spline Catmull-Rom). Aceleras, frenas, doblas; con el freno de mano
//  derrapas. Fuera de la pista se frena. 3 vueltas, gana el primero.
// ==========================================================================
const CR = (() => {
  const CTRL = [[170, 150], [480, 108], [790, 150], [870, 300], [770, 470], [570, 420], [430, 510], [190, 480], [100, 320]];
  const PTS = [];
  const n = CTRL.length;
  for (let i = 0; i < n; i++) {
    const p0 = CTRL[(i - 1 + n) % n], p1 = CTRL[i], p2 = CTRL[(i + 1) % n], p3 = CTRL[(i + 2) % n];
    for (let k = 0; k < 30; k++) {
      const t = k / 30, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      PTS.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  const N = PTS.length, ANCHO = 104, VUELTAS = 3;
  // indice del punto de la linea central mas cercano, buscando cerca del anterior
  function cercano(x, y, prev) {
    let mejor = Infinity, mi = prev;
    const rango = prev < 0 ? N : 24;
    for (let d = -rango; d <= rango; d++) {
      const i = ((prev < 0 ? 0 : prev) + d + N) % N, dx = PTS[i][0] - x, dy = PTS[i][1] - y, dd = dx * dx + dy * dy;
      if (dd < mejor) { mejor = dd; mi = i; }
    }
    return { i: mi, d: Math.sqrt(mejor) };
  }
  return { PTS, N, ANCHO, VUELTAS, cercano, ACEL: 400, VMAX: 390, VFUERA: 150, R: 14 };
})();

class CarreraSim extends SimBase {
  constructor(o) {
    super(o);
    const [x0, y0] = CR.PTS[0], [x1, y1] = CR.PTS[3], a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a);
    const auto = (s) => ({ x: x0 - Math.cos(a) * 30 + nx * s * 24, y: y0 - Math.sin(a) * 30 + ny * s * 24, a, vx: 0, vy: 0, gas: 0, giro: 0, mano: false,
      idx: CR.N - 3, vuelta: 0, mitad: false, fuera: false, t0: 0, tiempos: [] });
    this.c = { 1: auto(-1), 2: auto(1) };
    this.cuenta = 3.2; this.t = 0;
  }
  input(j, i) { if (!i) return; const c = this.c[j]; c.gas = Kit.num(i.gas, -1, 1, 0); c.giro = Kit.num(i.giro, -1, 1, 0); c.mano = !!i.mano; }
  step(dt) {
    if (this.cuenta > 0) { const antes = Math.ceil(this.cuenta); this.cuenta -= dt; if (Math.ceil(this.cuenta) !== antes) this.emitir("cuenta", { n: Math.ceil(this.cuenta) }); return; }
    this.t += dt;
    for (const j of [1, 2]) this.auto(this.c[j], j, dt);
    const A = this.c[1], B = this.c[2], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
    if (d < CR.R * 2 && d > 1e-6) {
      const nx = dx / d, ny = dy / d, s = (CR.R * 2 - d) / 2;
      A.x -= nx * s; A.y -= ny * s; B.x += nx * s; B.y += ny * s;
      const vr = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
      if (vr < 0) { A.vx += vr * nx * 0.9; A.vy += vr * ny * 0.9; B.vx -= vr * nx * 0.9; B.vy -= vr * ny * 0.9; this.emitir("choque", {}); }
    }
  }
  auto(c, j, dt) {
    const hx = Math.cos(c.a), hy = Math.sin(c.a), nx = -hy, ny = hx;
    let f = c.vx * hx + c.vy * hy, l = c.vx * nx + c.vy * ny;
    if (c.gas > 0) f += c.gas * CR.ACEL * dt;
    else if (c.gas < 0) f += c.gas * (f > 0 ? 650 : 260) * dt;
    f *= Math.exp(-(c.fuera ? 2.6 : 0.5) * dt);
    if (c.mano) f *= Math.exp(-0.9 * dt);
    f = clamp(f, -130, c.fuera ? CR.VFUERA : CR.VMAX);
    l *= Math.exp(-(c.mano ? 1.4 : 7.5) * dt);
    c.a += c.giro * 2.7 * dt * clamp(f / 150, -1, 1) * (c.mano ? 1.35 : 1);
    c.vx = f * hx + l * nx; c.vy = f * hy + l * ny;
    c.x = clamp(c.x + c.vx * dt, 10, 950); c.y = clamp(c.y + c.vy * dt, 10, 590);
    const p = CR.cercano(c.x, c.y, c.idx);
    c.fuera = p.d > CR.ANCHO / 2;
    if (Math.abs(p.i - CR.N / 2) < 20) c.mitad = true;
    if (c.idx > CR.N * 0.85 && p.i < CR.N * 0.15) {
      if (c.mitad || c.vuelta === 0) {
        if (c.vuelta > 0) { c.tiempos.push(Kit.r2(this.t - c.t0)); this.emitir("vuelta", { j, n: c.vuelta, t: Kit.r2(this.t - c.t0) }); }
        c.vuelta++; c.mitad = false; c.t0 = this.t;
        if (c.vuelta > CR.VUELTAS) this.terminar(j);
      }
    } else if (p.i > CR.N * 0.85 && c.idx < CR.N * 0.15 && c.vuelta > 0) c.vuelta = Math.max(1, c.vuelta);   // marcha atras sobre la meta: no cuenta
    c.idx = p.i;
  }
  vista(r) {
    const c = (x) => ({ x: Kit.r1(x.x), y: Kit.r1(x.y), a: Kit.r2(x.a), v: Math.round(Math.hypot(x.vx, x.vy)), vuelta: Math.min(x.vuelta, CR.VUELTAS), idx: x.idx, fuera: x.fuera, tiempos: x.tiempos.slice(), mano: x.mano });
    return { ...this.base(r), c1: c(this.c[1]), c2: c(this.c[2]), cuenta: this.cuenta > 0 ? Math.ceil(this.cuenta) : 0, t: Kit.r2(this.t) };
  }
}
Kit.SIMS.carrera = CarreraSim;
