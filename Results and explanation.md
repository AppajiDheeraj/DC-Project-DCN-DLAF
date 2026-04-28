# Results and explanation

The paper reports that DLAF improves both balance and throughput compared with ECMP.

## Reported Outcome

- DLAF throughput: 904 kbps
- ECMP throughput: 778 kbps
- Improvement: about 16 percent

The paper also reports a much lower load standard deviation for DLAF, which indicates that traffic is spread more evenly across available paths. In this project, that comparison is presented directly in the UI so the user can see how the algorithms differ in behavior.

## Explanation

ECMP is simple but it does not react to live congestion, so one heavy flow can keep a path busy even when other paths are free. Flowlet improves on this by splitting bursts, but it still depends on timeout tuning. DLAF combines burst-aware splitting with load awareness, which is why it achieves better balancing in the reported results.

## Practical Meaning

The result shows that load-aware path selection can improve utilization without requiring large memory overhead. In the project implementation, this idea is highlighted through the simulator metrics and the P4-oriented explanation of how DLAF can be applied in programmable data plane environments.
