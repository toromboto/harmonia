import { spellInterval } from './notes.js';
import { FORMULAS } from './formulas.js';

export function parseChord(input) {
  try {
    const s  = input.trim();
    const rm = s.match(/^([A-G][#b]?)/);
    if(!rm) return null;
    const root = rm[1];
    const rest = s.slice(root.length).toLowerCase().replace(/\s/g,"");
    let q = "maj";

    if(/^(mmaj7|m\(maj7\)|-maj7|-\(maj7\)|mm7)/.test(rest)) q = "minMaj7";
    else if(rest.includes("m7b5") || rest.includes("ø"))      q = "m7b5";
    else if(rest.includes("dim7") || rest.includes("°7"))     q = "dim7";
    else if(rest.includes("dim")  || rest.includes("°"))      q = "dim";
    else if(rest.includes("aug")  || rest.startsWith("+"))    q = "aug";
    else if(rest.includes("sus2"))                            q = "sus2";
    else if(rest.includes("sus4") || rest.includes("sus"))    q = "sus4";
    else if(rest.includes("7alt") || rest.includes("alt"))    q = "7alt";
    else if(rest.includes("7b9"))                             q = "7b9";
    else if(rest.includes("7#9"))                             q = "7#9";
    else if(rest.includes("maj9") || rest.includes("△9"))     q = "maj9";
    else if(rest.includes("maj7") || rest.includes("△7") || rest.includes("∆7")) q = "maj7";
    else if(rest.includes("maj"))                             q = "maj7";
    else if(rest.includes("m9"))                              q = "min9";
    else if(rest.includes("m7"))                              q = "min7";
    else if(/^-7/.test(rest))                                 q = "min7";
    else if(rest.includes("13"))                              q = "13";
    else if(rest.includes("9"))                               q = "9";
    else if(rest.includes("7"))                               q = "7";
    else if(/^-/.test(rest))                                  q = "min";
    else if(rest.includes("m"))                               q = "min";

    const formula = FORMULAS[q] || FORMULAS["maj"];
    const notes   = formula.intervals.map(i => spellInterval(root, i % 12));
    return { root, quality: q, notes, formula, raw: s };
  } catch(e) { return null; }
}
