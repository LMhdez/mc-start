(() => {
  "use strict";
  const WORKER_URL = "https://mc-start-control.luismariohernandezsantos.workers.dev";
  const POLL_MS = 30000;
  const stateNode = document.querySelector("#server-state");
  const pill = document.querySelector(".status-pill");
  const card = document.querySelector(".server-card");
  if (!stateNode || !pill || !card) return;

  const banner = document.createElement("div");
  banner.id = "availability-banner";
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");
  banner.style.cssText = "display:none;margin:0 0 1rem;padding:1rem 1.1rem;border:1px solid #8b7540;border-radius:12px;background:#292516;color:#f3dfa4;line-height:1.5";
  card.insertBefore(banner, card.firstChild);

  const dot = pill.querySelector(".status-dot");
  let maintenance = false;
  let message = "";
  const lang = () => (document.documentElement.lang || "pt").slice(0, 2);
  const words = {
    pt: { maintenance:"Em manutenção", online:"Online", offline:"Offline", starting:"A iniciar", stopping:"A desligar", unknown:"Estado indisponível", checking:"A verificar disponibilidade", maintenanceCopy:"O servidor está temporariamente em manutenção. Tenta novamente mais tarde.", unavailableCopy:"Não foi possível obter o estado atual do servidor. O estado apresentado anteriormente pode estar desatualizado." },
    en: { maintenance:"Under maintenance", online:"Online", offline:"Offline", starting:"Starting", stopping:"Shutting down", unknown:"Status unavailable", checking:"Checking availability", maintenanceCopy:"The server is temporarily under maintenance. Please try again later.", unavailableCopy:"The current server status could not be retrieved. Any previously displayed status may be outdated." },
    es: { maintenance:"En mantenimiento", online:"En línea", offline:"Desconectado", starting:"Iniciando", stopping:"Apagándose", unknown:"Estado no disponible", checking:"Comprobando disponibilidad", maintenanceCopy:"El servidor está temporalmente en mantenimiento. Inténtalo de nuevo más tarde.", unavailableCopy:"No se pudo obtener el estado actual del servidor. El estado anterior podría estar desactualizado." }
  };
  const t = () => words[lang()] || words.pt;
  function setState(label, kind, detail = "") {
    stateNode.textContent = label;
    if (dot) {
      dot.classList.toggle("status-dot-muted", kind === "offline" || kind === "unknown" || kind === "maintenance");
      dot.classList.toggle("status-dot-pending", kind === "pending");
    }
    banner.style.display = detail ? "block" : "none";
    banner.textContent = detail;
  }
  async function refresh() {
    try {
      const maintenanceResponse = await fetch("./maintenance.json?ts=" + Date.now(), { cache: "no-store" });
      if (!maintenanceResponse.ok) throw new Error("maintenance config unavailable");
      const config = await maintenanceResponse.json();
      maintenance = config.enabled === true;
      message = typeof config.message === "string" ? config.message.trim().slice(0, 240) : "";
      if (maintenance) {
        setState(t().maintenance, "maintenance", message || t().maintenanceCopy);
        return;
      }
      const statusResponse = await fetch(WORKER_URL + "/api/public/status", { cache: "no-store" });
      if (!statusResponse.ok) throw new Error("status endpoint unavailable");
      const payload = await statusResponse.json();
      if (!payload || payload.ok !== true || !payload.result) throw new Error("invalid status payload");
      const result = payload.result;
      if (result.vm === "VM deallocated" || result.vm === "VM stopped") {
        setState(t().offline, "offline");
      } else if (result.vm === "VM starting") {
        setState(t().starting, "pending");
      } else if (result.vm === "VM stopping") {
        setState(t().stopping, "pending");
      } else if (result.vm === "VM running" && result.docker === "active" &&
          result.container === "running" && result.port_open === true &&
          result.rcon_ready === true && result.geyser_ready === true) {
        setState(t().online, "online");
      } else if (result.vm === "VM running") {
        setState(t().checking, "pending");
      } else {
        setState(t().unknown, "unknown", t().unavailableCopy);
      }
    } catch {
      if (!maintenance) setState(t().unknown, "unknown", t().unavailableCopy);
    }
  }
  refresh();
  window.setInterval(refresh, POLL_MS);
  window.addEventListener("languagechange", refresh);
})();
