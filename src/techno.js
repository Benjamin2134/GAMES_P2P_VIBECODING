// ==========================================================================
//  Modulo de juego: TECHNO GROOVEBOX
//  Jam session P2P de musica electronica/techno.
//  Host = Caja de ritmos 909 (canales drum). Guest = Bajo acido 303 x4 +
//  Sinte + Piano + Guitarra (canales de melodia) + Pad XY de filtro.
//  Audio 100% sintetizado con Web Audio API. Cero samples.
//
//  RED: el host y el guest corren CADA UNO su propio reloj de secuenciador
//  (TechnoSim) en su maquina, avanzando localmente cuadro a cuadro. Por la
//  red SOLO viajan ediciones (que ficha se prendio/apago, mute, bpm, filtro,
//  nota) y una correccion de fase de baja frecuencia ("clk"). El audio de
//  cada maquina se dispara siempre desde SU PROPIO reloj local — nunca al
//  recibir un paquete — asi no se corta ni se desfasa con el jitter de red.
//
//  Usa los globales del shell: cv, ctx, net.
// ==========================================================================
(function () {
  // ---- constantes de layout ----
  const W = 880, H = 700;
  const SCOPE_H = 60;
  const HEADER_H = 32;
  const GRID_TOP = SCOPE_H + HEADER_H + 4;
  const CELL_W = 42, CELL_H = 28, CELL_GAP = 3;
  const LABEL_W = 64;
  const GRID_X = LABEL_W + 8;
  const DRUM_ROWS = TECHNO.DRUM_ROWS, MELODY_ROWS = TECHNO.MELODY_ROWS;
  const SEPARATOR_Y = GRID_TOP + DRUM_ROWS * (CELL_H + CELL_GAP) + 6;
  const MELODY_TOP = SEPARATOR_Y + 6;
  const CONTROL_TOP = MELODY_TOP + MELODY_ROWS * (CELL_H + CELL_GAP) + 12;
  const PAD_SIZE = 120;
  const PAD_X = W - PAD_SIZE - 24;
  const PAD_Y = CONTROL_TOP;
  const NOTE_BTN_W = 100, NOTE_BTN_H = 24, NOTE_BTN_GAP = 3;
  const CLK_INTERVALO = 0.5;   // seg entre correcciones de fase host->guest

  // ---- colores ----
  const COL_BG = "#0a0a0f";
  const COL_GRID_OFF = "#1a1a24";
  const COL_GRID_BORDER = "#2a2a3a";
  const COL_DRUM_ON = "#ff8c00";
  const COL_PLAYHEAD = "#ffffff";
  const COL_SCOPE = "#00ff66";
  const COL_MUTED = "#333340";
  const COL_LABEL = "#888899";
  const COL_LABEL_OWN = "#ccccdd";
  const COL_HEADER = "#666677";
  // un color por fila de melodia: BASS1-4 comparten el teal acido; sinte/piano/guitarra distintos
  const COL_MELODY_ON = ["#00e5ff", "#00e5ff", "#00e5ff", "#00e5ff", "#c86bff", "#ffd25a", "#ff7a4a"];
  const COL_MELODY_HI = ["#44eeff", "#44eeff", "#44eeff", "#44eeff", "#e0b3ff", "#ffe49a", "#ffb199"];
  const COL_MELODY_DIM = ["#0a2a2e", "#0a2a2e", "#0a2a2e", "#0a2a2e", "#2a1a33", "#332a12", "#331e14"];

  // ---- audio engine (100% local a esta maquina) ----
  let aCtx = null, analyser = null, analyserData = null, masterGain = null;
  let bassFilter = null, bassDistortion = null;

  function initAudio() {
    if (aCtx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      aCtx = new AC();
      masterGain = aCtx.createGain();
      masterGain.gain.value = 0.7;
      analyser = aCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserData = new Uint8Array(analyser.frequencyBinCount);
      masterGain.connect(analyser);
      analyser.connect(aCtx.destination);

      bassFilter = aCtx.createBiquadFilter();
      bassFilter.type = "lowpass";
      bassFilter.frequency.value = TECHNO.CUT_DEF;
      bassFilter.Q.value = TECHNO.RES_DEF;

      bassDistortion = aCtx.createWaveShaper();
      const samples = 256;
      const curve = new Float32Array(samples);
      for (let i = 0; i < samples; i++) { const x = (i * 2) / samples - 1; curve[i] = Math.tanh(x * 2.5); }
      bassDistortion.curve = curve;
      bassDistortion.oversample = "2x";

      bassFilter.connect(bassDistortion);
      bassDistortion.connect(masterGain);
    } catch (e) {}
  }
  function resumeAudio() { if (aCtx && aCtx.state === "suspended") { try { aCtx.resume(); } catch (e) {} } }

  // ---- sintesis de drums 909 ----
  function playKick() {
    if (!aCtx || RetroAudio.isMuted()) return;
    try {
      const now = aCtx.currentTime;
      const osc = aCtx.createOscillator(), gain = aCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);
      gain.gain.setValueAtTime(0.9, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain); gain.connect(masterGain);
      osc.start(now); osc.stop(now + 0.36);
    } catch (e) {}
  }
  function playSnare() {
    if (!aCtx || RetroAudio.isMuted()) return;
    try {
      const now = aCtx.currentTime;
      const osc = aCtx.createOscillator(), oscGain = aCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(200, now);
      oscGain.gain.setValueAtTime(0.45, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(oscGain); oscGain.connect(masterGain);
      osc.start(now); osc.stop(now + 0.06);
      const bufLen = Math.floor(aCtx.sampleRate * 0.15);
      const buf = aCtx.createBuffer(1, bufLen, aCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
      const noise = aCtx.createBufferSource();
      noise.buffer = buf;
      const nf = aCtx.createBiquadFilter();
      nf.type = "bandpass"; nf.frequency.value = 3000; nf.Q.value = 1.2;
      const ng = aCtx.createGain();
      ng.gain.setValueAtTime(0.55, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      noise.connect(nf); nf.connect(ng); ng.connect(masterGain);
      noise.start(now);
    } catch (e) {}
  }
  function playHat(open) {
    if (!aCtx || RetroAudio.isMuted()) return;
    try {
      const now = aCtx.currentTime;
      const dur = open ? 0.2 : 0.03;
      const bufLen = Math.floor(aCtx.sampleRate * (dur + 0.05));
      const buf = aCtx.createBuffer(1, bufLen, aCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
      const noise = aCtx.createBufferSource();
      noise.buffer = buf;
      const hpf = aCtx.createBiquadFilter();
      hpf.type = "highpass"; hpf.frequency.value = open ? 6000 : 8000;
      const gain = aCtx.createGain();
      gain.gain.setValueAtTime(open ? 0.28 : 0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      noise.connect(hpf); hpf.connect(gain); gain.connect(masterGain);
      noise.start(now);
    } catch (e) {}
  }
  const drumFn = [playKick, playSnare, () => playHat(false), () => playHat(true)];

  // ---- sintesis de bajo 303 (comparte el filtro persistente + distorsion) ----
  function playBass(freq, cutoff, resonance) {
    if (!aCtx || RetroAudio.isMuted()) return;
    try {
      const now = aCtx.currentTime;
      const osc = aCtx.createOscillator(), gain = aCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now);
      bassFilter.frequency.cancelScheduledValues(now);
      bassFilter.frequency.setValueAtTime(cutoff * 1.8, now);
      bassFilter.frequency.exponentialRampToValueAtTime(Math.max(cutoff, 200), now + 0.12);
      bassFilter.Q.setValueAtTime(resonance, now);
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.setValueAtTime(0.55, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain); gain.connect(bassFilter);
      osc.start(now); osc.stop(now + 0.22);
    } catch (e) {}
  }

  // ---- sintesis de sinte (lead con filtro propio, no comparte el del 303) ----
  function playSynth(freq) {
    if (!aCtx || RetroAudio.isMuted()) return;
    try {
      const now = aCtx.currentTime;
      const filt = aCtx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.setValueAtTime(freq * 7, now);
      filt.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.6, 250), now + 0.16);
      filt.Q.value = 5;
      const gain = aCtx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.32, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
      filt.connect(gain); gain.connect(masterGain);
      for (const det of [-6, 6]) {
        const osc = aCtx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.setValueAtTime(det, now);
        osc.connect(filt);
        osc.start(now); osc.stop(now + 0.3);
      }
    } catch (e) {}
  }

  // ---- sintesis de piano (electrico: fundamental + parcial rapido tipo campana) ----
  function playPiano(freq) {
    if (!aCtx || RetroAudio.isMuted()) return;
    try {
      const now = aCtx.currentTime;
      const g1 = aCtx.createGain();
      g1.gain.setValueAtTime(0.0001, now);
      g1.gain.exponentialRampToValueAtTime(0.45, now + 0.004);
      g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      g1.connect(masterGain);
      const o1 = aCtx.createOscillator();
      o1.type = "triangle"; o1.frequency.setValueAtTime(freq, now);
      o1.connect(g1); o1.start(now); o1.stop(now + 0.95);

      const g2 = aCtx.createGain();
      g2.gain.setValueAtTime(0.0001, now);
      g2.gain.exponentialRampToValueAtTime(0.16, now + 0.003);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      g2.connect(masterGain);
      const o2 = aCtx.createOscillator();
      o2.type = "sine"; o2.frequency.setValueAtTime(freq * 2.01, now);
      o2.connect(g2); o2.start(now); o2.stop(now + 0.35);
    } catch (e) {}
  }

  // ---- sintesis de guitarra (pluck: banda pasante resonante + unisono leve) ----
  function playGuitar(freq) {
    if (!aCtx || RetroAudio.isMuted()) return;
    try {
      const now = aCtx.currentTime;
      const bp = aCtx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = freq * 2.3; bp.Q.value = 3.2;
      const gain = aCtx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.38, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      bp.connect(gain); gain.connect(masterGain);
      for (const det of [0, 7]) {
        const osc = aCtx.createOscillator();
        osc.type = "sawtooth"; osc.frequency.setValueAtTime(freq, now); osc.detune.setValueAtTime(det, now);
        osc.connect(bp);
        osc.start(now); osc.stop(now + 0.55);
      }
    } catch (e) {}
  }

  // fila de melodia (0-3 bajo, 4 sinte, 5 piano, 6 guitarra) -> funcion de sintesis
  function playMelody(fila, freq, cutoff, resonance) {
    if (fila < 4) playBass(freq, cutoff, resonance);
    else if (fila === 4) playSynth(freq);
    else if (fila === 5) playPiano(freq);
    else playGuitar(freq);
  }

  // ---- estado del modulo: AMBOS roles tienen su propio reloj+grid local ----
  let sim = null;
  let clkAcc = 0;         // host: acumulador para mandar correccion de fase
  let dragPad = false;
  let hoverCell = null;

  // ---- input: coords ----
  function canvasPos(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }
  function gridHit(px, py) {
    for (let ch = 0; ch < DRUM_ROWS; ch++) {
      const y = GRID_TOP + ch * (CELL_H + CELL_GAP);
      if (py >= y && py < y + CELL_H) {
        for (let s = 0; s < TECHNO.PASOS; s++) {
          const x = GRID_X + s * (CELL_W + CELL_GAP);
          if (px >= x && px < x + CELL_W) return { ch, s };
        }
      }
    }
    for (let i = 0; i < MELODY_ROWS; i++) {
      const ch = i + DRUM_ROWS;
      const y = MELODY_TOP + i * (CELL_H + CELL_GAP);
      if (py >= y && py < y + CELL_H) {
        for (let s = 0; s < TECHNO.PASOS; s++) {
          const x = GRID_X + s * (CELL_W + CELL_GAP);
          if (px >= x && px < x + CELL_W) return { ch, s };
        }
      }
    }
    return null;
  }
  function padHit(px, py) { return px >= PAD_X && px < PAD_X + PAD_SIZE && py >= PAD_Y && py < PAD_Y + PAD_SIZE; }
  function labelHit(px, py) {
    for (let ch = 0; ch < DRUM_ROWS; ch++) {
      const y = GRID_TOP + ch * (CELL_H + CELL_GAP);
      if (py >= y && py < y + CELL_H && px < GRID_X) return ch;
    }
    for (let i = 0; i < MELODY_ROWS; i++) {
      const y = MELODY_TOP + i * (CELL_H + CELL_GAP);
      if (py >= y && py < y + CELL_H && px < GRID_X) return i + DRUM_ROWS;
    }
    return -1;
  }
  function noteAreaHit(px, py) {
    const btnY = CONTROL_TOP, startX = LABEL_W + 8;
    if (py >= btnY && py < btnY + MELODY_ROWS * (NOTE_BTN_H + NOTE_BTN_GAP)) {
      for (let i = 0; i < MELODY_ROWS; i++) {
        const by = btnY + i * (NOTE_BTN_H + NOTE_BTN_GAP);
        if (py >= by && py < by + NOTE_BTN_H && px >= startX && px < startX + NOTE_BTN_W) return i + DRUM_ROWS;
      }
    }
    return -1;
  }

  // ---- helpers de red: aplicar localmente + mandar el VALOR resultante ----
  // (mandar el valor ya resuelto, no un "toggle" ciego, evita que un paquete
  // perdido en el canal no confiable deje los dos tableros desincronizados)
  function editarPaso(ch, s) {
    sim.toggleStep(ch, s);
    net.enviar(JSON.stringify({ t: "tog", ch, s, val: sim.grid[ch][s] }));
  }
  function editarMute(ch) {
    sim.toggleMute(ch);
    net.enviar(JSON.stringify({ t: "mut", ch, val: sim.mute[ch] }));
  }

  // ---- handlers ----
  function onPointerDown(e) {
    resumeAudio(); initAudio();
    if (!sim) return;
    const p = canvasPos(e);

    if (padHit(p.x, p.y)) {
      if (net.rol === 2) { dragPad = true; updatePad(p.x, p.y); }
      return;
    }
    const hit = gridHit(p.x, p.y);
    if (hit) {
      const canEdit = (net.rol === 1 && hit.ch < DRUM_ROWS) || (net.rol === 2 && hit.ch >= DRUM_ROWS);
      if (canEdit) editarPaso(hit.ch, hit.s);
      return;
    }
    const lblCh = labelHit(p.x, p.y);
    if (lblCh >= 0) {
      const canEdit = (net.rol === 1 && lblCh < DRUM_ROWS) || (net.rol === 2 && lblCh >= DRUM_ROWS);
      if (canEdit) editarMute(lblCh);
      return;
    }
    if (net.rol === 2) {
      const nch = noteAreaHit(p.x, p.y);
      if (nch >= 0) {
        const idx = nch - DRUM_ROWS;
        const next = (sim.melodyNotes[idx] + 1) % TECHNO.NOTAS.length;
        sim.setNote(nch, next);
        net.enviar(JSON.stringify({ t: "note", ch: nch, ni: next }));
      }
    }
  }
  function onPointerMove(e) {
    const p = canvasPos(e);
    if (dragPad && net.rol === 2) { updatePad(p.x, p.y); return; }
    hoverCell = gridHit(p.x, p.y);
  }
  function onPointerUp() { dragPad = false; }
  function updatePad(px, py) {
    if (!sim) return;
    const nx = clamp((px - PAD_X) / PAD_SIZE, 0, 1);
    const ny = clamp(1 - (py - PAD_Y) / PAD_SIZE, 0, 1);
    const cut = TECHNO.CUT_MIN + nx * (TECHNO.CUT_MAX - TECHNO.CUT_MIN);
    const res = TECHNO.RES_MIN + ny * (TECHNO.RES_MAX - TECHNO.RES_MIN);
    sim.setFilter(cut, res);
    if (bassFilter) { bassFilter.frequency.value = sim.cutoff; bassFilter.Q.value = sim.resonance; }
    net.enviar(JSON.stringify({ t: "flt", cut: Math.round(sim.cutoff), res: Math.round(sim.resonance * 10) / 10 }));
  }
  function onKeyDown(e) {
    if (!sim) return;
    if (net.rol === 1) {
      if (e.key === "+" || e.key === "=") { sim.setBpm(sim.bpm + 1); net.enviar(JSON.stringify({ t: "bpm", bpm: sim.bpm })); e.preventDefault(); return; }
      if (e.key === "-" || e.key === "_") { sim.setBpm(sim.bpm - 1); net.enviar(JSON.stringify({ t: "bpm", bpm: sim.bpm })); e.preventDefault(); return; }
    }
    // Mute rapido: teclas 1-9 cubren los primeros 9 canales (falta GUITAR, fila 11)
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) {
      const ch = n - 1;
      const canEdit = (net.rol === 1 && ch < DRUM_ROWS) || (net.rol === 2 && ch >= DRUM_ROWS && ch < TECHNO.CANALES);
      if (canEdit) editarMute(ch);
    }
  }
  function hookInput() {
    cv.addEventListener("pointerdown", onPointerDown);
    cv.addEventListener("pointermove", onPointerMove);
    cv.addEventListener("pointerup", onPointerUp);
    cv.addEventListener("pointerleave", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
  }
  function unhookInput() {
    cv.removeEventListener("pointerdown", onPointerDown);
    cv.removeEventListener("pointermove", onPointerMove);
    cv.removeEventListener("pointerup", onPointerUp);
    cv.removeEventListener("pointerleave", onPointerUp);
    window.removeEventListener("keydown", onKeyDown);
  }

  // ---- disparo de audio: SIEMPRE local, llamado por el reloj propio ----
  function triggerStep(step, s) {
    for (let ch = 0; ch < DRUM_ROWS; ch++) {
      if (!s.mute[ch] && s.grid[ch][step]) drumFn[ch]();
    }
    for (let i = 0; i < MELODY_ROWS; i++) {
      const ch = i + DRUM_ROWS;
      if (s.mute[ch]) continue;
      const val = s.grid[ch][step];
      if (val === -1) continue;
      const nota = TECHNO.NOTAS[val];
      if (nota) playMelody(i, nota.hz, s.cutoff, s.resonance);
    }
  }

  // ---- render ----
  function render(now) {
    const s = sim;
    ctx.fillStyle = COL_BG; ctx.fillRect(0, 0, W, H);
    if (!s) return;

    if (analyser && analyserData) {
      analyser.getByteTimeDomainData(analyserData);
      ctx.strokeStyle = COL_SCOPE; ctx.lineWidth = 1.5;
      ctx.beginPath();
      const sliceW = W / analyserData.length;
      for (let i = 0; i < analyserData.length; i++) {
        const v = analyserData[i] / 128.0, y = (v * SCOPE_H) / 2;
        if (i === 0) ctx.moveTo(0, y); else ctx.lineTo(i * sliceW, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = "#1a2a1a"; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, SCOPE_H / 2); ctx.lineTo(W, SCOPE_H / 2); ctx.stroke();

    ctx.font = "bold 13px ui-monospace, monospace"; ctx.textAlign = "left";
    ctx.fillStyle = COL_HEADER; ctx.fillText("BPM", 8, SCOPE_H + 18);
    ctx.fillStyle = "#fff"; ctx.fillText(s.bpm.toString(), 42, SCOPE_H + 18);
    ctx.fillStyle = COL_HEADER; ctx.fillText("STEP", 90, SCOPE_H + 18);
    ctx.fillStyle = "#fff"; ctx.fillText((s.currentStep + 1).toString().padStart(2, "0") + "/" + TECHNO.PASOS, 130, SCOPE_H + 18);
    ctx.fillStyle = COL_HEADER; ctx.fillText("BAR", 200, SCOPE_H + 18);
    ctx.fillStyle = "#fff"; ctx.fillText(s.barsPlayed.toString(), 230, SCOPE_H + 18);

    const rolTxt = net.rol === 1 ? "HOST  🥁 DRUMS" : "GUEST  🎹 MELODÍA";
    ctx.fillStyle = net.rol === 1 ? COL_DRUM_ON : COL_MELODY_ON[0];
    ctx.textAlign = "right"; ctx.fillText(rolTxt, W - 8, SCOPE_H + 18); ctx.textAlign = "left";

    // grid de drums
    for (let ch = 0; ch < DRUM_ROWS; ch++) {
      const y = GRID_TOP + ch * (CELL_H + CELL_GAP);
      const isMuted = s.mute[ch], isOwn = net.rol === 1;
      ctx.fillStyle = isMuted ? COL_MUTED : (isOwn ? COL_LABEL_OWN : COL_LABEL);
      ctx.font = "bold 11px ui-monospace, monospace";
      ctx.fillText(TECHNO.NOMBRES_CANAL[ch], 6, y + 18);
      if (isMuted) { ctx.fillStyle = "#ff3333"; ctx.font = "bold 9px ui-monospace, monospace"; ctx.fillText("M", LABEL_W - 8, y + 10); }
      for (let st = 0; st < TECHNO.PASOS; st++) {
        const x = GRID_X + st * (CELL_W + CELL_GAP);
        const on = s.grid[ch] && s.grid[ch][st];
        const isPh = st === s.currentStep;
        ctx.fillStyle = isMuted ? COL_MUTED : on ? (isPh ? "#ffbb44" : COL_DRUM_ON) : (isPh ? "#2a2a1a" : COL_GRID_OFF);
        ctx.fillRect(x, y, CELL_W, CELL_H);
        ctx.strokeStyle = isPh ? COL_PLAYHEAD : COL_GRID_BORDER; ctx.lineWidth = isPh ? 1.5 : 0.5;
        ctx.strokeRect(x, y, CELL_W, CELL_H);
        if (st % 4 === 0) { ctx.fillStyle = "#444455"; ctx.fillRect(x, y, 2, CELL_H); }
      }
    }

    ctx.strokeStyle = "#333344"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(GRID_X, SEPARATOR_Y); ctx.lineTo(GRID_X + TECHNO.PASOS * (CELL_W + CELL_GAP), SEPARATOR_Y); ctx.stroke();
    ctx.setLineDash([]);

    // grid de melodia
    for (let i = 0; i < MELODY_ROWS; i++) {
      const ch = i + DRUM_ROWS;
      const y = MELODY_TOP + i * (CELL_H + CELL_GAP);
      const isMuted = s.mute[ch], isOwn = net.rol === 2;
      const noteIdx = s.melodyNotes[i];
      const noteName = TECHNO.NOTAS[noteIdx] ? TECHNO.NOTAS[noteIdx].nombre : "?";
      ctx.fillStyle = isMuted ? COL_MUTED : (isOwn ? COL_LABEL_OWN : COL_LABEL);
      ctx.font = "bold 10px ui-monospace, monospace";
      ctx.fillText(TECHNO.NOMBRES_CANAL[ch] + " " + noteName, 4, y + 18);
      if (isMuted) { ctx.fillStyle = "#ff3333"; ctx.font = "bold 9px ui-monospace, monospace"; ctx.fillText("M", LABEL_W - 8, y + 10); }
      for (let st = 0; st < TECHNO.PASOS; st++) {
        const x = GRID_X + st * (CELL_W + CELL_GAP);
        const val = s.grid[ch] ? s.grid[ch][st] : -1;
        const on = val !== -1, isPh = st === s.currentStep;
        ctx.fillStyle = isMuted ? COL_MUTED : on ? (isPh ? COL_MELODY_HI[i] : COL_MELODY_ON[i]) : (isPh ? COL_MELODY_DIM[i] : COL_GRID_OFF);
        ctx.fillRect(x, y, CELL_W, CELL_H);
        ctx.strokeStyle = isPh ? COL_PLAYHEAD : COL_GRID_BORDER; ctx.lineWidth = isPh ? 1.5 : 0.5;
        ctx.strokeRect(x, y, CELL_W, CELL_H);
        if (on && !isMuted) {
          const n = TECHNO.NOTAS[val];
          if (n) { ctx.fillStyle = "#000"; ctx.font = "bold 9px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.fillText(n.nombre, x + CELL_W / 2, y + 18); ctx.textAlign = "left"; }
        }
        if (st % 4 === 0) { ctx.fillStyle = "#444455"; ctx.fillRect(x, y, 2, CELL_H); }
      }
    }

    // pad XY (filtro 303 — solo afecta a los canales de bajo)
    ctx.fillStyle = "#111118"; ctx.fillRect(PAD_X, PAD_Y, PAD_SIZE, PAD_SIZE);
    ctx.strokeStyle = net.rol === 2 ? COL_MELODY_ON[0] : "#333344"; ctx.lineWidth = 1.5;
    ctx.strokeRect(PAD_X, PAD_Y, PAD_SIZE, PAD_SIZE);
    ctx.strokeStyle = "#2a2a3a"; ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(PAD_X + PAD_SIZE / 2, PAD_Y); ctx.lineTo(PAD_X + PAD_SIZE / 2, PAD_Y + PAD_SIZE);
    ctx.moveTo(PAD_X, PAD_Y + PAD_SIZE / 2); ctx.lineTo(PAD_X + PAD_SIZE, PAD_Y + PAD_SIZE / 2);
    ctx.stroke();
    const padNx = (s.cutoff - TECHNO.CUT_MIN) / (TECHNO.CUT_MAX - TECHNO.CUT_MIN);
    const padNy = 1 - (s.resonance - TECHNO.RES_MIN) / (TECHNO.RES_MAX - TECHNO.RES_MIN);
    const dotX = PAD_X + padNx * PAD_SIZE, dotY = PAD_Y + padNy * PAD_SIZE;
    ctx.fillStyle = COL_MELODY_ON[0]; ctx.beginPath(); ctx.arc(dotX, dotY, 6, 0, 6.2832); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(dotX, dotY, 2.5, 0, 6.2832); ctx.fill();
    ctx.fillStyle = COL_HEADER; ctx.font = "9px ui-monospace, monospace"; ctx.textAlign = "center";
    ctx.fillText("CUTOFF (bajo)", PAD_X + PAD_SIZE / 2, PAD_Y + PAD_SIZE + 12);
    ctx.save(); ctx.translate(PAD_X - 6, PAD_Y + PAD_SIZE / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("RESO", 0, 0); ctx.restore();
    ctx.textAlign = "left";
    ctx.fillStyle = COL_MELODY_ON[0]; ctx.font = "bold 10px ui-monospace, monospace";
    ctx.fillText("CUT " + Math.round(s.cutoff) + " Hz", PAD_X, PAD_Y + PAD_SIZE + 24);
    ctx.fillText("RES " + s.resonance.toFixed(1), PAD_X + 80, PAD_Y + PAD_SIZE + 24);

    // selectores de nota (guest, un boton por fila de melodia)
    if (net.rol === 2) {
      const startX = LABEL_W + 8;
      ctx.font = "bold 10px ui-monospace, monospace";
      for (let i = 0; i < MELODY_ROWS; i++) {
        const by = CONTROL_TOP + i * (NOTE_BTN_H + NOTE_BTN_GAP);
        const noteIdx = s.melodyNotes[i];
        const nota = TECHNO.NOTAS[noteIdx];
        ctx.fillStyle = "#1a1a24"; ctx.fillRect(startX, by, NOTE_BTN_W, NOTE_BTN_H);
        ctx.strokeStyle = COL_MELODY_DIM[i]; ctx.lineWidth = 1; ctx.strokeRect(startX, by, NOTE_BTN_W, NOTE_BTN_H);
        ctx.fillStyle = COL_MELODY_ON[i];
        ctx.fillText(TECHNO.NOMBRES_CANAL[i + DRUM_ROWS] + " ► " + (nota ? nota.nombre : "?"), startX + 6, by + 16);
      }
    }

    const pulse = Math.sin(now / 100) * 0.3 + 0.7;
    const phX = GRID_X + s.currentStep * (CELL_W + CELL_GAP);
    ctx.fillStyle = "rgba(255,255,255," + (pulse * 0.15).toFixed(2) + ")";
    ctx.fillRect(phX, GRID_TOP, CELL_W, DRUM_ROWS * (CELL_H + CELL_GAP) + 12 + MELODY_ROWS * (CELL_H + CELL_GAP));
  }

  // ---- modulo JUEGOS.techno ----
  JUEGOS.techno = {
    nombre: "Techno Jam",
    desc: "Groovebox P2P — Host: Drums 909 · Guest: Bajo 303 + Sinte + Piano + Guitarra",
    canvas: { w: W, h: H },

    iniciarHost() {
      initAudio(); resumeAudio();
      sim = new TechnoSim();
      clkAcc = 0;
      hookInput();
    },
    iniciarGuest() {
      initAudio(); resumeAudio();
      sim = new TechnoSim();   // reloj propio e independiente: nunca depende de la red para sonar
      clkAcc = 0;
      hookInput();
    },
    destruir() {
      unhookInput();
      sim = null; dragPad = false; hoverCell = null;
    },

    onData(msg) {
      if (!msg || typeof msg !== "object" || !sim) return;
      if (msg.t === "tog") { sim.setStepValue(msg.ch, msg.s, msg.val); return; }
      if (msg.t === "mut") { sim.setMuteValue(msg.ch, msg.val); return; }
      if (msg.t === "bpm") { sim.setBpm(msg.bpm); return; }
      if (msg.t === "flt") {
        sim.setFilter(msg.cut, msg.res);
        if (bassFilter) { bassFilter.frequency.value = sim.cutoff; bassFilter.Q.value = sim.resonance; }
        return;
      }
      if (msg.t === "note") { sim.setNote(msg.ch, msg.ni); return; }
      if (msg.t === "clk") { if (net.rol === 2) sim.resyncFromHost(msg.step, msg.acc, msg.bpm); return; }
      if (msg.t === "rev") { sim.pedirRevancha(msg.who === 1 || msg.who === 2 ? msg.who : (net.rol === 1 ? 2 : 1)); return; }
    },

    // Reloj y audio: SIEMPRE locales. La red solo aporta ediciones + una
    // correccion de fase de baja frecuencia (ver header del archivo).
    frame(now, dt, pausado) {
      if (sim && !pausado) {
        sim.step(dt);
        if (sim.stepTriggered) triggerStep(sim.currentStep, sim);
        if (net.rol === 1) {
          clkAcc += dt;
          if (clkAcc >= CLK_INTERVALO) {
            clkAcc = 0;
            net.enviar(JSON.stringify({ t: "clk", step: sim.currentStep, acc: Math.round(sim.acc * 1000) / 1000, bpm: sim.bpm }));
          }
        }
      }
      render(now);
    },

    overlay() { return null; }, // jam libre: sin victoria/derrota

    revancha() {
      if (!sim) return;
      sim.pedirRevancha(net.rol);
      net.enviar(JSON.stringify({ t: "rev", who: net.rol }));
    },
  };
})();
