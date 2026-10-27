// ==========================================================================
//  Simulacion de BREAKOUT VERSUS (tiempo real, 120 Hz). Paletas verticales
//  a cada lado y un muro de ladrillos al centro. Cada uno tiene su pelota;
//  el ladrillo que rompe una pelota suma para quien la toco ultimo. Si una
//  pelota pasa detras de tu paleta pierdes una vida (3). Gana quien deja
//  al rival sin vidas o tiene mas puntos cuando se acaban los ladrillos.
// ==========================================================================
const BK = {
  X0: 0, X1: 960, Y0: 50, Y1: 590, PX: { 1: 36, 2: 924 }, PW: 14, PH: 96, VP: 900,
  R: 8, V0: 380, VMAX: 720, VIDAS: 3,
  COLS: 6, FILAS: 12, LX: 396, LY: 74, LW: 28, LH: 42,
  // tipo de ladrillo por fila (los del centro valen mas)
  valor: (f) => (f >= 4 && f <= 7 ? 3 : f >= 2 && f <= 9 ? 2 : 1),
};

class BreakoutSim extends SimBase {
  constructor(o) {
    super(o);
    this.pal = { 1: { y: 320, ty: 320, vy: 0 }, 2: { y: 320, ty: 320, vy: 0 } };
    this.lad = Array(BK.COLS * BK.FILAS).fill(1);
    this.vidas = { 1: BK.VIDAS, 2: BK.VIDAS };
    this.puntos = { 1: 0, 2: 0 };
    this.bolas = [this.pegada(1), this.pegada(2)];
  }
  pegada(j) { return { j, due: j, x: 0, y: 0, vx: 0, vy: 0, pega: 1.4 }; }
  input(j, i) { if (i) this.pal[j].ty = Kit.num(i.y, BK.Y0 + BK.PH / 2, BK.Y1 - BK.PH / 2, this.pal[j].ty); }
  accion(j, a) { if (a.saca) for (const b of this.bolas) if (b.j === j && b.pega > 0) b.pega = 0.01; }
  step(dt) {
    for (const j of [1, 2]) {
      const p = this.pal[j], d = p.ty - p.y, m = BK.VP * dt;
      const mv = Math.abs(d) <= m ? d : Math.sign(d) * m;
      p.y += mv; p.vy = mv / dt;
    }
    for (const b of this.bolas) {
      if (b.pega > 0) {
        b.pega -= dt;
        b.x = BK.PX[b.j] + (b.j === 1 ? 1 : -1) * (BK.PW / 2 + BK.R + 2); b.y = this.pal[b.j].y;
        if (b.pega <= 0) { const a = (Math.random() - 0.5) * 0.8; b.vx = Math.cos(a) * BK.V0 * (b.j === 1 ? 1 : -1); b.vy = Math.sin(a) * BK.V0; b.due = b.j; }
        continue;
      }
      const sub = 3, d = dt / sub;
      for (let s = 0; s < sub && b.pega <= 0; s++) {
        b.x += b.vx * d; b.y += b.vy * d;
        if (b.y < BK.Y0 + BK.R) { b.y = BK.Y0 + BK.R; b.vy = Math.abs(b.vy); }
        if (b.y > BK.Y1 - BK.R) { b.y = BK.Y1 - BK.R; b.vy = -Math.abs(b.vy); }
        // paletas
        for (const j of [1, 2]) {
          const px = BK.PX[j], p = this.pal[j], hacia = j === 1 ? b.vx < 0 : b.vx > 0;
          if (hacia && Math.abs(b.x - px) < BK.PW / 2 + BK.R && Math.abs(b.y - p.y) < BK.PH / 2 + BK.R) {
            const off = clamp((b.y - p.y) / (BK.PH / 2), -1, 1), v = Math.min(BK.VMAX, Math.hypot(b.vx, b.vy) * 1.04);
            const ang = off * 1.0 + p.vy * 0.0003;
            b.vx = Math.cos(ang) * v * (j === 1 ? 1 : -1); b.vy = Math.sin(ang) * v;
            b.x = px + (j === 1 ? 1 : -1) * (BK.PW / 2 + BK.R);
            b.due = j;
            this.emitir("pala", { j });
          }
        }
        // ladrillos
        const c = Math.floor((b.x - BK.LX) / BK.LW), f = Math.floor((b.y - BK.LY) / BK.LH);
        for (const [cc, ff] of [[c, f], [Math.floor((b.x - BK.R - BK.LX) / BK.LW), f], [Math.floor((b.x + BK.R - BK.LX) / BK.LW), f], [c, Math.floor((b.y - BK.R - BK.LY) / BK.LH)], [c, Math.floor((b.y + BK.R - BK.LY) / BK.LH)]]) {
          if (cc < 0 || ff < 0 || cc >= BK.COLS || ff >= BK.FILAS) continue;
          const k = ff * BK.COLS + cc;
          if (!this.lad[k]) continue;
          const lx = BK.LX + cc * BK.LW, ly = BK.LY + ff * BK.LH;
          const qx = clamp(b.x, lx, lx + BK.LW), qy = clamp(b.y, ly, ly + BK.LH);
          if (Math.hypot(b.x - qx, b.y - qy) > BK.R) continue;
          this.lad[k] = 0;
          this.puntos[b.due] += BK.valor(ff);
          if (Math.abs(b.x - qx) > Math.abs(b.y - qy)) b.vx = -b.vx; else b.vy = -b.vy;
          this.emitir("ladrillo", { j: b.due, x: lx + BK.LW / 2, y: ly + BK.LH / 2, f: ff });
          break;
        }
        // perdida
        for (const j of [1, 2]) {
          const detras = j === 1 ? b.x < BK.X0 - BK.R : b.x > BK.X1 + BK.R;
          if (!detras) continue;
          this.vidas[j]--;
          this.emitir("vida", { j });
          Object.assign(b, this.pegada(b.j));
          if (this.vidas[j] <= 0) this.terminar(Kit.otro(j));
        }
      }
    }
    if (!this.ganador && !this.lad.some((x) => x)) this.terminar(this.puntos[1] > this.puntos[2] ? 1 : this.puntos[2] > this.puntos[1] ? 2 : 3);
  }
  vista(r) {
    return {
      ...this.base(r), y1: Kit.r1(this.pal[1].y), y2: Kit.r1(this.pal[2].y), lad: this.lad.join(""),
      bolas: this.bolas.map((b) => [Kit.r1(b.x), Kit.r1(b.y), b.due, b.pega > 0 ? 1 : 0, Math.round(b.vx), Math.round(b.vy), b.j]),
      vidas: { ...this.vidas }, puntos: { ...this.puntos },
    };
  }
}
Kit.SIMS.breakout = BreakoutSim;
