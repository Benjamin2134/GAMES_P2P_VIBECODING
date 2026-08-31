// ==========================================================================
//  Simulacion autoritativa de BILLAR (8-ball, corre en el host).
//  Fisica: friccion, rebote de bandas, choque elastico bola-bola, troneras.
//  Reglas 8-ball simplificadas pero reales: grupos, faltas, bola en mano,
//  gana quien mete la 8 legal tras limpiar su grupo.
// ==========================================================================
const BILLAR = {
  W: 900, H: 500, BORDE: 34, R: 10, TRONERA: 21,
  FRICC: 0.16,        // v *= FRICC^dt  (por segundo)
  V_MIN: 6,           // px/s: abajo de esto la bola frena del todo
  REST_BANDA: 0.9, REST_BOLA: 0.94,
  V_MAX: 1500,        // px/s a potencia 1
  SUB: 4, SIM_HZ: 120, SEND_HZ: 40,
};
BILLAR.X0 = BILLAR.BORDE; BILLAR.X1 = BILLAR.W - BILLAR.BORDE;
BILLAR.Y0 = BILLAR.BORDE; BILLAR.Y1 = BILLAR.H - BILLAR.BORDE;
BILLAR.TRONERAS = [
  { x: BILLAR.X0, y: BILLAR.Y0 }, { x: BILLAR.W / 2, y: BILLAR.Y0 - 3 }, { x: BILLAR.X1, y: BILLAR.Y0 },
  { x: BILLAR.X0, y: BILLAR.Y1 }, { x: BILLAR.W / 2, y: BILLAR.Y1 + 3 }, { x: BILLAR.X1, y: BILLAR.Y1 },
];

const _tipo = (n) => (n === 8 ? 0 : n <= 7 ? 1 : 2);      // 0 ocho, 1 lisas, 2 rayas
const _otro = (t) => (t === 1 ? 2 : 1);

class BillarSim {
  constructor() {
    this.turno = Math.random() < 0.5 ? 1 : 2;
    this.grupo = { 1: 0, 2: 0 };
    this.revancha = { 1: false, 2: false };
    this.ganador = 0;
    this.falta = "";
    this.aim = { ang: 0, pot: 0 };
    this._rack();
    this.fase = "apuntando";
    this._prim = 0; this._metidas = []; this._cue = false;
  }

  _rack() {
    const { W, H, R, X0, X1 } = BILLAR;
    this.bolas = [];
    const cue = { n: 0, x: X0 + (X1 - X0) * 0.26, y: H / 2, vx: 0, vy: 0, dentro: true };
    this.bolas.push(cue);
    // triangulo con vertice hacia la blanca
    const footX = X0 + (X1 - X0) * 0.72;
    const dx = R * 2 * 0.8666, dy = R * 2 * 1.001;
    const orden = [];
    for (let r = 0; r < 5; r++) for (let i = 0; i <= r; i++)
      orden.push({ x: footX + r * dx, y: H / 2 + (i - r / 2) * dy });
    // numeros: 8 al centro (fila 2, i=1 => indice 4); esquinas traseras distinto tipo
    const resto = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
    for (let i = resto.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[resto[i], resto[j]] = [resto[j], resto[i]]; }
    // asegurar esquinas traseras (indices 10 y 14) de distinto grupo
    if (_tipo(resto[9]) === _tipo(resto[13])) {
      const k = resto.findIndex((n, ix) => ix > 9 && ix < 13 && _tipo(n) !== _tipo(resto[9]));
      if (k > 0) [resto[13], resto[k]] = [resto[k], resto[13]];
    }
    const nums = [];
    let ri = 0;
    for (let idx = 0; idx < 15; idx++) nums.push(idx === 4 ? 8 : resto[ri++]);
    for (let idx = 0; idx < 15; idx++)
      this.bolas.push({ n: nums[idx], x: orden[idx].x, y: orden[idx].y, vx: 0, vy: 0, dentro: true });
  }
  _b(n) { return this.bolas.find((b) => b.n === n); }
  grupoLimpio(t) {
    const g = this.grupo[t]; if (!g) return false;
    const ns = g === 1 ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
    return ns.every((n) => !this._b(n).dentro);
  }

  // ---- entradas del jugador de turno ----
  apuntar(rol, ang, pot) {
    if (this.fase === "apuntando" && this.turno === rol) { this.aim.ang = ang; this.aim.pot = clamp(pot, 0, 1); }
  }
  tirar(rol) {
    if (this.fase !== "apuntando" || this.turno !== rol || this.aim.pot < 0.03) return;
    const cue = this._b(0);
    cue.vx = Math.cos(this.aim.ang) * this.aim.pot * BILLAR.V_MAX;
    cue.vy = Math.sin(this.aim.ang) * this.aim.pot * BILLAR.V_MAX;
    this.fase = "simulando"; this.falta = "";
    this._prim = 0; this._metidas = []; this._cue = false;
  }
  manoLibre(rol, x, y) {
    if (this.fase !== "manoLibre" || this.turno !== rol) return;
    const { R, X0, X1, Y0, Y1 } = BILLAR;
    x = clamp(x, X0 + R, X1 - R); y = clamp(y, Y0 + R, Y1 - R);
    for (const b of this.bolas) if (b.dentro && b.n !== 0 && Math.hypot(b.x - x, b.y - y) < R * 2) return;
    const cue = this._b(0);
    cue.x = x; cue.y = y; cue.vx = cue.vy = 0; cue.dentro = true;
    this.fase = "apuntando"; this.aim.pot = 0;
  }
  pedirRevancha(n) {
    if (!this.ganador) return;
    this.revancha[n] = true;
    if (this.revancha[1] && this.revancha[2]) {
      this.grupo = { 1: 0, 2: 0 }; this.revancha = { 1: false, 2: false };
      this.ganador = 0; this.falta = ""; this._rack();
      this.turno = Math.random() < 0.5 ? 1 : 2; this.fase = "apuntando"; this.aim.pot = 0;
    }
  }

  // ---- fisica ----
  step(dt) {
    if (this.fase !== "simulando") return;
    const h = dt / BILLAR.SUB;
    for (let s = 0; s < BILLAR.SUB; s++) this._sub(h);
    if (this.bolas.every((b) => !b.dentro || (b.vx === 0 && b.vy === 0))) this._resolver();
  }
  _sub(h) {
    const { R, X0, X1, Y0, Y1, V_MIN, REST_BANDA, REST_BOLA, FRICC, TRONERA } = BILLAR;
    const f = Math.pow(FRICC, h);
    for (const b of this.bolas) {
      if (!b.dentro) continue;
      b.x += b.vx * h; b.y += b.vy * h;
      b.vx *= f; b.vy *= f;
      if (Math.hypot(b.vx, b.vy) < V_MIN) { b.vx = 0; b.vy = 0; }
    }
    // troneras
    for (const b of this.bolas) {
      if (!b.dentro) continue;
      for (const p of BILLAR.TRONERAS) {
        if (Math.hypot(b.x - p.x, b.y - p.y) < TRONERA) {
          b.dentro = false; b.vx = b.vy = 0;
          if (b.n === 0) this._cue = true; else this._metidas.push(b.n);
          break;
        }
      }
    }
    // bandas (salvo cerca de una tronera)
    for (const b of this.bolas) {
      if (!b.dentro) continue;
      let cerca = false;
      for (const p of BILLAR.TRONERAS) if (Math.hypot(b.x - p.x, b.y - p.y) < TRONERA * 1.8) { cerca = true; break; }
      if (cerca) continue;
      if (b.x - R < X0) { b.x = X0 + R; b.vx = Math.abs(b.vx) * REST_BANDA; }
      else if (b.x + R > X1) { b.x = X1 - R; b.vx = -Math.abs(b.vx) * REST_BANDA; }
      if (b.y - R < Y0) { b.y = Y0 + R; b.vy = Math.abs(b.vy) * REST_BANDA; }
      else if (b.y + R > Y1) { b.y = Y1 - R; b.vy = -Math.abs(b.vy) * REST_BANDA; }
    }
    // choques bola-bola
    const bs = this.bolas;
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i]; if (!a.dentro) continue;
      for (let j = i + 1; j < bs.length; j++) {
        const c = bs[j]; if (!c.dentro) continue;
        let dx = c.x - a.x, dy = c.y - a.y;
        let d2 = dx * dx + dy * dy;
        const min = R * 2;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        const ov = min - d;
        a.x -= nx * ov / 2; a.y -= ny * ov / 2;
        c.x += nx * ov / 2; c.y += ny * ov / 2;
        const vn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
        if (vn < 0) {
          const imp = -(1 + REST_BOLA) * vn / 2;
          a.vx -= imp * nx; a.vy -= imp * ny;
          c.vx += imp * nx; c.vy += imp * ny;
          if (this._prim === 0) {
            if (a.n === 0) this._prim = c.n;
            else if (c.n === 0) this._prim = a.n;
          }
        }
      }
    }
  }

  _resolver() {
    const metidas = this._metidas.slice();
    const ocho = metidas.includes(8);
    const g = this.grupo[this.turno];

    let primeraOk;
    if (this._prim === 0) primeraOk = false;
    else if (g === 0) primeraOk = this._prim !== 8;
    else primeraOk = (_tipo(this._prim) === g) || (this._prim === 8 && this.grupoLimpio(this.turno));
    let foul = this._cue || !primeraOk;

    if (ocho) {
      const legal = !foul && !this._cue && this.grupoLimpio(this.turno);
      this.ganador = legal ? this.turno : _otro(this.turno);
      this.fase = "fin";
      return;
    }

    if (g === 0 && !foul && metidas.length) {
      const prim = metidas.find((n) => n !== 8);
      if (prim) { const t = _tipo(prim); this.grupo[this.turno] = t; this.grupo[_otro(this.turno)] = t === 1 ? 2 : 1; }
    }

    const gm = this.grupo[this.turno];
    const metioPropia = metidas.some((n) => n !== 8 && (gm === 0 || _tipo(n) === gm));

    if (foul) {
      this.turno = _otro(this.turno);
      this.fase = "manoLibre";
      this.falta = this._cue ? "Metiste la blanca — bola en mano" : "Falta — bola en mano";
    } else if (metioPropia) {
      this.fase = "apuntando";
      this.falta = "";
    } else {
      this.turno = _otro(this.turno);
      this.fase = "apuntando";
      this.falta = "";
    }
    this.aim.pot = 0;
    this._prim = 0; this._metidas = []; this._cue = false;
  }

  snapshot() {
    return {
      t: "e",
      b: this.bolas.filter((b) => b.dentro).map((b) => [b.n, Math.round(b.x * 10) / 10, Math.round(b.y * 10) / 10]),
      turno: this.turno, g1: this.grupo[1], g2: this.grupo[2],
      fase: this.fase, ganador: this.ganador, falta: this.falta,
      rev1: this.revancha[1], rev2: this.revancha[2],
      aim: this.fase === "apuntando" ? { ang: this.aim.ang, pot: this.aim.pot, por: this.turno } : null,
      quieto: this.fase !== "simulando",
    };
  }
}
