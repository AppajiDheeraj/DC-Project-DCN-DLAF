# Methodology

The study compares three load-balancing strategies under the same traffic conditions.

## Traffic Generation

Flows are generated with either uniform or Zipf-style size distributions. Each flow gets a random start time and a packet count so that the simulator can model both short and long traffic bursts.

## Baselines

- ECMP assigns each flow to a path using hashing and keeps the entire flow on that path.
- Flowlet splits traffic when the inter-packet gap exceeds a timeout and re-hashes the next burst.
- DLAF tracks flow signatures in multiple hash tables and uses load awareness to choose the best path when a new flowlet is created.

## Metrics

The main evaluation metrics are:

- path load balance
- standard deviation of loads
- number of flowlets
- flowlet gap statistics

## Comparison Approach

All algorithms are run against the same configuration so the results can be compared fairly. The DLAF model is expected to reduce imbalance by combining flowlet detection with least-loaded path selection, while ECMP serves as the simple baseline and Flowlet serves as the intermediate reference point.
