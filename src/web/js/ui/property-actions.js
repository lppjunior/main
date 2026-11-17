import { COLUMN } from "../domain/columns.js";
import { caixaUrl, googleMapsUrl } from "../domain/property.js";
import { createIcon, ICON_PATHS } from "./icons.js";

function createExternalLink(href) {
  if (!href) return document.createElement("span");
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function createDetailsButton(onOpenDetails) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "detail-button";
  button.addEventListener("click", onOpenDetails);
  return button;
}

// Elementos indisponíveis (<span>) permanecem visíveis, mas desabilitados.
function decorate(element, label, iconPath) {
  const available = element.tagName !== "SPAN";
  const description = available ? label : `${label} — indisponível`;
  element.classList.add("icon-action");
  element.title = description;
  element.setAttribute("aria-label", description);
  if (!available) element.setAttribute("aria-disabled", "true");
  element.replaceChildren(createIcon(iconPath));
  return element;
}

export function createPropertyActions(property, { onOpenDetails } = {}) {
  const id = property.row[COLUMN.ID];
  const container = document.createElement("div");
  container.className = "action-links";
  container.append(
    decorate(createExternalLink(caixaUrl(property)), `Ver imóvel ${id} na Caixa`, ICON_PATHS.house),
    decorate(createExternalLink(googleMapsUrl(property)), `Buscar imóvel ${id} no Google Maps`, ICON_PATHS.map),
  );
  if (onOpenDetails) {
    container.append(decorate(createDetailsButton(() => onOpenDetails(property)), `Ver detalhes do imóvel ${id}`, ICON_PATHS.details));
  }
  return container;
}
