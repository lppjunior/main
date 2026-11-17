import { hasValidPriceRange } from "../domain/filtering.js";
import { buildLocationOptions, cityKey } from "../domain/location-options.js";
import { COLUMN } from "../domain/columns.js";
import { $, setSelectOptions } from "./dom.js";
import { createLocationFilter } from "./location-filter.js";

const FIELD_NAMES = ["search", "district", "type", "modality", "minPrice", "maxPrice", "minDiscount", "minRooms", "financing", "hideAlerts"];
const LOCATION_FILTERS = [["uf", "Todos"], ["city", "Todas"], ["district", "Todos"]];
// Chave de cada filtro de localização no objeto de filtro salvo.
const SAVED_KEYS = { uf: "uf", city: "city", district: "districts" };

const isChosen = (filter, key) => !filter.selected.size || filter.selected.has(key);

function numberOrNull(field) {
  return field.value === "" ? null : Number(field.value);
}

export function createFilterForm({ onChange }) {
  const form = $("#filters");
  const fields = form.elements;
  const message = $("#filter-message");
  let properties = [];

  const locations = {};
  for (const [key, placeholder] of LOCATION_FILTERS) {
    locations[key] = createLocationFilter($(`#${key}-filter`), {
      placeholder,
      onSelectionChange: value => {
        refreshLocationOptions();
        if (value) locations[key].focusOption(value);
        onChange();
      },
    });
  }
  const locationList = Object.values(locations);

  function refreshLocationOptions() {
    const { uf, city, district } = locations;
    uf.setOptions(buildLocationOptions(properties.map(property => property.row), 1));
    const byState = properties.filter(property => isChosen(uf, property.row[COLUMN.UF]));
    city.setOptions(buildLocationOptions(byState.map(property => property.row), 2));
    const byCity = byState.filter(property => isChosen(city, cityKey(property.row)));
    district.setOptions(buildLocationOptions(byCity.map(property => property.row), 3));
  }

  function isValid() {
    return form.checkValidity() && hasValidPriceRange({
      minPrice: numberOrNull(fields.minPrice),
      maxPrice: numberOrNull(fields.maxPrice),
    });
  }

  function readCriteria() {
    return {
      search: fields.search.value,
      district: fields.district.value,
      ufs: locations.uf.selected,
      cities: locations.city.selected,
      districts: locations.district.selected,
      type: fields.type.value,
      modality: fields.modality.value,
      minPrice: numberOrNull(fields.minPrice),
      maxPrice: numberOrNull(fields.maxPrice),
      minDiscount: numberOrNull(fields.minDiscount),
      minRooms: numberOrNull(fields.minRooms),
      financingOnly: fields.financing.checked,
      hideAlerts: fields.hideAlerts.checked,
    };
  }

  form.addEventListener("submit", event => event.preventDefault());
  // Campos de texto/número filtram enquanto se digita; selects e checkboxes, ao mudar.
  const isDiscreteControl = target => target.tagName === "SELECT" || target.type === "checkbox";
  form.addEventListener("input", ({ target }) => {
    if (!target.closest(".location-filter") && !isDiscreteControl(target)) onChange();
  });
  form.addEventListener("change", ({ target }) => {
    if (!target.closest(".location-filter") && isDiscreteControl(target)) onChange();
  });
  for (const filter of locationList) {
    filter.root.addEventListener("toggle", () => {
      if (!filter.root.open) return;
      for (const other of locationList) {
        if (other !== filter) other.close();
      }
    });
  }
  document.addEventListener("click", ({ target }) => {
    if (!target.closest(".location-filter")) locationList.forEach(filter => filter.close());
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    const filter = locationList.find(item => item.root.open && item.root.contains(event.target));
    if (!filter) return;
    event.preventDefault();
    filter.close();
    filter.root.querySelector("summary").focus();
  });

  return {
    isValid,
    criteria() {
      if (!isValid()) {
        message.textContent = "Verifique os valores dos filtros; o preço mínimo não pode superar o máximo.";
        return null;
      }
      message.textContent = "";
      return readCriteria();
    },
    showMessage(text) {
      message.textContent = text;
    },
    setProperties(list) {
      properties = list;
      refreshLocationOptions();
      setSelectOptions(fields.type, list.map(property => property.type), "Todos");
      setSelectOptions(fields.modality, list.map(property => property.row[COLUMN.MODALITY]), "Todas");
    },
    setAlertsAvailable(available) {
      fields.hideAlerts.disabled = !available;
      if (!available) fields.hideAlerts.checked = false;
    },
    reset() {
      form.reset();
      locationList.forEach(filter => filter.reset());
      refreshLocationOptions();
    },
    snapshot() {
      return {
        ...Object.fromEntries(FIELD_NAMES.map(key => [key, fields[key].type === "checkbox" ? fields[key].checked : fields[key].value])),
        uf: [...locations.uf.selected],
        city: [...locations.city.selected],
        districts: [...locations.district.selected],
      };
    },
    restore(saved) {
      form.reset();
      locationList.forEach(filter => filter.selected.clear());
      for (const key of FIELD_NAMES) {
        if (fields[key].type === "checkbox") fields[key].checked = Boolean(saved[key]) && !fields[key].disabled;
        else if (typeof saved[key] === "string") fields[key].value = saved[key];
      }
      refreshLocationOptions();
      // Cada nível depende das seleções do anterior, então as opções são recalculadas a cada passo.
      for (const [key, filter] of Object.entries(locations)) {
        const values = saved[SAVED_KEYS[key]];
        filter.selectMatching(Array.isArray(values) ? values : [values]);
        refreshLocationOptions();
      }
    },
  };
}
