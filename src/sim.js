// ==========================================================================
//  Simulacion autoritativa de Pong (corre SOLO en el host).
//  Fisica por dt en segundos, paso fijo de 1/SIM_HZ desde el loop.
//  - Pala 1 (host): se mueve por this.dir1  (-1 arriba / 0 / +1 abajo)
//  - Pala 2 (rival): la fija el host con aplicarPala2() a partir de los
//    paquetes del guest, con LIMITE DE VELOCIDAD (anti-teleport / anti-cheat).
//  - Pelota y goles: 100% autoridad del host.
// ==========================================================================
class Partida {
  constructor() {
    const cy = (CAMPO_ALTO - PALA_ALTO) / 2;
    this.pala = { 1: cy, 2: cy };
    this.dir1 = 0;                       // input de la pala del host
    this.puntos = { 1: 0, 2: 0 };
    this.revancha = { 1: false, 2: false };
    this.ganador = null;
    this.bola = { x: CAMPO_ANCHO / 2, y: CAMPO_ALTO / 2, vx: 0, vy: 0 };
    this.sirveMs = PAUSA_SERVE_MS;       // ms que faltan para el saque
    this.haciaJugador = Math.random() < 0.5 ? 1 : 2;
    this.pausas = { host: false, guest: false };
    this._estabaPausada = false;
    this.seq = 0;                        // numero de snapshot (uint16)
  }

  get pausada() { return this.pausas.host || this.pausas.guest; }
  get sirviendo() { return !this.ganador && this.bola.vx === 0 && this.bola.vy === 0; }

  resetBola(hacia) {
    this.bola = { x: CAMPO_ANCHO / 2, y: CAMPO_ALTO / 2, vx: 0, vy: 0 };
    this.haciaJugador = hacia;
    this.sirveMs = PAUSA_SERVE_MS;
  }
  lanzarBola() {
    const dir = this.haciaJugador === 1 ? -1 : 1;
    const ang = (Math.random() * 2 - 1) * (Math.PI / 5);
    this.bola.vx = dir * BOLA_VEL_INI * Math.cos(ang);
    this.bola.vy = BOLA_VEL_INI * Math.sin(ang);
  }
  pedirRevancha(n) {
    if (!this.ganador) return;
    this.revancha[n] = true;
    if (this.revancha[1] && this.revancha[2]) {
      const cy = (CAMPO_ALTO - PALA_ALTO) / 2;
      this.puntos = { 1: 0, 2: 0 };
      this.revancha = { 1: false, 2: false };
      this.ganador = null;
      this.pala = { 1: cy, 2: cy };
      this.resetBola(Math.random() < 0.5 ? 1 : 2);
    }
  }

  // El host llama esto con la posicion que reporta el guest. Se acepta pero
  // limitada a lo fisicamente posible desde el ultimo update (dtReal segundos).
  aplicarPala2(y, dtReal) {
    const maxPaso = PALA_VEL_PS * Math.max(dtReal, 0) + 2; // +2px de tolerancia
    const objetivo = clamp(y, 0, CAMPO_ALTO - PALA_ALTO);
    this.pala[2] = clamp(objetivo, this.pala[2] - maxPaso, this.pala[2] + maxPaso);
  }

  // Un paso de fisica de dt segundos.
  step(dt) {
    if (this.pausada) { this._estabaPausada = true; return; }
    if (this._estabaPausada) {
      this._estabaPausada = false;
      if (this.sirviendo) this.sirveMs = Math.max(this.sirveMs, 900);
    }
    if (this.ganador) return;

    this.pala[1] = clamp(this.pala[1] + this.dir1 * PALA_VEL_PS * dt, 0, CAMPO_ALTO - PALA_ALTO);

    if (this.bola.vx === 0 && this.bola.vy === 0) {
      this.sirveMs -= dt * 1000;
      if (this.sirveMs <= 0) this.lanzarBola();
      return;
    }
    this.moverBola(dt);
  }

  moverBola(dt) {
    const b = this.bola, prevX = b.x;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.y - BOLA_RADIO < 0) { b.y = BOLA_RADIO; b.vy = Math.abs(b.vy); }
    else if (b.y + BOLA_RADIO > CAMPO_ALTO) { b.y = CAMPO_ALTO - BOLA_RADIO; b.vy = -Math.abs(b.vy); }

    const plano1 = PALA_MARGEN + PALA_ANCHO;
    if (b.vx < 0 && prevX - BOLA_RADIO >= plano1 && b.x - BOLA_RADIO <= plano1 &&
        b.y >= this.pala[1] && b.y <= this.pala[1] + PALA_ALTO) this.rebote(1, plano1);

    const plano2 = CAMPO_ANCHO - PALA_MARGEN - PALA_ANCHO;
    if (b.vx > 0 && prevX + BOLA_RADIO <= plano2 && b.x + BOLA_RADIO >= plano2 &&
        b.y >= this.pala[2] && b.y <= this.pala[2] + PALA_ALTO) this.rebote(2, plano2);

    if (b.x + BOLA_RADIO < 0) this.punto(2);
    else if (b.x - BOLA_RADIO > CAMPO_ANCHO) this.punto(1);
  }

  rebote(j, plano) {
    const b = this.bola;
    const centro = this.pala[j] + PALA_ALTO / 2;
    const rel = clamp((b.y - centro) / (PALA_ALTO / 2), -1, 1);
    const ang = rel * (Math.PI / 4);
    const vel = Math.min(Math.hypot(b.vx, b.vy) * BOLA_ACEL, BOLA_VEL_MAX);
    const dir = j === 1 ? 1 : -1;
    b.vx = dir * vel * Math.cos(ang);
    b.vy = vel * Math.sin(ang);
    b.x = j === 1 ? plano + BOLA_RADIO : plano - BOLA_RADIO;
  }

  punto(j) {
    this.puntos[j]++;
    if (this.puntos[j] >= PUNTOS_PARA_GANAR) { this.ganador = j; this.bola.vx = 0; this.bola.vy = 0; }
    else this.resetBola(j === 1 ? 2 : 1);
  }

  // Estado plano para serializar (el host lo codifica a binario).
  snapshot() {
    this.seq = (this.seq + 1) & 0xffff;
    return {
      seq: this.seq,
      bx: this.bola.x, by: this.bola.y, bvx: this.bola.vx, bvy: this.bola.vy,
      p1: this.pala[1], p2: this.pala[2],
      s1: this.puntos[1], s2: this.puntos[2],
      sirviendo: this.sirviendo,
      cuenta: this.sirviendo ? Math.max(0, Math.ceil(this.sirveMs / 1000)) : 0,
      ganador: this.ganador || 0,
      pausa: this.pausas.host ? 1 : (this.pausas.guest ? 2 : 0),
      rev1: this.revancha[1], rev2: this.revancha[2],
    };
  }
}
