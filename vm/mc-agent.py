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



def read_technical():
    """Recolhe apenas especificacoes tecnicas; nunca inclui IPs ou dados de ligacao."""
    def output(args, timeout=5):
        result = run_command(args, timeout=timeout)
        return result.stdout.strip() if result.returncode == 0 else ""

    os_name = "Linux"
    os_version = ""
    try:
        with open("/etc/os-release", "r", encoding="utf-8") as file:
            values = {}
            for line in file:
                if "=" in line:
                    key, value = line.rstrip().split("=", 1)
                    values[key] = value.strip().strip('"')
            os_name = values.get("PRETTY_NAME", os_name)
            os_version = values.get("VERSION_ID", "")
    except OSError:
        pass

    def service_state(name):
        result = run_command(["systemctl", "is-active", name], timeout=5)
        return result.stdout.strip() or result.stderr.strip() or "unknown"

    services = {
        "docker": service_state("docker"),
        "mc_private_agent": service_state("mc-private-agent"),
        "cloudflared": service_state("cloudflared"),
    }

    docker_version = output(["docker", "--version"])
    docker_server_version = output(["docker", "version", "--format", "{{.Server.Version}}"])
    python_version = output(["python3", "--version"])
    apt_version = output(["apt", "--version"])
    systemd_version = output(["systemctl", "--version"])
    image = output(["docker", "inspect", "-f", "{{.Config.Image}}", CONTAINER])
    java_version = ""
    minecraft_version = ""
    server_type = "Não identificado"
    mods = "Não verificado"
    plugins = "Não verificado"

    if output(["docker", "inspect", CONTAINER]):
        java_result = run_command(["docker", "exec", CONTAINER, "sh", "-lc", "java -version"], timeout=8)
        java_text = (java_result.stderr or java_result.stdout).strip()
        match = re.search(r'version "([^"]+)"', java_text)
        if match:
            java_version = match.group(1)

        logs = output(["docker", "logs", "--tail", "300", CONTAINER], timeout=8)
        match = re.search(r"Starting minecraft server version ([0-9.]+)", logs, re.IGNORECASE)
        if match:
            minecraft_version = match.group(1)

        image_lower = image.lower()
        if "itzg/minecraft-server" in image_lower:
            server_type = "itzg/minecraft-server (tipo configurado por variáveis)"
        elif image:
            server_type = image

        for folder, key in [("/data/mods", "mods"), ("/data/plugins", "plugins")]:
            check = run_command(["docker", "exec", CONTAINER, "sh", "-lc",
                                 "find " + folder + " -maxdepth 1 -type f -name '*.jar' 2>/dev/null | wc -l"], timeout=5)
            if check.returncode == 0:
                count = check.stdout.strip()
                if key == "mods":
                    mods = count + " .jar" if count.isdigit() else "Não verificado"
                else:
                    plugins = count + " .jar" if count.isdigit() else "Não verificado"

    return {
        "os": os_name,
        "os_version": os_version or "Não identificada",
        "architecture": output(["uname", "-m"]) or "Não identificada",
        "kernel": output(["uname", "-r"]) or "Não identificado",
        "python": python_version or "Não identificado",
        "apt": apt_version.splitlines()[0] if apt_version else "Não identificado",
        "systemd": systemd_version.splitlines()[0] if systemd_version else "Não identificado",
        "docker": docker_version or "Não identificado",
        "docker_server": docker_server_version or "Não identificado",
        "cloudflared": output(["cloudflared", "--version"]) or "Não instalado ou não disponível",
        "services": services,
        "container_image": image or "Não identificado",
        "java": java_version or "Não identificado",
        "minecraft": minecraft_version or "Não identificado nos logs",
        "server_type": server_type,
        "mods": mods,
        "plugins": plugins,
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
        if self.path == "/technical":
            try:
                self.send_json({"ok": True, "result": read_technical()})
            except Exception:
                self.send_json({"ok": False, "message": "Technical check failed"}, 500)
            return
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
