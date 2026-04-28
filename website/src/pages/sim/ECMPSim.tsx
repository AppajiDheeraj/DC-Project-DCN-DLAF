import { useState, useEffect, useRef } from 'react';

function CodeBlock({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-lg bg-black/30 border border-border p-4 font-mono text-sm space-y-0.5">
      {lines.map((l, i) => (
        <div key={i} className={
          l.startsWith('//') ? 'text-muted-foreground' :
          l.includes('←') && l.includes('overload') ? 'text-red-400' :
          l.includes('[!]') ? 'text-yellow-400' :
          'text-foreground'
        }>{l || <>&nbsp;</>}</div>
      ))}
    </div>
  );
}

function AnimPacket({ delay, path }: { delay: number; path: number }) {
  const colors = ['bg-blue-400', 'bg-green-400', 'bg-yellow-400', 'bg-purple-400'];
  return (
    <div
      className={`absolute w-3 h-3 rounded-full ${colors[path]} shadow-lg animate-[moveRight_1.8s_ease-in-out_infinite]`}
      style={{ animationDelay: `${delay}s`, top: `${8 + path * 20}px`, left: 0 }}
    />
  );
}

const SLIDES = [
  {
    title: 'Network Setup',
    subtitle: 'One sender, four equal-cost paths, one receiver',
    content: () => (
      <div className="space-y-5">
        <div className="relative flex items-center justify-between px-4 py-6 rounded-lg border border-border bg-muted/10 overflow-hidden" style={{ height: 120 }}>
          <div className="flex flex-col items-center gap-1 z-10">
            <div className="w-12 h-12 rounded-lg bg-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-lg">S</div>
            <span className="text-xs text-muted-foreground">Sender</span>
          </div>
          <div className="flex-1 relative mx-4" style={{ height: 100 }}>
            {[0,1,2,3].map(i => (
              <div key={i} className="absolute w-full h-px bg-border/60" style={{ top: `${8 + i * 20}px` }} />
            ))}
            {[0,1,2,3].map(i => (
              <AnimPacket key={i} delay={i * 0.45} path={i} />
            ))}
            {['P1','P2','P3','P4'].map((p, i) => (
              <span key={p} className="absolute right-0 text-xs font-mono text-muted-foreground" style={{ top: `${2 + i * 20}px` }}>{p}</span>
            ))}
          </div>
          <div className="flex flex-col items-center gap-1 z-10">
            <div className="w-12 h-12 rounded-lg bg-green-500 flex items-center justify-center text-white text-xs font-bold shadow-lg">R</div>
            <span className="text-xs text-muted-foreground">Receiver</span>
          </div>
        </div>
        <CodeBlock lines={['Paths = { P1, P2, P3, P4 }', 'Load  = [  0,  0,  0,  0 ]', '// All paths have equal cost']} />
      </div>
    ),
  },
  {
    title: 'Flow Definition',
    subtitle: 'A flow is uniquely identified by its 5-tuple',
    content: () => (
      <div className="space-y-4">
        <div className="flex justify-center">
          <div className="rounded-xl border border-blue-500/40 bg-blue-500/5 p-5 space-y-2 w-full max-w-sm">
            <div className="text-xs text-blue-400 font-semibold uppercase tracking-widest mb-3">Flow f1</div>
            {[['srcIP','10.0.0.1'],['dstIP','10.0.0.9'],['srcPort','54321'],['dstPort','80'],['protocol','TCP (6)']].map(([k,v]) => (
              <div key={k} className="flex gap-4 text-sm font-mono border-b border-border/30 pb-1">
                <span className="text-muted-foreground w-24">{k}</span>
                <span className="text-foreground font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <CodeBlock lines={['f1 = (srcIP, dstIP, srcPort, dstPort, proto)', '// 5-tuple uniquely identifies a flow', '// All packets of f1 share this tuple']} />
      </div>
    ),
  },
  {
    title: 'Hash Computation',
    subtitle: 'ECMP applies a hash function to the 5-tuple',
    content: () => (
      <div className="space-y-5">
        <div className="flex items-center justify-center gap-3 py-4 flex-wrap">
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 font-mono text-sm text-center">
            <div className="text-xs text-muted-foreground mb-1">input</div>
            <div className="font-bold">f1</div>
          </div>
          <div className="text-muted-foreground text-xl font-bold">→</div>
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 px-4 py-3 font-mono text-sm text-yellow-400 text-center">
            <div className="text-xs mb-1">function</div>
            <div className="font-bold">hash()</div>
          </div>
          <div className="text-muted-foreground text-xl font-bold">→</div>
          <div className="rounded-lg border border-green-500/40 bg-green-500/5 px-6 py-3 font-mono text-center">
            <div className="text-xs text-muted-foreground mb-1">output</div>
            <div className="text-3xl font-bold text-green-400">6</div>
          </div>
        </div>
        <CodeBlock lines={['// ECMP uses a single hash function', 'hash(f1) = 6', '// e.g. CRC16 of the 5-tuple']} />
        <p className="text-sm text-muted-foreground text-center">The hash is deterministic — same flow always produces the same value.</p>
      </div>
    ),
  },
  {
    title: 'Path Mapping',
    subtitle: 'Modulo maps the hash to a port index',
    content: () => (
      <div className="space-y-5">
        <div className="flex items-center justify-center gap-3 py-2 flex-wrap">
          {[['hash(f1)','6','border-border'],['mod 4','','border-transparent'],['=','','border-transparent'],['port','2','border-blue-500/40 bg-blue-500/5 text-blue-400']].map(([label, val, cls], i) => (
            val ? (
              <div key={i} className={`rounded-lg border ${cls} px-4 py-3 text-center`}>
                <div className="text-xs text-muted-foreground mb-1">{label}</div>
                <div className="font-mono text-2xl font-bold">{val}</div>
              </div>
            ) : (
              <div key={i} className="font-mono text-muted-foreground text-xl font-bold">{label}</div>
            )
          ))}
        </div>
        <CodeBlock lines={['port = hash(f1) mod 4', '     = 6 mod 4', '     = 2  →  Path P3 (0-indexed)']} />
        <div className="flex justify-center gap-2 pt-1">
          {['P1','P2','P3','P4'].map((p, i) => (
            <div key={p} className={`rounded-lg border px-4 py-2 text-sm font-mono transition-all duration-300 ${i === 2 ? 'border-blue-500 bg-blue-500/20 text-blue-400 scale-110 shadow-lg shadow-blue-500/20' : 'border-border text-muted-foreground'}`}>{p}</div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: 'Flow Consistency',
    subtitle: 'Every packet of f1 always takes the same path',
    content: () => {
      const [tick, setTick] = useState(0);
      const ref = useRef<ReturnType<typeof setInterval> | null>(null);
      useEffect(() => {
        ref.current = setInterval(() => setTick(t => (t + 1) % 5), 600);
        return () => { if (ref.current) clearInterval(ref.current); };
      }, []);
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className={`text-xs font-mono w-16 transition-colors ${tick === i-1 ? 'text-blue-400 font-bold' : 'text-muted-foreground'}`}>Packet {i}</div>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${tick === i-1 ? 'bg-blue-400' : 'bg-blue-500/30'}`}
                    style={{ width: tick >= i-1 ? '100%' : '0%' }}
                  />
                </div>
                <div className={`rounded border px-2 py-0.5 text-xs font-mono transition-all ${tick >= i-1 ? 'border-blue-500/40 bg-blue-500/10 text-blue-400' : 'border-border text-muted-foreground'}`}>P3</div>
              </div>
            ))}
          </div>
          <CodeBlock lines={['// hash(f1) is deterministic', '∀ pkt ∈ f1  →  same hash  →  same path', 'All packets of f1 → Path P3']} />
        </div>
      );
    },
  },
  {
    title: 'Multiple Flows — Hash Collision',
    subtitle: 'Two flows can hash to the same path regardless of size',
    content: () => (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-orange-500/40 bg-orange-500/5 p-4">
            <div className="font-bold font-mono text-orange-400">f1 — elephant</div>
            <div className="text-xs text-muted-foreground mt-1">~133K packets</div>
            <div className="mt-3 text-xs font-mono">hash(f1) = 6</div>
            <div className="text-xs font-mono">6 mod 4 = 2 → P3</div>
          </div>
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-4">
            <div className="font-bold font-mono text-yellow-400">f2 — mouse</div>
            <div className="text-xs text-muted-foreground mt-1">~4 packets</div>
            <div className="mt-3 text-xs font-mono">hash(f2) = 10</div>
            <div className="text-xs font-mono">10 mod 4 = 2 → P3</div>
          </div>
        </div>
        <CodeBlock lines={['hash(f1) mod 4 = 2  →  P3', 'hash(f2) mod 4 = 2  →  P3', '', '// Both land on P3 — collision!', '// ECMP cannot see flow sizes']} />
      </div>
    ),
  },
  {
    title: 'Imbalance Emerges',
    subtitle: 'ECMP balances flow count, not bytes — SDV = 729K on real trace',
    content: () => {
      const loads = [5, 200, 10, 8];
      const max = Math.max(...loads);
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            {loads.map((v, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-6">P{i+1}</span>
                <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                  <div
                    className={`h-full rounded transition-all duration-700 ${i === 1 ? 'bg-red-500' : 'bg-orange-500/60'}`}
                    style={{ width: `${(v / max) * 100}%` }}
                  />
                </div>
                <span className={`text-xs font-mono w-12 ${i === 1 ? 'text-red-400 font-bold' : 'text-muted-foreground'}`}>{v}{i === 1 ? ' ←' : ''}</span>
              </div>
            ))}
          </div>
          <CodeBlock lines={['// Real trace: 162M packets, 4.5M flows', 'SDV(ECMP) = 729,000  // very high', '', '// Root cause: flow size follows Zipf', '// One elephant flow = many mouse flows']} />
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
            ECMP distributes <strong>flow count</strong> evenly, not <strong>traffic volume</strong>. One large flow dominates a path.
          </div>
        </div>
      );
    },
  },
];

export default function ECMPSim() {
  const [slide, setSlide] = useState(0);
  const [dir, setDir] = useState<'left'|'right'>('right');
  const [animKey, setAnimKey] = useState(0);

  const go = (next: number) => {
    setDir(next > slide ? 'right' : 'left');
    setAnimKey(k => k + 1);
    setSlide(next);
  };

  const current = SLIDES[slide];

  return (
    <div className="space-y-4">
      {/* Progress dots */}
      <div className="flex gap-1.5 items-center">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            className={`rounded-full transition-all duration-300 ${i === slide ? 'w-6 h-2 bg-orange-400' : i < slide ? 'w-2 h-2 bg-orange-400/50' : 'w-2 h-2 bg-border'}`}
          />
        ))}
        <span className="ml-auto text-xs text-muted-foreground font-mono">{slide}/{SLIDES.length - 1}</span>
      </div>

      {/* Slide card */}
      <div className="rounded-xl border border-orange-400/30 bg-orange-400/5 p-6 min-h-80 overflow-hidden">
        <div
          key={animKey}
          className={`animate-[fadeSlide_0.3s_ease-out]`}
          style={{ animationDirection: dir === 'left' ? 'reverse' : 'normal' }}
        >
          <div className="mb-4">
            <div className="text-xs text-orange-400 font-semibold uppercase tracking-widest">
              ECMP · Slide {slide}
            </div>
            <h3 className="text-xl font-bold mt-0.5">{current.title}</h3>
            <p className="text-sm text-muted-foreground">{current.subtitle}</p>
          </div>
          <current.content />
        </div>
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => go(slide - 1)}
          disabled={slide === 0}
          className="px-4 py-2 rounded-lg border border-border text-sm font-medium disabled:opacity-30 hover:bg-muted transition-colors"
        >
          ← Prev
        </button>
        <div className="flex gap-1">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => go(i)} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === slide ? 'bg-orange-400' : 'bg-border'}`} />
          ))}
        </div>
        <button
          onClick={() => go(slide + 1)}
          disabled={slide === SLIDES.length - 1}
          className="px-4 py-2 rounded-lg border border-orange-400/40 bg-orange-400/10 text-orange-400 text-sm font-medium disabled:opacity-30 hover:bg-orange-400/20 transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
