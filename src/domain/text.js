function normalize(value) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toUpperCase().trim().replace(/\s+/g, " ");
}

module.exports = { normalize };
