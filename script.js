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
    languageLabel: "IDIOMA", panelLabel: "PAINEL TÉCNICO",
    eyebrow: "INFRAESTRUTURA E MONITORIZAÇÃO", pageTitle: "Informação do servidor",
    pageCopy: "Estado operacional, componentes identificados e detalhes de compatibilidade. Os dados não confirmados são assinalados como tal.",
    serverStatus: "ESTADO EM TEMPO REAL",
    verifiedHeading: "COMPONENTES IDENTIFICADOS NO PROJETO", stackTitle: "Infraestrutura e software",
    verifiedNote: "Informação confirmada pela configuração e pelos scripts existentes no repositório. Não representa uma leitura automática de versões instaladas.",
    cloudCategory: "INFRAESTRUTURA", azureDescription: "Máquina virtual gerida pela Azure. O painel consulta o estado de energia através do Azure Resource Manager.",
    systemCategory: "SISTEMA", linuxDescription: "Os scripts usam apt-get e systemd. A distribuição e a versão exatas do sistema operativo não estão identificadas no painel.",
    containerCategory: "CONTENTORIZAÇÃO", dockerDescription: "O serviço Docker é verificado e o contentor do jogo é identificado pelo nome mc-server.",
    gameCategory: "SERVIDOR DE JOGO", minecraftDescription: "O contentor é consultado através de rcon-cli. A versão, a imagem Docker, o tipo de servidor e os mods/plugins não são publicados pelo estado atual.",
    remoteCategory: "GESTÃO REMOTA", remoteDescription: "A verificação tenta primeiro SSH e usa Azure Run Command como alternativa para consultar Docker e jogadores.",
    agentCategory: "AGENTE PRIVADO", agentDescription: "O repositório inclui um agente Python local na porta 8765 e um workflow para instalar cloudflared. A instalação ativa não é confirmada pelo painel.",
    networkHeading: "REDE E ACESSO", connectionTitle: "Parâmetros de ligação", gamePort: "Porta do jogo",
    rconAccess: "Administração do jogo", agentPort: "Agente privado (configuração)", publicIp: "Endereço público",
    dynamicIp: "Obtido dinamicamente na Azure", networkNote: "A porta 25565 é testada durante a verificação. A acessibilidade depende de a VM, o contentor e as regras de rede estarem ativos.",
    compatHeading: "COMPATIBILIDADE E VERSÕES", compatTitle: "O que está confirmado",
    clientPlatforms: "Sistemas dos jogadores", platformsValue: "Windows · macOS · Linux (cliente Java, se confirmado)",
    minecraftVersion: "Versão Minecraft", javaVersion: "Versão Java", serverType: "Software do servidor",
    notPublished: "Não identificada no repositório", bedrockSupport: "Minecraft Bedrock",
    notConfirmed: "Não confirmado; requer compatibilidade própria",
    compatNote: "Não apresentamos números de versão nem compatibilidade Bedrock sem confirmação técnica. Para clientes Java, Windows, macOS e Linux são plataformas suportadas pelo próprio jogo; a versão exata tem de corresponder à do servidor.",
    serverAddress: "IP PÚBLICO", addressUnavailable: "Indisponível enquanto a VM está desligada",
    playersOnline: "JOGADORES ONLINE", manualCheck: "Consulta manual", viaActions: "via Cloudflare / Actions",
    passwordLabel: "PALAVRA-PASSE DE ACESSO AO PAINEL", passwordPlaceholder: "Palavra-passe partilhada",
    start: "Ligar VM", stop: "Desligar VM", check: "Atualizar estado",
    initialFeedback: "Introduz a palavra-passe para gerir a infraestrutura.",
    howTo: "COMO ENTRAR", joinAdventure: "Junta-te à aventura.",
    step1Title: "Espera que o servidor ligue", step1Copy: "Quando o servidor estiver online, podes avançar.",
    step2Title: "Abre o Minecraft", step2Copy: "Escolhe Multijogador e adiciona o endereço do servidor.",
    step3Title: "Entra e diverte-te", step3Copy: "Joga com os teus amigos. O servidor trata do resto.",
    footer: "Dados técnicos baseados na configuração disponível no repositório.", emptyPassword: "Introduz a palavra-passe de acesso.",
    sending: "A enviar pedido...", startSent: "Pedido para ligar o servidor enviado.",
    stopSent: "Pedido para desligar o servidor enviado.", checkSent: "Pedido de verificação enviado.",
    waiting: "A resposta costuma chegar em 15–25 segundos. O arranque da máquina virtual pode demorar mais.", wrongPassword: "Palavra-passe incorreta.",
    notAllowed: "Origem não autorizada.", incomplete: "Configuração do painel incompleta.",
    requestError: "O pedido não foi aceite. Tenta novamente mais tarde.",
    connectionError: "Erro de comunicação com o serviço.",
    vmState: "Estado da VM", vmDeallocated: "Servidor desligado", vmRunning: "Servidor online", vmStopped: "Servidor parado", vmStarting: "A iniciar", vmStopping: "A desligar", vmUnknown: "Estado desconhecido", notChecked: "Não verificado (VM desligada)", dockerActive: "Ativo", dockerInactive: "Inativo", containerRunning: "Em execução", containerExited: "Parado", containerNotFound: "Não encontrado", dockerState: "Docker", containerState: "Contentor", portState: "Porta 25565", playerNames: "Jogadores", checkedAt: "Verificado", noPlayers: "Ninguém online", statusReady: "Estado atualizado.", statusTimeout: "A verificação ainda não terminou. Tenta consultar novamente daqui a pouco.", portOpen: "Acessível", portClosed: "Inacessível"
  },
  es: {
    languageLabel: "IDIOMA", panelLabel: "PANEL TÉCNICO",
    eyebrow: "INFRAESTRUCTURA Y MONITORIZACIÓN", pageTitle: "Información del servidor",
    pageCopy: "Estado operativo, componentes identificados y compatibilidad. Los datos no confirmados se indican como tales.",
    serverStatus: "ESTADO EN TIEMPO REAL",
    verifiedHeading: "COMPONENTES IDENTIFICADOS EN EL PROYECTO", stackTitle: "Infraestructura y software",
    verifiedNote: "Información confirmada por la configuración y los scripts del repositorio. No representa una lectura automática de las versiones instaladas.",
    cloudCategory: "INFRAESTRUCTURA", azureDescription: "Máquina virtual gestionada por Azure. El panel consulta su estado mediante Azure Resource Manager.",
    systemCategory: "SISTEMA", linuxDescription: "Los scripts utilizan apt-get y systemd. La distribución y versión exactas del sistema operativo no están identificadas.",
    containerCategory: "CONTENEDORES", dockerDescription: "Se comprueba el servicio Docker y el contenedor del juego se identifica como mc-server.",
    gameCategory: "SERVIDOR DE JUEGO", minecraftDescription: "El contenedor se consulta mediante rcon-cli. La versión, imagen Docker, tipo de servidor y mods/plugins no se publican en el estado actual.",
    remoteCategory: "GESTIÓN REMOTA", remoteDescription: "La comprobación intenta primero SSH y utiliza Azure Run Command como alternativa para consultar Docker y los jugadores.",
    agentCategory: "AGENTE PRIVADO", agentDescription: "El repositorio incluye un agente Python local en el puerto 8765 y un workflow para instalar cloudflared. El panel no confirma que esté activo.",
    networkHeading: "RED Y ACCESO", connectionTitle: "Parámetros de conexión", gamePort: "Puerto del juego",
    rconAccess: "Administración del juego", agentPort: "Agente privado (configuración)", publicIp: "Dirección pública",
    dynamicIp: "Obtenida dinámicamente de Azure", networkNote: "El puerto 25565 se comprueba durante la verificación. El acceso depende de que la VM, el contenedor y las reglas de red estén activos.",
    compatHeading: "COMPATIBILIDAD Y VERSIONES", compatTitle: "Información confirmada",
    clientPlatforms: "Sistemas de los jugadores", platformsValue: "Windows · macOS · Linux (cliente Java, si se confirma)",
    minecraftVersion: "Versión de Minecraft", javaVersion: "Versión de Java", serverType: "Software del servidor",
    notPublished: "No identificada en el repositorio", bedrockSupport: "Minecraft Bedrock",
    notConfirmed: "No confirmado; requiere compatibilidad específica",
    compatNote: "No mostramos versiones ni compatibilidad Bedrock sin confirmación técnica. Para clientes Java, Windows, macOS y Linux son plataformas compatibles con el propio juego; la versión debe coincidir con la del servidor.",
    serverAddress: "IP PÚBLICA", addressUnavailable: "No disponible cuando la VM está apagada",
    playersOnline: "JUGADORES EN LÍNEA", manualCheck: "Consulta manual", viaActions: "via Cloudflare / Actions",
    passwordLabel: "CONTRASEÑA DE ACCESO AL PANEL", passwordPlaceholder: "Contraseña compartida",
    start: "Iniciar VM", stop: "Apagar VM", check: "Actualizar estado",
    initialFeedback: "Introduce la contraseña para gestionar la infraestructura.",
    howTo: "CÓMO ENTRAR", joinAdventure: "Únete a la aventura.",
    step1Title: "Espera a que se inicie el servidor", step1Copy: "Cuando el servidor esté en línea, podrás continuar.",
    step2Title: "Abre Minecraft", step2Copy: "Elige Multijugador y añade la dirección del servidor.",
    step3Title: "Entra y diviértete", step3Copy: "Juega con tus amigos. El servidor se encarga del resto.",
    footer: "Datos técnicos basados en la configuración disponible en el repositorio.", emptyPassword: "Introduce la contraseña de acceso.",
    sending: "Enviando solicitud...", startSent: "Se ha enviado la solicitud para iniciar el servidor.",
    stopSent: "Se ha enviado la solicitud para apagar el servidor.", checkSent: "Se ha enviado la solicitud de comprobación.",
    waiting: "La respuesta suele llegar en 15–25 segundos. El arranque de la máquina virtual puede tardar más.", wrongPassword: "Contraseña incorrecta.",
    notAllowed: "Origen no autorizado.", incomplete: "La configuración del panel está incompleta.",
    requestError: "No se ha aceptado la solicitud. Inténtalo de nuevo más tarde.",
    connectionError: "Error de comunicación con el servicio.",
    vmState: "Estado de la VM", vmDeallocated: "Servidor apagado", vmRunning: "Servidor en línea", vmStopped: "Servidor detenido", vmStarting: "Iniciando", vmStopping: "Apagando", vmUnknown: "Estado desconocido", notChecked: "No comprobado (VM apagada)", dockerActive: "Activo", dockerInactive: "Inactivo", containerRunning: "En ejecución", containerExited: "Detenido", containerNotFound: "No encontrado", dockerState: "Docker", containerState: "Contenedor", portState: "Puerto 25565", playerNames: "Jugadores", checkedAt: "Comprobado", noPlayers: "Nadie conectado", statusReady: "Estado actualizado.", statusTimeout: "La comprobación aún no ha terminado. Vuelve a consultar dentro de un momento.", portOpen: "Accesible", portClosed: "Inaccesible"
  },
  en: {
    languageLabel: "LANGUAGE", panelLabel: "TECHNICAL DASHBOARD",
    eyebrow: "INFRASTRUCTURE AND MONITORING", pageTitle: "Server information",
    pageCopy: "Operational status, identified components and compatibility details. Unverified information is clearly marked.",
    serverStatus: "LIVE STATUS",
    verifiedHeading: "COMPONENTS IDENTIFIED IN THE PROJECT", stackTitle: "Infrastructure and software",
    verifiedNote: "Information confirmed by the repository configuration and scripts. This is not an automatic reading of installed software versions.",
    cloudCategory: "INFRASTRUCTURE", azureDescription: "Virtual machine managed by Azure. The dashboard checks its power state through Azure Resource Manager.",
    systemCategory: "SYSTEM", linuxDescription: "The scripts use apt-get and systemd. The exact operating-system distribution and version are not identified in the dashboard.",
    containerCategory: "CONTAINERIZATION", dockerDescription: "The Docker service is checked and the game container is identified by the name mc-server.",
    gameCategory: "GAME SERVER", minecraftDescription: "The container is queried through rcon-cli. The version, Docker image, server type and mods/plugins are not exposed by the current status data.",
    remoteCategory: "REMOTE MANAGEMENT", remoteDescription: "The status workflow tries SSH first and uses Azure Run Command as a fallback to inspect Docker and players.",
    agentCategory: "PRIVATE AGENT", agentDescription: "The repository contains a local Python agent on port 8765 and a workflow to install cloudflared. The dashboard does not confirm that it is running.",
    networkHeading: "NETWORK AND ACCESS", connectionTitle: "Connection parameters", gamePort: "Game port",
    rconAccess: "Game administration", agentPort: "Private agent (configured)", publicIp: "Public address",
    dynamicIp: "Retrieved dynamically from Azure", networkNote: "Port 25565 is tested during a status check. Reachability depends on the VM, container and network rules being active.",
    compatHeading: "COMPATIBILITY AND VERSIONS", compatTitle: "What is confirmed",
    clientPlatforms: "Player operating systems", platformsValue: "Windows · macOS · Linux (Java client, if confirmed)",
    minecraftVersion: "Minecraft version", javaVersion: "Java version", serverType: "Server software",
    notPublished: "Not identified in the repository", bedrockSupport: "Minecraft Bedrock",
    notConfirmed: "Not confirmed; requires specific compatibility",
    compatNote: "We do not publish version numbers or Bedrock compatibility without technical confirmation. For Java clients, Windows, macOS and Linux are supported by the game itself; the client version must match the server.",
    serverAddress: "PUBLIC IP", addressUnavailable: "Unavailable while the VM is powered off",
    playersOnline: "PLAYERS ONLINE", manualCheck: "Manual check", viaActions: "via Cloudflare / Actions",
    passwordLabel: "DASHBOARD ACCESS PASSWORD", passwordPlaceholder: "Shared password",
    start: "Start VM", stop: "Stop VM", check: "Refresh status",
    initialFeedback: "Enter the password to manage the infrastructure.",
    howTo: "HOW TO JOIN", joinAdventure: "Join the adventure.",
    step1Title: "Wait for the server to start", step1Copy: "Once the server is online, you can continue.",
    step2Title: "Open Minecraft", step2Copy: "Choose Multiplayer and add the server address.",
    step3Title: "Join and have fun", step3Copy: "Play with your friends. The server takes care of the rest.",
    footer: "Technical information based on the configuration available in the repository.", emptyPassword: "Enter the access password.",
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
      [t.portState, result.port_open ? t.portOpen : t.portClosed],
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
