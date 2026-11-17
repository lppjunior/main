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
const rankingPrevious = document.querySelector("#ranking-previous");
const rankingNext = document.querySelector("#ranking-next");
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
const propertyFields = document.querySelector("#property-fields");
const propertyLink = document.querySelector("#property-link");
const propertyAlert = document.querySelector("#property-alert");
const mapElement = document.querySelector("#property-map");
const mapStatus = document.querySelector("#map-status");
const propertyFieldNames = ["Nº do imóvel", "UF", "Cidade", "Bairro", "Endereço", "Preço",
  "Valor de avaliação", "Desconto", "Financiamento", "Descrição", "Modalidade de venda"];
const pageSize = 50;
const storageKey = "imoveis-caixa-filtros";
const fieldNames = ["search", "uf", "city", "district", "type", "modality", "minPrice", "maxPrice", "minDiscount", "minRooms", "financing", "hideAlerts"];
let properties = [];
let filtered = [];
let page = 0;
let rankingPage = 0;
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

function updateCities() {
  const cities = properties.filter(property => !fields.uf.value || property.row[1] === fields.uf.value).map(property => property.row[2]);
  setOptions(fields.city, cities, "Todas");
}

function updateOptions() {
  setOptions(fields.uf, properties.map(property => property.row[1]), "Todos");
  updateCities();
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
  const minPrice = fields.minPrice.value === "" ? null : Number(fields.minPrice.value);
  const maxPrice = fields.maxPrice.value === "" ? null : Number(fields.maxPrice.value);
  const minDiscount = fields.minDiscount.value === "" ? null : Number(fields.minDiscount.value);
  const minRooms = fields.minRooms.value === "" ? null : Number(fields.minRooms.value);
  filtered = properties.filter(property => {
    const row = property.row;
    return (!search || property.search.includes(search)) &&
      (!fields.uf.value || row[1] === fields.uf.value) &&
      (!fields.city.value || row[2] === fields.city.value) &&
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
  rankingPage = 0;
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
      link.textContent = "Ver anúncio e fotos na Caixa";
      return link;
    }
  } catch (error) {
    console.error("Link do imóvel inválido:", error);
  }
  const unavailable = document.createElement("span");
  unavailable.textContent = "Link indisponível";
  return unavailable;
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
  propertyFields.replaceChildren();
  propertyFieldNames.forEach((name, index) => {
    addText(propertyFields, "dt", name);
    const value = property.row[index];
    const formatted = value && (index === 5 || index === 6) ? `R$ ${value}`
      : value && index === 7 ? `${value.replace(".", ",")}%` : value;
    addText(propertyFields, "dd", formatted || "Não informado");
  });
  propertyLink.replaceChildren(caixaLink(property));
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
  button.textContent = "Ver imóvel";
  button.setAttribute("aria-label", `Ver detalhes do imóvel ${property.row[0]}`);
  button.addEventListener("click", () => openProperty(property));
  return button;
}

function makeClickable(element, property) {
  element.addEventListener("click", event => {
    if (!event.target.closest("button, a")) openProperty(property);
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
  meta.append(detailsButton(property));
  card.append(meta);
  if (property.alert) card.append(alertButton(property));
  return card;
}

function renderRanking() {
  const ranked = filtered.filter(property => property.discount !== null).slice(0, 20);
  rankingCards.replaceChildren(...ranked.slice(rankingPage * 3, rankingPage * 3 + 3)
    .map((property, index) => createCard(property, rankingPage * 3 + index + 1)));
  rankingPrevious.disabled = rankingPage === 0;
  rankingNext.disabled = (rankingPage + 1) * 3 >= ranked.length;
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
    const values = [property.row[0], property.row[1], property.row[2], property.row[3], property.type,
      `R$ ${property.row[5]}`, `R$ ${property.row[6]}`, discountText(property.discount), areaText(property.area),
      property.row[4], property.row[8], property.row[9], property.row[10]];
    for (const value of values) addText(row, "td", value);
    const details = document.createElement("td");
    details.append(detailsButton(property));
    row.append(details);
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
  if (event.target.tagName === "SELECT" || event.target.type === "checkbox") return;
  applyFilters();
});
filters.addEventListener("change", event => {
  if (event.target.tagName !== "SELECT" && event.target.type !== "checkbox") return;
  if (event.target === fields.uf) updateCities();
  applyFilters();
});
document.querySelector("#clear-filters").addEventListener("click", () => {
  filters.reset();
  filterName.value = "";
  savedFilters.value = "";
  updateCities();
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
      value: Object.fromEntries(fieldNames.map(key => [key, fields[key].type === "checkbox" ? fields[key].checked : fields[key].value])),
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
    for (const key of fieldNames) {
      if (key === "city") continue;
      if (fields[key].type === "checkbox") fields[key].checked = Boolean(saved[key]) && !fields[key].disabled;
      else if (typeof saved[key] === "string") fields[key].value = saved[key];
    }
    updateCities();
    if (typeof saved.city === "string") fields.city.value = saved.city;
    filterName.value = savedFilters.value;
    applyFilters();
  } catch (error) {
    console.error("Não foi possível aplicar o filtro salvo:", error);
    filterMessage.textContent = "Não foi possível aplicar o filtro salvo.";
  }
});
previous.addEventListener("click", () => { page--; renderResults(); });
next.addEventListener("click", () => { page++; renderResults(); });
rankingPrevious.addEventListener("click", () => { rankingPage--; renderRanking(); });
rankingNext.addEventListener("click", () => { rankingPage++; renderRanking(); });
listView.addEventListener("click", () => { view = "list"; renderResults(); });
gridView.addEventListener("click", () => { view = "grid"; renderResults(); });
sync.addEventListener("click", () => loadProperties(true));
retry.addEventListener("click", () => loadProperties(lastLoadLocalOnly));
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
