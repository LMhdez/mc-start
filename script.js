// A ligação ao endpoint será configurada numa fase seguinte.
// Nunca colocar tokens do GitHub ou segredos neste ficheiro público.

const feedback = document.querySelector("#feedback");
const startButton = document.querySelector("#start-button");
const statusButton = document.querySelector("#status-button");

function showSetupMessage() {
  if (feedback) {
    feedback.textContent =
      "A página está publicada, mas os comandos ainda não estão ativos. Falta configurar o endpoint seguro que comunica com o GitHub Actions.";
  }
}

if (startButton) startButton.addEventListener("click", showSetupMessage);
if (statusButton) statusButton.addEventListener("click", showSetupMessage);
