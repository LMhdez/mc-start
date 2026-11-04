(() => {
  "use strict";
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
  let lastResult = null;
  const lang = () => (document.documentElement.lang || "pt").slice(0, 2);
  const words = {
    pt: { maintenance:"Em manutenção", online:"Servidor online! Já podes entrar.", offline:"Servidor desligado.", starting:"Estamos a ligar o servidor. Obrigado pela paciência!", stopping:"Estamos a desligar o servidor. Obrigado por aguardares!", unknown:"Não foi possível verificar o estado do servidor.", checking:"Estamos a preparar o mundo. Por favor, aguarda mais um pouco.", maintenanceCopy:"Estamos a melhorar o mundo. Obrigado pela compreensão. Voltamos em breve!", unavailableCopy:"Não foi possível verificar o estado do servidor. Tenta novamente dentro de momentos." },
    en: { maintenance:"Under maintenance", online:"Server online! You can join now.", offline:"Server offline.", starting:"Starting the server. Thank you for your patience!", stopping:"We are shutting down the server. Thank you for waiting!", unknown:"We could not check the server status.", checking:"We are preparing the world. Please bear with us a little longer.", maintenanceCopy:"We are making improvements to the world. Thank you for your understanding. We will be back soon!", unavailableCopy:"We could not check the server status. Please try again in a moment." },
    es: { maintenance:"En mantenimiento", online:"¡Servidor en línea! Ya puedes entrar.", offline:"Servidor desconectado.", starting:"Estamos encendiendo el servidor. ¡Gracias por tu paciencia!", stopping:"Estamos apagando el servidor. ¡Gracias por esperar!", unknown:"No se pudo comprobar el estado del servidor.", checking:"Estamos preparando el mundo. Por favor, espera un poco más.", maintenanceCopy:"Estamos mejorando el mundo. Gracias por tu comprensión. ¡Volveremos pronto!", unavailableCopy:"No se pudo comprobar el estado del servidor. Inténtalo de nuevo dentro de un momento." }
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
  function renderServerStatus(result) {
    if (maintenance || !result) return;
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
  }

  function applyMaintenanceState() {
    if (maintenance) {
      setState(t().maintenance, "maintenance", message || t().maintenanceCopy);
    } else if (lastResult) {
      renderServerStatus(lastResult);
    } else {
      setState(t().unknown, "unknown", t().unavailableCopy);
    }
  }

  window.addEventListener("mc:server-status", event => {
    const result = event.detail;
    if (!result || typeof result !== "object") return;
    lastResult = result;
    renderServerStatus(lastResult);
  });

  // Keep the maintenance label authoritative while script.js renders live status.
  const statusObserver = new MutationObserver(() => {
    if (maintenance && stateNode.textContent !== t().maintenance) {
      setState(t().maintenance, "maintenance", message || t().maintenanceCopy);
    }
  });
  statusObserver.observe(stateNode, { childList: true, characterData: true, subtree: true });

  async function refreshMaintenance() {
    try {
      const response = await fetch("./maintenance.json?ts=" + Date.now(), { cache: "no-store" });
      if (!response.ok) throw new Error("maintenance config unavailable");
      const config = await response.json();
      maintenance = config.enabled === true;
      message = typeof config.message === "string" ? config.message.trim().slice(0, 240) : "";
      applyMaintenanceState();
    } catch {
      // Preserve the last known status if the static maintenance config is unavailable.
      if (maintenance) applyMaintenanceState();
    }
  }

  refreshMaintenance();
  window.setInterval(refreshMaintenance, POLL_MS);
  window.addEventListener("languagechange", applyMaintenanceState);
})();
