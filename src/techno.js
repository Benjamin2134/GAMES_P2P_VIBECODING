// ==========================================================================
//  Modulo de juego: TECHNO GROOVEBOX
//  Jam session P2P de musica electronica/techno.
//  Host = Caja de ritmos 909 (canales 0-3).
//  Guest = Bajo acido 303 (canales 4-7) + Pad XY filtro.
//  Audio 100% sintetizado con Web Audio API. Cero samples.
//  Usa los globales del shell: cv, ctx, net.
// ==========================================================================
(function () {
  // ---- constantes de layout ----
  const W = 820, H = 520;
  const SCOPE_H = 60;
  const HEADER_H = 32;
  const GRID_TOP = SCOPE_H + HEADER_H + 4;
  const CELL_W = 42, CELL_H = 28, CELL_GAP = 3;
  const LABEL_W = 64;
  const GRID_X = LABEL_W + 8;
  const DRUM_ROWS = 4, BASS_ROWS = 4;
  const SEPARATOR_Y = GRID_TOP + DRUM_ROWS * (CELL_H + CELL_GAP) + 6;
  const BASS_TOP = SEPARATOR_Y + 6;
  const CONTROL_TOP = BASS_TOP + BASS_ROWS * (CELL_H + CELL_GAP) + 12;
  const PAD_SIZE = 120;
  const PAD_X = W - PAD_SIZE - 24;
  const PAD_Y = CONTROL_TOP;

  // ---- colores ----
  const COL_BG = "#0a0a0f";
  const COL_GRID_OFF = "#1a1a24";
  const COL_GRID_BORDER = "#2a2a3a";
  const COL_DRUM_ON = "#ff8c00";
  const COL_DRUM_DIM = "#663800";
  const COL_BASS_ON = "#00e5ff";
  const COL_BASS_DIM = "#005566";
  const COL_PLAYHEAD = "#ffffff";
  const COL_SCOPE = "#00ff66";
  const COL_MUTED = "#333340";
  const COL_LABEL = "#888899";
  const COL_LABEL_OWN = "#ccccdd";
  const COL_HEADER = "#666677";

  // ---- audio engine ----
  let aCtx = null;
  let analyser = null;
  let analyserData = null;
  let masterGain = null;

  // Nodo de filtro persistente para el bajo 303
  let bassFilter = null;
  let bassDistortion = null;

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

      // Filtro 303 persistente
      bassFilter = aCtx.createBiquadFilter();
      bassFilter.type = "lowpass";
      bassFilter.frequency.value = TECHNO.CUT_DEF;
      bassFilter.Q.value = TECHNO.RES_DEF;

      // Distorsion tanh para el acido
      bassDistortion = aCtx.createWaveShaper();
      const samples = 256;
      const curve = new Float32Array(samples);
      for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = Math.tanh(x * 2.5);
      }
      bassDistortion.curve = curve;
      bassDistortion.oversample = "2x";

      bassFilter.connect(bassDistortion);
      bassDistortion.connect(masterGain);
    } catch (e) {}
  }

  function resumeAudio() {
    if (aCtx && aCtx.state === "suspended") {
      try { aCtx.resume(); } catch (e) {}
    }
  }

  // ---- sintesis de drums 909 ----
  function playKick() {
    if (!aCtx || RetroAudio.isMuted()) return;
    try {
      const now = aCtx.currentTime;
      const osc = aCtx.createOscillator();
      const gain = aCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);
      gain.gain.setValueAtTime(0.9, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.36);
    } catch (e) {}
  }

  function playSnare() {
    if (!aCtx || RetroAudio.isMuted()) return;
    try {
      const now = aCtx.currentTime;
      // Tono
      const osc = aCtx.createOscillator();
      const oscGain = aCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(200, now);
      oscGain.gain.setValueAtTime(0.45, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.06);
      // Ruido
      const bufLen = Math.floor(aCtx.sampleRate * 0.15);
      const buf = aCtx.createBuffer(1, bufLen, aCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
      const noise = aCtx.createBufferSource();
      noise.buffer = buf;
      const nf = aCtx.createBiquadFilter();
      nf.type = "bandpass";
      nf.frequency.value = 3000;
      nf.Q.value = 1.2;
      const ng = aCtx.createGain();
      ng.gain.setValueAtTime(0.55, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      noise.connect(nf);
      nf.connect(ng);
      ng.connect(masterGain);
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
      hpf.type = "highpass";
      hpf.frequency.value = open ? 6000 : 8000;
      const gain = aCtx.createGain();
      gain.gain.setValueAtTime(open ? 0.28 : 0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      noise.connect(hpf);
      hpf.connect(gain);
      gain.connect(masterGain);
      noise.start(now);
    } catch (e) {}
  }

  // ---- sintesis de bajo 303 ----
  function playBass(freq, cutoff, resonance) {
    if (!aCtx || RetroAudio.isMuted()) return;
    try {
      const now = aCtx.currentTime;
      const osc = aCtx.createOscillator();
      const gain = aCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now);

      // Envelope del filtro (accent)
      bassFilter.frequency.cancelScheduledValues(now);
      bassFilter.frequency.setValueAtTime(cutoff * 1.8, now);
      bassFilter.frequency.exponentialRampToValueAtTime(Math.max(cutoff, 200), now + 0.12);
      bassFilter.Q.setValueAtTime(resonance, now);

      gain.gain.setValueAtTime(0.55, now);
      gain.gain.setValueAtTime(0.55, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(bassFilter);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch (e) {}
  }

  const drumFn = [playKick, playSnare, () => playHat(false), () => playHat(true)];

  // ---- estado del modulo ----
  let sim = null;           // solo el host tiene sim
  let localGrid = [];       // copia local del grid (para el guest)
  let localStep = 0;
  let localBpm = TECHNO.BPM_DEF;
  let localMute = [];
  let localCutoff = TECHNO.CUT_DEF;
  let localRes = TECHNO.RES_DEF;
  let localBassNotes = [0, 3, 4, 7];
  let localPlaying = true;
  let localBars = 0;
  let hAcc = 0;             // acumulador host para step
  let lastStepTriggered = -1;
  let sendAcc = 0;

  // Interaccion
  let dragPad = false;
  let hoverCell = null;     // {ch, s}
  let noteSelector = null;  // {ch, visible}

  // ---- funciones de input ----
  function canvasPos(e) {
    const r = cv.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (W / r.width),
      y: (e.clientY - r.top) * (H / r.height)
    };
  }

  function gridHit(px, py) {
    // Drums
    for (let ch = 0; ch < DRUM_ROWS; ch++) {
      const y = GRID_TOP + ch * (CELL_H + CELL_GAP);
      if (py >= y && py < y + CELL_H) {
        for (let s = 0; s < TECHNO.PASOS; s++) {
          const x = GRID_X + s * (CELL_W + CELL_GAP);
          if (px >= x && px < x + CELL_W) return { ch, s };
        }
      }
    }
    // Bass
    for (let i = 0; i < BASS_ROWS; i++) {
      const ch = i + 4;
      const y = BASS_TOP + i * (CELL_H + CELL_GAP);
      if (py >= y && py < y + CELL_H) {
        for (let s = 0; s < TECHNO.PASOS; s++) {
          const x = GRID_X + s * (CELL_W + CELL_GAP);
          if (px >= x && px < x + CELL_W) return { ch, s };
        }
      }
    }
    return null;
  }

  function padHit(px, py) {
    return px >= PAD_X && px < PAD_X + PAD_SIZE && py >= PAD_Y && py < PAD_Y + PAD_SIZE;
  }

  function labelHit(px, py) {
    // Click en label = mute
    for (let ch = 0; ch < DRUM_ROWS; ch++) {
      const y = GRID_TOP + ch * (CELL_H + CELL_GAP);
      if (py >= y && py < y + CELL_H && px < GRID_X) return ch;
    }
    for (let i = 0; i < BASS_ROWS; i++) {
      const y = BASS_TOP + i * (CELL_H + CELL_GAP);
      if (py >= y && py < y + CELL_H && px < GRID_X) return i + 4;
    }
    return -1;
  }

  function noteAreaHit(px, py) {
    // Area de seleccion de nota (debajo del pad o botones de nota)
    const btnY = CONTROL_TOP;
    const btnH = 26;
    const btnW = 50;
    const startX = LABEL_W + 8;
    if (py >= btnY && py < btnY + btnH * 4 + 12) {
      for (let i = 0; i < 4; i++) {
        const by = btnY + i * (btnH + 3);
        if (py >= by && py < by + btnH && px >= startX && px < startX + btnW * 3 + 8) {
          // Cycle through notes
          return i + 4;
        }
      }
    }
    return -1;
  }

  // ---- handlers ----
  function onPointerDown(e) {
    resumeAudio();
    initAudio();
    const p = canvasPos(e);

    // Pad XY (solo guest)
    if (padHit(p.x, p.y)) {
      if (net.rol === 2) {
        dragPad = true;
        updatePad(p.x, p.y);
      }
      return;
    }

    // Grid click
    const hit = gridHit(p.x, p.y);
    if (hit) {
      // Host puede editar ch 0-3, Guest ch 4-7
      const canEdit = (net.rol === 1 && hit.ch < 4) || (net.rol === 2 && hit.ch >= 4);
      if (canEdit) {
        if (sim) sim.toggleStep(hit.ch, hit.s);
        else {
          // Guest: toggle local y enviar
          if (hit.ch >= 4) {
            const noteIdx = localBassNotes[hit.ch - 4];
            localGrid[hit.ch][hit.s] = localGrid[hit.ch][hit.s] === -1 ? noteIdx : -1;
          }
        }
        net.enviar(JSON.stringify({ t: "tog", ch: hit.ch, s: hit.s }));
      }
      return;
    }

    // Label click = mute
    const lblCh = labelHit(p.x, p.y);
    if (lblCh >= 0) {
      if (sim) sim.toggleMute(lblCh);
      else localMute[lblCh] = !localMute[lblCh];
      net.enviar(JSON.stringify({ t: "mut", ch: lblCh }));
      return;
    }

    // Note selector area (solo guest)
    if (net.rol === 2) {
      const nch = noteAreaHit(p.x, p.y);
      if (nch >= 0) {
        const bassIdx = nch - 4;
        const current = localBassNotes[bassIdx];
        const next = (current + 1) % TECHNO.NOTAS.length;
        localBassNotes[bassIdx] = next;
        // Actualizar pasos activos
        for (let s = 0; s < TECHNO.PASOS; s++) {
          if (localGrid[nch][s] !== -1) localGrid[nch][s] = next;
        }
        net.enviar(JSON.stringify({ t: "note", ch: nch, ni: next }));
      }
    }
  }

  function onPointerMove(e) {
    const p = canvasPos(e);
    if (dragPad && net.rol === 2) {
      updatePad(p.x, p.y);
      return;
    }
    hoverCell = gridHit(p.x, p.y);
  }

  function onPointerUp() {
    dragPad = false;
  }

  function updatePad(px, py) {
    const nx = clamp((px - PAD_X) / PAD_SIZE, 0, 1);
    const ny = clamp(1 - (py - PAD_Y) / PAD_SIZE, 0, 1);
    const cut = TECHNO.CUT_MIN + nx * (TECHNO.CUT_MAX - TECHNO.CUT_MIN);
    const res = TECHNO.RES_MIN + ny * (TECHNO.RES_MAX - TECHNO.RES_MIN);
    localCutoff = cut;
    localRes = res;
    if (bassFilter) {
      bassFilter.frequency.value = cut;
      bassFilter.Q.value = res;
    }
    net.enviar(JSON.stringify({ t: "flt", cut: Math.round(cut), res: Math.round(res * 10) / 10 }));
  }

  function onKeyDown(e) {
    // BPM: +/- (solo host)
    if (net.rol === 1) {
      if (e.key === "+" || e.key === "=") {
        if (sim) sim.setBpm(sim.bpm + 1);
        net.enviar(JSON.stringify({ t: "bpm", bpm: sim ? sim.bpm : localBpm }));
        e.preventDefault();
      } else if (e.key === "-" || e.key === "_") {
        if (sim) sim.setBpm(sim.bpm - 1);
        net.enviar(JSON.stringify({ t: "bpm", bpm: sim ? sim.bpm : localBpm }));
        e.preventDefault();
      }
    }
    // Mute rapido 1-8
    const n = parseInt(e.key);
    if (n >= 1 && n <= 8) {
      const ch = n - 1;
      if (sim) sim.toggleMute(ch);
      else localMute[ch] = !localMute[ch];
      net.enviar(JSON.stringify({ t: "mut", ch }));
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

  // ---- trigger audio en step ----
  function triggerStep(step, grid, mute, cutoff, resonance, bassNotes) {
    // Drums
    for (let ch = 0; ch < 4; ch++) {
      if (!mute[ch] && grid[ch][step]) drumFn[ch]();
    }
    // Bass
    for (let i = 0; i < 4; i++) {
      const ch = i + 4;
      if (!mute[ch] && grid[ch][step] !== -1) {
        const noteIdx = grid[ch][step];
        const nota = TECHNO.NOTAS[noteIdx];
        if (nota) playBass(nota.hz, cutoff, resonance);
      }
    }
  }

  // ---- render ----
  function render(now, dt) {
    const g = sim ? sim.grid : localGrid;
    const step = sim ? sim.currentStep : localStep;
    const bpm = sim ? sim.bpm : localBpm;
    const mute = sim ? sim.mute : localMute;
    const cut = sim ? sim.cutoff : localCutoff;
    const res = sim ? sim.resonance : localRes;
    const bNotes = sim ? sim.bassNotes : localBassNotes;
    const bars = sim ? sim.barsPlayed : localBars;

    ctx.fillStyle = COL_BG;
    ctx.fillRect(0, 0, W, H);

    // ---- osciloscopio ----
    if (analyser && analyserData) {
      analyser.getByteTimeDomainData(analyserData);
      ctx.strokeStyle = COL_SCOPE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const sliceW = W / analyserData.length;
      for (let i = 0; i < analyserData.length; i++) {
        const v = analyserData[i] / 128.0;
        const y = (v * SCOPE_H) / 2;
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * sliceW, y);
      }
      ctx.stroke();
    }
    // Linea base del osciloscopio
    ctx.strokeStyle = "#1a2a1a";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, SCOPE_H / 2);
    ctx.lineTo(W, SCOPE_H / 2);
    ctx.stroke();

    // ---- header: BPM + info ----
    ctx.fillStyle = COL_HEADER;
    ctx.font = "bold 13px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText("BPM", 8, SCOPE_H + 18);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(bpm.toString(), 42, SCOPE_H + 18);

    ctx.fillStyle = COL_HEADER;
    ctx.fillText("STEP", 90, SCOPE_H + 18);
    ctx.fillStyle = "#ffffff";
    ctx.fillText((step + 1).toString().padStart(2, "0"), 130, SCOPE_H + 18);

    ctx.fillStyle = COL_HEADER;
    ctx.fillText("BAR", 170, SCOPE_H + 18);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(bars.toString(), 200, SCOPE_H + 18);

    const rolTxt = net.rol === 1 ? "HOST  🥁 DRUMS" : "GUEST  🎹 BASS";
    ctx.fillStyle = net.rol === 1 ? COL_DRUM_ON : COL_BASS_ON;
    ctx.textAlign = "right";
    ctx.fillText(rolTxt, W - 8, SCOPE_H + 18);
    ctx.textAlign = "left";

    // ---- grid de drums ----
    for (let ch = 0; ch < DRUM_ROWS; ch++) {
      const y = GRID_TOP + ch * (CELL_H + CELL_GAP);
      const isMuted = mute[ch];
      const isOwn = net.rol === 1;

      // Label
      ctx.fillStyle = isMuted ? COL_MUTED : (isOwn ? COL_LABEL_OWN : COL_LABEL);
      ctx.font = "bold 11px ui-monospace, monospace";
      ctx.fillText(TECHNO.NOMBRES_CANAL[ch], 6, y + 18);

      // Mute indicator
      if (isMuted) {
        ctx.fillStyle = "#ff3333";
        ctx.font = "bold 9px ui-monospace, monospace";
        ctx.fillText("M", LABEL_W - 8, y + 10);
      }

      for (let s = 0; s < TECHNO.PASOS; s++) {
        const x = GRID_X + s * (CELL_W + CELL_GAP);
        const on = g[ch] && g[ch][s];
        const isPlayhead = s === step;

        // Fondo celda
        if (isMuted) {
          ctx.fillStyle = COL_MUTED;
        } else if (on) {
          ctx.fillStyle = isPlayhead ? "#ffbb44" : COL_DRUM_ON;
        } else {
          ctx.fillStyle = isPlayhead ? "#2a2a1a" : COL_GRID_OFF;
        }
        ctx.fillRect(x, y, CELL_W, CELL_H);

        // Borde
        ctx.strokeStyle = isPlayhead ? COL_PLAYHEAD : COL_GRID_BORDER;
        ctx.lineWidth = isPlayhead ? 1.5 : 0.5;
        ctx.strokeRect(x, y, CELL_W, CELL_H);

        // Beat markers (cada 4)
        if (s % 4 === 0) {
          ctx.fillStyle = "#444455";
          ctx.fillRect(x, y, 2, CELL_H);
        }
      }
    }

    // ---- separador ----
    ctx.strokeStyle = "#333344";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(GRID_X, SEPARATOR_Y);
    ctx.lineTo(GRID_X + TECHNO.PASOS * (CELL_W + CELL_GAP), SEPARATOR_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    // ---- grid de bass ----
    for (let i = 0; i < BASS_ROWS; i++) {
      const ch = i + 4;
      const y = BASS_TOP + i * (CELL_H + CELL_GAP);
      const isMuted = mute[ch];
      const isOwn = net.rol === 2;
      const noteIdx = bNotes[i];
      const noteName = TECHNO.NOTAS[noteIdx] ? TECHNO.NOTAS[noteIdx].nombre : "?";

      // Label con nombre de nota
      ctx.fillStyle = isMuted ? COL_MUTED : (isOwn ? COL_LABEL_OWN : COL_LABEL);
      ctx.font = "bold 11px ui-monospace, monospace";
      ctx.fillText(noteName, 6, y + 18);

      if (isMuted) {
        ctx.fillStyle = "#ff3333";
        ctx.font = "bold 9px ui-monospace, monospace";
        ctx.fillText("M", LABEL_W - 8, y + 10);
      }

      for (let s = 0; s < TECHNO.PASOS; s++) {
        const x = GRID_X + s * (CELL_W + CELL_GAP);
        const val = g[ch] ? g[ch][s] : -1;
        const on = val !== -1;
        const isPlayhead = s === step;

        if (isMuted) {
          ctx.fillStyle = COL_MUTED;
        } else if (on) {
          ctx.fillStyle = isPlayhead ? "#44eeff" : COL_BASS_ON;
        } else {
          ctx.fillStyle = isPlayhead ? "#1a2a2a" : COL_GRID_OFF;
        }
        ctx.fillRect(x, y, CELL_W, CELL_H);

        ctx.strokeStyle = isPlayhead ? COL_PLAYHEAD : COL_GRID_BORDER;
        ctx.lineWidth = isPlayhead ? 1.5 : 0.5;
        ctx.strokeRect(x, y, CELL_W, CELL_H);

        // Mostrar nombre de nota en celda activa
        if (on && !isMuted) {
          const n = TECHNO.NOTAS[val];
          if (n) {
            ctx.fillStyle = "#000000";
            ctx.font = "bold 9px ui-monospace, monospace";
            ctx.textAlign = "center";
            ctx.fillText(n.nombre, x + CELL_W / 2, y + 18);
            ctx.textAlign = "left";
          }
        }

        if (s % 4 === 0) {
          ctx.fillStyle = "#444455";
          ctx.fillRect(x, y, 2, CELL_H);
        }
      }
    }

    // ---- pad XY (filtro 303) ----
    // Fondo del pad
    ctx.fillStyle = "#111118";
    ctx.fillRect(PAD_X, PAD_Y, PAD_SIZE, PAD_SIZE);
    ctx.strokeStyle = net.rol === 2 ? COL_BASS_ON : "#333344";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(PAD_X, PAD_Y, PAD_SIZE, PAD_SIZE);

    // Ejes
    ctx.strokeStyle = "#2a2a3a";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(PAD_X + PAD_SIZE / 2, PAD_Y);
    ctx.lineTo(PAD_X + PAD_SIZE / 2, PAD_Y + PAD_SIZE);
    ctx.moveTo(PAD_X, PAD_Y + PAD_SIZE / 2);
    ctx.lineTo(PAD_X + PAD_SIZE, PAD_Y + PAD_SIZE / 2);
    ctx.stroke();

    // Punto de posicion
    const padNx = (cut - TECHNO.CUT_MIN) / (TECHNO.CUT_MAX - TECHNO.CUT_MIN);
    const padNy = 1 - (res - TECHNO.RES_MIN) / (TECHNO.RES_MAX - TECHNO.RES_MIN);
    const dotX = PAD_X + padNx * PAD_SIZE;
    const dotY = PAD_Y + padNy * PAD_SIZE;
    ctx.fillStyle = COL_BASS_ON;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Labels del pad
    ctx.fillStyle = COL_HEADER;
    ctx.font = "9px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("CUTOFF", PAD_X + PAD_SIZE / 2, PAD_Y + PAD_SIZE + 12);
    ctx.save();
    ctx.translate(PAD_X - 6, PAD_Y + PAD_SIZE / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("RESO", 0, 0);
    ctx.restore();
    ctx.textAlign = "left";

    // Valores del filtro
    ctx.fillStyle = COL_BASS_ON;
    ctx.font = "bold 10px ui-monospace, monospace";
    ctx.fillText("CUT " + Math.round(cut) + " Hz", PAD_X, PAD_Y + PAD_SIZE + 24);
    ctx.fillText("RES " + res.toFixed(1), PAD_X + 80, PAD_Y + PAD_SIZE + 24);

    // ---- note selectors (guest) ----
    if (net.rol === 2) {
      const btnY = CONTROL_TOP;
      const btnH = 24;
      const startX = LABEL_W + 8;
      ctx.font = "bold 10px ui-monospace, monospace";
      for (let i = 0; i < 4; i++) {
        const by = btnY + i * (btnH + 3);
        const noteIdx = localBassNotes[i];
        const nota = TECHNO.NOTAS[noteIdx];
        ctx.fillStyle = "#1a1a24";
        ctx.fillRect(startX, by, 90, btnH);
        ctx.strokeStyle = COL_BASS_DIM;
        ctx.lineWidth = 1;
        ctx.strokeRect(startX, by, 90, btnH);
        ctx.fillStyle = COL_BASS_ON;
        ctx.fillText("CH" + (i + 5) + " ► " + (nota ? nota.nombre : "?"), startX + 6, by + 16);
      }
    }

    // ---- playhead pulse indicator (top) ----
    const pulse = Math.sin(now / 100) * 0.3 + 0.7;
    const phX = GRID_X + step * (CELL_W + CELL_GAP);
    ctx.fillStyle = "rgba(255,255,255," + (pulse * 0.15).toFixed(2) + ")";
    ctx.fillRect(phX, GRID_TOP, CELL_W, DRUM_ROWS * (CELL_H + CELL_GAP) + 12 + BASS_ROWS * (CELL_H + CELL_GAP));
  }

  // ---- modulo JUEGOS.techno ----
  JUEGOS.techno = {
    nombre: "Techno Jam",
    desc: "Groovebox P2P — Host: Drums 909 · Guest: Bass 303 Ácido",
    canvas: { w: W, h: H },

    iniciarHost() {
      initAudio();
      resumeAudio();
      sim = new TechnoSim();
      localGrid = sim.grid;
      localMute = sim.mute;
      localBassNotes = sim.bassNotes;
      localBpm = sim.bpm;
      localCutoff = sim.cutoff;
      localRes = sim.resonance;
      localStep = 0;
      localBars = 0;
      hAcc = 0;
      sendAcc = 0;
      lastStepTriggered = -1;
      hookInput();
    },

    iniciarGuest() {
      initAudio();
      resumeAudio();
      sim = null;
      localGrid = [];
      for (let ch = 0; ch < TECHNO.CANALES; ch++) {
        localGrid[ch] = new Array(TECHNO.PASOS).fill(ch < 4 ? false : -1);
      }
      // Patron kick basico
      localGrid[0][0] = true; localGrid[0][4] = true;
      localGrid[0][8] = true; localGrid[0][12] = true;
      localGrid[2][0] = true; localGrid[2][2] = true;
      localGrid[2][4] = true; localGrid[2][6] = true;
      localGrid[2][8] = true; localGrid[2][10] = true;
      localGrid[2][12] = true; localGrid[2][14] = true;
      localMute = new Array(TECHNO.CANALES).fill(false);
      localBassNotes = [0, 3, 4, 7];
      localBpm = TECHNO.BPM_DEF;
      localCutoff = TECHNO.CUT_DEF;
      localRes = TECHNO.RES_DEF;
      localStep = 0;
      localBars = 0;
      hAcc = 0;
      lastStepTriggered = -1;
      hookInput();
    },

    destruir() {
      unhookInput();
      sim = null;
      dragPad = false;
      hoverCell = null;
    },

    onData(msg) {
      if (!msg || typeof msg !== "object") return;

      if (msg.t === "e") {
        // Snapshot del host
        if (msg.grid) localGrid = msg.grid;
        if (msg.mute) localMute = msg.mute;
        if (typeof msg.bpm === "number") localBpm = msg.bpm;
        if (typeof msg.cut === "number") {
          localCutoff = msg.cut;
          if (bassFilter) bassFilter.frequency.value = msg.cut;
        }
        if (typeof msg.res === "number") {
          localRes = msg.res;
          if (bassFilter) bassFilter.Q.value = msg.res;
        }
        if (msg.notes) localBassNotes = msg.notes;
        if (typeof msg.playing === "boolean") localPlaying = msg.playing;
        if (typeof msg.bars === "number") localBars = msg.bars;

        // Sincronizar step y disparar audio
        if (typeof msg.step === "number" && msg.step !== localStep) {
          localStep = msg.step;
          if (localStep !== lastStepTriggered) {
            lastStepTriggered = localStep;
            triggerStep(localStep, localGrid, localMute, localCutoff, localRes, localBassNotes);
          }
        }
        return;
      }

      if (msg.t === "tog") {
        // Toggle paso
        if (sim) {
          sim.toggleStep(msg.ch, msg.s);
        } else {
          const ch = msg.ch;
          const s = msg.s;
          if (ch < 4) {
            localGrid[ch][s] = !localGrid[ch][s];
          } else {
            const noteIdx = localBassNotes[ch - 4];
            localGrid[ch][s] = localGrid[ch][s] === -1 ? noteIdx : -1;
          }
        }
        return;
      }

      if (msg.t === "mut") {
        if (sim) sim.toggleMute(msg.ch);
        else localMute[msg.ch] = !localMute[msg.ch];
        return;
      }

      if (msg.t === "bpm") {
        if (sim) sim.setBpm(msg.bpm);
        localBpm = msg.bpm;
        return;
      }

      if (msg.t === "flt") {
        if (sim) sim.setFilter(msg.cut, msg.res);
        localCutoff = msg.cut;
        localRes = msg.res;
        if (bassFilter) {
          bassFilter.frequency.value = msg.cut;
          bassFilter.Q.value = msg.res;
        }
        return;
      }

      if (msg.t === "note") {
        if (sim) sim.setNote(msg.ch, msg.ni);
        else {
          const bassIdx = msg.ch - 4;
          if (bassIdx >= 0 && bassIdx < 4) {
            localBassNotes[bassIdx] = msg.ni;
            for (let s = 0; s < TECHNO.PASOS; s++) {
              if (localGrid[msg.ch][s] !== -1) localGrid[msg.ch][s] = msg.ni;
            }
          }
        }
        return;
      }

      if (msg.t === "rev") {
        if (sim) sim.pedirRevancha(2);
        return;
      }
    },

    frame(now, dt, pausado) {
      if (pausado) {
        render(now, dt);
        return;
      }

      if (sim) {
        // Host: avanzar simulacion
        sim.step(dt);
        if (sim.stepTriggered) {
          triggerStep(sim.currentStep, sim.grid, sim.mute, sim.cutoff, sim.resonance, sim.bassNotes);
          // Enviar snapshot al guest en cada step
          net.enviar(JSON.stringify(sim.snapshot()));
        }
        localStep = sim.currentStep;
        localBpm = sim.bpm;
        localBars = sim.barsPlayed;
        localCutoff = sim.cutoff;
        localRes = sim.resonance;
      } else {
        // Guest: reloj local para interpolacion visual
        hAcc += dt;
        const dur = 60 / localBpm / 4;
        if (hAcc >= dur) {
          hAcc -= dur;
          if (hAcc > dur) hAcc = 0;
          // No avanzamos el step localmente, esperamos el snapshot del host
        }
      }

      render(now, dt);
    },

    overlay() {
      // En modo jam no hay overlay de victoria/derrota
      return null;
    },

    revancha() {
      if (net.rol === 1 && sim) sim.pedirRevancha(1);
      else net.enviar(JSON.stringify({ t: "rev" }));
    },
  };
})();
