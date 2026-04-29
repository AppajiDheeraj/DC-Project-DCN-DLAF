#!/usr/bin/env python3
"""Run one P4/Mininet benchmark and write machine-readable metrics.

The script assumes a p4-utils/BMv2 environment. It intentionally refuses to
invent data when p4run, Mininet, iperf, or the controller cannot run.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import re
import shutil
import statistics
import subprocess
import time
from datetime import datetime
from pathlib import Path

import pexpect


ANSI_RE = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
DEFAULT_PAIRS = ["h1:h16", "h2:h15", "h3:h14", "h4:h13"]
BENCH_PYTHONPATH = "/usr/local/lib/python3.10/site-packages:/usr/lib/python3/dist-packages"


def log_section(title: str) -> None:
    print(f"\n=== {title} ===", flush=True)


def tail_text(text: str, limit: int = 4000) -> str:
    if len(text) <= limit:
        return text
    return "..." + text[-limit:]


def print_failure_context(message: str, *, log_file: Path | None = None, child: pexpect.spawn | None = None, exc: Exception | None = None) -> None:
    log_section("benchmark failure")
    print(message, flush=True)
    if exc is not None:
        print(f"exception: {type(exc).__name__}: {exc}", flush=True)
    if log_file is not None:
        print(f"session log: {log_file}", flush=True)
        if log_file.exists():
            try:
                tail = tail_text(log_file.read_text(encoding="utf-8", errors="replace"))
                print("--- session.log tail ---", flush=True)
                print(tail, flush=True)
                print("--- end session.log tail ---", flush=True)
            except Exception as read_exc:
                print(f"failed to read session log: {read_exc}", flush=True)
    if child is not None:
        print(f"child alive: {child.isalive()}", flush=True)
        before = getattr(child, "before", "") or ""
        if before:
            print("--- pexpect.before tail ---", flush=True)
            print(tail_text(before), flush=True)
            print("--- end pexpect.before tail ---", flush=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run ECMP/Flowlet/DLAF benchmark in Mininet.")
    parser.add_argument("--algorithm", required=True)
    parser.add_argument("--config", required=True)
    parser.add_argument("--controller", default="simulation/controller.py")
    parser.add_argument("--k", default="4")
    parser.add_argument("--duration", type=int, default=10)
    parser.add_argument("--iperf-len", type=int, default=0)
    parser.add_argument("--udp-throughput", action="store_true", help="Use UDP iperf for throughput measurement")
    parser.add_argument("--udp-bandwidth", default="10M", help="UDP iperf offered load, e.g. 778K, 1M, 10M")
    parser.add_argument("--traffic-mode", choices=["sequential", "concurrent"], default="sequential")
    parser.add_argument("--traffic-profile", choices=["iperf_only", "mixed"], default="iperf_only")
    parser.add_argument("--pairs", nargs="*", default=DEFAULT_PAIRS)
    parser.add_argument("--clean", action="store_true")
    parser.add_argument("--skip-pingall", action="store_true")
    parser.add_argument("--skip-pair-ping", action="store_true", help="Do not include per-pair ping probes in measured traffic")
    parser.add_argument("--timeout", type=int, default=420)
    parser.add_argument("--host-cpu", type=float, default=0.0)
    parser.add_argument("--sudo-password-env", default="BENCH_SUDO_PASS")
    parser.add_argument("--mice-requests", type=int, default=120)
    parser.add_argument("--mice-bytes", type=int, default=2048)
    parser.add_argument("--memcached-port-base", type=int, default=11211)
    parser.add_argument("--require-memcached", action="store_true")
    return parser.parse_args()


def parse_pairs(raw_pairs: list[str]) -> list[tuple[str, str]]:
    pairs = []
    for item in raw_pairs:
        if ":" not in item:
            raise SystemExit(f"Invalid pair '{item}', expected hSRC:hDST")
        src, dst = item.split(":", 1)
        pairs.append((src.strip(), dst.strip()))
    return pairs


def find_tool(repo_dir: Path, tool: str) -> str | None:
    local = repo_dir / ".venv/bin" / tool
    if local.exists():
        return str(local)
    return shutil.which(tool)


def require_tools(repo_dir: Path) -> dict[str, str]:
    tools = {tool: find_tool(repo_dir, tool) for tool in ("p4run", "mn", "iperf", "sudo")}
    missing = [tool for tool, path in tools.items() if path is None]
    if missing:
        raise SystemExit(
            "Missing required benchmark tools: "
            + ", ".join(missing)
            + ". Install p4-utils/BMv2/Mininet/iperf before running real paper trials."
        )
    backend_missing = [tool for tool in ("p4c", "simple_switch_grpc") if shutil.which(tool) is None]
    if backend_missing:
        raise SystemExit(
            "Missing required P4 backend tools: "
            + ", ".join(backend_missing)
            + ". Install p4c and BMv2 before running real paper trials."
        )
    return {tool: path for tool, path in tools.items() if path is not None}


def sudo_password(env_name: str) -> str:
    value = os.environ.get(env_name, "")
    if value:
        return value
    probe = subprocess.run(["sudo", "-n", "true"], capture_output=True, text=True)
    if probe.returncode == 0:
        return ""
    detail = (probe.stderr or probe.stdout or "").strip()
    raise SystemExit(
        f"Set {env_name} before running, e.g. export {env_name}=<sudo-password>. "
        f"Passwordless sudo probe failed: {detail}"
    )


def run_sudo(repo_dir: Path, password: str, cmd: list[str], timeout: int = 120) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["sudo", "-S", "-p", "", "env", f"PYTHONPATH={BENCH_PYTHONPATH}", *cmd],
        cwd=repo_dir,
        input=(password + "\n") if password else None,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def preclean(repo_dir: Path, password: str) -> None:
    run_sudo(repo_dir, password, ["mn", "-c"], timeout=120)
    for proc in ("simple_switch", "simple_switch_grpc", "iperf", "memcached"):
        run_sudo(repo_dir, password, ["pkill", "-9", "-x", proc], timeout=30)
    time.sleep(1)


def wait_prompt(child: pexpect.spawn, password: str, timeout: int) -> None:
    deadline = time.time() + timeout
    while True:
        if time.time() >= deadline:
            raise pexpect.TIMEOUT("timed out waiting for mininet prompt")
        try:
            idx = child.expect([r"\[sudo\] password.*:", r"[Pp]assword", r"mininet> "], timeout=2)
        except pexpect.TIMEOUT:
            continue
        if idx in (0, 1):
            if not password:
                raise RuntimeError("sudo requested a password but no BENCH_SUDO_PASS was provided")
            child.sendline(password)
        else:
            return


def start_mininet(repo_dir: Path, config: str, clean: bool, password: str, log_file: Path, timeout: int, p4run: str) -> pexpect.spawn:
    cmd = ["sudo", "-S", "-p", "[sudo] password for %u:", "env", f"PYTHONPATH={BENCH_PYTHONPATH}", p4run]
    # The runner already pre-cleans Mininet/BMv2 state. p4-utils --clean can
    # remove generated configs before reading them, so keep startup deterministic.
    cmd += ["--config", config]

    last_error: Exception | None = None
    for attempt in range(1, 4):
        preclean(repo_dir, password)
        with log_file.open("a", encoding="utf-8") as fh:
            fh.write(f"\n=== p4run startup attempt {attempt}/3 ===\n")
        print(f"starting p4run attempt {attempt}/3 with config={config}", flush=True)
        child = pexpect.spawn(cmd[0], cmd[1:], cwd=str(repo_dir), encoding="utf-8", timeout=timeout)
        logfile = log_file.open("a", encoding="utf-8")
        child.logfile = logfile
        child._benchmark_logfile = logfile
        try:
            wait_prompt(child, password, timeout)
            print("mininet prompt reached", flush=True)
            return child
        except Exception as exc:
            last_error = exc
            print_failure_context(
                f"p4run attempt {attempt}/3 failed while waiting for mininet prompt",
                log_file=log_file,
                child=child,
                exc=exc,
            )
            if child.isalive():
                child.terminate(force=True)
            logfile.close()
            time.sleep(2)
    raise RuntimeError(f"p4run failed to reach mininet prompt for config={config}") from last_error


def mn_cmd(child: pexpect.spawn, cmd: str, timeout: int = 180) -> str:
    child.sendline(cmd)
    child.expect(r"mininet> ", timeout=timeout)
    return child.before


def try_mn_cmd(child: pexpect.spawn, cmd: str, timeout: int = 180) -> str:
    try:
        return mn_cmd(child, cmd, timeout)
    except pexpect.TIMEOUT:
        child.sendcontrol("c")
        child.expect(r"mininet> ", timeout=30)
        return ""


def host_ip(host: str) -> str:
    match = re.fullmatch(r"h(\d+)", host)
    if not match:
        raise SystemExit(f"Unsupported host name '{host}'")
    return f"10.0.0.{int(match.group(1))}"


def parse_ping(output: str) -> tuple[float | None, float | None]:
    text = ANSI_RE.sub("", output or "")
    loss = re.search(r"(\d+(?:\.\d+)?)% packet loss", text)
    rtt = re.search(r"rtt min/avg/max(?:/mdev)? = ([\d.]+)/([\d.]+)/([\d.]+)", text)
    return (float(loss.group(1)) if loss else None, float(rtt.group(2)) if rtt else None)


def parse_rate_to_mbps(rate: str) -> float | None:
    match = re.search(r"([\d.]+)\s*([KMG])bits/sec", rate)
    if not match:
        return None
    scale = {"K": 1e-3, "M": 1.0, "G": 1e3}
    return float(match.group(1)) * scale[match.group(2)]


def parse_iperf(output: str) -> float | None:
    text = ANSI_RE.sub("", output or "")
    result_lines = [line for line in text.splitlines() if "bits/sec" in line]
    if not result_lines:
        return None
    rates = re.findall(r"[\d.]+\s*[KMG]bits/sec", result_lines[-1])
    return parse_rate_to_mbps(rates[-1]) if rates else None


def iperf_client(dst_ip: str, port: int, duration: int, iperf_len: int, udp: bool = False, udp_bandwidth: str = "10M") -> str:
    cmd = f"iperf -c {dst_ip} -p {port} -t {duration}"
    if udp:
        cmd += f" -u -b {udp_bandwidth}"
    if iperf_len > 0:
        cmd += f" -l {iperf_len}"
    return cmd


def iperf_server_cmd(port: int, udp: bool = False) -> str:
    cmd = f"iperf -s -p {port}"
    if udp:
        cmd += " -u"
    return cmd


def run_background_iperf_client(
    child: pexpect.spawn,
    src: str,
    dst_ip: str,
    port: int,
    duration: int,
    iperf_len: int,
    udp: bool,
    timeout: int,
    udp_bandwidth: str = "10M",
) -> str:
    log_path = f"/tmp/iperf_{src}_{port}.log"
    done_path = f"/tmp/iperf_{src}_{port}.done"
    mn_cmd(child, f"sh -c 'rm -f {log_path} {done_path}'", timeout=30)
    shell_cmd = f"{iperf_client(dst_ip, port, duration, iperf_len, udp=udp, udp_bandwidth=udp_bandwidth)} > {log_path} 2>&1; echo $? > {done_path}"
    mn_cmd(child, f"{src} sh -c '{shell_cmd}' &", timeout=30)

    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        done_output = try_mn_cmd(child, f"{src} cat {done_path}", timeout=5)
        if re.search(r"^\s*\d+\s*$", ANSI_RE.sub("", done_output), flags=re.MULTILINE):
            break
        time.sleep(1)
    else:
        try_mn_cmd(child, f"{src} pkill -f 'iperf -c {dst_ip} -p {port}'", timeout=30)
        log_tail = try_mn_cmd(child, f"{src} tail -n 20 {log_path}", timeout=30)
        if log_tail.strip():
            print(f"iperf client log tail for {src} -> {dst_ip}:{port}\n{ANSI_RE.sub('', log_tail)}", flush=True)
        raise TimeoutError(f"iperf client did not finish within {timeout}s for {src} -> {dst_ip}:{port}")

    return try_mn_cmd(child, f"{src} cat {log_path}", timeout=30)


def run_direct_iperf_client(
    child: pexpect.spawn,
    src: str,
    dst_ip: str,
    port: int,
    duration: int,
    iperf_len: int,
    udp: bool,
    timeout: int,
    udp_bandwidth: str = "10M",
) -> str:
    return mn_cmd(child, f"{src} {iperf_client(dst_ip, port, duration, iperf_len, udp=udp, udp_bandwidth=udp_bandwidth)}", timeout=timeout)


def measure_iperf_pair(
    child: pexpect.spawn,
    src: str,
    dst: str,
    port: int,
    duration: int,
    iperf_len: int,
    udp_throughput: bool,
    timeout: int,
    udp_bandwidth: str = "10M",
) -> tuple[float | None, str]:
    dst_ip = host_ip(dst)
    protocol = "udp" if udp_throughput else "tcp"
    out = run_direct_iperf_client(child, src, dst_ip, port, duration, iperf_len, udp_throughput, timeout, udp_bandwidth=udp_bandwidth)
    throughput = parse_iperf(out)
    if throughput is not None or udp_throughput:
        return throughput, protocol

    print(f"tcp iperf for {src} -> {dst} produced no parseable throughput; retrying with udp fallback", flush=True)
    mn_cmd(child, f"{dst} pkill -f 'iperf -s -p {port}'", timeout=30)
    mn_cmd(child, f"{dst} {iperf_server_cmd(port, udp=True)} > /tmp/iperf_s_{port}_udp.log 2>&1 &", timeout=30)
    mn_cmd(child, "sh sleep 1", timeout=30)
    try:
        out = run_direct_iperf_client(child, src, dst_ip, port, duration, iperf_len, True, timeout, udp_bandwidth=udp_bandwidth)
        throughput = parse_iperf(out)
        return throughput, "udp_fallback"
    finally:
        mn_cmd(child, f"{dst} pkill -f 'iperf -s -p {port}'", timeout=30)


def jain(values: list[float]) -> float | None:
    if not values:
        return None
    den = len(values) * sum(v * v for v in values)
    return (sum(values) ** 2 / den) if den else None


def sample_sd(values: list[float]) -> float:
    if len(values) <= 1:
        return 0.0
    avg = sum(values) / len(values)
    return math.sqrt(sum((v - avg) ** 2 for v in values) / (len(values) - 1))


def pod(host: str) -> int:
    return (int(host[1:]) - 1) // 4


def measured_interfaces(pairs: list[tuple[str, str]]) -> list[str]:
    if len(pairs) == 1 and pod(pairs[0][0]) != pod(pairs[0][1]):
        start = pod(pairs[0][0]) * 2 + 1
        return [f"a{agg}-eth{port}" for agg in (start, start + 1) for port in (3, 4)]
    return [f"a{agg}-eth{port}" for agg in range(1, 9) for port in (3, 4)]


def read_stat(child: pexpect.spawn, iface: str, stat: str) -> int:
    node = iface.split("-", 1)[0]
    out = try_mn_cmd(child, f"{node} cat /sys/class/net/{iface}/statistics/{stat}", timeout=30)
    nums = re.findall(r"^\s*(\d+)\s*$", ANSI_RE.sub("", out), flags=re.MULTILINE)
    return int(nums[-1]) if nums else 0


def counters(child: pexpect.spawn, interfaces: list[str]) -> dict[str, int]:
    return {iface: read_stat(child, iface, "tx_packets") for iface in interfaces}


def counter_summary(before: dict[str, int], after: dict[str, int]) -> dict[str, object]:
    deltas = {iface: max(0, after.get(iface, 0) - before.get(iface, 0)) for iface in before}
    vals = list(deltas.values())
    active_vals = [value for value in vals if value > 0]
    avg = sum(vals) / len(vals) if vals else None
    sd = sample_sd(vals) if vals else None
    active_avg = sum(active_vals) / len(active_vals) if active_vals else None
    active_sd = sample_sd(active_vals) if active_vals else None
    return {
        "core_link_load_mean_pkts": avg,
        "core_link_load_sd_pkts": sd,
        "core_link_load_sd_over_mean": (sd / avg) if avg else None,
        "active_core_link_count": len(active_vals),
        "active_core_link_load_mean_pkts": active_avg,
        "active_core_link_load_sd_pkts": active_sd,
        "active_core_link_load_sd_over_mean": (active_sd / active_avg) if active_avg else None,
        "core_link_load_deltas_pkts": deltas,
    }


def run_controller(repo_dir: Path, controller: str, k: str, algorithm: str, password: str) -> subprocess.CompletedProcess[str]:
    py = repo_dir / ".venv/bin/python"
    if not py.exists():
        py = Path(shutil.which("python3") or "python3")
    return run_sudo(repo_dir, password, [str(py), str(repo_dir / controller), str(k), algorithm], timeout=120)


def run_sequential(child: pexpect.spawn, pairs: list[tuple[str, str]], duration: int, iperf_len: int, udp_throughput: bool, udp_bandwidth: str, skip_pair_ping: bool) -> list[dict[str, object]]:
    rows = []
    for src, dst in pairs:
        loss, rtt = (None, None) if skip_pair_ping else parse_ping(mn_cmd(child, f"{src} ping -c 5 {dst}", timeout=120))
        mn_cmd(child, f"{dst} {iperf_server_cmd(5001, udp=udp_throughput)} > /tmp/iperf_s_5001.log 2>&1 &", timeout=30)
        mn_cmd(child, "sh sleep 1", timeout=30)
        try:
            throughput, protocol = measure_iperf_pair(
                child,
                src,
                dst,
                5001,
                duration,
                iperf_len,
                udp_throughput,
                timeout=max(40, duration + 20),
                udp_bandwidth=udp_bandwidth,
            )
        except TimeoutError:
            if udp_throughput:
                mn_cmd(child, f"{dst} pkill -f 'iperf -s -p 5001'", timeout=30)
                raise
            print(f"tcp iperf timed out for {src} -> {dst}; retrying with udp fallback", flush=True)
            mn_cmd(child, f"{dst} pkill -f 'iperf -s -p 5001'", timeout=30)
            mn_cmd(child, f"{dst} {iperf_server_cmd(5001, udp=True)} > /tmp/iperf_s_5001_udp.log 2>&1 &", timeout=30)
            mn_cmd(child, "sh sleep 1", timeout=30)
            out = run_background_iperf_client(
                child,
                src,
                host_ip(dst),
                5001,
                duration,
                iperf_len,
                True,
                timeout=max(40, duration + 20),
                udp_bandwidth=udp_bandwidth,
            )
            protocol = "udp_fallback"
            throughput = parse_iperf(out)
        finally:
            mn_cmd(child, f"{dst} pkill -f 'iperf -s -p 5001'", timeout=30)
        rows.append({"src": src, "dst": dst, "loss_pct": loss, "avg_rtt_ms": rtt, "throughput_mbps": throughput, "throughput_protocol": protocol})
    return rows


def start_mice(child: pexpect.spawn, pairs: list[tuple[str, str]], ports: dict[tuple[str, str], int], args: argparse.Namespace) -> dict[str, object]:
    mode = "memcached" if shutil.which("memcached") else "iperf_fallback"
    if args.require_memcached and mode != "memcached":
        raise SystemExit("memcached requested but /usr/bin/memcached is unavailable")
    if mode == "memcached":
        for idx, (_src, dst) in enumerate(pairs):
            port = args.memcached_port_base + idx
            try_mn_cmd(child, f"{dst} pkill -f 'memcached -p {port}'", timeout=30)
            try_mn_cmd(child, f"{dst} memcached -u root -m 32 -t 1 -p {port} > /tmp/memcached_{port}.log 2>&1 &", timeout=30)
        for idx, (src, dst) in enumerate(pairs):
            port = args.memcached_port_base + idx
            try_mn_cmd(child, f"{src} python3 benchmarks/memcached_mice_client.py {host_ip(dst)} {port} {args.mice_requests} > /tmp/mice_{src}_{dst}.ok 2>&1 &", timeout=30)
    else:
        for src, dst in pairs:
            port = ports[(src, dst)]
            cmd = f"ok=0; for i in $(seq 1 {args.mice_requests}); do iperf -c {host_ip(dst)} -p {port} -n {args.mice_bytes} >/dev/null 2>&1 && ok=$((ok+1)); done; echo $ok > /tmp/mice_{src}_{dst}.ok"
            try_mn_cmd(child, f"{src} sh -c '{cmd}' &", timeout=30)
    return {"enabled": True, "mode": mode, "requests_per_pair": args.mice_requests}


def collect_mice(child: pexpect.spawn, pairs: list[tuple[str, str]]) -> list[int]:
    values = []
    for src, dst in pairs:
        out = try_mn_cmd(child, f"{src} cat /tmp/mice_{src}_{dst}.ok", timeout=30)
        nums = re.findall(r"^\s*(\d+)\s*$", ANSI_RE.sub("", out), flags=re.MULTILINE)
        values.append(int(nums[-1]) if nums else 0)
    return values


def run_concurrent(child: pexpect.spawn, pairs: list[tuple[str, str]], args: argparse.Namespace) -> tuple[list[dict[str, object]], dict[str, object] | None, list[int]]:
    ping_stats = {pair: (None, None) for pair in pairs} if args.skip_pair_ping else {
        pair: parse_ping(mn_cmd(child, f"{pair[0]} ping -c 5 {pair[1]}", timeout=120)) for pair in pairs
    }
    ports = {}
    for idx, pair in enumerate(pairs):
        src, dst = pair
        port = 5001 + idx
        ports[pair] = port
        mn_cmd(child, f"{dst} pkill -f 'iperf -s -p {port}'", timeout=30)
        mn_cmd(child, f"{dst} {iperf_server_cmd(port, udp=args.udp_throughput)} > /tmp/iperf_s_{port}.log 2>&1 &", timeout=30)
    mn_cmd(child, "sh sleep 1", timeout=30)

    for src, dst in pairs:
        port = ports[(src, dst)]
        mn_cmd(child, f"{src} {iperf_client(host_ip(dst), port, args.duration, args.iperf_len, udp=args.udp_throughput, udp_bandwidth=args.udp_bandwidth)} > /tmp/iperf_c_{src}_{dst}_{port}.log 2>&1 &", timeout=30)

    mixed_meta = start_mice(child, pairs, ports, args) if args.traffic_profile == "mixed" else None
    mn_cmd(child, f"sh sleep {args.duration + 8}", timeout=max(240, args.duration + 120))
    mice_done = collect_mice(child, pairs) if mixed_meta else []

    rows = []
    for src, dst in pairs:
        port = ports[(src, dst)]
        out = try_mn_cmd(child, f"{src} cat /tmp/iperf_c_{src}_{dst}_{port}.log", timeout=30)
        throughput = parse_iperf(out)
        protocol = "udp" if args.udp_throughput else "tcp"
        if throughput is None and not args.udp_throughput:
            print(f"tcp iperf for {src} -> {dst} produced no parseable throughput; retrying with udp fallback", flush=True)
            mn_cmd(child, f"{dst} pkill -f 'iperf -s -p {port}'", timeout=30)
            mn_cmd(child, f"{dst} {iperf_server_cmd(port, udp=True)} > /tmp/iperf_s_{port}_udp.log 2>&1 &", timeout=30)
            mn_cmd(child, "sh sleep 1", timeout=30)
            out = run_direct_iperf_client(child, src, host_ip(dst), port, args.duration, args.iperf_len, True, timeout=max(40, args.duration + 20), udp_bandwidth=args.udp_bandwidth)
            throughput = parse_iperf(out)
            protocol = "udp_fallback"
        loss, rtt = ping_stats[(src, dst)]
        rows.append({"src": src, "dst": dst, "loss_pct": loss, "avg_rtt_ms": rtt, "throughput_mbps": throughput, "throughput_protocol": protocol})

    for _src, dst in pairs:
        for port in ports.values():
            try_mn_cmd(child, f"{dst} pkill -f 'iperf -s -p {port}'", timeout=30)
        if mixed_meta and mixed_meta["mode"] == "memcached":
            try_mn_cmd(child, f"{dst} pkill -f memcached", timeout=30)
    return rows, mixed_meta, mice_done


def write_pair_csv(path: Path, rows: list[dict[str, object]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=["src", "dst", "loss_pct", "avg_rtt_ms", "throughput_mbps", "throughput_protocol"])
        writer.writeheader()
        writer.writerows(rows)


def summarize_protocols(rows: list[dict[str, object]]) -> str | None:
    protocols = sorted({str(row.get("throughput_protocol")) for row in rows if row.get("throughput_mbps") is not None and row.get("throughput_protocol")})
    if not protocols:
        return None
    return protocols[0] if len(protocols) == 1 else ",".join(protocols)


def main() -> None:
    args = parse_args()
    repo_dir = Path(__file__).resolve().parents[1]
    tools = require_tools(repo_dir)
    password = sudo_password(args.sudo_password_env)
    pairs = parse_pairs(args.pairs)
    config_path = (repo_dir / args.config).resolve() if not Path(args.config).is_absolute() else Path(args.config)
    if not config_path.exists():
        raise SystemExit(f"Missing config: {config_path}")
    config_for_p4run = args.config if not Path(args.config).is_absolute() else str(config_path)

    results_base = repo_dir / "benchmarks/results"
    run_dir = results_base / f"{args.algorithm}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    run_dir.mkdir(parents=True, exist_ok=False)
    log_file = run_dir / "session.log"
    log_file.write_text("", encoding="utf-8")

    log_section("benchmark configuration")
    print(f"algorithm: {args.algorithm}", flush=True)
    print(f"config: {config_path}", flush=True)
    print(f"run_dir: {run_dir}", flush=True)
    print(f"pairs: {', '.join(f'{src}:{dst}' for src, dst in pairs)}", flush=True)
    print(f"traffic_mode: {args.traffic_mode}", flush=True)
    print(f"traffic_profile: {args.traffic_profile}", flush=True)
    print(f"timeout: {args.timeout}s", flush=True)

    child = start_mininet(repo_dir, config_for_p4run, args.clean, password, log_file, args.timeout, tools["p4run"])
    try:
        log_section("controller start")
        controller = run_controller(repo_dir, args.controller, args.k, args.algorithm, password)
        print(f"controller rc: {controller.returncode}", flush=True)
        if controller.stdout:
            print("--- controller stdout ---", flush=True)
            print(tail_text(controller.stdout), flush=True)
            print("--- end controller stdout ---", flush=True)
        if controller.stderr:
            print("--- controller stderr ---", flush=True)
            print(tail_text(controller.stderr), flush=True)
            print("--- end controller stderr ---", flush=True)

        log_section("mininet readiness")
        if not args.skip_pingall:
            pingall = try_mn_cmd(child, "pingall", timeout=120)
            print(tail_text(pingall), flush=True)
        else:
            pingall = ""
        if args.host_cpu > 0:
            log_section("host cpu setup")
            try_mn_cmd(child, f"py [h.setCPUFrac({args.host_cpu}) for h in net.hosts]", timeout=30)

        interfaces = measured_interfaces(pairs)
        log_section("counter snapshot before traffic")
        print(f"measuring interfaces: {', '.join(interfaces)}", flush=True)
        before = counters(child, interfaces)
        if args.traffic_mode == "sequential":
            log_section("traffic phase: sequential")
            rows = run_sequential(child, pairs, args.duration, args.iperf_len, args.udp_throughput, args.udp_bandwidth, args.skip_pair_ping)
            mixed_meta = None
            mice_done = []
        else:
            log_section("traffic phase: concurrent")
            rows, mixed_meta, mice_done = run_concurrent(child, pairs, args)
        log_section("counter snapshot after traffic")
        after = counters(child, interfaces)

        child.sendline("exit")
        child.expect(pexpect.EOF, timeout=180)

        throughputs = [float(r["throughput_mbps"]) for r in rows if r["throughput_mbps"] is not None]
        losses = [float(r["loss_pct"]) for r in rows if r["loss_pct"] is not None]
        rtts = [float(r["avg_rtt_ms"]) for r in rows if r["avg_rtt_ms"] is not None]
        summary = {
            "algorithm": args.algorithm,
            "config": str(config_path),
            "controller": args.controller,
            "controller_rc": controller.returncode,
            "controller_stdout": controller.stdout,
            "controller_stderr": controller.stderr,
            "pair_count": len(pairs),
            "pairs": [f"{src}:{dst}" for src, dst in pairs],
            "duration_s": args.duration,
            "iperf_len_bytes": args.iperf_len if args.iperf_len > 0 else None,
            "udp_bandwidth": args.udp_bandwidth if args.udp_throughput else None,
            "traffic_mode": args.traffic_mode,
            "traffic_profile": args.traffic_profile,
            "skip_pair_ping": args.skip_pair_ping,
            "throughput_protocol": summarize_protocols(rows),
            "mean_throughput_mbps": statistics.mean(throughputs) if throughputs else None,
            "stdev_throughput_mbps": statistics.pstdev(throughputs) if len(throughputs) > 1 else 0.0,
            "jain_fairness": jain(throughputs),
            "mean_rtt_ms": statistics.mean(rtts) if rtts else None,
            "mean_loss_pct": statistics.mean(losses) if losses else None,
            "measured_core_interfaces": interfaces,
            "timestamp": int(time.time()),
            "pingall_excerpt": pingall[-2000:],
        }
        if mixed_meta:
            summary["mixed_mode_runtime"] = mixed_meta["mode"]
            summary["mice_requests_per_pair"] = args.mice_requests
            summary["mice_completed_per_pair"] = mice_done
            summary["mice_completed_avg"] = statistics.mean(mice_done) if mice_done else None
        summary.update(counter_summary(before, after))

        write_pair_csv(run_dir / "pair_metrics.csv", rows)
        (run_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
        log_section("benchmark summary")
        print(f"run_dir: {run_dir}", flush=True)
        print(f"algorithm: {summary['algorithm']}", flush=True)
        print(f"mean_throughput_mbps: {summary['mean_throughput_mbps']}", flush=True)
        print(f"mean_rtt_ms: {summary['mean_rtt_ms']}", flush=True)
        print(f"mean_loss_pct: {summary['mean_loss_pct']}", flush=True)
        print(f"core_link_load_sd_over_mean: {summary['core_link_load_sd_over_mean']}", flush=True)
        if controller.returncode != 0:
            raise SystemExit("Controller failed; inspect session.log and summary.json.")
    finally:
        if getattr(child, "_benchmark_logfile", None):
            child._benchmark_logfile.close()
        if child.isalive():
            child.terminate(force=True)
        try:
            preclean(repo_dir, password)
        except Exception:
            pass


if __name__ == "__main__":
    main()
