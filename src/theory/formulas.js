import { spellInterval } from './notes.js';

export const FORMULAS = {
  "maj":    {intervals:[0,4,7],          label:"Mayor",       symbol:""    },
  "min":    {intervals:[0,3,7],          label:"Menor",       symbol:"m"   },
  "7":      {intervals:[0,4,7,10],       label:"Dom. 7ª",     symbol:"7"   },
  "maj7":   {intervals:[0,4,7,11],       label:"Mayor 7ª",    symbol:"△7"  },
  "min7":   {intervals:[0,3,7,10],       label:"Menor 7ª",    symbol:"m7"  },
  "minMaj7":{intervals:[0,3,7,11],       label:"Menor △7",    symbol:"m△7" },
  "dim":    {intervals:[0,3,6],          label:"Disminuido",  symbol:"°"   },
  "dim7":   {intervals:[0,3,6,9],        label:"Dim. 7ª",     symbol:"°7"  },
  "m7b5":   {intervals:[0,3,6,10],       label:"Semidism.",   symbol:"ø7"  },
  "aug":    {intervals:[0,4,8],          label:"Aumentado",   symbol:"+"   },
  "sus2":   {intervals:[0,2,7],          label:"Sus2",        symbol:"sus2"},
  "sus4":   {intervals:[0,5,7],          label:"Sus4",        symbol:"sus4"},
  "9":      {intervals:[0,4,7,10,2],     label:"Dom. 9ª",     symbol:"9"   },
  "maj9":   {intervals:[0,4,7,11,2],     label:"Mayor 9ª",    symbol:"△9"  },
  "min9":   {intervals:[0,3,7,10,2],     label:"Menor 9ª",    symbol:"m9"  },
  "13":     {intervals:[0,4,7,10,2,9],   label:"Dom. 13ª",    symbol:"13"  },
  "7b9":    {intervals:[0,4,7,10,1],     label:"Dom. b9",     symbol:"7b9" },
  "7#9":    {intervals:[0,4,7,10,3],     label:"Dom. #9",     symbol:"7#9" },
  "7alt":   {intervals:[0,4,7,10,1,3,8], label:"Alt.",        symbol:"7alt"},
};

export const MODES = {
  "Jónico":       [0,2,4,5,7,9,11],
  "Dórico":       [0,2,3,5,7,9,10],
  "Frigio":       [0,1,3,5,7,8,10],
  "Lidio":        [0,2,4,6,7,9,11],
  "Mixolidio":    [0,2,4,5,7,9,10],
  "Eólico":       [0,2,3,5,7,8,10],
  "Locrio":       [0,1,3,5,6,8,10],
  "Menor Mel.":   [0,2,3,5,7,9,11],
  "Lidio b7":     [0,2,4,6,7,9,10],
  "Locrio #2":    [0,2,3,5,6,8,10],
  "Alterada":     [0,1,3,4,6,8,10],
  "Frigio Dom.":  [0,1,4,5,7,8,10],
  "Disminuida":   [0,2,3,5,6,8,9,11],
  "Dis. Dom.":    [0,1,3,4,6,7,9,10],
  "Blues":        [0,3,5,6,7,10],
  "Pentatónica M.":[0,2,4,7,9],
  "Pentatónica m.":[0,3,5,7,10],
};

export const T_SEMI = {
  "9":2,"b9":1,"#9":3,"11":5,"#11":6,
  "13":9,"b13":8,"6":9,"b6":8,"b7":10,"7":11,
};

export const tNote = (root, t) => {
  const s = T_SEMI[t];
  return s !== undefined ? spellInterval(root, s) : null;
};

export const MSI = [0,2,4,5,7,9,11];
export const DN  = ["I","II","III","IV","V","VI","VII"];
export const DQ  = ["△7","m7","m7","△7","7","m7","ø7"];
export const DL  = ["Tónica","Supertónica","Mediante","Subdominante","Dominante","Relativa m.","Sensible"];

export const MODE_BY_DEGREE = [
  {name:"Jónico",   ivs:MODES["Jónico"],   q:"maj7", tensions:["9","13"],       avoid:["11"],     degree:"I"  },
  {name:"Dórico",   ivs:MODES["Dórico"],   q:"min7", tensions:["9","11"],       avoid:["b9"],     degree:"II" },
  {name:"Frigio",   ivs:MODES["Frigio"],   q:"min7", tensions:["11"],           avoid:["9","13"], degree:"III"},
  {name:"Lidio",    ivs:MODES["Lidio"],    q:"maj7", tensions:["9","#11","13"], avoid:[],         degree:"IV" },
  {name:"Mixolidio",ivs:MODES["Mixolidio"],q:"7",   tensions:["9","13"],       avoid:["11"],     degree:"V"  },
  {name:"Eólico",   ivs:MODES["Eólico"],   q:"min7", tensions:["9","11"],       avoid:[],         degree:"VI" },
  {name:"Locrio",   ivs:MODES["Locrio"],   q:"m7b5", tensions:["11","b13"],     avoid:["b9"],     degree:"VII"},
];

export const DQ_POR_MODO = {
  "Jónico":    ["maj7","min7","min7","maj7","7",   "min7","m7b5"],
  "Dórico":    ["min7","min7","maj7","7",   "min7","m7b5","maj7"],
  "Frigio":    ["min7","maj7","7",   "min7","m7b5","maj7","min7"],
  "Lidio":     ["maj7","7",   "min7","m7b5","maj7","min7","min7"],
  "Mixolidio": ["7",   "min7","m7b5","maj7","min7","min7","maj7"],
  "Eólico":    ["min7","m7b5","maj7","min7","min7","maj7","7"   ],
  "Locrio":    ["m7b5","maj7","min7","min7","maj7","7",   "min7"],
};

export const DQ_SIMBOLO = {
  "maj7":"△7","min7":"m7","7":"7","m7b5":"ø7",
  "maj":"","min":"m","dim7":"°7","dim":"°",
};
