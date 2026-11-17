import { listSavedFilterNames, loadSavedFilter, saveFilter } from "../data/filter-storage.js";
import { $, setSelectOptions } from "./dom.js";

export function createSavedFilters(form, { onApply }) {
  const nameInput = $("#filter-name");
  const select = $("#saved-filters");

  function refresh(selected = "") {
    try {
      setSelectOptions(select, listSavedFilterNames(), "Filtros salvos");
      select.value = selected;
    } catch (error) {
      console.error("Não foi possível ler os filtros salvos:", error);
      form.showMessage("Não foi possível ler os filtros salvos neste navegador.");
    }
  }

  function save() {
    const name = nameInput.value.trim();
    if (!name) {
      form.showMessage("Informe um nome para salvar o filtro.");
      return;
    }
    if (!form.isValid()) {
      form.showMessage("Corrija os filtros antes de salvar.");
      return;
    }
    try {
      saveFilter(name, form.snapshot());
      refresh(name);
      form.showMessage("Filtro salvo neste navegador.");
    } catch (error) {
      console.error("Não foi possível salvar o filtro:", error);
      form.showMessage("Não foi possível salvar o filtro neste navegador.");
    }
  }

  function apply() {
    if (!select.value) return;
    try {
      form.restore(loadSavedFilter(select.value));
      nameInput.value = select.value;
      onApply();
    } catch (error) {
      console.error("Não foi possível aplicar o filtro salvo:", error);
      form.showMessage("Não foi possível aplicar o filtro salvo.");
    }
  }

  $("#save-filter").addEventListener("click", save);
  select.addEventListener("change", apply);
  refresh();

  return {
    clearSelection() {
      nameInput.value = "";
      select.value = "";
    },
  };
}
