export interface SimConfig {
  numFlows: number;
  numPaths: number;           // m = ECMP group size
  flowSizeDistribution: 'uniform' | 'zipf';
  zipfAlpha?: number;
  // Flowlet
  flowletTimeout?: number;    // ms
  // DLAF
  numHashTables?: number;     // k
  bucketsPerTable?: number;   // n
  dlafTimeout?: number;       // ms (default 10ms per paper)
  usePLC?: boolean;
}

export interface SimResult {
  pathLoads: number[];        // packet count per path
  stdDev: number;             // load imbalance (SDV in paper)
  numFlowlets: number;
  avgFlowletGap: number;      // ms
  minFlowletGap: number;
  maxFlowletGap: number;
}

export interface Flow {
  id: number;
  size: number;               // packet count
  startTime: number;          // ms
}

// Generate flows with Zipf or uniform size distribution
export function generateFlows(cfg: SimConfig): Flow[] {
  const flows: Flow[] = [];
  for (let i = 0; i < cfg.numFlows; i++) {
    const size = cfg.flowSizeDistribution === 'zipf'
      ? zipfSample(cfg.numFlows, cfg.zipfAlpha ?? 1.005)
      : Math.floor(Math.random() * 1000) + 1;
    flows.push({ id: i, size, startTime: Math.random() * 1000 });
  }
  return flows;
}

function zipfSample(n: number, alpha: number): number {
  // Rejection sampling for Zipf
  const harmonic = Array.from({ length: n }, (_, i) => 1 / Math.pow(i + 1, alpha))
    .reduce((a, b) => a + b, 0);
  const r = Math.random() * harmonic;
  let cumulative = 0;
  for (let i = 1; i <= n; i++) {
    cumulative += 1 / Math.pow(i, alpha);
    if (cumulative >= r) return i;
  }
  return n;
}

export function computeStdDev(loads: number[]): number {
  const mean = loads.reduce((a, b) => a + b, 0) / loads.length;
  const variance = loads.reduce((s, v) => s + (v - mean) ** 2, 0) / loads.length;
  return Math.sqrt(variance);
}

// Simple multiplicative hash for flow IDs
export function hashFlow(flowId: number, seed: number, mod: number): number {
  let h = (flowId * 2654435761 + seed * 40503) >>> 0;
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h % mod;
}
