import { $ } from "./dom.js";

export function createStatusBar() {
  const status = $("#status");
  const alertInfo = $("#alert-info");
  const retry = $("#retry");
  const sync = $("#sync");

  return {
    onSync: listener => sync.addEventListener("click", listener),
    onRetry: listener => retry.addEventListener("click", listener),
    showLoading() {
      status.textContent = "Carregando a lista da Caixa...";
      alertInfo.textContent = "Carregando alertas históricos...";
      retry.hidden = true;
      sync.disabled = true;
    },
    showLoaded({ dataGeracao, total, alertsAvailable }) {
      alertInfo.textContent = alertsAvailable
        ? "Alerta histórico: parte do bairro foi mapeada por grupos armados em 2022 na cidade do Rio. Não confirma risco no endereço nem a situação atual; os demais imóveis não foram avaliados."
        : "A base de alertas históricos está indisponível. Nenhum endereço foi avaliado.";
      status.textContent = `Gerado pela Caixa: ${dataGeracao}  ·  CSV local  ·  ${total.toLocaleString("pt-BR")} imóveis`;
    },
    showFailure(localOnly) {
      status.textContent = localOnly
        ? "Não foi possível carregar o CSV local. Verifique se o arquivo existe e é válido."
        : "Não foi possível carregar a lista da Caixa. Tente novamente.";
      alertInfo.textContent = "Não foi possível avaliar alertas.";
      retry.hidden = false;
    },
    finish() {
      sync.disabled = false;
    },
  };
}
