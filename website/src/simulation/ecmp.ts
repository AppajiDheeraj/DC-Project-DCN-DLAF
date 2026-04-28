import type { SimConfig, SimResult } from './types';
import { generateFlows, computeStdDev, hashFlow } from './types';

// ECMP: hash(flowID) % numPaths — all packets of a flow go to same path
export function runECMP(cfg: SimConfig): SimResult {
  const flows = generateFlows(cfg);
  const pathLoads = new Array(cfg.numPaths).fill(0);

  for (const flow of flows) {
    const path = hashFlow(flow.id, 0, cfg.numPaths);
    pathLoads[path] += flow.size;
  }

  return {
    pathLoads,
    stdDev: computeStdDev(pathLoads),
    numFlowlets: flows.length,
    avgFlowletGap: 0,
    minFlowletGap: 0,
    maxFlowletGap: 0,
  };
}
