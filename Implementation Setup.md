# Implementation Setup

This project is implemented as a two-part workspace:

- The `website/` application provides the user interface for concepts, simulator walkthroughs, and P4 code viewing.
- The `simulation/` module contains the logic used to model ECMP, Flowlet, and DLAF behavior.

The simulator uses configurable parameters such as number of flows, number of paths, flow size distribution, hash table count, bucket count, and timeout values. The core comparison points are load distribution across paths, standard deviation of path loads, and the number of flowlets created during execution.

For the DLAF model, the implementation follows the paper’s main ideas:

- multiple hash tables are used to track flow signatures
- buckets store the last timestamp and selected ECMP index
- a Port Load Counter style mechanism is used to select the least-loaded path
- stale flowlet entries are refreshed when the timeout is exceeded

The web UI is built with React, TypeScript, and Vite, while the simulator logic is written in TypeScript for easy inspection and rapid experimentation.
