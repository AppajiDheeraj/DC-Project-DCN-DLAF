import type { SimConfig, SimResult } from './types';
import { generateFlows, computeStdDev, hashFlow } from './types';

// Flowlet: split flows into flowlets based on inter-packet gap > timeout
// Each new flowlet is randomly re-hashed to a new path
export function runFlowlet(cfg: SimConfig): SimResult {
  const timeout = cfg.flowletTimeout ?? 50; // ms
  const flows = generateFlows(cfg);
  const pathLoads = new Array(cfg.numPaths).fill(0);

  // flow table: flowId -> { path, lastSeen }
  const flowTable = new Map<number, { path: number; lastSeen: number }>();

  let numFlowlets = 0;
  const gaps: number[] = [];

  for (const flow of flows) {
    // Simulate packets arriving with random inter-packet gaps
    let t = flow.startTime;
    let packetsLeft = flow.size;

    while (packetsLeft > 0) {
      const burstSize = Math.min(packetsLeft, Math.floor(Math.random() * 20) + 1);
      const entry = flowTable.get(flow.id);
      const gap = entry ? t - entry.lastSeen : Infinity;

      if (!entry || gap > timeout) {
        // New flowlet: pick new path
        const newPath = hashFlow(flow.id, numFlowlets, cfg.numPaths);
        flowTable.set(flow.id, { path: newPath, lastSeen: t });
        numFlowlets++;
        if (entry) gaps.push(gap);
      } else {
        flowTable.get(flow.id)!.lastSeen = t;
      }

      const path = flowTable.get(flow.id)!.path;
      pathLoads[path] += burstSize;
      packetsLeft -= burstSize;
      t += Math.random() * timeout * 2; // random inter-burst gap
    }
  }

  return {
    pathLoads,
    stdDev: computeStdDev(pathLoads),
    numFlowlets,
    avgFlowletGap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0,
    minFlowletGap: gaps.length ? Math.min(...gaps) : 0,
    maxFlowletGap: gaps.length ? Math.max(...gaps) : 0,
  };
}
