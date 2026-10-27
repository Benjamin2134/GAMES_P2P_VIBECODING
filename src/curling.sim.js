// ==========================================================================
//  Simulacion de CURLING (turnos con fisica). 4 entradas de 8 piedras
//  (4 por jugador, se alternan). Lanzas con direccion, fuerza y giro (la
//  piedra se curva mas al frenar). Mientras tu piedra corre puedes barrer:
//  frena menos y curva menos. Al final de cada entrada puntua el que tiene
//  la piedra mas cerca del centro: una por cada piedra suya mas cerca que la
//  mejor rival. Piedras que no pasan la linea de hog o salen de la pista, fuera.
// ==========================================================================
const CU = (() => {
  const R = 14, X0 = 90, Y0 = 300, CASA = [790, 300], ANILLOS = [76, 52, 28, 9];
  const HOG = 620, FONDO = 880, Y_MIN = 170, Y_MAX = 430;
  const MU = 90, MU_BARRE = 68, CURVA = 16;
  const V0 = (pot) => 240 + clamp(pot, 0, 1) * 460;

  function paso(ps, dt, barre, id) {
    let golpes = 0;
    const sub = 2, d = dt / sub;
    for (let s = 0; s < sub; s++) {
      for (const p of ps) {
        const v = Math.hypot(p.vx, p.vy);
        if (v < 1e-3) continue;
        const b = barre && p.id === id;
        const nv = Math.max(0, v - (b ? MU_BARRE : MU) * d);
        if (nv < 2) { p.vx = 0; p.vy = 0; continue; }
        // giro: aceleracion perpendicular, mayor a baja velocidad
        const k = (p.giro || 0) * CURVA * clamp(1.5 - v / 380, 0.3, 1.3) * (b ? 0.6 : 1) * d;
        const ux = p.vx / v, uy = p.vy / v;
        p.vx = ux * nv - uy * k; p.vy = uy * nv + ux * k;
        p.x += p.vx * d; p.y += p.vy * d;
      }
      for (let a = 0; a < ps.length; a++) for (let c = a + 1; c < ps.length; c++) {
        const A = ps[a], B = ps[c], dx = B.x - A.x, dy = B.y - A.y, dist = Math.hypot(dx, dy);
        if (dist >= 2 * R || dist < 1e-6) continue;
        const nx = dx / dist, ny = dy / dist, sol = (2 * R - dist) / 2;
        A.x -= nx * sol; A.y -= ny * sol; B.x += nx * sol; B.y += ny * sol;
        const vr = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
        if (vr < 0) { const k = vr * 0.96; A.vx += k * nx; A.vy += k * ny; B.vx -= k * nx; B.vy -= k * ny; golpes++; }
      }
    }
    return golpes;
  }
  const quietas = (ps) => ps.every((p) => !p.vx && !p.vy);
  // Fuera: por los costados, pasada la linea de fondo, o detenida antes del hog.
  const fuera = (p, final) => p.y < Y_MIN + R || p.y > Y_MAX - R || p.x > FONDO + R || (final && p.x < HOG);
  const dCasa = (p) => Math.hypot(p.x - CASA[0], p.y - CASA[1]);

  // Puntos de la entrada: [jugador, cantidad] o [0, 0].
  function puntaje(ps) {
    const en = ps.filter((p) => dCasa(p) <= ANILLOS[0] + R).sort((a, b) => dCasa(a) - dCasa(b));
    if (!en.length) return [0, 0];
    const j = en[0].j;
    let n = 0;
    for (const p of en) { if (p.j !== j) break; n++; }
    return [j, n];
  }

  // Lanzamiento completo (lo usa el bot).
  function simular(ps0, j, ang, pot, giro) {
    const ps = ps0.map((p) => ({ ...p }));
    const v = V0(pot);
    ps.push({ id: -1, j, x: X0, y: Y0, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, giro });
    for (let i = 0; i < 60 * 14 && !quietas(ps); i++) {
      paso(ps, 1 / 60, false, -1);
      for (let k = ps.length - 1; k >= 0; k--) if (fuera(ps[k], false)) ps.splice(k, 1);
    }
    return ps.filter((p) => !fuera(p, true));
  }

  return { R, X0, Y0, CASA, ANILLOS, HOG, FONDO, Y_MIN, Y_MAX, V0, paso, quietas, fuera, dCasa, puntaje, simular, ENTRADAS: 4, PIEDRAS: 4 };
})();

class CurlingSim extends SimBase {
  constructor(o) {
    super(o);
    this.entrada = 0;
    this.puntos = { 1: 0, 2: 0 };
    this.sigId = 1;
    this.resumen = null;
    this.nuevaEntrada();
  }
  nuevaEntrada() {
    this.entrada++;
    this.piedras = [];
    this.quedan = { 1: CU.PIEDRAS, 2: CU.PIEDRAS };
    this.turno = this.entrada % 2 ? this.primero : Kit.otro(this.primero);
    this.fase = "apunta";
    this.mira = { ang: 0, pot: 0.25, giro: 1 };
    this.barre = false;
    this.actual = -1;
  }
  input(j, i) {
    if (j !== this.turno || !i) return;
    if (this.fase === "apunta") this.mira = { ang: Kit.num(i.ang, -0.14, 0.14, 0), pot: Kit.num(i.pot, 0, 1, 0.25), giro: i.giro === -1 ? -1 : 1 };
    else if (this.fase === "rueda") this.barre = !!i.barre;
  }
  accion(j, a) {
    if (j !== this.turno || this.fase !== "apunta" || !a.lanza || !this.quedan[j]) return;
    const ang = Kit.num(a.ang, -0.14, 0.14, 0), pot = Kit.num(a.pot, 0, 1, 0.25), giro = a.giro === -1 ? -1 : 1;
    const v = CU.V0(pot);
    this.actual = this.sigId++;
    this.piedras.push({ id: this.actual, j, x: CU.X0, y: CU.Y0, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, giro });
    this.quedan[j]--;
    this.fase = "rueda";
    this.barre = false;
    this.emitir("lanza", { j });
  }
  step(dt) {
    if (this.fase === "rueda") {
      if (CU.paso(this.piedras, dt, this.barre, this.actual)) this.emitir("choque", {});
      for (let k = this.piedras.length - 1; k >= 0; k--) if (CU.fuera(this.piedras[k], false)) { this.piedras.splice(k, 1); this.emitir("fuera", {}); }
      if (CU.quietas(this.piedras)) {
        const antes = this.piedras.length;
        this.piedras = this.piedras.filter((p) => !CU.fuera(p, true));
        if (this.piedras.length < antes) this.emitir("fuera", {});
        this.barre = false;
        if (!this.quedan[1] && !this.quedan[2]) {
          const [j, n] = CU.puntaje(this.piedras);
          if (j) this.puntos[j] += n;
          this.resumen = { j, n, entrada: this.entrada };
          this.fase = "cuenta";
          this.espera = 3.6;
          this.emitir("cuenta", { j, n });
        } else {
          const o = Kit.otro(this.turno);
          this.turno = this.quedan[o] ? o : this.turno;
          this.fase = "apunta";
        }
      }
    } else if (this.fase === "cuenta") {
      this.espera -= dt;
      if (this.espera <= 0) {
        if (this.entrada >= CU.ENTRADAS) this.terminar(this.puntos[1] > this.puntos[2] ? 1 : this.puntos[2] > this.puntos[1] ? 2 : 3);
        else this.nuevaEntrada();
      }
    }
  }
  vista(r) {
    return {
      ...this.base(r), piedras: this.piedras.map((p) => ({ id: p.id, j: p.j, x: Kit.r1(p.x), y: Kit.r1(p.y), m: !!(p.vx || p.vy) })),
      turno: this.turno, fase: this.fase, entrada: this.entrada, quedan: { ...this.quedan }, puntos: { ...this.puntos },
      resumen: this.resumen, mira: { ...this.mira }, barre: this.barre, actual: this.actual,
    };
  }
}
Kit.SIMS.curling = CurlingSim;
