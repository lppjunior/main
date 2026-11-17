const STORAGE_KEY = "imoveis-caixa-filtros";

const isPlainObject = value => value && typeof value === "object" && !Array.isArray(value);

function readAll() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  const data = JSON.parse(raw);
  if (!isPlainObject(data)) throw new Error("Filtros salvos inválidos");
  return data;
}

export function listSavedFilterNames() {
  return Object.keys(readAll());
}

export function loadSavedFilter(name) {
  const saved = readAll()[name];
  if (!isPlainObject(saved)) throw new Error("Filtro salvo inválido");
  return saved;
}

export function saveFilter(name, values) {
  const saved = readAll();
  // defineProperty evita que nomes como "__proto__" alterem o protótipo do objeto.
  Object.defineProperty(saved, name, { value: values, enumerable: true, configurable: true, writable: true });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}
