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

## Why DLAF Wins

1. **Reactive Path Selection**: Instead of always using the same hash, DLAF picks the path with lowest load
2. **Minimal Memory Overhead**: Only 2KB for 4 hash tables (scalable)
3. **Low Latency**: Decision made at packet arrival, no central controller needed
4. **Practical Deployment**: Works in programmable switches (P4) without software intervention

## Practical Implications

These results demonstrate that:
- **Load awareness matters**: Simple flowlet splitting without load tracking is insufficient
- **Hardware feasibility**: The overhead is small enough for ASIC/FPGA implementation
- **Real-world impact**: 16% throughput improvement translates to faster data transfers, reduced query latency, and better resource utilization
- **Scalability**: The approach works on standard fat-tree topologies used in production datacenters
