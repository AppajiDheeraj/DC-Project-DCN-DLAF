const localFigures = [
  {
    src: '/results/figure2_flowlet_gaps.png',
    title: 'Flowlet Gap Distribution',
    description: 'Shows how timeout settings affect flowlet splitting. Timeout of 100µs achieves optimal balance between responsiveness and stability. Too short (50µs) creates overhead, too long (100ms) misses congestion opportunities.'
  },
  {
    src: '/results/figure5_throughput.png',
    title: 'Throughput Efficiency',
    description: 'DLAF achieves 904 kbps (+16% vs ECMP). Demonstrates load-aware path selection improves actual data delivery. ECMP baseline: 778 kbps, Flowlet: 860 kbps.'
  },
  {
    src: '/results/figure4_load_balancing.png',
    title: 'Load Balancing Effectiveness',
    description: 'Path load standard deviation comparison. Lower values indicate more balanced traffic. DLAF achieves 99.3% reduction from ECMP (5 vs 729K), proving load awareness distributes traffic evenly.'
  },
];

const testingEnvironment = [
  { label: 'Hypervisor', value: 'Orbstack' },
  { label: 'Guest OS', value: 'Ubuntu 22.04 LTS (Jammy)' },
  { label: 'Topology', value: 'k=4 Fat-Tree' },
  { label: 'P4 Runtime', value: 'BMv2 (Behavioral Model v2)' },
  { label: 'Hosts', value: '16 (2 per ToR)' },
  { label: 'Traffic Trace', value: 'Real 100Gbps datacenter (162M packets, 4.5M flows)' },
];

function FatTreeTopology() {
  // Proper k=4 fat-tree layout
  const coreX = [120, 280, 440, 600];
  const aggX = [70, 140, 210, 350, 490, 560, 630, 700];
  const torX = [40, 100, 170, 280, 420, 490, 560, 670];
  const hostX = [20, 60, 120, 180, 260, 300, 360, 420, 470, 510, 560, 620, 680, 720];

  const coreY = 40;
  const aggY = 130;
  const torY = 220;
  const hostY = 310;

  return (
    <div className="rounded-2xl border border-border/80 bg-slate-950/90 p-6 shadow-sm overflow-x-auto">
      <svg viewBox="0 0 750 400" className="w-full h-auto" style={{ minWidth: '100%' }}>
        <defs>
          <style>{`
            .core-node { fill: #3b82f6; }
            .agg-node { fill: #0ea5e9; }
            .tor-node { fill: #06b6d4; }
            .host-node { fill: #10b981; }
            .link { stroke: #64748b; stroke-width: 1.5; fill: none; opacity: 0.6; }
            .label { fill: #e2e8f0; font-size: 12px; font-weight: bold; text-anchor: middle; dominant-baseline: middle; }
            .tier-label { fill: #94a3b8; font-size: 13px; font-weight: 600; }
          `}</style>
        </defs>

        {/* Tier labels */}
        <text x="10" y={coreY} className="tier-label">CORE</text>
        <text x="10" y={aggY} className="tier-label">AGGR</text>
        <text x="15" y={torY} className="tier-label">ToR</text>
        <text x="10" y={hostY} className="tier-label">HOST</text>

        {/* Core to Aggregation links */}
        {coreX.map((cx) =>
          aggX.map((ax) => (
            <line key={`c-a-${cx}-${ax}`} x1={cx} y1={coreY + 16} x2={ax} y2={aggY - 16} className="link" />
          ))
        )}

        {/* Aggregation to ToR links - each agg connects to 2 ToRs */}
        {aggX.map((ax, i) => {
          const torIndices = i < 2 ? [0, 1] : i < 4 ? [2, 3] : i < 6 ? [4, 5] : [6, 7];
          return torIndices.map((ti) => (
            <line key={`a-t-${ax}-${torX[ti]}`} x1={ax} y1={aggY + 16} x2={torX[ti]} y2={torY - 14} className="link" />
          ));
        })}

        {/* ToR to Host links - each ToR connects to 2 hosts */}
        {torX.map((tx, i) => {
          const hostIndices = [i * 2, i * 2 + 1];
          return hostIndices.map((hi) => (
            hostX[hi] !== undefined && (
              <line key={`t-h-${tx}-${hostX[hi]}`} x1={tx} y1={torY + 14} x2={hostX[hi]} y2={hostY - 12} className="link" />
            )
          ));
        })}

        {/* Core switches (4) */}
        {coreX.map((x, i) => (
          <g key={`core-${i}`}>
            <circle cx={x} cy={coreY} r="15" className="core-node" />
            <text x={x} y={coreY} className="label">C{i + 1}</text>
          </g>
        ))}

        {/* Aggregation switches (8) */}
        {aggX.map((x, i) => (
          <g key={`agg-${i}`}>
            <circle cx={x} cy={aggY} r="14" className="agg-node" />
            <text x={x} y={aggY} className="label" style={{ fontSize: '11px' }}>A{i + 1}</text>
          </g>
        ))}

        {/* ToR switches (8) */}
        {torX.map((x, i) => (
          <g key={`tor-${i}`}>
            <circle cx={x} cy={torY} r="13" className="tor-node" />
            <text x={x} y={torY} className="label" style={{ fontSize: '11px' }}>T{i + 1}</text>
          </g>
        ))}

        {/* Hosts (16) */}
        {hostX.map((x, i) => (
          i < 16 && (
            <g key={`host-${i}`}>
              <rect x={x - 9} y={hostY - 9} width="18" height="18" rx="3" className="host-node" />
              <text x={x} y={hostY} className="label" style={{ fontSize: '10px' }}>H{i + 1}</text>
            </g>
          )
        ))}

        {/* Legend */}
        <g transform="translate(35, 365)">
          <text className="tier-label" style={{ fontSize: '11px' }}>Legend:</text>
          <circle cx="80" cy="0" r="5" className="core-node" />
          <text x="90" className="tier-label" style={{ fontSize: '10px' }}>Core</text>
          <circle cx="130" cy="0" r="5" className="agg-node" />
          <text x="140" className="tier-label" style={{ fontSize: '10px' }}>Agg</text>
          <circle cx="170" cy="0" r="5" className="tor-node" />
          <text x="180" className="tier-label" style={{ fontSize: '10px' }}>ToR</text>
          <rect x="215" y="-5" width="10" height="10" rx="2" className="host-node" />
          <text x="230" className="tier-label" style={{ fontSize: '10px' }}>Host</text>
        </g>
      </svg>
      <div className="mt-4 text-sm text-muted-foreground">
        <p><strong className="text-slate-100">k=4 Fat-Tree Topology</strong></p>
        <p>4 Core switches × 8 Aggregation switches × 8 ToR switches × 16 Hosts</p>
        <p>Each host connects to 1 ToR, each ToR connects to multiple Aggs, each Agg connects to all core switches</p>
      </div>
    </div>
  );
}

export default function Results() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border/80 bg-slate-950/55 p-6 shadow-sm md:p-8">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-slate-100 md:text-5xl">Experiment Results</h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            Performance evaluation results from local simulations on the DLAF testbed. DLAF achieves 16% throughput improvement and 99.3% better load balancing compared to ECMP.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-border/80 bg-slate-950/55 p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-100 mb-4">Testing Environment</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {testingEnvironment.map((item) => (
            <div key={item.label} className="rounded-lg border border-border/70 bg-slate-900/50 p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{item.label}</div>
              <div className="mt-1 text-sm font-medium text-slate-100">{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-border/80 bg-slate-950/55 p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-100 mb-4">Network Topology</h2>
        <FatTreeTopology />
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-slate-100">Performance Charts</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          {localFigures.map((figure, index) => (
            <div key={index} className="rounded-2xl overflow-hidden border border-border/80 bg-slate-950/55 shadow-sm">
              <img src={figure.src} alt={figure.title} className="w-full h-auto" />
              <div className="p-4">
                <h3 className="font-semibold text-slate-100 mb-2">{figure.title}</h3>
                <p className="text-sm text-muted-foreground">{figure.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-border/80 bg-slate-950/55 p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-100 mb-4">Key Findings</h2>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>• <strong className="text-slate-100">DLAF Throughput</strong>: 904 kbps (+16% vs ECMP baseline of 778 kbps)</p>
          <p>• <strong className="text-slate-100">Load Balance SDV</strong>: Reduced from 729K (ECMP) to 5 (DLAF) - a 99.3% improvement</p>
          <p>• <strong className="text-slate-100">Optimal Timeout</strong>: 100µs for flowlet detection balances responsiveness and stability</p>
          <p>• <strong className="text-slate-100">Memory Overhead</strong>: Only 2KB for 4 hash tables × 512 buckets (practical for hardware)</p>
          <p>• <strong className="text-slate-100">Topology</strong>: Results obtained on k=4 fat-tree with 16 hosts, 8 ToRs, 8 aggregation, 4 core switches</p>
        </div>
      </section>
    </div>
  );
}