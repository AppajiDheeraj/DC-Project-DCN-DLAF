type StatCard = {
  label: string;
  value: string;
  note: string;
};

type EnvironmentCard = {
  label: string;
  value: string;
  note: string;
};

type SeriesPoint = {
  label: string;
  value: number;
  display: string;
};

type FigureCardProps = {
  badge: string;
  title: string;
  summary: string;
  note: string;
  series: SeriesPoint[];
  variant: 'paper' | 'local';
};

const highlightStats: StatCard[] = [
  { label: 'Real trace', value: '162M packets', note: 'Published 100Gbps trace used in the paper.' },
  { label: 'Flow scale', value: '4.5M flows', note: 'Flow count reported for the real trace workload.' },
  { label: 'Topology', value: 'k=4 fat-tree', note: '16 hosts, 8 ToRs, 8 aggregation switches, 4 core switches.' },
  { label: 'Paths', value: '4 ECMP paths', note: 'Equal-cost path group used by the simulator.' },
];

const environment: EnvironmentCard[] = [
  { label: 'Traffic model', value: 'Trace-driven', note: 'Local runs can sweep numFlows, flowletTimeout, and DLAF table sizes.' },
  { label: 'Reference metrics', value: 'SDV, flowlets, throughput', note: 'Matches the paper tables and the benchmark outputs stored in the repo.' },
  { label: 'DLAF config', value: '4 hash tables x 512 buckets', note: 'Paper-style baseline used for the comparison figures.' },
  { label: 'Palette', value: 'Neutral gray + blue accent', note: 'Aligned with the report styling and the existing website UI.' },
];

const topologyFacts = [
  '4 core switches',
  '8 aggregation switches',
  '8 ToR switches',
  '16 hosts',
];

const paperFigures = [
  {
    badge: 'Figure 4',
    title: 'Real trace load balance',
    summary: 'ECMP is far above DLAF on the published real-trace SDV results.',
    note: 'The left card stays close to the report values: ECMP 729K, Flowlet 9.4K, DLAF 5.',
    series: [
      { label: 'ECMP', value: 729000, display: '729K' },
      { label: 'Flowlet', value: 9400, display: '9.4K' },
      { label: 'DLAF', value: 5, display: '5' },
    ],
  },
  {
    badge: 'Figure 5',
    title: 'Throughput comparison',
    summary: 'DLAF reaches the best published throughput in the benchmark set.',
    note: 'The paper reports about 904 kbps for DLAF versus 778 kbps for ECMP.',
    series: [
      { label: 'ECMP', value: 778, display: '778' },
      { label: 'Flowlet', value: 860, display: '860' },
      { label: 'DLAF', value: 904, display: '904' },
    ],
  },
  {
    badge: 'Table I',
    title: 'Flowlet gap sensitivity',
    summary: 'Timeout choice changes the flowlet count and the remaining imbalance.',
    note: 'Best paper flowlet result is 100 us at 9.4K SDV; the 100 ms setting drifts back toward ECMP.',
    series: [
      { label: '50 us', value: 14400, display: '14.4K' },
      { label: '100 us', value: 9400, display: '9.4K' },
      { label: '1 ms', value: 13900, display: '13.9K' },
      { label: '100 ms', value: 861000, display: '861K' },
    ],
  },
];

const localFigures = [
  { text: 'Inserted flowlet gaps chart.', src: '/results/figure2_flowlet_gaps.png' },
  { text: 'Throughput plot from the local simulator.', src: '/results/figure5_throughput.png' },
  { text: 'Custom load-balancing plot.', src: '/results/figure4_load_balancing.png' },
];

function StatCardView({ label, value, note }: StatCard) {
  return (
    <div className="rounded-2xl border border-border/80 bg-slate-950/55 p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-slate-100">{value}</div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{note}</p>
    </div>
  );
}

function EnvironmentCardView({ label, value, note }: EnvironmentCard) {
  return (
    <div className="rounded-2xl border border-border/80 bg-slate-950/55 p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-base font-semibold text-slate-100">{value}</div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{note}</p>
    </div>
  );
}

function FigureCard({ badge, title, summary, note, series, variant }: FigureCardProps) {
  const maxValue = Math.max(...series.map(item => item.value));
  return (
    <div className="rounded-3xl border border-border/80 bg-slate-950/55 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">{badge}</div>
          <h3 className="mt-2 text-lg font-semibold text-slate-100">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{summary}</p>
        </div>
        <div
          className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium ${
            variant === 'paper' ? 'border-slate-300/30 bg-slate-900/60 text-slate-300' : 'border-slate-700 bg-slate-900/80 text-slate-300'
          }`}
        >
          {variant === 'paper' ? 'Published figure' : 'Local placeholder'}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-border/70 bg-slate-950/80 p-4">
        <div
          className="grid h-40 items-end gap-3"
          style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}
        >
          {series.map(item => {
            const height = maxValue > 0 ? Math.max((item.value / maxValue) * 100, 8) : 8;
            return (
              <div key={item.label} className="flex h-full flex-col justify-end gap-2">
                <div className="relative flex h-full items-end overflow-hidden rounded-xl border border-border/70 bg-slate-900/70">
                  {variant === 'paper' ? (
                    <div
                      className="w-full rounded-t-xl bg-blue-500/75"
                      style={{ height: `${height}%` }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center px-3 text-center text-[11px] text-slate-500">
                      Empty slot
                    </div>
                  )}
                  {variant === 'paper' && (
                    <div className="absolute left-2 right-2 top-2 flex items-center justify-between gap-2 text-[10px] text-slate-300">
                      <span>{item.label}</span>
                      <span>{item.display}</span>
                    </div>
                  )}
                </div>
                <div className="text-center text-[11px] text-muted-foreground">{item.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{note}</p>
    </div>
  );
}

function LocalPlaceholder({ text, src }: { text: string; src?: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border/80 bg-slate-950/45 p-5 shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Local figure slot</div>
      <div className="mt-2 text-lg font-semibold text-slate-100">Ready for your exported plot</div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
      <div className="mt-5 rounded-2xl border border-border/70 bg-slate-950/80 p-4">
        {src ? <img src={src} alt="Local Result" className="max-h-64 object-contain rounded-xl w-full" /> : <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-border/70 text-sm text-slate-500">Insert local figure here</div>}
      </div>
    </div>
  );
}

function TopologyDiagram() {
  const cores = [
    { x: 230, y: 90, label: 'C1' },
    { x: 410, y: 90, label: 'C2' },
    { x: 590, y: 90, label: 'C3' },
    { x: 770, y: 90, label: 'C4' },
  ];

  const pods = [
    { x: 170, agg1: 'A1', agg2: 'A2', tor1: 'T1', tor2: 'T2', hostStart: 1 },
    { x: 410, agg1: 'A3', agg2: 'A4', tor1: 'T3', tor2: 'T4', hostStart: 5 },
    { x: 650, agg1: 'A5', agg2: 'A6', tor1: 'T5', tor2: 'T6', hostStart: 9 },
    { x: 890, agg1: 'A7', agg2: 'A8', tor1: 'T7', tor2: 'T8', hostStart: 13 },
  ];

  return (
    <div className="overflow-hidden rounded-3xl border border-border/80 bg-slate-950/90 p-5 shadow-sm">
      <svg viewBox="0 0 1080 560" className="h-auto w-full">
        <defs>
        </defs>

        <rect x="14" y="14" width="1052" height="532" rx="30" fill="rgba(15,23,42,0.96)" />

        <g className="fill-slate-300 text-[14px] font-medium">
          <text x="540" y="40" textAnchor="middle">DLAF k=4 fat-tree</text>
          <text x="540" y="140" textAnchor="middle">Core layer</text>
          <text x="540" y="274" textAnchor="middle">Aggregation, ToR, and host layers</text>
        </g>

        <g opacity="0.58" stroke="#64748b" strokeWidth="2">
          {pods.map(pod => (
            <g key={pod.x}>
              <line x1={pod.x} y1="212" x2={pod.x} y2="250" />
              <line x1={pod.x - 48} y1="212" x2={pod.x - 48} y2="250" />
              <line x1={pod.x + 48} y1="212" x2={pod.x + 48} y2="250" />
            </g>
          ))}
        </g>

        <g stroke="#60a5fa" strokeWidth="2.25" opacity="0.75">
          {pods.flatMap(pod =>
            cores.flatMap(core => [
              <line key={`${pod.x}-${pod.agg1}-${core.label}`} x1={pod.x - 48} y1="168" x2={core.x} y2="90" />,
              <line key={`${pod.x}-${pod.agg2}-${core.label}`} x1={pod.x + 48} y1="168" x2={core.x} y2="90" />,
            ]),
          )}
        </g>

        <g stroke="#334155" strokeWidth="2.25" opacity="0.82">
          {pods.map(pod => (
            <g key={`tors-${pod.x}`}>
              <line x1={pod.x - 48} y1="214" x2={pod.x - 48} y2="304" />
              <line x1={pod.x + 48} y1="214" x2={pod.x + 48} y2="304" />
              <line x1={pod.x - 48} y1="304" x2={pod.x - 60} y2="350" />
              <line x1={pod.x - 48} y1="304" x2={pod.x - 24} y2="350" />
              <line x1={pod.x + 48} y1="304" x2={pod.x + 24} y2="350" />
              <line x1={pod.x + 48} y1="304" x2={pod.x + 60} y2="350" />
            </g>
          ))}
        </g>

        <g>
          {cores.map(node => (
            <g key={node.label}>
              <circle cx={node.x} cy={node.y} r="20" fill="#93c5fd" />
              <text x={node.x} y={node.y + 5} textAnchor="middle" className="fill-slate-950 text-[16px] font-bold">
                {node.label}
              </text>
            </g>
          ))}

          {pods.map((pod, index) => {
            const aggNodes = [
              { x: pod.x - 48, y: 168, label: pod.agg1 },
              { x: pod.x + 48, y: 168, label: pod.agg2 },
            ];
            const torNodes = [
              { x: pod.x - 48, y: 260, label: pod.tor1 },
              { x: pod.x + 48, y: 260, label: pod.tor2 },
            ];
            const hosts = [
              { x: pod.x - 72, y: 390, label: `H${pod.hostStart}` },
              { x: pod.x - 24, y: 390, label: `H${pod.hostStart + 1}` },
              { x: pod.x + 24, y: 390, label: `H${pod.hostStart + 2}` },
              { x: pod.x + 72, y: 390, label: `H${pod.hostStart + 3}` },
            ];

            return (
              <g key={index}>
                {aggNodes.map(node => (
                  <g key={node.label}>
                    <rect x={node.x - 30} y={node.y - 22} width="60" height="44" rx="12" fill="#3b82f6" opacity="0.96" />
                    <text x={node.x} y={node.y + 5} textAnchor="middle" className="fill-white text-[15px] font-semibold">
                      {node.label}
                    </text>
                  </g>
                ))}

                {torNodes.map(node => (
                  <g key={node.label}>
                    <rect x={node.x - 30} y={node.y - 22} width="60" height="44" rx="12" fill="#0f172a" stroke="#60a5fa" strokeWidth="1.2" />
                    <text x={node.x} y={node.y + 5} textAnchor="middle" className="fill-slate-100 text-[16px] font-semibold">
                      {node.label}
                    </text>
                  </g>
                ))}

                {hosts.map(node => (
                  <g key={node.label}>
                    <circle cx={node.x} cy={node.y} r="17" fill="#1d4ed8" stroke="#93c5fd" strokeWidth="1.2" />
                    <text x={node.x} y={node.y + 4} textAnchor="middle" className="fill-white text-[11px] font-medium">
                      {node.label}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}
        </g>

        <g className="fill-slate-400 text-[12px]">
          <text x="44" y="514">Path sample: H1 -&gt; T1 -&gt; A1 -&gt; C1 -&gt; A5 -&gt; T5 -&gt; H9</text>
          <text x="744" y="514">Equal-cost routes: 4 core choices per pod pair</text>
        </g>
      </svg>

      <div className="mt-4 flex flex-wrap gap-2">
        {topologyFacts.map(item => (
          <span key={item} className="rounded-full border border-border/70 bg-slate-900/80 px-3 py-1 text-[11px] text-slate-300">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Results() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border/80 bg-slate-950/55 p-6 shadow-sm md:p-8">
        <div className="relative space-y-4">
          <div className="inline-flex rounded-full border border-border/70 bg-slate-900/70 px-4 py-1 text-sm text-slate-300">
            Results
          </div>
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div className="space-y-3">
              <h1 className="text-4xl font-bold tracking-tight text-slate-100 md:text-5xl">Paper results and local comparison</h1>
              <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
                This page keeps the published topology, the simulation setup, and the paper figures together, while leaving a clean slot
                for the plots generated locally by this project.
              </p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-slate-950/75 p-4">
              <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">What to compare</div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-300">
                <span className="rounded-full border border-border/70 bg-slate-900/80 px-3 py-1">Topology</span>
                <span className="rounded-full border border-border/70 bg-slate-900/80 px-3 py-1">Flow scale</span>
                <span className="rounded-full border border-border/70 bg-slate-900/80 px-3 py-1">Simulation env</span>
                <span className="rounded-full border border-border/70 bg-slate-900/80 px-3 py-1">Paper vs local</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {highlightStats.map(card => (
          <StatCardView key={card.label} {...card} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4 rounded-3xl border border-border/80 bg-card/70 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-100">Topology diagram</h2>
              <p className="mt-1 text-sm text-muted-foreground">A clean fat-tree view of the reference 16-host DLAF testbed.</p>
            </div>
            <div className="rounded-full border border-border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
              k=4 fat-tree
            </div>
          </div>

          <TopologyDiagram />
        </div>

        <div className="space-y-4 rounded-3xl border border-border/80 bg-card/70 p-6 shadow-sm">
          <div>
            <h2 className="text-2xl font-semibold text-slate-100">Simulation environment</h2>
            <p className="mt-1 text-sm text-muted-foreground">The setup summary shown next to the published figures.</p>
          </div>

          <div className="space-y-3">
            {environment.map(item => (
              <EnvironmentCardView key={item.label} {...item} />
            ))}
          </div>

          <div className="rounded-2xl border border-border/80 bg-slate-950/55 p-4">
            <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Key result focus</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The paper emphasizes load balance, flowlet counts, and throughput. This page keeps those metrics visible while reserving the
              right side of the comparison area for your local figures.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-100">Results comparison</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Paper figures on the left, local placeholders on the right, aligned row by row for a cleaner read.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-border/70 bg-slate-900/80 px-3 py-1 text-slate-300">Published figure</span>
            <span className="rounded-full border border-border/70 bg-slate-900/80 px-3 py-1 text-slate-300">Local placeholder</span>
          </div>
        </div>

        <div className="space-y-5">
          {paperFigures.map((figure, index) => (
            <div key={figure.title} className="grid gap-5 xl:grid-cols-2">
              <FigureCard variant="paper" {...figure} />
              <LocalPlaceholder text={localFigures[index].text} src={localFigures[index].src} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}