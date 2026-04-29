# Architecture

The project is organized into three layers.

## 1. Presentation Layer

The `website/` application exposes the paper content through pages for concepts, simulation walkthroughs, and P4 implementation notes. This layer helps users move from theory to experiment without switching tools.

## 2. Simulation Layer

The `simulation/` folder contains the algorithm models for ECMP, Flowlet, DLAF, and the project innovation variant `DLAF_improved`. Each model produces path-load results that can be compared using the same metrics, making the algorithms directly comparable.

Important P4 files:

- `simulation/ecmp_switching.p4`: static ECMP baseline
- `simulation/flowlet_switching.p4`: fixed-timeout flowlet baseline
- `simulation/dlaf_4hash.p4`: original 4-hash DLAF with port load counters
- `simulation/dlaf_improved.p4`: improved DLAF variant with adaptive gap logic, stronger hashing, and elephant-flow awareness

## 3. Data and Evaluation Layer

Each simulation run produces:

- path loads
- load imbalance measured by standard deviation
- active-link load imbalance measured by SD/mean over links that carried traffic
- number of flowlets
- average, minimum, and maximum flowlet gaps
- throughput and fairness summaries in `summary.json`

This structure lets the project show why DLAF performs better than basic ECMP and why it improves on simple flowlet splitting in a load-aware way.

For the improved variant, the evaluation layer also supports a direct comparison workflow:

- `benchmarks/compare_dlaf_improved.sh` runs DLAF and DLAF Improved back-to-back
- `benchmarks/create_topologies.py` generates `topology_dlaf_improved*.json`
- `benchmarks/results/dlaf_vs_dlaf_improved_comparison.png` visualizes throughput and active-link balance

The overall design mirrors the paper’s flow: define traffic, assign paths, observe congestion, and compare balancing quality across schemes.
