import { useState } from 'react';
import { RiCheckLine, RiCloseLine, RiFileTextLine } from 'react-icons/ri';

const concepts = [
  {
    id: 'ecmp',
    name: 'ECMP',
    full: 'Equal Cost Multi-Path',
    color: 'text-orange-400',
    border: 'border-orange-400/40',
    bg: 'bg-orange-400/5',
    eli5: 'Imagine you have 4 roads to the same city. ECMP looks at your car\'s license plate, does some math, and always sends you down the same road. Simple — but if all the big trucks happen to get the same road, that road gets jammed.',
    how: [
      'Compute hash(5-tuple flow ID)',
      'Map hash to path index (hash % numPaths)',
      'All packets of the same flow always take the same path',
    ],
    pros: ['Zero state — no memory needed per flow', 'Deterministic, no reordering', 'Simple hardware implementation'],
    cons: ['Ignores flow size — one elephant flow can dominate a path', 'Load imbalance grows with Zipf-distributed traffic', 'SDV ~729K in paper\'s real trace test'],
    paperNote: 'ECMP achieves 778 kbps average throughput and the worst load deviation (SDV ~729K) in the paper\'s simulation.',
  },
  {
    id: 'flowlet',
    name: 'Flowlet',
    full: 'Flowlet Switching',
    color: 'text-yellow-400',
    border: 'border-yellow-400/40',
    bg: 'bg-yellow-400/5',
    eli5: 'Same 4 roads, but now you watch for gaps in traffic. When a car pauses for long enough (timeout), the next batch of cars from that same source gets sent down a different road. Better balance — but you have to pick the right pause time.',
    how: [
      'Track last-seen timestamp per flow in a hash table',
      'If gap since last packet > timeout, start a new flowlet',
      'Randomly assign new flowlet to a different path',
      'Packets within a flowlet stay on the same path (no reordering)',
    ],
    pros: ['Better load balance than ECMP', 'Finer-grained than per-flow routing', 'Preserves packet order within a flowlet'],
    cons: ['Timeout is hard to tune — too large = no flowlets, too small = reordering', 'Flow table collisions cause multiple flows to share a path', 'Variable flowlet size still causes imbalance'],
    paperNote: 'Best Flowlet result (100us timeout) still has SDV ~9.4K vs DLAF\'s SDV of 5. Performance is highly timeout-dependent.',
  },
  {
    id: 'dlaf',
    name: 'DLAF',
    full: 'Dynamic and Load-Aware Flowlet',
    color: 'text-blue-400',
    border: 'border-blue-400/40',
    bg: 'bg-blue-400/5',
    eli5: 'Same 4 roads, but now you have k traffic controllers, each watching different groups of cars. When a new group arrives, they check which road is least busy right now and send it there. No guessing the right pause time — the system adapts automatically.',
    how: [
      'k hash tables, each with n buckets: {flowSig, timestamp, ecmpIndex}',
      'For each packet: compute k bucket addresses using k hash functions',
      'If flow found in any bucket: reuse stored path (or reassign if gap > default timeout)',
      'If flow not found: evict the bucket with the oldest timestamp',
      'Assign new flowlet to the least-loaded path using Port Load Counters (PLC)',
      'PLC tracks real-time packet count per path — reset on overflow',
    ],
    pros: ['No manual timeout tuning — flowlets emerge naturally from hash collisions', 'Load-aware: always picks least-loaded path via PLC', 'Multiple hash tables reduce collision probability', 'Hardware-friendly: parallel table lookups'],
    cons: ['More complex than ECMP/Flowlet', 'Requires k*n register memory (still ~33KB for 4x1024)', 'PLC can overflow (mitigated by reset)'],
    paperNote: 'DLAF achieves SDV = 5 (vs 729K for ECMP), 904 kbps throughput (vs 778 kbps ECMP), with ~33KB memory — same as Flowlet.',
  },
];

const algoTable = [
  { metric: 'Load Balance', ecmp: 'Poor', flowlet: 'Depends on timeout', dlaf: 'Near-perfect' },
  { metric: 'Throughput', ecmp: '778 kbps', flowlet: '860 kbps', dlaf: '904 kbps' },
  { metric: 'Packet Order', ecmp: 'Always preserved', flowlet: 'Risk if timeout < latency', dlaf: 'Good (large gaps)' },
  { metric: 'Config Needed', ecmp: 'None', flowlet: 'Timeout threshold', dlaf: 'k, n (defaults work)' },
  { metric: 'Memory', ecmp: 'O(1)', flowlet: '~33 KB', dlaf: '~33 KB' },
  { metric: 'SDV (real trace)', ecmp: '729K', flowlet: '9.4K (best)', dlaf: '5' },
];

export default function Concepts() {
  const [active, setActive] = useState('ecmp');
  const concept = concepts.find(c => c.id === active)!;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold">Concept Explorer</h1>
        <p className="text-muted-foreground mt-1">Understand the three algorithms — from plain English to technical detail.</p>
      </div>

      <div className="flex gap-2">
        {concepts.map(c => (
          <button
            key={c.id}
            onClick={() => setActive(c.id)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all border ${
              active === c.id
                ? `${c.border} ${c.bg} ${c.color}`
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className={`rounded-xl border ${concept.border} ${concept.bg} p-6 space-y-6`}>
        <div>
          <div className={`text-xs font-semibold uppercase tracking-widest ${concept.color}`}>{concept.full}</div>
          <h2 className="text-2xl font-bold mt-1">{concept.name}</h2>
        </div>

        <div className="rounded-lg bg-background/60 border border-border p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Plain English</div>
          <p className="text-sm leading-relaxed">{concept.eli5}</p>
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">How it works</div>
          <ol className="space-y-1">
            {concept.how.map((step, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className={`font-bold ${concept.color} shrink-0`}>{i + 1}.</span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold mb-2 text-green-400">
              <RiCheckLine size={14} /> Strengths
            </div>
            <ul className="space-y-1">
              {concept.pros.map((p, i) => (
                <li key={i} className="text-xs text-muted-foreground">• {p}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold mb-2 text-red-400">
              <RiCloseLine size={14} /> Weaknesses
            </div>
            <ul className="space-y-1">
              {concept.cons.map((c, i) => (
                <li key={i} className="text-xs text-muted-foreground">• {c}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground flex gap-2">
          <RiFileTextLine size={14} className="shrink-0 mt-0.5" />
          <span><strong>From the paper:</strong> {concept.paperNote}</span>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Side-by-Side Comparison</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-semibold">Metric</th>
                <th className="text-left px-4 py-3 font-semibold text-orange-400">ECMP</th>
                <th className="text-left px-4 py-3 font-semibold text-yellow-400">Flowlet</th>
                <th className="text-left px-4 py-3 font-semibold text-blue-400">DLAF</th>
              </tr>
            </thead>
            <tbody>
              {algoTable.map((row, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{row.metric}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.ecmp}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.flowlet}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.dlaf}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">DLAF Architecture (Fig. 1 from paper)</h2>
        <div className="rounded-xl border border-border bg-muted/20 p-6 font-mono text-xs overflow-x-auto">
          <pre className="text-muted-foreground leading-relaxed">{`
  flowID --+---> Hash 0 ---> Table 0 [ flowSig | timestamp | ecmpIndex ]
           +---> Hash 1 ---> Table 1 [ flowSig | timestamp | ecmpIndex ]
           +---> Hash 2 ---> Table 2 [ flowSig | timestamp | ecmpIndex ]
           +---> Hash 3 ---> Table 3 [ flowSig | timestamp | ecmpIndex ]
                                               |
                                               v
                               Dynamic Flowlet Decision (DFD)
                               +-----------------------------+
                               |  1. Flow found? reuse path  |
                               |  2. Gap > timeout? new      |
                               |  3. Not found? evict oldest |
                               |  4. Pick min(PLC) path      |
                               +-----------------------------+
                                               |
                               Port Load Counters (PLC)
                               [ C0 | C1 | C2 | C3 ]  <- m counters
                                               |
                                               v
                                         ECMP index -> port
          `}</pre>
        </div>
      </div>
    </div>
  );
}
