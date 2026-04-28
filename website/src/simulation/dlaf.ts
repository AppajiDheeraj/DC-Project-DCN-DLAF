import type { SimConfig, SimResult } from './types';
import { generateFlows, computeStdDev, hashFlow } from './types';

// DLAF: Algorithm 1 from the paper
// k hash tables, each with n buckets: { flowSig, timestamp, ecmpIndex }
// PLC: m counters tracking load per path
// For each packet:
//   - compute k bucket addresses
//   - if flow sig found: use stored ecmpIndex (or reassign if gap > timeout)
//   - if not found: evict oldest bucket, assign least-loaded path

interface Bucket {
  flowSig: number;
  ts: number;       // sequence number (paper optimization: use seq# not wall clock)
  ecmpIndex: number;
}

export function runDLAF(cfg: SimConfig): SimResult {
  const k = cfg.numHashTables ?? 4;
  const n = cfg.bucketsPerTable ?? 512;
  const m = cfg.numPaths;
  const timeout = cfg.dlafTimeout ?? 10; // ms
  const usePLC = cfg.usePLC !== false;

  // k hash tables, each with n buckets
  const tables: Bucket[][] = Array.from({ length: k }, () =>
    Array.from({ length: n }, () => ({ flowSig: -1, ts: 0, ecmpIndex: 0 }))
  );

  // Port Load Counters
  const PLC = new Array(m).fill(0);

  const flows = generateFlows(cfg);
  const pathLoads = new Array(m).fill(0);

  let seqNum = 0;
  let numFlowlets = 0;
  const gaps: number[] = [];

  // Simulate packet-by-packet for each flow
  for (const flow of flows) {
    let t = flow.startTime;
    let packetsLeft = flow.size;

    while (packetsLeft > 0) {
      const burstSize = Math.min(packetsLeft, Math.floor(Math.random() * 20) + 1);
      seqNum++;

      // Compute k bucket addresses and flow signature
      const addrs = Array.from({ length: k }, (_, i) => hashFlow(flow.id, i * 1000, n));
      const flowSig = hashFlow(flow.id, 9999, 65535);

      // Search all k buckets for matching flow signature
      let foundTable = -1;
      for (let i = 0; i < k; i++) {
        if (tables[i][addrs[i]].flowSig === flowSig) {
          foundTable = i;
          break;
        }
      }

      let ecmpIndex: number;

      if (foundTable >= 0) {
        const bucket = tables[foundTable][addrs[foundTable]];
        const gap = t - bucket.ts;

        if (gap >= timeout) {
          // Timeout exceeded: new flowlet, pick least-loaded path
          ecmpIndex = usePLC ? leastLoaded(PLC) : hashFlow(flow.id, seqNum, m);
          gaps.push(gap);
          numFlowlets++;
          bucket.ecmpIndex = ecmpIndex;
        } else {
          ecmpIndex = bucket.ecmpIndex;
        }
        bucket.ts = t;
      } else {
        // Flow not found: evict oldest bucket across all k candidates
        let oldestTable = 0;
        let oldestTs = tables[0][addrs[0]].ts;
        for (let i = 1; i < k; i++) {
          if (tables[i][addrs[i]].ts < oldestTs) {
            oldestTs = tables[i][addrs[i]].ts;
            oldestTable = i;
          }
        }

        // New flowlet
        ecmpIndex = usePLC ? leastLoaded(PLC) : hashFlow(flow.id, seqNum, m);
        numFlowlets++;

        const evicted = tables[oldestTable][addrs[oldestTable]];
        if (evicted.flowSig !== -1) gaps.push(t - evicted.ts);

        tables[oldestTable][addrs[oldestTable]] = { flowSig, ts: t, ecmpIndex };
      }

      // Update PLC and path loads
      PLC[ecmpIndex] += burstSize;
      // Reset PLC on overflow (paper: reset all when any overflows)
      if (PLC[ecmpIndex] > 65535) PLC.fill(0);

      pathLoads[ecmpIndex] += burstSize;
      packetsLeft -= burstSize;
      t += Math.random() * timeout * 2;
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

function leastLoaded(plc: number[]): number {
  let minIdx = 0;
  for (let i = 1; i < plc.length; i++) {
    if (plc[i] < plc[minIdx]) minIdx = i;
  }
  return minIdx;
}
