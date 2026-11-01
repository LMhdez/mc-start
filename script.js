// URL publica do Cloudflare Worker. Nunca colocar tokens neste ficheiro.
const WORKER_URL = "https://mc-start-control.luismariohernandezsantos.workers.dev";

const passwordInput = document.querySelector("#access-password");
const feedback = document.querySelector("#feedback");
const languageSelect = document.querySelector("#language-select");
const startButton = document.querySelector("#start-button");
const statusButton = document.querySelector("#status-button");
const privateStatusButton = document.querySelector("#private-status-button");

let lastTechnicalData = null;

const translations = {
  pt: {
    hostedOnAzureLabel:"ALOJADO NA AZURE",
    stackLabel:"ARQUITETURA E VERSÕES", stackTitle:"Arquitetura e versões", stackIntro:"Componentes da infraestrutura, do sistema e do servidor de jogo, reunidos numa única grelha com as versões detetadas.",
    azureName:"Microsoft Azure", azureComponent:"Máquina virtual", azureDescription:"Infraestrutura cloud que aloja a máquina virtual do servidor.",
    architectureIntro:"Percurso desde a infraestrutura cloud até ao servidor de jogo e à monitorização.",
    vmStatusLabel:"ESTADO DO SERVIDOR",
    connectionSectionLabel:"LIGAÇÃO AO SERVIDOR", connectionTitleShort:"Endereços e plataformas",
    javaEditionLabel:"Minecraft Java Edition", bedrockEditionLabel:"Minecraft Bedrock",
    versionsHeading:"VERSÕES DETETADAS", versionsTitle:"Software e versões",
    versionsIntro:"Versões lidas diretamente da VM e dos registos do último arranque.",
    kernelLabelShort:"Kernel", dockerEngineLabel:"Motor", containerImageLabel:"Imagem",
    fabricLabel:"Fabric Loader", agentRuntimeLabel:"Agente de monitorização", javaRuntimeDescription:"Ambiente de execução do servidor Minecraft e dos seus componentes.",
    tunnelStatusLabel:"Estado do túnel", activeStatus:"Ativo", inactiveStatus:"Inativo",
    unknownStatus:"Desconhecido", unavailableValue:"Não disponível",
    loadedModsTitle:"Mods do servidor", loadedModsIntro:"Inventário público dos mods instalados no servidor.",
    modsLastStartup:"Último arranque conhecido", modDescUnavailable:"Descrição não disponível em português.",
    modDescServerCore:"Otimiza o desempenho do servidor e a utilização dos recursos através de várias melhorias configuráveis.",
    modDescAlternateCurrent:"Otimiza o processamento dos circuitos de redstone para reduzir a carga do servidor.",
    modDescSpark:"Ferramenta de diagnóstico que permite analisar TPS, MSPT, CPU, memória e identificar problemas de desempenho.",
    modDescLithium:"Otimiza o desempenho do servidor sem alterar as mecânicas do jogo.",
    modDescFabricApi:"Disponibiliza APIs e pontos de integração necessários a outros mods.",
    modDescFloodgate:"Permite a ligação de jogadores Bedrock a servidores Java através do Geyser.",
    modDescFerritecore:"Reduz o consumo de memória do servidor.",
    modDescEssentialCommands:"Acrescenta comandos como teletransporte, casas, regresso e warps.",
    modDescChunky:"Gera antecipadamente chunks para preparar áreas do mundo.",
    modDescGeyser:"Permite que jogadores Bedrock entrem num servidor Minecraft Java.",
    modDescKrypton:"Otimiza a rede do servidor, tornando o processamento e o envio de pacotes mais eficientes e reduzindo o overhead de comunicação.",
    pluginsLabel:"Plugins", noModsDetected:"Não foram encontrados mods instalados na pasta do servidor.", updatedAtLabel:"Atualizado",

    azureShort:"Máquina virtual · infraestrutura cloud", linuxShort:"Sistema operativo · APT · systemd", dockerShort:"Contentorização · mc-server", minecraftShort:"Servidor de jogo · RCON", pythonShort:"Agente privado de monitorização", tunnelShort:"Comunicação privada com o agente", internalAdmin:"Administração interna", remoteManagement:"Gestão remota", compatibility:"Compatibilidade",
    languageLabel: "Idioma", adminEyebrow: "ADMINISTRAÇÃO", adminTitle: "Controlos do servidor", adminCopy: "Ações de gestão protegidas por palavra-passe. Estes controlos não são necessários para jogar.", panelLabel: "PAINEL TÉCNICO",
    eyebrow: "O TEU MUNDO. À TUA MANEIRA.", pageTitle: "O teu servidor. As tuas regras.",
    architectureLabel: "ARQUITETURA", architectureTitle: "Como o servidor funciona",
    architectureAzure: "Azure VM", architectureAzureCopy: "Máquina virtual e recursos cloud",
    architectureHost: "Linux + Docker", architectureHostCopy: "Sistema operativo e contentor do jogo",
    architectureGame: "Minecraft", architectureGameCopy: "Servidor Java e gestão através de RCON",
    architectureControl: "Cloudflare Tunnel", architectureControlCopy: "Ligação privada ao agente de monitorização",
    pageCopy: "Consulta se o servidor está online, vê quem está a jogar e encontra os dados para te ligares.",
    serverStatus: "ESTADO EM TEMPO REAL",
    verifiedHeading: "COMPONENTES IDENTIFICADOS NO PROJETO", stackTitle: "Infraestrutura do servidor",
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
    confirmStop: "Tens a certeza de que queres desligar o servidor? Os jogadores serão desconectados.",
    skipToContent: "Saltar para o conteúdo",
    howTo: "COMO ENTRAR", joinAdventure: "Junta-te à aventura.",
    step1Title: "Espera que o servidor ligue", step1Copy: "Quando o servidor estiver online, podes avançar.",
    step2Title: "Abre o Minecraft", step2Copy: "Escolhe Multijogador e adiciona o endereço do servidor.",
    step3Title: "Entra e diverte-te", step3Copy: "Joga com os teus amigos. O servidor trata do resto.",
    footer: "Alojado na Microsoft Azure.", emptyPassword: "Introduz a palavra-passe de acesso.",
    sending: "A enviar pedido...", startSent: "Pedido para ligar o servidor aceite.",
    stopSent: "Pedido para desligar o servidor aceite.", checkSent: "Pedido de verificação enviado.",
    starting: "A iniciar a máquina virtual na Azure...",
    serverStarting: "A VM já está ligada. A aguardar que Minecraft, Java e Geyser/Bedrock estejam prontos...",
    stopping: "A parar o Minecraft e a desligar a máquina virtual...",
    vmStopping: "O Minecraft está a parar. A aguardar que a Azure desligue a VM...",
    searchingPublic: "A procurar o estado atual do servidor...",
    searchingPrivate: "A consultar o estado privado do servidor através do Cloudflare Tunnel...",
    checkingPrivate: "Pedido enviado. A aguardar pelo resultado da verificação...",
    serverInitializing: "A preparar as ligações Java e Bedrock…",
    bedrockStateLabel: "Bedrock",
    startComplete: "Servidor online. O serviço Minecraft está pronto; a ligação Bedrock externa não foi testada.",
    stopComplete: "Servidor desligado. A VM foi desalocada na Azure.",
    operationTimeout: "O pedido foi aceite, mas a operação ainda não terminou. O estado mais recente está apresentado acima. Consulta novamente daqui a pouco.",
    waiting: "A resposta costuma chegar em 15–25 segundos. O arranque da máquina virtual pode demorar mais.", wrongPassword: "Palavra-passe incorreta.",
    notAllowed: "Origem não autorizada.", rateLimited: "Demasiados pedidos. Aguarda um minuto antes de voltar a tentar.", incomplete: "Configuração do painel incompleta.",
    requestError: "O pedido não foi aceite. Tenta novamente mais tarde.",
    connectionError: "Erro de comunicação com o serviço.",
    vmState: "Estado da VM", vmDeallocated: "Servidor desligado", vmRunning: "VM ligada", serverOnline: "Servidor online", vmStopped: "Servidor parado", vmStarting: "A iniciar", vmStopping: "A desligar", vmUnknown: "Estado desconhecido", notChecked: "Não verificado", dockerActive: "Ativo", dockerInactive: "Inativo", containerRunning: "Em execução", containerExited: "Parado", containerNotFound: "Não encontrado", dockerState: "Docker", containerState: "Contentor", portState: "Ligação Java", playerNames: "Jogadores", checkedAt: "Verificado", noPlayers: "Ninguém online", playersProtected: "Privado — mostra o endereço", statusReady: "Estado atualizado.", statusTimeout: "A verificação ainda não terminou. Tenta consultar novamente daqui a pouco.", portOpen: "Acessível", portClosed: "Inacessível", bedrockServiceReady: "Serviço ativo · acesso externo não confirmado"
  },
  es: {
    hostedOnAzureLabel:"ALOJADO EN AZURE",
    stackLabel:"ARQUITECTURA Y VERSIONES", stackTitle:"Arquitectura y versiones", stackIntro:"Componentes de la infraestructura, el sistema y el servidor de juego, reunidos en una única cuadrícula con las versiones detectadas.",
    azureName:"Microsoft Azure", azureComponent:"Máquina virtual", azureDescription:"Infraestructura cloud que aloja la máquina virtual del servidor.",
    architectureIntro:"Desde la infraestructura cloud hasta el servidor de juego y la monitorización.",
    vmStatusLabel:"ESTADO DEL SERVIDOR",
    connectionSectionLabel:"CONEXIÓN AL SERVIDOR", connectionTitleShort:"Direcciones y plataformas",
    javaEditionLabel:"Minecraft Java Edition", bedrockEditionLabel:"Minecraft Bedrock",
    versionsHeading:"VERSIONES DETECTADAS", versionsTitle:"Software y versiones",
    versionsIntro:"Versiones obtenidas directamente de la VM y de los registros del último inicio.",
    kernelLabelShort:"Kernel", dockerEngineLabel:"Motor", containerImageLabel:"Imagen",
    fabricLabel:"Fabric Loader", agentRuntimeLabel:"Agente de monitorización", javaRuntimeDescription:"Entorno de ejecución del servidor Minecraft y de sus componentes.",
    tunnelStatusLabel:"Estado del túnel", activeStatus:"Activo", inactiveStatus:"Inactivo",
    unknownStatus:"Desconocido", unavailableValue:"No disponible",
    loadedModsTitle:"Mods del servidor", loadedModsIntro:"Inventario público de los mods instalados en el servidor.",
    modsLastStartup:"Último inicio conocido", modDescUnavailable:"Descripción no disponible en español.",
    modDescServerCore:"Optimiza el rendimiento del servidor y el uso de recursos mediante varias mejoras configurables.",
    modDescAlternateCurrent:"Optimiza el procesamiento de los circuitos de redstone para reducir la carga del servidor.",
    modDescSpark:"Herramienta de diagnóstico para analizar TPS, MSPT, CPU, memoria e identificar problemas de rendimiento.",
    modDescLithium:"Mejora el rendimiento del servidor sin cambiar las mecánicas del juego.",
    modDescFabricApi:"Proporciona las API y los puntos de integración que necesitan otros mods.",
    modDescFloodgate:"Permite que jugadores de Bedrock se conecten a servidores Java mediante Geyser.",
    modDescFerritecore:"Reduce el consumo de memoria del servidor.",
    modDescEssentialCommands:"Añade comandos como teletransporte, casas, regreso y warps.",
    modDescChunky:"Genera chunks por adelantado para preparar zonas del mundo.",
    modDescGeyser:"Permite que jugadores de Bedrock entren en un servidor Minecraft Java.",
    modDescKrypton:"Optimiza la red del servidor, haciendo más eficiente el procesamiento y el envío de paquetes y reduciendo la sobrecarga de comunicación.",
    pluginsLabel:"Plugins", noModsDetected:"No se encontraron mods instalados en la carpeta del servidor.", updatedAtLabel:"Actualizado",

    azureShort:"Máquina virtual · infraestructura cloud", linuxShort:"Sistema operativo · APT · systemd", dockerShort:"Contenedores · mc-server", minecraftShort:"Servidor de juego · RCON", pythonShort:"Agente privado de monitorización", tunnelShort:"Comunicación privada con el agente", internalAdmin:"Administración interna", remoteManagement:"Gestión remota", compatibility:"Compatibilidad",
    languageLabel: "Idioma", adminEyebrow: "ADMINISTRACIÓN", adminTitle: "Controles del servidor", adminCopy: "Acciones de gestión protegidas por contraseña. No necesitas estos controles para jugar.", panelLabel: "PANEL TÉCNICO",
    eyebrow: "TU MUNDO. A TU MANERA.", pageTitle: "Tu servidor. Tus reglas.",
    architectureLabel: "ARQUITECTURA", architectureTitle: "Cómo funciona el servidor",
    architectureAzure: "Azure VM", architectureAzureCopy: "Máquina virtual e infraestructura cloud",
    architectureHost: "Linux + Docker", architectureHostCopy: "Sistema operativo y contenedor del juego",
    architectureGame: "Minecraft", architectureGameCopy: "Servidor Java y administración mediante RCON",
    architectureControl: "Cloudflare Tunnel", architectureControlCopy: "Conexión privada al agente de monitorización",
    pageCopy: "Comprueba si el servidor está en línea, quién está jugando y cómo conectarte.",
    serverStatus: "ESTADO EN TIEMPO REAL",
    verifiedHeading: "COMPONENTES IDENTIFICADOS EN EL PROYECTO", stackTitle: "Infraestructura del servidor",
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
    confirmStop: "¿Seguro que quieres apagar el servidor? Se desconectará a los jugadores.",
    skipToContent: "Saltar al contenido",
    howTo: "CÓMO ENTRAR", joinAdventure: "Únete a la aventura.",
    step1Title: "Espera a que se inicie el servidor", step1Copy: "Cuando el servidor esté en línea, podrás continuar.",
    step2Title: "Abre Minecraft", step2Copy: "Elige Multijugador y añade la dirección del servidor.",
    step3Title: "Entra y diviértete", step3Copy: "Juega con tus amigos. El servidor se encarga del resto.",
    footer: "Alojado en Microsoft Azure.", emptyPassword: "Introduce la contraseña de acceso.",
    sending: "Enviando solicitud...", startSent: "Solicitud de inicio aceptada.",
    stopSent: "Solicitud de apagado aceptada.", checkSent: "Se ha enviado la solicitud de comprobación.",
    starting: "Iniciando la máquina virtual en Azure...",
    serverStarting: "La VM ya está encendida. Esperando a que Minecraft y las conexiones Java/Bedrock estén listas...",
    stopping: "Deteniendo Minecraft y apagando la máquina virtual...",
    vmStopping: "Minecraft se está deteniendo. Esperando a que Azure apague la VM...",
    searchingPublic: "Buscando el estado actual del servidor...",
    searchingPrivate: "Consultando el estado privado del servidor a través de Cloudflare Tunnel...",
    checkingPrivate: "Solicitud enviada. Esperando el resultado de la comprobación...",
    serverInitializing: "Preparando las conexiones Java y Bedrock…",
    bedrockStateLabel: "Bedrock",
    startComplete: "Servidor en línea. Minecraft está listo; la conexión Bedrock externa no se ha probado.",
    stopComplete: "Servidor apagado. La VM se ha desasignado en Azure.",
    operationTimeout: "La solicitud fue aceptada, pero la operación aún no ha terminado. El último estado aparece arriba. Vuelve a consultar dentro de un momento.",
    waiting: "La respuesta suele llegar en 15–25 segundos. El arranque de la máquina virtual puede tardar más.", wrongPassword: "Contraseña incorrecta.",
    notAllowed: "Origen no autorizado.", rateLimited: "Demasiadas solicitudes. Espera un minuto antes de volver a intentarlo.", incomplete: "La configuración del panel está incompleta.",
    requestError: "No se ha aceptado la solicitud. Inténtalo de nuevo más tarde.",
    connectionError: "Error de comunicación con el servicio.",
    vmState: "Estado de la VM", vmDeallocated: "Servidor apagado", vmRunning: "VM encendida", serverOnline: "Servidor en línea", vmStopped: "Servidor detenido", vmStarting: "Iniciando", vmStopping: "Apagando", vmUnknown: "Estado desconocido", notChecked: "No comprobado", dockerActive: "Activo", dockerInactive: "Inactivo", containerRunning: "En ejecución", containerExited: "Detenido", containerNotFound: "No encontrado", dockerState: "Docker", containerState: "Contenedor", portState: "Conexión Java", playerNames: "Jugadores", checkedAt: "Comprobado", noPlayers: "Nadie conectado", playersProtected: "Privado — muestra la dirección", statusReady: "Estado actualizado.", statusTimeout: "La comprobación aún no ha terminado. Vuelve a consultar dentro de un momento.", portOpen: "Accesible", portClosed: "Inaccesible", bedrockServiceReady: "Servicio activo · acceso externo no confirmado"
  },
  en: {
    hostedOnAzureLabel:"HOSTED ON AZURE",
    stackLabel:"ARCHITECTURE & VERSIONS", stackTitle:"Architecture and versions", stackIntro:"Infrastructure, system and game-server components in one unified grid, with detected versions.",
    azureName:"Microsoft Azure", azureComponent:"Virtual machine", azureDescription:"Cloud infrastructure hosting the server virtual machine.",
    architectureIntro:"From cloud infrastructure to the game server and monitoring.",
    vmStatusLabel:"SERVER STATUS",
    connectionSectionLabel:"SERVER CONNECTION", connectionTitleShort:"Addresses and platforms",
    javaEditionLabel:"Minecraft Java Edition", bedrockEditionLabel:"Minecraft Bedrock",
    versionsHeading:"DETECTED VERSIONS", versionsTitle:"Software and versions",
    versionsIntro:"Versions read directly from the VM and the latest startup logs.",
    kernelLabelShort:"Kernel", dockerEngineLabel:"Engine", containerImageLabel:"Image",
    fabricLabel:"Fabric Loader", agentRuntimeLabel:"Monitoring agent", javaRuntimeDescription:"Runtime environment for the Minecraft server and its components.",
    tunnelStatusLabel:"Tunnel status", activeStatus:"Active", inactiveStatus:"Inactive",
    unknownStatus:"Unknown", unavailableValue:"Unavailable",
    loadedModsTitle:"Server mods", loadedModsIntro:"Public inventory of mods installed on the server.",
    modsLastStartup:"Last known startup", modDescUnavailable:"Description unavailable.",
    modDescServerCore:"Improves server performance and resource usage through a set of configurable optimizations.",
    modDescAlternateCurrent:"Optimizes redstone circuit processing to reduce server workload.",
    modDescSpark:"A diagnostics and profiling tool for analyzing TPS, MSPT, CPU, memory, and performance issues.",
    modDescLithium:"Improves server performance without changing gameplay mechanics.",
    modDescFabricApi:"Provides APIs and integration hooks required by other mods.",
    modDescFloodgate:"Allows Bedrock players to join Java servers through Geyser.",
    modDescFerritecore:"Reduces the server's memory usage.",
    modDescEssentialCommands:"Adds commands such as teleport, homes, back and warps.",
    modDescChunky:"Pre-generates chunks to prepare areas of the world.",
    modDescGeyser:"Allows Bedrock players to join a Minecraft Java server.",
    modDescKrypton:"Optimizes the server network stack, making packet processing and transmission more efficient and reducing communication overhead.",
    pluginsLabel:"Plugins", noModsDetected:"No installed mods were found in the server folder.", updatedAtLabel:"Updated",

    azureShort:"Virtual machine · cloud infrastructure", linuxShort:"Operating system · APT · systemd", dockerShort:"Containerization · mc-server", minecraftShort:"Game server · RCON", pythonShort:"Private monitoring agent", tunnelShort:"Private connection to the agent", internalAdmin:"Internal administration", remoteManagement:"Remote management", compatibility:"Compatibility",
    languageLabel: "Language", adminEyebrow: "ADMINISTRATION", adminTitle: "Server controls", adminCopy: "Password-protected management actions. You do not need these controls to play.", panelLabel: "TECHNICAL DASHBOARD",
    eyebrow: "YOUR WORLD. YOUR WAY.", pageTitle: "Your server. Your rules.",
    architectureLabel: "ARCHITECTURE", architectureTitle: "How the server works",
    architectureAzure: "Azure VM", architectureAzureCopy: "Virtual machine and cloud resources",
    architectureHost: "Linux + Docker", architectureHostCopy: "Operating system and game container",
    architectureGame: "Minecraft", architectureGameCopy: "Java server managed through RCON",
    architectureControl: "Cloudflare Tunnel", architectureControlCopy: "Private connection to the monitoring agent",
    pageCopy: "Check whether the server is online, see who is playing and find the details to join.",
    serverStatus: "LIVE STATUS",
    verifiedHeading: "COMPONENTS IDENTIFIED IN THE PROJECT", stackTitle: "Server infrastructure",
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
    liveTechHeading: "DETECTED SPECIFICATIONS", liveTechTitle: "Loaded software and mods", liveTechNote: "Automatically refreshed while the VM is running. The latest snapshot remains available while it is powered off.", techLoading: "Loading specifications", techChecked: "Collected", techOS: "Operating system", techArch: "Architecture", techKernel: "Kernel", techDocker: "Docker", techImage: "Container image", techJava: "Java", techMinecraft: "Minecraft", techType: "Server type", techMods: "Mods", techPlugins: "Plugins", techUnavailable: "Dynamic specifications unavailable.",
    playersOnline: "PLAYERS ONLINE", manualCheck: "Manual check", viaActions: "via Cloudflare / Actions",
    passwordLabel: "DASHBOARD ACCESS PASSWORD", passwordPlaceholder: "Shared password",
    start: "Start VM", stop: "Stop VM", check: "Refresh status",
    initialFeedback: "Enter the password to manage the infrastructure.",
    confirmStop: "Are you sure you want to stop the server? Players will be disconnected.",
    skipToContent: "Skip to content",
    howTo: "HOW TO JOIN", joinAdventure: "Join the adventure.",
    step1Title: "Wait for the server to start", step1Copy: "Once the server is online, you can continue.",
    step2Title: "Open Minecraft", step2Copy: "Choose Multiplayer and add the server address.",
    step3Title: "Join and have fun", step3Copy: "Play with your friends. The server takes care of the rest.",
    footer: "Hosted on Microsoft Azure.", emptyPassword: "Enter the access password.",
    sending: "Sending request...", startSent: "Start request accepted.",
    stopSent: "Stop request accepted.", checkSent: "The status check request has been sent.",
    starting: "Starting the Azure virtual machine...",
    serverStarting: "The VM is running. Waiting for Minecraft and Java/Bedrock connections to be ready...",
    stopping: "Stopping Minecraft and shutting down the virtual machine...",
    vmStopping: "Minecraft is stopping. Waiting for Azure to deallocate the VM...",
    searchingPublic: "Checking the current server status...",
    searchingPrivate: "Checking the private server status through Cloudflare Tunnel...",
    checkingPrivate: "Request sent. Waiting for the status result...",
    serverInitializing: "Preparing Java and Bedrock connections…",
    bedrockStateLabel: "Bedrock",
    startComplete: "Server online. Minecraft is ready; external Bedrock connectivity has not been tested.",
    stopComplete: "Server stopped. The VM has been deallocated in Azure.",
    operationTimeout: "The request was accepted, but the operation has not finished yet. The latest status is shown above. Check again shortly.",
    waiting: "The response usually arrives in 15–25 seconds. Starting the virtual machine may take longer.", wrongPassword: "Incorrect password.",
    notAllowed: "Origin not authorized.", rateLimited: "Too many requests. Wait one minute before trying again.", incomplete: "The dashboard is not fully configured.",
    requestError: "The request was not accepted. Please try again later.",
    connectionError: "Communication error with the service.",
    vmState: "VM state", vmDeallocated: "Server offline", vmRunning: "VM running", serverOnline: "Server online", vmStopped: "Server stopped", vmStarting: "Starting", vmStopping: "Stopping", vmUnknown: "Unknown state", notChecked: "Not checked", dockerActive: "Active", dockerInactive: "Inactive", containerRunning: "Running", containerExited: "Stopped", containerNotFound: "Not found", dockerState: "Docker", containerState: "Container", portState: "Java connection", playerNames: "Players", checkedAt: "Checked", noPlayers: "Nobody online", playersProtected: "Private — reveal the address", statusReady: "Status updated.", statusTimeout: "The check has not finished yet. Please try checking again shortly.", portOpen: "Reachable", portClosed: "Unreachable", bedrockServiceReady: "Service active · external access unconfirmed"
  }
};

let currentLanguage = "pt";
let lastFeedbackKey = "initialFeedback";
let lastStatusResult = null;
let lastPrivateIp = "";
let lastPrivatePlayerNames = null;
let lastFeedbackLoading = false;
let actionInProgress = false;
let publicStatusInFlight = false;

function updateActionButtons() {
  const hasPassword = Boolean(passwordInput?.value);
  if (startButton) startButton.disabled = actionInProgress || !hasPassword;
  if (privateStatusButton) privateStatusButton.disabled = actionInProgress || !hasPassword;
  if (statusButton) statusButton.disabled = actionInProgress || publicStatusInFlight;
}

function setLanguage(language) {
  currentLanguage = translations[language] ? language : "pt";
  const dictionary = translations[currentLanguage];

  document.documentElement.lang = currentLanguage === "pt" ? "pt-PT" : currentLanguage;
  document.querySelectorAll("[data-i18n-aria]").forEach(element => {
    const key = element.dataset.i18nAria;
    if (dictionary[key]) element.setAttribute("aria-label", dictionary[key]);
  });
  document.querySelectorAll("[data-i18n]").forEach(element => {
    const key = element.dataset.i18n;
    if (dictionary[key]) element.textContent = dictionary[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
    const key = element.dataset.i18nPlaceholder;
    if (dictionary[key]) element.placeholder = dictionary[key];
  });

  if (lastStatusResult) renderStatus(lastStatusResult);
  if (lastTechnicalData) renderTechnicalSpecs(lastTechnicalData);
  if (feedback) {
    feedback.textContent = dictionary[lastFeedbackKey] || dictionary.initialFeedback;
    feedback.classList.toggle("is-loading", lastFeedbackLoading);
    feedback.setAttribute("aria-busy", String(lastFeedbackLoading));
  }
  if (languageSelect) languageSelect.value = currentLanguage;
  document.title = currentLanguage === "pt" ? "Minecraft Server | O teu servidor" :
    currentLanguage === "es" ? "Minecraft Server | Tu servidor" : "Minecraft Server | Your server";
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) metaDescription.content = dictionary.pageCopy;
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

function isServerReady(result) {
  return result?.vm === "VM running" &&
    result.docker === "active" &&
    result.container === "running" &&
    result.port_open === true &&
    result.rcon_ready === true &&
    result.geyser_ready === true;
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
    const previousState = state.textContent;
    const vmStates = {
      "VM deallocated": t.vmDeallocated, "VM running": t.vmRunning,
      "VM stopped": t.vmStopped, "VM starting": t.vmStarting,
      "VM stopping": t.vmStopping
    };
    const serverReady = isServerReady(result);
    const initializing = result.vm === "VM running" && !serverReady &&
      result.docker === "active" && result.container === "running";
    state.textContent = serverReady ? t.serverOnline :
      (initializing ? t.serverInitializing : (vmStates[result.vm] || t.vmUnknown));
    if (state.textContent !== previousState && previousState !== "—") {
      const announcement = document.querySelector("#server-announcement");
      if (announcement) announcement.textContent = state.textContent;
    }
    const dot = state.closest(".status-pill")?.querySelector(".status-dot");
    if (dot) {
      const pending = result.vm === "VM starting" || result.vm === "VM stopping" ||
        (result.vm === "VM running" && !serverReady);
      dot.classList.toggle("status-dot-muted", !serverReady && !pending);
      dot.classList.toggle("status-dot-pending", pending);
    }
  }
  if (address) {
    if (result.private && result.ip) lastPrivateIp = result.ip;

    if (result.vm === "VM deallocated" || result.vm === "VM stopped") {
      lastPrivateIp = "";
      lastPrivatePlayerNames = null;
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
  const playersKnown = result.players != null && (
    result.vm !== "VM running" ||
    result.docker === "inactive" ||
    (result.docker === "active" && result.container !== "unknown")
  );
  if (result.private) {
    lastPrivatePlayerNames = Array.isArray(result.player_names) ? result.player_names : null;
  }
  const privateDetailsVisible = Boolean(lastPrivateIp);
  if (count) count.textContent = playersKnown ? String(result.players) : "—";
  if (names) {
    const visibleNames = result.private && Array.isArray(result.player_names)
      ? result.player_names
      : privateDetailsVisible ? lastPrivatePlayerNames : null;
    names.textContent = Array.isArray(visibleNames)
      ? (visibleNames.length ? visibleNames.join(", ") : t.noPlayers)
      : (playersKnown && result.players === 0 ? t.noPlayers : t.playersProtected);
  }

  if (details) {
    const values = [
      [t.portState, result.port_open == null ? t.unknownStatus : result.port_open ? t.portOpen : t.portClosed],
      [t.bedrockStateLabel, result.geyser_ready === true &&
        (result.geyser_transport === "nethernet" || result.geyser_udp_ready === true)
        ? t.portOpen
        : result.geyser_ready === false || result.geyser_udp_ready === false
          ? t.portClosed
          : t.unknownStatus],
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
  updateActionButtons();
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
    updateActionButtons();
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
      const ready = isServerReady(status);

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

function renderTechnicalSpecs(d) {
  const target = document.querySelector("#technical-specs");
  if (!target) return;
  const t = translations[currentLanguage];
  const services = d.services || {};
  const unknown = t.unavailableValue;

  function versionOnly(value) {
    if (!value || /not installed|no instalado|não instalado|not identified|no identificado|não identificado|unavailable|no disponible|indisponível/i.test(String(value))) return "";
    const match = String(value).match(/(?:version\s+)?v?(\d+(?:\.\d+)+(?:[-+][\w.-]+)?)/i);
    return match ? match[1] : String(value);
  }
  function safe(value) {
    return value && !/^não identificado|^not identified|^no identificado|^unavailable$/i.test(String(value))
      ? String(value) : unknown;
  }
  const brandMarks = {
    azure: '<svg viewBox="0 0 24 24"><path d="M13.1 2h7.2L11.7 22H4.1L13.1 2Zm-1.5 12.2h8.1l-2.1 4.5h-8.1l2.1-4.5Z" fill="currentColor"/></svg>',
    ubuntu: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.2" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="3.2" r="2" fill="currentColor"/><circle cx="4.4" cy="16.4" r="2" fill="currentColor"/><circle cx="19.6" cy="16.4" r="2" fill="currentColor"/></svg>',
    linux: '<svg viewBox="0 0 24 24"><path d="M12 2.5c-3.8 0-5.5 3.4-5.5 7.2 0 2.1-1.4 3.1-2 4.8-.5 1.5.2 2.7 1.5 2.7 1.1 0 1.6-1.2 2.4-1.2h7.2c.8 0 1.3 1.2 2.4 1.2 1.3 0 2-1.2 1.5-2.7-.6-1.7-2-2.7-2-4.8 0-3.8-1.7-7.2-5.5-7.2Z" fill="currentColor"/><circle cx="9.5" cy="8.5" r="1" fill="#172015"/><circle cx="14.5" cy="8.5" r="1" fill="#172015"/><path d="m10 12 2 1.4 2-1.4" fill="none" stroke="#172015" stroke-width="1.2" stroke-linecap="round"/></svg>',
    docker: '<svg viewBox="0 0 24 24"><path d="M2 13h19c-.7 4.1-3.3 6.2-7.5 6.2H8.1C4.8 19.2 2.7 17.2 2 13Zm3-4h3v3H5V9Zm4 0h3v3H9V9Zm4 0h3v3h-3V9Zm-4-4h3v3H9V5Zm4 4h3v3h-3V9Zm4 1.2c1.5-1.4 3.1-1.5 4.7-.4-.7 1.1-2.1 1.6-4.2 1.3l-.5-.9Z" fill="currentColor"/></svg>',
    java: '<svg viewBox="0 0 24 24"><path d="M7 13h11l-1 5H9l-2-5Zm11 1h2.2a2 2 0 0 1-2 2H18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 10c-1-1 1-1.5 0-2.5m4 2.5c-1-1 1-1.5 0-2.5M7 20h13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    python: '<svg viewBox="0 0 24 24"><path d="M12 2.5c-4.3 0-4.1 1.9-4.1 1.9v3.1h4.2v1H6.3S3 8.1 3 12.4s2.9 4.2 2.9 4.2h1.7v-2.3s-.1-2.8 2.8-2.8h4.7s2.6 0 2.6-2.6V5.1s.4-2.6-5.7-2.6ZM9.7 5a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z" fill="currentColor"/><path d="M12 21.5c4.3 0 4.1-1.9 4.1-1.9v-3.1h-4.2v-1h5.8s3.3.4 3.3-3.9-2.9-4.2-2.9-4.2h-1.7v2.3s.1 2.8-2.8 2.8H8.9s-2.6 0-2.6 2.6v3.8s-.4 2.6 5.7 2.6Z" fill="currentColor"/></svg>',
    cloudflare: '<svg viewBox="0 0 24 24"><path d="M6 18.5h12.2a3.2 3.2 0 0 0 .3-6.4 6.8 6.8 0 0 0-13.1-1.5A4 4 0 0 0 6 18.5Z" fill="currentColor"/><path d="M4 19.5h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    minecraft: '<svg viewBox="0 0 24 24"><path d="M3 6.5 12 2l9 4.5v11L12 22l-9-4.5v-11Z" fill="currentColor"/><path d="m3 6.5 9 4.6 9-4.6M12 11.1V22" fill="none" stroke="#172015" stroke-width="1.5"/><path d="M6 7.8 8 8.8v2L6 9.8Zm7 3.5 2 1v2l-2-1Zm4-3.5 2-1v2l-2 1Z" fill="#172015"/></svg>'
  };
  function addCard(label, value, detail, brand) {
    const card = document.createElement("article");
    card.className = "detected-card";
    const top = document.createElement("div");
    top.className = "detected-top";
    if (brand && brandMarks[brand]) {
      const logo = document.createElement("span");
      logo.className = "brand-logo " + brand + "-logo";
      logo.setAttribute("aria-hidden", "true");
      logo.innerHTML = brandMarks[brand];
      top.append(logo);
    }
    const name = document.createElement("span");
    name.className = "detected-label";
    name.textContent = label;
    top.append(name);
    const strong = document.createElement("strong");
    strong.className = "detected-value";
    strong.textContent = value || unknown;
    card.append(top, strong);
    if (detail) {
      const small = document.createElement("small");
      small.className = "detected-sub";
      small.textContent = detail;
      card.append(small);
    }
    target.append(card);
  }

  target.replaceChildren();
  const dockerCli = versionOnly(d.docker);
  const dockerEngine = versionOnly(d.docker_server);
  const kernel = d.kernel ? t.kernelLabelShort + " " + d.kernel : "";
  const dockerDetails = [];
  if (dockerEngine) dockerDetails.push(t.dockerEngineLabel + " " + dockerEngine);
  if (d.container_image) dockerDetails.push(t.containerImageLabel + " " + d.container_image);
  const minecraftDetails = [];
  if (d.server_type && d.server_type !== "Não identificado") minecraftDetails.push(d.server_type);
  if (d.fabric_loader && d.fabric_loader !== "Não identificado") minecraftDetails.push(t.fabricLabel + " " + d.fabric_loader);
  const tunnelState = services.cloudflared === "active" ? t.activeStatus :
    services.cloudflared === "inactive" ? t.inactiveStatus : t.unknownStatus;

  addCard(t.azureName, t.azureComponent, t.azureDescription, "azure");
  addCard(t.techOS, safe(d.os), [d.architecture, kernel].filter(Boolean).join(" · "), "ubuntu");
  addCard(t.techDocker, dockerCli || dockerEngine, dockerDetails.join(" · "), "docker");
  addCard(t.techJava, versionOnly(d.java), t.javaRuntimeDescription, "java");
  addCard("Python", versionOnly(d.python), t.agentRuntimeLabel, "python");
  addCard("cloudflared", versionOnly(d.cloudflared), t.tunnelStatusLabel + ": " + tunnelState, "cloudflare");
  addCard(t.techMinecraft, safe(d.minecraft), minecraftDetails.join(" · "), "minecraft");

  const mods = Array.isArray(d.mods) ? d.mods : [];
  const plugins = Array.isArray(d.plugins) ? d.plugins : [];
  const section = document.createElement("section");
  section.className = "mods-panel";
  const heading = document.createElement("div");
  heading.className = "mods-heading";
  const title = document.createElement("h3");
  title.textContent = t.loadedModsTitle + " · " + (d.mod_count ?? mods.length);
  const intro = document.createElement("p");
  intro.textContent = t.loadedModsIntro +
    (d.mods_status === "last_loaded" ? " · " + t.modsLastStartup : "");
  heading.append(title, intro);
  section.append(heading);

  if (mods.length) {
    const list = document.createElement("div");
    list.className = "mods-list";
    const descriptions = {
      lithium: t.modDescLithium,
      servercore: t.modDescServerCore,
      "alternate-current": t.modDescAlternateCurrent,
      alternate_current: t.modDescAlternateCurrent,
      spark: t.modDescSpark,
      fabric_api: t.modDescFabricApi,
      "fabric-api": t.modDescFabricApi,
      floodgate: t.modDescFloodgate,
      ferritecore: t.modDescFerritecore,
      essential_commands: t.modDescEssentialCommands,
      "essential-commands": t.modDescEssentialCommands,
      chunky: t.modDescChunky,
      "geyser-fabric": t.modDescGeyser,
      krypton: t.modDescKrypton
    };
    const modMarks = {
      floodgate: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M13 52V29a19 19 0 0 1 38 0v23" fill="none" stroke="#68c9ef" stroke-width="6" stroke-linecap="round"/><path d="M8 52h48" stroke="#68c9ef" stroke-width="6" stroke-linecap="round"/><path d="M16 40c5-5 10 5 15 0s10 5 17 0" fill="none" stroke="#b4ecff" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="15" r="4" fill="#b4ecff"/></svg>',
      chunky: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="m32 6 24 13v27L32 59 8 46V19L32 6Z" fill="#8b9b63"/><path d="m8 19 24 13 24-13M32 32v27" fill="none" stroke="#26351f" stroke-width="3"/><path d="m20 12 24 13v9L20 21v-9Z" fill="#c2d48b"/><path d="M16 36v8l7 4v-8l-7-4Zm24 5v8l7-4v-8l-7 4Z" fill="#526b3e"/></svg>',
      "geyser-fabric": '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 48c7-8 13 8 20 0s13 8 20 0 7 1 8 1" fill="none" stroke="#54c8ed" stroke-width="6" stroke-linecap="round"/><path d="M17 39c-5-7 6-10 2-17m14 17c-5-7 6-10 2-17m14 17c-5-7 6-10 2-17" fill="none" stroke="#9ce8ff" stroke-width="5" stroke-linecap="round"/><path d="M7 54h50" stroke="#54c8ed" stroke-width="4" stroke-linecap="round"/></svg>',
      geyser: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 48c7-8 13 8 20 0s13 8 20 0 7 1 8 1" fill="none" stroke="#54c8ed" stroke-width="6" stroke-linecap="round"/><path d="M17 39c-5-7 6-10 2-17m14 17c-5-7 6-10 2-17m14 17c-5-7 6-10 2-17" fill="none" stroke="#9ce8ff" stroke-width="5" stroke-linecap="round"/><path d="M7 54h50" stroke="#54c8ed" stroke-width="4" stroke-linecap="round"/></svg>'
    };
    mods.forEach(mod => {
      const item = document.createElement("article");
      item.className = "mod-item";
      const displayName = mod.name || mod.id || mod.file || "Mod";
      const icon = document.createElement("div");
      icon.className = "mod-icon";
      if (typeof mod.icon === "string" &&
          /^data:image\/(png|jpeg|webp|gif);base64,/i.test(mod.icon) &&
          mod.icon.length <= 180000) {
        const image = document.createElement("img");
        image.src = mod.icon;
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        icon.append(image);
      } else {
        const modIdentity = [mod.id, mod.file, mod.name]
          .filter(Boolean).join(" ").toLowerCase();
        const modKey = modIdentity.includes("floodgate") ? "floodgate" :
          modIdentity.includes("chunky") ? "chunky" :
          modIdentity.includes("geyser") ? "geyser" : "";
        if (modKey && modMarks[modKey]) {
          icon.innerHTML = modMarks[modKey];
          icon.setAttribute("aria-hidden", "true");
        } else {
          icon.textContent = String(displayName).trim().charAt(0).toUpperCase() || "M";
          icon.setAttribute("aria-hidden", "true");
        }
      }
      const content = document.createElement("div");
      content.className = "mod-content";
      const name = document.createElement("strong");
      name.textContent = displayName;
      const version = document.createElement("span");
      version.className = "mod-version";
      version.textContent = mod.version ? "v" + mod.version : unknown;
      const desc = document.createElement("p");
      desc.textContent = descriptions[String(mod.id || "").toLowerCase()] || t.modDescUnavailable;
      content.append(name, version, desc);
      item.append(icon, content);
      list.append(item);
    });
    section.append(list);
  } else {
    const empty = document.createElement("p");
    empty.className = "mods-empty";
    empty.textContent = t.noModsDetected;
    section.append(empty);
  }

  if (plugins.length) {
    const pluginSummary = document.createElement("p");
    pluginSummary.className = "mods-plugin-summary";
    pluginSummary.textContent = t.pluginsLabel + ": " +
      plugins.map(plugin => plugin.name || plugin.file).join(", ");
    section.append(pluginSummary);
  }
  target.append(section);

  const checked = document.createElement("p");
  checked.className = "section-copy";
  checked.style.gridColumn = "1 / -1";
  checked.textContent = t.updatedAtLabel + ": " +
    (d.checked_at ? new Date(d.checked_at).toLocaleString(
      currentLanguage === "pt" ? "pt-PT" : currentLanguage === "es" ? "es-ES" : "en-GB"
    ) : unknown);
  target.append(checked);
}

async function loadTechnicalSpecs() {
  const target = document.querySelector("#technical-specs");
  if (!target) return;
  try {
    const response = await fetchWithTimeout(WORKER_URL + "/api/technical");
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error("Technical data unavailable");
    lastTechnicalData = data.result || {};
    renderTechnicalSpecs(lastTechnicalData);
  } catch {
    target.textContent = translations[currentLanguage].techUnavailable;
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
  updateActionButtons();
  const requestId = action === "status" ? crypto.randomUUID() : null;

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
      if (response.status === 429) {
        showFeedback("rateLimited");
      } else if (response.status === 401) {
        showFeedback("wrongPassword");
      } else if (response.status === 403) showFeedback("notAllowed");
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

      // 202 = resultado ainda não chegou; 429 = limite temporário atingido.
      if (statusResponse.status === 202) continue;
      if (statusResponse.status === 429) {
        showFeedback("rateLimited");
        return;
      }

      const statusResult = await statusResponse.json();
      if (!statusResponse.ok || !statusResult.ok) {
        showFeedback("requestError");
        return;
      }
      let privateResult;
      try {
        privateResult = await globalThis.decryptPrivateStatus(statusResult.envelope, password);
      } catch {
        showFeedback("requestError");
        return;
      }
      renderStatus({ ...privateResult, private: true });
      showFeedback("statusReady");
      return;
    }
    showFeedback("statusTimeout");
  } catch {
    showFeedback("connectionError");
  } finally {
    actionInProgress = false;
    updateActionButtons();
  }
}
passwordInput?.addEventListener("input", () => {
  updateActionButtons();
});
passwordInput?.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    requestAction("status");
  }
});
languageSelect?.addEventListener("change", event => setLanguage(event.target.value));
document.querySelector("#start-button")?.addEventListener("click", () => requestAction("start"));
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
