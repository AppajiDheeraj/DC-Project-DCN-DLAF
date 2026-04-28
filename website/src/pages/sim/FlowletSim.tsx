import { useState } from 'react';

function CodeBlock({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-lg bg-black/30 border border-border p-4 font-mono text-sm space-y-0.5">
      {lines.map((l, i) => (
        <div key={i} className={
          l.startsWith('//') ? 'text-muted-foreground' :
          l.includes('[ok]') ? 'text-green-400' :
          l.includes('[!]') ? 'text-yellow-400' :
          l.includes('NEW FLOWLET') ? 'text-yellow-300 font-bold' :
          'text-foreground'
        }>{l || <>&nbsp;</>}</div>
      ))}
    </div>
  );
}

const SLIDES = [
  {
    title: 'Burst Nature of TCP Traffic',
    subtitle: 'Flows are not continuous — they arrive in bursts with idle gaps',
    content: () => (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/10 p-4">
          <div className="text-xs text-muted-foreground mb-3 font-mono">Flow f1 packet arrivals over time →</div>
          <div className="flex items-end gap-0.5 h-14">
            {[8,7,9,6,8,0,0,0,0,0,7,8,6,9,0,0,0,0,5,7,8,6].map((h, i) => (
              <div
                key={i}
                className={`flex-1 rounded-sm transition-all duration-300 ${h > 0 ? 'bg-yellow-400' : 'bg-transparent'}`}
                style={{ height: `${h * 11}%` }}
              />
            ))}
          </div>
          <div className="flex text-xs text-muted-foreground mt-2 font-mono justify-between">
            <span>Burst 1</span><span>← idle gap →</span><span>Burst 2</span><span>← gap →</span><span>Burst 3</span>
          </div>
        </div>
        <CodeBlock lines={['// From paper: "packet flows often exhibit', '// sporadic behavior — short bursts followed', '// by periods of inactivity"', '// Real trace: 162M pkts, 4.5M flows']} />
      </div>
    ),
  },
  {
    title: 'Flowlet Definition',
    subtitle: 'A flowlet is a burst of packets separated by a gap > threshold T',
    content: () => (
      <div className="space-y-4">
        <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 p-5">
          <div className="font-mono text-lg text-yellow-400 font-bold text-center mb-3">Flowlet</div>
          <div className="space-y-2 text-sm text-center text-muted-foreground">
            <div>= consecutive packets of the same flow</div>
            <div>where the inter-packet gap is <strong className="text-foreground">&lt; threshold T</strong></div>
            <div className="pt-1 text-yellow-400/80">When gap &gt; T → new flowlet begins</div>
          </div>
        </div>
        <CodeBlock lines={['// Each new flowlet can take a different path', '// Finer granularity than per-flow (ECMP)', '// Coarser than per-packet (RPS)', '// T must be > max path latency difference']} />
      </div>
    ),
  },
  {
    title: 'Timeline: Packets and Gaps',
    subtitle: 'Visualizing how flowlets are detected',
    content: () => (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/10 p-4 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {['pkt','pkt','pkt'].map((t, i) => (
              <div key={i} className="px-2 py-1.5 rounded bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-xs font-mono">{t}</div>
            ))}
            <div className="px-6 py-1.5 rounded bg-red-500/10 border border-dashed border-red-500/40 text-red-400 text-xs font-mono mx-2">gap = 50ms</div>
            {['pkt','pkt'].map((t, i) => (
              <div key={i} className="px-2 py-1.5 rounded bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-xs font-mono">{t}</div>
            ))}
          </div>
          <div className="flex mt-3 text-xs text-muted-foreground font-mono gap-2">
            <span className="w-28 text-center border-t border-yellow-500/30 pt-1">← Flowlet 1 →</span>
            <span className="w-20" />
            <span className="w-20 text-center border-t border-yellow-500/30 pt-1">← FL 2 →</span>
          </div>
        </div>
        <CodeBlock lines={['T = 30ms  (threshold)', 'gap = 50ms  >  T = 30ms', '→ NEW FLOWLET detected', '', '// Flowlet 1: pkts 1-3 → Path A', '// Flowlet 2: pkts 4-5 → Path B (random)']} />
      </div>
    ),
  },
  {
    title: 'Threshold Check Logic',
    subtitle: 'The gap between packets determines flowlet boundaries',
    content: () => (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
            <div className="text-xs text-green-400 font-semibold mb-2">gap ≤ T</div>
            <div className="text-sm text-muted-foreground">Same flowlet</div>
            <div className="text-sm font-mono mt-2 text-green-400">→ keep current path</div>
            <div className="text-xs text-muted-foreground mt-1">No reordering risk</div>
          </div>
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
            <div className="text-xs text-yellow-400 font-semibold mb-2">gap &gt; T</div>
            <div className="text-sm text-muted-foreground">New flowlet!</div>
            <div className="text-sm font-mono mt-2 text-yellow-400">→ random new path</div>
            <div className="text-xs text-muted-foreground mt-1">Better load balance</div>
          </div>
        </div>
        <CodeBlock lines={['if (now - last_seen[f]) > T:', '    flowlet_id[f]++', '    port[f] = random_port()', 'else:', '    port[f] = port[f]  // unchanged', 'last_seen[f] = now']} />
      </div>
    ),
  },
  {
    title: 'Flowlet Routing in Action',
    subtitle: 'Flowlet 1 → Path 2, then gap, Flowlet 2 → Path 3',
    content: () => (
      <div className="space-y-4">
        <div className="space-y-3">
          {[
            { label: 'Flowlet 1', pkts: 'pkts 1–3', path: 'Path 2', color: 'border-yellow-500/40 bg-yellow-500/5 text-yellow-400' },
            { label: 'gap > T', pkts: '50ms idle', path: 'new flowlet!', color: 'border-red-500/30 bg-red-500/5 text-red-400' },
            { label: 'Flowlet 2', pkts: 'pkts 4–5', path: 'Path 3', color: 'border-green-500/40 bg-green-500/5 text-green-400' },
          ].map(({ label, pkts, path, color }) => (
            <div key={label} className={`flex items-center justify-between rounded-lg border p-3 ${color}`}>
              <div>
                <div className="font-semibold text-sm">{label}</div>
                <div className="text-xs text-muted-foreground">{pkts}</div>
              </div>
              <div className="font-mono font-bold">{path}</div>
            </div>
          ))}
        </div>
        <CodeBlock lines={['// Same flow f1, two different paths', '// Packets within a flowlet: ordered [ok]', '// Between flowlets: different paths [ok]']} />
      </div>
    ),
  },
  {
    title: 'Load Improvement',
    subtitle: 'Flowlet spreads traffic better than ECMP',
    content: () => {
      const before = [5, 200, 10, 8];
      const after = [60, 100, 80, 50];
      const maxB = Math.max(...before);
      const maxA = Math.max(...after);
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[['Before (ECMP)', before, maxB, 'bg-orange-500'], ['After (Flowlet)', after, maxA, 'bg-yellow-500']].map(([label, loads, max, color]) => (
              <div key={label as string}>
                <div className="text-xs text-muted-foreground mb-2">{label}</div>
                <div className="space-y-1.5">
                  {(loads as number[]).map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground w-5">P{i+1}</span>
                      <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                        <div className={`h-full ${color} rounded transition-all duration-700`} style={{ width: `${(v / (max as number)) * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground w-6">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <CodeBlock lines={['// Best Flowlet result: T=100μs', 'SDV(Flowlet, 100μs) = 9,400', 'SDV(ECMP)           = 729,000', '// Still 1880× worse than DLAF (SDV=5)']} />
        </div>
      );
    },
  },
  {
    title: 'Critical: The Timeout Tradeoff',
    subtitle: 'T is hard to configure — paper shows it is the key weakness',
    content: () => (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <div className="text-xs text-red-400 font-semibold mb-2">T too small (e.g. 50μs)</div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Many flowlets created</li>
              <li>• Gap &lt; path latency diff</li>
              <li>• Out-of-order packets</li>
              <li>• TCP retransmits</li>
            </ul>
          </div>
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
            <div className="text-xs text-orange-400 font-semibold mb-2">T too large (e.g. 100ms)</div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• No flowlets detected</li>
              <li>• Degrades to ECMP</li>
              <li>• SDV = 861K (worse!)</li>
              <li>• No benefit at all</li>
            </ul>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs space-y-1">
          <div className="font-semibold text-foreground">Paper Table I — Real trace SDV by timeout:</div>
          <div className="font-mono text-muted-foreground grid grid-cols-4 gap-1 mt-1">
            {[['50μs','14.4K'],['100μs','9.4K'],['1ms','13.9K'],['100ms','861K']].map(([t,s]) => (
              <div key={t} className={`rounded px-2 py-1 text-center ${t==='100μs' ? 'bg-green-500/10 text-green-400' : ''}`}>
                <div>{t}</div><div className="font-bold">{s}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/10 p-3 text-xs text-muted-foreground italic">
          "The timeout threshold used to detect flowlets is a critical parameter but is hard to be determined." — Paper §I
        </div>
      </div>
    ),
  },
  {
    title: 'Hash Collision Problem',
    subtitle: 'Flowlet uses a single hash table — collisions merge flows',
    content: () => (
      <div className="space-y-4">
        <div className="rounded-lg border border-border overflow-hidden text-xs font-mono">
          <div className="grid grid-cols-3 bg-muted/50 px-3 py-2 text-muted-foreground font-semibold">
            <span>bucket</span><span>flow</span><span>port</span>
          </div>
          {[['42','f1 (elephant)','2'],['42','f7 (mouse) ← collision!','2'],['17','f3','0']].map(([b,f,p], i) => (
            <div key={i} className={`grid grid-cols-3 px-3 py-2 border-t border-border ${i===1 ? 'bg-red-500/10 text-red-300' : ''}`}>
              <span>{b}</span><span>{f}</span><span>{p}</span>
            </div>
          ))}
        </div>
        <CodeBlock lines={['// f1 and f7 hash to same bucket (42)', '// They share the same port choice', '// f7 is treated as part of f1', '// → incorrect routing for f7']} />
        <p className="text-xs text-muted-foreground">From paper: "all flows collided in the same bucket are considered one big flow and share the same port choice."</p>
      </div>
    ),
  },
  {
    title: 'Variable Flowlet Size',
    subtitle: 'Flowlets still vary in size — imbalance persists',
    content: () => (
      <div className="space-y-4">
        <div className="space-y-2">
          {[['FL1', 120, 'Large burst'],['FL2', 30, 'Small burst'],['FL3', 95, 'Medium burst'],['FL4', 15, 'Tiny burst']].map(([l, v, desc]) => (
            <div key={l as string} className="flex items-center gap-3">
              <span className="text-xs font-mono text-muted-foreground w-8">{l}</span>
              <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                <div className="h-full bg-yellow-500/70 rounded transition-all duration-700" style={{ width: `${(v as number) / 120 * 100}%` }} />
              </div>
              <span className="text-xs font-mono text-muted-foreground w-24">{v} pkts — {desc}</span>
            </div>
          ))}
        </div>
        <CodeBlock lines={['// Flowlet size follows traffic bursts', '// Large flowlets still dominate paths', '// "flowlet size can still vary significantly"', '// — Paper §I']} />
      </div>
    ),
  },
  {
    title: 'Simulation Results',
    subtitle: 'Paper Table I — real 100Gbps data center trace (162M packets)',
    content: () => (
      <div className="space-y-3">
        <div className="rounded-lg border border-border overflow-hidden text-xs font-mono">
          <div className="grid grid-cols-3 bg-muted/50 px-3 py-2 text-muted-foreground font-semibold">
            <span>Scheme</span><span>Config</span><span>SDV</span>
          </div>
          {[
            ['ECMP','—','729K','text-red-400'],
            ['Flowlet','50μs','14.4K','text-yellow-400'],
            ['Flowlet','100μs','9.4K *','text-green-400'],
            ['Flowlet','1ms','13.9K','text-yellow-400'],
            ['Flowlet','100ms','861K','text-red-400'],
            ['DLAF','4×1K','5','text-blue-400'],
          ].map(([s,c,sdv,color], i) => (
            <div key={i} className={`grid grid-cols-3 px-3 py-2 border-t border-border ${s==='DLAF' ? 'bg-blue-500/5' : ''}`}>
              <span className={color as string}>{s}</span><span className="text-muted-foreground">{c}</span><span className={`font-bold ${color}`}>{sdv}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center">* Best Flowlet result still 1880× worse than DLAF</p>
      </div>
    ),
  },
  {
    title: 'Flowlet Limitations Summary',
    subtitle: 'Three fundamental issues that DLAF addresses',
    content: () => (
      <div className="space-y-3">
        {[
          ['Hash collisions', 'Single hash table merges unrelated flows into one bucket, forcing them to share a path.'],
          ['Static timeout T', 'Must be manually tuned per network. Too small = reordering. Too large = no benefit. Optimal T changes with traffic.'],
          ['Variable flowlet size', 'Flowlets inherit the burst size of the flow. Large bursts still cause path imbalance.'],
        ].map(([title, desc], i) => (
          <div key={i} className="rounded-lg border border-border bg-muted/10 p-3">
            <div className="text-sm font-semibold text-yellow-400">{title}</div>
            <div className="text-xs text-muted-foreground mt-1">{desc}</div>
          </div>
        ))}
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-400 text-center">
          DLAF solves all three — next tab →
        </div>
      </div>
    ),
  },
];

export default function FlowletSim() {
  const [slide, setSlide] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  const go = (next: number) => { setAnimKey(k => k + 1); setSlide(next); };
  const current = SLIDES[slide];

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 items-center">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            className={`rounded-full transition-all duration-300 ${i === slide ? 'w-6 h-2 bg-yellow-400' : i < slide ? 'w-2 h-2 bg-yellow-400/50' : 'w-2 h-2 bg-border'}`}
          />
        ))}
        <span className="ml-auto text-xs text-muted-foreground font-mono">{slide}/{SLIDES.length - 1}</span>
      </div>

      <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-6 min-h-80 overflow-hidden">
        <div key={animKey} className="animate-[fadeSlide_0.3s_ease-out]">
          <div className="mb-4">
            <div className="text-xs text-yellow-400 font-semibold uppercase tracking-widest">Flowlet · Slide {slide}</div>
            <h3 className="text-xl font-bold mt-0.5">{current.title}</h3>
            <p className="text-sm text-muted-foreground">{current.subtitle}</p>
          </div>
          <current.content />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => go(slide - 1)} disabled={slide === 0}
          className="px-4 py-2 rounded-lg border border-border text-sm font-medium disabled:opacity-30 hover:bg-muted transition-colors">
          ← Prev
        </button>
        <div className="flex gap-1">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => go(i)} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === slide ? 'bg-yellow-400' : 'bg-border'}`} />
          ))}
        </div>
        <button onClick={() => go(slide + 1)} disabled={slide === SLIDES.length - 1}
          className="px-4 py-2 rounded-lg border border-yellow-400/40 bg-yellow-400/10 text-yellow-400 text-sm font-medium disabled:opacity-30 hover:bg-yellow-400/20 transition-colors">
          Next →
        </button>
      </div>
    </div>
  );
}
