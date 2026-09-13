// ==========================================================================
//  Simulacion autoritativa de TECHNO GROOVEBOX.
//
//  IMPORTANTE (arquitectura de red): esta clase es el "reloj" del secuenciador
//  y corre EN LOS DOS LADOS (host y guest), cada uno con su propia instancia,
//  avanzando localmente a partir de requestAnimationFrame. Por red SOLO viajan:
//    - ediciones de estado (que ficha esta prendida, mute, bpm, filtro, nota)
//    - una correccion de fase de baja frecuencia (resyncFromHost) para que los
//      dos relojes no se desalineen con el correr de los minutos.
//  El SONIDO nunca depende de la llegada de un paquete: cada maquina dispara
//  su propio audio en el instante en que SU PROPIO acumulador cruza un paso.
//  Asi no hay cortes ni desfase por jitter de red (ver src/techno.js).
// ==========================================================================
const TECHNO = {
  CANALES: 11,        // 0-3 drums (host) · 4-10 melodia (guest): bajo x4 + sinte + piano + guitarra
  DRUM_ROWS: 4,
  MELODY_ROWS: 7,
  PASOS: 17,
  BPM_MIN: 100,
  BPM_MAX: 160,
  BPM_DEF: 130,
  CUT_MIN: 200,
  CUT_MAX: 8000,
  CUT_DEF: 1200,
  RES_MIN: 0.5,
  RES_MAX: 30,
  RES_DEF: 8,
  // Escala de Do menor (frecuencias Hz) para los canales melodicos
  NOTAS: [
    { nombre: "C2",  hz: 65.41 },
    { nombre: "D2",  hz: 73.42 },
    { nombre: "Eb2", hz: 77.78 },
    { nombre: "F2",  hz: 87.31 },
    { nombre: "G2",  hz: 98.00 },
    { nombre: "Ab2", hz: 103.83 },
    { nombre: "Bb2", hz: 116.54 },
    { nombre: "C3",  hz: 130.81 },
    { nombre: "D3",  hz: 146.83 },
    { nombre: "Eb3", hz: 155.56 },
    { nombre: "F3",  hz: 174.61 },
    { nombre: "G3",  hz: 196.00 },
  ],
  // 0-3 drums, 4-7 bajo 303, 8 sinte, 9 piano, 10 guitarra
  NOMBRES_CANAL: ["KICK", "SNARE", "C.HAT", "O.HAT", "BASS1", "BASS2", "BASS3", "BASS4", "SYNTH", "PIANO", "GTR"],
};

class TechnoSim {
  constructor() {
    // Grid: CANALES x PASOS. Drums = boolean, melodia = indice de nota (-1 = off)
    this.grid = [];
    for (let ch = 0; ch < TECHNO.CANALES; ch++) {
      this.grid[ch] = new Array(TECHNO.PASOS).fill(ch < TECHNO.DRUM_ROWS ? false : -1);
    }
    // Patron inicial: kick en 4x4 basico
    this.grid[0][0] = true; this.grid[0][4] = true;
    this.grid[0][8] = true; this.grid[0][12] = true;
    // Closed hat cada 2 pasos
    this.grid[2][0] = true; this.grid[2][2] = true;
    this.grid[2][4] = true; this.grid[2][6] = true;
    this.grid[2][8] = true; this.grid[2][10] = true;
    this.grid[2][12] = true; this.grid[2][14] = true;

    this.bpm = TECHNO.BPM_DEF;
    this.currentStep = 0;
    this.acc = 0;               // acumulador de tiempo del paso actual (seg)
    this.stepTriggered = false; // flag: en este step() se cruzo un paso nuevo
    this.playing = true;

    this.mute = new Array(TECHNO.CANALES).fill(false);

    // Filtro 303 (controlado por el guest, canales de bajo 4-7)
    this.cutoff = TECHNO.CUT_DEF;
    this.resonance = TECHNO.RES_DEF;

    // Nota por defecto de cada canal melodico (indice en TECHNO.NOTAS)
    // [BASS1, BASS2, BASS3, BASS4, SYNTH, PIANO, GUITAR]
    this.melodyNotes = [0, 3, 4, 7, 2, 6, 9];

    this.gameMode = "jam";
    this.energy = 0;
    this.barsPlayed = 0;

    this.revancha = { 1: false, 2: false };
    this.ganador = 0;

    this.seq = 0;
  }

  get stepDuration() {
    return 60 / this.bpm / 4; // duracion de un paso de semicorchea en segundos
  }

  // Avanza el reloj LOCAL. No manda ni recibe nada: eso lo hace techno.js.
  step(dt) {
    if (!this.playing) { this.stepTriggered = false; return; }
    this.stepTriggered = false;
    this.acc += dt;
    const dur = this.stepDuration;
    if (this.acc >= dur) {
      this.acc -= dur;
      if (this.acc > dur) this.acc = 0;   // evita acumulacion excesiva tras un lag
      this.currentStep = (this.currentStep + 1) % TECHNO.PASOS;
      this.stepTriggered = true;
      this.seq++;
      if (this.currentStep === 0) this.barsPlayed++;
    }
  }

  // ---- correccion de fase (solo la llama el guest, con datos del host) ----
  // Nunca dispara audio ni "salta" de forma audible salvo un desvio enorme
  // (recien conectado o cambio brusco de tempo): es un ajuste tipo PLL que
  // acerca el reloj local al del host un poco en cada llamada.
  resyncFromHost(hostStep, hostAcc, hostBpm) {
    if (typeof hostBpm === "number" && hostBpm !== this.bpm) this.bpm = hostBpm;
    const dur = this.stepDuration;
    const patternLen = TECHNO.PASOS * dur;
    const hostTotal = hostStep * dur + hostAcc;
    const myTotal = this.currentStep * dur + this.acc;
    let diff = hostTotal - myTotal;
    // envolver la diferencia al rango [-patternLen/2, patternLen/2] (ciclo del patron)
    diff = ((diff + patternLen / 2) % patternLen + patternLen) % patternLen - patternLen / 2;
    if (Math.abs(diff) > dur * 3) {
      this.currentStep = hostStep;
      this.acc = hostAcc;
    } else {
      this.acc += diff * 0.2;
      while (this.acc >= dur) { this.acc -= dur; this.currentStep = (this.currentStep + 1) % TECHNO.PASOS; }
      while (this.acc < 0) { this.acc += dur; this.currentStep = (this.currentStep - 1 + TECHNO.PASOS) % TECHNO.PASOS; }
    }
  }

  // ---- ediciones locales (siempre disponibles: host y guest tienen su sim) ----
  toggleStep(ch, paso) {
    if (ch < 0 || ch >= TECHNO.CANALES || paso < 0 || paso >= TECHNO.PASOS) return;
    if (ch < TECHNO.DRUM_ROWS) {
      this.grid[ch][paso] = !this.grid[ch][paso];
    } else {
      const noteIdx = this.melodyNotes[ch - TECHNO.DRUM_ROWS];
      this.grid[ch][paso] = this.grid[ch][paso] === -1 ? noteIdx : -1;
    }
  }
  // Aplica un valor ya resuelto (lo que llega por red): idempotente, no
  // depende de que el toggle remoto haya arrancado del mismo estado.
  setStepValue(ch, paso, val) {
    if (ch < 0 || ch >= TECHNO.CANALES || paso < 0 || paso >= TECHNO.PASOS) return;
    this.grid[ch][paso] = val;
  }

  setNote(ch, noteIdx) {
    if (ch < TECHNO.DRUM_ROWS || ch >= TECHNO.CANALES) return;
    if (noteIdx < 0 || noteIdx >= TECHNO.NOTAS.length) return;
    const idx = ch - TECHNO.DRUM_ROWS;
    this.melodyNotes[idx] = noteIdx;
    for (let s = 0; s < TECHNO.PASOS; s++) {
      if (this.grid[ch][s] !== -1) this.grid[ch][s] = noteIdx;
    }
  }

  setFilter(cut, res) {
    this.cutoff = clamp(cut, TECHNO.CUT_MIN, TECHNO.CUT_MAX);
    this.resonance = clamp(res, TECHNO.RES_MIN, TECHNO.RES_MAX);
  }

  setBpm(bpm) {
    this.bpm = clamp(Math.round(bpm), TECHNO.BPM_MIN, TECHNO.BPM_MAX);
  }

  toggleMute(ch) {
    if (ch < 0 || ch >= TECHNO.CANALES) return;
    this.mute[ch] = !this.mute[ch];
  }
  setMuteValue(ch, val) {
    if (ch < 0 || ch >= TECHNO.CANALES) return;
    this.mute[ch] = !!val;
  }

  // Snapshot solo para diagnostico/tests; la red NO usa esto para el audio
  // (ver arriba). Se deja liviano por si se necesita en el futuro.
  snapshot() {
    return {
      t: "e",
      step: this.currentStep,
      grid: this.grid,
      mute: this.mute,
      bpm: this.bpm,
      cut: Math.round(this.cutoff),
      res: Math.round(this.resonance * 10) / 10,
      notes: this.melodyNotes,
      playing: this.playing,
      bars: this.barsPlayed,
      seq: this.seq,
    };
  }

  pedirRevancha(n) {
    this.revancha[n] = true;
    if (this.revancha[1] && this.revancha[2]) {
      this.revancha = { 1: false, 2: false };
      for (let ch = 0; ch < TECHNO.CANALES; ch++) {
        this.grid[ch] = new Array(TECHNO.PASOS).fill(ch < TECHNO.DRUM_ROWS ? false : -1);
      }
      this.barsPlayed = 0;
      this.energy = 0;
    }
  }
}
