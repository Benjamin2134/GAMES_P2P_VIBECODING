// ==========================================================================
//  Simulacion autoritativa de BILLAR (8-ball). Corre en el host.
//
//  Fisica realista (modelo 2D basado en la fisica real del pool):
//   - Mesa 2:1 y bola con proporciones de una mesa de 9 pies
//     (bola diametro 2.25" ~= 1.13% del largo del paño).
//   - Movimiento en DOS FASES: la bola primero DESLIZA (friccion alta ~mu 0.2)
//     y va tomando efecto hasta que rueda de forma natural (v = R*w en el
//     punto de contacto); despues RUEDA con resistencia baja (~mu 0.01).
//     -> ese "patina y despues agarra" es lo que se ve real.
//   - Efecto: contacto alto/bajo = corrida / retroceso (follow / draw),
//     contacto lateral = efecto lateral (curva leve + cambia el rebote de
//     banda + "throw" en el choque).
//   - Choque bola-bola con restitucion 0.95 + friccion tangencial (throw).
//   - Bandas con restitucion dependiente de la velocidad + friccion + efecto.
//   - Troneras con embudo (la bola "cae" si entra a la boca).
//  Refs: drdavepoolinfo.com/physics, ekiefl.github.io pooltool, Mathavan et al.
// ==========================================================================
const BILLAR = {
  W: 980, H: 530, BORDE: 40, R: 10,
  // troneras
  CAP_ESQ: 21, CAP_LAT: 20, BOCA: 40,
  // fisica (px, s) — escala ~354 px/m; multiplicadores de juego para que las
  // jugadas asienten en ~2-5 s en vez de los ~15 s de una mesa real de torneo.
  A_DESLIZA: 1500,     // px/s^2 mientras patina
  A_RUEDA: 145,        // px/s^2 rodando
  SLIP_EPS: 6,         // px/s: si el deslizamiento del punto de contacto baja de esto -> rodando
  V_STOP: 7,           // px/s: abajo de esto, quieta
  V_MAX: 1650,         // px/s a potencia 1
  E_BB: 0.95,          // restitucion bola-bola
  MU_BB: 0.06,         // friccion bola-bola (throw)
  E_BANDA_HI: 0.84, E_BANDA_LO: 0.60,   // restitucion banda (rapido -> menos)
  BANDA_TAN: 0.82,     // conservacion tangencial en banda
  BANDA_EF: 0.55,      // cuanto efecto lateral pasa a velocidad tangencial
  SPIN_DECAY: 7.5,     // 1/s: decaimiento del efecto lateral (wz)
  CURVA_K: 0.9,        // curva por efecto lateral mientras patina
  SIDE_MAX: 32,        // rad/s de efecto lateral a offset 1
  FOLLOW_MAX: 2.0,     // factor de spin de rodadura inicial a offset 1 (follow/draw)
  SUB: 8, RELAX: 6, SIM_HZ: 120, SEND_HZ: 40,
  GANA_BOLAS: 7,       // bolas por grupo
};
BILLAR.X0 = BILLAR.BORDE; BILLAR.X1 = BILLAR.W - BILLAR.BORDE;
BILLAR.Y0 = BILLAR.BORDE; BILLAR.Y1 = BILLAR.H - BILLAR.BORDE;
BILLAR.TRONERAS = [
  { x: BILLAR.X0, y: BILLAR.Y0, cap: BILLAR.CAP_ESQ }, { x: BILLAR.W / 2, y: BILLAR.Y0 - 4, cap: BILLAR.CAP_LAT }, { x: BILLAR.X1, y: BILLAR.Y0, cap: BILLAR.CAP_ESQ },
  { x: BILLAR.X0, y: BILLAR.Y1, cap: BILLAR.CAP_ESQ }, { x: BILLAR.W / 2, y: BILLAR.Y1 + 4, cap: BILLAR.CAP_LAT }, { x: BILLAR.X1, y: BILLAR.Y1, cap: BILLAR.CAP_ESQ },
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
    this.aim = { ang: 0, pot: 0, ox: 0, oy: 0 };
    this._rack();
    this.fase = "apuntando";
    this._prim = 0; this._metidas = []; this._cue = false; this._rieles = 0;
  }

  _rack() {
    const { W, H, R, X0, X1 } = BILLAR;
    this.bolas = [];
    const nb = (n, x, y) => ({ n, x, y, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, rot: 0, dentro: true });
    this.bolas.push(nb(0, X0 + (X1 - X0) * 0.25, H / 2));           // blanca en la cabecera
    const footX = X0 + (X1 - X0) * 0.72;
    // rack apenas suelto (como uno real): da aire al solver y hace breaks mas vivos
    const dx = R * 2 * 0.9, dy = R * 2 * 1.08;
    const pos = [];
    for (let r = 0; r < 5; r++) for (let i = 0; i <= r; i++) pos.push({ x: footX + r * dx, y: H / 2 + (i - r / 2) * dy });
    const resto = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
    for (let i = resto.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[resto[i], resto[j]] = [resto[j], resto[i]]; }
    if (_tipo(resto[9]) === _tipo(resto[13])) {
      const k = resto.findIndex((n, ix) => ix > 9 && ix < 13 && _tipo(n) !== _tipo(resto[9]));
      if (k > 0) [resto[13], resto[k]] = [resto[k], resto[13]];
    }
    let ri = 0;
    for (let idx = 0; idx < 15; idx++) this.bolas.push(nb(idx === 4 ? 8 : resto[ri++], pos[idx].x, pos[idx].y));
  }
  _b(n) { return this.bolas.find((b) => b.n === n); }
  grupoLimpio(t) {
    const g = this.grupo[t]; if (!g) return false;
    const ns = g === 1 ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
    return ns.every((n) => !this._b(n).dentro);
  }
  metidasDe(t) {
    const g = this.grupo[t]; if (!g) return 0;
    const ns = g === 1 ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
    return ns.filter((n) => !this._b(n).dentro).length;
  }

  // ---- entradas del jugador de turno ----
  apuntar(rol, ang, pot, ox, oy) {
    if (this.fase !== "apuntando" || this.turno !== rol) return;
    this.aim.ang = ang;
    this.aim.pot = clamp(pot, 0, 1);
    if (ox !== undefined) this.aim.ox = clamp(ox, -1, 1);
    if (oy !== undefined) this.aim.oy = clamp(oy, -1, 1);
  }
  tirar(rol) {
    if (this.fase !== "apuntando" || this.turno !== rol || this.aim.pot < 0.03) return;
    const cue = this._b(0);
    const v = this.aim.pot * BILLAR.V_MAX;
    cue.vx = Math.cos(this.aim.ang) * v;
    cue.vy = Math.sin(this.aim.ang) * v;
    // efecto: follow/draw -> spin de rodadura inicial; lateral -> wz
    const fac = this.aim.oy * BILLAR.FOLLOW_MAX;      // oy>0 = follow (corrida)
    cue.wx = -(cue.vy / BILLAR.R) * fac;
    cue.wy = (cue.vx / BILLAR.R) * fac;
    cue.wz = this.aim.ox * BILLAR.SIDE_MAX;
    this.fase = "simulando"; this.falta = "";
    this._prim = 0; this._metidas = []; this._cue = false; this._rieles = 0;
  }
  manoLibre(rol, x, y) {
    if (this.fase !== "manoLibre" || this.turno !== rol) return;
    const { R, X0, X1, Y0, Y1 } = BILLAR;
    x = clamp(x, X0 + R, X1 - R); y = clamp(y, Y0 + R, Y1 - R);
    for (const b of this.bolas) if (b.dentro && b.n !== 0 && Math.hypot(b.x - x, b.y - y) < R * 2) return;
    const c = this._b(0);
    c.x = x; c.y = y; c.vx = c.vy = c.wx = c.wy = c.wz = 0; c.dentro = true;
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
    const K = BILLAR, R = K.R;
    const spinUp = 5 / (2 * R);   // dw/dt = (5/2R)*a  (esfera solida, I=2/5 m R^2)

    for (const b of this.bolas) {
      if (!b.dentro) continue;
      const v = Math.hypot(b.vx, b.vy);
      // deslizamiento del punto de contacto: u = v + w x (-R z)
      const ux = b.vx - R * b.wy, uy = b.vy + R * b.wx;
      const us = Math.hypot(ux, uy);

      if (us > K.SLIP_EPS) {
        // ---- FASE DESLIZANTE ----
        const ax = -K.A_DESLIZA * ux / us, ay = -K.A_DESLIZA * uy / us;
        b.vx += ax * h; b.vy += ay * h;
        b.wx += spinUp * ay * h;
        b.wy += -spinUp * ax * h;
        // curva por efecto lateral (masse leve) mientras patina
        if (v > 1) {
          const px = -b.vy / v, py = b.vx / v;
          b.vx += px * b.wz * K.CURVA_K * h;
          b.vy += py * b.wz * K.CURVA_K * h;
        }
      } else if (v > 0) {
        // ---- FASE RODANTE ----
        const nv = Math.max(0, v - K.A_RUEDA * h);
        b.vx = b.vx / v * nv; b.vy = b.vy / v * nv;
        b.wx = -b.vy / R; b.wy = b.vx / R;   // spin bloqueado a la rodadura
      }

      // decaimiento del efecto lateral
      if (b.wz !== 0) {
        const s = Math.sign(b.wz);
        b.wz -= s * K.SPIN_DECAY * h;
        if (Math.sign(b.wz) !== s) b.wz = 0;
      }

      b.x += b.vx * h; b.y += b.vy * h;
      b.rot += Math.hypot(b.wx, b.wy) * h;   // para dibujar la bola girando

      if (Math.hypot(b.vx, b.vy) < K.V_STOP && us < K.SLIP_EPS) { b.vx = 0; b.vy = 0; b.wx = 0; b.wy = 0; }
    }

    // ---- troneras (con embudo) ----
    for (const b of this.bolas) {
      if (!b.dentro) continue;
      for (const p of K.TRONERAS) {
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (d < p.cap) {
          b.dentro = false; b.vx = b.vy = b.wx = b.wy = b.wz = 0;
          if (b.n === 0) this._cue = true; else this._metidas.push(b.n);
          break;
        } else if (d < K.BOCA) {
          // "cae" hacia el centro de la tronera
          const f = (K.BOCA - d) / K.BOCA * 900;
          b.vx += (p.x - b.x) / d * f * h;
          b.vy += (p.y - b.y) / d * f * h;
        }
      }
    }

    // ---- bandas ----
    for (const b of this.bolas) {
      if (!b.dentro) continue;
      let cerca = false;
      for (const p of K.TRONERAS) if (Math.hypot(b.x - p.x, b.y - p.y) < K.BOCA * 1.7) { cerca = true; break; }
      if (cerca) continue;
      if (b.x - R < K.X0 && b.vx < 0) this._banda(b, "x", 1);
      else if (b.x + R > K.X1 && b.vx > 0) this._banda(b, "x", -1);
      if (b.y - R < K.Y0 && b.vy < 0) this._banda(b, "y", 1);
      else if (b.y + R > K.Y1 && b.vy > 0) this._banda(b, "y", -1);
    }

    // ---- choques bola-bola ----
    const bs = this.bolas, min = R * 2;
    // (1) IMPULSO: una vez por par que se esta acercando (restitucion + throw + spin)
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i]; if (!a.dentro) continue;
      for (let j = i + 1; j < bs.length; j++) {
        const c = bs[j]; if (!c.dentro) continue;
        const dx = c.x - a.x, dy = c.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, tx = -ny, ty = nx;
        const vrn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
        if (vrn >= 0) continue;
        const jn = -(1 + K.E_BB) * vrn / 2;
        a.vx -= jn * nx; a.vy -= jn * ny;
        c.vx += jn * nx; c.vy += jn * ny;
        const vrt = (c.vx - a.vx) * tx + (c.vy - a.vy) * ty + R * (a.wz + c.wz) * 0.5;
        const jt = -Math.sign(vrt || 1) * Math.min(K.MU_BB * Math.abs(jn), Math.abs(vrt) / 2);
        a.vx -= jt * tx; a.vy -= jt * ty;
        c.vx += jt * tx; c.vy += jt * ty;
        const trf = 0.22, gwx = a.wx * trf, gwy = a.wy * trf;
        c.wx += gwx; c.wy += gwy; a.wx -= gwx; a.wy -= gwy;
        if (this._prim === 0) {
          if (a.n === 0) this._prim = c.n;
          else if (c.n === 0) this._prim = a.n;
        }
      }
    }
    // (2) RELAJACION DE POSICION: separa solapes por completo, sin tocar velocidades
    for (let rr = 0; rr < K.RELAX; rr++) {
      let movio = false;
      for (let i = 0; i < bs.length; i++) {
        const a = bs[i]; if (!a.dentro) continue;
        for (let j = i + 1; j < bs.length; j++) {
          const c = bs[j]; if (!c.dentro) continue;
          const dx = c.x - a.x, dy = c.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const ov = Math.min(min - d, R * 1.5);
          const px = dx / d * ov * 0.5, py = dy / d * ov * 0.5;
          a.x -= px; a.y -= py; c.x += px; c.y += py;
          movio = true;
        }
      }
      if (!movio) break;
    }
  }

  _banda(b, eje, dir) {
    const K = BILLAR, R = K.R;
    if (eje === "x") b.x = dir === 1 ? K.X0 + R : K.X1 - R;
    else b.y = dir === 1 ? K.Y0 + R : K.Y1 - R;
    const vn = eje === "x" ? Math.abs(b.vx) : Math.abs(b.vy);
    const e = clamp(K.E_BANDA_HI - (K.E_BANDA_HI - K.E_BANDA_LO) * (vn / 1400), K.E_BANDA_LO, K.E_BANDA_HI);
    if (eje === "x") {
      b.vx = vn * e * dir;
      b.vy = b.vy * K.BANDA_TAN + b.wz * R * K.BANDA_EF * dir;
    } else {
      b.vy = vn * e * dir;
      b.vx = b.vx * K.BANDA_TAN - b.wz * R * K.BANDA_EF * dir;
    }
    b.wz *= -0.55;             // el efecto se invierte y se reduce
    b.wx *= 0.6; b.wy *= 0.6;  // se pierde algo de corrida/retroceso
    this._rieles++;
  }

  _resolver() {
    const metidas = this._metidas.slice();
    const ocho = metidas.includes(8);
    const g = this.grupo[this.turno];

    let primeraOk;
    if (this._prim === 0) primeraOk = false;
    else if (g === 0) primeraOk = this._prim !== 8;
    else primeraOk = (_tipo(this._prim) === g) || (this._prim === 8 && this.grupoLimpio(this.turno));
    const foul = this._cue || !primeraOk;

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
      this.fase = "apuntando"; this.falta = "";
    } else {
      this.turno = _otro(this.turno);
      this.fase = "apuntando"; this.falta = "";
    }
    this.aim.pot = 0;
    this._prim = 0; this._metidas = []; this._cue = false; this._rieles = 0;
  }

  snapshot() {
    return {
      t: "e",
      b: this.bolas.filter((b) => b.dentro).map((b) => [
        b.n, Math.round(b.x * 10) / 10, Math.round(b.y * 10) / 10, Math.round(b.rot * 100) / 100,
      ]),
      turno: this.turno, g1: this.grupo[1], g2: this.grupo[2],
      m1: this.metidasDe(1), m2: this.metidasDe(2),
      fase: this.fase, ganador: this.ganador, falta: this.falta,
      rev1: this.revancha[1], rev2: this.revancha[2],
      aim: this.fase === "apuntando" ? { ang: this.aim.ang, pot: this.aim.pot, ox: this.aim.ox, oy: this.aim.oy, por: this.turno } : null,
      quieto: this.fase !== "simulando",
    };
  }
}
