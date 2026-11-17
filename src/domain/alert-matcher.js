const { COLUMN } = require("./columns");
const { normalize } = require("./text");

const RIO_STATE = "RJ";
const RIO_CITY = "RIO DE JANEIRO";

function findAlert(property, districts) {
  if (property[COLUMN.UF].trim().toUpperCase() !== RIO_STATE || normalize(property[COLUMN.CITY]) !== RIO_CITY) return null;
  const district = districts.get(normalize(property[COLUMN.DISTRICT]));
  return district && district.grupos.length ? district : null;
}

module.exports = { findAlert };
