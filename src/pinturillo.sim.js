// ==========================================================================
//  Simulacion de PINTURILLO (por rondas, sin bot). 6 rondas: uno dibuja una
//  palabra (elige entre 3) y el otro la adivina escribiendo. Adivinar rapido
//  da mas puntos; el que dibuja tambien suma si le adivinan. A la mitad del
//  tiempo aparece una letra de pista, y otra a los 3/4.
//  El dibujo viaja como lista de trazos [x, y, nuevo, color, grosor]. Al que
//  adivina se le mandan solo los trazos que le faltan (avisa cuantos tiene).
// ==========================================================================
const PT = {
  RONDAS: 6, TIEMPO: 80, ELEGIR: 15, ESPERA: 4, MAX_OPS: 20000, W: 640, H: 480, COLORES: 10, TAMANOS: 3,
  PALABRAS: [
    "casa", "perro", "gato", "sol", "luna", "árbol", "flor", "auto", "bicicleta", "avión", "barco", "tren", "pez", "pájaro",
    "manzana", "plátano", "uva", "pizza", "helado", "torta", "hamburguesa", "taza", "silla", "mesa", "cama", "lámpara",
    "reloj", "teléfono", "computador", "guitarra", "piano", "tambor", "pelota", "zapato", "sombrero", "anteojos", "paraguas",
    "llave", "tijeras", "lápiz", "libro", "mochila", "cohete", "estrella", "nube", "lluvia", "arcoíris", "volcán", "montaña",
    "playa", "isla", "castillo", "puente", "faro", "carpa", "fogata", "dragón", "robot", "fantasma", "pirata", "corona",
    "espada", "escudo", "tesoro", "mariposa", "araña", "serpiente", "elefante", "jirafa", "pingüino", "tortuga", "conejo",
    "caracol", "pulpo", "tiburón", "ballena", "dinosaurio", "unicornio", "sirena", "mago", "payaso", "astronauta",
    "bombero", "doctor", "cocinero", "futbolista", "corazón", "ojo", "mano", "nariz", "diente", "esqueleto", "globo",
    "regalo", "vela", "campana", "ancla", "imán", "bombilla", "batería", "cámara", "televisor", "semáforo", "escalera",
    "ventana", "puerta", "chimenea", "iglú", "pirámide", "cactus", "palmera", "hongo", "zanahoria", "empanada", "sandía",
    "cerebro", "planeta", "cometa", "submarino", "helicóptero", "tractor", "ambulancia", "patineta", "columpio", "tobogán",
  ],
  // Distancia de edicion (para el "¡casi!").
  lev(a, b) {
    const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  },
};

class PinturilloSim extends SimBase {
  constructor(o) {
    super(o);
    this.puntos = { 1: 0, 2: 0 };
    this.ronda = 0;
    this.version = 0;
    this.nuevaRonda();
  }
  nuevaRonda() {
    this.ronda++;
    this.dibuja = this.ronda % 2 ? this.primero : Kit.otro(this.primero);
    this.adivina = Kit.otro(this.dibuja);
    this.fase = "elige"; this.espera = PT.ELEGIR;
    this.opciones = Kit.mezclar(PT.PALABRAS.slice()).slice(0, 3);
    this.palabra = ""; this.trazos = []; this.version++; this.vistos2 = 0;
    this.chat = []; this.pistas = []; this.res = null;
    this.emitir("ronda", { n: this.ronda, dibuja: this.dibuja });
  }
  elegir(p) {
    this.palabra = p; this.fase = "dibuja"; this.espera = PT.TIEMPO;
    this.emitir("elegida", {});
  }
  step(dt) {
    this.espera -= dt;
    if (this.fase === "elige" && this.espera <= 0) this.elegir(this.opciones[0]);
    else if (this.fase === "dibuja") {
      const letras = [...this.palabra].map((c, i) => (c !== " " ? i : -1)).filter((i) => i >= 0 && !this.pistas.includes(i));
      const quiere = this.espera < PT.TIEMPO * 0.25 ? 2 : this.espera < PT.TIEMPO * 0.5 ? 1 : 0;
      if (this.pistas.length < quiere && letras.length > 2) { this.pistas.push(Kit.elegir(letras)); this.emitir("pista", {}); }
      if (this.espera <= 0) this.cerrar(0);
    } else if (this.fase === "resumen" && this.espera <= 0) {
      if (this.ronda >= PT.RONDAS) this.terminar(this.puntos[1] > this.puntos[2] ? 1 : this.puntos[2] > this.puntos[1] ? 2 : 3);
      else this.nuevaRonda();
    }
  }
  cerrar(g) {
    let pts = 0;
    if (g) { pts = 50 + Math.ceil(this.espera); this.puntos[g] += pts; this.puntos[this.dibuja] += 40; }
    this.res = { g, pts, palabra: this.palabra };
    this.fase = "resumen"; this.espera = PT.ESPERA;
    this.emitir("cierre", { g });
  }
  input(j, i) {
    if (j !== 2 || !i) return;
    this.vistos2 = i.v === this.version ? Kit.num(i.n, 0, this.trazos.length, 0) | 0 : 0;
  }
  accion(j, a) {
    if (this.fase === "elige" && j === this.dibuja && this.opciones.includes(a.palabra)) { this.elegir(a.palabra); return; }
    if (this.fase !== "dibuja") return;
    if (j === this.dibuja) {
      if (a.borrar) { this.trazos = []; this.version++; this.vistos2 = 0; return; }
      if (!Array.isArray(a.ops)) return;
      for (const op of a.ops.slice(0, 300)) {
        if (!Array.isArray(op) || this.trazos.length >= PT.MAX_OPS) break;
        const x = Kit.ent(op[0], 0, PT.W), y = Kit.ent(op[1], 0, PT.H), c = Kit.ent(op[3], 0, PT.COLORES - 1), s = Kit.ent(op[4], 0, PT.TAMANOS - 1);
        if (x === null || y === null || c === null || s === null) continue;
        this.trazos.push([x, y, op[2] ? 1 : 0, c, s]);
      }
      return;
    }
    if (j === this.adivina && typeof a.adivina === "string") {
      const txt = a.adivina.slice(0, 40).trim(), n = Kit.normal(txt), p = Kit.normal(this.palabra);
      if (!n) return;
      if (n === p) { this.chat.push({ j, t: "", ok: true }); this.cerrar(j); return; }
      this.chat.push({ j, t: txt, cerca: PT.lev(n, p) <= 1 });
      if (this.chat.length > 9) this.chat.shift();
      this.emitir("intento", { cerca: PT.lev(n, p) <= 1 });
    }
  }
  vista(r) {
    const ve = r === this.dibuja || this.fase === "resumen";
    const pista = [...this.palabra].map((c, i) => (c === " " ? " " : this.pistas.includes(i) ? c.toUpperCase() : "_")).join("");
    return {
      ...this.base(r), fase: this.fase, ronda: this.ronda, dibuja: this.dibuja, adivina: this.adivina, puntos: { ...this.puntos },
      t: Math.max(0, Math.ceil(this.espera)), chat: this.chat.slice(), res: this.res,
      palabra: ve ? this.palabra : "", pista, opciones: r === this.dibuja && this.fase === "elige" ? this.opciones.slice() : [],
      // el host lee sus trazos directo; al guest solo le van los que le faltan
      lienzo: r === 1 ? { v: this.version, desde: 0, ops: this.trazos } : { v: this.version, desde: this.vistos2, ops: this.trazos.slice(this.vistos2, this.vistos2 + 300) },
    };
  }
}
Kit.SIMS.pinturillo = PinturilloSim;
