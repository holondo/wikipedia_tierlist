import { createDefaultDocument, normalizeDocument } from "./core/defaults.js";
import { createStore } from "./core/store.js";
import { getInitialDocument, saveDocument } from "./core/storage.js";
import { decodeDocumentFromHash } from "./services/shareUrl.js";
import { exportElementAsPng } from "./services/imageExport.js?v=images";
import { createToolbar } from "./components/Toolbar.js";
import { createSearchPanel } from "./components/SearchPanel.js?v=images";
import { createBoard } from "./components/Board.js?v=images";
import { createSnackbar } from "./components/Snackbar.js";
import { createActionsPanel } from "./components/ActionsPanel.js";
import { t } from "./core/i18n.js";

export function createApp(root) {
  const fromHash = decodeDocumentFromHash(location.hash);
  const initialDocument = normalizeDocument(fromHash || getInitialDocument() || createDefaultDocument());
  const store = createStore(initialDocument);
  const snackbar = createSnackbar();

  const shell = document.createElement("div");
  shell.className = "app-shell";

  const searchPanel = createSearchPanel({ store, snackbar });
  const board = createBoard({
    store,
    snackbar,
    onAddItems: () => searchPanel.open(),
  });

  const toolbar = createToolbar({
    store,
    onReset: () => {
      if (confirm(t(store.getState(), "confirmReset"))) {
        store.resetDocument();
        snackbar.show(t(store.getState(), "documentReset"));
      }
    },
  });

  const actionsPanel = createActionsPanel({
    store,
    snackbar,
    onExportImage: async () => {
      try {
        await exportElementAsPng(board.getExportElement(), store.getState().title || "wiki-tierlist");
        snackbar.show(t(store.getState(), "imageExported"));
      } catch (error) {
        snackbar.show(error.message || t(store.getState(), "imageExportFailed"));
      }
    },
  });

  const workspace = document.createElement("main");
  workspace.className = "workspace";
  workspace.append(board.el);

  const content = document.createElement("div");
  content.className = "app-content";
  content.append(workspace);

  shell.append(toolbar.el, actionsPanel.el, content, searchPanel.el, snackbar.el);
  root.replaceChildren(shell);

  store.subscribe((state) => {
    document.documentElement.lang = state.settings.uiLanguage;
    toolbar.render(state);
    board.render(state);
    searchPanel.render(state);
    actionsPanel.render(state);
    saveDocument(state);
  });

  store.emit();
}