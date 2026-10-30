// Este painel é apenas informativo.
// Os comandos de ligar/desligar são executados manualmente em GitHub Actions.
// Não colocar tokens ou credenciais neste ficheiro.

const feedback = document.querySelector("#feedback");
const startButton = document.querySelector("#start-button");
const statusButton = document.querySelector("#status-button");
const address = document.querySelector("#server-address");

if (startButton) {
  startButton.disabled = true;
  startButton.title = "Executa o workflow 'Ligar Servidor Minecraft' no GitHub Actions.";
}

if (statusButton) {
  statusButton.disabled = true;
  statusButton.title = "Executa o workflow 'Verificar Servidor Minecraft' no GitHub Actions.";
}

if (address) {
  address.textContent = "Disponível após ligar o servidor";
}

if (feedback) {
  feedback.textContent = "Por segurança e para evitar serviços pagos, os comandos são executados através do GitHub Actions. Esta página não recolhe nem guarda credenciais.";
}
