import { useState, useEffect, useRef } from 'react';

export function CodeBlock({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-lg bg-black/30 border border-border p-4 font-mono text-sm space-y-0.5">
      {lines.map((l, i) => (
        <div key={i} className={
          l.startsWith('//') ? 'text-muted-foreground' :
          l.includes('[ok]') ? 'text-green-400' :
          l.includes('argmin') ? 'text-blue-300' :
          l.includes('TIMEOUT') || l.includes('EVICT') ? 'text-yellow-300 font-bold' :
          'text-foreground'
        }>{l || <>&nbsp;</>}</div>
      ))}
    </div>
  );
}

export function PLCBar({ counts, highlight }: { counts: number[]; highlight?: number }) {
  const max = Math.max(...counts, 1);
  return (
    <div className="flex gap-3 items-end h-20 px-2">
      {counts.map((c, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className={`text-xs font-mono ${i === highlight ? 'text-green-400 font-bold' : 'text-muted-foreground'}`}>{c}</span>
          <div className="w-full bg-muted rounded-t overflow-hidden flex items-end" style={{ height: '44px' }}>
            <div
              className={`w-full rounded-t transition-all duration-500 ${i === highlight ? 'bg-green-400' : 'bg-blue-500/60'}`}
              style={{ height: `${Math.max(4, (c / max) * 100)}%` }}
            />
          </div>
          <span className={`text-xs font-mono ${i === highlight ? 'text-green-400' : 'text-muted-foreground'}`}>P{i + 1}</span>
        </div>
      ))}
    </div>
  );
}

export function HashTable({ entries, highlight }: {
  entries: Array<{ sig: string; ts: string; idx: number | string }>;
  highlight?: number;
}) {
  return (
    <div className="rounded-lg border border-border overflow-hidden text-xs font-mono">
      <div className="grid grid-cols-3 bg-muted/50 px-3 py-2 text-muted-foreground font-semibold text-center">
        <span>flow_sig</span><span>timestamp</span><span>ecmp_idx</span>
      </div>
      {entries.map((e, i) => (
        <div key={i} className={`grid grid-cols-3 px-3 py-2 border-t border-border text-center transition-colors duration-300 ${i === highlight ? 'bg-blue-500/20 text-blue-300' : ''}`}>
          <span>{e.sig}</span><span>{e.ts}</span><span>{e.idx}</span>
        </div>
      ))}
    </div>
  );
}

export function useLiveSim() {
  const [log, setLog] = useState<Array<{ id: string; path: number; action: string }>>([]);
  const [plc, setPlc] = useState([0, 0, 0, 0]);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const plcRef = useRef([0, 0, 0, 0]);

  useEffect(() => {
    if (!running) { if (timer.current) clearInterval(timer.current); return; }
    timer.current = setInterval(() => {
      const ids = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'];
      const id = ids[Math.floor(Math.random() * ids.length)];
      // pick least loaded path (simulate DLAF)
      const minVal = Math.min(...plcRef.current);
      const path = plcRef.current.indexOf(minVal);
      plcRef.current = plcRef.current.map((v, i) => i === path ? v + 1 : v);
      setPlc([...plcRef.current]);
      setLog(prev => [{ id, path, action: 'argmin(C)' }, ...prev.slice(0, 7)]);
    }, 500);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [running]);

  const reset = () => {
    plcRef.current = [0, 0, 0, 0];
    setPlc([0, 0, 0, 0]);
    setLog([]);
    setRunning(false);
  };
  return { log, plc, running, setRunning, reset };
}

// ── Slides 0–9 ──────────────────────────────────────────────────────────────

export const SLIDES_A = [
  {
    title: 'DLAF Architecture Overview',
    subtitle: 'Three components: k hash functions, k hash tables, Port Load Counters',
    content: () => (
      <div className="space-y-3">
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
          <div className="text-xs text-blue-400 font-semibold mb-1">1. k Hash Generators</div>
          <div className="font-mono text-sm">h₀(f), h₁(f), ..., h_{'{k-1}'}(f)</div>
          <div className="text-xs text-muted-foreground mt-1">Independent hash functions, each taking the flow ID as key</div>
        </div>
        <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
          <div className="text-xs text-purple-400 font-semibold mb-1">2. k Hash Tables (n buckets each)</div>
          <div className="font-mono text-sm">[ flow_sig | timestamp | ecmp_index ]</div>
          <div className="text-xs text-muted-foreground mt-1">Stores up to k×n most recent flows. Paper uses k=4, n=1024</div>
        </div>
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
          <div className="text-xs text-green-400 font-semibold mb-1">3. Port Load Counters (PLC)</div>
          <div className="font-mono text-sm">C = [c₀, c₁, c₂, c₃]  — m counters, m = ECMP group size</div>
          <div className="text-xs text-muted-foreground mt-1">Counts packets forwarded per port. Reset on overflow.</div>
        </div>
      </div>
    ),
  },
  {
    title: 'Flow Signature',
    subtitle: 'A short hash of the 5-tuple stored in each bucket',
    content: () => (
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-3 flex-wrap py-2">
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 font-mono text-sm text-center">
            <div className="text-xs text-muted-foreground mb-1">5-tuple</div>
            <div className="font-bold">f = (src,dst,sp,dp,proto)</div>
          </div>
          <div className="text-muted-foreground font-bold">→</div>
          <div className="rounded-lg border border-blue-500/40 bg-blue-500/5 px-4 py-3 font-mono text-sm text-center">
            <div className="text-xs text-muted-foreground mb-1">Hash(f)</div>
            <div className="font-bold text-blue-400">flow_sig (16-bit)</div>
          </div>
        </div>
        <CodeBlock lines={[
          '// Paper: CRC16(5-tuple) mod 65535',
          '// 16-bit sig → differentiates 65K flows',
          '// Stored in hash table bucket field 1',
          '// Collisions possible but rare — OK',
        ]} />
        <p className="text-xs text-muted-foreground text-center">A full 5-tuple is 104 bits (IPv4). A 16-bit signature saves memory while still identifying flows.</p>
      </div>
    ),
  },
  {
    title: 'Compute k Bucket Addresses',
    subtitle: 'Each hash function maps the flow to a bucket in its table',
    content: () => (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {[['h₀(f)', 3, 'T0[3]'], ['h₁(f)', 7, 'T1[7]'], ['h₂(f)', 1, 'T2[1]'], ['h₃(f)', 5, 'T3[5]']].map(([fn, val, bucket]) => (
            <div key={fn as string} className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-3">
              <span className="font-mono text-sm text-muted-foreground w-14">{fn}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-mono font-bold text-blue-400 text-base">{val}</span>
              <span className="text-xs text-muted-foreground ml-auto">{bucket}</span>
            </div>
          ))}
        </div>
        <CodeBlock lines={[
          '// Paper optimization: one hash function,',
          '// vary key: CRC16(5tuple ++ i) mod 1024',
          'addr_i = Hash_i(f) mod n',
          '// All k lookups happen in parallel',
        ]} />
      </div>
    ),
  },
  {
    title: 'Parallel Table Lookup',
    subtitle: 'All k buckets are searched simultaneously for the flow signature',
    content: () => (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'T0[3]', sig: 'f1 [ok]', ts: '10ms', idx: 2, match: true },
            { label: 'T1[7]', sig: 'f99', ts: '8ms', idx: 1, match: false },
            { label: 'T2[1]', sig: 'f42', ts: '5ms', idx: 0, match: false },
            { label: 'T3[5]', sig: 'f7', ts: '3ms', idx: 3, match: false },
          ].map(({ label, sig, ts, idx, match }) => (
            <div key={label} className={`rounded-lg border p-3 text-xs font-mono transition-all ${match ? 'border-green-500/40 bg-green-500/5 shadow-sm shadow-green-500/20' : 'border-border bg-muted/10'}`}>
              <div className={`font-semibold mb-1.5 ${match ? 'text-green-400' : 'text-muted-foreground'}`}>{label}</div>
              <div>sig: {sig}</div>
              <div>ts: {ts}</div>
              <div>idx: {idx}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center">T0[3] matches flow f1 — proceed to Case 1 (flow found).</p>
      </div>
    ),
  },
  {
    title: 'Case 1: Flow Found — Check Timeout',
    subtitle: 'Compare current time against stored timestamp',
    content: () => (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground">current_time</div>
            <div className="font-mono font-bold text-lg mt-1">90ms</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground">stored ts</div>
            <div className="font-mono font-bold text-lg mt-1">10ms</div>
          </div>
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
            <div className="text-xs text-muted-foreground">gap</div>
            <div className="font-mono font-bold text-lg mt-1 text-yellow-400">80ms</div>
          </div>
        </div>
        <CodeBlock lines={[
          '// Algorithm 1, line 6:',
          'if cur_time - Ti[addr].ts >= TIMEOUT:',
          '    // → TIMEOUT branch (slide 5)',
          'else:',
          '    // → reuse path (slide 6)',
          '// Default TIMEOUT = 10ms (paper §II-B)',
        ]} />
      </div>
    ),
  },
  {
    title: 'Case 1a: Timeout — Reassign Path',
    subtitle: 'Gap exceeded threshold → assign to least-loaded path',
    content: () => (
      <div className="space-y-4">
        <PLCBar counts={[45, 12, 67, 23]} highlight={1} />
        <CodeBlock lines={[
          '// Algorithm 1, lines 7-9:',
          'j = argmin(C)  // = 1 (P2 least loaded)',
          'C[1]++',
          'Ti[addr].ecmp_index = 1',
          'Ti[addr].ts = cur_time',
          'return j  // → P2',
        ]} />
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-400">
          A new flowlet is generated. The flow is redirected to the least-loaded port.
        </div>
      </div>
    ),
  },
  {
    title: 'Case 1b: No Timeout — Reuse Path',
    subtitle: 'Gap within threshold → continue on same path, update timestamp',
    content: () => (
      <div className="space-y-4">
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 text-center">
          <div className="text-green-400 font-semibold">gap ≤ TIMEOUT → Same Flowlet</div>
          <div className="font-mono text-2xl font-bold mt-2 text-foreground">→ Path 2 (unchanged)</div>
        </div>
        <CodeBlock lines={[
          '// Algorithm 1, lines 11-13:',
          'C[Ti[addr].ecmp_index]++  // C[2]++',
          'p = Ti[addr].ecmp_index   // = 2',
          'Ti[addr].ts = cur_time    // refresh',
          'return p',
          '// Packet order preserved [ok]',
        ]} />
      </div>
    ),
  },
  {
    title: 'Case 2: Flow Not Found — Select Victim',
    subtitle: 'No match in any table → evict the bucket with oldest timestamp',
    content: () => (
      <div className="space-y-4">
        <HashTable
          entries={[
            { sig: 'f3', ts: '85ms', idx: 0 },
            { sig: 'f9', ts: '2ms', idx: 3 },
            { sig: 'f5', ts: '71ms', idx: 1 },
          ]}
          highlight={1}
        />
        <CodeBlock lines={[
          '// Algorithm 1, line 16:',
          '// No match found in any of k tables',
          'i = argmin(Ti[addr_i].ts)',
          '  = T1  (ts=2ms is oldest)',
          '// T1[7] will be overwritten — EVICT',
        ]} />
        <p className="text-xs text-muted-foreground">Evicting the oldest entry maximises the flowlet gap — the evicted flow has been idle the longest.</p>
      </div>
    ),
  },
  {
    title: 'Case 2: Choose Least-Loaded Path',
    subtitle: 'Consult PLC to find the port with the smallest counter',
    content: () => (
      <div className="space-y-4">
        <PLCBar counts={[30, 8, 55, 20]} highlight={1} />
        <CodeBlock lines={[
          '// Algorithm 1, line 17:',
          'j = argmin(C)',
          '  = argmin([30, 8, 55, 20])',
          '  = 1  →  P2 (least loaded) [ok]',
        ]} />
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-400 italic">
          "assigns flowlet to least-loaded port" — Paper §II-B
        </div>
      </div>
    ),
  },
  {
    title: 'Case 2: Insert and Update',
    subtitle: 'Write new flow into evicted bucket, increment PLC',
    content: () => (
      <div className="space-y-4">
        <HashTable
          entries={[
            { sig: 'f3', ts: '85ms', idx: 0 },
            { sig: 'f_new', ts: '90ms', idx: 1 },
            { sig: 'f5', ts: '71ms', idx: 1 },
          ]}
          highlight={1}
        />
        <CodeBlock lines={[
          '// Algorithm 1, lines 18-22:',
          'C[j]++                       // C[1]++',
          'Ti[addr].flow_sig = flow_sig',
          'Ti[addr].ts       = cur_time',
          'Ti[addr].ecmp_index = j      // = 1',
          'return j',
        ]} />
      </div>
    ),
  },
];
