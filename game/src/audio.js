// Vice Harbor — tiny synthesized sound: no audio files, everything is
// generated with WebAudio (engine hum, siren, pickup blip, gunshot).
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let lastBlip = -1;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
      return true;
    } catch { return false; }
  }

  function blip(freq, dur = 0.12, vol = 0.15) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    setMuted(m) {
      muted = m;
      if (engineGain) engineGain.gain.value = 0;
      if (sirenGain) sirenGain.gain.value = 0;
    },
    update(state, isMuted) {
      if (!ctx || isMuted) return;
      const speed = Math.abs(state.player.speed ?? 0);
      engineGain.gain.value = state.player.car ? 0.03 + speed * 0.0012 : 0;
      engineOsc.frequency.value = 45 + speed * 3.2;
      const stars = Math.floor(state.heat / 20);
      if (stars >= 1) {
        sirenGain.gain.value = 0.035;
        sirenOsc.frequency.value = 650 + Math.sin(state.playtime * 6) * 180;
      } else {
        sirenGain.gain.value = 0;
      }
      if (state.stats.tokens !== lastBlip) {
        if (lastBlip >= 0) blip(880, 0.15, 0.18);
        lastBlip = state.stats.tokens;
      }
    },
    shot() { blip(160, 0.08, 0.22); },
  };
}
