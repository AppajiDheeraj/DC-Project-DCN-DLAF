import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const features = [
  {
    to: '/concepts',
    title: 'Concept Explorer',
    desc: 'Understand ECMP, Flowlet, and DLAF with plain-English explanations and step-by-step breakdowns.',
  },
  {
    to: '/simulator',
    title: 'Simulation Walkthrough',
    desc: 'Step through 37 slides covering every algorithm in detail — from hash computation to load-aware path selection.',
  },
  {
    to: '/p4',
    title: 'P4 Implementation',
    desc: 'Explore the actual P4 code used to implement DLAF on programmable switches in a Mininet fat-tree topology.',
  },
];

const stats = [
  { label: 'DLAF Throughput', value: '904 kbps', sub: 'vs 778 kbps ECMP (+16%)' },
  { label: 'Load Std Dev (SDV)', value: '5', sub: 'vs 729K for ECMP — near-perfect balance' },
  { label: 'Memory', value: '~33 KB', sub: '4 × 1024 buckets, P4 registers' },
];

export default function Home() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <div className="text-center space-y-5 pt-8">
        <div className="inline-block rounded-full bg-blue-500/10 border border-blue-500/20 px-4 py-1 text-sm text-blue-400 font-medium">
          IEEE IPCCC 2023 — Song, Song, Qian
        </div>
        <h1 className="text-5xl font-bold tracking-tight leading-tight">
          Interactive Data Center<br />
          <span className="text-blue-500">Load Balancing Lab</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
          Explore, simulate, and understand ECMP, Flowlet, and DLAF —
          the algorithms that keep data center traffic balanced.
          Based on the DLAF paper published at IEEE IPCCC 2023.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Button asChild size="lg">
            <Link to="/simulator">Explore Simulator</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/concepts">Learn the Concepts</Link>
          </Button>
        </div>
      </div>

      {/* Stats from paper */}
      <div className="grid grid-cols-3 gap-4 rounded-xl border border-border bg-muted/30 p-6">
        {stats.map(({ label, value, sub }) => (
          <div key={label} className="text-center">
            <div className="text-3xl font-bold text-blue-500">{value}</div>
            <div className="font-medium mt-1 text-sm">{label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Feature cards — no emojis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {features.map(({ to, title, desc }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-xl border border-border p-5 hover:border-blue-500/50 hover:bg-muted/40 transition-all"
          >
            <div className="font-semibold text-lg group-hover:text-blue-400 transition-colors">{title}</div>
            <div className="text-sm text-muted-foreground mt-2 leading-relaxed">{desc}</div>
          </Link>
        ))}
      </div>

      {/* Paper credit */}
      <div className="text-center text-xs text-muted-foreground border-t border-border pt-6 space-y-1">
        <div>
          <em>"Dynamic and Load-Aware Flowlet for Load-Balancing in Data Center Networks"</em>
        </div>
        <div>Carol K. Song, Haoyu Song, Chen Qian — IEEE IPCCC 2023</div>
        <div className="font-mono">DOI: 10.1109/IPCCC59175.2023.10253875</div>
      </div>
    </div>
  );
}
