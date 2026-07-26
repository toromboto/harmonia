import { LAT } from '../theory/notes.js';

// ─── SINGLETON AudioContext ───────────────────────────────────────────────────
let _ctx = null;
export const getCtx = () => {
  if(!_ctx) try {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch(e) {}
  return _ctx;
};

export const MIDI = {
  C:60,"C#":61,"Db":61,D:62,"D#":63,"Eb":63,E:64,
  F:65,"F#":66,"Gb":66,G:67,"G#":68,"Ab":68,
  A:69,"A#":70,"Bb":70,B:71,
};

// ─── TIMBRE BANDONEÓN ─────────────────────────────────────────────────────────
// Parciales con microdesafinación (dos lengüetas por parcial, ±cents).
// dur=null → sostenido, retorna {stop()}. dur=número → duración fija.
export const playBandSound = (eng, oct = 4, dur = null) => {
  try {
    const ctx = getCtx();
    if(!ctx) return { stop: () => {} };
    if(ctx.state === "suspended") ctx.resume();

    const midi     = (MIDI[eng] ?? 60) + (oct - 4) * 12;
    const baseFreq = 440 * Math.pow(2, (midi - 69) / 12);

    const master = ctx.createGain();
    master.connect(ctx.destination);

    const PARCIALES = [
      {h:1, vol:0.28, detune:4},
      {h:2, vol:0.18, detune:3},
      {h:3, vol:0.12, detune:5},
      {h:4, vol:0.07, detune:3},
      {h:6, vol:0.04, detune:6},
    ];

    const oscs = [];
    PARCIALES.forEach(({h, vol, detune}) => {
      const freq = baseFreq * h;
      [-detune, +detune].forEach((d, di) => {
        const osc = ctx.createOscillator();
        const gn  = ctx.createGain();
        osc.connect(gn); gn.connect(master);
        osc.type = "sawtooth";
        osc.frequency.value = freq * Math.pow(2, d / 1200);
        gn.gain.value = vol * (di === 0 ? 0.55 : 0.45);
        osc.start();
        oscs.push({osc, gn});
      });
    });

    const t0 = ctx.currentTime;
    master.gain.setValueAtTime(0, t0);
    master.gain.linearRampToValueAtTime(0.6, t0 + 0.015);

    const stop = () => {
      try {
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(0, t + 0.06);
        oscs.forEach(({osc}) => { try { osc.stop(t + 0.07); } catch(e) {} });
      } catch(e) {}
    };

    if(dur !== null) {
      master.gain.setValueAtTime(0.6, t0 + 0.015);
      master.gain.setValueAtTime(0.6, t0 + dur - 0.06);
      master.gain.linearRampToValueAtTime(0, t0 + dur);
      oscs.forEach(({osc}) => { try { osc.stop(t0 + dur + 0.01); } catch(e) {} });
      return { stop: () => {} };
    }

    return { stop };
  } catch(e) { return { stop: () => {} }; }
};

// ─── TONO SIMPLE (análisis armónico, notas individuales) ─────────────────────
export const playTone = (note, octave = 4, dur = 0.7) => {
  try {
    const ctx = getCtx();
    if(!ctx) return;
    if(ctx.state === "suspended") ctx.resume();
    const midi = (MIDI[note] ?? 60) + (octave - 4) * 12;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch(e) {}
};

// ─── ACORDE (biblioteca, progresiones) ───────────────────────────────────────
export const playChord = (notes, oct = 4) =>
  notes.forEach((n, i) => setTimeout(() => playTone(n, oct, 1.2), i * 20));

// ─── BANDONEÓN (nota latina → sonido con timbre real) ────────────────────────
export const playBand = (noteLat, octave) => {
  const eng = LAT[noteLat] || noteLat;
  playBandSound(eng, octave, 1.0);
};
