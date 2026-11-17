// Posição de cada campo nas linhas do CSV da Caixa.
const COLUMN = Object.freeze({
  ID: 0,
  UF: 1,
  CITY: 2,
  DISTRICT: 3,
  ADDRESS: 4,
});

const CAIXA_HEADER = [
  "N° do imóvel", "UF", "Cidade", "Bairro", "Endereço", "Preço",
  "Valor de avaliação", "Desconto", "Financiamento", "Descrição",
  "Modalidade de venda", "Link de acesso",
];

module.exports = { COLUMN, CAIXA_HEADER };
