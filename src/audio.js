// ==========================================================================
//  Sintetizador Web Audio API puro (Cero dependencias ni archivos externos).
//  Sonidos vectoriales arcade clásicos (1979 - 1983).
// ==========================================================================

const RetroAudio = (() => {
  let ctx = null;
  let silenciado = false;

  function init() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === "suspended") {
      ctx.resume();
    }
  }

  function toggleMute() {
    silenciado = !silenciado;
    return silenciado;
  }

  function isMuted() {
    return silenciado;
  }

  // 1. Disparo Láser (Frecuencia en caída rápida)
  function playLaser() {
    if (silenciado || !ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch (e) {}
  }

  // 2. Empuje / Thrust (Ruido blanco modulado)
  let thrustNode = null, thrustGain = null;
  function startThrust() {
    if (silenciado || !ctx || thrustNode) return;
    try {
      const bufferSize = ctx.sampleRate * 0.5;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      thrustNode = ctx.createBufferSource();
      thrustNode.buffer = buffer;
      thrustNode.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(220, ctx.currentTime);

      thrustGain = ctx.createGain();
      thrustGain.gain.setValueAtTime(0.08, ctx.currentTime);

      thrustNode.connect(filter);
      filter.connect(thrustGain);
      thrustGain.connect(ctx.destination);

      thrustNode.start();
    } catch (e) {}
  }

  function stopThrust() {
    if (thrustNode) {
      try {
        thrustGain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
        setTimeout(() => {
          if (thrustNode) {
            thrustNode.stop();
            thrustNode.disconnect();
            thrustNode = null;
            thrustGain = null;
          }
        }, 50);
      } catch (e) {
        thrustNode = null;
      }
    }
  }

  // 3. Explosión Vectorial (Ruido filtrado con caída exponencial)
  function playExplosion() {
    if (silenciado || !ctx) return;
    try {
      const bufferSize = ctx.sampleRate * 0.6;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(600, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.5);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
    } catch (e) {}
  }

  // 4. Rebote de Pong / Beep
  function playPongBeep(alto = false) {
    if (silenciado || !ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = "square";
      osc.frequency.setValueAtTime(alto ? 660 : 440, now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch (e) {}
  }

  // 5. Victoria / Fanfarria
  function playWin() {
    if (silenciado || !ctx) return;
    try {
      const notas = [261.63, 329.63, 392.00, 523.25]; // Do, Mi, Sol, Do
      notas.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + idx * 0.1;

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.2, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.26);
      });
    } catch (e) {}
  }

  // 6. Sonar Naval Ping
  function playSonar() {
    if (silenciado || !ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      osc.type = "sine";
      osc.frequency.setValueAtTime(1280, now);
      osc.frequency.exponentialRampToValueAtTime(1260, now + 0.35);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } catch (e) {}
  }

  // 7. Agua / Splash
  function playSplash() {
    if (silenciado || !ctx) return;
    try {
      const bufferSize = ctx.sampleRate * 0.25;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.Q.setValueAtTime(3.0, ctx.currentTime);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } catch (e) {}
  }

  // 8. Error / Acción denegada (dos tonos cortos descendentes)
  function playError() {
    if (silenciado || !ctx) return;
    try {
      const now = ctx.currentTime;
      [220, 165].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.09;
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.14, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.1);
      });
    } catch (e) {}
  }

  // 9. Power-up recogido (arpegio ascendente brillante)
  function playPowerup() {
    if (silenciado || !ctx) return;
    try {
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.045;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.2, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.17);
      });
    } catch (e) {}
  }

  // 10. Música de fondo futurista en bucle (100% sintetizada, sin muestras).
  //     Es puramente decorativa y local: cada máquina la reproduce por su
  //     cuenta, nunca viaja por red (mismo criterio que el resto del audio).
  let musicTimer = null;
  let musicStep = 0;
  let droneOsc1 = null, droneOsc2 = null, droneFilt = null, droneGain = null, droneLfo = null;

  // Patron de 16 pasos (2 compases), en semitonos relativos a la raiz (La = 55Hz).
  const MUSICA_BAJO = [0, 0, 7, 0, 3, 0, 7, 5, 0, 0, 7, 0, 3, 5, 7, 10];
  const MUSICA_RAIZ = 55;

  function _pulsoBajoMusica(freq, start) {
    const osc = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, start);
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(900, start);
    filt.Q.value = 4;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.14, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
    osc.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.18);
  }

  function _arpegioMusica(freq, start) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.05, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.32);
  }

  function _hatMusica(start) {
    const bufferSize = Math.floor(ctx.sampleRate * 0.05);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filt = ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.setValueAtTime(6000, start);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.03, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.04);
    noise.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    noise.start(start);
  }

  function _musicaTick() {
    if (silenciado || !ctx) return;
    try {
      const paso = musicStep % MUSICA_BAJO.length;
      const now = ctx.currentTime;
      const semitono = MUSICA_BAJO[paso];
      const freqBajo = MUSICA_RAIZ * Math.pow(2, semitono / 12);
      _pulsoBajoMusica(freqBajo, now);
      if (paso % 4 === 0) _arpegioMusica(freqBajo * 4, now + 0.03);
      if (paso % 2 === 1) _hatMusica(now);
    } catch (e) {}
  }

  function startMusicLoop() {
    if (!ctx || musicTimer) return;
    try {
      musicStep = 0;
      const now = ctx.currentTime;

      droneGain = ctx.createGain();
      droneGain.gain.setValueAtTime(0.0001, now);
      droneGain.gain.exponentialRampToValueAtTime(0.045, now + 1.5);

      droneFilt = ctx.createBiquadFilter();
      droneFilt.type = "lowpass";
      droneFilt.frequency.setValueAtTime(500, now);

      droneOsc1 = ctx.createOscillator();
      droneOsc1.type = "sawtooth";
      droneOsc1.frequency.value = MUSICA_RAIZ;
      droneOsc2 = ctx.createOscillator();
      droneOsc2.type = "sawtooth";
      droneOsc2.frequency.value = MUSICA_RAIZ * 1.007;

      droneOsc1.connect(droneFilt);
      droneOsc2.connect(droneFilt);
      droneFilt.connect(droneGain);
      droneGain.connect(ctx.destination);

      droneLfo = ctx.createOscillator();
      droneLfo.type = "sine";
      droneLfo.frequency.value = 0.08;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 280;
      droneLfo.connect(lfoGain);
      lfoGain.connect(droneFilt.frequency);

      droneOsc1.start(now);
      droneOsc2.start(now);
      droneLfo.start(now);

      const bpm = 128;
      const stepMs = (60000 / bpm) / 2;
      musicTimer = setInterval(() => { _musicaTick(); musicStep++; }, stepMs);
    } catch (e) {}
  }

  function stopMusicLoop() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
    if (ctx && droneGain) {
      try {
        const now = ctx.currentTime;
        droneGain.gain.cancelScheduledValues(now);
        droneGain.gain.setValueAtTime(droneGain.gain.value, now);
        droneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
        droneOsc1.stop(now + 0.45);
        droneOsc2.stop(now + 0.45);
        droneLfo.stop(now + 0.45);
      } catch (e) {}
    }
    droneOsc1 = droneOsc2 = droneFilt = droneGain = droneLfo = null;
  }

  return {
    init,
    toggleMute,
    isMuted,
    playLaser,
    startThrust,
    stopThrust,
    playExplosion,
    playPongBeep,
    playWin,
    playSonar,
    playSplash,
    playError,
    playPowerup,
    startMusicLoop,
    stopMusicLoop
  };
})();
