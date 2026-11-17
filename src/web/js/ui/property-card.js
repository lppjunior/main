import { COLUMN } from "../domain/columns.js";
import { formatArea, formatDiscount } from "../domain/format.js";
import { createAlertButton } from "./alert-button.js";
import { addText, makeClickable } from "./dom.js";
import { createPropertyActions } from "./property-actions.js";

export function createPropertyCard(property, handlers, rank) {
  const { row } = property;
  const card = document.createElement("article");
  card.className = `property-card${property.alert ? " has-alert" : ""}`;
  makeClickable(card, () => handlers.openDetails(property));

  const head = document.createElement("div");
  head.className = "card-heading";
  addText(head, "span", property.type || "Imóvel", "type-badge");
  const badges = document.createElement("div");
  if (rank) addText(badges, "span", `#${rank}`, "rank-badge");
  if (property.discount !== null) addText(badges, "span", `-${formatDiscount(property.discount)}`, "discount-badge");
  head.append(badges);
  card.append(head);

  addText(card, "strong", `R$ ${row[COLUMN.PRICE]}`, "card-price");
  addText(card, "span", `Avaliação: R$ ${row[COLUMN.ASSESSMENT]}`, "card-assessment");
  addText(card, "p", `${row[COLUMN.DISTRICT]} · ${row[COLUMN.CITY]}/${row[COLUMN.UF]}`, "card-location");

  const meta = document.createElement("div");
  meta.className = "card-meta";
  const rooms = property.rooms === null ? "" : ` · ${property.rooms} quarto(s)`;
  addText(meta, "span", `${formatArea(property.area)}${rooms}`);
  meta.append(createPropertyActions(property, { onOpenDetails: handlers.openDetails }));
  card.append(meta);

  if (property.alert) card.append(createAlertButton(property, handlers.openAlert));
  return card;
}
