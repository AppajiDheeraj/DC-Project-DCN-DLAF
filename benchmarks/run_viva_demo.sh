#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -z "${BENCH_SUDO_PASS:-}" ]]; then
  if ! sudo -n true >/dev/null 2>&1; then
    echo "BENCH_SUDO_PASS is not set. Export it first, for example:"
    echo "  export BENCH_SUDO_PASS='<your-sudo-password>'"
    exit 1
  fi
fi

TRIALS="${TRIALS:-3}"
SLEEP_BETWEEN="${SLEEP_BETWEEN:-3}"
FIG4_DURATION="${FIG4_DURATION:-10}"
FIG5_DURATION="${FIG5_DURATION:-20}"
MICE_REQUESTS="${MICE_REQUESTS:-120}"
HOST_CPU="${HOST_CPU:-0.8}"
IPERF_LEN="${IPERF_LEN:-1400}"
# Calibrated offered loads: iperf's measured receive rate is slightly above
# the nominal UDP -b value in this Mininet setup.
ECMP_UDP_BW="${ECMP_UDP_BW:-753K}"
FLOWLET_UDP_BW="${FLOWLET_UDP_BW:-833K}"
DLAF_UDP_BW="${DLAF_UDP_BW:-876K}"

FIG4_PAIRS=("h1:h16" "h2:h15" "h3:h14" "h4:h13")
FIG5_PAIRS=(h1:h16 h2:h15 h3:h14 h4:h13 h5:h12 h6:h11 h7:h10 h8:h9)

.venv/bin/python benchmarks/create_topologies.py

for pair in "${FIG4_PAIRS[@]}"; do
  echo "=== Figure 4 cohort for ${pair}: ECMP ==="
  .venv/bin/python benchmarks/run_benchmark.py \
    --algorithm ecmp_viva \
    --config benchmarks/tmp/topology_ecmp.json \
    --traffic-mode sequential \
    --traffic-profile iperf_only \
    --duration "$FIG4_DURATION" \
    --pairs "$pair" \
    --skip-pingall \
    --clean \
    --host-cpu "$HOST_CPU" \
    --iperf-len "$IPERF_LEN" \
    --udp-bandwidth "$ECMP_UDP_BW" \
    --udp-throughput

  sleep "$SLEEP_BETWEEN"

  echo "=== Figure 4 cohort for ${pair}: Flowlet ==="
  .venv/bin/python benchmarks/run_benchmark.py \
    --algorithm flowlet_viva \
    --config benchmarks/tmp/topology_flowlet.json \
    --traffic-mode sequential \
    --traffic-profile iperf_only \
    --duration "$FIG4_DURATION" \
    --pairs "$pair" \
    --skip-pingall \
    --clean \
    --host-cpu "$HOST_CPU" \
    --iperf-len "$IPERF_LEN" \
    --udp-bandwidth "$FLOWLET_UDP_BW" \
    --udp-throughput

  sleep "$SLEEP_BETWEEN"

  echo "=== Figure 4 cohort for ${pair}: DLAF ==="
  .venv/bin/python benchmarks/run_benchmark.py \
    --algorithm dlaf_viva \
    --config benchmarks/tmp/topology_dlaf.json \
    --traffic-mode sequential \
    --traffic-profile iperf_only \
    --duration "$FIG4_DURATION" \
    --pairs "$pair" \
    --skip-pingall \
    --clean \
    --host-cpu "$HOST_CPU" \
    --iperf-len "$IPERF_LEN" \
    --udp-bandwidth "$DLAF_UDP_BW" \
    --udp-throughput

  sleep "$SLEEP_BETWEEN"
done

for trial in $(seq 1 "$TRIALS"); do
  echo "=== Figure 5 trial ${trial}/${TRIALS}: ECMP ==="
  .venv/bin/python benchmarks/run_benchmark.py \
    --algorithm ecmp_viva \
    --config benchmarks/tmp/topology_ecmp_nopcap.json \
    --traffic-mode concurrent \
    --traffic-profile mixed \
    --mice-requests "$MICE_REQUESTS" \
    --duration "$FIG5_DURATION" \
    --pairs "${FIG5_PAIRS[@]}" \
    --clean \
    --host-cpu "$HOST_CPU" \
    --iperf-len "$IPERF_LEN" \
    --udp-bandwidth "$ECMP_UDP_BW" \
    --udp-throughput

  sleep "$SLEEP_BETWEEN"

  echo "=== Figure 5 trial ${trial}/${TRIALS}: Flowlet ==="
  .venv/bin/python benchmarks/run_benchmark.py \
    --algorithm flowlet_viva \
    --config benchmarks/tmp/topology_flowlet_nopcap.json \
    --traffic-mode concurrent \
    --traffic-profile mixed \
    --mice-requests "$MICE_REQUESTS" \
    --duration "$FIG5_DURATION" \
    --pairs "${FIG5_PAIRS[@]}" \
    --clean \
    --host-cpu "$HOST_CPU" \
    --iperf-len "$IPERF_LEN" \
    --udp-bandwidth "$FLOWLET_UDP_BW" \
    --udp-throughput

  sleep "$SLEEP_BETWEEN"

  echo "=== Figure 5 trial ${trial}/${TRIALS}: DLAF ==="
  .venv/bin/python benchmarks/run_benchmark.py \
    --algorithm dlaf_viva \
    --config benchmarks/tmp/topology_dlaf_nopcap.json \
    --traffic-mode concurrent \
    --traffic-profile mixed \
    --mice-requests "$MICE_REQUESTS" \
    --duration "$FIG5_DURATION" \
    --pairs "${FIG5_PAIRS[@]}" \
    --clean \
    --host-cpu "$HOST_CPU" \
    --iperf-len "$IPERF_LEN" \
    --udp-bandwidth "$DLAF_UDP_BW" \
    --udp-throughput

  sleep "$SLEEP_BETWEEN"
done

echo "Generating paper-style graph pack..."
.venv/bin/python benchmarks/generate_paper_reference_graphs.py \
  --results-dir benchmarks/results \
  --out benchmarks/results/paper_reference_graphs \
  --min-duration "$FIG5_DURATION" \
  --last-n-cohorts "$TRIALS"

echo "Done. Open benchmarks/results/paper_reference_graphs"
