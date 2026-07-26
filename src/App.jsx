import { useState, useCallback } from "react";
import ChordTab      from './components/tabs/ChordTab.jsx';
import ProgresionTab from './components/tabs/ProgresionTab.jsx';
import BibliotecaTab from './components/tabs/BibliotecaTab.jsx';
import QuintasTab    from './components/tabs/QuintasTab.jsx';
import ModosTab      from './components/tabs/ModosTab.jsx';
import ColoresTab    from './components/tabs/ColoresTab.jsx';
import BandoneonTab  from './components/bandoneon/BandoneonTab.jsx';

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id:"chord",      label:"Acorde",     icon:"🎼" },
  { id:"prog",       label:"Progresión", icon:"🔗" },
  { id:"biblioteca", label:"Biblioteca", icon:"📚" },
  { id:"bandoneon",  label:"Bandoneón",  icon:"🎵" },
  { id:"circle",     label:"Quintas",    icon:"⭕" },
  { id:"modos",      label:"Modos",      icon:"📐" },
  { id:"colors",     label:"Colores",    icon:"🎨" },
];

// ─── APP PRINCIPAL ─────────────────────────────────────────────────────────────
export default function HarmoniaApp() {
  const [tab,     setTab]     = useState("chord");
  const [navOpen, setNavOpen] = useState(false);

  // Callback para que Biblioteca pueda enviar una progresión al tab de Progresión
  const [progFromBib, setProgFromBib] = useState(null);
  const handleAnalizarProg = useCallback((prog) => {
    setProgFromBib(prog);
    setTab("prog");
  }, []);

  const activeTab = TABS.find(t => t.id === tab);

  return (
    <div className="min-h-screen text-gray-100 flex flex-col" style={{
      background: "linear-gradient(135deg,#0a0a1a 0%,#0d0d22 50%,#0a1020 100%)",
      fontFamily: "'Crimson Text',Georgia,serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Libre+Baskerville:wght@400;700&display=swap');
        .glow-input:focus { outline:none; box-shadow:0 0 0 2px #4466cc55; }
        .stagger>* { animation:fadeUp 0.3s ease both; }
        .stagger>*:nth-child(1){animation-delay:.03s}
        .stagger>*:nth-child(2){animation-delay:.08s}
        .stagger>*:nth-child(3){animation-delay:.13s}
        .stagger>*:nth-child(4){animation-delay:.18s}
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:#111}
        ::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
      `}</style>

      {/* ── HEADER ── */}
      <div className="border-b border-gray-800 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => setNavOpen(o => !o)}
          className="flex flex-col gap-1.5 p-2 rounded-lg border border-gray-700 hover:border-gray-500 flex-shrink-0"
          style={{ background:"#111" }}>
          <span className="block w-5 h-0.5 bg-gray-400" />
          <span className="block w-5 h-0.5 bg-gray-400" />
          <span className="block w-5 h-0.5 bg-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily:"'Libre Baskerville',serif", letterSpacing:"0.06em" }}>
            <span style={{ color:"#4488ff" }}>Har</span>
            <span style={{ color:"#cc4444" }}>mo</span>
            <span style={{ color:"#44bb44" }}>nía</span>
          </h1>
          <p className="text-xs text-gray-500 italic">Bandoneón · Tango · Jazz · Colores tonales</p>
        </div>
        <div className="ml-auto text-sm text-gray-400">
          {activeTab?.icon} {activeTab?.label}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── SIDEBAR ── */}
        <div
          className={`flex-shrink-0 border-r border-gray-800 transition-all duration-200 ${navOpen ? "w-48" : "w-0 overflow-hidden md:w-48"}`}
          style={{ background:"#080810" }}>
          <nav className="py-3 px-2 space-y-1 w-48">
            {TABS.map(t => (
              <button key={t.id}
                onClick={() => { setTab(t.id); setNavOpen(false); }}
                className="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 text-sm transition-all"
                style={{
                  background:   tab === t.id ? "#1e2a4a" : "transparent",
                  borderLeft:   tab === t.id ? "3px solid #4466cc" : "3px solid transparent",
                  color:        tab === t.id ? "#88aaff" : "#666",
                  fontWeight:   tab === t.id ? "600" : "400",
                }}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* ── CONTENIDO ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-3 py-4 md:px-6 md:py-6">
            {tab === "chord"      && <ChordTab />}
            {tab === "prog"       && <ProgresionTab initialProg={progFromBib} />}
            {tab === "biblioteca" && <BibliotecaTab onAnalizar={handleAnalizarProg} />}
            {tab === "bandoneon"  && <BandoneonTab />}
            {tab === "circle"     && <QuintasTab />}
            {tab === "modos"      && <ModosTab />}
            {tab === "colors"     && <ColoresTab />}
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="border-t border-gray-800 px-4 py-2 text-center flex-shrink-0">
        <p className="text-xs text-gray-700 italic">
          Harmonía · Armonía para bandoneón · Tango · Jazz · Sistema de color tonal
        </p>
      </div>
    </div>
  );
}
