import { normalizeDocument } from "../core/defaults.js";
import { downloadText, el, icon } from "../core/dom.js";
import { t } from "../core/i18n.js";
import { documentToShareUrl } from "../services/shareUrl.js";

export function createActionsPanel({ store, snackbar, onExportImage }) {
  const fileInput = el("input", {
    attrs: { type: "file", accept: "application/json", hidden: true },
    on: { change: importJson },
  });

  const exportImageButton = actionButton("image", "Export PNG", onExportImage);
  const shareButton = actionButton("link", "Copy link", copyShareLink);
  const exportJsonButton = actionButton("data_object", "Export JSON", exportJson);
  const importJsonButton = actionButton("upload_file", "Import JSON", () => fileInput.click());

  const root = el("aside", { className: "floating-actions" }, [
    exportImageButton,
    shareButton,
    exportJsonButton,
    importJsonButton,
    fileInput,
  ]);

  function actionButton(iconName, label, handler) {
    return el("button", {
      className: "floating-action-button",
      attrs: { type: "button", title: label, "aria-label": label },
      on: { click: handler },
    }, [icon(iconName), el("span", { text: label })]);
  }

  async function copyShareLink() {
    const url = documentToShareUrl(store.getState());
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      prompt("Copy link", url);
    }
    snackbar.show(t(store.getState(), "shareCopied"));
  }

  function exportJson() {
    downloadText("wiki-tierlist.json", JSON.stringify(store.getState(), null, 2));
    snackbar.show(t(store.getState(), "jsonExported"));
  }

  async function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      store.loadDocument(normalizeDocument(JSON.parse(text)));
      snackbar.show(t(store.getState(), "jsonImported"));
    } catch {
      snackbar.show(t(store.getState(), "importFailed"));
    } finally {
      fileInput.value = "";
    }
  }

  function render(state) {
    updateButton(exportImageButton, t(state, "exportImage"));
    updateButton(shareButton, t(state, "copyShareLink"));
    updateButton(exportJsonButton, t(state, "exportJson"));
    updateButton(importJsonButton, t(state, "importJson"));
  }

  function updateButton(button, label) {
    button.title = label;
    button.setAttribute("aria-label", label);
    button.querySelector("span:last-child").textContent = label;
  }

  return { el: root, render };
}