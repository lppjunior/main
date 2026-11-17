import { COLUMN } from "../domain/columns.js";
import { alertText } from "../domain/property.js";
import { $, closeOnOutsideClick } from "./dom.js";

export function createAlertDialog() {
  const dialog = $("#alert-dialog");
  const title = $("#alert-title");
  const description = $("#alert-description");

  closeOnOutsideClick(dialog);
  dialog.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    dialog.close();
  });

  return {
    open(property) {
      title.textContent = `Alerta histórico — imóvel ${property.row[COLUMN.ID]}`;
      description.textContent = alertText(property);
      dialog.showModal();
    },
  };
}
