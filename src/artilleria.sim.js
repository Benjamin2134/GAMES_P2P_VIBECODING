// ==========================================================================
//  Simulacion de ARTILLERIA (turnos con fisica). Dos cañones sobre un
//  terreno destructible: en tu turno ajustas angulo y potencia y disparas.
//  Gravedad + viento que cambia cada turno. Cada explosion abre un crater,
//  daña por cercania y los tanques caen al nuevo suelo. Pierde quien llega a 0.
//  alt[k] = altura (y) del suelo en x = k * PASO.
// ==========================================================================
const ART = {
  W: 960, H: 600, PASO: 4, N: 241,
  G: 520, VMAX: 820, VIENTO: 90, R_EXPL: 44, DANO: 46, R_TANQUE: 16,
  // Terreno: suma de ondas suaves con dos mesetas para los tanques.
  terreno(rnd) {
    const a1 = rnd() * 6.28, a2 = rnd() * 6.28, a3 = rnd() * 6.28, alto = 60 + rnd() * 70;
    const alt = [];
    for (let k = 0; k < ART.N; k++) {
      const x = k / (ART.N - 1);
      alt.push(Math.round(420 - Math.sin(x * Math.PI) * alto - Math.sin(x * 9 + a1) * 26 - Math.sin(x * 17 + a2) * 12 - Math.sin(x * 4 + a3) * 30));
    }
    return alt;
  },
  suelo(alt, x) {
    const k = clamp(x / ART.PASO, 0, ART.N - 1), k0 = Math.floor(k), k1 = Math.min(ART.N - 1, k0 + 1);
    return lerp(alt[k0], alt[k1], k - k0);
  },
  // Vuelo completo de una bala (lo usan la sim y el bot). Devuelve donde explota.
  // salida: null si se va del mapa por los lados o abajo.
  vuelo(alt, tanques, tirador, ang, pot, viento, dt = 1 / 120) {
    const t = tanques[tirador];
    const v = (clamp(pot, 0, 100) / 100) * ART.VMAX;
    let x = t.x + Math.cos(ang) * 22, y = t.y - 10 - Math.sin(ang) * 22;
    let vx = Math.cos(ang) * v, vy = -Math.sin(ang) * v;
    for (let i = 0; i < 120 * 12; i++) {
      const p = ART.paso({ x, y, vx, vy }, viento, dt);
      x = p.x; y = p.y; vx = p.vx; vy = p.vy;
      const imp = ART.impacto(alt, tanques, x, y);
      if (imp) return { x, y, ...imp };
      if (x < -60 || x > ART.W + 60 || y > ART.H + 40) return null;
    }
    return null;
  },
  paso(b, viento, dt) {
    const vx = b.vx + viento * ART.VIENTO * dt, vy = b.vy + ART.G * dt;
    return { x: b.x + vx * dt, y: b.y + vy * dt, vx, vy };
  },
  impacto(alt, tanques, x, y) {
    for (const j of [1, 2]) {
      const t = tanques[j];
      if (t.hp > 0 && Math.hypot(x - t.x, y - (t.y - 8)) < ART.R_TANQUE) return { tanque: j };
    }
    if (x >= 0 && x <= ART.W && y >= ART.suelo(alt, x)) return { tanque: 0 };
    return null;
  },
};

class ArtilleriaSim extends SimBase {
  constructor(o) {
    super(o);
    const rnd = Kit.semilla(Math.floor(Math.random() * 1e9));
    this.alt = ART.terreno(rnd);
    const x1 = 90 + Math.random() * 80, x2 = ART.W - 90 - Math.random() * 80;
    this.tanques = {
      1: { x: x1, y: 0, hp: 100, ang: Math.PI / 4, pot: 60 },
      2: { x: x2, y: 0, hp: 100, ang: (Math.PI * 3) / 4, pot: 60 },
    };
    for (const j of [1, 2]) this.aplanar(this.tanques[j].x);
    this.asentar();
    this.turno = this.primero;
    this.fase = "apunta";      // apunta | vuela | pausa
    this.bala = null;
    this.espera = 0;
    this.viento = this.nuevoViento();
    this.disparos = 0;
  }
  nuevoViento() { return Math.round((Math.random() * 2 - 1) * 10) / 10; }
  aplanar(x) {
    const k0 = Math.round(x / ART.PASO), h = this.alt[k0];
    for (let d = -6; d <= 6; d++) if (k0 + d >= 0 && k0 + d < ART.N) this.alt[k0 + d] = h;
  }
  asentar() { for (const j of [1, 2]) this.tanques[j].y = ART.suelo(this.alt, this.tanques[j].x); }
  input(j, i) {
    if (j !== this.turno || this.fase !== "apunta" || !i) return;
    const t = this.tanques[j];
    t.ang = Kit.num(i.ang, 0.05, Math.PI - 0.05, t.ang);
    t.pot = Kit.num(i.pot, 5, 100, t.pot);
  }
  accion(j, a) {
    if (j !== this.turno || this.fase !== "apunta" || !a.fuego) return;
    this.input(j, a);
    const t = this.tanques[j];
    const v = (t.pot / 100) * ART.VMAX;
    this.bala = { x: t.x + Math.cos(t.ang) * 22, y: t.y - 10 - Math.sin(t.ang) * 22, vx: Math.cos(t.ang) * v, vy: -Math.sin(t.ang) * v };
    this.fase = "vuela";
    this.disparos++;
    this.emitir("disparo", { j });
  }
  step(dt) {
    if (this.fase === "vuela") {
      const b = ART.paso(this.bala, this.viento, dt);
      this.bala = b;
      const imp = ART.impacto(this.alt, this.tanques, b.x, b.y);
      if (imp) this.explotar(b.x, b.y, imp.tanque);
      else if (b.x < -60 || b.x > ART.W + 60 || b.y > ART.H + 40) { this.bala = null; this.fase = "pausa"; this.espera = 0.6; this.emitir("fuera", {}); }
    } else if (this.fase === "pausa") {
      this.espera -= dt;
      if (this.espera <= 0) {
        if (this.tanques[1].hp <= 0 || this.tanques[2].hp <= 0) {
          const a = this.tanques[1].hp > 0, b = this.tanques[2].hp > 0;
          this.terminar(a ? 1 : b ? 2 : 3);
          return;
        }
        this.turno = Kit.otro(this.turno);
        this.viento = this.nuevoViento();
        this.fase = "apunta";
      }
    }
  }
  explotar(x, y, directo) {
    const R = ART.R_EXPL;
    for (let k = 0; k < ART.N; k++) {
      const dx = k * ART.PASO - x;
      if (Math.abs(dx) >= R) continue;
      const h = Math.sqrt(R * R - dx * dx);
      if (this.alt[k] < y + h && this.alt[k] > y - h - 30) this.alt[k] = Math.min(ART.H - 4, Math.round(y + h));
    }
    const danos = {};
    for (const j of [1, 2]) {
      const t = this.tanques[j];
      const d = Math.hypot(t.x - x, t.y - 8 - y);
      let dano = 0;
      if (directo === j) dano = ART.DANO;
      else if (d < R + ART.R_TANQUE) dano = Math.round(ART.DANO * 0.8 * (1 - d / (R + ART.R_TANQUE)) + 6);
      if (dano) { t.hp = Math.max(0, t.hp - dano); danos[j] = dano; }
    }
    this.asentar();
    this.bala = null;
    this.fase = "pausa";
    this.espera = 1.1;
    this.emitir("expl", { x: Math.round(x), y: Math.round(y), d1: danos[1] || 0, d2: danos[2] || 0 });
  }
  vista(r) {
    const tq = (t) => ({ x: Kit.r1(t.x), y: Kit.r1(t.y), hp: t.hp, ang: Kit.r2(t.ang), pot: Math.round(t.pot) });
    return {
      ...this.base(r), alt: this.alt.slice(), tanques: { 1: tq(this.tanques[1]), 2: tq(this.tanques[2]) },
      turno: this.turno, fase: this.fase, viento: this.viento,
      bala: this.bala ? { x: Kit.r1(this.bala.x), y: Kit.r1(this.bala.y) } : null,
    };
  }
}
Kit.SIMS.artilleria = ArtilleriaSim;
