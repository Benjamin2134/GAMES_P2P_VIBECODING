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

  // 7. Agua / Splash (Salpicadura de proyectil)
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
    playSplash
  };
})();
