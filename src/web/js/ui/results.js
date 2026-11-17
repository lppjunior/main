import { COLUMN } from "../domain/columns.js";
import { formatArea, formatDiscount } from "../domain/format.js";
import { createAlertButton } from "./alert-button.js";
import { $, addText, makeClickable } from "./dom.js";
import { createPropertyActions } from "./property-actions.js";
import { createPropertyCard } from "./property-card.js";

export const PAGE_SIZE = 50;

function createRow(property, handlers) {
  const { row } = property;
  const tr = document.createElement("tr");
  makeClickable(tr, () => handlers.openDetails(property));
  if (property.alert) tr.classList.add("has-alert");

  addText(tr, "td", row[COLUMN.MODALITY]);
  const actions = document.createElement("td");
  actions.className = "row-actions";
  actions.append(createPropertyActions(property, { onOpenDetails: handlers.openDetails }));
  tr.append(actions);
  const values = [row[COLUMN.UF], row[COLUMN.CITY], row[COLUMN.DISTRICT], property.type,
    `R$ ${row[COLUMN.PRICE]}`, `R$ ${row[COLUMN.ASSESSMENT]}`, formatDiscount(property.discount), formatArea(property.area),
    row[COLUMN.ADDRESS], row[COLUMN.FINANCING], row[COLUMN.DESCRIPTION]];
  for (const value of values) addText(tr, "td", value);

  const alertCell = document.createElement("td");
  alertCell.className = "action-column";
  if (property.alert) alertCell.append(createAlertButton(property, handlers.openAlert));
  else alertCell.textContent = "Não avaliado";
  tr.append(alertCell);
  return tr;
}

export function createResults(handlers) {
  const table = $("#properties");
  const body = table.querySelector("tbody");
  const tableWrap = $("#table-wrap");
  const cards = $("#result-cards");
  const empty = $("#results-empty");
  const count = $("#result-count");
  const pagination = $("#pagination");
  const previous = $("#previous");
  const next = $("#next");
  const pageInfo = $("#page-info");
  const listView = $("#list-view");
  const gridView = $("#grid-view");

  return {
    onPrevious: listener => previous.addEventListener("click", listener),
    onNext: listener => next.addEventListener("click", listener),
    onListView: listener => listView.addEventListener("click", listener),
    onGridView: listener => gridView.addEventListener("click", listener),
    render({ filtered, page, view }) {
      const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      body.replaceChildren(...visible.map(property => createRow(property, handlers)));
      cards.replaceChildren(...(view === "grid" ? visible.map(property => createPropertyCard(property, handlers)) : []));
      table.hidden = view !== "list" || !visible.length;
      tableWrap.hidden = view !== "list";
      cards.hidden = view !== "grid" || !visible.length;
      empty.hidden = filtered.length > 0;
      count.textContent = `(${filtered.length.toLocaleString("pt-BR")} imóveis)`;
      pagination.hidden = filtered.length === 0;
      const pages = Math.ceil(filtered.length / PAGE_SIZE);
      pageInfo.textContent = `Página ${page + 1} de ${pages}`;
      previous.disabled = page === 0;
      next.disabled = page >= pages - 1;
      listView.setAttribute("aria-pressed", String(view === "list"));
      gridView.setAttribute("aria-pressed", String(view === "grid"));
    },
  };
}
