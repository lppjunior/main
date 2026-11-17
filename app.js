const status = document.querySelector("#status");
const alertInfo = document.querySelector("#alert-info");
const filters = document.querySelector("#filters");
const fields = filters.elements;
const filterMessage = document.querySelector("#filter-message");
const filterName = document.querySelector("#filter-name");
const savedFilters = document.querySelector("#saved-filters");
const table = document.querySelector("#properties");
const body = table.querySelector("tbody");
const tableWrap = document.querySelector("#table-wrap");
const resultCards = document.querySelector("#result-cards");
const resultCount = document.querySelector("#result-count");
const pagination = document.querySelector("#pagination");
const previous = document.querySelector("#previous");
const next = document.querySelector("#next");
const pageInfo = document.querySelector("#page-info");
const rankingCards = document.querySelector("#ranking-cards");
const rankingToggle = document.querySelector("#ranking-toggle");
const rankingEmpty = document.querySelector("#ranking-empty");
const resultsEmpty = document.querySelector("#results-empty");
const listView = document.querySelector("#list-view");
const gridView = document.querySelector("#grid-view");
const retry = document.querySelector("#retry");
const sync = document.querySelector("#sync");
const alertDialog = document.querySelector("#alert-dialog");
const alertTitle = document.querySelector("#alert-title");
const alertDescription = document.querySelector("#alert-description");
const propertyDialog = document.querySelector("#property-dialog");
const propertyTitle = document.querySelector("#property-title");
const propertyDialogActions = document.querySelector("#property-dialog-actions");
const propertyFields = document.querySelector("#property-fields");
const propertyAlert = document.querySelector("#property-alert");
const mapElement = document.querySelector("#property-map");
const mapStatus = document.querySelector("#map-status");
const propertyFieldNames = ["Nº do imóvel", "UF", "Cidade", "Bairro", "Endereço", "Preço",
  "Valor de avaliação", "Desconto", "Financiamento", "Descrição", "Modalidade de venda"];
const pageSize = 50;
const storageKey = "imoveis-caixa-filtros";
const fieldNames = ["search", "district", "type", "modality", "minPrice", "maxPrice", "minDiscount", "minRooms", "financing", "hideAlerts"];
const locationFilters = Object.fromEntries(["uf", "city", "district"].map(key => {
  const root = document.querySelector(`#${key}-filter`);
  return [key, { root, search: root.querySelector("input[type=search]"), list: root.querySelector(".location-options"),
    count: root.querySelector(".location-count"), summary: root.querySelector("summary span"),
    placeholder: key === "city" ? "Todas" : "Todos", selected: new Set(), values: [] }];
}));
let properties = [];
let filtered = [];
let page = 0;
let rankingExpanded = false;
let view = "list";
let alertsAvailable = false;
let lastLoadLocalOnly = false;
let propertyMap = null;
let mapRequest = 0;

function normalize(value) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toUpperCase().trim();
}

function numberValue(value) {
  if (!value || !/^\d+(?:\.\d{3})*(?:,\d+)?$/.test(value)) return null;
  return Number(value.replaceAll(".", "").replace(",", "."));
}

function propertyData(row, alert) {
  const description = row[9];
  const areas = [...description.matchAll(/([\d.,]+)\s+de área (privativa|total|do terreno)/gi)];
  const areaFor = kind => {
    const match = areas.find(item => normalize(item[2]) === normalize(kind));
    return match ? Number(match[1].replace(",", ".")) : null;
  };
  const area = [areaFor("privativa"), areaFor("total"), areaFor("do terreno")].find(value => value > 0) ?? null;
  const rooms = description.match(/(\d+)\s+(?:qto|quarto)(?:\(s\)|s)?/i);
  const discount = row[7] !== "" && Number.isFinite(Number(row[7].replace(",", ".")))
    ? Number(row[7].replace(",", ".")) : null;
  return {
    row, alert, type: description.split(",")[0].trim(), area,
    rooms: rooms ? Number(rooms[1]) : null,
    price: numberValue(row[5]), discount,
    search: normalize([row[0], row[2], row[3], row[4], description].join(" ")),
  };
}

function setOptions(select, values, placeholder) {
  const selected = select.value;
  const options = [new Option(placeholder, "")];
  for (const value of [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"))) {
    options.push(new Option(value, value));
  }
  select.replaceChildren(...options);
  select.value = options.some(option => option.value === selected) ? selected : "";
}

function renderLocationFilter(filter) {
  const selected = [...filter.selected];
  filter.summary.textContent = selected.length === 0 ? filter.placeholder
    : selected.length === 1 ? filter.values.find(option => option.value === selected[0]).label : `${selected.length} selecionados`;
  const term = normalize(filter.search.value);
  const matches = filter.values.filter(option => normalize(option.label).includes(term));
  matches.sort((a, b) => Number(filter.selected.has(b.value)) - Number(filter.selected.has(a.value)) || a.label.localeCompare(b.label, "pt-BR"));
  const fragment = document.createDocumentFragment();
  for (const option of matches.slice(0, 100)) {
    const label = document.createElement("label");
    label.className = "location-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = option.value;
    checkbox.checked = filter.selected.has(option.value);
    label.append(checkbox, document.createTextNode(option.label));
    fragment.append(label);
  }
  filter.list.replaceChildren(fragment);
  filter.count.textContent = matches.length > 100
    ? `Mostrando 100 de ${matches.length} opções. Digite para refinar.`
    : matches.length ? "" : "Nenhuma opção encontrada.";
}

function updateLocationOptions() {
  const uf = locationFilters.uf;
  const city = locationFilters.city;
  const district = locationFilters.district;
  function setValues(filter, rows, end) {
    const options = new Map();
    for (const row of rows) {
      const parts = row.slice(1, end + 1);
      if (parts.some(part => !part)) continue;
      const value = end === 1 ? parts[0] : JSON.stringify(parts);
      options.set(value, { value, label: parts.join(" - "), legacy: parts.at(-1) });
    }
    filter.values = [...options.values()];
    const available = new Set(options.keys());
    for (const selected of filter.selected) {
      if (!available.has(selected)) filter.selected.delete(selected);
    }
    renderLocationFilter(filter);
  }
  setValues(uf, properties.map(property => property.row), 1);
  const stateMatches = properties.filter(property => !uf.selected.size || uf.selected.has(property.row[1]));
  setValues(city, stateMatches.map(property => property.row), 2);
  const cityMatches = stateMatches.filter(property => !city.selected.size || city.selected.has(JSON.stringify(property.row.slice(1, 3))));
  setValues(district, cityMatches.map(property => property.row), 3);
}

function updateOptions() {
  updateLocationOptions();
  setOptions(fields.type, properties.map(property => property.type), "Todos");
  setOptions(fields.modality, properties.map(property => property.row[10]), "Todas");
}

function applyFilters() {
  if (!filters.checkValidity() ||
      (fields.minPrice.value && fields.maxPrice.value && Number(fields.minPrice.value) > Number(fields.maxPrice.value))) {
    filterMessage.textContent = "Verifique os valores dos filtros; o preço mínimo não pode superar o máximo.";
    return;
  }
  filterMessage.textContent = "";
  const search = normalize(fields.search.value);
  const district = normalize(fields.district.value);
  const { uf, city, district: districts } = locationFilters;
  const minPrice = fields.minPrice.value === "" ? null : Number(fields.minPrice.value);
  const maxPrice = fields.maxPrice.value === "" ? null : Number(fields.maxPrice.value);
  const minDiscount = fields.minDiscount.value === "" ? null : Number(fields.minDiscount.value);
  const minRooms = fields.minRooms.value === "" ? null : Number(fields.minRooms.value);
  filtered = properties.filter(property => {
    const row = property.row;
    return (!search || property.search.includes(search)) &&
      (!uf.selected.size || uf.selected.has(row[1])) &&
      (!city.selected.size || city.selected.has(JSON.stringify(row.slice(1, 3)))) &&
      (!districts.selected.size || districts.selected.has(JSON.stringify(row.slice(1, 4)))) &&
      (!district || normalize(row[3]).includes(district)) &&
      (!fields.type.value || property.type === fields.type.value) &&
      (!fields.modality.value || row[10] === fields.modality.value) &&
      (minPrice === null || (property.price !== null && property.price >= minPrice)) &&
      (maxPrice === null || (property.price !== null && property.price <= maxPrice)) &&
      (minDiscount === null || (property.discount !== null && property.discount >= minDiscount)) &&
      (minRooms === null || (property.rooms !== null && property.rooms >= minRooms)) &&
      (!fields.financing.checked || normalize(row[8]) === "SIM") &&
      (!fields.hideAlerts.checked || !property.alert);
  }).sort((a, b) => (b.discount ?? -Infinity) - (a.discount ?? -Infinity));
  page = 0;
  render();
}

function addText(parent, tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  parent.append(element);
  return element;
}

function caixaLink(property) {
  const link = document.createElement("a");
  try {
    const url = new URL(property.row[11]);
    if (url.protocol === "https:" && url.hostname === "venda-imoveis.caixa.gov.br") {
      link.href = url.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      return link;
    }
  } catch (error) {
    console.error("Link do imóvel inválido:", error);
  }
  return document.createElement("span");
}

function alertText(property) {
  const groups = property.alert.grupos.map(group => `${group.grupo}: ${group.percentual.replace(".", ",")}%`).join("; ");
  return `No bairro ${property.alert.nome}, parte da área foi mapeada como controlada por grupos armados em 2022 (${groups} da área total do bairro). O alerta não confirma risco no endereço nem a situação atual.`;
}

async function openProperty(property) {
  const requestId = ++mapRequest;
  if (propertyMap) {
    propertyMap.remove();
    propertyMap = null;
  }
  propertyTitle.textContent = `Imóvel ${property.row[0]}`;
  propertyDialogActions.replaceChildren(propertyActions(property, false));
  propertyFields.replaceChildren();
  propertyFieldNames.forEach((name, index) => {
    addText(propertyFields, "dt", name);
    const value = property.row[index];
    const formatted = value && (index === 5 || index === 6) ? `R$ ${value}`
      : value && index === 7 ? `${value.replace(".", ",")}%` : value;
    addText(propertyFields, "dd", formatted || "Não informado");
  });
  propertyAlert.replaceChildren();
  if (property.alert) addText(propertyAlert, "p", alertText(property), "notice");
  mapElement.hidden = true;
  mapStatus.textContent = "Buscando localização aproximada...";
  propertyDialog.showModal();
  try {
    const response = await fetch(`/api/imoveis/${encodeURIComponent(property.row[0])}/localizacao`);
    if (!response.ok) throw new Error(`Localização indisponível (HTTP ${response.status})`);
    const { localizacao } = await response.json();
    if (requestId !== mapRequest || !propertyDialog.open) return;
    if (!localizacao) {
      mapStatus.textContent = "Localização não encontrada. Confira o endereço no anúncio da Caixa.";
      return;
    }
    if (!window.L) throw new Error("Biblioteca do mapa indisponível");
    mapElement.hidden = false;
    propertyMap = L.map(mapElement).setView([localizacao.lat, localizacao.lon], 16);
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });
    tiles.on("tileerror", () => {
      if (requestId === mapRequest) mapStatus.textContent = "Não foi possível carregar parte do mapa. Confira o endereço no anúncio da Caixa.";
    });
    tiles.addTo(propertyMap);
    L.circleMarker([localizacao.lat, localizacao.lon], { radius: 8 }).addTo(propertyMap);
    mapStatus.textContent = `Localização aproximada; confirme o endereço antes de tomar decisões. Resultado: ${localizacao.endereco}`;
    propertyMap.invalidateSize();
  } catch (error) {
    if (requestId !== mapRequest || !propertyDialog.open) return;
    console.error("Erro ao consultar a localização:", error);
    mapStatus.textContent = "Não foi possível carregar a localização. Confira o endereço no anúncio da Caixa.";
    mapElement.hidden = true;
    if (propertyMap) {
      propertyMap.remove();
      propertyMap = null;
    }
  }
}

function detailsButton(property) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "detail-button";
  button.addEventListener("click", () => openProperty(property));
  return button;
}

function actionIcon(pathData) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathData);
  svg.append(path);
  return svg;
}

function propertyActions(property, includeDetails = true) {
  const actions = document.createElement("div");
  actions.className = "action-links";
  const caixa = caixaLink(property);
  const address = property.row[4].trim();
  const city = property.row[2].trim();
  const uf = property.row[1].trim();
  const map = document.createElement(address && city && uf ? "a" : "span");
  if (map.tagName === "A") {
    const url = new URL("https://www.google.com/maps/search/");
    url.searchParams.set("api", "1");
    url.searchParams.set("query", [address, property.row[3], city, uf, "Brasil"].filter(Boolean).join(", "));
    map.href = url.href;
    map.target = "_blank";
    map.rel = "noopener noreferrer";
  }
  const items = [
    [caixa, `Ver imóvel ${property.row[0]} na Caixa`, "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M9 21v-6h6v6"],
    [map, `Buscar imóvel ${property.row[0]} no Google Maps`, "M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12ZM12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"],
  ];
  if (includeDetails) {
    items.push([detailsButton(property), `Ver detalhes do imóvel ${property.row[0]}`, "M6 3h9l4 4v14H6zM15 3v4h4M9 11h7M9 14h7M9 17h5"]);
  }
  for (const [element, label, icon] of items) {
    const available = element.tagName !== "SPAN";
    const description = available ? label : `${label} — indisponível`;
    element.classList.add("icon-action");
    element.title = description;
    element.setAttribute("aria-label", description);
    if (!available) element.setAttribute("aria-disabled", "true");
    element.replaceChildren(actionIcon(icon));
    actions.append(element);
  }
  return actions;
}

function makeClickable(element, property) {
  element.addEventListener("click", event => {
    if (!event.target.closest("button, a, .row-actions, .action-links")) openProperty(property);
  });
}

function alertButton(property) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button alert-button";
  button.textContent = "Ver motivo";
  button.setAttribute("aria-label", `Ver motivo do alerta do imóvel ${property.row[0]}`);
  button.addEventListener("click", () => {
    alertTitle.textContent = `Alerta histórico — imóvel ${property.row[0]}`;
    alertDescription.textContent = alertText(property);
    alertDialog.showModal();
  });
  return button;
}

function areaText(area) {
  return area === null ? "—" : `${area.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²`;
}

function discountText(discount) {
  return discount === null ? "—" : `${discount.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function createCard(property, rank) {
  const card = document.createElement("article");
  card.className = `property-card${property.alert ? " has-alert" : ""}`;
  makeClickable(card, property);
  const head = document.createElement("div");
  head.className = "card-heading";
  addText(head, "span", property.type || "Imóvel", "type-badge");
  const badges = document.createElement("div");
  if (rank) addText(badges, "span", `#${rank}`, "rank-badge");
  if (property.discount !== null) addText(badges, "span", `-${discountText(property.discount)}`, "discount-badge");
  head.append(badges);
  card.append(head);
  addText(card, "strong", `R$ ${property.row[5]}`, "card-price");
  addText(card, "span", `Avaliação: R$ ${property.row[6]}`, "card-assessment");
  addText(card, "p", `${property.row[3]} · ${property.row[2]}/${property.row[1]}`, "card-location");
  const meta = document.createElement("div");
  meta.className = "card-meta";
  addText(meta, "span", `${areaText(property.area)}${property.rooms === null ? "" : ` · ${property.rooms} quarto(s)`}`);
  meta.append(propertyActions(property));
  card.append(meta);
  if (property.alert) card.append(alertButton(property));
  return card;
}

function renderRanking() {
  const ranked = filtered.filter(property => property.discount !== null).slice(0, 20);
  rankingCards.replaceChildren(...ranked.slice(0, rankingExpanded ? 20 : 3)
    .map((property, index) => createCard(property, index + 1)));
  rankingToggle.hidden = ranked.length <= 3;
  rankingToggle.setAttribute("aria-expanded", String(rankingExpanded));
  rankingToggle.textContent = rankingExpanded ? "Mostrar menos ↑" : `Mostrar todos (${ranked.length}) ↓`;
  rankingEmpty.hidden = ranked.length > 0;
  rankingEmpty.textContent = filtered.length ? "Nenhum imóvel com desconto informado." : "Nenhum imóvel encontrado para os filtros selecionados.";
}

function renderResults() {
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const fragment = document.createDocumentFragment();
  for (const property of visible) {
    const row = document.createElement("tr");
    makeClickable(row, property);
    if (property.alert) row.classList.add("has-alert");
    addText(row, "td", property.row[10]);
    const actions = document.createElement("td");
    actions.className = "row-actions";
    actions.append(propertyActions(property));
    row.append(actions);
    const values = [property.row[1], property.row[2], property.row[3], property.type,
      `R$ ${property.row[5]}`, `R$ ${property.row[6]}`, discountText(property.discount), areaText(property.area),
      property.row[4], property.row[8], property.row[9]];
    for (const value of values) addText(row, "td", value);
    const action = document.createElement("td");
    action.className = "action-column";
    if (property.alert) action.append(alertButton(property));
    else action.textContent = "Não avaliado";
    row.append(action);
    fragment.append(row);
  }
  body.replaceChildren(fragment);
  resultCards.replaceChildren(...(view === "grid" ? visible.map(property => createCard(property)) : []));
  table.hidden = view !== "list" || !visible.length;
  tableWrap.hidden = view !== "list";
  resultCards.hidden = view !== "grid" || !visible.length;
  resultsEmpty.hidden = filtered.length > 0;
  resultCount.textContent = `(${filtered.length.toLocaleString("pt-BR")} imóveis)`;
  pagination.hidden = filtered.length === 0;
  const pages = Math.ceil(filtered.length / pageSize);
  pageInfo.textContent = `Página ${page + 1} de ${pages}`;
  previous.disabled = page === 0;
  next.disabled = page >= pages - 1;
  listView.setAttribute("aria-pressed", String(view === "list"));
  gridView.setAttribute("aria-pressed", String(view === "grid"));
}

function render() {
  renderRanking();
  renderResults();
}

function readSavedFilters() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return {};
  const data = JSON.parse(raw);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Filtros salvos inválidos");
  return data;
}

function updateSavedFilters(selected = "") {
  try {
    const names = Object.keys(readSavedFilters());
    setOptions(savedFilters, names, "Filtros salvos");
    savedFilters.value = selected;
  } catch (error) {
    console.error("Não foi possível ler os filtros salvos:", error);
    filterMessage.textContent = "Não foi possível ler os filtros salvos neste navegador.";
  }
}

async function loadProperties(localOnly = false) {
  lastLoadLocalOnly = localOnly;
  status.textContent = "Carregando a lista da Caixa...";
  alertInfo.textContent = "Carregando alertas históricos...";
  retry.hidden = true;
  sync.disabled = true;
  try {
    const response = await fetch(localOnly ? "/api/imoveis?local=1" : "/api/imoveis", { cache: "no-store" });
    if (!response.ok) throw new Error("Falha ao carregar a lista.");
    const data = await response.json();
    alertsAvailable = Array.isArray(data.alertas);
    properties = data.imoveis.map((row, index) => propertyData(row, data.alertas?.[index] ?? null));
    fields.hideAlerts.disabled = !alertsAvailable;
    if (!alertsAvailable) fields.hideAlerts.checked = false;
    alertInfo.textContent = alertsAvailable
      ? "Alerta histórico: parte do bairro foi mapeada por grupos armados em 2022 na cidade do Rio. Não confirma risco no endereço nem a situação atual; os demais imóveis não foram avaliados."
      : "A base de alertas históricos está indisponível. Nenhum endereço foi avaliado.";
    status.textContent = `Gerado pela Caixa: ${data.dataGeracao}  ·  CSV local  ·  ${properties.length.toLocaleString("pt-BR")} imóveis`;
    updateOptions();
    applyFilters();
  } catch (error) {
    console.error("Erro ao carregar a lista da Caixa:", error);
    status.textContent = localOnly
      ? "Não foi possível carregar o CSV local. Verifique se o arquivo existe e é válido."
      : "Não foi possível carregar a lista da Caixa. Tente novamente.";
    alertInfo.textContent = "Não foi possível avaliar alertas.";
    properties = [];
    filtered = [];
    fields.hideAlerts.checked = false;
    fields.hideAlerts.disabled = true;
    render();
    retry.hidden = false;
  } finally {
    sync.disabled = false;
  }
}

filters.addEventListener("submit", event => event.preventDefault());
filters.addEventListener("input", event => {
  if (event.target.closest(".location-filter")) return;
  if (event.target.tagName === "SELECT" || event.target.type === "checkbox") return;
  applyFilters();
});
filters.addEventListener("change", event => {
  if (event.target.closest(".location-filter")) return;
  if (event.target.tagName !== "SELECT" && event.target.type !== "checkbox") return;
  applyFilters();
});
for (const filter of Object.values(locationFilters)) {
  filter.root.addEventListener("toggle", () => {
    if (filter.root.open) {
      for (const other of Object.values(locationFilters)) {
        if (other !== filter) other.root.open = false;
      }
    }
  });
  filter.search.addEventListener("input", () => renderLocationFilter(filter));
  filter.list.addEventListener("change", event => {
    const checkbox = event.target;
    if (checkbox.checked) filter.selected.add(checkbox.value);
    else filter.selected.delete(checkbox.value);
    updateLocationOptions();
    const replacement = [...filter.list.querySelectorAll("input")].find(input => input.value === checkbox.value);
    replacement?.focus();
    applyFilters();
  });
  filter.root.querySelector(".location-clear").addEventListener("click", () => {
    filter.selected.clear();
    updateLocationOptions();
    applyFilters();
  });
}
document.addEventListener("click", event => {
  if (!event.target.closest(".location-filter")) {
    for (const filter of Object.values(locationFilters)) filter.root.open = false;
  }
});
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  const filter = Object.values(locationFilters).find(item => item.root.open && item.root.contains(event.target));
  if (filter) {
    event.preventDefault();
    filter.root.open = false;
    filter.root.querySelector("summary").focus();
  }
});
document.querySelector("#clear-filters").addEventListener("click", () => {
  filters.reset();
  for (const filter of Object.values(locationFilters)) {
    filter.selected.clear();
    filter.root.open = false;
  }
  filterName.value = "";
  savedFilters.value = "";
  updateLocationOptions();
  applyFilters();
});
document.querySelector("#save-filter").addEventListener("click", () => {
  const name = filterName.value.trim();
  if (!name) {
    filterMessage.textContent = "Informe um nome para salvar o filtro.";
    return;
  }
  if (!filters.checkValidity() ||
      (fields.minPrice.value && fields.maxPrice.value && Number(fields.minPrice.value) > Number(fields.maxPrice.value))) {
    filterMessage.textContent = "Corrija os filtros antes de salvar.";
    return;
  }
  try {
    const saved = readSavedFilters();
    Object.defineProperty(saved, name, {
      value: {
        ...Object.fromEntries(fieldNames.map(key => [key, fields[key].type === "checkbox" ? fields[key].checked : fields[key].value])),
        uf: [...locationFilters.uf.selected],
        city: [...locationFilters.city.selected],
        districts: [...locationFilters.district.selected],
      },
      enumerable: true, configurable: true, writable: true,
    });
    localStorage.setItem(storageKey, JSON.stringify(saved));
    updateSavedFilters(name);
    filterMessage.textContent = "Filtro salvo neste navegador.";
  } catch (error) {
    console.error("Não foi possível salvar o filtro:", error);
    filterMessage.textContent = "Não foi possível salvar o filtro neste navegador.";
  }
});
savedFilters.addEventListener("change", () => {
  if (!savedFilters.value) return;
  try {
    const saved = readSavedFilters()[savedFilters.value];
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) throw new Error("Filtro salvo inválido");
    filters.reset();
    for (const filter of Object.values(locationFilters)) filter.selected.clear();
    for (const key of fieldNames) {
      if (fields[key].type === "checkbox") fields[key].checked = Boolean(saved[key]) && !fields[key].disabled;
      else if (typeof saved[key] === "string") fields[key].value = saved[key];
    }
    updateLocationOptions();
    for (const [key, savedKey] of [["uf", "uf"], ["city", "city"], ["district", "districts"]]) {
      const values = Array.isArray(saved[savedKey]) ? saved[savedKey] : [saved[savedKey]];
      for (const value of values) {
        if (typeof value !== "string" || !value) continue;
        for (const option of locationFilters[key].values) {
          if (option.value === value || option.legacy === value) locationFilters[key].selected.add(option.value);
        }
      }
      updateLocationOptions();
    }
    filterName.value = savedFilters.value;
    applyFilters();
  } catch (error) {
    console.error("Não foi possível aplicar o filtro salvo:", error);
    filterMessage.textContent = "Não foi possível aplicar o filtro salvo.";
  }
});
previous.addEventListener("click", () => { page--; renderResults(); });
next.addEventListener("click", () => { page++; renderResults(); });
rankingToggle.addEventListener("click", () => { rankingExpanded = !rankingExpanded; renderRanking(); });
listView.addEventListener("click", () => { view = "list"; renderResults(); });
gridView.addEventListener("click", () => { view = "grid"; renderResults(); });
sync.addEventListener("click", () => loadProperties(true));
retry.addEventListener("click", () => loadProperties(lastLoadLocalOnly));
for (const dialog of [propertyDialog, alertDialog]) {
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
}
alertDialog.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    event.preventDefault();
    alertDialog.close();
  }
});
propertyDialog.addEventListener("close", () => {
  mapRequest++;
  if (propertyMap) {
    propertyMap.remove();
    propertyMap = null;
  }
});
updateSavedFilters();
loadProperties();
