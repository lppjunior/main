import { normalize } from "../domain/text.js";

const MAX_VISIBLE_OPTIONS = 100;

// Menu suspenso de seleção múltipla com busca (UF, cidade ou bairro).
export function createLocationFilter(root, { placeholder, onSelectionChange }) {
  const search = root.querySelector("input[type=search]");
  const list = root.querySelector(".location-options");
  const count = root.querySelector(".location-count");
  const summary = root.querySelector("summary span");
  const selected = new Set();
  let options = [];

  function renderSummary() {
    const values = [...selected];
    summary.textContent = values.length === 0 ? placeholder
      : values.length === 1 ? options.find(option => option.value === values[0]).label
        : `${values.length} selecionados`;
  }

  function createOption(option) {
    const label = document.createElement("label");
    label.className = "location-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = option.value;
    checkbox.checked = selected.has(option.value);
    label.append(checkbox, document.createTextNode(option.label));
    return label;
  }

  function render() {
    renderSummary();
    const term = normalize(search.value);
    const matches = options.filter(option => normalize(option.label).includes(term));
    matches.sort((a, b) => Number(selected.has(b.value)) - Number(selected.has(a.value)) || a.label.localeCompare(b.label, "pt-BR"));
    list.replaceChildren(...matches.slice(0, MAX_VISIBLE_OPTIONS).map(createOption));
    count.textContent = matches.length > MAX_VISIBLE_OPTIONS
      ? `Mostrando ${MAX_VISIBLE_OPTIONS} de ${matches.length} opções. Digite para refinar.`
      : matches.length ? "" : "Nenhuma opção encontrada.";
  }

  search.addEventListener("input", render);
  list.addEventListener("change", ({ target }) => {
    if (target.checked) selected.add(target.value);
    else selected.delete(target.value);
    onSelectionChange(target.value);
  });
  root.querySelector(".location-clear").addEventListener("click", () => {
    selected.clear();
    onSelectionChange(null);
  });

  return {
    root,
    selected,
    get options() {
      return options;
    },
    // Remove seleções que deixaram de estar disponíveis.
    setOptions(newOptions) {
      options = newOptions;
      const available = new Set(newOptions.map(option => option.value));
      for (const value of selected) {
        if (!available.has(value)) selected.delete(value);
      }
      render();
    },
    // Aceita o valor atual ou o nome simples gravado por versões anteriores.
    selectMatching(values) {
      for (const value of values) {
        if (typeof value !== "string" || !value) continue;
        for (const option of options) {
          if (option.value === value || option.legacy === value) selected.add(option.value);
        }
      }
    },
    reset() {
      selected.clear();
      root.open = false;
    },
    focusOption(value) {
      [...list.querySelectorAll("input")].find(input => input.value === value)?.focus();
    },
    close() {
      root.open = false;
    },
  };
}
