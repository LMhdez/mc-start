// URL publica do Cloudflare Worker. Nao colocar tokens neste ficheiro.
const WORKER_URL = "COLOCA_AQUI_O_URL_DO_WORKER";

const passwordInput = document.querySelector("#access-password");
const feedback = document.querySelector("#feedback");
const buttons = [
  document.querySelector("#start-button"),
  document.querySelector("#stop-button"),
  document.querySelector("#status-button")
];

async function requestAction(action) {
  const password = passwordInput?.value || "";

  if (!password) {
    feedback.textContent = "Introduz a palavra-passe de acesso.";
    passwordInput?.focus();
    return;
  }

  if (WORKER_URL.startsWith("COLOCA_AQUI")) {
    feedback.textContent = "O Worker ainda nao foi implementado/configurado.";
    return;
  }

  buttons.forEach(button => button.disabled = true);
  feedback.textContent = "A enviar pedido...";

  try {
    const response = await fetch(`${WORKER_URL.replace(/\/$/, "")}/api/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, password })
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Nao foi possivel executar o pedido.");
    }

    feedback.textContent = result.message + " O GitHub Actions pode demorar alguns minutos.";
  } catch (error) {
    feedback.textContent = error.message || "Erro de comunicacao com o servico.";
  } finally {
    buttons.forEach(button => button.disabled = false);
  }
}

document.querySelector("#start-button")?.addEventListener("click", () => requestAction("start"));
document.querySelector("#stop-button")?.addEventListener("click", () => requestAction("stop"));
document.querySelector("#status-button")?.addEventListener("click", () => requestAction("status"));
