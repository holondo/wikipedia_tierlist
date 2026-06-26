export function el(tagName, options = {}, children = []) {
  const node = document.createElement(tagName);
  const { className, text, html, attrs = {}, dataset = {}, on = {} } = options;

  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (html !== undefined) node.innerHTML = html;

  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === undefined || value === null) continue;
    if (value === true) node.setAttribute(name, "");
    else node.setAttribute(name, String(value));
  }

  for (const [name, value] of Object.entries(dataset)) node.dataset[name] = value;
  for (const [eventName, handler] of Object.entries(on)) node.addEventListener(eventName, handler);
  for (const child of children) node.append(child);

  return node;
}

export function icon(name, className = "") {
  return el("span", {
    className: `material-symbols-rounded ${className}`.trim(),
    text: name,
    attrs: { "aria-hidden": "true" },
  });
}

export function clear(node) {
  node.replaceChildren();
}

export function downloadText(filename, text, mimeType = "application/json") {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = el("a", { attrs: { href: url, download: filename } });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}
