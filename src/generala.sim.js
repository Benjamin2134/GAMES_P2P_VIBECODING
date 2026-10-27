// ==========================================================================
//  Simulacion de GENERALA (turnos). 5 dados, hasta 3 tiradas por turno
//  guardando los que quieras; despues anotas en una categoria libre (o la
//  tachas con 0). 11 categorias por jugador, gana el total mayor.
//  Servido = en la primera tirada: escalera 25, full 35, poker 45.
//  Generala servida gana la partida en el acto. Doble generala: 100.
// ==========================================================================
const GEN = {
  CATS: ["1", "2", "3", "4", "5", "6", "esc", "full", "poker", "gen", "dgen"],
  NOMBRE: { 1: "Unos", 2: "Doses", 3: "Treses", 4: "Cuatros", 5: "Cincos", 6: "Seises", esc: "Escalera", full: "Full", poker: "Póker", gen: "Generala", dgen: "Doble generala" },
  conteo(d) { const c = [0, 0, 0, 0, 0, 0, 0]; for (const x of d) c[x]++; return c; },
  esEscalera(d) { const s = d.slice().sort().join(""); return s === "12345" || s === "23456" || s === "13456"; },
  puntaje(cat, d, servido, planilla) {
    const c = GEN.conteo(d), max = Math.max(...c);
    if (/^[1-6]$/.test(cat)) return +cat * c[+cat];
    if (cat === "esc") return GEN.esEscalera(d) ? (servido ? 25 : 20) : 0;
    if (cat === "full") { const v = c.filter((x) => x).sort().join(""); return v === "23" ? (servido ? 35 : 30) : 0; }
    if (cat === "poker") return max >= 4 ? (servido ? 45 : 40) : 0;
    if (cat === "gen") return max === 5 ? 50 : 0;
    if (cat === "dgen") return max === 5 && planilla && planilla.gen === 50 ? 100 : 0;
    return 0;
  },
  total: (p) => GEN.CATS.reduce((s, k) => s + (p[k] || 0), 0),
  llena: (p) => GEN.CATS.every((k) => p[k] !== null && p[k] !== undefined),
};

class GeneralaSim extends SimBase {
  constructor(o) {
    super(o);
    this.planillas = { 1: {}, 2: {} };
    for (const k of GEN.CATS) { this.planillas[1][k] = null; this.planillas[2][k] = null; }
    this.turno = this.primero;
    this.nuevoTurno();
  }
  nuevoTurno() {
    this.dados = [1, 2, 3, 4, 5];
    this.guardados = [false, false, false, false, false];
    this.tiradas = 0;
  }
  accion(j, a) {
    if (j !== this.turno) return;
    if (a.tirar) {
      if (this.tiradas >= 3) return;
      for (let k = 0; k < 5; k++) if (!this.guardados[k] || !this.tiradas) this.dados[k] = Kit.ri(1, 6);
      if (!this.tiradas) this.guardados = [false, false, false, false, false];
      this.tiradas++;
      this.emitir("tira", { j, n: this.tiradas });
      if (this.tiradas === 1 && GEN.conteo(this.dados).includes(5) && this.planillas[j].gen === null) {
        this.emitir("servida", { j });
        this.terminar(j);
      }
      return;
    }
    if (Array.isArray(a.fijar)) {
      if (!this.tiradas || this.tiradas >= 3) return;
      this.guardados = [0, 1, 2, 3, 4].map((k) => !!a.fijar[k]);
      return;
    }
    if (a.guardar !== undefined) {
      const k = Kit.ent(a.guardar, 0, 4);
      if (k === null || !this.tiradas || this.tiradas >= 3) return;
      this.guardados[k] = !this.guardados[k];
      return;
    }
    if (a.anotar !== undefined) {
      const cat = String(a.anotar), p = this.planillas[j];
      if (!this.tiradas || !GEN.CATS.includes(cat) || p[cat] !== null) return;
      p[cat] = GEN.puntaje(cat, this.dados, this.tiradas === 1, p);
      this.emitir("anota", { j, cat, pts: p[cat] });
      if (GEN.llena(this.planillas[1]) && GEN.llena(this.planillas[2])) {
        const t1 = GEN.total(this.planillas[1]), t2 = GEN.total(this.planillas[2]);
        this.terminar(t1 > t2 ? 1 : t2 > t1 ? 2 : 3);
        return;
      }
      this.turno = Kit.otro(j);
      this.nuevoTurno();
    }
  }
  vista(r) {
    const p = this.planillas[this.turno], posibles = {};
    if (this.tiradas) for (const k of GEN.CATS) if (p[k] === null) posibles[k] = GEN.puntaje(k, this.dados, this.tiradas === 1, p);
    return {
      ...this.base(r), dados: this.dados.slice(), guardados: this.guardados.slice(), tiradas: this.tiradas,
      turno: this.turno, planillas: Kit.copia(this.planillas), posibles,
      totales: { 1: GEN.total(this.planillas[1]), 2: GEN.total(this.planillas[2]) },
    };
  }
}
Kit.SIMS.generala = GeneralaSim;
