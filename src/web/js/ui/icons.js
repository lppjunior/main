const SVG_NS = "http://www.w3.org/2000/svg";

export const ICON_PATHS = Object.freeze({
  house: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M9 21v-6h6v6",
  map: "M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12ZM12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  details: "M6 3h9l4 4v14H6zM15 3v4h4M9 11h7M9 14h7M9 17h5",
});

export function createIcon(pathData) {
  const svg = document.createElementNS(SVG_NS, "svg");
  const attributes = {
    viewBox: "0 0 24 24", "aria-hidden": "true", fill: "none", stroke: "currentColor",
    "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round",
  };
  for (const [name, value] of Object.entries(attributes)) svg.setAttribute(name, value);
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", pathData);
  svg.append(path);
  return svg;
}
