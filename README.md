# DC Project - DLAF Load Balancing Evaluation

This repository contains our data center networking project based on the paper *Dynamic and Load-Aware Flowlet for Load-Balancing in Data Center Networks*.

## Team

- Appaji Nagaraja Dheeraj - 241CS110
- Adarsh Malipatil - 241CS102

## Repository Layout

### Core Directories
- `website/` - Interactive React + Vite web application for concepts, simulation walkthroughs, and P4 code viewing
- `simulation/` - Algorithm models for ECMP, Flowlet, and DLAF
- `benchmarks/` - Benchmark suite and evaluation scripts
- `pcap/` - Network packet captures from test runs
- `log/` - Simulation logs from P4 switches

### Results & Documentation
- `all_local_results/` - Generated evaluation results with charts and metrics
- `local_results/` - Backup of local evaluation results
- `benchmark_outputs/` - Detailed benchmark reports and SVG figures
- `Results and explanation.md` - Results summary and interpretation
- `Methodology.md` - Experimental and simulation methodology
- `Implementation Setup.md` - Implementation architecture and setup notes
- `Architecture.md` - System design and layered architecture

## Testing Environment

- **Platform**: Orbstack
- **OS**: Ubuntu Jammy (22.04 LTS)
- **Topology**: k=4 fat-tree (16 hosts, 8 ToRs, 8 aggregation switches, 4 core switches)
- **P4 Runtime**: BMv2 (Behavioral Model v2)

## Paper Focus

The project compares three load-balancing strategies in data center networks:

- **ECMP** - Equal-cost multipath: simple hash-based path selection
- **Flowlet** - Timeout-based burst splitting with re-hashing
- **DLAF** - Dynamic Load-Aware Flowlet: combines burst detection with load awareness

The website presents concepts interactively, the simulator visualizes path selection behavior, and the evaluation results demonstrate how load awareness improves throughput and balancing.