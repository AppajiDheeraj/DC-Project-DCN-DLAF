import { useState } from 'react';
import { CodeBlock, PLCBar, useLiveSim, SLIDES_A } from './DLAFParts';

const SLIDES_B = [
  {
    title: 'How Flowlets Emerge Naturally',
    subtitle: 'No static timeout needed — flowlets arise from two mechanisms',
    content: () => (
      <div className="space-y-3">
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
          <div className="text-sm font-semibold text-blue-400 mb-1">Mechanism 1: Hash Table Eviction</div>
          <div className="text-xs text-muted-foreground">When another flow evicts this flow's bucket, the next packet from this flow is treated as a new flowlet and re-assigned to the least-loaded path.</div>
        </div>
        <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
          <div className="text-sm font-semibold text-purple-400 mb-1">Mechanism 2: Timeout Fallback</div>
          <div className="text-xs text-muted-foreground">If a flow occupies a bucket for too long without eviction (low traffic), the default 10ms timeout triggers a re-assignment. Prevents ECMP-like behavior.</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/10 p-3 text-xs text-muted-foreground italic">
          "Every time a new flow is written to a hash table or the ECMP index is updated for an existing flow, a new flowlet is generated." — Paper §II-B
        </div>
      </div>
    ),
  },
  {
    title: 'Multi-Hash: Collision Reduction',
    subtitle: 'k independent tables make it exponentially harder for two flows to always collide',
    content: () => (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { k: 'k=1', prob: '1/n', color: 'border-red-500/30 bg-red-500/5 text-red-400' },
            { k: 'k=2', prob: '1/n²', color: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400' },
            { k: 'k=4', prob: '1/n⁴', color: 'border-green-500/30 bg-green-500/5 text-green-400' },
          ].map(({ k, prob, color }) => (
            <div key={k} className={`rounded-lg border p-3 ${color}`}>
              <div className="font-bold text-lg">{k}</div>
              <div className="text-xs text-muted-foreground mt-1">collision prob</div>
              <div className="font-mono text-sm mt-1 font-bold">{prob}</div>
            </div>
          ))}
        </div>
        <CodeBlock lines={[
          '// Paper: k=4, n=1024',
          'P(always collide) ≈ (1/1024)^4',
          '                  ≈ 10^-12  [ok]',
          '// "Two distinct flows colliding in one',
          '//  table are unlikely to collide again',
          '//  in another." — Paper §II-B',
        ]} />
      </div>
    ),
  },
  {
    title: 'PLC: Load-Aware Assignment',
    subtitle: 'Port Load Counters track real-time load per path',
    content: () => (
      <div className="space-y-4">
        <PLCBar counts={[42, 15, 60, 28]} highlight={1} />
        <CodeBlock lines={[
          '// PLC counts packets forwarded per port',
          '// Reset all counters on any overflow',
          '// Weighted variant: compare C[i]/w[i]',
          '//   (supports asymmetric links)',
          'j = argmin(C)  // always least loaded',
          '// No global info needed — local only [ok]',
        ]} />
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-400 italic">
          "DLAF achieves perfect load balancing" — Paper §III
        </div>
      </div>
    ),
  },
  {
    title: 'Algorithm 1 — Full Pseudocode',
    subtitle: 'Exact logic from the paper',
    content: () => (
      <div className="space-y-3">
        <div className="rounded-lg bg-black/40 border border-border p-4 font-mono text-xs space-y-0.5 leading-relaxed">
          {[
            ['text-muted-foreground', 'Input: 5-tuple flow ID f'],
            ['text-muted-foreground', 'Output: ECMP port index p'],
            ['text-foreground', ''],
            ['text-blue-300', 'flow_sig ← Hash(f)'],
            ['text-muted-foreground', 'for each table Ti:'],
            ['text-muted-foreground', '  addr_i ← Hash_i(f) mod n'],
            ['text-foreground', ''],
            ['text-muted-foreground', 'for each table Ti:'],
            ['text-green-400', '  if Ti[addr_i].flow_sig == flow_sig:'],
            ['text-yellow-400', '    if cur_time - Ti[addr_i].ts >= T:'],
            ['text-blue-300', '      j = argmin(C); C[j]++'],
            ['text-blue-300', '      Ti[addr_i].ecmp_index = j; return j'],
            ['text-green-400', '    else:'],
            ['text-green-400', '      C[Ti[addr_i].ecmp_index]++'],
            ['text-green-400', '      Ti[addr_i].ts = cur_time; return index'],
            ['text-foreground', ''],
            ['text-yellow-300', '// Flow not found:'],
            ['text-blue-300', 'i = argmin(Ti[addr_i].ts)  // oldest'],
            ['text-blue-300', 'j = argmin(C)              // least loaded'],
            ['text-blue-300', 'C[j]++; Ti[addr_i] = {flow_sig, now, j}'],
            ['text-blue-300', 'return j'],
          ].map(([cls, line], i) => (
            <div key={i} className={cls as string}>{line || <>&nbsp;</>}</div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: 'Live Simulation',
    subtitle: 'Watch DLAF assign flows to least-loaded paths in real time',
    content: function LiveContent() {
      const { log, plc, running, setRunning, reset } = useLiveSim();
      return (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setRunning(r => !r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${running ? 'border-red-500/40 bg-red-500/10 text-red-400' : 'border-green-500/40 bg-green-500/10 text-green-400'}`}
            >
              {running ? 'Pause' : 'Run'}
            </button>
            <button onClick={reset} className="px-3 py-1.5 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted transition-colors">
              Reset
            </button>
          </div>
          <PLCBar counts={plc} />
          <div className="rounded-lg border border-border bg-muted/10 p-2 h-28 overflow-y-auto space-y-1">
            {log.map((e, i) => (
              <div key={i} className="flex gap-3 text-xs font-mono animate-[fadeSlide_0.2s_ease-out]">
                <span className="text-blue-400 w-8">{e.id}</span>
                <span className="text-muted-foreground">→ P{e.path + 1}</span>
                <span className="text-green-400/60">{e.action}</span>
              </div>
            ))}
            {log.length === 0 && <div className="text-xs text-muted-foreground text-center pt-8">Press Run to start</div>}
          </div>
        </div>
      );
    },
  },
  {
    title: 'Simulation Results — Real Trace',
    subtitle: 'Paper Table I: 162M packets, 4.5M flows, 100Gbps port',
    content: () => (
      <div className="space-y-3">
        <div className="rounded-lg border border-border overflow-hidden text-xs font-mono">
          <div className="grid grid-cols-3 bg-muted/50 px-3 py-2 text-muted-foreground font-semibold">
            <span>Scheme</span><span>Config</span><span>SDV</span>
          </div>
          {[
            { s: 'ECMP', c: '—', sdv: '729,000', cls: 'text-red-400' },
            { s: 'Flowlet', c: '100μs *', sdv: '9,400', cls: 'text-yellow-400' },
            { s: 'Flowlet', c: '100ms', sdv: '861,000', cls: 'text-red-400' },
            { s: 'DLAF', c: '4×1K', sdv: '10', cls: 'text-blue-400' },
            { s: 'DLAF', c: '8×512', sdv: '5 [ok]', cls: 'text-green-400' },
          ].map(({ s, c, sdv, cls }, i) => (
            <div key={i} className={`grid grid-cols-3 px-3 py-2 border-t border-border ${s === 'DLAF' && sdv.includes('5') ? 'bg-blue-500/5' : ''}`}>
              <span className={cls}>{s}</span>
              <span className="text-muted-foreground">{c}</span>
              <span className={`font-bold ${cls}`}>{sdv}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center">* Best Flowlet (100μs) still 1880× worse than DLAF (8×512)</p>
      </div>
    ),
  },
  {
    title: 'Flowlet Gap Analysis',
    subtitle: 'More hash tables → larger minimum gap → less reordering risk',
    content: () => (
      <div className="space-y-3">
        <div className="rounded-lg border border-border overflow-hidden text-xs font-mono">
          <div className="grid grid-cols-4 bg-muted/50 px-3 py-2 text-muted-foreground font-semibold">
            <span>Config</span><span>Flowlets</span><span>MinGap</span><span>AvgGap</span>
          </div>
          {[
            ['8×512', '64.9M', '146μs', '3.4ms'],
            ['4×1K', '65.3M', '13μs', '3.3ms'],
            ['2×2K', '66.0M', '24.2ms', '3.2ms'],
            ['1×4K', '68.0M', '0', '3.1ms'],
          ].map(([cfg, fl, min, avg], i) => (
            <div key={i} className={`grid grid-cols-4 px-3 py-2 border-t border-border ${i === 0 ? 'bg-blue-500/5 text-blue-300' : ''}`}>
              <span>{cfg}</span><span className="text-muted-foreground">{fl}</span>
              <span className={i === 0 ? 'text-green-400 font-bold' : 'text-muted-foreground'}>{min}</span>
              <span className="text-muted-foreground">{avg}</span>
            </div>
          ))}
        </div>
        <CodeBlock lines={[
          '// "more small hash tables are better',
          '//  than fewer large hash tables"',
          '//  — Paper §III',
          '// 8×512 has largest minimum gap [ok]',
        ]} />
      </div>
    ),
  },
  {
    title: 'P4 Implementation',
    subtitle: 'DLAF implemented on programmable switches — 105 lines of P4',
    content: () => (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'ECMP', lines: '54', color: 'border-orange-500/30 text-orange-400' },
            { label: 'Flowlet', lines: '75', color: 'border-yellow-500/30 text-yellow-400' },
            { label: 'DLAF', lines: '105', color: 'border-blue-500/30 text-blue-400' },
          ].map(({ label, lines, color }) => (
            <div key={label} className={`rounded-lg border p-3 ${color}`}>
              <div className="font-bold">{label}</div>
              <div className="text-2xl font-bold mt-1">{lines}</div>
              <div className="text-xs text-muted-foreground">P4 lines</div>
            </div>
          ))}
        </div>
        <CodeBlock lines={[
          '// Register sizes (paper §IV):',
          'flow_sig:   16 bits per bucket',
          'timestamp:  48 bits per bucket',
          'ecmp_index:  2 bits per bucket',
          'PLC:        4 × 16-bit counters',
          'Total:      ~33 KB (4 tables × 1024)',
        ]} />
      </div>
    ),
  },
  {
    title: 'Throughput Comparison',
    subtitle: 'iPerf results on Mininet fat-tree — DLAF wins on all metrics',
    content: () => (
      <div className="space-y-4">
        <div className="space-y-3">
          {[
            { label: 'ECMP', val: 778, color: 'bg-orange-500', sdv: '729K' },
            { label: 'Flowlet', val: 860, color: 'bg-yellow-500', sdv: '9.4K' },
            { label: 'DLAF', val: 904, color: 'bg-blue-500', sdv: '5' },
          ].map(({ label, val, color, sdv }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-sm font-semibold w-16">{label}</span>
              <div className="flex-1 h-7 bg-muted rounded overflow-hidden">
                <div
                  className={`h-full ${color} rounded transition-all duration-700 flex items-center px-2`}
                  style={{ width: `${(val / 904) * 100}%` }}
                >
                  <span className="text-white text-xs font-bold">{val} kbps</span>
                </div>
              </div>
              <span className="text-xs font-mono text-muted-foreground w-14">SDV: {sdv}</span>
            </div>
          ))}
        </div>
        <CodeBlock lines={[
          'ECMP    778 kbps  SDV=729K',
          'Flowlet 860 kbps  SDV=9.4K  (+10.5%)',
          'DLAF    904 kbps  SDV=5     (+16.2%) [ok]',
        ]} />
        <p className="text-xs text-muted-foreground text-center">Fat-tree topology, 16 servers, 4 equal-cost paths, TCP/iPerf workload.</p>
      </div>
    ),
  },
];

const ALL_SLIDES = [...SLIDES_A, ...SLIDES_B];

export default function DLAFSim() {
  const [slide, setSlide] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  const go = (next: number) => { setAnimKey(k => k + 1); setSlide(next); };
  const current = ALL_SLIDES[slide];

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex gap-1 items-center">
        {ALL_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            className={`rounded-full transition-all duration-300 ${i === slide ? 'w-6 h-2 bg-blue-400' : i < slide ? 'w-2 h-2 bg-blue-400/50' : 'w-2 h-2 bg-border'}`}
          />
        ))}
        <span className="ml-auto text-xs text-muted-foreground font-mono">{slide}/{ALL_SLIDES.length - 1}</span>
      </div>

      {/* Slide */}
      <div className="rounded-xl border border-blue-400/30 bg-blue-400/5 p-6 min-h-80 overflow-hidden">
        <div key={animKey} className="animate-[fadeSlide_0.3s_ease-out]">
          <div className="mb-4">
            <div className="text-xs text-blue-400 font-semibold uppercase tracking-widest">DLAF · Slide {slide}</div>
            <h3 className="text-xl font-bold mt-0.5">{current.title}</h3>
            <p className="text-sm text-muted-foreground">{current.subtitle}</p>
          </div>
          <current.content />
        </div>
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => go(slide - 1)} disabled={slide === 0}
          className="px-4 py-2 rounded-lg border border-border text-sm font-medium disabled:opacity-30 hover:bg-muted transition-colors">
          ← Prev
        </button>
        <div className="flex gap-1 flex-wrap justify-center max-w-xs">
          {ALL_SLIDES.map((_, i) => (
            <button key={i} onClick={() => go(i)} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === slide ? 'bg-blue-400' : 'bg-border'}`} />
          ))}
        </div>
        <button onClick={() => go(slide + 1)} disabled={slide === ALL_SLIDES.length - 1}
          className="px-4 py-2 rounded-lg border border-blue-400/40 bg-blue-400/10 text-blue-400 text-sm font-medium disabled:opacity-30 hover:bg-blue-400/20 transition-colors">
          Next →
        </button>
      </div>
    </div>
  );
}
