// ==========================================================================
//  Simulacion de DOMINO (doble seis, 2 jugadores, a 50 puntos).
//  - 7 fichas por mano, 14 en el pozo. La primera ronda la abre quien tiene
//    el doble mas alto; las siguientes, quien gano la anterior.
//  - Si no puedes jugar, robas del pozo hasta poder; con el pozo vacio, pasas.
//  - Domino: quien se queda sin fichas suma los puntos de la mano rival.
//    Tranque (nadie puede jugar): gana la mano con menos puntos y suma los del otro.
//  La vista solo trae tu mano; del rival, cuantas fichas tiene (salvo al cerrar la ronda).
// ==========================================================================
const DOM = {
  META: 50,
  juego() { const r = []; for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) r.push([a, b]); return r; },
  suma: (mano) => mano.reduce((s, f) => s + f[0] + f[1], 0),
  // Lados donde entra la ficha f: "i" izquierda, "d" derecha (mesa vacia = "d").
  lados(f, mesa) {
    if (!mesa.length) return ["d"];
    const izq = mesa[0].a, der = mesa[mesa.length - 1].b, r = [];
    if (f[0] === izq || f[1] === izq) r.push("i");
    if (f[0] === der || f[1] === der) r.push("d");
    return r;
  },
  jugables: (mano, mesa) => mano.map((f, i) => (DOM.lados(f, mesa).length ? i : -1)).filter((i) => i >= 0),
};

class DominoSim extends SimBase {
  constructor(o) {
    super(o);
    this.puntos = { 1: 0, 2: 0 };
    this.ronda = 0;
    this.nuevaRonda(0);
  }
  nuevaRonda(empieza) {
    const f = Kit.mezclar(DOM.juego());
    this.manos = { 1: f.slice(0, 7), 2: f.slice(7, 14) };
    this.pozo = f.slice(14);
    this.mesa = [];          // [{a, b}] orientadas de izquierda a derecha
    this.pasos = 0;
    this.ronda++;
    this.fase = "juego";
    this.res = null;
    this.espera = 0;
    if (!empieza) {
      let mejor = -1;
      empieza = this.primero;
      for (const j of [1, 2]) for (const [a, b] of this.manos[j]) {
        const v = a === b ? 100 + a : a + b;
        if (v > mejor) { mejor = v; empieza = j; }
      }
    }
    this.turno = empieza;
    this.emitir("ronda", { n: this.ronda, empieza });
  }
  step(dt) {
    if (this.fase !== "resumen") return;
    this.espera -= dt;
    if (this.espera > 0) return;
    const g = this.res.g;
    if (g && this.puntos[g] >= DOM.META) { this.terminar(g); return; }
    this.nuevaRonda(g || Kit.otro(this.res.cierra));
  }
  accion(j, a) {
    if (this.fase !== "juego" || j !== this.turno) return;
    const mano = this.manos[j], puede = DOM.jugables(mano, this.mesa).length > 0;
    if (a.robar) {
      if (puede || !this.pozo.length) return;
      const f = this.pozo.pop();
      mano.push(f);
      this.emitir("roba", { j });
      return;
    }
    if (a.pasar) {
      if (puede || this.pozo.length) return;
      this.pasos++;
      this.emitir("pasa", { j });
      if (this.pasos >= 2) this.cerrar(0, j);
      else this.turno = Kit.otro(j);
      return;
    }
    const i = Kit.ent(a.i, 0, mano.length - 1);
    if (i === null) return;
    const f = mano[i], lados = DOM.lados(f, this.mesa);
    if (!lados.length) return;
    const lado = lados.includes(a.lado) ? a.lado : lados[0];
    if (!this.mesa.length) this.mesa.push({ a: f[0], b: f[1] });
    else if (lado === "i") {
      const izq = this.mesa[0].a;
      this.mesa.unshift(f[1] === izq ? { a: f[0], b: f[1] } : { a: f[1], b: f[0] });
    } else {
      const der = this.mesa[this.mesa.length - 1].b;
      this.mesa.push(f[0] === der ? { a: f[0], b: f[1] } : { a: f[1], b: f[0] });
    }
    mano.splice(i, 1);
    this.pasos = 0;
    this.emitir("juega", { j, doble: f[0] === f[1] });
    if (!mano.length) this.cerrar(j, j);
    else this.turno = Kit.otro(j);
  }
  // g: quien hizo domino (0 = tranque). cierra: quien hizo la ultima jugada.
  cerrar(g, cierra) {
    const s1 = DOM.suma(this.manos[1]), s2 = DOM.suma(this.manos[2]);
    let tipo = "domino";
    if (!g) { tipo = "tranque"; g = s1 < s2 ? 1 : s2 < s1 ? 2 : 0; }
    const pts = g ? (g === 1 ? s2 : s1) : 0;
    if (g) this.puntos[g] += pts;
    this.res = { g, pts, tipo, cierra, manos: { 1: this.manos[1].slice(), 2: this.manos[2].slice() } };
    this.fase = "resumen";
    this.espera = 4.5;
    this.emitir("cierre", { g, pts, tipo });
  }
  vista(r) {
    const o = Kit.otro(r), turnoMio = this.turno === r && this.fase === "juego";
    const jug = turnoMio ? DOM.jugables(this.manos[r], this.mesa) : [];
    return {
      ...this.base(r), mano: this.manos[r].slice(), rival: this.manos[o].length, pozo: this.pozo.length,
      mesa: this.mesa.slice(), turno: this.turno, puntos: { ...this.puntos }, ronda: this.ronda,
      fase: this.fase, res: this.res, jugables: jug,
      puedeRobar: turnoMio && !jug.length && this.pozo.length > 0,
      puedePasar: turnoMio && !jug.length && !this.pozo.length,
    };
  }
}
Kit.SIMS.domino = DominoSim;
