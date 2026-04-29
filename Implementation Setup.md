# Implementation Setup

This project is implemented as a two-part workspace:

- The `website/` application provides the user interface for concepts, simulator walkthroughs, and P4 code viewing.
- The `simulation/` module contains the logic used to model ECMP, Flowlet, DLAF, and the project-specific `DLAF_improved` behavior.

The simulator uses configurable parameters such as number of flows, number of paths, flow size distribution, hash table count, bucket count, and timeout values. The core comparison points are load distribution across paths, standard deviation of path loads, and the number of flowlets created during execution.

For the DLAF model, the implementation follows the paper’s main ideas:

- multiple hash tables are used to track flow signatures
- buckets store the last timestamp and selected ECMP index
- a Port Load Counter style mechanism is used to select the least-loaded path
- stale flowlet entries are refreshed when the timeout is exceeded

For the DLAF Improved model, the implementation extends the original design while keeping it P4/BMv2 friendly:

- `simulation/dlaf_improved.p4` is a separate P4 program, copied from the 4-hash DLAF baseline and modified independently
- 32-bit flow signatures reduce accidental collisions between unrelated flows
- CRC32 salted table indexes improve hash quality while remaining hardware-friendly
- per-bucket packet counters detect mice and elephant flows early
- per-bucket smoothed gap and gap-deviation registers implement adaptive flowlet splitting
- large or elephant-like flows increase the port counter by a larger weight, discouraging multiple elephants from landing on the same path
- code comments marked `IMPROVED` identify the innovation points clearly

To generate the improved topology files:

```bash
.venv/bin/python benchmarks/create_topologies.py
```

To compare DLAF and DLAF Improved:

```bash
TRIALS=1 DURATION=10 MICE_REQUESTS=120 bash benchmarks/compare_dlaf_improved.sh
```

This creates the latest `summary.json` files and the comparison image:

```text
benchmarks/results/dlaf_vs_dlaf_improved_comparison.png
```

The web UI is built with React, TypeScript, and Vite, while the simulator logic is written in TypeScript for easy inspection and rapid experimentation.
