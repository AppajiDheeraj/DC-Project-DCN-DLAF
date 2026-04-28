# Architecture

The project is organized into three layers.

## 1. Presentation Layer

The `website/` application exposes the paper content through pages for concepts, simulation walkthroughs, and P4 implementation notes. This layer helps users move from theory to experiment without switching tools.

## 2. Simulation Layer

The `simulation/` folder contains the algorithm models for ECMP, Flowlet, and DLAF. Each model produces path-load results that can be compared using the same metrics, making the algorithms directly comparable.

## 3. Data and Evaluation Layer

Each simulation run produces:

- path loads
- load imbalance measured by standard deviation
- number of flowlets
- average, minimum, and maximum flowlet gaps

This structure lets the project show why DLAF performs better than basic ECMP and why it improves on simple flowlet splitting in a load-aware way.

The overall design mirrors the paper’s flow: define traffic, assign paths, observe congestion, and compare balancing quality across schemes.
