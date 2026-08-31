// ==========================================================================
//  Simulacion autoritativa de PONG (corre en el host).
//  Fisica por dt en segundos; paso fijo desde el frame del shell.
// ==========================================================================
const PONG = {
  CAMPO_W: 820, CAMPO_H: 480,
  PALA_W: 12, PALA_H: 84, PALA_MARGEN: 24,
  PALA_VEL: 360,            // px/s
  BOLA_R: 7, BOLA_VI: 312, BOLA_VMAX: 780, BOLA_ACEL: 1.06,
  SIM_HZ: 120, SEND_HZ: 60,
  GANA: 5, SERVE_MS: 2200,
};

class PongSim {
  constructor() {
    const cy = (PONG.CAMPO_H - PONG.PALA_H) / 2;
    this.pala = { 1: cy, 2: cy };
    this.dir1 = 0;
    this.puntos = { 1: 0, 2: 0 };
    this.revancha = { 1: false, 2: false };
    this.ganador = 0;
    this.bola = { x: PONG.CAMPO_W / 2, y: PONG.CAMPO_H / 2, vx: 0, vy: 0 };
    this.sirveMs = PONG.SERVE_MS;
    this.hacia = Math.random() < 0.5 ? 1 : 2;
    this.seq = 0;
  }
  get sirviendo() { return !this.ganador && this.bola.vx === 0 && this.bola.vy === 0; }

  resetBola(hacia) {
    this.bola = { x: PONG.CAMPO_W / 2, y: PONG.CAMPO_H / 2, vx: 0, vy: 0 };
    this.hacia = hacia; this.sirveMs = PONG.SERVE_MS;
  }
  lanzar() {
    const d = this.hacia === 1 ? -1 : 1;
    const a = (Math.random() * 2 - 1) * (Math.PI / 5);
    this.bola.vx = d * PONG.BOLA_VI * Math.cos(a);
    this.bola.vy = PONG.BOLA_VI * Math.sin(a);
  }
  pedirRevancha(n) {
    if (!this.ganador) return;
    this.revancha[n] = true;
    if (this.revancha[1] && this.revancha[2]) {
      const cy = (PONG.CAMPO_H - PONG.PALA_H) / 2;
      this.puntos = { 1: 0, 2: 0 }; this.revancha = { 1: false, 2: false };
      this.ganador = 0; this.pala = { 1: cy, 2: cy };
      this.resetBola(Math.random() < 0.5 ? 1 : 2);
    }
  }
  // el host llama esto con la posicion que reporta el guest, limitada a la
  // velocidad fisica posible desde el ultimo update (anti-teleport)
  aplicarPala2(y, dtReal) {
    const maxPaso = PONG.PALA_VEL * Math.max(dtReal, 0) + 2;
    const obj = clamp(y, 0, PONG.CAMPO_H - PONG.PALA_H);
    this.pala[2] = clamp(obj, this.pala[2] - maxPaso, this.pala[2] + maxPaso);
  }

  step(dt) {
    if (this.ganador) return;
    this.pala[1] = clamp(this.pala[1] + this.dir1 * PONG.PALA_VEL * dt, 0, PONG.CAMPO_H - PONG.PALA_H);
    if (this.bola.vx === 0 && this.bola.vy === 0) {
      this.sirveMs -= dt * 1000;
      if (this.sirveMs <= 0) this.lanzar();
      return;
    }
    const b = this.bola, prevX = b.x;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y - PONG.BOLA_R < 0) { b.y = PONG.BOLA_R; b.vy = Math.abs(b.vy); }
    else if (b.y + PONG.BOLA_R > PONG.CAMPO_H) { b.y = PONG.CAMPO_H - PONG.BOLA_R; b.vy = -Math.abs(b.vy); }

    const p1 = PONG.PALA_MARGEN + PONG.PALA_W;
    if (b.vx < 0 && prevX - PONG.BOLA_R >= p1 && b.x - PONG.BOLA_R <= p1 &&
        b.y >= this.pala[1] && b.y <= this.pala[1] + PONG.PALA_H) this._rebote(1, p1);
    const p2 = PONG.CAMPO_W - PONG.PALA_MARGEN - PONG.PALA_W;
    if (b.vx > 0 && prevX + PONG.BOLA_R <= p2 && b.x + PONG.BOLA_R >= p2 &&
        b.y >= this.pala[2] && b.y <= this.pala[2] + PONG.PALA_H) this._rebote(2, p2);

    if (b.x + PONG.BOLA_R < 0) this._punto(2);
    else if (b.x - PONG.BOLA_R > PONG.CAMPO_W) this._punto(1);
  }
  _rebote(j, plano) {
    const b = this.bola;
    const c = this.pala[j] + PONG.PALA_H / 2;
    const rel = clamp((b.y - c) / (PONG.PALA_H / 2), -1, 1);
    const a = rel * (Math.PI / 4);
    const v = Math.min(Math.hypot(b.vx, b.vy) * PONG.BOLA_ACEL, PONG.BOLA_VMAX);
    const d = j === 1 ? 1 : -1;
    b.vx = d * v * Math.cos(a); b.vy = v * Math.sin(a);
    b.x = j === 1 ? plano + PONG.BOLA_R : plano - PONG.BOLA_R;
  }
  _punto(j) {
    this.puntos[j]++;
    if (this.puntos[j] >= PONG.GANA) { this.ganador = j; this.bola.vx = this.bola.vy = 0; }
    else this.resetBola(j === 1 ? 2 : 1);
  }
  snapshot() {
    this.seq = (this.seq + 1) & 0xffff;
    return {
      seq: this.seq,
      bx: this.bola.x, by: this.bola.y, bvx: this.bola.vx, bvy: this.bola.vy,
      p1: this.pala[1], p2: this.pala[2],
      s1: this.puntos[1], s2: this.puntos[2],
      sirviendo: this.sirviendo,
      cuenta: this.sirviendo ? Math.max(0, Math.ceil(this.sirveMs / 1000)) : 0,
      ganador: this.ganador,
      rev1: this.revancha[1], rev2: this.revancha[2],
    };
  }
}
