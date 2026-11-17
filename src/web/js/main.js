import { fetchProperties } from "./data/api.js";
import { filterProperties } from "./domain/filtering.js";
import { createProperty } from "./domain/property.js";
import { createStore } from "./store.js";
import { $ } from "./ui/dom.js";
import { createAlertDialog } from "./ui/alert-dialog.js";
import { createFilterForm } from "./ui/filter-form.js";
import { createPropertyDialog } from "./ui/property-dialog.js";
import { createRanking } from "./ui/ranking.js";
import { createResults } from "./ui/results.js";
import { createSavedFilters } from "./ui/saved-filters.js";
import { createStatusBar } from "./ui/status-bar.js";

const store = createStore({ properties: [], filtered: [], page: 0, view: "list", rankingExpanded: false });

const propertyDialog = createPropertyDialog();
const alertDialog = createAlertDialog();
const handlers = {
  openDetails: property => propertyDialog.open(property),
  openAlert: property => alertDialog.open(property),
};
const ranking = createRanking(handlers);
const results = createResults(handlers);
const statusBar = createStatusBar();
const form = createFilterForm({ onChange: () => applyFilters() });
const savedFilters = createSavedFilters(form, { onApply: () => applyFilters() });
let lastLoadLocalOnly = false;

function applyFilters(properties = store.get().properties) {
  const criteria = form.criteria();
  if (!criteria) return;
  store.set({ properties, filtered: filterProperties(properties, criteria), page: 0 });
}

async function loadProperties(localOnly = false) {
  lastLoadLocalOnly = localOnly;
  statusBar.showLoading();
  try {
    const data = await fetchProperties({ localOnly });
    const alertsAvailable = Array.isArray(data.alertas);
    const properties = data.imoveis.map((row, index) => createProperty(row, data.alertas?.[index] ?? null));
    form.setAlertsAvailable(alertsAvailable);
    statusBar.showLoaded({ dataGeracao: data.dataGeracao, total: properties.length, alertsAvailable });
    form.setProperties(properties);
    applyFilters(properties);
  } catch (error) {
    console.error("Erro ao carregar a lista da Caixa:", error);
    form.setAlertsAvailable(false);
    statusBar.showFailure(localOnly);
    store.set({ properties: [], filtered: [], page: 0 });
  } finally {
    statusBar.finish();
  }
}

store.subscribe(state => {
  ranking.render(state);
  results.render(state);
});
ranking.onToggle(() => store.set({ rankingExpanded: !store.get().rankingExpanded }));
results.onPrevious(() => store.set({ page: store.get().page - 1 }));
results.onNext(() => store.set({ page: store.get().page + 1 }));
results.onListView(() => store.set({ view: "list" }));
results.onGridView(() => store.set({ view: "grid" }));
statusBar.onSync(() => loadProperties(true));
statusBar.onRetry(() => loadProperties(lastLoadLocalOnly));
$("#clear-filters").addEventListener("click", () => {
  form.reset();
  savedFilters.clearSelection();
  applyFilters();
});

loadProperties();
