import { useRef, useEffect, useState, useCallback } from 'react';

export type Algo = 'ecmp' | 'flowlet' | 'dlaf';

// ─── Topology ────────────────────────────────────────────────────────────────
// Fat-tree k=4: 4 core, 8 agg, 8 ToR, 16 hosts (paper Fig. 3)
// Pods: 0=[h0-h3,t0-t1,a0-a1], 1=[h4-h7,t2-t3,a2-a3], 2=[h8-h11,t4-t5,a4-a5], 3=[h12-h15,t6-t7,a6-a7]
// Core: c0,c1 connect to agg[0] of each pod; c2,c3 connect to agg[1] of each pod

const W = 780, H = 460;
const LAYERS = { host: 410, tor: 320, agg: 210, core: 100 };
const COLORS = { core: '#3b82f6', agg: '#8b5cf6', tor: '#10b981', host: '#64748b' };
const R = { core: 14, agg: 12, tor: 11, host: 9 };

interface Node { id: string; x: number; y: number; type: keyof typeof COLORS; label: string }
interface Edge { a: string; b: string }

function buildTopo(): { nodes: Map<string, Node>; edges: Edge[] } {
  const nodes = new Map<string, Node>();
  const edges: Edge[] = [];
  const x = (i: number, n: number) => 40 + (i / (n - 1)) * (W - 80);

  // hosts: 16, evenly spaced
  for (let i = 0; i < 16; i++) nodes.set(`h${i}`, { id: `h${i}`, x: x(i, 16), y: LAYERS.host, type: 'host', label: `h${i + 1}` });
  // ToR: 8
  for (let i = 0; i < 8; i++) nodes.set(`t${i}`, { id: `t${i}`, x: x(i, 8), y: LAYERS.tor, type: 'tor', label: `t${i + 1}` });
  // Agg: 8
  for (let i = 0; i < 8; i++) nodes.set(`a${i}`, { id: `a${i}`, x: x(i, 8), y: LAYERS.agg, type: 'agg', label: `a${i + 1}` });
  // Core: 4
  for (let i = 0; i < 4; i++) nodes.set(`c${i}`, { id: `c${i}`, x: x(i, 4), y: LAYERS.core, type: 'core', label: `c${i + 1}` });

  // host → ToR (each ToR serves 2 hosts)
  for (let t = 0; t < 8; t++) { edges.push({ a: `t${t}`, b: `h${t * 2}` }); edges.push({ a: `t${t}`, b: `h${t * 2 + 1}` }); }
  // ToR → Agg (each pod: 2 ToR, 2 Agg, fully connected)
  for (let pod = 0; pod < 4; pod++) for (let a = 0; a < 2; a++) for (let t = 0; t < 2; t++)
    edges.push({ a: `a${pod * 2 + a}`, b: `t${pod * 2 + t}` });
  // Agg → Core: c0,c1 → agg[0] of each pod; c2,c3 → agg[1] of each pod
  for (let pod = 0; pod < 4; pod++) {
    edges.push({ a: 'c0', b: `a${pod * 2}` }); edges.push({ a: 'c1', b: `a${pod * 2}` });
    edges.push({ a: 'c2', b: `a${pod * 2 + 1}` }); edges.push({ a: 'c3', b: `a${pod * 2 + 1}` });
  }
  return { nodes, edges };
}

// ─── Path routing ─────────────────────────────────────────────────────────────
// Returns all 4 equal-cost paths between src and dst (different pods)
function getAllPaths(src: number, dst: number): string[][] {
  const srcTor = Math.floor(src / 2);
  const dstTor = Math.floor(dst / 2);
  const srcPod = Math.floor(src / 4);
  const dstPod = Math.floor(dst / 4);

  if (srcTor === dstTor) return [[`h${src}`, `t${srcTor}`, `h${dst}`]];

  if (srcPod === dstPod) {
    return [0, 1].map(a => [`h${src}`, `t${srcTor}`, `a${srcPod * 2 + a}`, `t${dstTor}`, `h${dst}`]);
  }

  const paths: string[][] = [];
  for (let a = 0; a < 2; a++) {
    for (let c = 0; c < 2; c++) {
      const coreIdx = a * 2 + c;
      const srcAgg = srcPod * 2 + a;
      const dstAgg = dstPod * 2 + a;
      paths.push([`h${src}`, `t${srcTor}`, `a${srcAgg}`, `c${coreIdx}`, `a${dstAgg}`, `t${dstTor}`, `h${dst}`]);
    }
  }
  return paths;
}

// ─── Animation state machine ──────────────────────────────────────────────────
type Phase =
  | { type: 'highlight_src'; node: string; tick: number }
  | { type: 'show_paths'; paths: string[][]; chosen: number; tick: number }
  | { type: 'flowlet_gap'; path: string[]; gapAt: number; tick: number }   // dashed gap
  | { type: 'travel'; path: string[]; progress: number; isFlowlet?: boolean }
  | { type: 'done'; tick: number };

function hashPath(flowId: number, numPaths: number): number {
  let h = (flowId * 2654435761) >>> 0;
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
  return h % numPaths;
}

// ─── Canvas renderer ──────────────────────────────────────────────────────────
function render(
  ctx: CanvasRenderingContext2D,
  nodes: Map<string, Node>,
  edges: Edge[],
  phase: Phase,
  plc: number[],
  pathLoads: number[],
  algo: Algo,
) {
  ctx.clearRect(0, 0, W, H);

  // Determine highlighted edges/nodes from phase
  const highlightedEdges = new Set<string>();
  const highlightedNodes = new Set<string>();
  const dimmedPaths: string[][] = [];
  let chosenPathIdx = -1;
  let packetPos: { x: number; y: number; isDashed?: boolean } | null = null;

  if (phase.type === 'highlight_src') {
    highlightedNodes.add(phase.node);
  }
  if (phase.type === 'show_paths') {
    chosenPathIdx = phase.chosen;
    phase.paths.forEach((path, pi) => {
      if (pi === phase.chosen) {
        for (let i = 0; i < path.length - 1; i++) {
          highlightedEdges.add(`${path[i]}-${path[i + 1]}`);
          highlightedEdges.add(`${path[i + 1]}-${path[i]}`);
          highlightedNodes.add(path[i]);
          highlightedNodes.add(path[i + 1]);
        }
      } else {
        dimmedPaths.push(path);
      }
    });
  }
  if (phase.type === 'travel' || phase.type === 'flowlet_gap') {
    const path = phase.type === 'travel' ? phase.path : phase.path;
    for (let i = 0; i < path.length - 1; i++) {
      highlightedEdges.add(`${path[i]}-${path[i + 1]}`);
      highlightedEdges.add(`${path[i + 1]}-${path[i]}`);
    }
    path.forEach(n => highlightedNodes.add(n));

    if (phase.type === 'travel') {
      const totalEdges = path.length - 1;
      const globalProg = phase.progress * totalEdges;
      const edgeIdx = Math.min(Math.floor(globalProg), totalEdges - 1);
      const edgeProg = globalProg - edgeIdx;
      const a = nodes.get(path[edgeIdx])!;
      const b = nodes.get(path[edgeIdx + 1])!;
      packetPos = { x: a.x + (b.x - a.x) * edgeProg, y: a.y + (b.y - a.y) * edgeProg };
    }
    if (phase.type === 'flowlet_gap') {
      // Show packet frozen at gap point with dashed line ahead
      const gapNode = nodes.get(phase.path[phase.gapAt])!;
      packetPos = { x: gapNode.x, y: gapNode.y, isDashed: true };
    }
  }

  // Draw edges
  for (const edge of edges) {
    const a = nodes.get(edge.a)!;
    const b = nodes.get(edge.b)!;
    const key1 = `${edge.a}-${edge.b}`;
    const isHighlighted = highlightedEdges.has(key1);
    const isDimmed = dimmedPaths.some(p => {
      for (let i = 0; i < p.length - 1; i++) if (p[i] === edge.a && p[i + 1] === edge.b) return true;
      return false;
    });

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);

    if (isHighlighted) {
      ctx.strokeStyle = algo === 'ecmp' ? '#f97316' : algo === 'flowlet' ? '#eab308' : '#22c55e';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
    } else if (isDimmed) {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
    } else {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw flowlet gap dashes (remaining path after gap)
  if (phase.type === 'flowlet_gap') {
    const path = phase.path;
    for (let i = phase.gapAt; i < path.length - 1; i++) {
      const a = nodes.get(path[i])!;
      const b = nodes.get(path[i + 1])!;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Draw nodes
  for (const node of nodes.values()) {
    const r = R[node.type];
    const isHighlighted = highlightedNodes.has(node.id);

    // Glow for highlighted
    if (isHighlighted) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 5, 0, Math.PI * 2);
      ctx.fillStyle = algo === 'ecmp' ? 'rgba(249,115,22,0.2)' : algo === 'flowlet' ? 'rgba(234,179,8,0.2)' : 'rgba(34,197,94,0.2)';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.fillStyle = isHighlighted
      ? (algo === 'ecmp' ? '#f97316' : algo === 'flowlet' ? '#eab308' : '#22c55e')
      : COLORS[node.type];
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    ctx.fillStyle = node.type === 'host' ? '#94a3b8' : '#fff';
    ctx.font = `bold ${node.type === 'host' ? 8 : 9}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = node.type === 'host' ? 'top' : 'middle';
    ctx.fillText(node.label, node.x, node.type === 'host' ? node.y + r + 2 : node.y);
  }

  // Draw packet dot
  if (packetPos) {
    if (packetPos.isDashed) {
      // Pulsing "waiting" dot
      ctx.beginPath();
      ctx.arc(packetPos.x, packetPos.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(234,179,8,0.3)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(packetPos.x, packetPos.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#eab308';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(packetPos.x, packetPos.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = algo === 'ecmp' ? '#f97316' : algo === 'flowlet' ? '#eab308' : '#22c55e';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // Draw path index labels on show_paths phase
  if (phase.type === 'show_paths' && phase.paths.length > 1) {
    phase.paths.forEach((path, pi) => {
      const midNode = nodes.get(path[Math.floor(path.length / 2)])!;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = pi === phase.chosen
        ? (algo === 'ecmp' ? '#f97316' : algo === 'flowlet' ? '#eab308' : '#22c55e')
        : '#475569';
      ctx.fillText(`P${pi + 1}`, midNode.x + 12, midNode.y - 12);
    });
  }

  // PLC table overlay (DLAF only)
  if (algo === 'dlaf' && plc.length > 0) {
    const tw = 110, th = plc.length * 18 + 28;
    const tx = W - tw - 8, ty = 8;
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Port Load Counters', tx + 6, ty + 12);
    plc.forEach((v, i) => {
      const barW = Math.min(70, v * 3);
      const rowY = ty + 22 + i * 18;
      ctx.fillStyle = i === chosenPathIdx ? '#22c55e' : '#334155';
      ctx.fillRect(tx + 6, rowY, barW, 12);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px monospace';
      ctx.fillText(`P${i + 1}: ${v}`, tx + 6 + barW + 3, rowY + 9);
    });
  }

  // Path load table (ECMP/Flowlet)
  if (algo !== 'dlaf' && pathLoads.some(v => v > 0)) {
    const tw = 100, th = pathLoads.length * 18 + 28;
    const tx = W - tw - 8, ty = 8;
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.strokeStyle = algo === 'ecmp' ? '#f97316' : '#eab308';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = algo === 'ecmp' ? '#f97316' : '#eab308';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Path Loads', tx + 6, ty + 12);
    const maxLoad = Math.max(...pathLoads, 1);
    pathLoads.forEach((v, i) => {
      const barW = Math.min(60, (v / maxLoad) * 60);
      const rowY = ty + 22 + i * 18;
      ctx.fillStyle = algo === 'ecmp' ? '#f97316' : '#eab308';
      ctx.globalAlpha = 0.6;
      ctx.fillRect(tx + 6, rowY, barW, 12);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px monospace';
      ctx.fillText(`P${i + 1}: ${v}`, tx + 6 + barW + 3, rowY + 9);
    });
  }
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props { algo: Algo; running: boolean; speed: number }

export default function NetworkCanvas({ algo, running, speed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { nodes, edges } = useRef(buildTopo()).current;

  // Shared state (mutable, not React state — lives in ref for animation loop)
  const stateRef = useRef({
    plc: [0, 0, 0, 0] as number[],
    pathLoads: [0, 0, 0, 0] as number[],
    flowId: 0,
    flowletMap: new Map<string, { path: string[]; lastTick: number }>(),
    tick: 0,
    phase: null as Phase | null,
  });

  // React state for the explanation panel (updated from animation loop)
  const [step, setStep] = useState('');
  const [loadSnapshot, setLoadSnapshot] = useState<number[]>([0, 0, 0, 0]);

  const nextFlow = useCallback(() => {
    const s = stateRef.current;
    const src = Math.floor(Math.random() * 16);
    let dst = Math.floor(Math.random() * 16);
    while (Math.floor(dst / 4) === Math.floor(src / 4)) dst = Math.floor(Math.random() * 16); // force cross-pod
    const allPaths = getAllPaths(src, dst);
    const flowKey = `${src}-${dst}`;
    s.flowId++;

    if (algo === 'ecmp') {
      const chosen = hashPath(s.flowId, allPaths.length);
      s.pathLoads[chosen]++;
      s.phase = { type: 'highlight_src', node: `h${src}`, tick: s.tick };
      setTimeout(() => {
        s.phase = { type: 'show_paths', paths: allPaths, chosen, tick: s.tick };
        setStep(`Flow #${s.flowId}: hash(5-tuple) = ${chosen} → Path ${chosen + 1} selected (always same path)`);
        setTimeout(() => {
          s.phase = { type: 'travel', path: allPaths[chosen], progress: 0 };
          setLoadSnapshot([...s.pathLoads]);
        }, 900 / speed);
      }, 600 / speed);

    } else if (algo === 'flowlet') {
      const existing = s.flowletMap.get(flowKey);
      const gap = existing ? s.tick - existing.lastTick : Infinity;
      const isNewFlowlet = gap > 40 / speed;
      const chosen = isNewFlowlet ? Math.floor(Math.random() * allPaths.length) : (existing ? allPaths.indexOf(existing.path) : 0);
      const safeChosen = Math.max(0, chosen);
      s.flowletMap.set(flowKey, { path: allPaths[safeChosen], lastTick: s.tick });
      s.pathLoads[safeChosen]++;

      if (isNewFlowlet && existing) {
        // Show gap: packet pauses, then reroutes
        s.phase = { type: 'flowlet_gap', path: existing.path, gapAt: Math.floor(existing.path.length / 2), tick: s.tick };
        setStep(`Flowlet gap detected (gap=${gap.toFixed(0)} ticks > threshold) → new flowlet, rerouting to Path ${safeChosen + 1}`);
        setTimeout(() => {
          s.phase = { type: 'show_paths', paths: allPaths, chosen: safeChosen, tick: s.tick };
          setTimeout(() => {
            s.phase = { type: 'travel', path: allPaths[safeChosen], progress: 0, isFlowlet: true };
            setLoadSnapshot([...s.pathLoads]);
          }, 700 / speed);
        }, 800 / speed);
      } else {
        s.phase = { type: 'show_paths', paths: allPaths, chosen: safeChosen, tick: s.tick };
        setStep(`Flow #${s.flowId}: ${isNewFlowlet ? 'new flow' : 'same flowlet'} → Path ${safeChosen + 1}`);
        setTimeout(() => {
          s.phase = { type: 'travel', path: allPaths[safeChosen], progress: 0 };
          setLoadSnapshot([...s.pathLoads]);
        }, 800 / speed);
      }

    } else {
      // DLAF: pick least-loaded path
      const chosen = s.plc.indexOf(Math.min(...s.plc));
      s.plc[chosen]++;
      s.pathLoads[chosen]++;
      s.phase = { type: 'highlight_src', node: `h${src}`, tick: s.tick };
      setStep(`Flow #${s.flowId}: PLC = [${s.plc.join(', ')}] → min at P${chosen + 1} → selected`);
      setTimeout(() => {
        s.phase = { type: 'show_paths', paths: allPaths, chosen, tick: s.tick };
        setTimeout(() => {
          s.phase = { type: 'travel', path: allPaths[chosen], progress: 0 };
          setLoadSnapshot([...s.plc]);
        }, 900 / speed);
      }, 600 / speed);
    }
  }, [algo, speed]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const s = stateRef.current;
    // Reset on algo change
    s.plc = [0, 0, 0, 0];
    s.pathLoads = [0, 0, 0, 0];
    s.flowId = 0;
    s.flowletMap.clear();
    s.phase = null;
    s.tick = 0;
    setLoadSnapshot([0, 0, 0, 0]);
    setStep('');

    let animId: number;
    let lastSpawn = 0;
    const SPAWN_INTERVAL = 120; // frames between flows

    function loop(_ts: number) {
      s.tick++;
      const phase = s.phase;

      // Advance travel phase
      if (phase?.type === 'travel') {
        phase.progress += 0.012 * speed;
        if (phase.progress >= 1) {
          s.phase = { type: 'done', tick: s.tick };
        }
      }

      // Spawn next flow
      if (running && (!phase || phase.type === 'done') && s.tick - lastSpawn > SPAWN_INTERVAL / speed) {
        lastSpawn = s.tick;
        nextFlow();
      }

      render(ctx, nodes, edges, s.phase ?? { type: 'done', tick: 0 }, s.plc, s.pathLoads, algo);
      animId = requestAnimationFrame(loop);
    }

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [algo, running, speed, nodes, edges, nextFlow]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border overflow-hidden bg-slate-950">
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ maxHeight: 460 }} />
      </div>
      {/* Step explanation */}
      {step && (
        <div className={`rounded-lg px-4 py-2.5 text-sm border font-mono ${
          algo === 'ecmp' ? 'border-orange-500/30 bg-orange-500/5 text-orange-300'
          : algo === 'flowlet' ? 'border-yellow-500/30 bg-yellow-500/5 text-yellow-300'
          : 'border-green-500/30 bg-green-500/5 text-green-300'
        }`}>
          {step}
        </div>
      )}
      {/* Load bar */}
      <div className="flex gap-2 items-center">
        <span className="text-xs text-muted-foreground w-20 shrink-0">
          {algo === 'dlaf' ? 'PLC' : 'Path loads'}:
        </span>
        {loadSnapshot.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, (v / (Math.max(...loadSnapshot, 1))) * 100)}%`,
                  background: algo === 'ecmp' ? '#f97316' : algo === 'flowlet' ? '#eab308' : '#22c55e',
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground">P{i + 1}: {v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
