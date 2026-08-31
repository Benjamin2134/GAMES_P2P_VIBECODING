// ==========================================================================
//  Simulacion autoritativa de SPACEWAR 1979 (corre en el host, paso fijo).
//  Fisica newtoniana pura: inercia, rotacion, empuje, wrap-around, balas.
//  Base: PR de @777.dub (feature/arcade-hub-spacewar), adaptada al shell.
// ==========================================================================
const SW = {
  W: 880, H: 540,
  NAVE_R: 14, ROT_VEL: 4.2, THRUST: 380, VEL_MAX: 420,
  FRICC: 0.992,           // decay por paso de 1/120 s (inercia casi total)
  BALA_VEL: 560, BALA_VIDA: 1.4, BALA_CD: 0.22, BALA_R: 3, MAX_BALAS: 6,
  VIDAS: 5, INVULN: 2.0, RESPAWN: 0.9,
  SIM_HZ: 120, SEND_HZ: 40,
  COL_P1: "#39ff14", COL_P2: "#ffb000",
};

class SpacewarSim {
  constructor() { this.reiniciarTodo(); this.seq = 0; }

  reiniciarTodo() {
    this.naves = {
      1: this._nave(SW.W * 0.2, SW.H * 0.5, 0),
      2: this._nave(SW.W * 0.8, SW.H * 0.5, Math.PI),
    };
    this.balas = [];
    this.puntos = { 1: 0, 2: 0 };
    this.vidas = { 1: SW.VIDAS, 2: SW.VIDAS };
    this.revancha = { 1: false, 2: false };
    this.ganador = 0;
    this.cooldowns = { 1: 0, 2: 0 };
    this.respawnEn = { 1: 0, 2: 0 };
    this.inputs = { 1: { rot: 0, thrust: false, fire: false }, 2: { rot: 0, thrust: false, fire: false } };
    this.expl = [];
  }
  _nave(x, y, ang) { return { x, y, vx: 0, vy: 0, ang, thrust: false, invuln: SW.INVULN, viva: true }; }
  _respawn(id) {
    const x = id === 1 ? SW.W * 0.2 : SW.W * 0.8;
    this.naves[id] = this._nave(x, SW.H * 0.5, id === 1 ? 0 : Math.PI);
  }

  aplicarInputHost(i) { this._in(1, i); }
  aplicarInputGuest(i) { this._in(2, i); }
  _in(id, i) {
    const s = this.inputs[id];
    s.rot = i.rot === -1 ? -1 : (i.rot === 1 ? 1 : 0);
    s.thrust = !!i.thrust;
    s.fire = !!i.fire;
  }

  pedirRevancha(n) {
    if (!this.ganador) return;
    this.revancha[n] = true;
    if (this.revancha[1] && this.revancha[2]) this.reiniciarTodo();
  }

  step(dt) {
    if (this.ganador) return;

    for (let id = 1; id <= 2; id++) {
      if (this.respawnEn[id] > 0) {
        this.respawnEn[id] -= dt;
        if (this.respawnEn[id] <= 0) this._respawn(id);
        continue;
      }
      const n = this.naves[id], inp = this.inputs[id];
      if (!n.viva) continue;
      if (n.invuln > 0) n.invuln = Math.max(0, n.invuln - dt);

      n.ang = (n.ang + inp.rot * SW.ROT_VEL * dt + Math.PI * 2) % (Math.PI * 2);
      n.thrust = inp.thrust;
      if (n.thrust) {
        n.vx += Math.cos(n.ang) * SW.THRUST * dt;
        n.vy += Math.sin(n.ang) * SW.THRUST * dt;
        const sp = Math.hypot(n.vx, n.vy);
        if (sp > SW.VEL_MAX) { n.vx = n.vx / sp * SW.VEL_MAX; n.vy = n.vy / sp * SW.VEL_MAX; }
      }
      const f = Math.pow(SW.FRICC, dt * 120);
      n.vx *= f; n.vy *= f;
      n.x += n.vx * dt; n.y += n.vy * dt;
      n.x = (n.x + SW.W) % SW.W; n.y = (n.y + SW.H) % SW.H;

      this.cooldowns[id] = Math.max(0, this.cooldowns[id] - dt);
      if (inp.fire && this.cooldowns[id] <= 0 && this.balas.filter((b) => b.d === id).length < SW.MAX_BALAS) {
        const px = n.x + Math.cos(n.ang) * (SW.NAVE_R + 4);
        const py = n.y + Math.sin(n.ang) * (SW.NAVE_R + 4);
        this.balas.push({
          x: px, y: py,
          vx: n.vx * 0.4 + Math.cos(n.ang) * SW.BALA_VEL,
          vy: n.vy * 0.4 + Math.sin(n.ang) * SW.BALA_VEL,
          d: id, vida: SW.BALA_VIDA, nueva: true,
        });
        this.cooldowns[id] = SW.BALA_CD;
      }
    }

    for (let i = this.balas.length - 1; i >= 0; i--) {
      const b = this.balas[i];
      b.vida -= dt;
      if (b.vida <= 0) { this.balas.splice(i, 1); continue; }
      b.x = (b.x + b.vx * dt + SW.W) % SW.W;
      b.y = (b.y + b.vy * dt + SW.H) % SW.H;
      const rid = b.d === 1 ? 2 : 1;
      const r = this.naves[rid];
      if (r.viva && r.invuln <= 0 && this.respawnEn[rid] <= 0 &&
          Math.hypot(b.x - r.x, b.y - r.y) < SW.NAVE_R + SW.BALA_R) {
        this.balas.splice(i, 1);
        this._impacto(rid, b.d);
      }
    }

    const a = this.naves[1], c = this.naves[2];
    if (a.viva && c.viva && a.invuln <= 0 && c.invuln <= 0 &&
        this.respawnEn[1] <= 0 && this.respawnEn[2] <= 0 &&
        Math.hypot(a.x - c.x, a.y - c.y) < SW.NAVE_R * 2) {
      this._impacto(1, 2); this._impacto(2, 1);
    }
  }

  _impacto(victima, agresor) {
    const n = this.naves[victima];
    this.vidas[victima]--;
    n.viva = false;
    this.expl.push({ x: n.x, y: n.y, c: victima === 1 ? SW.COL_P1 : SW.COL_P2 });
    if (this.vidas[victima] <= 0) { this.puntos[agresor]++; this.ganador = agresor; }
    else this.respawnEn[victima] = SW.RESPAWN;
  }

  snapshot() {
    this.seq = (this.seq + 1) & 0xffff;
    const nv = (n, id) => ({
      x: Math.round(n.x * 10) / 10, y: Math.round(n.y * 10) / 10,
      vx: Math.round(n.vx), vy: Math.round(n.vy),
      ang: Math.round(n.ang * 1000) / 1000,
      th: n.thrust, iv: n.invuln > 0, vv: n.viva && this.respawnEn[id] <= 0,
      vd: this.vidas[id],
    });
    const expl = this.expl; this.expl = [];
    return {
      t: "e", seq: this.seq,
      n1: nv(this.naves[1], 1), n2: nv(this.naves[2], 2),
      b: this.balas.slice(0, 14).map((b) => [Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy), b.d]),
      p1: this.puntos[1], p2: this.puntos[2],
      ganador: this.ganador,
      rev1: this.revancha[1], rev2: this.revancha[2],
      expl: expl.length ? expl : null,
    };
  }
}
