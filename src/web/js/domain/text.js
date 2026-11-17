export function normalize(value) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toUpperCase().trim();
}

// Converte números no formato brasileiro ("1.234,56"); retorna null se inválido.
export function parseBrazilianNumber(value) {
  if (!value || !/^\d+(?:\.\d{3})*(?:,\d+)?$/.test(value)) return null;
  return Number(value.replaceAll(".", "").replace(",", "."));
}
