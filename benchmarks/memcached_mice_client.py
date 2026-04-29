#!/usr/bin/env python3
"""Tiny memcached text-protocol client used for mixed benchmark traffic."""

from __future__ import annotations

import socket
import sys
import time


def recv_until(sock: socket.socket, marker: bytes, limit: int = 65536) -> bytes:
    data = b""
    while marker not in data and len(data) < limit:
        chunk = sock.recv(4096)
        if not chunk:
            break
        data += chunk
    return data


def one_request(host: str, port: int, idx: int) -> bool:
    key = f"k{idx}".encode()
    value = b"x" * 128
    with socket.create_connection((host, port), timeout=2.0) as sock:
        sock.sendall(b"set " + key + b" 0 30 " + str(len(value)).encode() + b"\r\n" + value + b"\r\n")
        if b"STORED" not in recv_until(sock, b"\r\n"):
            return False
        sock.sendall(b"get " + key + b"\r\n")
        return b"END\r\n" in recv_until(sock, b"END\r\n")


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("usage: memcached_mice_client.py <host> <port> <requests>")
    host = sys.argv[1]
    port = int(sys.argv[2])
    requests = int(sys.argv[3])
    ok = 0
    for idx in range(requests):
        try:
            ok += 1 if one_request(host, port, idx) else 0
        except Exception:
            time.sleep(0.02)
    print(ok)


if __name__ == "__main__":
    main()
