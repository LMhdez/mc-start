#!/usr/bin/env python3
import ipaddress
import json
import re
import socket
import subprocess
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

HOST = "127.0.0.1"
PORT = 8765
CONTAINER = "mc-server"


def run_command(args, timeout=10):
    return subprocess.run(
        args,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )


def get_public_ip():
    # Azure IMDS: read the instance network data using a stable API version.
    url = "http://169.254.169.254/metadata/instance?api-version=2021-02-01"
    request = urllib.request.Request(url, headers={"Metadata": "true"})
    try:
        with urllib.request.urlopen(request, timeout=3) as response:
            metadata = json.loads(response.read().decode("utf-8"))

        interfaces = metadata.get("network", {}).get("interface", [])
        for interface in interfaces:
            addresses = interface.get("ipv4", {}).get("ipAddress", [])
            for address in addresses:
                public_ip = (address.get("publicIpAddress") or "").strip()
                if public_ip:
                    # Do not return malformed or unexpected metadata values.
                    return str(ipaddress.IPv4Address(public_ip))
    except Exception:
        pass
    return ""


def read_status():
    docker_state = "inactive"
    container_state = "not_found"
    players = 0
    player_names = []

    docker = run_command(["systemctl", "is-active", "docker"], timeout=5)
    if docker.returncode == 0 and docker.stdout.strip() == "active":
        docker_state = "active"

    inspect = run_command(["docker", "inspect", CONTAINER], timeout=5)
    if inspect.returncode == 0:
        state = run_command(
            ["docker", "inspect", "-f", "{{.State.Status}}", CONTAINER],
            timeout=5,
        )
        if state.returncode == 0:
            container_state = state.stdout.strip() or "unknown"

        if container_state == "running":
            result = run_command(
                ["docker", "exec", CONTAINER, "rcon-cli", "list"],
                timeout=10,
            )
            output = result.stdout + "\n" + result.stderr
            count_match = re.search(r"There are (\d+) of", output, re.IGNORECASE)
            if count_match:
                players = int(count_match.group(1))

            names_match = re.search(
                r"players online:\s*(.*)",
                output,
                re.IGNORECASE,
            )
            if names_match and names_match.group(1).strip():
                player_names = [
                    name.strip()
                    for name in names_match.group(1).split(",")
                    if name.strip()
                ]

    try:
        with socket.create_connection(("127.0.0.1", 25565), timeout=1):
            port_open = True
    except OSError:
        port_open = False

    return {
        "vm": "VM running",
        "ip": get_public_ip(),
        "port_open": port_open,
        "docker": docker_state,
        "container": container_state,
        "players": players,
        "player_names": player_names,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


def stop_server():
    inspect = run_command(["docker", "inspect", CONTAINER], timeout=5)
    if inspect.returncode != 0:
        return {"ok": True, "message": "Container is already absent."}

    state = run_command(
        ["docker", "inspect", "-f", "{{.State.Status}}", CONTAINER],
        timeout=5,
    )
    if state.returncode != 0 or state.stdout.strip() != "running":
        return {"ok": True, "message": "Container is already stopped."}

    stopped = run_command(["docker", "stop", "--time", "30", CONTAINER], timeout=40)
    if stopped.returncode != 0:
        raise RuntimeError(stopped.stderr.strip() or "Could not stop Minecraft container.")
    return {"ok": True, "message": "Minecraft container stopped."}


class Handler(BaseHTTPRequestHandler):
    server_version = "MCPrivateAgent/1.0"

    def send_json(self, payload, status=200):
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path != "/status":
            self.send_json({"ok": False, "message": "Not found"}, 404)
            return
        try:
            self.send_json({"ok": True, "result": read_status()})
        except Exception:
            self.send_json({"ok": False, "message": "Status check failed"}, 500)

    def do_POST(self):
        if self.path != "/stop":
            self.send_json({"ok": False, "message": "Not found"}, 404)
            return
        try:
            self.send_json(stop_server())
        except Exception:
            self.send_json({"ok": False, "message": "Could not stop Minecraft"}, 500)

    def log_message(self, fmt, *args):
        # Keep request logs free of any potentially sensitive request data.
        return


if __name__ == "__main__":
    HTTPServer((HOST, PORT), Handler).serve_forever()
