#!/usr/bin/env python3
import os
import json
import re
import ipaddress
import time
import socket
import subprocess
import urllib.request
import tempfile
import zipfile
import base64
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

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


# Cache local: devolve o IP diretamente na resposta /status do agente.
_PUBLIC_IP_CACHE = ""
_PUBLIC_IP_CACHE_AT = 0.0
_PUBLIC_IP_CACHE_TTL = 300


def get_public_ip():
    global _PUBLIC_IP_CACHE, _PUBLIC_IP_CACHE_AT

    now = time.monotonic()
    if _PUBLIC_IP_CACHE and now - _PUBLIC_IP_CACHE_AT < _PUBLIC_IP_CACHE_TTL:
        return _PUBLIC_IP_CACHE

    try:
        request = urllib.request.Request(
            "https://api.ipify.org",
            headers={"User-Agent": "MCPrivateAgent/1.0"},
        )
        with urllib.request.urlopen(request, timeout=2) as response:
            candidate = response.read(64).decode("ascii", errors="ignore").strip()

        address = ipaddress.ip_address(candidate)
        if address.version != 4:
            return _PUBLIC_IP_CACHE

        _PUBLIC_IP_CACHE = str(address)
        _PUBLIC_IP_CACHE_AT = now
        return _PUBLIC_IP_CACHE
    except Exception:
        # Se o serviço externo falhar, conserva o último IP confirmado.
        return _PUBLIC_IP_CACHE


# Confirma o protocolo RakNet, em vez de assumir que uma porta UDP aberta está funcional.
def probe_bedrock_udp(host="127.0.0.1", port=19132, timeout=1):
    """Confirma uma resposta RakNet/Geyser UDP no próprio host."""
    magic = bytes.fromhex("00ffff00fefefefefdfdfdfd12345678")
    timestamp = int(time.time() * 1000).to_bytes(8, "big", signed=True)
    client_guid = os.urandom(8)
    packet = b"\x01" + timestamp + magic + client_guid

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.settimeout(timeout)
            probe.sendto(packet, (host, port))
            response, _ = probe.recvfrom(2048)
        return (
            len(response) >= 35
            and response[0] == 0x1C
            and response[17:33] == magic
        )
    except OSError:
        return False


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
            players = None
            player_names = None
            result = run_command(
                ["docker", "exec", CONTAINER, "rcon-cli", "list"],
                timeout=10,
            )
            if result.returncode == 0:
                output = result.stdout + "\n" + result.stderr
                count_match = re.search(r"There are (\d+) of", output, re.IGNORECASE)
                if count_match:
                    players = int(count_match.group(1))
                    names_match = re.search(
                        r"players online:\s*(.*)",
                        output,
                        re.IGNORECASE,
                    )
                    if names_match:
                        player_names = [
                            name.strip()
                            for name in names_match.group(1).split(",")
                            if name.strip()
                        ]
                    elif players == 0:
                        player_names = []

    try:
        with socket.create_connection(("127.0.0.1", 25565), timeout=1):
            port_open = True
    except OSError:
        port_open = False

    # RCON só pode estar pronto quando o contentor está ativo e a consulta respondeu.
    rcon_ready = container_state == "running" and players is not None

    # O estado do Geyser e do NetherNet é confirmado pelos registos do arranque
    # atual do contentor; uma porta TCP/UDP aberta, por si só, não é suficiente.
    geyser_ready = False
    geyser_state = "not_ready"
    geyser_udp_ready = None
    geyser_udp_state = "unknown"
    geyser_udp_diagnostic = "not_checked"
    geyser_transport = "unknown"
    if container_state == "running":
        started = run_command(
            ["docker", "inspect", "-f", "{{.State.StartedAt}}", CONTAINER],
            timeout=5,
        )
        if started.returncode == 0 and started.stdout.strip():
            log_check = run_command(
                [
                    "bash", "-lc",
                    "docker logs --since \"$1\" \"$2\" 2>&1 | "
                    "grep -Ei 'Loading Geyser version|Built-in signaling started' | tail -n 30",
                    "_", started.stdout.strip(), CONTAINER,
                ],
                timeout=10,
            )
            geyser_logs = log_check.stdout + "\n" + log_check.stderr
            geyser_loaded = re.search(r"Loading Geyser version", geyser_logs, re.IGNORECASE)
            signaling_ready = re.search(r"Built-in signaling started", geyser_logs, re.IGNORECASE)
            if geyser_loaded:
                geyser_state = "initializing"
            if geyser_loaded and signaling_ready:
                geyser_ready = True
                geyser_state = "ready"
                # O signaling integrado confirma que o serviço NetherNet arrancou.
                # NetherNet não responde ao Unconnected Ping RakNet usado no
                # teste UDP legado. Não tratar a ausência desse pong como falha.
                # A acessibilidade externa e uma sessão Bedrock real continuam
                # por confirmar por este agente.
                geyser_transport = "nethernet"
                geyser_udp_ready = None
                geyser_udp_state = "not_applicable"
                geyser_udp_diagnostic = "nethernet_signaling_ready_external_access_unverified"

    return {
        "vm": "VM running",
        "ip": get_public_ip(),
        "port_open": port_open,
        "rcon_ready": rcon_ready,
        "geyser_ready": geyser_ready,
        "geyser_state": geyser_state,
        "geyser_transport": geyser_transport,
        "geyser_udp_ready": geyser_udp_ready,
        "geyser_udp_state": geyser_udp_state,
        "geyser_udp_diagnostic": geyser_udp_diagnostic,
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
    mods = []
    plugins = []
    mods_inventory_available = False

    def inspect_jars(folder, kind, limit=40):  # Read metadata and optional artwork from installed JARs
        """Lê metadados públicos dos JARs sem executar os mods/plugins."""
        result = run_command(
            ["docker", "exec", CONTAINER, "sh", "-lc",
             "find " + folder + " -maxdepth 1 -type f -name '*.jar' -printf '%f\\n' 2>/dev/null"],
            timeout=8,
        )
        if result.returncode != 0:
            return [], False
        filenames = [name.strip() for name in result.stdout.splitlines() if name.strip()][:limit]
        found = []
        with tempfile.TemporaryDirectory(prefix="mc-metadata-") as temp_dir:
            # Copia em lote: uma operacao por pasta, em vez de uma chamada Docker por ficheiro JAR.
            copied = run_command(["docker", "cp", f"{CONTAINER}:{folder}/.", temp_dir], timeout=30)
            if copied.returncode != 0:
                return [], False
            for filename in filenames:
                if "/" in filename or filename in (".", ".."):
                    continue
                local_path = os.path.join(temp_dir, filename)
                if not os.path.isfile(local_path):
                    continue
                item = {"file": filename, "id": "", "name": filename[:-4], "version": "", "description": ""}
                icon_path = ""
                try:
                    with zipfile.ZipFile(local_path) as archive:
                        names = set(archive.namelist())
                        if kind == "mod":
                            if "fabric.mod.json" in names:
                                metadata = json.loads(archive.read("fabric.mod.json").decode("utf-8"))
                                item["id"] = str(metadata.get("id") or "")
                                item["name"] = metadata.get("name") or metadata.get("id") or item["name"]
                                item["version"] = str(metadata.get("version") or "")
                                item["description"] = str(metadata.get("description") or "")
                                icon_value = metadata.get("icon")
                                if isinstance(icon_value, str):
                                    icon_path = icon_value
                                elif isinstance(icon_value, dict) and icon_value:
                                    icon_path = max(icon_value.items(), key=lambda pair: int(pair[0]) if str(pair[0]).isdigit() else 0)[1]
                            elif "META-INF/mods.toml" in names:
                                try:
                                    import tomllib
                                    metadata = tomllib.loads(archive.read("META-INF/mods.toml").decode("utf-8"))
                                    mod = (metadata.get("mods") or [{}])[0]
                                    item["name"] = mod.get("displayName") or mod.get("modId") or item["name"]
                                    item["version"] = str(mod.get("version") or "")
                                    item["description"] = str(mod.get("description") or "")
                                except Exception:
                                    pass
                            elif "mcmod.info" in names:
                                metadata = json.loads(archive.read("mcmod.info").decode("utf-8"))
                                if isinstance(metadata, list) and metadata:
                                    item["name"] = metadata[0].get("name") or item["name"]
                                    item["version"] = str(metadata[0].get("version") or "")
                                    item["description"] = str(metadata[0].get("description") or "")
                        elif "plugin.yml" in names:
                            metadata = archive.read("plugin.yml").decode("utf-8", errors="replace")
                            for key, target in [("name", "name"), ("version", "version"), ("description", "description")]:
                                match = re.search(r"(?m)^" + key + r":\s*(.+)$", metadata)
                                if match:
                                    item[target] = match.group(1).strip().strip('"').strip("'")
                        if icon_path and isinstance(icon_path, str) and ".." not in icon_path.split("/"):
                            extension = os.path.splitext(icon_path.lower())[1]
                            mime = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif"}.get(extension)
                            if mime and icon_path in names:
                                image_bytes = archive.read(icon_path)
                                if 0 < len(image_bytes) <= 32768:
                                    item["icon"] = "data:" + mime + ";base64," + base64.b64encode(image_bytes).decode("ascii")
                except Exception:
                    pass
                item["description"] = item["description"][:400]
                found.append(item)
        return found, True

    if output(["docker", "inspect", CONTAINER]):
        container_state = output(["docker", "inspect", "-f", "{{.State.Status}}", CONTAINER])
        java_result = run_command(["docker", "exec", CONTAINER, "sh", "-lc", "java -version"], timeout=8)
        java_text = (java_result.stderr or java_result.stdout).strip()
        match = re.search(r'version "([^"]+)"', java_text)
        if match:
            java_version = match.group(1)

        logs = output(["docker", "logs", "--tail", "3000", CONTAINER], timeout=12)
        # Remove sequências ANSI antes de analisar logs de diferentes versões do loader.
        logs = re.sub(r"\x1B\[[0-?]*[ -/]*[@-~]", "", logs).replace("\r", "")
        version_patterns = (
            r"Starting minecraft server version\s+([0-9]+(?:\.[0-9]+)+)",
            r"Loading Minecraft\s+([0-9]+(?:\.[0-9]+)+)\s+with Fabric Loader\s+([0-9]+(?:\.[0-9]+)+)",
            r"Minecraft(?: server)? version\s*[:=]\s*([0-9]+(?:\.[0-9]+)+)",
        )
        for pattern in version_patterns:
            match = re.search(pattern, logs, re.IGNORECASE)
            if match:
                minecraft_version = match.group(1)
                if len(match.groups()) > 1:
                    fabric_loader_version = match.group(2)
                    server_type = "Fabric"
                break

        # Consulta exclusivamente VERSION; nunca despeja o ambiente do contentor.
        if not minecraft_version:
            configured_version = run_command(
                ["docker", "exec", CONTAINER, "sh", "-lc", 'printf "%s" "${VERSION:-}"'],
                timeout=5,
            )
            candidate = configured_version.stdout.strip()
            if configured_version.returncode == 0 and re.fullmatch(r"[0-9]+(?:\.[0-9]+)+", candidate):
                minecraft_version = candidate

        if "fabric_loader_version" not in locals():
            fabric_loader_version = "Não identificado"

        image_lower = image.lower()
        if server_type != "Fabric" and "itzg/minecraft-server" in image_lower:
            server_type = "Não identificado (imagem itzg/minecraft-server)"
        elif server_type != "Fabric" and image:
            server_type = image

        installed_mods, mods_inventory_available = inspect_jars("/data/mods", "mod")
        plugins, _ = inspect_jars("/data/plugins", "plugin")
        installed_ids = {str(item.get("id", "")).lower() for item in installed_mods}
        if server_type != "Fabric" and installed_ids.intersection({"fabric-api", "geyser-fabric", "lithium", "ferritecore"}):
            server_type = "Fabric"

        # O bloco Fabric e a fonte de verdade: considera apenas entradas principais
        # do ultimo arranque e ignora dependencias indentadas (|-- / \\--).
        loaded_entries = []
        lines = logs.splitlines()
        for index, line in enumerate(lines):
            header = re.search(r"Loading (\d+) mods:", line)
            if not header:
                continue
            entries = []
            for candidate in lines[index + 1:]:
                if re.match(r"^\[\d{2}:\d{2}:\d{2}\]", candidate):
                    break
                root = re.match(r"^\s{8}- ([^\s]+) ([^\s]+)\s*$", candidate)
                if root:
                    mod_id, runtime_version = root.groups()
                    if mod_id not in {"fabricloader", "java", "minecraft"}:
                        entries.append((mod_id, runtime_version))
            loaded_entries = entries

        # O inventário dos JARs é a fonte pública principal. A lista dos logs
        # complementa as versões em execução, mas não pode esconder mods instalados
        # quando a formatação do Fabric muda entre versões.
        loaded_versions = {mod_id: version for mod_id, version in loaded_entries}
        mods = []
        if installed_mods:
            for installed in installed_mods:
                item = dict(installed)
                runtime_version = loaded_versions.get(item.get("id"))
                if runtime_version:
                    item["version"] = runtime_version
                    item["status"] = "loaded"
                else:
                    item["status"] = "installed" if container_state == "running" else "last_loaded"
                mods.append(item)
        else:
            for mod_id, runtime_version in loaded_entries:
                item = {"id": mod_id, "name": mod_id, "version": runtime_version, "description": ""}
                item["status"] = "loaded" if container_state == "running" else "last_loaded"
                mods.append(item)

        mod_count_matches = re.findall(r"Loading (\d+) mods:", logs)
        mod_count = len(mods)
        fabric_total = int(mod_count_matches[-1]) if mod_count_matches else len(loaded_entries)

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
        "fabric_loader": fabric_loader_version if "fabric_loader_version" in locals() else "Não identificado",
        "server_type": server_type,
        "mods": mods,
        "mods_inventory_available": mods_inventory_available,
        "mod_count": mod_count if "mod_count" in locals() else len(mods),
        "fabric_total": fabric_total if "fabric_total" in locals() else 0,
        "mods_status": "loaded" if "loaded_entries" in locals() and loaded_entries and container_state == "running" else "installed" if "container_state" in locals() and container_state == "running" else "last_loaded",
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
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
