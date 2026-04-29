#!/usr/bin/env python3
"""Create per-algorithm p4run topology configs for this repository."""

from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path


ALGORITHMS = {
    "ecmp": "simulation/ecmp_switching.p4",
    "flowlet": "simulation/flowlet_switching.p4",
    "dlaf": "simulation/dlaf_4hash.p4",
    "dlaf_improved": "simulation/dlaf_improved.p4",
    "dlaf2": "simulation/dlaf.p4",
    "dlaf_counter": "simulation/dlaf_counter.p4",
    "dlaf4_no_plc": "simulation/dlaf_4hash_no_plc.p4",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate benchmark topology JSON files.")
    parser.add_argument("--base", default="simulation/topology.json", help="Base topology JSON")
    parser.add_argument("--out", default="benchmarks/tmp", help="Output directory")
    return parser.parse_args()


def write_config(base: dict, out_dir: Path, name: str, p4_src: str, pcap_dump: bool) -> Path:
    cfg = copy.deepcopy(base)
    cfg["p4_src"] = p4_src
    cfg["cli"] = True
    cfg["pcap_dump"] = pcap_dump
    cfg["enable_log"] = True
    suffix = "" if pcap_dump else "_nopcap"
    path = out_dir / f"topology_{name}{suffix}.json"
    path.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    return path


def main() -> None:
    args = parse_args()
    repo_dir = Path(__file__).resolve().parents[1]
    base_path = (repo_dir / args.base).resolve()
    out_dir = (repo_dir / args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    base = json.loads(base_path.read_text(encoding="utf-8"))

    written = []
    for name, p4_src in ALGORITHMS.items():
        p4_path = repo_dir / p4_src
        if not p4_path.exists():
            raise SystemExit(f"Missing P4 source for {name}: {p4_path}")
        written.append(write_config(base, out_dir, name, p4_src, True))
        written.append(write_config(base, out_dir, name, p4_src, False))

    print("Generated topology configs:")
    for path in written:
        print(f"  - {path.relative_to(repo_dir)}")


if __name__ == "__main__":
    main()
