import { topDiscounts } from "../domain/filtering.js";
import { $ } from "./dom.js";
import { createPropertyCard } from "./property-card.js";

const COLLAPSED_SIZE = 3;

export function createRanking(handlers) {
  const cards = $("#ranking-cards");
  const toggle = $("#ranking-toggle");
  const empty = $("#ranking-empty");

  return {
    onToggle(listener) {
      toggle.addEventListener("click", listener);
    },
    render({ filtered, rankingExpanded: expanded }) {
      const ranked = topDiscounts(filtered);
      const shown = ranked.slice(0, expanded ? ranked.length : COLLAPSED_SIZE);
      cards.replaceChildren(...shown.map((property, index) => createPropertyCard(property, handlers, index + 1)));
      toggle.hidden = ranked.length <= COLLAPSED_SIZE;
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.textContent = expanded ? "Mostrar menos ↑" : `Mostrar todos (${ranked.length}) ↓`;
      empty.hidden = ranked.length > 0;
      empty.textContent = filtered.length
        ? "Nenhum imóvel com desconto informado."
        : "Nenhum imóvel encontrado para os filtros selecionados.";
    },
  };
}
