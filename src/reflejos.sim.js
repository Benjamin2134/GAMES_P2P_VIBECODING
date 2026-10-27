// ==========================================================================
//  Simulacion de DUELO DE REFLEJOS (rondas). Se espera una señal al azar;
//  gana la ronda el que reacciona mas rapido. Apretar antes = salida en
//  falso (pierdes la ronda). A veces hay una señal trampa (amarilla).
//  Justicia con latencia: cada lado mide SU tiempo de reaccion desde que vio
//  la señal en su pantalla, y el host compara milisegundos. Primero a 5.
// ==========================================================================
const RF = { RONDAS: 5, LIMITE: 2.5, TRAMPA: 0.25 };

class ReflejosSim extends SimBase {
  constructor(o) {
    super(o);
    this.puntos = { 1: 0, 2: 0 };
    this.r = 0;
    this.nuevaRonda();
  }
  nuevaRonda() {
    this.r++;
    this.fase = "espera";
    this.espera = Kit.rnd(1.6, 4.2);
    this.trampa = Math.random() < RF.TRAMPA;
    this.ms = { 1: null, 2: null };
    this.res = null;
  }
  step(dt) {
    this.espera -= dt;
    if (this.fase === "espera" && this.espera <= 0) {
      if (this.trampa) { this.fase = "trampa"; this.espera = 1.1; this.trampa = false; }
      else { this.fase = "ya"; this.espera = RF.LIMITE; this.emitir("ya", { r: this.r }); }
    } else if (this.fase === "trampa" && this.espera <= 0) { this.fase = "espera"; this.espera = Kit.rnd(1.0, 2.5); }
    else if (this.fase === "ya" && this.espera <= 0) this.resolver();
    else if (this.fase === "res" && this.espera <= 0) {
      const g = this.puntos[1] >= RF.RONDAS ? 1 : this.puntos[2] >= RF.RONDAS ? 2 : 0;
      if (g) this.terminar(g); else this.nuevaRonda();
    }
  }
  accion(j, a) {
    if (Kit.ent(a.r, 1, 1e6) !== this.r || this.fase === "res") return;
    // salida en falso: el que aprieta la vio en espera o trampa (aunque el aviso llegue ya en "ya")
    if (this.fase === "espera" || this.fase === "trampa" || a.falso) {
      if (this.ms[j] !== null) return;
      this.res = { falso: j, g: Kit.otro(j) };
      this.cerrar();
      return;
    }
    if (this.ms[j] !== null) return;
    this.ms[j] = Kit.num(a.ms, 60, 5000, 5000);
    if (this.ms[1] !== null && this.ms[2] !== null) this.resolver();
  }
  resolver() {
    const a = this.ms[1], b = this.ms[2];
    let g = 0;
    if (a !== null && (b === null || a < b)) g = 1;
    else if (b !== null && (a === null || b < a)) g = 2;
    this.res = { g, ms: { ...this.ms } };
    this.cerrar();
  }
  cerrar() {
    if (this.res.g) this.puntos[this.res.g]++;
    this.fase = "res";
    this.espera = 2.2;
    this.emitir("res", { g: this.res.g, falso: this.res.falso || 0 });
  }
  vista(r) {
    return { ...this.base(r), fase: this.fase, r: this.r, puntos: { ...this.puntos }, res: this.res, ya: { 1: this.ms[1] !== null, 2: this.ms[2] !== null } };
  }
}
Kit.SIMS.reflejos = ReflejosSim;
