export const $ = selector => document.querySelector(selector);

export function addText(parent, tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  parent.append(element);
  return element;
}

// Substitui as opções de um <select>, preservando a seleção quando ela ainda existe.
export function setSelectOptions(select, values, placeholder) {
  const selected = select.value;
  const options = [new Option(placeholder, "")];
  for (const value of [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"))) {
    options.push(new Option(value, value));
  }
  select.replaceChildren(...options);
  select.value = options.some(option => option.value === selected) ? selected : "";
}

// Abre o item ao clicar em qualquer ponto, exceto nos controles interativos internos.
export function makeClickable(element, onActivate) {
  element.addEventListener("click", event => {
    if (!event.target.closest("button, a, .row-actions, .action-links")) onActivate();
  });
}

export function closeOnOutsideClick(dialog) {
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
}
