#!/usr/bin/env python3
"""Generate paper-style graphs from benchmark summary.json files."""

from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Any

import matplotlib.pyplot as plt


ALGO_ORDER = ["ecmp", "flowlet", "dlaf"]
ALGO_LABEL = {"ecmp": "ECMP", "flowlet": "Flowlet", "dlaf": "DLAF"}
COLORS = ["#4C78A8", "#F58518", "#54A24B"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate graph pack from complete benchmark cohorts.")
    parser.add_argument("--results-dir", default="benchmarks/results")
    parser.add_argument("--out", default="benchmarks/results/paper_reference_graphs")
    parser.add_argument("--min-duration", type=int, default=20)
    parser.add_argument("--last-n-cohorts", type=int, default=12)
    return parser.parse_args()


def to_float(value: Any) -> float | None:
    try:
        return None if value is None or value == "" else float(value)
    except Exception:
        return None


def canonical_algorithm_name(value: str) -> str:
    algo = (value or "").strip().lower()
    if "ecmp" in algo:
        return "ecmp"
    if "flowlet" in algo:
        return "flowlet"
    if "dlaf" in algo:
        return "dlaf"
    return algo


def mean(values: list[float | None]) -> float | None:
    clean = [v for v in values if v is not None]
    return sum(clean) / len(clean) if clean else None


def stdev(values: list[float | None]) -> float:
    clean = [v for v in values if v is not None]
    if len(clean) <= 1:
        return 0.0
    avg = sum(clean) / len(clean)
    return math.sqrt(sum((v - avg) ** 2 for v in clean) / (len(clean) - 1))


def sem(values: list[float | None]) -> float:
    clean = [v for v in values if v is not None]
    return stdev(clean) / math.sqrt(len(clean)) if len(clean) > 1 else 0.0


def throughput_efficiency(throughput: float | None, fairness: float | None, imbalance: float | None) -> float | None:
    if throughput is None:
        return None
    fair = fairness if fairness is not None else 1.0
    bal = max(0.0, imbalance if imbalance is not None else 0.0)
    return throughput * fair / ((1.0 + bal) ** 2)


def load_rows(results_dir: Path) -> list[dict[str, Any]]:
    rows = []
    for summary_path in sorted(results_dir.glob("*/summary.json")):
        try:
            summary = json.loads(summary_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        algo = canonical_algorithm_name(summary.get("algorithm", ""))
        if algo not in ALGO_ORDER:
            continue
        pairs = summary.get("pairs") or []
        pair_key = tuple(sorted(str(pair) for pair in pairs))
        scenario_key = (
            int(summary.get("pair_count") or len(pairs)),
            summary.get("traffic_mode"),
            summary.get("traffic_profile"),
            int(summary.get("duration_s") or 0),
            summary.get("iperf_len_bytes"),
            summary.get("mice_requests_per_pair"),
            summary.get("mixed_mode_runtime"),
            pair_key,
        )
        row = {
            "run_dir": str(summary_path.parent),
            "timestamp": int(summary.get("timestamp") or 0),
            "algorithm": algo,
            "scenario_key": scenario_key,
            "pair_count": scenario_key[0],
            "traffic_mode": scenario_key[1],
            "traffic_profile": scenario_key[2],
            "duration_s": scenario_key[3],
            "throughput_mbps": to_float(summary.get("mean_throughput_mbps")),
            "jain_fairness": to_float(summary.get("jain_fairness")),
            "loss_pct": to_float(summary.get("mean_loss_pct")),
            "core_sd_over_mean": to_float(summary.get("core_link_load_sd_over_mean")),
            "core_sd_pkts": to_float(summary.get("core_link_load_sd_pkts")),
        }
        row["throughput_efficiency_score"] = throughput_efficiency(
            row["throughput_mbps"], row["jain_fairness"], row["core_sd_over_mean"]
        )
        rows.append(row)
    return rows


def complete_cohorts(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[Any, dict[str, list[dict[str, Any]]]] = defaultdict(lambda: {algo: [] for algo in ALGO_ORDER})
    for row in rows:
        grouped[row["scenario_key"]][row["algorithm"]].append(row)

    cohorts = []
    for scenario_key, by_algo in grouped.items():
        if not all(by_algo[algo] for algo in ALGO_ORDER):
            continue
        min_count = min(len(by_algo[algo]) for algo in ALGO_ORDER)
        sorted_runs = {algo: sorted(by_algo[algo], key=lambda row: row["timestamp"])[-min_count:] for algo in ALGO_ORDER}
        for idx in range(min_count):
            runs = {algo: sorted_runs[algo][idx] for algo in ALGO_ORDER}
            cohorts.append(
                {
                    "scenario_key": scenario_key,
                    "runs": runs,
                    "timestamp": max(runs[algo]["timestamp"] for algo in ALGO_ORDER),
                    "trial_index_within_scenario": idx + 1,
                }
            )
    return sorted(cohorts, key=lambda cohort: cohort["timestamp"])


def pick_fig4(cohorts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        cohort
        for cohort in cohorts
        if cohort["scenario_key"][0] == 1
        and cohort["scenario_key"][1] == "sequential"
        and cohort["scenario_key"][2] == "iperf_only"
    ]


def pick_fig5(cohorts: list[dict[str, Any]], min_duration: int) -> list[dict[str, Any]]:
    preferred = [
        cohort
        for cohort in cohorts
        if cohort["scenario_key"][0] >= 4
        and cohort["scenario_key"][1] == "concurrent"
        and cohort["scenario_key"][2] == "mixed"
        and cohort["scenario_key"][3] >= min_duration
    ]
    if preferred:
        return preferred
    return [
        cohort
        for cohort in cohorts
        if cohort["scenario_key"][1] == "sequential"
        and cohort["scenario_key"][2] == "iperf_only"
        and all(cohort["runs"][algo].get("throughput_mbps") is not None for algo in ALGO_ORDER)
    ]


def fig4_plot(cohorts: list[dict[str, Any]], out_dir: Path) -> dict[str, Any] | None:
    if not cohorts:
        return None
    use = cohorts[-4:]
    values = {algo: [] for algo in ALGO_ORDER}
    for cohort in use:
        for algo in ALGO_ORDER:
            value = cohort["runs"][algo]["core_sd_over_mean"]
            if value is None:
                fairness = cohort["runs"][algo]["jain_fairness"]
                value = None if fairness is None else max(0.0, 1.0 - fairness)
            values[algo].append(value or 0.0)

    x = list(range(len(use)))
    width = 0.25
    fig, ax = plt.subplots(figsize=(9, 4.8))
    for idx, algo in enumerate(ALGO_ORDER):
        ax.bar([pos + (idx - 1) * width for pos in x], values[algo], width=width, label=ALGO_LABEL[algo], color=COLORS[idx])
    ax.set_title("Figure 4 Style: Load-Balancing Effectiveness")
    ax.set_ylabel("Core-link SD / Mean (lower is better)")
    ax.set_xticks(x)
    ax.set_xticklabels([f"T{i + 1}" for i in range(len(use))])
    ax.legend()
    fig.tight_layout()
    fig.savefig(out_dir / "figure4_style_single_flow.png", dpi=200)
    plt.close(fig)
    return {"tests_used": len(use), "values": values}


def metric_plot(
    cohorts: list[dict[str, Any]],
    out_dir: Path,
    key: str,
    filename: str,
    title: str,
    ylabel: str,
    higher_is_better: bool,
) -> dict[str, Any] | None:
    if not cohorts:
        return None
    series = {algo: [cohort["runs"][algo].get(key) for cohort in cohorts] for algo in ALGO_ORDER}
    means = [mean(series[algo]) for algo in ALGO_ORDER]
    errors = [sem(series[algo]) for algo in ALGO_ORDER]

    fig, ax = plt.subplots(figsize=(8.2, 4.6))
    ax.bar(
        [ALGO_LABEL[algo] for algo in ALGO_ORDER],
        [value if value is not None else 0.0 for value in means],
        yerr=errors,
        capsize=6,
        color=COLORS,
    )
    ax.set_title(title)
    ax.set_ylabel(ylabel)
    fig.tight_layout()
    fig.savefig(out_dir / filename, dpi=200)
    plt.close(fig)

    ranked = sorted(
        [(algo, means[idx]) for idx, algo in enumerate(ALGO_ORDER) if means[idx] is not None],
        key=lambda item: item[1],
        reverse=higher_is_better,
    )
    return {"cohorts_used": len(cohorts), "means": dict(zip(ALGO_ORDER, means)), "sem": dict(zip(ALGO_ORDER, errors)), "ranking": [algo for algo, _ in ranked]}


def write_report(rows: list[dict[str, Any]], cohorts: list[dict[str, Any]], fig4: Any, metrics: dict[str, Any], out_dir: Path) -> None:
    report = {
        "total_runs_found": len(rows),
        "complete_cohorts_found": len(cohorts),
        "selection_policy": "Graphs use complete ECMP+Flowlet+DLAF cohorts with identical scenario keys. Figure 5 prefers long concurrent mixed cohorts and falls back to complete sequential iperf_only cohorts when only stable local verification runs are available.",
        "scenario_key_fields": [
            "pair_count",
            "traffic_mode",
            "traffic_profile",
            "duration_s",
            "iperf_len_bytes",
            "mice_requests_per_pair",
            "mixed_mode_runtime",
            "sorted_pairs",
        ],
        "figure4": fig4,
        "metrics": metrics,
    }
    (out_dir / "paper_graphs_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()
    results_dir = Path(args.results_dir).resolve()
    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    rows = load_rows(results_dir)
    cohorts = complete_cohorts(rows)
    fig4_cohorts = pick_fig4(cohorts)
    fig5_cohorts = pick_fig5(cohorts, args.min_duration)
    if args.last_n_cohorts > 0:
        fig5_cohorts = fig5_cohorts[-args.last_n_cohorts :]

    fig4 = fig4_plot(fig4_cohorts, out_dir)
    metrics = {
        "throughput_efficiency": metric_plot(
            fig5_cohorts,
            out_dir,
            "throughput_efficiency_score",
            "figure5_style_throughput_efficiency.png",
            "Figure 5 Style: Throughput Efficiency",
            "Mbps * fairness / (1 + imbalance)^2",
            True,
        ),
        "raw_throughput": metric_plot(
            fig5_cohorts,
            out_dir,
            "throughput_mbps",
            "metric_raw_throughput.png",
            "Raw Mean Throughput",
            "Throughput (Mbps)",
            True,
        ),
        "load_balance": metric_plot(
            fig5_cohorts,
            out_dir,
            "core_sd_over_mean",
            "metric_load_balance_sd_over_mean.png",
            "Load Balance",
            "Core-link SD / Mean",
            False,
        ),
        "fairness": metric_plot(
            fig5_cohorts,
            out_dir,
            "jain_fairness",
            "metric_jain_fairness.png",
            "Jain Fairness",
            "Fairness",
            True,
        ),
        "loss": metric_plot(
            fig5_cohorts,
            out_dir,
            "loss_pct",
            "metric_packet_loss.png",
            "Packet Loss",
            "Loss (%)",
            False,
        ),
    }
    write_report(rows, cohorts, fig4, metrics, out_dir)
    print(f"Generated graph pack in: {out_dir}")
    print(f"Total runs: {len(rows)}")
    print(f"Complete cohorts: {len(cohorts)}")
    print(f"Figure 4 cohorts: {0 if fig4 is None else fig4['tests_used']}")
    print(f"Figure 5 cohorts: {0 if metrics['raw_throughput'] is None else metrics['raw_throughput']['cohorts_used']}")


if __name__ == "__main__":
    main()
