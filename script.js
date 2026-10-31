// URL publica do Cloudflare Worker. Nunca colocar tokens neste ficheiro.
const WORKER_URL = "https://mc-start-control.luismariohernandezsantos.workers.dev";

const passwordInput = document.querySelector("#access-password");
const feedback = document.querySelector("#feedback");
const languageSelect = document.querySelector("#language-select");
const buttons = [
  document.querySelector("#start-button"),
  document.querySelector("#stop-button"),
  document.querySelector("#status-button")
];

const translations = {
  pt: {
    languageLabel: "IDIOMA", panelLabel: "PAINEL INFORMATIVO",
    eyebrow: "O TEU MUNDO. À TUA MANEIRA.", heroLine1: "O servidor está", heroLine2: "à tua espera.",
    heroCopy: "Consulta as instruções para entrar no servidor e acompanha as informações disponíveis.",
    serverStatus: "ESTADO DO SERVIDOR", statusNote: "Estado consultado pela Azure e GitHub Actions",
    serverAddress: "ENDEREÇO DO SERVIDOR", addressUnavailable: "Disponível após ligar o servidor",
    playersOnline: "JOGADORES ONLINE", manualCheck: "Consulta manual", viaActions: "via Actions",
    passwordLabel: "PALAVRA-PASSE DE ACESSO", passwordPlaceholder: "Introduz a palavra-passe partilhada",
    start: "Ligar servidor", stop: "Desligar servidor", check: "Pedir verificação",
    initialFeedback: "Introduz a palavra-passe para controlar o servidor.",
    howTo: "COMO ENTRAR", joinAdventure: "Junta-te à aventura.",
    step1Title: "Espera que o servidor ligue", step1Copy: "Quando o servidor estiver online, podes avançar.",
    step2Title: "Abre o Minecraft", step2Copy: "Escolhe Multijogador e adiciona o endereço do servidor.",
    step3Title: "Entra e diverte-te", step3Copy: "Joga com os teus amigos. O servidor trata do resto.",
    footer: "Feito para jogar com amigos.", emptyPassword: "Introduz a palavra-passe de acesso.",
    sending: "A enviar pedido...", startSent: "Pedido para ligar o servidor enviado.",
    stopSent: "Pedido para desligar o servidor enviado.", checkSent: "Pedido de verificação enviado.",
    waiting: "A resposta costuma chegar em 15–25 segundos. O arranque da máquina virtual pode demorar mais.", wrongPassword: "Palavra-passe incorreta.",
    notAllowed: "Origem não autorizada.", incomplete: "Configuração do painel incompleta.",
    requestError: "O pedido não foi aceite. Tenta novamente mais tarde.",
    connectionError: "Erro de comunicação com o serviço.",
    vmState: "Estado da VM", vmDeallocated: "Servidor desligado", vmRunning: "Servidor online", vmStopped: "Servidor parado", vmStarting: "A iniciar", vmStopping: "A desligar", vmUnknown: "Estado desconhecido", notChecked: "Não verificado (VM desligada)", dockerActive: "Ativo", dockerInactive: "Inativo", containerRunning: "Em execução", containerExited: "Parado", containerNotFound: "Não encontrado", dockerState: "Docker", containerState: "Contentor", portState: "Porta 25565", playerNames: "Jogadores", checkedAt: "Verificado", noPlayers: "Ninguém online", statusReady: "Estado atualizado.", statusTimeout: "A verificação ainda não terminou. Tenta consultar novamente daqui a pouco.", portOpen: "Acessível", portClosed: "Inacessível"
  },
  es: {
    languageLabel: "IDIOMA", panelLabel: "PANEL INFORMATIVO",
    eyebrow: "TU MUNDO. A TU MANERA.", heroLine1: "El servidor está", heroLine2: "esperándote.",
    heroCopy: "Consulta las instrucciones para entrar al servidor y revisa la información disponible.",
    serverStatus: "ESTADO DEL SERVIDOR", statusNote: "Estado consultado mediante Azure y GitHub Actions",
    serverAddress: "DIRECCIÓN DEL SERVIDOR", addressUnavailable: "Disponible cuando se inicie el servidor",
    playersOnline: "JUGADORES EN LÍNEA", manualCheck: "Consulta manual", viaActions: "mediante Actions",
    passwordLabel: "CONTRASEÑA DE ACCESO", passwordPlaceholder: "Introduce la contraseña compartida",
    start: "Iniciar servidor", stop: "Apagar servidor", check: "Solicitar comprobación",
    initialFeedback: "Introduce la contraseña para controlar el servidor.",
    howTo: "CÓMO ENTRAR", joinAdventure: "Únete a la aventura.",
    step1Title: "Espera a que se inicie el servidor", step1Copy: "Cuando el servidor esté en línea, podrás continuar.",
    step2Title: "Abre Minecraft", step2Copy: "Elige Multijugador y añade la dirección del servidor.",
    step3Title: "Entra y diviértete", step3Copy: "Juega con tus amigos. El servidor se encarga del resto.",
    footer: "Hecho para jugar con amigos.", emptyPassword: "Introduce la contraseña de acceso.",
    sending: "Enviando solicitud...", startSent: "Se ha enviado la solicitud para iniciar el servidor.",
    stopSent: "Se ha enviado la solicitud para apagar el servidor.", checkSent: "Se ha enviado la solicitud de comprobación.",
    waiting: "La respuesta suele llegar en 15–25 segundos. El arranque de la máquina virtual puede tardar más.", wrongPassword: "Contraseña incorrecta.",
    notAllowed: "Origen no autorizado.", incomplete: "La configuración del panel está incompleta.",
    requestError: "No se ha aceptado la solicitud. Inténtalo de nuevo más tarde.",
    connectionError: "Error de comunicación con el servicio.",
    vmState: "Estado de la VM", vmDeallocated: "Servidor apagado", vmRunning: "Servidor en línea", vmStopped: "Servidor detenido", vmStarting: "Iniciando", vmStopping: "Apagando", vmUnknown: "Estado desconocido", notChecked: "No comprobado (VM apagada)", dockerActive: "Activo", dockerInactive: "Inactivo", containerRunning: "En ejecución", containerExited: "Detenido", containerNotFound: "No encontrado", dockerState: "Docker", containerState: "Contenedor", portState: "Puerto 25565", playerNames: "Jugadores", checkedAt: "Comprobado", noPlayers: "Nadie conectado", statusReady: "Estado actualizado.", statusTimeout: "La comprobación aún no ha terminado. Vuelve a consultar dentro de un momento.", portOpen: "Accesible", portClosed: "Inaccesible"
  },
  en: {
    languageLabel: "LANGUAGE", panelLabel: "SERVER DASHBOARD",
    eyebrow: "YOUR WORLD. YOUR WAY.", heroLine1: "The server is", heroLine2: "waiting for you.",
    heroCopy: "Read the instructions to join the server and check the available information.",
    serverStatus: "SERVER STATUS", statusNote: "Status checked through Azure and GitHub Actions",
    serverAddress: "SERVER ADDRESS", addressUnavailable: "Available after the server starts",
    playersOnline: "PLAYERS ONLINE", manualCheck: "Manual check", viaActions: "via Actions",
    passwordLabel: "ACCESS PASSWORD", passwordPlaceholder: "Enter the shared password",
    start: "Start server", stop: "Stop server", check: "Request status check",
    initialFeedback: "Enter the password to control the server.",
    howTo: "HOW TO JOIN", joinAdventure: "Join the adventure.",
    step1Title: "Wait for the server to start", step1Copy: "Once the server is online, you can continue.",
    step2Title: "Open Minecraft", step2Copy: "Choose Multiplayer and add the server address.",
    step3Title: "Join and have fun", step3Copy: "Play with your friends. The server takes care of the rest.",
    footer: "Made for playing with friends.", emptyPassword: "Enter the access password.",
    sending: "Sending request...", startSent: "The server start request has been sent.",
    stopSent: "The server stop request has been sent.", checkSent: "The status check request has been sent.",
    waiting: "The response usually arrives in 15–25 seconds. Starting the virtual machine may take longer.", wrongPassword: "Incorrect password.",
    notAllowed: "Origin not authorized.", incomplete: "The dashboard is not fully configured.",
    requestError: "The request was not accepted. Please try again later.",
    connectionError: "Communication error with the service.",
    vmState: "VM state", vmDeallocated: "Server offline", vmRunning: "Server online", vmStopped: "Server stopped", vmStarting: "Starting", vmStopping: "Stopping", vmUnknown: "Unknown state", notChecked: "Not checked (VM is off)", dockerActive: "Active", dockerInactive: "Inactive", containerRunning: "Running", containerExited: "Stopped", containerNotFound: "Not found", dockerState: "Docker", containerState: "Container", portState: "Port 25565", playerNames: "Players", checkedAt: "Checked", noPlayers: "Nobody online", statusReady: "Status updated.", statusTimeout: "The check has not finished yet. Please try checking again shortly.", portOpen: "Reachable", portClosed: "Unreachable"
  }
};

let currentLanguage = "pt";
let lastFeedbackKey = "initialFeedback";
let lastStatusResult = null;

function setLanguage(language) {
  currentLanguage = translations[language] ? language : "pt";
  const dictionary = translations[currentLanguage];

  document.documentElement.lang = currentLanguage === "pt" ? "pt-PT" : currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach(element => {
    const key = element.dataset.i18n;
    if (dictionary[key]) element.textContent = dictionary[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
    const key = element.dataset.i18nPlaceholder;
    if (dictionary[key]) element.placeholder = dictionary[key];
  });

  if (lastStatusResult) renderStatus(lastStatusResult);
  if (feedback) feedback.textContent = dictionary[lastFeedbackKey] || dictionary.initialFeedback;
  if (languageSelect) languageSelect.value = currentLanguage;
  document.title = currentLanguage === "pt" ? "Minecraft Server | Painel" :
    currentLanguage === "es" ? "Minecraft Server | Panel" : "Minecraft Server | Dashboard";
  try { localStorage.setItem("mc-server-language", currentLanguage); } catch {}
}

function showFeedback(key) {
  lastFeedbackKey = key;
  if (feedback) feedback.textContent = translations[currentLanguage][key] || translations[currentLanguage].connectionError;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function renderStatus(result) {
  lastStatusResult = result;
  const t = translations[currentLanguage];
  const state = document.querySelector("#server-state");
  const address = document.querySelector("#server-address");
  const count = document.querySelector("#player-count");
  const names = document.querySelector("#player-names");
  const details = document.querySelector("#status-details");

  if (state) {
    const vmStates = {
      "VM deallocated": t.vmDeallocated, "VM running": t.vmRunning,
      "VM stopped": t.vmStopped, "VM starting": t.vmStarting,
      "VM stopping": t.vmStopping
    };
    state.textContent = vmStates[result.vm] || t.vmUnknown;
  }
  if (address) address.textContent = result.ip || t.addressUnavailable;
  if (count) count.textContent = String(result.players ?? 0);
  if (names) names.textContent = result.player_names?.length ? result.player_names.join(", ") : t.noPlayers;

  if (details) {
    const values = [
      [t.dockerState, result.docker === "unknown" && result.vm !== "VM running" ? t.notChecked :
        result.docker === "active" ? t.dockerActive :
        result.docker === "inactive" ? t.dockerInactive : (result.docker || t.vmUnknown)],
      [t.containerState, result.container === "unknown" && result.vm !== "VM running" ? t.notChecked :
        result.container === "running" ? t.containerRunning :
        result.container === "exited" ? t.containerExited :
        result.container === "not_found" ? t.containerNotFound : (result.container || t.vmUnknown)],
      [t.checkedAt, result.checked_at ? new Date(result.checked_at).toLocaleString(currentLanguage === "pt" ? "pt-PT" : currentLanguage === "es" ? "es-ES" : "en-GB") : "—"]
    ];
    details.replaceChildren();
    values.forEach(([label, value]) => {
      const item = document.createElement("div");
      item.className = "status-detail";
      const labelElement = document.createElement("span");
      const valueElement = document.createElement("strong");
      labelElement.textContent = label;
      valueElement.textContent = value;
      item.append(labelElement, valueElement);
      details.append(item);
    });
  }
}

async function requestAction(action) {
  const password = passwordInput?.value || "";

  if (!password) {
    showFeedback("emptyPassword");
    passwordInput?.focus();
    return;
  }

  const requestId = action === "status" ? crypto.randomUUID() : null;
  buttons.forEach(button => button.disabled = true);
  showFeedback("sending");

  try {
    const payload = { action, password };
    if (requestId) payload.request_id = requestId;

    const response = await fetchWithTimeout(WORKER_URL.replace(/\/$/, "") + "/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      if (response.status === 401) showFeedback("wrongPassword");
      else if (response.status === 403) showFeedback("notAllowed");
      else if (response.status === 503) showFeedback("incomplete");
      else showFeedback("requestError");
      return;
    }

    if (action !== "status") {
      showFeedback(action === "start" ? "startSent" : "stopSent");
      return;
    }

    if (result.immediate && result.result) {
      renderStatus(result.result);
      showFeedback("statusReady");
      return;
    }

    showFeedback("checkSent");
    // O Workers KV pode demorar algum tempo a propagar uma escrita.
    // Consultamos de 5 em 5 segundos para não esgotar o limite do Worker.
    for (let attempt = 0; attempt < 36; attempt++) {
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 5000));
      const statusResponse = await fetchWithTimeout(WORKER_URL.replace(/\/$/, "") + "/api/status/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, request_id: requestId })
      });

      // 202 = resultado ainda não chegou; 429 = limite temporário, tentar mais tarde.
      if (statusResponse.status === 202 || statusResponse.status === 429) continue;

      const statusResult = await statusResponse.json();
      if (!statusResponse.ok || !statusResult.ok) {
        showFeedback("requestError");
        return;
      }
      renderStatus(statusResult.result);
      showFeedback("statusReady");
      return;
    }
    showFeedback("statusTimeout");
  } catch {
    showFeedback("connectionError");
  } finally {
    buttons.forEach(button => button.disabled = false);
  }
}
languageSelect?.addEventListener("change", event => setLanguage(event.target.value));
document.querySelector("#start-button")?.addEventListener("click", () => requestAction("start"));
document.querySelector("#stop-button")?.addEventListener("click", () => requestAction("stop"));
document.querySelector("#status-button")?.addEventListener("click", () => requestAction("status"));

let savedLanguage = "pt";
try {
  savedLanguage = localStorage.getItem("mc-server-language") || "pt";
} catch {}
if (!translations[savedLanguage]) {
  const browserLanguage = (navigator.language || "pt").slice(0, 2).toLowerCase();
  savedLanguage = translations[browserLanguage] ? browserLanguage : "pt";
}
setLanguage(savedLanguage);

// Permite testar a funcao de idioma diretamente na consola do navegador.
window.setLanguage = setLanguage;
