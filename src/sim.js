// ==========================================================================
//  Simulacion autoritativa de Pong. Corre dentro del Web Worker del HOST.
//  No toca el DOM ni la red: recibe inputs y emite estados por callback.
// ==========================================================================
class Partida {
  constructor(onEstado) {
    this.onEstado = onEstado;
    this.pala = { 1: (CAMPO_ALTO - PALA_ALTO) / 2, 2: (CAMPO_ALTO - PALA_ALTO) / 2 };
    this.input = { 1: { arriba: false, abajo: false }, 2: { arriba: false, abajo: false } };
    this.puntos = { 1: 0, 2: 0 };
    this.revancha = { 1: false, 2: false };
    this.ganador = null;
    this.bola = { x: CAMPO_ANCHO / 2, y: CAMPO_ALTO / 2, vx: 0, vy: 0 };
    this.sirveEn = Date.now() + PAUSA_SERVE_MS;
    this.haciaJugador = Math.random() < 0.5 ? 1 : 2;
    this.pausas = { host: false, guest: false };
    this._estabaPausada = false;
    this.loop = setInterval(() => this.tick(), TICK_MS);
  }
  detener() { clearInterval(this.loop); }

  get pausada() { return this.pausas.host || this.pausas.guest; }

  resetBola(hacia) {
    this.bola = { x: CAMPO_ANCHO / 2, y: CAMPO_ALTO / 2, vx: 0, vy: 0 };
    this.haciaJugador = hacia;
    this.sirveEn = Date.now() + PAUSA_SERVE_MS;
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
      this.puntos = { 1: 0, 2: 0 };
      this.revancha = { 1: false, 2: false };
      this.ganador = null;
      this.pala = { 1: (CAMPO_ALTO - PALA_ALTO) / 2, 2: (CAMPO_ALTO - PALA_ALTO) / 2 };
      this.resetBola(Math.random() < 0.5 ? 1 : 2);
    }
  }
  tick() {
    if (this.pausada) {
      this._estabaPausada = true;
      this.onEstado(this.serializar());
      return;
    }
    if (this._estabaPausada) {
      // al reanudar, si estabamos por sacar, damos un respiro para reaccionar
      this._estabaPausada = false;
      if (this.bola.vx === 0 && this.bola.vy === 0) this.sirveEn = Date.now() + 900;
    }
    if (!this.ganador) {
      for (const j of [1, 2]) {
        let dy = 0;
        if (this.input[j].arriba) dy -= PALA_VEL;
        if (this.input[j].abajo) dy += PALA_VEL;
        this.pala[j] = clamp(this.pala[j] + dy, 0, CAMPO_ALTO - PALA_ALTO);
      }
      if (this.bola.vx === 0 && this.bola.vy === 0) {
        if (Date.now() >= this.sirveEn) this.lanzarBola();
      } else {
        this.moverBola();
      }
    }
    this.onEstado(this.serializar());
  }
  moverBola() {
    const b = this.bola, prevX = b.x;
    b.x += b.vx; b.y += b.vy;
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
    const vel = Math.min(Math.hypot(b.vx, b.vy) * 1.06, BOLA_VEL_MAX);
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
  serializar() {
    const ahora = Date.now();
    const sirviendo = !this.ganador && this.bola.vx === 0 && this.bola.vy === 0;
    const r = (n) => Math.round(n * 100) / 100;
    return {
      t: "estado",
      b: { x: r(this.bola.x), y: r(this.bola.y) },
      p: { 1: r(this.pala[1]), 2: r(this.pala[2]) },
      s: { 1: this.puntos[1], 2: this.puntos[2] },
      sirviendo,
      cuenta: sirviendo ? Math.max(0, Math.ceil((this.sirveEn - ahora) / 1000)) : 0,
      ganador: this.ganador,
      revancha: { ...this.revancha },
      pausa: this.pausada ? (this.pausas.host ? "host" : "guest") : null,
    };
  }
}
