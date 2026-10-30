// O token do GitHub NUNCA deve ser colocado neste ficheiro.
// O código de acesso do painel é recebido apenas através do fragmento do link (#key=...).
// O fragmento não é enviado automaticamente ao servidor web.

const API_URL = "https://SUBSTITUIR-NOME.azurewebsites.net/api/control";

const feedback = document.querySelector("#feedback");
const startButton = document.querySelector("#start-button");
const statusButton = document.querySelector("#status-button");
const address = document.querySelector("#server-address");

function getAccessKey() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return params.get("key");
}

function showMessage(message) {
  if (feedback) feedback.textContent = message;
}

async function sendCommand(action) {
  const key = getAccessKey();

  if (!key) {
    showMessage("Falta o código de acesso. Abre o link privado que recebeste.");
    return;
  }

  if (!API_URL.startsWith("https://") || API_URL.includes("SUBSTITUIR-NOME")) {
    showMessage("O endpoint ainda não está configurado.");
    return;
  }

  const button = action === "start" ? startButton : null;
  if (button) button.disabled = true;
  showMessage(action === "start" ? "A enviar pedido para ligar o servidor..." : "A enviar pedido...");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-launcher-key": key
      },
      body: JSON.stringify({ action })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || `Erro HTTP ${response.status}`);
    }

    showMessage(result.message || "Pedido aceite pelo GitHub. A VM ainda pode demorar alguns minutos a arrancar.");
  } catch (error) {
    showMessage(error.message || "Não foi possível contactar o serviço.");
  } finally {
    if (button) button.disabled = false;
  }
}

if (startButton) {
  startButton.disabled = false;
  startButton.addEventListener("click", () => sendCommand("start"));
}

if (statusButton) {
  statusButton.disabled = true;
  statusButton.title = "A consulta de estado será ligada numa fase seguinte.";
}

if (address) address.textContent = "A consultar/configurar";
showMessage("O painel está preparado. O comando de ligar ficará funcional depois de publicares a Azure Function e configurares o endereço neste ficheiro.");
