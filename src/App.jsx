import { useState, useEffect, useCallback, useMemo } from "react";

// ─── SISTEMA DE COLORES ───────────────────────────────────────────────────────
const NOTE_COLORS = {
  C:    { rgb: [30,  80,  220], name: "Azul",          hex: "#1E50DC" },
  D:    { rgb: [40,  160, 60],  name: "Verde",         hex: "#28A03C" },
  E:    { rgb: [130, 80,  30],  name: "Marrón",        hex: "#82501E" },
  F:    { rgb: [200, 185, 140], name: "Beige",         hex: "#C8B98C" },
  G:    { rgb: [230, 200, 20],  name: "Amarillo",      hex: "#E6C814" },
  A:    { rgb: [210, 40,  40],  name: "Rojo",          hex: "#D22828" },
  B:    { rgb: [120, 40,  180], name: "Violeta",       hex: "#7828B4" },
  "C#": { rgb: [35,  120, 180], name: "Turquesa",      hex: "#2378B4" },
  "Db": { rgb: [35,  120, 180], name: "Turquesa",      hex: "#2378B4" },
  "D#": { rgb: [40,  180, 100], name: "Verde claro",   hex: "#28B464" },
  "Eb": { rgb: [40,  180, 100], name: "Verde claro",   hex: "#28B464" },
  "F#": { rgb: [215, 192, 80],  name: "Amar. beige",   hex: "#D7C050" },
  "Gb": { rgb: [215, 192, 80],  name: "Amar. beige",   hex: "#D7C050" },
  "G#": { rgb: [220, 120, 30],  name: "Naranja",       hex: "#DC781E" },
  "Ab": { rgb: [220, 120, 30],  name: "Naranja",       hex: "#DC781E" },
  "A#": { rgb: [165, 40,  110], name: "Bordo",         hex: "#A5286E" },
  "Bb": { rgb: [165, 40,  110], name: "Bordo",         hex: "#A5286E" },
};

const getNoteColor = (note) => {
  const clean = note.replace(/[0-9]/g, "").trim();
  return NOTE_COLORS[clean] || { hex: "#888", name: "?", rgb: [128,128,128] };
};

const CHROMATIC = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const ENHARMONIC = { "C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb" };
const enharmonic = (n) => ENHARMONIC[n] || n;

const noteToIndex = (note) => {
  const idx = CHROMATIC.indexOf(note);
  if (idx !== -1) return idx;
  const entry = Object.entries(ENHARMONIC).find(([, v]) => v === note);
  return entry ? CHROMATIC.indexOf(entry[0]) : -1;
};

const intervalFromRoot = (root, semitones) => {
  const idx = noteToIndex(root);
  if (idx === -1) return root;
  return CHROMATIC[(idx + semitones + 12) % 12];
};

// ─── AUDIO (Web Audio API) ────────────────────────────────────────────────────
let audioCtx = null;
const getAudioCtx = () => {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  return audioCtx;
};

const NOTE_MIDI = { C:48,"C#":49,"Db":49,D:50,"D#":51,"Eb":51,E:52,F:53,"F#":54,"Gb":54,G:55,"G#":56,"Ab":56,A:57,"A#":58,"Bb":58,B:59 };

const playNote = (note, duration = 0.6) => {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const midi = NOTE_MIDI[note] ?? 60;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch(e) {}
};

const playChord = (notes) => {
  notes.forEach((n, i) => setTimeout(() => playNote(n, 1.4), i * 25));
};

// ─── FÓRMULAS DE ACORDES ──────────────────────────────────────────────────────
const CHORD_FORMULAS = {
  "maj":  { intervals:[0,4,7],             label:"Mayor",      symbol:"△"    },
  "min":  { intervals:[0,3,7],             label:"Menor",      symbol:"m"    },
  "7":    { intervals:[0,4,7,10],          label:"Dom. 7ª",    symbol:"7"    },
  "maj7": { intervals:[0,4,7,11],          label:"Mayor 7ª",   symbol:"△7"   },
  "min7": { intervals:[0,3,7,10],          label:"Menor 7ª",   symbol:"m7"   },
  "dim":  { intervals:[0,3,6],             label:"Disminuido", symbol:"°"    },
  "dim7": { intervals:[0,3,6,9],           label:"Dim. 7ª",    symbol:"°7"   },
  "m7b5": { intervals:[0,3,6,10],          label:"Semidism.",  symbol:"ø7"   },
  "aug":  { intervals:[0,4,8],             label:"Aumentado",  symbol:"+"    },
  "sus2": { intervals:[0,2,7],             label:"Sus2",       symbol:"sus2" },
  "sus4": { intervals:[0,5,7],             label:"Sus4",       symbol:"sus4" },
  "9":    { intervals:[0,4,7,10,14],       label:"Dom. 9ª",    symbol:"9"    },
  "maj9": { intervals:[0,4,7,11,14],       label:"Mayor 9ª",   symbol:"△9"   },
  "min9": { intervals:[0,3,7,10,14],       label:"Menor 9ª",   symbol:"m9"   },
  "13":   { intervals:[0,4,7,10,14,21],    label:"Dom. 13ª",   symbol:"13"   },
  "7b9":  { intervals:[0,4,7,10,13],       label:"Dom. b9",    symbol:"7b9"  },
  "7#9":  { intervals:[0,4,7,10,15],       label:"Dom. #9",    symbol:"7#9"  },
  "7alt": { intervals:[0,4,7,10,13,15,20], label:"Alt.",       symbol:"7alt" },