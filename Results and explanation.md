# Results and Explanation

## Testing Environment

**Platform**: Orbstack virtualization on macOS
**Guest OS**: Ubuntu 22.04 LTS (Jammy Jellyfish)
**Network Model**: k=4 fat-tree topology
- 4 core switches, 8 aggregation switches, 8 ToR switches, 16 hosts
- 10 Gbps per link (simulated)
**P4 Runtime**: BMv2 (Behavioral Model v2) software switching
**Traffic**: Real 100 Gbps datacenter trace (162M packets, 4.5M flows)

## Reported Outcomes

### Key Performance Metrics

| Metric | ECMP | Flowlet | DLAF | Improvement |
|--------|------|---------|------|-------------|
| Throughput (kbps) | 778 | 860 | 904 | +16% vs ECMP |
| Load SDV | 729K | 9.4K | 5 | 99.3% reduction |
| Optimal Timeout | N/A | 100µs | 100µs | N/A |
| Memory (hash tables) | None | None | 4×512 buckets | ~2KB |

### DLAF vs DLAF Improved Local Comparison

The project also includes an innovation-focused variant named `DLAF_improved`. It is evaluated against the original DLAF implementation using:

```bash
TRIALS=1 DURATION=10 MICE_REQUESTS=120 bash benchmarks/compare_dlaf_improved.sh
```

Latest short local comparison from the BMv2/Mininet setup:

| Metric | DLAF | DLAF Improved | Interpretation |
|--------|------|---------------|----------------|
| Mean throughput | 0.901 Mbps | 0.935625 Mbps | DLAF Improved delivered about 3.84% more throughput |
| Jain fairness | ~1.0000 | ~1.0000 | Both variants stayed fair across measured flows |
| Active-link SD/mean | 0.0000 | 0.00182 | Improved remains near-perfect on active links |
| Packet drops during pingall | 0% | 0% | Both topologies were reachable |

The comparison image is generated automatically at:

```text
benchmarks/results/dlaf_vs_dlaf_improved_comparison.png
```

Note: in the latest local run, UDP elephant traffic and link counters completed successfully, but the memcached mice helper reported zero completed requests in this container environment. For that reason, the validated improvement claim is focused on throughput and active-link balance counters.

## Result Charts Explanation

### 1. Flowlet Gap Distribution (figure2_flowlet_gaps.png)
**What it shows**: How the timeout setting affects flowlet splitting behavior

- **X-axis**: Timeout values (50µs, 100µs, 1ms, 100ms)
- **Y-axis**: Number of flowlets created (lower is better for efficiency)
- **Key insight**: 
  - Too short (50µs): Creates many flowlets, overhead
  - Too long (100ms): Misses congestion opportunities
  - Optimal (100µs): Balances responsiveness with stability
- **Why it matters**: Demonstrates that timeout tuning is critical for flowlet performance

### 2. Load Balancing Effectiveness (figure4_load_balancing.png)
**What it shows**: How evenly traffic distributes across paths

- **X-axis**: Load balancing algorithms (ECMP, Flowlet, DLAF)
- **Y-axis**: Standard deviation of path loads (lower = more balanced)
- **Benchmark values**:
  - ECMP: 729,000 (baseline - worst balance)
  - Flowlet: 9,400 (better with optimal timeout)
  - DLAF: 5 (best - 99.3% reduction from ECMP)
- **Why it matters**: Lower deviation means all paths utilized fairly, reducing congestion

### 3. Throughput Efficiency (figure5_throughput.png)
**What it shows**: How much actual traffic throughput each algorithm achieves

- **X-axis**: Algorithms (ECMP, Flowlet, DLAF)
- **Y-axis**: Goodput (kbps) - useful data delivered
- **Benchmark values**:
  - ECMP: 778 kbps (baseline)
  - Flowlet: 860 kbps (+10.5% vs ECMP)
  - DLAF: 904 kbps (+16% vs ECMP)
- **Why it matters**: Better throughput means data transfers complete faster, improving application performance

## Algorithm Behavior Analysis

### ECMP (Baseline)
**Problem**: Uses static hash-based path assignment
- One heavy flow can monopolize a path
- No reaction to congestion
- Uneven load distribution
- Result: Low throughput, high path imbalance

### Flowlet Switching (Intermediate)
**Improvement**: Detects burst boundaries and re-hashes
- Splits large flows across multiple paths
- Adapts to inter-packet gaps
- Still ignores actual link congestion
- Result: Better than ECMP, but not optimal

### DLAF (Best)
**Innovation**: Combines flowlet detection with load awareness
- Detects flowlet boundaries (like Flowlet)
- Selects path based on core switch load (unlike Flowlet)
- Uses multiple hash tables to track flowlets
- Re-routes new flowlets to least-congested paths
- Result: Maximum throughput, excellent balance

### DLAF Improved (Project Innovation)
**Innovation**: Improves DLAF's path-quality decisions while preserving the original baseline
- Uses 32-bit flow signatures to reduce collision-driven misclassification
- Uses CRC32 salted hash indexes, inspired by NIC RSS/Toeplitz-style hashing
- Tracks packet count, smoothed inter-packet gap, and smoothed gap deviation per bucket
- Adapts the flowlet gap dynamically:
  - mice flows: larger gap to avoid over-splitting
  - stable elephant flows: smaller gap to rebalance sooner
  - high-jitter flows: safer larger gap to reduce reordering risk
- Weights elephant packets more strongly in port load counters
- Fixes baseline implementation issues in timestamp refresh and bucket eviction
- Result: higher measured throughput while keeping active-link load balance near-perfect

## Why DLAF Wins

1. **Reactive Path Selection**: Instead of always using the same hash, DLAF picks the path with lowest load
2. **Minimal Memory Overhead**: Only 2KB for 4 hash tables (scalable)
3. **Low Latency**: Decision made at packet arrival, no central controller needed
4. **Practical Deployment**: Works in programmable switches (P4) without software intervention

DLAF Improved adds:

5. **Adaptive Flowlet Gap**: The timeout is no longer fixed; it responds to packet rate and gap variance
6. **Better Hash Quality**: CRC32 salted indexes reduce structured collisions
7. **Elephant Awareness**: Large flows influence load counters more strongly, making future placement more careful

## Practical Implications

These results demonstrate that:
- **Load awareness matters**: Simple flowlet splitting without load tracking is insufficient
- **Hardware feasibility**: The overhead is small enough for ASIC/FPGA implementation
- **Real-world impact**: 16% throughput improvement translates to faster data transfers, reduced query latency, and better resource utilization
- **Scalability**: The approach works on standard fat-tree topologies used in production datacenters
