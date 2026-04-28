import { useState } from 'react';
import ECMPSim from './sim/ECMPSim';
import FlowletSim from './sim/FlowletSim';
import DLAFSim from './sim/DLAFSim';

const TABS = [
  {
    id: 'ecmp',
    label: 'ECMP',
    slides: '7 slides',
    color: 'text-orange-400',
    border: 'border-orange-400/40',
    bg: 'bg-orange-400/5',
    desc: 'Equal-cost path hashing — simple but blind to flow size',
  },
  {
    id: 'flowlet',
    label: 'Flowlet',
    slides: '11 slides',
    color: 'text-yellow-400',
    border: 'border-yellow-400/40',
    bg: 'bg-yellow-400/5',
    desc: 'Burst-aware splitting — better balance but needs tuning',
  },
  {
    id: 'dlaf',
    label: 'DLAF',
    slides: '19 slides',
    color: 'text-blue-400',
    border: 'border-blue-400/40',
    bg: 'bg-blue-400/5',
    desc: 'Load-aware adaptive flowlets — near-perfect balance',
  },
];

export default function Simulator() {
  const [active, setActive] = useState('ecmp');
  const tab = TABS.find(t => t.id === active)!;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Simulation Walkthrough</h1>
        <p className="text-muted-foreground mt-1">
          Step through each algorithm slide-by-slide to understand exactly how it works.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`rounded-xl border p-4 text-left transition-all ${
              active === t.id
                ? `${t.border} ${t.bg}`
                : 'border-border hover:border-border/80 hover:bg-muted/30'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`font-bold ${active === t.id ? t.color : ''}`}>{t.label}</span>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${active === t.id ? `${t.bg} ${t.color} border ${t.border}` : 'bg-muted text-muted-foreground'}`}>
                {t.slides}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{t.desc}</p>
          </button>
        ))}
      </div>

      <div className={`flex items-center gap-3 rounded-lg border ${tab.border} ${tab.bg} px-4 py-2`}>
        <span className={`font-semibold ${tab.color}`}>{tab.label}</span>
        <span className="text-muted-foreground text-sm">— {tab.desc}</span>
      </div>

      {active === 'ecmp' && <ECMPSim />}
      {active === 'flowlet' && <FlowletSim />}
      {active === 'dlaf' && <DLAFSim />}
    </div>
  );
}
