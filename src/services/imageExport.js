export async function exportElementAsPng(element, title) {
  if (!element) throw new Error("Nothing to export.");

  document.body.classList.add("is-exporting");
  await document.fonts?.ready;
  await new Promise((resolve) => setTimeout(resolve, 80));

  try {
    const pngBlob = await drawBoardToBlob(element);
    downloadBlob(`${slugify(title)}.png`, pngBlob);
  } finally {
    document.body.classList.remove("is-exporting");
  }
}

async function drawBoardToBlob(element) {
  const rect = element.getBoundingClientRect();
  const width = Math.ceil(element.scrollWidth || rect.width);
  const height = Math.ceil(element.scrollHeight || rect.height);
  const ratio = Math.min(window.devicePixelRatio || 2, 3);
  const canvas = document.createElement("canvas");
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);

  drawBackground(context, element, width, height);
  drawHeading(context, element);
  await drawBoardBackgroundImages(context, element);
  await drawZones(context, element);

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not render PNG.")), "image/png");
  });
}

function drawBackground(context, element, width, height) {
  context.fillStyle = colorOf(element, "backgroundColor", "#0d100f");
  context.fillRect(0, 0, width, height);
}

function drawHeading(context, root) {
  const heading = root.querySelector(".board-heading");
  if (!heading) return;
  const rootRect = root.getBoundingClientRect();
  drawRectNode(context, heading, rootRect);

  const eyebrow = heading.querySelector(".eyebrow");
  const title = heading.querySelector(".board-title-input");
  const chip = heading.querySelector(".view-chip");

  if (eyebrow) drawTextNode(context, eyebrow, rootRect, { uppercase: true });
  if (title) drawTextNode(context, title, rootRect, { maxWidth: rootRect.width - 190 });
  if (chip) drawRoundedNode(context, chip, rootRect, 999);
  if (chip) drawTextNode(context, chip, rootRect, { align: "center", middle: true });
}

async function drawBoardBackgroundImages(context, root) {
  const rootRect = root.getBoundingClientRect();
  for (const image of root.querySelectorAll(".iceberg-background")) {
    await drawImageStretch(context, image.currentSrc || image.src, relativeRect(image, rootRect));
  }
}

async function drawZones(context, root) {
  const rootRect = root.getBoundingClientRect();
  for (const zone of root.querySelectorAll(".zone")) {
    drawRectNode(context, zone, rootRect);
    drawBorders(context, zone, rootRect);

    const label = zone.querySelector(".zone-label");
    if (label) {
      drawRectNode(context, label, rootRect);
      const labelText = label.querySelector(".zone-label-input");
      if (labelText) drawTextNode(context, labelText, rootRect, { align: "center", middle: true });
    }
  }

  await drawCards(context, root, rootRect);
  root.querySelectorAll(".empty-list").forEach((node) => drawTextNode(context, node, rootRect, { align: "center", middle: true }));
}

async function drawCards(context, root, rootRect) {
  for (const card of root.querySelectorAll(".item-card")) {
    drawRectNode(context, card, rootRect);
    const thumb = card.querySelector(".item-thumb");
    if (thumb) {
      drawRectNode(context, thumb, rootRect);
      const image = thumb.querySelector("img");
      if (image?.src) await drawImageCover(context, image.currentSrc || image.src, relativeRect(thumb, rootRect));
      else drawTextNode(context, thumb.querySelector(".thumb-fallback"), rootRect, { align: "center", middle: true });
    }

    const copy = card.querySelector(".item-copy");
    if (copy) {
      drawRectNode(context, copy, rootRect);
      drawWrappedTextNode(context, copy.querySelector("strong"), rootRect);
    }
  }
}

function drawRoundedNode(context, node, rootRect, radius = 8) {
  const rect = relativeRect(node, rootRect);
  context.fillStyle = colorOf(node, "backgroundColor", "transparent");
  roundedRect(context, rect.x, rect.y, rect.width, rect.height, radius);
  context.fill();
}

function drawRectNode(context, node, rootRect) {
  const rect = relativeRect(node, rootRect);
  context.fillStyle = colorOf(node, "backgroundColor", "transparent");
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
}

function drawBorders(context, node, rootRect) {
  const rect = relativeRect(node, rootRect);
  const style = getComputedStyle(node);
  const bottom = parseFloat(style.borderBottomWidth) || 0;
  if (bottom) {
    context.fillStyle = style.borderBottomColor;
    context.fillRect(rect.x, rect.y + rect.height - bottom, rect.width, bottom);
  }
}

function drawTextNode(context, node, rootRect, options = {}) {
  if (!node) return;
  const rect = relativeRect(node, rootRect);
  const style = getComputedStyle(node);
  const fontSize = parseFloat(style.fontSize) || 14;
  const fontWeight = style.fontWeight || "400";
  const family = style.fontFamily || "Roboto, sans-serif";
  const rawText = "value" in node ? node.value : node.textContent;
  const text = options.uppercase ? rawText.toUpperCase() : rawText;
  const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.25;

  context.fillStyle = style.color || "#e0e3e1";
  context.font = `${fontWeight} ${fontSize}px ${family}`;
  context.textBaseline = "top";
  context.textAlign = options.align || "left";

  const x = options.align === "center" ? rect.x + rect.width / 2 : rect.x;
  const y = options.middle ? rect.y + Math.max(0, (rect.height - lineHeight) / 2) : rect.y;
  fillEllipsis(context, String(text || "").trim(), x, y, options.maxWidth || rect.width, options.align || "left");
}

function drawWrappedTextNode(context, node, rootRect) {
  if (!node) return;
  const rect = relativeRect(node, rootRect);
  const style = getComputedStyle(node);
  const fontSize = parseFloat(style.fontSize) || 12;
  const fontWeight = style.fontWeight || "700";
  const family = style.fontFamily || "Roboto, sans-serif";
  const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.16;
  const words = String(node.textContent || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  context.fillStyle = style.color || "#ffffff";
  context.font = `${fontWeight} ${fontSize}px ${family}`;
  context.textBaseline = "top";
  context.textAlign = "left";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= rect.width || !current) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  lines.forEach((line, index) => {
    context.fillText(line, rect.x, rect.y + index * lineHeight, rect.width);
  });
}

async function drawImageStretch(context, src, rect) {
  const image = await loadImageAsElement(src).catch(() => null);
  if (!image) return;
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
}

async function drawImageCover(context, src, rect) {
  const image = await loadImageAsElement(src).catch(() => null);
  if (!image) return;

  const scale = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const x = rect.x + (rect.width - width) / 2;
  const y = rect.y + (rect.height - height) / 2;
  context.save();
  context.beginPath();
  context.rect(rect.x, rect.y, rect.width, rect.height);
  context.clip();
  context.drawImage(image, x, y, width, height);
  context.restore();
}

async function loadImageAsElement(src) {
  const dataUrl = src.startsWith("data:") ? src : await fetchImageAsDataUrl(src);
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

async function fetchImageAsDataUrl(src) {
  const response = await fetch(src, { mode: "cors" });
  if (!response.ok) throw new Error("Image could not be loaded.");
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function fillEllipsis(context, text, x, y, maxWidth, align) {
  if (!text) return;
  if (context.measureText(text).width <= maxWidth) {
    context.fillText(text, x, y);
    return;
  }

  let clipped = text;
  while (clipped.length > 1 && context.measureText(`${clipped}...`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  context.fillText(`${clipped}...`, x, y, maxWidth);
}

function relativeRect(node, rootRect) {
  const rect = node.getBoundingClientRect();
  return {
    x: rect.left - rootRect.left,
    y: rect.top - rootRect.top,
    width: rect.width,
    height: rect.height,
  };
}

function colorOf(node, property, fallback) {
  const value = getComputedStyle(node)[property];
  return value && value !== "rgba(0, 0, 0, 0)" ? value : fallback;
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}

function slugify(value) {
  return String(value || "wiki-tierlist")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "wiki-tierlist";
}