// ==========================================================================
//  Simulación autoritativa de SPACEWAR (corre SOLO en el host a 120 Hz).
//  Física newtoniana pura, inercia, colisiones y sincronización P2P.
// ==========================================================================

class PartidaSpacewar {
  constructor() {
    this.reiniciarTodo();
    this.pausas = { host: false, guest: false };
    this._estabaPausada = false;
    this.seq = 0;
  }

  reiniciarTodo() {
    this.naves = {
      1: this.crearNave(SW_ANCHO * 0.2, SW_ALTO * 0.5, 0),        // P1 mira al este (0 rad)
      2: this.crearNave(SW_ANCHO * 0.8, SW_ALTO * 0.5, Math.PI),   // P2 mira al oeste (PI rad)
    };
    this.balas = [];
    this.puntos = { 1: 0, 2: 0 };      // Rondas ganadas
    this.vidas = { 1: SW_VIDAS_MAX, 2: SW_VIDAS_MAX };
    this.revancha = { 1: false, 2: false };
    this.ganador = null;
    this.cooldowns = { 1: 0, 2: 0 };
    this.inputs = {
      1: { rot: 0, thrust: false, fire: false },
      2: { rot: 0, thrust: false, fire: false }
    };
    this.explosiones = []; // Para efectos visuales sincronizados
  }

  crearNave(x, y, angulo) {
    return {
      x, y,
      vx: 0, vy: 0,
      ang: angulo,
      thrust: false,
      invuln: SW_INVULN_SPAWN_S,
      viva: true
    };
  }

  respawnNave(id) {
    const x = id === 1 ? SW_ANCHO * 0.2 : SW_ANCHO * 0.8;
    const y = SW_ALTO * 0.5;
    const ang = id === 1 ? 0 : Math.PI;
    this.naves[id] = this.crearNave(x, y, ang);
  }

  get pausada() { return this.pausas.host || this.pausas.guest; }

  pedirRevancha(n) {
    if (!this.ganador) return;
    this.revancha[n] = true;
    if (this.revancha[1] && this.revancha[2]) {
      this.reiniciarTodo();
    }
  }

  // Aplicar input del Guest (con anti-cheat y validación)
  aplicarInputGuest(input) {
    this.inputs[2].rot = input.rot === -1 ? -1 : (input.rot === 1 ? 1 : 0);
    this.inputs[2].thrust = !!input.thrust;
    this.inputs[2].fire = !!input.fire;
  }

  // Aplicar input del Host
  aplicarInputHost(input) {
    this.inputs[1].rot = input.rot === -1 ? -1 : (input.rot === 1 ? 1 : 0);
    this.inputs[1].thrust = !!input.thrust;
    this.inputs[1].fire = !!input.fire;
  }

  step(dt) {
    if (this.pausada) { this._estabaPausada = true; return; }
    if (this._estabaPausada) { this._estabaPausada = false; }
    if (this.ganador) return;

    // 1. Procesar naves
    for (let id = 1; id <= 2; id++) {
      const nave = this.naves[id];
      const inpt = this.inputs[id];
      if (!nave.viva) continue;

      if (nave.invuln > 0) {
        nave.invuln = Math.max(0, nave.invuln - dt);
      }

      // Rotación
      nave.ang += inpt.rot * SW_ROT_VEL * dt;
      // Normalizar ángulo entre 0 y 2*PI
      nave.ang = (nave.ang + Math.PI * 2) % (Math.PI * 2);

      // Empuje / Thrust
      nave.thrust = inpt.thrust;
      if (nave.thrust) {
        nave.vx += Math.cos(nave.ang) * SW_THRUST_ACC * dt;
        nave.vy += Math.sin(nave.ang) * SW_THRUST_ACC * dt;

        // Limitar velocidad máxima
        const speed = Math.hypot(nave.vx, nave.vy);
        if (speed > SW_VEL_MAX) {
          nave.vx = (nave.vx / speed) * SW_VEL_MAX;
          nave.vy = (nave.vy / speed) * SW_VEL_MAX;
        }
      }

      // Fricción espacial mínima
      nave.vx *= Math.pow(SW_FRICCION, dt * 120);
      nave.vy *= Math.pow(SW_FRICCION, dt * 120);

      // Mover posición
      nave.x += nave.vx * dt;
      nave.y += nave.vy * dt;

      // Wrap-around toroidal en bordes
      if (SW_WRAP_AROUND) {
        if (nave.x < 0) nave.x += SW_ANCHO;
        else if (nave.x >= SW_ANCHO) nave.x -= SW_ANCHO;
        if (nave.y < 0) nave.y += SW_ALTO;
        else if (nave.y >= SW_ALTO) nave.y -= SW_ALTO;
      }

      // Disparar
      this.cooldowns[id] = Math.max(0, this.cooldowns[id] - dt);
      if (inpt.fire && this.cooldowns[id] <= 0) {
        const balasDeNave = this.balas.filter(b => b.duenio === id).length;
        if (balasDeNave < SW_MAX_BALAS) {
          this.disparar(id, nave);
          this.cooldowns[id] = SW_BALA_COOLDOWN;
        }
      }
    }

    // 2. Mover y limpiar proyectiles
    for (let i = this.balas.length - 1; i >= 0; i--) {
      const b = this.balas[i];
      b.vida -= dt;
      if (b.vida <= 0) {
        this.balas.splice(i, 1);
        continue;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (SW_WRAP_AROUND) {
        if (b.x < 0) b.x += SW_ANCHO;
        else if (b.x >= SW_ANCHO) b.x -= SW_ANCHO;
        if (b.y < 0) b.y += SW_ALTO;
        else if (b.y >= SW_ALTO) b.y -= SW_ALTO;
      }

      // 3. Chequear colisión de bala contra la nave rival
      const rivalId = b.duenio === 1 ? 2 : 1;
      const rival = this.naves[rivalId];

      if (rival.viva && rival.invuln <= 0) {
        const dist = Math.hypot(b.x - rival.x, b.y - rival.y);
        if (dist < SW_NAVE_RADIO + SW_BALA_RADIO) {
          // Impacto!
          this.balas.splice(i, 1);
          this.impactoNave(rivalId, b.duenio);
          continue;
        }
      }
    }

    // 4. Chequear colisión Nave vs Nave
    const n1 = this.naves[1], n2 = this.naves[2];
    if (n1.viva && n2.viva && n1.invuln <= 0 && n2.invuln <= 0) {
      const distNaves = Math.hypot(n1.x - n2.x, n1.y - n2.y);
      if (distNaves < SW_NAVE_RADIO * 2) {
        // Choque frontal mutuo
        this.impactoNave(1, 2);
        this.impactoNave(2, 1);
      }
    }
  }

  disparar(id, nave) {
    // Punta de la nave
    const puntaX = nave.x + Math.cos(nave.ang) * (SW_NAVE_RADIO + 4);
    const puntaY = nave.y + Math.sin(nave.ang) * (SW_NAVE_RADIO + 4);
    
    // Velocidad de bala = impulso cañón + inercia de la nave
    const bvx = nave.vx * 0.4 + Math.cos(nave.ang) * SW_BALA_VEL;
    const bvy = nave.vy * 0.4 + Math.sin(nave.ang) * SW_BALA_VEL;

    this.balas.push({
      x: puntaX,
      y: puntaY,
      vx: bvx,
      vy: bvy,
      duenio: id,
      vida: SW_BALA_VIDA_S
    });
  }

  impactoNave(impactadoId, agresorId) {
    this.vidas[impactadoId]--;
    this.naves[impactadoId].viva = false;

    // Registrar evento de explosión
    this.explosiones.push({
      x: this.naves[impactadoId].x,
      y: this.naves[impactadoId].y,
      color: impactadoId === 1 ? "#39ff14" : "#ffb000"
    });

    if (this.vidas[impactadoId] <= 0) {
      this.puntos[agresorId]++;
      this.ganador = agresorId;
    } else {
      // Respawn tras breve delay
      setTimeout(() => {
        if (!this.ganador) this.respawnNave(impactadoId);
      }, 900);
    }
  }

  // Genera snapshot plano para serializar y enviar por WebRTC
  snapshot() {
    this.seq = (this.seq + 1) & 0xffff;
    const n1 = this.naves[1], n2 = this.naves[2];

    // Serializar hasta 12 balas en formato compacto
    const balasCompactas = this.balas.slice(0, 12).map(b => ({
      x: Math.round(b.x),
      y: Math.round(b.y),
      vx: Math.round(b.vx),
      vy: Math.round(b.vy),
      d: b.duenio
    }));

    return {
      seq: this.seq,
      n1: {
        x: n1.x, y: n1.y, vx: n1.vx, vy: n1.vy,
        ang: n1.ang,
        thrust: n1.thrust,
        invuln: n1.invuln > 0,
        viva: n1.viva,
        vidas: this.vidas[1]
      },
      n2: {
        x: n2.x, y: n2.y, vx: n2.vx, vy: n2.vy,
        ang: n2.ang,
        thrust: n2.thrust,
        invuln: n2.invuln > 0,
        viva: n2.viva,
        vidas: this.vidas[2]
      },
      balas: balasCompactas,
      p1: this.puntos[1],
      p2: this.puntos[2],
      ganador: this.ganador || 0,
      pausa: this.pausas.host ? 1 : (this.pausas.guest ? 2 : 0),
      rev1: this.revancha[1],
      rev2: this.revancha[2]
    };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { PartidaSpacewar };
}
