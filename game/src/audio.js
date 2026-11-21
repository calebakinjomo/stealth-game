// Synthesised sound: no audio files, everything is built with WebAudio oscillators.
// The context starts on the first user gesture (browsers block audio before that).

export function createAudio() {
  let ctx = null;
  let master = null;
  let hum = null;
  let enabled = true;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // A low ambient drone under everything, so the vault feels alive.
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 55;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.11;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 8;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      const humGain = ctx.createGain();
      humGain.gain.value = 0.035;
      osc.connect(humGain);
      humGain.connect(master);
      osc.start();
      lfo.start();
      hum = { osc, lfo, humGain };
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!enabled || !ensure()) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    /** Call from any user gesture so later sounds are allowed. */
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggle() {
      enabled = !enabled;
      if (hum) hum.humGain.gain.value = enabled ? 0.035 : 0;
      return enabled;
    },
    /** A soft step: quieter and lower while sneaking, louder while sprinting. */
    step(sneak, sprint) {
      if (!enabled || !ensure()) return;
      tone(sneak ? 130 : 95, 0.07, 'triangle', sneak ? 0.05 : sprint ? 0.16 : 0.09);
    },
    pickup() {
      tone(660, 0.12, 'sine', 0.22);
      tone(880, 0.16, 'sine', 0.22, 0.09);
      tone(1320, 0.22, 'sine', 0.16, 0.18);
    },
    /** The sting when a guard spots you. */
    alert() {
      tone(220, 0.5, 'sawtooth', 0.16, 0, 440);
      tone(233, 0.5, 'sawtooth', 0.12, 0.02, 466);
    },
    /** A short questioning blip when a guard grows suspicious. */
    suspicious() {
      tone(392, 0.14, 'square', 0.07, 0, 330);
    },
    caught() {
      tone(160, 0.7, 'sawtooth', 0.2, 0, 60);
      tone(110, 0.8, 'square', 0.12, 0.1, 55);
    },
    win() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => tone(f, 0.3, 'sine', 0.2, i * 0.12));
    },
    denied() {
      tone(180, 0.12, 'square', 0.1);
    },
  };
}
