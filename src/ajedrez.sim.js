// ==========================================================================
//  Simulacion de AJEDREZ (turnos), reglas completas FIDE:
//  enroque, captura al paso, promocion (q/r/b/n), jaque mate, ahogado,
//  regla de 50 movimientos, triple repeticion y material insuficiente.
//  tab[64] con letras: mayuscula = blancas, minuscula = negras, "" vacia.
//  Fila 0 = octava fila (negras arriba). Indice 0 = a8, 63 = h1.
//  En partidas impares P1 juega con blancas; en pares, P2.
// ==========================================================================
const AJ = (() => {
  const N = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const K = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const ORTO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const dentro = (f, c) => f >= 0 && f < 8 && c >= 0 && c < 8;
  const color = (p) => (!p ? "" : p === p.toUpperCase() ? "w" : "b");
  const otro = (c) => (c === "w" ? "b" : "w");

  function nuevo() {
    const t = Array(64).fill("");
    const fondo = "rnbqkbnr";
    for (let c = 0; c < 8; c++) { t[c] = fondo[c]; t[8 + c] = "p"; t[48 + c] = "P"; t[56 + c] = fondo[c].toUpperCase(); }
    return { tab: t, turno: "w", enr: "KQkq", ep: -1, medio: 0 };
  }

  // Esta la casilla i atacada por el color "por"?
  function atacada(t, i, por) {
    const f = i >> 3, c = i & 7;
    // peones: un peon blanco ataca hacia arriba (fila - 1)
    const fp = por === "w" ? f + 1 : f - 1, peon = por === "w" ? "P" : "p";
    for (const dc of [-1, 1]) if (dentro(fp, c + dc) && t[fp * 8 + c + dc] === peon) return true;
    const cab = por === "w" ? "N" : "n", rey = por === "w" ? "K" : "k";
    for (const [df, dc] of N) if (dentro(f + df, c + dc) && t[(f + df) * 8 + c + dc] === cab) return true;
    for (const [df, dc] of K) if (dentro(f + df, c + dc) && t[(f + df) * 8 + c + dc] === rey) return true;
    const alfil = por === "w" ? "B" : "b", torre = por === "w" ? "R" : "r", dama = por === "w" ? "Q" : "q";
    for (const [dirs, a] of [[DIAG, alfil], [ORTO, torre]]) {
      for (const [df, dc] of dirs) {
        let ff = f + df, cc = c + dc;
        while (dentro(ff, cc)) {
          const p = t[ff * 8 + cc];
          if (p) { if (p === a || p === dama) return true; break; }
          ff += df; cc += dc;
        }
      }
    }
    return false;
  }

  const rey = (t, col) => t.indexOf(col === "w" ? "K" : "k");
  const enJaque = (s) => atacada(s.tab, rey(s.tab, s.turno), otro(s.turno));

  // Jugadas pseudo-legales (pueden dejar al rey en jaque).
  function pseudo(s) {
    const res = [], t = s.tab, col = s.turno, enemigo = otro(col);
    const add = (de, a, x) => res.push(x ? Object.assign({ de, a }, x) : { de, a });
    for (let i = 0; i < 64; i++) {
      const p = t[i];
      if (!p || color(p) !== col) continue;
      const f = i >> 3, c = i & 7, tipo = p.toLowerCase();
      if (tipo === "p") {
        const d = col === "w" ? -1 : 1, ini = col === "w" ? 6 : 1, ult = col === "w" ? 0 : 7, f1 = f + d;
        const avance = (a) => { if (f1 === ult) for (const pr of "qrbn") add(i, a, { pr }); else add(i, a); };
        if (dentro(f1, c) && !t[f1 * 8 + c]) {
          avance(f1 * 8 + c);
          if (f === ini && !t[(f + 2 * d) * 8 + c]) add(i, (f + 2 * d) * 8 + c, { dob: 1 });
        }
        for (const dc of [-1, 1]) {
          if (!dentro(f1, c + dc)) continue;
          const a = f1 * 8 + c + dc, q = t[a];
          if (q && color(q) === enemigo) avance(a);
          else if (a === s.ep) add(i, a, { ep: 1 });
        }
      } else if (tipo === "n" || tipo === "k") {
        for (const [df, dc] of tipo === "n" ? N : K) {
          if (!dentro(f + df, c + dc)) continue;
          const a = (f + df) * 8 + c + dc;
          if (!t[a] || color(t[a]) === enemigo) add(i, a);
        }
        if (tipo === "k") {
          const base = col === "w" ? 56 : 0, Kc = col === "w" ? "K" : "k", Qc = col === "w" ? "Q" : "q", torre = col === "w" ? "R" : "r";
          if (i === base + 4 && !atacada(t, i, enemigo)) {
            if (s.enr.includes(Kc) && !t[base + 5] && !t[base + 6] && t[base + 7] === torre &&
                !atacada(t, base + 5, enemigo) && !atacada(t, base + 6, enemigo)) add(i, base + 6, { enr: "K" });
            if (s.enr.includes(Qc) && !t[base + 3] && !t[base + 2] && !t[base + 1] && t[base] === torre &&
                !atacada(t, base + 3, enemigo) && !atacada(t, base + 2, enemigo)) add(i, base + 2, { enr: "Q" });
          }
        }
      } else {
        const dirs = tipo === "b" ? DIAG : tipo === "r" ? ORTO : K;
        for (const [df, dc] of dirs) {
          let ff = f + df, cc = c + dc;
          while (dentro(ff, cc)) {
            const a = ff * 8 + cc;
            if (t[a]) { if (color(t[a]) === enemigo) add(i, a); break; }
            add(i, a);
            ff += df; cc += dc;
          }
        }
      }
    }
    return res;
  }

  function aplicar(s, m) {
    const t = s.tab.slice(), p = t[m.de], col = s.turno;
    const captura = !!t[m.a] || !!m.ep;
    t[m.a] = m.pr ? (col === "w" ? m.pr.toUpperCase() : m.pr) : p;
    t[m.de] = "";
    if (m.ep) t[(m.de >> 3) * 8 + (m.a & 7)] = "";
    if (m.enr) {
      const base = col === "w" ? 56 : 0;
      if (m.enr === "K") { t[base + 5] = t[base + 7]; t[base + 7] = ""; }
      else { t[base + 3] = t[base]; t[base] = ""; }
    }
    let enr = s.enr;
    const quitar = (x) => { enr = enr.replace(x, ""); };
    if (p === "K") { quitar("K"); quitar("Q"); }
    if (p === "k") { quitar("k"); quitar("q"); }
    for (const [sq, x] of [[63, "K"], [56, "Q"], [7, "k"], [0, "q"]]) if (m.de === sq || m.a === sq) quitar(x);
    return {
      tab: t, turno: otro(col), enr, ep: m.dob ? (m.de + m.a) >> 1 : -1,
      medio: p.toLowerCase() === "p" || captura ? 0 : s.medio + 1,
    };
  }

  function legales(s) {
    const col = s.turno;
    return pseudo(s).filter((m) => {
      const s2 = aplicar(s, m);
      return !atacada(s2.tab, rey(s2.tab, col), otro(col));
    });
  }

  function insuficiente(t) {
    const resto = t.filter((p) => p && p.toLowerCase() !== "k");
    if (!resto.length) return true;
    return resto.length === 1 && "bn".includes(resto[0].toLowerCase());
  }

  const clave = (s) => s.tab.join("") + s.turno + s.enr + s.ep;
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

  return { nuevo, atacada, rey, enJaque, pseudo, aplicar, legales, insuficiente, clave, color, otro, VAL };
})();

class AjedrezSim extends SimBase {
  constructor(o) {
    super(o);
    this.s = AJ.nuevo();
    this.colores = { 1: this.primero === 1 ? "w" : "b", 2: this.primero === 1 ? "b" : "w" };
    this.leg = AJ.legales(this.s);
    this.ult = null;
    this.capt = { w: [], b: [] };   // piezas que capturo cada color
    this.rep = {};
    this.rep[AJ.clave(this.s)] = 1;
    this.motivo = "";
  }
  get turno() { return this.colores[1] === this.s.turno ? 1 : 2; }
  accion(j, a) {
    if (j !== this.turno) return;
    const pr = typeof a.pr === "string" && "qrbn".includes(a.pr) && a.pr ? a.pr : "q";
    const m = this.leg.find((x) => x.de === a.de && x.a === a.a && (!x.pr || x.pr === pr));
    if (!m) return;
    const col = this.s.turno;
    const comida = m.ep ? (col === "w" ? "p" : "P") : this.s.tab[m.a];
    if (comida) this.capt[col].push(comida);
    this.s = AJ.aplicar(this.s, m);
    this.ult = { de: m.de, a: m.a };
    this.leg = AJ.legales(this.s);
    const jaque = AJ.enJaque(this.s);
    this.emitir("mueve", { j, cap: !!comida, jaque, enr: !!m.enr, pr: !!m.pr });
    const k = AJ.clave(this.s);
    this.rep[k] = (this.rep[k] || 0) + 1;
    if (!this.leg.length) { this.motivo = jaque ? "Jaque mate" : "Rey ahogado"; this.terminar(jaque ? j : 3); }
    else if (this.s.medio >= 100) { this.motivo = "Regla de los 50 movimientos"; this.terminar(3); }
    else if (this.rep[k] >= 3) { this.motivo = "Triple repetición"; this.terminar(3); }
    else if (AJ.insuficiente(this.s.tab)) { this.motivo = "Material insuficiente"; this.terminar(3); }
  }
  vista(r) {
    return {
      ...this.base(r), tab: this.s.tab.slice(), turno: this.turno, color: this.colores[r], colores: this.colores,
      jaque: AJ.enJaque(this.s), ult: this.ult, capt: this.capt, motivo: this.motivo,
      enr: this.s.enr, ep: this.s.ep, medio: this.s.medio, turnoColor: this.s.turno,
      movs: this.turno === r && !this.ganador ? this.leg.map((m) => [m.de, m.a, m.pr || ""]) : [],
    };
  }
}
Kit.SIMS.ajedrez = AjedrezSim;
