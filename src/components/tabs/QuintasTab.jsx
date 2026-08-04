import { useState } from "react";
import { COF } from '../../theory/harmony.js';
import Circulo from '../harmony/Circulo.jsx';

export default function QuintasTab() {
  const [selectedKey, setSelectedKey] = useState(null);
  return (
    <div className="stagger">
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-1" style={{ fontFamily:"'Libre Baskerville',serif" }}>⭕ Círculo de Quintas</h2>
        <p className="text-xs text-gray-500">Tocá cualquier tonalidad para ver escala, modos y tensiones por grado</p>
      </div>
      <Circulo
        highlighted={COF.map(c => c.note)}
        onSelect={setSelectedKey}
        selectedKey={selectedKey}
      />
    </div>
  );
}
