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
    azureShort:"Máquina virtual · infraestrutura cloud", linuxShort:"Sistema operativo · APT · systemd", dockerShort:"Contentorização · mc-server", minecraftShort:"Servidor de jogo · RCON", pythonShort:"Agente privado de monitorização", tunnelShort:"Comunicação privada com o agente", internalAdmin:"Administração interna", remoteManagement:"Gestão remota", compatibility:"Compatibilidade",
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
    serverAddress: "ENDEREÇO DE LIGAÇÃO", addressUnavailable: "Indisponível enquanto a VM está desligada", addressLookupFailed: "Não foi possível obter o IP público", addressProtected: "Protegido — introduz a palavra-passe", revealAddress: "Mostrar endereço",
    liveTechHeading: "ESPECIFICAÇÕES DETETADAS", liveTechTitle: "Software e mods carregados", liveTechNote: "Leitura automática em cache durante 10 minutos. Esta secção não apresenta endereços de rede nem credenciais.", techLoading: "A carregar especificações", techChecked: "Recolhido", techOS: "Sistema operativo", techArch: "Arquitetura", techKernel: "Kernel", techDocker: "Docker", techImage: "Imagem do contentor", techJava: "Java", techMinecraft: "Minecraft", techType: "Tipo de servidor", techMods: "Mods", techPlugins: "Plugins", techUnavailable: "Especificações dinâmicas indisponíveis.",
    playersOnline: "JOGADORES ONLINE", manualCheck: "Consulta manual", viaActions: "via Cloudflare / Actions",
    passwordLabel: "PALAVRA-PASSE DE ACESSO AO PAINEL", passwordPlaceholder: "Palavra-passe partilhada",
    start: "Ligar VM", stop: "Desligar VM", check: "Atualizar estado",
    initialFeedback: "Introduz a palavra-passe para gerir a infraestrutura.",
    howTo: "COMO ENTRAR", joinAdventure: "Junta-te à aventura.",
    step1Title: "Espera que o servidor ligue", step1Copy: "Quando o servidor estiver online, podes avançar.",
    step2Title: "Abre o Minecraft", step2Copy: "Escolhe Multijogador e adiciona o endereço do servidor.",
    step3Title: "Entra e diverte-te", step3Copy: "Joga com os teus amigos. O servidor trata do resto.",
    footer: "Dados técnicos baseados na configuração disponível no repositório.", emptyPassword: "Introduz a palavra-passe de acesso.",
    sending: "A enviar pedido...", startSent: "Pedido para ligar o servidor aceite.",
    stopSent: "Pedido para desligar o servidor aceite.", checkSent: "Pedido de verificação enviado.",
    starting: "A iniciar a máquina virtual na Azure...",
    serverStarting: "A VM já está ligada. A aguardar que o Minecraft arranque e abra a porta 25565...",
    stopping: "A parar o Minecraft e a desligar a máquina virtual...",
    vmStopping: "O Minecraft está a parar. A aguardar que a Azure desligue a VM...",
    searchingPublic: "A procurar o estado atual do servidor...",
    searchingPrivate: "A consultar o estado privado do servidor através do Cloudflare Tunnel...",
    checkingPrivate: "Pedido enviado. A aguardar pelo resultado da verificação...",
    startComplete: "Servidor online! Minecraft em execução e porta 25565 acessível.",
    stopComplete: "Servidor desligado. A VM foi desalocada na Azure.",
    operationTimeout: "O pedido foi aceite, mas a operação ainda não terminou. O estado mais recente está apresentado acima. Consulta novamente daqui a pouco.",
    waiting: "A resposta costuma chegar em 15–25 segundos. O arranque da máquina virtual pode demorar mais.", wrongPassword: "Palavra-passe incorreta.",
    notAllowed: "Origem não autorizada.", incomplete: "Configuração do painel incompleta.",
    requestError: "O pedido não foi aceite. Tenta novamente mais tarde.",
    connectionError: "Erro de comunicação com o serviço.",
    vmState: "Estado da VM", vmDeallocated: "Servidor desligado", vmRunning: "Servidor online", vmStopped: "Servidor parado", vmStarting: "A iniciar", vmStopping: "A desligar", vmUnknown: "Estado desconhecido", notChecked: "Não verificado", dockerActive: "Ativo", dockerInactive: "Inativo", containerRunning: "Em execução", containerExited: "Parado", containerNotFound: "Não encontrado", dockerState: "Docker", containerState: "Contentor", portState: "Porta 25565", playerNames: "Jogadores", checkedAt: "Verificado", noPlayers: "Ninguém online", statusReady: "Estado atualizado.", statusTimeout: "A verificação ainda não terminou. Tenta consultar novamente daqui a pouco.", portOpen: "Acessível", portClosed: "Inacessível"
  },
  es: {
    azureShort:"Máquina virtual · infraestructura cloud", linuxShort:"Sistema operativo · APT · systemd", dockerShort:"Contenedores · mc-server", minecraftShort:"Servidor de juego · RCON", pythonShort:"Agente privado de monitorización", tunnelShort:"Comunicación privada con el agente", internalAdmin:"Administración interna", remoteManagement:"Gestión remota", compatibility:"Compatibilidad",
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
    serverAddress: "DIRECCIÓN DE CONEXIÓN", addressUnavailable: "No disponible cuando la VM está apagada", addressLookupFailed: "No se pudo obtener la IP pública", addressProtected: "Protegida — introduce la contraseña", revealAddress: "Mostrar dirección",
    liveTechHeading: "ESPECIFICACIONES DETECTADAS", liveTechTitle: "Software y mods cargados", liveTechNote: "Lectura automática en caché durante 10 minutos. Esta sección no muestra direcciones de red ni credenciales.", techLoading: "Cargando especificaciones", techChecked: "Recopilado", techOS: "Sistema operativo", techArch: "Arquitectura", techKernel: "Kernel", techDocker: "Docker", techImage: "Imagen del contenedor", techJava: "Java", techMinecraft: "Minecraft", techType: "Tipo de servidor", techMods: "Mods", techPlugins: "Plugins", techUnavailable: "Especificaciones dinámicas no disponibles.",
    playersOnline: "JUGADORES EN LÍNEA", manualCheck: "Consulta manual", viaActions: "via Cloudflare / Actions",
    passwordLabel: "CONTRASEÑA DE ACCESO AL PANEL", passwordPlaceholder: "Contraseña compartida",
    start: "Iniciar VM", stop: "Apagar VM", check: "Actualizar estado",
    initialFeedback: "Introduce la contraseña para gestionar la infraestructura.",
    howTo: "CÓMO ENTRAR", joinAdventure: "Únete a la aventura.",
    step1Title: "Espera a que se inicie el servidor", step1Copy: "Cuando el servidor esté en línea, podrás continuar.",
    step2Title: "Abre Minecraft", step2Copy: "Elige Multijugador y añade la dirección del servidor.",
    step3Title: "Entra y diviértete", step3Copy: "Juega con tus amigos. El servidor se encarga del resto.",
    footer: "Datos técnicos basados en la configuración disponible en el repositorio.", emptyPassword: "Introduce la contraseña de acceso.",
    sending: "Enviando solicitud...", startSent: "Solicitud de inicio aceptada.",
    stopSent: "Solicitud de apagado aceptada.", checkSent: "Se ha enviado la solicitud de comprobación.",
    starting: "Iniciando la máquina virtual en Azure...",
    serverStarting: "La VM ya está encendida. Esperando a que Minecraft arranque y abra el puerto 25565...",
    stopping: "Deteniendo Minecraft y apagando la máquina virtual...",
    vmStopping: "Minecraft se está deteniendo. Esperando a que Azure apague la VM...",
    searchingPublic: "Buscando el estado actual del servidor...",
    searchingPrivate: "Consultando el estado privado del servidor a través de Cloudflare Tunnel...",
    checkingPrivate: "Solicitud enviada. Esperando el resultado de la comprobación...",
    startComplete: "¡Servidor en línea! Minecraft está ejecutándose y el puerto 25565 está accesible.",
    stopComplete: "Servidor apagado. La VM se ha desasignado en Azure.",
    operationTimeout: "La solicitud fue aceptada, pero la operación aún no ha terminado. El último estado aparece arriba. Vuelve a consultar dentro de un momento.",
    waiting: "La respuesta suele llegar en 15–25 segundos. El arranque de la máquina virtual puede tardar más.", wrongPassword: "Contraseña incorrecta.",
    notAllowed: "Origen no autorizado.", incomplete: "La configuración del panel está incompleta.",
    requestError: "No se ha aceptado la solicitud. Inténtalo de nuevo más tarde.",
    connectionError: "Error de comunicación con el servicio.",
    vmState: "Estado de la VM", vmDeallocated: "Servidor apagado", vmRunning: "Servidor en línea", vmStopped: "Servidor detenido", vmStarting: "Iniciando", vmStopping: "Apagando", vmUnknown: "Estado desconocido", notChecked: "No comprobado", dockerActive: "Activo", dockerInactive: "Inactivo", containerRunning: "En ejecución", containerExited: "Detenido", containerNotFound: "No encontrado", dockerState: "Docker", containerState: "Contenedor", portState: "Puerto 25565", playerNames: "Jugadores", checkedAt: "Comprobado", noPlayers: "Nadie conectado", statusReady: "Estado actualizado.", statusTimeout: "La comprobación aún no ha terminado. Vuelve a consultar dentro de un momento.", portOpen: "Accesible", portClosed: "Inaccesible"
  },
  en: {
    azureShort:"Virtual machine · cloud infrastructure", linuxShort:"Operating system · APT · systemd", dockerShort:"Containerization · mc-server", minecraftShort:"Game server · RCON", pythonShort:"Private monitoring agent", tunnelShort:"Private connection to the agent", internalAdmin:"Internal administration", remoteManagement:"Remote management", compatibility:"Compatibility",
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
    serverAddress: "CONNECTION ADDRESS", addressUnavailable: "Unavailable while the VM is powered off", addressLookupFailed: "Could not retrieve the public IP", addressProtected: "Protected — enter the password", revealAddress: "Show address",
    liveTechHeading: "DETECTED SPECIFICATIONS", liveTechTitle: "Loaded software and mods", liveTechNote: "Automatically collected and cached for 10 minutes. This section does not expose network addresses or credentials.", techLoading: "Loading specifications", techChecked: "Collected", techOS: "Operating system", techArch: "Architecture", techKernel: "Kernel", techDocker: "Docker", techImage: "Container image", techJava: "Java", techMinecraft: "Minecraft", techType: "Server type", techMods: "Mods", techPlugins: "Plugins", techUnavailable: "Dynamic specifications unavailable.",
    playersOnline: "PLAYERS ONLINE", manualCheck: "Manual check", viaActions: "via Cloudflare / Actions",
    passwordLabel: "DASHBOARD ACCESS PASSWORD", passwordPlaceholder: "Shared password",
    start: "Start VM", stop: "Stop VM", check: "Refresh status",
    initialFeedback: "Enter the password to manage the infrastructure.",
    howTo: "HOW TO JOIN", joinAdventure: "Join the adventure.",
    step1Title: "Wait for the server to start", step1Copy: "Once the server is online, you can continue.",
    step2Title: "Open Minecraft", step2Copy: "Choose Multiplayer and add the server address.",
    step3Title: "Join and have fun", step3Copy: "Play with your friends. The server takes care of the rest.",
    footer: "Technical information based on the configuration available in the repository.", emptyPassword: "Enter the access password.",
    sending: "Sending request...", startSent: "Start request accepted.",
    stopSent: "Stop request accepted.", checkSent: "The status check request has been sent.",
    starting: "Starting the Azure virtual machine...",
    serverStarting: "The VM is running. Waiting for Minecraft to start and port 25565 to open...",
    stopping: "Stopping Minecraft and shutting down the virtual machine...",
    vmStopping: "Minecraft is stopping. Waiting for Azure to deallocate the VM...",
    searchingPublic: "Checking the current server status...",
    searchingPrivate: "Checking the private server status through Cloudflare Tunnel...",
    checkingPrivate: "Request sent. Waiting for the status result...",
    startComplete: "Server online! Minecraft is running and port 25565 is reachable.",
    stopComplete: "Server stopped. The VM has been deallocated in Azure.",
    operationTimeout: "The request was accepted, but the operation has not finished yet. The latest status is shown above. Check again shortly.",
    waiting: "The response usually arrives in 15–25 seconds. Starting the virtual machine may take longer.", wrongPassword: "Incorrect password.",
    notAllowed: "Origin not authorized.", incomplete: "The dashboard is not fully configured.",
    requestError: "The request was not accepted. Please try again later.",
    connectionError: "Communication error with the service.",
    vmState: "VM state", vmDeallocated: "Server offline", vmRunning: "Server online", vmStopped: "Server stopped", vmStarting: "Starting", vmStopping: "Stopping", vmUnknown: "Unknown state", notChecked: "Not checked", dockerActive: "Active", dockerInactive: "Inactive", containerRunning: "Running", containerExited: "Stopped", containerNotFound: "Not found", dockerState: "Docker", containerState: "Container", portState: "Port 25565", playerNames: "Players", checkedAt: "Checked", noPlayers: "Nobody online", statusReady: "Status updated.", statusTimeout: "The check has not finished yet. Please try checking again shortly.", portOpen: "Reachable", portClosed: "Unreachable"
  }
};

let currentLanguage = "pt";
let lastFeedbackKey = "initialFeedback";
let lastStatusResult = null;
let lastPrivateIp = "";
let lastFeedbackLoading = false;
let actionInProgress = false;
let publicStatusInFlight = false;

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
  if (feedback) {
    feedback.textContent = dictionary[lastFeedbackKey] || dictionary.initialFeedback;
    feedback.classList.toggle("is-loading", lastFeedbackLoading);
    feedback.setAttribute("aria-busy", String(lastFeedbackLoading));
  }
  if (languageSelect) languageSelect.value = currentLanguage;
  document.title = currentLanguage === "pt" ? "Minecraft Server | Painel" :
    currentLanguage === "es" ? "Minecraft Server | Panel" : "Minecraft Server | Dashboard";
  try { localStorage.setItem("mc-server-language", currentLanguage); } catch {}
}

function showFeedback(key, loading = false) {
  lastFeedbackKey = key;
  lastFeedbackLoading = loading;
  if (feedback) {
    feedback.textContent = translations[currentLanguage][key] || translations[currentLanguage].connectionError;
    feedback.classList.toggle("is-loading", loading);
    feedback.setAttribute("aria-busy", String(loading));
  }
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
  if (address) {
    if (result.private && result.ip) lastPrivateIp = result.ip;

    if (result.vm === "VM deallocated" || result.vm === "VM stopped") {
      lastPrivateIp = "";
      address.textContent = t.addressUnavailable;
    } else if (result.vm === "VM running" && lastPrivateIp) {
      // A consulta publica de 30 em 30 segundos nao deve esconder um IP
      // que ja foi obtido por uma consulta privada autenticada.
      address.textContent = lastPrivateIp;
    } else if (result.vm === "VM running" && result.private) {
      address.textContent = result.ip || t.addressLookupFailed;
    } else if (result.private) {
      address.textContent = result.ip || t.addressUnavailable;
    } else {
      address.textContent = t.addressProtected;
    }
  }
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

async function requestPublicStatus(showProgress = false) {
  if (actionInProgress || publicStatusInFlight) return;
  publicStatusInFlight = true;
  const button = document.querySelector("#status-button");
  if (button) button.disabled = true;
  if (showProgress) showFeedback("searchingPublic", true);

  try {
    const response = await fetchWithTimeout(WORKER_URL + "/api/public/status");
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error("Public status unavailable");
    renderStatus(data.result);
    if (showProgress) showFeedback("statusReady");
  } catch {
    if (showProgress) showFeedback("connectionError");
  } finally {
    publicStatusInFlight = false;
    if (button) button.disabled = false;
  }
}

async function waitForVmAction(action) {
  const isStarting = action === "start";
  const maxAttempts = isStarting ? 48 : 36;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetchWithTimeout(WORKER_URL + "/api/public/status");
    const data = await response.json();
    if (!response.ok || !data.ok || !data.result) {
      throw new Error("Could not read VM state while waiting for the operation");
    }

    const status = data.result;
    renderStatus(status);

    if (isStarting) {
      const ready = status.vm === "VM running" &&
        status.docker === "active" &&
        status.container === "running" &&
        status.port_open === true;

      if (ready) {
        showFeedback("startComplete");
        return true;
      }

      showFeedback(status.vm === "VM running" ? "serverStarting" : "starting", true);
    } else {
      if (status.vm === "VM deallocated" || status.vm === "VM stopped") {
        showFeedback("stopComplete");
        return true;
      }

      showFeedback(status.vm === "VM stopping" ? "vmStopping" : "stopping", true);
    }

    if (attempt < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  showFeedback("operationTimeout");
  return false;
}

async function loadTechnicalSpecs() {
  const target = document.querySelector("#technical-specs");
  if (!target) return;
  const t = translations[currentLanguage];
  try {
    const response = await fetchWithTimeout(WORKER_URL + "/api/technical");
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error("Technical data unavailable");
    const d = data.result || {};
    const services = d.services || {};
    const es = currentLanguage === "es", en = currentLanguage === "en";
    const unknown = es ? "No disponible" : en ? "Unavailable" : "Indisponível";
    const descriptions = es ? {
      os:"Sistema operativo de la máquina virtual.", architecture:"Arquitectura del procesador y versión del kernel.", python:"Ejecuta el agente que recoge datos técnicos del servidor.", apt:"Instala y actualiza paquetes de Ubuntu.", systemd:"Inicia y supervisa servicios en segundo plano.", docker:"Ejecuta el servidor Minecraft en un contenedor aislado.", cloudflared:"Mantiene el túnel privado hacia el agente.", dockerService:"Servicio que mantiene Docker disponible.", agent:"Proceso que consulta el estado y los componentes de la VM.", tunnel:"Servicio local que mantiene la conexión con Cloudflare.", image:"Plantilla usada para crear el contenedor del servidor.", java:"Entorno necesario para ejecutar Minecraft Java.", minecraft:"Versión del juego detectada en los registros.", mods:"Modificaciones instaladas que añaden o cambian contenido y mecánicas del juego.", plugins:"Extensiones del servidor que añaden funciones administrativas o de juego."
    } : en ? {
      os:"Operating system running the virtual machine.", architecture:"Processor architecture and Linux kernel version.", python:"Runs the agent that collects server diagnostics.", apt:"Installs and updates Ubuntu packages.", systemd:"Starts and supervises background services.", docker:"Runs Minecraft inside an isolated container.", cloudflared:"Maintains the private tunnel to the agent.", dockerService:"Service that keeps Docker available.", agent:"Process that reads VM status and installed components.", tunnel:"Local service that maintains the Cloudflare connection.", image:"Template used to create the Minecraft server container.", java:"Runtime required to run Minecraft Java.", minecraft:"Game version detected in the server logs.", mods:"Installed modifications that add or change game content and mechanics.", plugins:"Server extensions that add administrative or gameplay features."
    } : {
      os:"Sistema operativo onde funciona a máquina virtual.", architecture:"Arquitetura do processador e versão do kernel Linux.", python:"Executa o agente que recolhe informação técnica do servidor.", apt:"Instala e atualiza programas no Ubuntu.", systemd:"Inicia e monitoriza serviços em segundo plano.", docker:"Executa o Minecraft num contentor isolado.", cloudflared:"Mantém o túnel privado até ao agente.", dockerService:"Serviço que mantém o Docker disponível.", agent:"Processo que consulta o estado e os componentes da VM.", tunnel:"Serviço local que mantém a ligação à Cloudflare.", image:"Imagem usada para criar o contentor do servidor Minecraft.", java:"Ambiente necessário para executar o Minecraft Java.", minecraft:"Versão do jogo detetada nos registos do servidor.", mods:"Modificações instaladas que acrescentam ou alteram conteúdo e mecânicas do jogo.", plugins:"Extensões do servidor que acrescentam funções administrativas ou de jogo."
    };
    const entries = [
      ["🐧",t.techOS,d.os,d.os_version,descriptions.os],
      ["⌘",es?"Arquitectura":en?"Architecture":"Arquitetura",d.architecture,d.kernel?"Kernel "+d.kernel:"",descriptions.architecture],
      ["🐍","Python",d.python,"",descriptions.python],
      ["📦","APT",d.apt,"",descriptions.apt],
      ["⚙","systemd",d.systemd,"",descriptions.systemd],
      ["🐳","Docker",d.docker,d.docker_server?"Engine "+d.docker_server:"",descriptions.docker],
      ["☁","cloudflared",d.cloudflared,"",descriptions.cloudflared],
      ["🟢",es?"Servicio Docker":en?"Docker service":"Serviço Docker",services.docker,"",descriptions.dockerService],
      ["🔒",es?"Agente privado":en?"Private agent":"Agente privado",services.mc_private_agent,"",descriptions.agent],
      ["🌐","Cloudflare Tunnel",services.cloudflared,"",descriptions.tunnel],
      ["🧱",t.techImage,d.container_image,"",descriptions.image],
      ["☕",t.techJava,d.java,"",descriptions.java],
      ["🎮",t.techMinecraft,d.minecraft,"",descriptions.minecraft],
      ["🧵","Fabric Loader",d.fabric_loader,"",es?"Carregador de mods Fabric e respetiva versão.":en?"Fabric mod loader and its version.":"Carregador de mods Fabric e respetiva versão."],
      ["🧩",t.techType,d.server_type,"",es?"Software que ejecuta el servidor de Minecraft.":en?"Software running the Minecraft server.":"Software que executa o servidor Minecraft."]
    ];
    target.replaceChildren();
    function addCard(icon,label,value,sub,description,modifier="") {
      const card=document.createElement("article");card.className="detected-card "+modifier;
      const top=document.createElement("div");top.className="detected-top";
      const symbol=document.createElement("span");symbol.className="detected-icon";symbol.textContent=icon;
      const name=document.createElement("span");name.className="detected-label";name.textContent=label;
      top.append(symbol,name);
      const strong=document.createElement("strong");strong.className="detected-value";strong.textContent=value||unknown;
      const copy=document.createElement("p");copy.className="detected-description";copy.textContent=description||"";
      card.append(top,strong,copy);
      if(sub){const small=document.createElement("small");small.className="detected-sub";small.textContent=sub;card.append(small);}
      target.append(card);
    }
    entries.forEach(([icon,label,value,sub,description]) => {
      const stateField=/serviço|service|agente|agent|tunnel/i.test(label);
      const stateClass=stateField&&String(value).toLowerCase()==="active"?"is-ok":stateField?"is-bad":"";
      addCard(icon,label,value&&value!=="Não identificado"&&value!=="Não identificada"&&value!=="Não identificado nos logs"?value:"",sub,description,stateClass);
    });
    const mods=Array.isArray(d.mods)?d.mods:[];
    const plugins=Array.isArray(d.plugins)?d.plugins:[];
    const modTitle=es?"Mods cargados":en?"Loaded mods":"Mods carregados";
    const modIntro=es?"Lista basada en el último arranque de Fabric; las versiones proceden del registro. Las descripciones se leen de los archivos cuando están disponibles.":en?"List based on the latest Fabric startup; versions come from the runtime log. Descriptions are read from files when available.":"Lista baseada no último arranque do Fabric; as versões vêm do registo de execução. As descrições são lidas dos ficheiros quando disponíveis.";
    const section=document.createElement("section");section.className="mods-panel";
    const heading=document.createElement("div");heading.className="mods-heading";
    const title=document.createElement("h3");title.textContent=modTitle+" · "+(d.mod_count??mods.length);
    const intro=document.createElement("p");
    const totalNote=d.fabric_total? (es?"Fabric informa "+d.fabric_total+" módulos, incluidas dependencias internas.":en?"Fabric reports "+d.fabric_total+" modules, including internal dependencies.":"O Fabric reporta "+d.fabric_total+" módulos, incluindo dependências internas.") : "";
    const lastLoaded=d.mods_status==="last_loaded"?(es?" (último arranque)":en?" (last startup)":" (último arranque)"):"";
    intro.textContent=modIntro+totalNote+lastLoaded;
    heading.append(title,intro);section.append(heading);
    if(mods.length){
      const list=document.createElement("div");list.className="mods-list";
      mods.forEach(mod=>{
        const item=document.createElement("article");item.className="mod-item";
        const name=document.createElement("strong");name.textContent=mod.name||mod.file||"Mod";
        const version=document.createElement("span");version.className="mod-version";version.textContent=mod.version? "v"+mod.version : (mod.file||"");
        const desc=document.createElement("p");desc.textContent=mod.description||(es?"El archivo no incluye una descripción legible.":en?"The file does not include a readable description.":"O ficheiro não inclui uma descrição legível.");
        item.append(name,version,desc);list.append(item);
      });
      section.append(list);
    } else {
      const empty=document.createElement("p");empty.className="mods-empty";empty.textContent=es?"No se han detectado mods en /data/mods.":en?"No mods detected in /data/mods.":"Não foram detetados mods em /data/mods.";section.append(empty);
    }
    const pluginSummary=document.createElement("p");pluginSummary.className="mods-plugin-summary";
    pluginSummary.textContent=(es?"Plugins del servidor: ":en?"Server plugins: ":"Plugins do servidor: ")+(d.plugin_count??plugins.length)+(plugins.length?" · "+plugins.map(x=>x.name||x.file).join(", "):"");
    section.append(pluginSummary);target.append(section);
    const checked=document.createElement("p");checked.className="section-copy";checked.style.gridColumn="1 / -1";
    checked.textContent=(es?"Última lectura: ":en?"Last read: ":"Última leitura: ")+(d.checked_at?new Date(d.checked_at).toLocaleString(es?"es-ES":en?"en-GB":"pt-PT"):unknown);
    target.append(checked);
  } catch {
    target.textContent = t.techUnavailable || "Especificações dinâmicas indisponíveis.";
  }
}
async function requestAction(action) {
  const password = passwordInput?.value || "";

  if (!password) {
    showFeedback("emptyPassword");
    passwordInput?.focus();
    return;
  }

  if (actionInProgress) return;
  actionInProgress = true;
  const requestId = action === "status" ? crypto.randomUUID() : null;
  buttons.forEach(button => button.disabled = true);

  if (action === "start") showFeedback("starting", true);
  else if (action === "stop") showFeedback("stopping", true);
  else showFeedback("searchingPrivate", true);

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
      await waitForVmAction(action);
      return;
    }

    if (result.immediate && result.result) {
      const privateResult = { ...result.result, private: true };
      renderStatus(privateResult);

      showFeedback("statusReady");
      return;
    }

    showFeedback("checkingPrivate", true);
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
      renderStatus({ ...statusResult.result, private: true });
      showFeedback("statusReady");
      return;
    }
    showFeedback("statusTimeout");
  } catch {
    showFeedback("connectionError");
  } finally {
    actionInProgress = false;
    buttons.forEach(button => button.disabled = false);
  }
}
languageSelect?.addEventListener("change", event => setLanguage(event.target.value));
document.querySelector("#start-button")?.addEventListener("click", () => requestAction("start"));
document.querySelector("#stop-button")?.addEventListener("click", () => requestAction("stop"));
document.querySelector("#status-button")?.addEventListener("click", () => requestPublicStatus(true));
document.querySelector("#private-status-button")?.addEventListener("click", () => requestAction("status"));

let savedLanguage = "pt";
try {
  savedLanguage = localStorage.getItem("mc-server-language") || "pt";
} catch {}
if (!translations[savedLanguage]) {
  const browserLanguage = (navigator.language || "pt").slice(0, 2).toLowerCase();
  savedLanguage = translations[browserLanguage] ? browserLanguage : "pt";
}
setLanguage(savedLanguage);
requestPublicStatus();
loadTechnicalSpecs();
setInterval(requestPublicStatus, 30000);

// Permite testar a funcao de idioma diretamente na consola do navegador.
window.setLanguage = setLanguage;
