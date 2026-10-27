// ==========================================================================
//  Simulacion de MINIGOLF (turnos con fisica). 6 hoyos con paredes,
//  obstaculos, bumpers y arena. Las dos bolas estan en la cancha a la vez
//  (chocan entre si). Juega primero el que esta mas lejos del hoyo, como en
//  el golf. Tope de 7 golpes por hoyo (se anota 8). Gana el menor total.
// ==========================================================================
const MG = (() => {
  const R = 7, R_HOYO = 11, VMAX = 950, PARO = 7;
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const HOYOS = [
    { nombre: "Recta", par: 2, borde: rect(120, 200, 840, 400), obst: [], bump: [], arena: [], tee: [180, 300], hoyo: [780, 300] },
    { nombre: "La L", par: 3, borde: [[100, 100], [700, 100], [700, 540], [580, 540], [580, 220], [100, 220]], obst: [], bump: [], arena: [], tee: [160, 160], hoyo: [640, 480] },
    { nombre: "El bloque", par: 3, borde: rect(100, 140, 860, 460), obst: [rect(400, 230, 560, 370)], bump: [], arena: [], tee: [170, 300], hoyo: [790, 300] },
    { nombre: "Zigzag", par: 4, borde: rect(80, 80, 880, 520), obst: [rect(320, 80, 342, 390), rect(618, 210, 640, 520)], bump: [], arena: [], tee: [160, 440], hoyo: [800, 150] },
    { nombre: "Flipper", par: 3, borde: rect(100, 100, 860, 500), obst: [],
      bump: [[380, 210, 26], [480, 300, 32], [380, 390, 26], [600, 190, 24], [600, 410, 24]], arena: [], tee: [160, 300], hoyo: [790, 300] },
    { nombre: "El desierto", par: 3, borde: [[100, 300], [290, 110], [700, 110], [860, 300], [700, 490], [290, 490]], obst: [rect(470, 110, 490, 230), rect(470, 370, 490, 490)],
      bump: [], arena: [[380, 230, 600, 370]], tee: [170, 300], hoyo: [780, 300] },
  ];
  // Segmentos de pared de cada hoyo (borde y obstaculos).
  for (const h of HOYOS) {
    h.seg = [];
    for (const poli of [h.borde, ...h.obst])
      for (let k = 0; k < poli.length; k++) h.seg.push([poli[k], poli[(k + 1) % poli.length]]);
  }

  const enArena = (h, b) => h.arena.some(([x0, y0, x1, y1]) => b.x > x0 && b.x < x1 && b.y > y0 && b.y < y1);

  // Avanza las bolas un paso. Devuelve eventos ("pared", "bump", "choque", "hoyo:j").
  function paso(h, bolas, dt) {
    const ev = [];
    const sub = 3, d = dt / sub;
    for (let s = 0; s < sub; s++) {
      for (const j of [1, 2]) {
        const b = bolas[j];
        if (b.dentro) continue;
        const v = Math.hypot(b.vx, b.vy);
        if (v < 1e-3) continue;
        const dec = (enArena(h, b) ? 620 : 150) * d, mult = Math.exp(-(enArena(h, b) ? 2.2 : 0.55) * d);
        const nv = Math.max(0, v * mult - dec);
        if (nv < PARO) { b.vx = 0; b.vy = 0; continue; }
        b.vx *= nv / v; b.vy *= nv / v;
        b.x += b.vx * d; b.y += b.vy * d;
        for (const [[ax, ay], [bx, by]] of h.seg) {
          const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
          const t = clamp(((b.x - ax) * ex + (b.y - ay) * ey) / l2, 0, 1);
          const qx = ax + ex * t, qy = ay + ey * t, dx = b.x - qx, dy = b.y - qy, dist = Math.hypot(dx, dy);
          if (dist < R && dist > 1e-6) {
            const nx = dx / dist, ny = dy / dist;
            b.x = qx + nx * R; b.y = qy + ny * R;
            const vn = b.vx * nx + b.vy * ny;
            if (vn < 0) { b.vx -= 1.75 * vn * nx; b.vy -= 1.75 * vn * ny; if (-vn > 60) ev.push("pared"); }
          }
        }
        for (const [cx, cy, cr] of h.bump) {
          const dx = b.x - cx, dy = b.y - cy, dist = Math.hypot(dx, dy);
          if (dist < cr + R) {
            const nx = dx / dist, ny = dy / dist;
            b.x = cx + nx * (cr + R); b.y = cy + ny * (cr + R);
            const vn = b.vx * nx + b.vy * ny;
            if (vn < 0) { b.vx -= 2.1 * vn * nx; b.vy -= 2.1 * vn * ny; ev.push("bump"); }
          }
        }
        const dh = Math.hypot(b.x - h.hoyo[0], b.y - h.hoyo[1]);
        if (dh < R_HOYO - 2 && Math.hypot(b.vx, b.vy) < 430) { b.dentro = true; b.x = h.hoyo[0]; b.y = h.hoyo[1]; b.vx = 0; b.vy = 0; ev.push("hoyo:" + j); }
      }
      const a = bolas[1], c = bolas[2];
      if (!a.dentro && !c.dentro) {
        const dx = c.x - a.x, dy = c.y - a.y, dist = Math.hypot(dx, dy);
        if (dist < 2 * R && dist > 1e-6) {
          const nx = dx / dist, ny = dy / dist, sol = (2 * R - dist) / 2;
          a.x -= nx * sol; a.y -= ny * sol; c.x += nx * sol; c.y += ny * sol;
          const vr = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
          if (vr < 0) { const k = vr * 0.95; a.vx += k * nx; a.vy += k * ny; c.vx -= k * nx; c.vy -= k * ny; ev.push("choque"); }
        }
      }
    }
    return ev;
  }
  const quietas = (bolas) => [1, 2].every((j) => bolas[j].dentro || (!bolas[j].vx && !bolas[j].vy));

  // Simula un tiro completo (lo usa el bot). Devuelve la bola del tirador al detenerse.
  function simular(h, bolas0, j, ang, pot, dt = 1 / 60) {
    const bolas = { 1: { ...bolas0[1] }, 2: { ...bolas0[2] } };
    const v = clamp(pot, 0, 1) * VMAX;
    bolas[j].vx = Math.cos(ang) * v; bolas[j].vy = Math.sin(ang) * v;
    for (let i = 0; i < 60 * 9 && !quietas(bolas); i++) paso(h, bolas, dt);
    return bolas[j];
  }

  return { R, R_HOYO, VMAX, HOYOS, MAX_GOLPES: 7, paso, quietas, simular, enArena };
})();

class MinigolfSim extends SimBase {
  constructor(o) {
    super(o);
    this.n = 0;
    this.tarjeta = { 1: [], 2: [] };
    this.ultimo = Kit.otro(this.primero);
    this.empezarHoyo();
  }
  get hoyo() { return MG.HOYOS[this.n]; }
  empezarHoyo() {
    const [tx, ty] = this.hoyo.tee;
    this.bolas = { 1: { x: tx, y: ty - 14, vx: 0, vy: 0, dentro: false }, 2: { x: tx, y: ty + 14, vx: 0, vy: 0, dentro: false } };
    this.golpes = { 1: 0, 2: 0 };
    this.fase = "apunta";
    this.turno = this.n % 2 ? Kit.otro(this.primero) : this.primero;
    this.mira = { 1: { ang: 0, pot: 0.4 }, 2: { ang: 0, pot: 0.4 } };
    this.espera = 0;
  }
  input(j, i) {
    if (j !== this.turno || this.fase !== "apunta" || !i) return;
    this.mira[j] = { ang: Kit.num(i.ang, -10, 10, 0), pot: Kit.num(i.pot, 0, 1, 0.4) };
  }
  accion(j, a) {
    if (j !== this.turno || this.fase !== "apunta" || !a.tiro) return;
    const ang = Kit.num(a.ang, -10, 10, 0), pot = Kit.num(a.pot, 0.03, 1, 0.3);
    const b = this.bolas[j];
    b.vx = Math.cos(ang) * pot * MG.VMAX; b.vy = Math.sin(ang) * pot * MG.VMAX;
    this.golpes[j]++;
    this.ultimo = j;
    this.fase = "rueda";
    this.emitir("tiro", { j, pot });
  }
  step(dt) {
    if (this.fase === "rueda") {
      for (const e of MG.paso(this.hoyo, this.bolas, dt)) {
        if (e.startsWith("hoyo:")) {
          const j = +e.slice(5);
          this.emitir("dentro", { j, golpes: this.golpes[j] });
        } else this.emitir(e, {});
      }
      if (MG.quietas(this.bolas)) this.siguiente();
    } else if (this.fase === "entre") {
      this.espera -= dt;
      if (this.espera <= 0) {
        if (this.n + 1 >= MG.HOYOS.length) {
          const t1 = this.total(1), t2 = this.total(2);
          this.terminar(t1 < t2 ? 1 : t2 < t1 ? 2 : 3);
        } else { this.n++; this.empezarHoyo(); }
      }
    }
  }
  total(j) { return this.tarjeta[j].reduce((a, b) => a + b, 0); }
  siguiente() {
    for (const j of [1, 2]) {
      const b = this.bolas[j];
      if (!b.dentro && this.golpes[j] >= MG.MAX_GOLPES) { b.dentro = true; b.levantada = true; this.golpes[j] = MG.MAX_GOLPES + 1; this.emitir("levanta", { j }); }
    }
    const vivos = [1, 2].filter((j) => !this.bolas[j].dentro);
    if (!vivos.length) {
      for (const j of [1, 2]) this.tarjeta[j].push(this.golpes[j]);
      this.fase = "entre";
      this.espera = 2.6;
      this.emitir("finHoyo", { n: this.n });
      return;
    }
    // juega el mas lejos del hoyo (en el tee, empieza el que corresponde)
    const [hx, hy] = this.hoyo.hoyo;
    const dist = (j) => Math.hypot(this.bolas[j].x - hx, this.bolas[j].y - hy);
    let t = vivos[0];
    if (vivos.length === 2) {
      if (!this.golpes[1] && !this.golpes[2]) t = this.turno;
      else if (!this.golpes[1] || !this.golpes[2]) t = !this.golpes[1] ? 1 : 2;
      else t = Math.abs(dist(1) - dist(2)) < 2 ? Kit.otro(this.ultimo) : dist(1) > dist(2) ? 1 : 2;
    }
    this.turno = t;
    this.fase = "apunta";
  }
  vista(r) {
    const b = (x) => ({ x: Kit.r1(x.x), y: Kit.r1(x.y), m: !!(x.vx || x.vy), d: x.dentro });
    return {
      ...this.base(r), n: this.n, bolas: { 1: b(this.bolas[1]), 2: b(this.bolas[2]) }, golpes: { ...this.golpes },
      tarjeta: Kit.copia(this.tarjeta), turno: this.turno, fase: this.fase, mira: Kit.copia(this.mira),
      totales: { 1: this.total(1), 2: this.total(2) },
    };
  }
}
Kit.SIMS.minigolf = MinigolfSim;
