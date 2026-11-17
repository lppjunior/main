import { COLUMN } from "../domain/columns.js";
import { alertText } from "../domain/property.js";
import { fetchLocation } from "../data/api.js";
import { $, addText, closeOnOutsideClick } from "./dom.js";
import { createPropertyActions } from "./property-actions.js";
import { createPropertyMap } from "./property-map.js";

const FIELDS = [
  ["Nº do imóvel", COLUMN.ID],
  ["UF", COLUMN.UF],
  ["Cidade", COLUMN.CITY],
  ["Bairro", COLUMN.DISTRICT],
  ["Endereço", COLUMN.ADDRESS],
  ["Preço", COLUMN.PRICE, value => `R$ ${value}`],
  ["Valor de avaliação", COLUMN.ASSESSMENT, value => `R$ ${value}`],
  ["Desconto", COLUMN.DISCOUNT, value => `${value.replace(".", ",")}%`],
  ["Financiamento", COLUMN.FINANCING],
  ["Descrição", COLUMN.DESCRIPTION],
  ["Modalidade de venda", COLUMN.MODALITY],
];

export function createPropertyDialog() {
  const dialog = $("#property-dialog");
  const title = $("#property-title");
  const actions = $("#property-dialog-actions");
  const fields = $("#property-fields");
  const alert = $("#property-alert");
  const status = $("#map-status");
  const map = createPropertyMap($("#property-map"));
  // Descarta respostas de consultas de localização de imóveis já fechados.
  let requestId = 0;

  closeOnOutsideClick(dialog);
  dialog.addEventListener("close", () => {
    requestId++;
    map.destroy();
  });

  function renderFields(row) {
    fields.replaceChildren();
    for (const [label, column, format] of FIELDS) {
      const value = row[column];
      addText(fields, "dt", label);
      addText(fields, "dd", (value && format ? format(value) : value) || "Não informado");
    }
  }

  async function showLocation(id, currentRequest) {
    try {
      const location = await fetchLocation(id);
      if (currentRequest !== requestId || !dialog.open) return;
      if (!location) {
        status.textContent = "Localização não encontrada. Confira o endereço no anúncio da Caixa.";
        return;
      }
      map.show(location, () => {
        if (currentRequest === requestId) {
          status.textContent = "Não foi possível carregar parte do mapa. Confira o endereço no anúncio da Caixa.";
        }
      });
      status.textContent = `Localização aproximada; confirme o endereço antes de tomar decisões. Resultado: ${location.endereco}`;
    } catch (error) {
      if (currentRequest !== requestId || !dialog.open) return;
      console.error("Erro ao consultar a localização:", error);
      status.textContent = "Não foi possível carregar a localização. Confira o endereço no anúncio da Caixa.";
      map.hide();
    }
  }

  return {
    async open(property) {
      const currentRequest = ++requestId;
      map.destroy();
      title.textContent = `Imóvel ${property.row[COLUMN.ID]}`;
      actions.replaceChildren(createPropertyActions(property));
      renderFields(property.row);
      alert.replaceChildren();
      if (property.alert) addText(alert, "p", alertText(property), "notice");
      map.hide();
      status.textContent = "Buscando localização aproximada...";
      dialog.showModal();
      await showLocation(property.row[COLUMN.ID], currentRequest);
    },
  };
}
