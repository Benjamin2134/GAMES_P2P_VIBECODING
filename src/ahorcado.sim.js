// ==========================================================================
//  Simulacion de AHORCADO (por rondas). 6 rondas: se alterna quien elige la
//  palabra (de 3 sugerencias o escrita a mano) y quien adivina letra a letra.
//  6 errores completan el monigote: punto para el que eligio. Adivinar: punto
//  para el que adivina. Gana quien suma mas al final.
//  El que adivina nunca recibe la palabra en su vista, solo la mascara.
// ==========================================================================
const AH = {
  RONDAS: 6, ERRORES: 6, ESPERA: 3.5,
  LETRAS: "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ",
  PALABRAS: [
    "ELEFANTE", "JIRAFA", "PINGUINO", "COCODRILO", "MARIPOSA", "TORTUGA", "CANGURO", "DELFIN", "MURCIELAGO", "HORMIGA",
    "CABALLO", "CONEJO", "TIBURON", "BALLENA", "GALLINA", "LECHUZA", "CULEBRA", "ARDILLA", "MAPACHE", "PULPO",
    "GUITARRA", "TROMPETA", "BATERIA", "VIOLIN", "ACORDEON", "PIANO", "FLAUTA", "TAMBOR",
    "EMPANADA", "SOPAIPILLA", "CHURRASCO", "PASTEL", "HELADO", "CHOCOLATE", "MERMELADA", "MANZANA", "SANDIA", "FRUTILLA",
    "PALTA", "TOMATE", "CEBOLLA", "ZANAHORIA", "LECHUGA", "QUESO", "GALLETA", "PANQUEQUE", "CEREZA", "DURAZNO",
    "VOLCAN", "MONTAÑA", "GLACIAR", "DESIERTO", "OCEANO", "ISLA", "CASCADA", "BOSQUE", "PLAYA", "LAGUNA",
    "COMPUTADOR", "TELEFONO", "TECLADO", "PANTALLA", "AUDIFONOS", "CAMARA", "CONSOLA", "BICICLETA", "AVION", "SUBMARINO",
    "COHETE", "TRACTOR", "AMBULANCIA", "HELICOPTERO", "MOTOCICLETA", "PARACAIDAS", "PATINETA", "CARRUSEL",
    "CASTILLO", "PIRAMIDE", "HOSPITAL", "BIBLIOTECA", "ESTADIO", "MUSEO", "ESCUELA", "MERCADO", "FARO", "PUENTE",
    "PARAGUAS", "LINTERNA", "TIJERAS", "CUCHARA", "SARTEN", "ALMOHADA", "VENTANA", "ESPEJO", "RELOJ", "MOCHILA",
    "ZAPATILLA", "SOMBRERO", "BUFANDA", "CHAQUETA", "PIJAMA", "ANTEOJOS", "CALCETIN", "GUANTE",
    "ASTRONAUTA", "BOMBERO", "DETECTIVE", "PIRATA", "MAGO", "DINOSAURIO", "DRAGON", "FANTASMA", "VAMPIRO", "ROBOT",
    "ARCOIRIS", "RELAMPAGO", "TORMENTA", "ESTRELLA", "PLANETA", "GALAXIA", "COMETA", "ECLIPSE", "AURORA", "NIEBLA",
    "FUTBOL", "AJEDREZ", "BALONCESTO", "NATACION", "KARATE", "TENIS", "VOLEIBOL", "ESCALADA", "PATINAJE", "BOXEO",
    "PIÑATA", "CUMPLEAÑOS", "SEÑAL", "NIÑO", "CABAÑA", "ARAÑA", "PEQUEÑO", "OTOÑO",
  ],
  // Mayusculas, sin tildes pero conservando la Ñ; solo letras.
  limpiar(s) {
    return String(s || "").toUpperCase().replace(/Ñ/g, "\u0001").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\u0001/g, "Ñ").replace(/[^A-ZÑ]/g, "");
  },
  mascara: (pal, letras) => pal.split("").map((ch) => (letras.includes(ch) ? ch : "_")).join(""),
};

class AhorcadoSim extends SimBase {
  constructor(o) {
    super(o);
    this.puntos = { 1: 0, 2: 0 };
    this.ronda = 0;
    this.nuevaRonda();
  }
  nuevaRonda() {
    this.ronda++;
    this.elige = this.ronda % 2 ? this.primero : Kit.otro(this.primero);
    this.adivina = Kit.otro(this.elige);
    this.fase = "elige";
    this.palabra = "";
    this.sugerencias = Kit.mezclar(AH.PALABRAS.slice()).slice(0, 3);
    this.letras = [];
    this.errores = 0;
    this.res = null;
    this.emitir("ronda", { n: this.ronda, elige: this.elige });
  }
  get turno() { return this.fase === "elige" ? this.elige : this.fase === "adivina" ? this.adivina : 0; }
  step(dt) {
    if (this.fase !== "resumen") return;
    this.espera -= dt;
    if (this.espera > 0) return;
    if (this.ronda >= AH.RONDAS) this.terminar(this.puntos[1] > this.puntos[2] ? 1 : this.puntos[2] > this.puntos[1] ? 2 : 3);
    else this.nuevaRonda();
  }
  accion(j, a) {
    if (this.fase === "elige" && j === this.elige && a.palabra !== undefined) {
      const p = AH.limpiar(a.palabra);
      if (p.length < 3 || p.length > 14) return;
      this.palabra = p;
      this.fase = "adivina";
      this.emitir("elegida", { largo: p.length });
      return;
    }
    if (this.fase !== "adivina" || j !== this.adivina) return;
    const l = AH.limpiar(a.letra).slice(0, 1);
    if (!l || this.letras.includes(l)) return;
    this.letras.push(l);
    if (this.palabra.includes(l)) {
      this.emitir("acierto", { l, n: this.palabra.split(l).length - 1 });
      if (!AH.mascara(this.palabra, this.letras).includes("_")) this.cerrar(this.adivina, true);
    } else {
      this.errores++;
      this.emitir("error", { l, errores: this.errores });
      if (this.errores >= AH.ERRORES) this.cerrar(this.elige, false);
    }
  }
  cerrar(g, adivino) {
    this.puntos[g]++;
    this.res = { g, adivino, palabra: this.palabra };
    this.fase = "resumen";
    this.espera = AH.ESPERA;
    this.emitir("cierre", { g, adivino });
  }
  vista(r) {
    const ve = r === this.elige || this.fase === "resumen";
    return {
      ...this.base(r), fase: this.fase, ronda: this.ronda, elige: this.elige, adivina: this.adivina, turno: this.turno,
      mascara: AH.mascara(this.palabra, this.letras), largo: this.palabra.length,
      palabra: ve ? this.palabra : "", sugerencias: r === this.elige && this.fase === "elige" ? this.sugerencias : [],
      letras: this.letras.slice(), errores: this.errores, puntos: { ...this.puntos }, res: this.res,
    };
  }
}
Kit.SIMS.ahorcado = AhorcadoSim;
