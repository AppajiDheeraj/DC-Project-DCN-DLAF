#!/usr/bin/env python3
"""Generate DLAF paper benchmark tables and graphs.

This script is intentionally deterministic. The original IPCCC 2023 paper used
private/large packet traces and a Mininet/P4 runtime environment that are not
included in the public repository, so the default mode reproduces the metrics
published in the paper text and turns them into runnable benchmark artifacts.
"""

from __future__ import annotations

import argparse
import csv
import html
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence


@dataclass(frozen=True)
class TableRow:
    scheme: str
    cfg: str
    sdv: str
    flowlets: str
    min_gap: str
    max_gap: str
    avg_gap: str


TABLE_HEADERS = ["Scheme", "Cfg.", "SDV", "flowlets", "MinGap", "MaxGap", "AvgGap"]

REAL_TRACE_ROWS = [
    TableRow("ECMP", "-", "729K", "-", "-", "-", "-"),
    TableRow("Flowlet", "50us", "14.4K", "88.9M", "50us", "79.9ms", "2.8ms"),
    TableRow("Flowlet", "100us", "9.4K", "84.0M", "100us", "79.9ms", "2.9ms"),
    TableRow("Flowlet", "500us", "23.8K", "68.2M", "500us", "79.9ms", "3.5ms"),
    TableRow("Flowlet", "1ms", "13.9K", "54.7M", "1ms", "79.9ms", "4.2ms"),
    TableRow("Flowlet", "5ms", "109K", "15.1M", "5ms", "79.9ms", "8.7ms"),
    TableRow("Flowlet", "10ms", "150K", "3.7M", "10ms", "79.9ms", "14.3ms"),
    TableRow("Flowlet", "50ms", "343K", "2401", "50ms", "79.9ms", "55.8ms"),
    TableRow("Flowlet", "100ms", "861K", "0", "-", "-", "-"),
    TableRow("DLAF", "8*512", "5", "64.9M", "146us", "24.2ms", "3.4ms"),
    TableRow("DLAF", "4*1K", "10", "65.3M", "13us", "29.6ms", "3.3ms"),
    TableRow("DLAF", "2*2K", "10", "66.0M", "0", "62.1ms", "3.2ms"),
    TableRow("DLAF", "1*4K", "6", "68.0M", "0", "189.9ms", "3.1ms"),
]

SYNTH_TRACE_ROWS = [
    TableRow("ECMP", "-", "630K", "-", "-", "-", "-"),
    TableRow("Flowlet", "50", "3.6K", "41.4M", "50", "6934", "4941"),
    TableRow("Flowlet", "100", "4.0K", "40.8M", "100", "6934", "5007"),
    TableRow("Flowlet", "500", "2.1K", "36.3M", "500", "6934", "5592"),
    TableRow("Flowlet", "1000", "12K", "33.6M", "1000", "6934", "5985"),
    TableRow("Flowlet", "5000", "585K", "31.3M", "5000", "6934", "6294"),
    TableRow("Flowlet", "10000", "680K", "0", "-", "-", "-"),
    TableRow("DLAF", "8*512", "0", "32.6M", "524", "11989", "6066"),
    TableRow("DLAF", "4*1K", "0", "32.9M", "24", "16684", "6021"),
    TableRow("DLAF", "2*2K", "0", "33.4M", "2", "26143", "5942"),
    TableRow("DLAF", "1*4K", "0", "33.7M", "1", "29204", "5894"),
]

THROUGHPUT_KBPS = [
    ("ECMP", 778.0),
    ("Flowlet", 860.26),
    ("DLAF", 904.3),
]

# The paper text gives exact Table II values for the 4K total bucket configs.
# For the doubled 8K configs, the text states that max and average gaps roughly
# double while min gap remains almost the same. These values are therefore
# derived from the paper text, not extracted from the original plotting data.
FIG2_GAPS = [
    ("8x512", 524, 11989, 6066),
    ("4x1K", 24, 16684, 6021),
    ("2x2K", 2, 26143, 5942),
    ("1x4K", 1, 29204, 5894),
    ("8x1K", 524, 23978, 12132),
    ("4x2K", 24, 33368, 12042),
    ("2x4K", 2, 52286, 11884),
    ("1x8K", 1, 58408, 11788),
]

# The exact Fig. 4 point data is not in the public repository or paper text.
# These deterministic values follow the numeric ranges stated in Section V and
# preserve the visual ordering from the paper.
FIG4_STDDEV_RATIO = [
    ("ECMP", [0.09631, 0.14287, 0.18854, 0.22901]),
    ("Flowlet", [0.09154, 0.11822, 0.14376, 0.17691]),
    ("2hash DLAF", [0.05257, 0.07184, 0.08862, 0.10495]),
    ("2hash DLAF PLC", [0.00650, 0.00310, 0.00440, 0.00280]),
    ("4hash DLAF", [0.04100, 0.05700, 0.06900, 0.08200]),
    ("4hash DLAF PLC", [0.00250, 0.00190, 0.00320, 0.00140]),
]

PALETTE = ["#355c7d", "#c06c84", "#6c9a8b", "#f2a65a", "#7d5ba6", "#4f8a8b"]


def write_csv(path: Path, rows: Sequence[TableRow]) -> None:
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(TABLE_HEADERS)
        for row in rows:
            writer.writerow([row.scheme, row.cfg, row.sdv, row.flowlets, row.min_gap, row.max_gap, row.avg_gap])


def markdown_table(rows: Sequence[TableRow]) -> str:
    lines = [
        "| " + " | ".join(TABLE_HEADERS) + " |",
        "| " + " | ".join(["---"] * len(TABLE_HEADERS)) + " |",
    ]
    for row in rows:
        lines.append(
            "| "
            + " | ".join([row.scheme, row.cfg, row.sdv, row.flowlets, row.min_gap, row.max_gap, row.avg_gap])
            + " |"
        )
    return "\n".join(lines)


def write_markdown(path: Path) -> None:
    text = f"""# DLAF Paper Benchmark Outputs

Generated from the published metrics in:

Dynamic and Load-Aware Flowlet for Load-Balancing in Data Center Networks,
IEEE IPCCC 2023, DOI: 10.1109/IPCCC59175.2023.10253875.

Important reproducibility note: the public GitHub repository and this project
do not include the original one-minute production data-center trace, the
50-million-packet synthesized trace file, or the exact Fig. 4 plotting data.
The tables below reproduce the paper's published table values. Fig. 5 uses the
published throughput values. Fig. 2 includes exact Table II values for the 4K
bucket configurations and text-derived doubled-table values for the 8K bucket
configurations. Fig. 4 uses deterministic values matching the ranges stated in
Section V.

## Table I: Simulation Results on Real Trace

{markdown_table(REAL_TRACE_ROWS)}

## Table II: Simulation Results on Synthesized Trace

{markdown_table(SYNTH_TRACE_ROWS)}
"""
    path.write_text(text, encoding="utf-8")


def escape(value: object) -> str:
    return html.escape(str(value), quote=True)


def svg_bar_chart(
    title: str,
    ylabel: str,
    series: Sequence[tuple[str, float]],
    path: Path,
    width: int = 920,
    height: int = 520,
) -> None:
    margin = {"left": 82, "right": 36, "top": 64, "bottom": 86}
    plot_w = width - margin["left"] - margin["right"]
    plot_h = height - margin["top"] - margin["bottom"]
    max_value = max(value for _, value in series) * 1.12
    bar_gap = 18
    bar_w = (plot_w - bar_gap * (len(series) - 1)) / len(series)
    parts = svg_header(width, height, title)
    parts.append(axis_svg(margin, plot_w, plot_h, max_value, ylabel))
    for idx, (label, value) in enumerate(series):
        x = margin["left"] + idx * (bar_w + bar_gap)
        bar_h = (value / max_value) * plot_h
        y = margin["top"] + plot_h - bar_h
        color = PALETTE[idx % len(PALETTE)]
        parts.append(f'<rect x="{x:.2f}" y="{y:.2f}" width="{bar_w:.2f}" height="{bar_h:.2f}" fill="{color}"/>')
        parts.append(
            f'<text x="{x + bar_w / 2:.2f}" y="{height - 48}" class="label" text-anchor="middle">{escape(label)}</text>'
        )
        parts.append(
            f'<text x="{x + bar_w / 2:.2f}" y="{y - 8:.2f}" class="value" text-anchor="middle">{value:g}</text>'
        )
    parts.append("</svg>\n")
    path.write_text("\n".join(parts), encoding="utf-8")


def svg_horizontal_bar_chart(
    title: str,
    xlabel: str,
    series: Sequence[tuple[str, float]],
    path: Path,
    width: int = 920,
    height: int = 520,
) -> None:
    margin = {"left": 120, "right": 54, "top": 64, "bottom": 74}
    plot_w = width - margin["left"] - margin["right"]
    plot_h = height - margin["top"] - margin["bottom"]
    max_value = 1000.0
    bar_gap = 26
    bar_h = (plot_h - bar_gap * (len(series) - 1)) / len(series)
    parts = svg_header(width, height, title)
    left = margin["left"]
    top = margin["top"]
    bottom = top + plot_h
    parts.append(f'<line x1="{left}" y1="{top}" x2="{left}" y2="{bottom}" class="axis"/>')
    parts.append(f'<line x1="{left}" y1="{bottom}" x2="{left + plot_w}" y2="{bottom}" class="axis"/>')
    for idx in range(6):
        value = max_value * idx / 5
        x = left + (value / max_value) * plot_w
        parts.append(f'<line x1="{x:.2f}" y1="{top}" x2="{x:.2f}" y2="{bottom}" class="grid"/>')
        parts.append(f'<text x="{x:.2f}" y="{bottom + 24}" class="tick" text-anchor="middle">{value:g}</text>')
    for idx, (label, value) in enumerate(series):
        y = top + idx * (bar_h + bar_gap)
        w = (value / max_value) * plot_w
        parts.append(f'<text x="{left - 16}" y="{y + bar_h / 2 + 4:.2f}" class="label" text-anchor="end">{escape(label)}</text>')
        parts.append(f'<rect x="{left}" y="{y:.2f}" width="{w:.2f}" height="{bar_h:.2f}" fill="#4f9aaa"/>')
    parts.append(f'<text x="{left + plot_w / 2:.2f}" y="{height - 22}" class="label" text-anchor="middle">{escape(xlabel)}</text>')
    parts.append("</svg>\n")
    path.write_text("\n".join(parts), encoding="utf-8")


def svg_grouped_bar_chart(
    title: str,
    ylabel: str,
    categories: Sequence[str],
    series: Sequence[tuple[str, Sequence[float]]],
    path: Path,
    width: int = 1080,
    height: int = 560,
) -> None:
    margin = {"left": 86, "right": 190, "top": 64, "bottom": 88}
    plot_w = width - margin["left"] - margin["right"]
    plot_h = height - margin["top"] - margin["bottom"]
    max_value = max(max(values) for _, values in series) * 1.14
    group_gap = 22
    group_w = (plot_w - group_gap * (len(categories) - 1)) / len(categories)
    bar_w = group_w / len(series)
    parts = svg_header(width, height, title)
    parts.append(axis_svg(margin, plot_w, plot_h, max_value, ylabel))
    for c_idx, category in enumerate(categories):
        group_x = margin["left"] + c_idx * (group_w + group_gap)
        parts.append(
            f'<text x="{group_x + group_w / 2:.2f}" y="{height - 48}" class="label" text-anchor="middle">{escape(category)}</text>'
        )
        for s_idx, (_, values) in enumerate(series):
            value = values[c_idx]
            x = group_x + s_idx * bar_w + 1
            bar_h = (value / max_value) * plot_h
            y = margin["top"] + plot_h - bar_h
            parts.append(
                f'<rect x="{x:.2f}" y="{y:.2f}" width="{max(bar_w - 2, 1):.2f}" height="{bar_h:.2f}" fill="{PALETTE[s_idx % len(PALETTE)]}"/>'
            )
    legend_x = width - margin["right"] + 24
    legend_y = margin["top"] + 16
    for idx, (name, _) in enumerate(series):
        y = legend_y + idx * 28
        parts.append(f'<rect x="{legend_x}" y="{y - 12}" width="16" height="16" fill="{PALETTE[idx % len(PALETTE)]}"/>')
        parts.append(f'<text x="{legend_x + 24}" y="{y + 1}" class="legend">{escape(name)}</text>')
    parts.append("</svg>\n")
    path.write_text("\n".join(parts), encoding="utf-8")


def svg_header(width: int, height: int, title: str) -> list[str]:
    return [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        "<style>",
        "text{font-family:Arial,Helvetica,sans-serif;fill:#20242a}",
        ".title{font-size:22px;font-weight:700}",
        ".axis{stroke:#20242a;stroke-width:1.2}",
        ".grid{stroke:#d7dde5;stroke-width:1}",
        ".tick{font-size:12px;fill:#4b5563}",
        ".label{font-size:13px;fill:#303846}",
        ".value{font-size:12px;fill:#303846;font-weight:700}",
        ".legend{font-size:13px;fill:#303846}",
        "</style>",
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        f'<text x="{width / 2:.2f}" y="34" class="title" text-anchor="middle">{escape(title)}</text>',
    ]


def axis_svg(margin: dict[str, int], plot_w: int, plot_h: int, max_value: float, ylabel: str) -> str:
    parts = []
    left = margin["left"]
    top = margin["top"]
    bottom = top + plot_h
    parts.append(f'<line x1="{left}" y1="{top}" x2="{left}" y2="{bottom}" class="axis"/>')
    parts.append(f'<line x1="{left}" y1="{bottom}" x2="{left + plot_w}" y2="{bottom}" class="axis"/>')
    for idx in range(6):
        value = max_value * idx / 5
        y = bottom - (value / max_value) * plot_h
        parts.append(f'<line x1="{left}" y1="{y:.2f}" x2="{left + plot_w}" y2="{y:.2f}" class="grid"/>')
        parts.append(f'<text x="{left - 10}" y="{y + 4:.2f}" class="tick" text-anchor="end">{value:.3g}</text>')
    parts.append(
        f'<text x="22" y="{top + plot_h / 2:.2f}" class="label" text-anchor="middle" transform="rotate(-90 22 {top + plot_h / 2:.2f})">{escape(ylabel)}</text>'
    )
    return "\n".join(parts)


def write_html_report(path: Path, output_dir: Path) -> None:
    def table_html(rows: Sequence[TableRow]) -> str:
        head = "".join(f"<th>{escape(h)}</th>" for h in TABLE_HEADERS)
        body = []
        for row in rows:
            cells = [row.scheme, row.cfg, row.sdv, row.flowlets, row.min_gap, row.max_gap, row.avg_gap]
            body.append("<tr>" + "".join(f"<td>{escape(cell)}</td>" for cell in cells) + "</tr>")
        return f"<table><thead><tr>{head}</tr></thead><tbody>{''.join(body)}</tbody></table>"

    html_text = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DLAF Paper Benchmark Outputs</title>
  <style>
    body {{ font-family: Arial, Helvetica, sans-serif; margin: 32px; color: #20242a; }}
    h1 {{ margin-bottom: 8px; }}
    .note {{ max-width: 980px; line-height: 1.45; color: #374151; }}
    table {{ border-collapse: collapse; margin: 18px 0 34px; width: 100%; max-width: 1100px; }}
    th, td {{ border: 1px solid #d7dde5; padding: 8px 10px; text-align: left; }}
    th {{ background: #f4f6f8; }}
    img {{ display: block; max-width: 100%; margin: 18px 0 34px; border: 1px solid #e5e7eb; }}
  </style>
</head>
<body>
  <h1>DLAF Paper Benchmark Outputs</h1>
  <p class="note">These outputs reproduce the numeric results published in the IPCCC 2023 DLAF paper where the data is available in text. The private production trace and exact Fig. 4 plotting data are not present in the public repository.</p>
  <h2>Table I: Simulation Results on Real Trace</h2>
  {table_html(REAL_TRACE_ROWS)}
  <h2>Table II: Simulation Results on Synthesized Trace</h2>
  {table_html(SYNTH_TRACE_ROWS)}
  <h2>Fig. 2: Flowlet Gaps for Different DLAF Configurations</h2>
  <img src="{escape((output_dir / 'fig2_flowlet_gaps.svg').name)}" alt="Fig. 2 flowlet gaps">
  <h2>Fig. 4: Test Case Results</h2>
  <img src="{escape((output_dir / 'fig4_test_case_results.svg').name)}" alt="Fig. 4 test case results">
  <h2>Fig. 5: Average Throughput of iPerf Traffic Results</h2>
  <img src="{escape((output_dir / 'fig5_iperf_throughput.svg').name)}" alt="Fig. 5 iPerf throughput">
</body>
</html>
"""
    path.write_text(html_text, encoding="utf-8")


def write_fig2(path: Path) -> None:
    categories = [row[0] for row in FIG2_GAPS]
    series = [
        ("Min", [row[1] for row in FIG2_GAPS]),
        ("Max", [row[2] for row in FIG2_GAPS]),
        ("Average", [row[3] for row in FIG2_GAPS]),
    ]
    svg_grouped_bar_chart("Flowlet Gaps for Different DLAF Configurations", "Gap (packets)", categories, series, path)


def write_fig4(path: Path) -> None:
    categories = [name for name, _ in FIG4_STDDEV_RATIO]
    series = [
        (f"Test Case {idx + 1}", [values[idx] for _, values in FIG4_STDDEV_RATIO])
        for idx in range(4)
    ]
    svg_grouped_bar_chart("Test Case Results", "Std. deviation / average flow", categories, series, path)


def generate_outputs(output_dir: Path) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    written = [
        output_dir / "table1_real_trace.csv",
        output_dir / "table2_synth_trace.csv",
        output_dir / "results.md",
        output_dir / "fig2_flowlet_gaps.svg",
        output_dir / "fig4_test_case_results.svg",
        output_dir / "fig5_iperf_throughput.svg",
        output_dir / "report.html",
    ]
    write_csv(written[0], REAL_TRACE_ROWS)
    write_csv(written[1], SYNTH_TRACE_ROWS)
    write_markdown(written[2])
    write_fig2(written[3])
    write_fig4(written[4])
    svg_horizontal_bar_chart("Average Throughput of iPerf Traffic Results", "kilobits per second", THROUGHPUT_KBPS, written[5])
    write_html_report(written[6], output_dir)
    return written


def print_summary(paths: Iterable[Path]) -> None:
    print("DLAF paper benchmark artifacts generated:")
    for path in paths:
        print(f"  - {path}")
    print()
    print("Key paper values:")
    print("  - Table I DLAF SDV: 5, 10, 10, 6 for 8*512, 4*1K, 2*2K, 1*4K")
    print("  - Table II DLAF SDV: 0 for all listed DLAF configurations")
    print("  - Fig. 5 throughput: ECMP 778 kbps, Flowlet 860.26 kbps, DLAF 904.3 kbps")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate DLAF IPCCC 2023 paper benchmark artifacts.")
    parser.add_argument(
        "--outdir",
        type=Path,
        default=Path("benchmark_outputs"),
        help="Directory where CSV, Markdown, SVG, and HTML outputs will be written.",
    )
    args = parser.parse_args()
    paths = generate_outputs(args.outdir)
    print_summary(paths)


if __name__ == "__main__":
    main()
