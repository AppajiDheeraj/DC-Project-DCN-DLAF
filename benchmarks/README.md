# DLAF Benchmark Pipeline

This folder now has two workflows.

## Real Mininet/P4 Benchmark

The real benchmark compiles each P4 program through `p4run`, starts Mininet,
runs the controller, measures `iperf` throughput, reads aggregation/core-link
packet counters, and then generates paper-style graphs from complete
ECMP/Flowlet/DLAF cohorts.

Install Python dependencies inside the local venv:

```bash
.venv/bin/pip install -r benchmarks/requirements.txt
```

Generate topology configs:

```bash
.venv/bin/python benchmarks/create_topologies.py
```

Run one measured benchmark:

```bash
export BENCH_SUDO_PASS='<your-sudo-password>'
.venv/bin/python benchmarks/run_benchmark.py \
  --algorithm dlaf_viva \
  --config benchmarks/tmp/topology_dlaf.json \
  --traffic-mode sequential \
  --traffic-profile iperf_only \
  --duration 10 \
  --pairs h1:h16 \
  --clean \
  --skip-pingall
```

Run the complete paper-style evaluation:

```bash
export BENCH_SUDO_PASS='<your-sudo-password>'
TRIALS=3 bash benchmarks/run_paper_evaluation.sh
```

Outputs are written under `benchmarks/results/`. Graphs are written under
`benchmarks/results/paper_reference_graphs/`.

Required system tools: `p4run`, `mn`, `iperf`, `sudo`, BMv2/p4c, and the
`p4utils` Python package used by `simulation/controller.py`.

## Static Paper Reference Generator

Run this script to generate the paper-published reference tables and graphs:

```bash
python3 benchmarks/dlaf_paper_benchmark.py --outdir benchmark_outputs
```

The script writes:

- `table1_real_trace.csv`
- `table2_synth_trace.csv`
- `results.md`
- `fig2_flowlet_gaps.svg`
- `fig4_test_case_results.svg`
- `fig5_iperf_throughput.svg`
- `report.html`

Reproducibility note: the original paper's production packet trace, synthesized
trace file, and exact Fig. 4 plot data are not included in the public DLAF
repository. This generator therefore reproduces the published table values and
the published throughput figure directly, while using deterministic
paper-consistent values for figures whose raw plotting data is unavailable.
