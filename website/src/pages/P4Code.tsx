import { useState } from 'react';

type Tab = 'dlaf' | 'dlaf4' | 'flowlet' | 'ecmp';

const files: Record<Tab, { label: string; file: string; color: string; desc: string; code: string }> = {
  dlaf: {
    label: 'dlaf.p4',
    file: 'dlaf.p4',
    color: 'text-blue-400',
    desc: '2-hash DLAF (no PLC) — the base implementation. Uses 2 hash tables × 1024 buckets. Evicts oldest entry, assigns random port to new flowlet.',
    code: `// dlaf.p4 — 2-hash DLAF (from carolsonggg/DLAF)
// Registers: 2 hash tables, each with 3 arrays (flow_id, last_seen, flowlet_id)

register<bit<16>>(1024) last_seen1;
register<bit<16>>(1024) flowlet_id_tb1;
register<bit<16>>(1024) flow_id_tb1;

register<bit<16>>(1024) last_seen2;
register<bit<16>>(1024) flowlet_id_tb2;
register<bit<16>>(1024) flow_id_tb2;

// In ingress apply block:
apply {
  // Step 1: Compute 2 bucket addresses using CRC16 with different seeds
  hash(meta.flow_index1, HashAlgorithm.crc16, 0,
    {srcAddr, dstAddr, protocol, srcPort, dstPort, (bit<8>)1}, 1024);
  hash(meta.flow_index2, HashAlgorithm.crc16, 0,
    {srcAddr, dstAddr, protocol, srcPort, dstPort, (bit<8>)2}, 1024);

  // Step 2: Compute flow signature (short hash of 5-tuple)
  hash(flow_sig, HashAlgorithm.crc16, 0,
    {srcAddr, dstAddr, protocol, srcPort, dstPort}, 65535);

  // Step 3: Read both buckets
  flow_id_tb1.read(flow_id1, flow_index1);
  flow_id_tb2.read(flow_id2, flow_index2);
  last_seen1.read(last_pkt_ts1, flow_index1);
  last_seen2.read(last_pkt_ts2, flow_index2);

  if (flow_id1 == flow_sig) {
    // Flow found in table 1
    if (now - last_pkt_ts1 > 50000 /*50ms timeout*/) {
      // Gap exceeded → new flowlet, pick random port
      random(meta.flowlet_id, 0, 65000);
      flowlet_id_tb1.write(flow_index1, meta.flowlet_id);
    }
    last_seen1.write(flow_index1, now);
    flowlet_id_tb1.read(meta.flowlet_id, flow_index1);

  } else if (flow_id2 == flow_sig) {
    // Flow found in table 2 (same logic)
    if (now - last_pkt_ts2 > 50000) {
      random(meta.flowlet_id, 0, 65000);
      flowlet_id_tb2.write(flow_index2, meta.flowlet_id);
    }
    last_seen2.write(flow_index2, now);
    flowlet_id_tb2.read(meta.flowlet_id, flow_index2);

  } else {
    // Flow NOT found → evict oldest bucket
    if (last_pkt_ts1 < last_pkt_ts2) {
      flow_id_tb1.write(flow_index1, flow_sig);
      last_seen1.write(flow_index1, now);
      random(meta.flowlet_id, 0, 65000);
      flowlet_id_tb1.write(flow_index1, meta.flowlet_id);
    } else {
      flow_id_tb2.write(flow_index2, flow_sig);
      last_seen2.write(flow_index2, now);
      random(meta.flowlet_id, 0, 65000);
      flowlet_id_tb2.write(flow_index2, meta.flowlet_id);
    }
  }

  // Step 4: Hash flowlet_id → ECMP port
  hash(meta.ecmp_gid, HashAlgorithm.crc16, 0,
    {srcAddr, dstAddr, protocol, srcPort, dstPort, meta.flowlet_id},
    meta.num_nhops);
  ecmp_group_to_nhop.apply();
}`,
  },
  dlaf4: {
    label: 'dlaf_4hash.p4',
    file: 'dlaf_4hash.p4',
    color: 'text-blue-400',
    desc: '4-hash DLAF with PLC — the full paper implementation. 4 hash tables × 512 buckets + port_counter register for load-aware path selection.',
    code: `// dlaf_4hash.p4 — 4-hash DLAF with Port Load Counters (from carolsonggg/DLAF)
// This is the main DLAF variant evaluated in the paper.

// 4 hash tables × 512 buckets each = 2048 total entries
register<bit<16>>(512) last_seen1, last_seen2, last_seen3, last_seen4;
register<bit<16>>(512) flowlet_id_tb1, flowlet_id_tb2, flowlet_id_tb3, flowlet_id_tb4;
register<bit<16>>(512) flow_id_tb1, flow_id_tb2, flow_id_tb3, flow_id_tb4;

// Port Load Counters — one counter per ECMP port
register<int<32>>(2) port_counter;

action find_least_loaded() {
  int<32> c0; int<32> c1;
  port_counter.read(c0, 0);
  port_counter.read(c1, 1);
  // Pick port with smallest counter (least loaded)
  meta.port_index = (c0 <= c1) ? 0 : 1;
}

apply {
  // Step 1: 4 bucket addresses — same 5-tuple + different seed byte
  hash(flow_index1, crc16, {5tuple, (bit<8>)1}, 512);
  hash(flow_index2, crc16, {5tuple, (bit<8>)2}, 512);
  hash(flow_index3, crc16, {5tuple, (bit<8>)3}, 512);
  hash(flow_index4, crc16, {5tuple, (bit<8>)4}, 512);
  hash(flow_sig,    crc16, {5tuple},             65535);

  // Step 2: Read all 4 buckets
  flow_id_tb1.read(flow_id1, flow_index1); // ... (×4)
  last_seen1.read(last_pkt_ts1, flow_index1); // ... (×4)

  // Step 3: Search for flow signature in any of the 4 tables
  if (flow_id1 == flow_sig) {
    if (now - last_pkt_ts1 > 50000) {
      find_least_loaded();                    // ← PLC: pick least-loaded port
      flowlet_id_tb1.write(flow_index1, meta.port_index);
    }
    last_seen1.write(flow_index1, now);
    flowlet_id_tb1.read(meta.port_index, flow_index1);

  } else if (flow_id2 == flow_sig) { /* same */ }
  else if (flow_id3 == flow_sig) { /* same */ }
  else if (flow_id4 == flow_sig) { /* same */ }
  else {
    // Not found → find oldest of 4 candidates, evict it
    // (nested if-else comparing last_pkt_ts1..4)
    find_least_loaded();  // ← PLC for new flowlet too
    flow_id_tbX.write(flow_indexX, flow_sig);
    last_seenX.write(flow_indexX, now);
    flowlet_id_tbX.write(flow_indexX, meta.port_index);
  }

  // Step 4: Increment PLC for chosen port
  port_counter.read(cnt, meta.port_index);
  port_counter.write(meta.port_index, cnt + 1);

  // Step 5: Use port_index directly as ECMP group ID
  meta.ecmp_gid = (bit<14>) meta.port_index;
  ecmp_group_to_nhop.apply();
}`,
  },
  flowlet: {
    label: 'flowlet_switching.p4',
    file: 'flowlet_switching.p4',
    color: 'text-yellow-400',
    desc: 'Standard Flowlet switching. Single hash table (8192 entries). Detects inter-packet gap > 50s threshold, assigns random new flowlet ID.',
    code: `// flowlet_switching.p4 (from carolsonggg/DLAF)

// Single hash table: 8192 entries
register<bit<48>>(8192) last_seen;    // timestamp per bucket
register<bit<16>>(8192) flowlet_id_tb; // flowlet ID per bucket

action get_inter_packet_gap() {
  bit<48> last_pkt_ts;
  last_seen.read(last_pkt_ts, meta.flow_index);
  meta.interval = now - last_pkt_ts;
  last_seen.write(meta.flow_index, now);
}

apply {
  // Hash 5-tuple → bucket index
  hash(meta.flow_index, HashAlgorithm.crc16, 0,
    {srcAddr, dstAddr, protocol, srcPort, dstPort}, 8192);

  get_inter_packet_gap();

  if (meta.interval >= 50000000000 /*50s in ns — note: very large threshold*/) {
    // New flowlet: assign random ID
    random(meta.flowlet_id, 0, 65000);
    flowlet_id_tb.write(meta.flow_index, meta.flowlet_id);
  } else {
    // Same flowlet: reuse stored ID
    flowlet_id_tb.read(meta.flowlet_id, meta.flow_index);
  }

  // Hash (5-tuple + flowlet_id) → ECMP port
  hash(meta.ecmp_gid, HashAlgorithm.crc16, 0,
    {srcAddr, dstAddr, protocol, srcPort, dstPort, meta.flowlet_id},
    meta.num_nhops);
  ecmp_group_to_nhop.apply();
}`,
  },
  ecmp: {
    label: 'ecmp_switching.p4',
    file: 'ecmp_switching.p4',
    color: 'text-orange-400',
    desc: 'Standard ECMP. No state. Hash 5-tuple directly to ECMP group index. Simplest implementation — 54 lines of core logic.',
    code: `// ecmp_switching.p4 (from carolsonggg/DLAF)
// No registers needed — completely stateless.

action ecmp_group(bit<14> ecmp_group_id, bit<16> num_nhops) {
  // Hash 5-tuple → port index (0..num_nhops-1)
  hash(meta.hash_res,
       HashAlgorithm.crc16,
       (bit<1>)0,
       {hdr.ipv4.srcAddr,
        hdr.ipv4.dstAddr,
        hdr.ipv4.protocol,
        hdr.tcp.srcPort,
        hdr.tcp.dstPort},
       num_nhops);
  meta.ecmp_group_id = ecmp_group_id;
}

// Two tables:
// ipv4_lpm: dstAddr → ecmp_group(id, num_nhops) or set_nhop(port)
// ecmp_group_to_nhop: (group_id, hash_res) → set_nhop(port)

apply {
  switch (ipv4_lpm.apply().action_run) {
    ecmp_group: {
      ecmp_group_to_nhop.apply();  // lookup (group_id, hash) → port
    }
  }
}`,
  },
};

const annotations: Record<Tab, { line: string; note: string }[]> = {
  dlaf: [
    { line: 'seed byte (bit<8>)1', note: 'Multiple hashing: same hash fn, different seed → independent bucket addresses per table' },
    { line: 'flow_sig', note: 'Short signature (16-bit CRC of 5-tuple) stored in bucket to identify the flow' },
    { line: 'last_pkt_ts1 < last_pkt_ts2', note: 'Evict oldest: compare timestamps to find which bucket was least recently used' },
    { line: 'random(meta.flowlet_id', note: 'No PLC in this variant — new flowlet gets a random port (like Flowlet)' },
  ],
  dlaf4: [
    { line: 'port_counter', note: 'Port Load Counters (PLC): tracks how many packets went to each port' },
    { line: 'find_least_loaded', note: 'Key DLAF innovation: always pick the port with the smallest counter' },
    { line: 'cnt + 1', note: 'Increment PLC after each forwarding decision — keeps load tracking current' },
    { line: 'meta.ecmp_gid = (bit<14>) meta.port_index', note: 'Port index IS the ECMP group ID — direct lookup, no extra hash needed' },
  ],
  flowlet: [
    { line: '50000000000', note: 'Threshold is 50 seconds in nanoseconds — very large, effectively disabling flowlets in this version' },
    { line: 'random(meta.flowlet_id', note: 'Random new flowlet ID → random path. No load awareness.' },
    { line: 'meta.flowlet_id}, meta.num_nhops', note: 'Hash (5-tuple + flowlet_id) → port. Same flowlet always takes same path.' },
  ],
  ecmp: [
    { line: 'hash(meta.hash_res', note: 'Single hash of 5-tuple → port index. No state, no memory.' },
    { line: 'ecmp_group_to_nhop.apply()', note: 'Two-table lookup: LPM finds group, then (group_id, hash) → physical port' },
  ],
};

const memoryStats: Record<Tab, { label: string; value: string }[]> = {
  dlaf: [
    { label: 'Hash tables', value: '2' },
    { label: 'Buckets/table', value: '1024' },
    { label: 'Fields/bucket', value: 'flow_sig (16b) + timestamp (48b) + ecmp_idx (16b)' },
    { label: 'Total registers', value: '2 × 1024 × 3 = 6144 entries ≈ 49 KB' },
    { label: 'PLC', value: 'None (random port selection)' },
  ],
  dlaf4: [
    { label: 'Hash tables', value: '4' },
    { label: 'Buckets/table', value: '512' },
    { label: 'Fields/bucket', value: 'flow_sig (16b) + timestamp (48b) + ecmp_idx (16b)' },
    { label: 'Total registers', value: '4 × 512 × 3 = 6144 entries ≈ 33 KB' },
    { label: 'PLC', value: '2 counters × 32b = 8 bytes' },
  ],
  flowlet: [
    { label: 'Hash table', value: '1' },
    { label: 'Buckets', value: '8192' },
    { label: 'Fields/bucket', value: 'timestamp (48b) + flowlet_id (16b)' },
    { label: 'Total registers', value: '8192 × 2 = 16384 entries ≈ 33 KB' },
    { label: 'PLC', value: 'None' },
  ],
  ecmp: [
    { label: 'Registers', value: 'None' },
    { label: 'Memory', value: 'O(1) — only the ECMP group table' },
    { label: 'State per flow', value: 'Zero' },
    { label: 'P4 lines (core)', value: '54' },
    { label: 'PLC', value: 'None' },
  ],
};

export default function P4Code() {
  const [tab, setTab] = useState<Tab>('dlaf4');
  const [showAnnotations, setShowAnnotations] = useState(true);
  const f = files[tab];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">P4 Implementation</h1>
        <p className="text-muted-foreground mt-1">
          Real P4 source code from{' '}
          <a
            href="https://github.com/carolsonggg/DLAF"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            github.com/carolsonggg/DLAF
          </a>
          {' '}— annotated and explained.
        </p>
      </div>

      {/* File tabs */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(files) as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-mono border transition-colors ${
              tab === t
                ? `border-current ${files[t].color} bg-current/10`
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {files[t].label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showAnnotations}
            onChange={e => setShowAnnotations(e.target.checked)}
            className="accent-blue-500"
          />
          Show annotations
        </label>
      </div>

      {/* Description */}
      <div className={`rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm ${f.color}`}>
        <span className="font-bold font-mono mr-2">{f.file}:</span>
        <span className="text-foreground/80">{f.desc}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Code */}
        <div className="xl:col-span-2">
          <div className="rounded-xl border border-border bg-slate-950 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-slate-900">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/60" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <span className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <span className="text-xs font-mono text-muted-foreground ml-2">{f.file}</span>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed whitespace-pre-wrap">
              {f.code}
            </pre>
          </div>
        </div>

        {/* Annotations + Memory */}
        <div className="space-y-4">
          {showAnnotations && (
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="font-semibold text-sm">Key Lines Explained</div>
              {annotations[tab].map(({ line, note }, i) => (
                <div key={i} className="space-y-1">
                  <code className="text-xs bg-muted/40 px-1.5 py-0.5 rounded text-blue-300 block truncate">
                    {line}
                  </code>
                  <p className="text-xs text-muted-foreground">{note}</p>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="font-semibold text-sm">Memory Layout</div>
            {memoryStats[tab].map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-2 text-xs">
                <span className="text-muted-foreground shrink-0">{label}</span>
                <span className="font-mono text-right">{value}</span>
              </div>
            ))}
          </div>

          {/* P4 concepts */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="font-semibold text-sm">P4 Concepts Used</div>
            {[
              { term: 'register<T>(n)', def: 'Stateful memory array — persists across packets. Used for hash tables and PLC.' },
              { term: 'hash()', def: 'Built-in hash function (CRC16). Seed byte in key = different hash per table.' },
              { term: 'ingress_global_timestamp', def: 'Hardware timestamp of packet arrival — used for gap detection.' },
              { term: 'V1Switch', def: 'BMv2 software switch architecture: Parser → Ingress → Egress → Deparser.' },
            ].map(({ term, def }) => (
              <div key={term}>
                <code className="text-xs text-green-400">{term}</code>
                <p className="text-xs text-muted-foreground mt-0.5">{def}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison table */}
      <div>
        <h2 className="text-xl font-bold mb-4">Implementation Comparison</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="text-left px-4 py-3">Property</th>
                <th className="text-left px-4 py-3 text-orange-400">ECMP</th>
                <th className="text-left px-4 py-3 text-yellow-400">Flowlet</th>
                <th className="text-left px-4 py-3 text-blue-400">DLAF (2-hash)</th>
                <th className="text-left px-4 py-3 text-blue-400">DLAF (4-hash+PLC)</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['P4 lines (core)', '54', '75', '~90', '105'],
                ['Registers', '0', '2 × 8192', '6 × 1024', '12 × 512 + PLC'],
                ['Memory', 'O(1)', '~33 KB', '~49 KB', '~33 KB'],
                ['Hash functions', '1', '1', '2 + sig', '4 + sig'],
                ['Port selection', 'hash(5-tuple)', 'random', 'random', 'min(PLC)'],
                ['Timeout needed', 'No', 'Yes (hard)', 'Yes (default)', 'Yes (default)'],
                ['Load-aware', 'No', 'No', 'No', 'Yes (PLC)'],
              ].map(([prop, ...vals], i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-medium">{prop}</td>
                  {vals.map((v, j) => (
                    <td key={j} className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
