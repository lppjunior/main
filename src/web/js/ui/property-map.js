const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Encapsula o Leaflet (carregado como script global `L`).
export function createPropertyMap(element) {
  let map = null;

  function destroy() {
    if (!map) return;
    map.remove();
    map = null;
  }

  function show({ lat, lon }, onTileError) {
    if (!window.L) throw new Error("Biblioteca do mapa indisponível");
    element.hidden = false;
    map = L.map(element).setView([lat, lon], 16);
    const tiles = L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION });
    tiles.on("tileerror", onTileError);
    tiles.addTo(map);
    L.circleMarker([lat, lon], { radius: 8 }).addTo(map);
    map.invalidateSize();
  }

  function hide() {
    destroy();
    element.hidden = true;
  }

  return { show, hide, destroy };
}
