#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
bash benchmarks/run_viva_demo.sh
