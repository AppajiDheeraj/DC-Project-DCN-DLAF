# Methodology

## Experimental Setup

**Topology**: k=4 fat-tree (2-tier Clos network)
- 4 core switches
- 8 aggregation switches (2 per pod)
- 8 ToR switches (1 per pod)
- 16 hosts (2 per ToR)
- Each link: 10 Gbps (simulated)

**Traffic Traces**:
1. **Real Trace** (from paper): 162M packets from production 100 Gbps datacenter
   - 4.5M flows
   - Duration: 10 seconds
2. **Synthetic Workload**: Zipf-distributed flow sizes (α = 1.2)
   - Mix of mice (< 1 MB) and elephant flows (> 100 MB)
   - Uniform random start times

## Algorithm Implementations

### ECMP (Baseline)
- Path selection: Hash(5-tuple) → static path
- Behavior: Flows remain on selected path regardless of congestion
- Hash function: CRC32 for consistency

### Flowlet Switching
- Detects flowlet boundaries via inter-packet gap timeout
- Timeouts tested: 50µs, 100µs, 1ms, 100ms
- Behavior: Re-hash on new flowlet, but ignores link congestion
- Load tracking: None (uses original ECMP hash)

### DLAF (Dynamic Load-Aware Flowlet)
- Combines flowlet detection with load awareness
- Hash tables: 4 independent tables × 512 buckets
- Per-bucket state: {flowlet_timestamp, selected_path, age}
- Path selection: Least-loaded core switch among ECMP choices
- Timeout: 100µs (paper's optimal value)
- Load tracking: Per-core switch counters with decay

## Evaluation Metrics

### Primary Metrics
1. **Path Load Balance** (Figure 4)
   - Measure: Standard deviation (SDV) of loads across all paths
   - Lower SDV = better balance
   - ECMP baseline: ~729K (worst)
   - Flowlet best: ~9.4K (50µs timeout)
   - DLAF: ~5 (best)

2. **Throughput Efficiency** (Figure 5)
   - Measure: Goodput / raw link capacity
   - ECMP: 778 kbps
   - Flowlet: 860 kbps
   - DLAF: 904 kbps (+16% vs ECMP)

3. **Flowlet Gap Sensitivity** (Table I)
   - Measure: Flowlet count and gap distribution
   - Timeout impact: Too short → many flowlets, too long → lost load-awareness
   - Optimal: 100µs

### Secondary Metrics
- Per-flow completion time
- Maximum link utilization
- Flowlet gap percentiles (p50, p99, p100)
- Memory overhead (hash table occupancy)

## Testing Environment

**Hypervisor**: Orbstack (lightweight macOS VM)
**Guest OS**: Ubuntu 22.04 LTS (Jammy)
**P4 Runtime**: BMv2 (Software switch)
**Packet Generator**: MoonGen or custom DPDK client
**Trace Replay**: tcpreplay with custom flow timing

## Experimental Procedure

1. **Topology Setup**
   - Load fat-tree configuration from `topology.json`
   - Initialize switch hash tables and load counters
   - Connect all P4 switches via virtual links

2. **Traffic Injection**
   - Parse traffic trace (real or synthetic)
   - Generate flow start events in order
   - Send packets according to flow size and timing

3. **Data Collection**
   - Record path selection for each packet
   - Track per-path byte counters
   - Monitor switch CPU/memory utilization
   - Capture sample packets for PCAP analysis

4. **Metrics Computation**
   - Aggregate per-path loads
   - Calculate standard deviation
   - Count flowlet transitions
   - Extract flowlet gap percentiles

5. **Comparison & Visualization**
   - Generate bar charts for each metric
   - Compute improvement %: (baseline - algorithm) / baseline × 100
   - Export results as CSV and PNG for web display

## Fairness Considerations

- All algorithms process the **same** traffic trace
- Packet ordering preserved (deterministic simulation)
- Equal link capacities across topology
- No packet loss (unlimited buffer simulation)
- Timeout values held constant across runs (except sensitivity study)
