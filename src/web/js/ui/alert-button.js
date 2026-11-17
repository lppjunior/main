import { COLUMN } from "../domain/columns.js";

export function createAlertButton(property, onOpenAlert) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button alert-button";
  button.textContent = "Ver motivo";
  button.setAttribute("aria-label", `Ver motivo do alerta do imóvel ${property.row[COLUMN.ID]}`);
  button.addEventListener("click", () => onOpenAlert(property));
  return button;
}
