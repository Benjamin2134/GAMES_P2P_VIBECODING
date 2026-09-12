// ==========================================================================
//  Simulacion autoritativa de TECHNO GROOVEBOX (corre en el host).
//  Reloj de tempo maestro, matriz de secuenciador 8 canales x 16 pasos,
//  estado de filtro 303, mutes y ganchos para modos de juego futuros.
// ==========================================================================
const TECHNO = {
  CANALES: 8,         // 0-3 drums (host), 4-7 bass (guest)
  PASOS: 16,
  BPM_MIN: 100,
  BPM_MAX: 160,
  BPM_DEF: 130,
  CUT_MIN: 200,
  CUT_MAX: 8000,
  CUT_DEF: 1200,
  RES_MIN: 0.5,
  RES_MAX: 30,
  RES_DEF: 8,
  // Escala de Do menor para el bajo (frecuencias Hz)
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
  NOMBRES_CANAL: ["KICK", "SNARE", "C.HAT", "O.HAT", "BASS1", "BASS2", "BASS3", "BASS4"],
};

class TechnoSim {
  constructor() {
    // Grid: 8 canales x 16 pasos. Para drums = boolean, para bass = indice de nota (-1 = off)
    this.grid = [];
    for (let ch = 0; ch < TECHNO.CANALES; ch++) {
      this.grid[ch] = new Array(TECHNO.PASOS).fill(ch < 4 ? false : -1);
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
    this.acc = 0;              // acumulador de tiempo
    this.stepTriggered = false; // flag para disparar audio en este frame
    this.playing = true;

    this.mute = new Array(TECHNO.CANALES).fill(false);

    // Filtro 303 (controlado por guest)
    this.cutoff = TECHNO.CUT_DEF;
    this.resonance = TECHNO.RES_DEF;

    // Notas por defecto para canales de bass (indice en TECHNO.NOTAS)
    this.bassNotes = [0, 3, 4, 7]; // C2, F2, G2, C3

    // Escalabilidad: modo de juego y metricas
    this.gameMode = "jam";     // "jam" | "groove" (B) | "battle" (C)
    this.energy = 0;
    this.barsPlayed = 0;

    // Revancha (contrato del shell)
    this.revancha = { 1: false, 2: false };
    this.ganador = 0;

    this.seq = 0;
  }

  get stepDuration() {
    return 60 / this.bpm / 4; // duración de un step de 16th note en segundos
  }

  step(dt) {
    if (!this.playing) { this.stepTriggered = false; return; }
    this.stepTriggered = false;
    this.acc += dt;
    const dur = this.stepDuration;
    if (this.acc >= dur) {
      this.acc -= dur;
      // Prevenir acumulación excesiva
      if (this.acc > dur) this.acc = 0;
      this.currentStep = (this.currentStep + 1) % TECHNO.PASOS;
      this.stepTriggered = true;
      this.seq++;
      // Contar compases
      if (this.currentStep === 0) this.barsPlayed++;
    }
  }

  toggleStep(ch, paso) {
    if (ch < 0 || ch >= TECHNO.CANALES || paso < 0 || paso >= TECHNO.PASOS) return;
    if (ch < 4) {
      // Drum: boolean toggle
      this.grid[ch][paso] = !this.grid[ch][paso];
    } else {
      // Bass: toggle entre nota actual del canal y off (-1)
      const noteIdx = this.bassNotes[ch - 4];
      this.grid[ch][paso] = this.grid[ch][paso] === -1 ? noteIdx : -1;
    }
  }

  setNote(ch, noteIdx) {
    if (ch < 4 || ch >= TECHNO.CANALES) return;
    if (noteIdx < 0 || noteIdx >= TECHNO.NOTAS.length) return;
    const bassIdx = ch - 4;
    const oldNote = this.bassNotes[bassIdx];
    this.bassNotes[bassIdx] = noteIdx;
    // Actualizar pasos activos con la nueva nota
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

  // Snapshot para enviar por red
  snapshot() {
    return {
      t: "e",
      step: this.currentStep,
      grid: this.grid,
      mute: this.mute,
      bpm: this.bpm,
      cut: Math.round(this.cutoff),
      res: Math.round(this.resonance * 10) / 10,
      notes: this.bassNotes,
      playing: this.playing,
      bars: this.barsPlayed,
      seq: this.seq,
    };
  }

  pedirRevancha(n) {
    // En modo jam no hay revancha; placeholder para modos futuros
    this.revancha[n] = true;
    if (this.revancha[1] && this.revancha[2]) {
      this.revancha = { 1: false, 2: false };
      // Reset para nueva sesión
      for (let ch = 0; ch < TECHNO.CANALES; ch++) {
        this.grid[ch] = new Array(TECHNO.PASOS).fill(ch < 4 ? false : -1);
      }
      this.barsPlayed = 0;
      this.energy = 0;
    }
  }
}
