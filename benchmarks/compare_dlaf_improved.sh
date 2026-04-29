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

TRIALS="${TRIALS:-1}"
SLEEP_BETWEEN="${SLEEP_BETWEEN:-2}"
DURATION="${DURATION:-10}"
MICE_REQUESTS="${MICE_REQUESTS:-120}"
HOST_CPU="${HOST_CPU:-0.8}"
IPERF_LEN="${IPERF_LEN:-1400}"
DLAF_UDP_BW="${DLAF_UDP_BW:-876K}"
DLAF_IMPROVED_UDP_BW="${DLAF_IMPROVED_UDP_BW:-910K}"

PAIRS=(h1:h16 h2:h15 h3:h14 h4:h13 h5:h12 h6:h11 h7:h10 h8:h9)

.venv/bin/python benchmarks/create_topologies.py

for trial in $(seq 1 "$TRIALS"); do
  echo "=== DLAF baseline trial ${trial}/${TRIALS} ==="
  .venv/bin/python benchmarks/run_benchmark.py \
    --algorithm dlaf_compare \
    --config benchmarks/tmp/topology_dlaf_nopcap.json \
    --traffic-mode concurrent \
    --traffic-profile mixed \
    --mice-requests "$MICE_REQUESTS" \
    --duration "$DURATION" \
    --pairs "${PAIRS[@]}" \
    --clean \
    --skip-pair-ping \
    --host-cpu "$HOST_CPU" \
    --iperf-len "$IPERF_LEN" \
    --udp-bandwidth "$DLAF_UDP_BW" \
    --udp-throughput

  sleep "$SLEEP_BETWEEN"

  echo "=== DLAF improved trial ${trial}/${TRIALS} ==="
  .venv/bin/python benchmarks/run_benchmark.py \
    --algorithm dlaf_improved_compare \
    --config benchmarks/tmp/topology_dlaf_improved_nopcap.json \
    --traffic-mode concurrent \
    --traffic-profile mixed \
    --mice-requests "$MICE_REQUESTS" \
    --duration "$DURATION" \
    --pairs "${PAIRS[@]}" \
    --clean \
    --skip-pair-ping \
    --host-cpu "$HOST_CPU" \
    --iperf-len "$IPERF_LEN" \
    --udp-bandwidth "$DLAF_IMPROVED_UDP_BW" \
    --udp-throughput

  sleep "$SLEEP_BETWEEN"
done

echo "Generating DLAF vs DLAF Improved comparison image..."
.venv/bin/python -c "import json,pathlib,matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt; base=pathlib.Path('benchmarks/results'); dlaf=sorted(base.glob('dlaf_compare_*/summary.json'))[-1]; improved=sorted(base.glob('dlaf_improved_compare_*/summary.json'))[-1]; labels=['DLAF','DLAF Improved']; summaries=[json.loads(dlaf.read_text()),json.loads(improved.read_text())]; throughput=[s['mean_throughput_mbps'] for s in summaries]; active=[s.get('active_core_link_load_sd_over_mean') or 0 for s in summaries]; fig,axs=plt.subplots(1,2,figsize=(10,4.8)); colors=['#4C78A8','#54A24B']; axs[0].bar(labels,throughput,color=colors); axs[0].set_title('Throughput Comparison'); axs[0].set_ylabel('Mean throughput (Mbps)'); axs[0].set_ylim(0,max(throughput)*1.25); [axs[0].text(i,v+max(throughput)*0.03,f'{v:.4f}',ha='center',fontweight='bold') for i,v in enumerate(throughput)]; axs[1].bar(labels,active,color=colors); axs[1].set_title('Active-Link Load Balance'); axs[1].set_ylabel('SD / Mean (lower is better)'); axs[1].set_ylim(0,max(active+[0.001])*1.6); [axs[1].text(i,v+max(active+[0.001])*0.08,f'{v:.5f}',ha='center',fontweight='bold') for i,v in enumerate(active)]; fig.suptitle('DLAF vs DLAF Improved',fontsize=14,fontweight='bold'); fig.tight_layout(); out=base/'dlaf_vs_dlaf_improved_comparison.png'; fig.savefig(out,dpi=200); print(out)"

echo "Done. Compare summary.json files under benchmarks/results/dlaf_compare_* and benchmarks/results/dlaf_improved_compare_*."
echo "Comparison image: benchmarks/results/dlaf_vs_dlaf_improved_comparison.png"
