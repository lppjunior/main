export async function fetchProperties({ localOnly = false } = {}) {
  const response = await fetch(localOnly ? "/api/imoveis?local=1" : "/api/imoveis", { cache: "no-store" });
  if (!response.ok) throw new Error("Falha ao carregar a lista.");
  return response.json();
}

export async function fetchLocation(propertyId) {
  const response = await fetch(`/api/imoveis/${encodeURIComponent(propertyId)}/localizacao`);
  if (!response.ok) throw new Error(`Localização indisponível (HTTP ${response.status})`);
  return (await response.json()).localizacao;
}
