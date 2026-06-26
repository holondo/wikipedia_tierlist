import { t } from "../core/i18n.js";
import { clear, el, icon } from "../core/dom.js";
import { enrichWikipediaItemImage, searchWikipediaPages } from "../services/wikipediaApi.js?v=images";

export function createSearchPanel({ store, snackbar }) {
  let query = "";
  let results = [];
  let status = "idle";
  let abortController = null;
  const cache = new Map();

  const searchInput = el("input", {
    className: "field search-field",
    attrs: { type: "search", autocomplete: "off" },
    on: {
      input: () => {
        query = searchInput.value;
        scheduleSearch();
      },
      keydown: (event) => {
        if (event.key === "Escape") close();
      },
    },
  });

  const resultsList = el("div", { className: "search-results" });
  const statusNode = el("p", { className: "panel-note" });
  const panelTitle = el("h2", { text: "Add from Wikipedia" });
  let debounceTimer;

  const closeButton = el("button", {
    className: "icon-button",
    attrs: { type: "button", "aria-label": "Close", title: "Close" },
    on: { click: close },
  }, [icon("close")]);

  const modalCard = el("section", { className: "modal-card search-panel" }, [
    el("div", { className: "modal-heading" }, [
      el("div", { className: "panel-heading compact" }, [
        el("div", { className: "panel-icon" }, [icon("travel_explore")]),
        panelTitle,
      ]),
      closeButton,
    ]),
    el("label", { className: "control control--search" }, [
      el("span", { className: "control-label js-search-label", text: "Search pages" }),
      searchInput,
    ]),
    statusNode,
    resultsList,
  ]);

  const root = el("div", {
    className: "modal-backdrop",
    attrs: { hidden: true },
    on: {
      pointerdown: (event) => {
        if (event.target === root) close();
      },
    },
  }, [modalCard]);

  function open() {
    root.hidden = false;
    setTimeout(() => searchInput.focus(), 30);
  }

  function close() {
    root.hidden = true;
  }

  function scheduleSearch() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 260);
  }

  async function runSearch() {
    const state = store.getState();
    const trimmed = query.trim();
    if (!trimmed) {
      status = "idle";
      results = [];
      render(state);
      return;
    }

    const cacheKey = `${state.settings.wikipediaLanguage}:${trimmed.toLowerCase()}`;
    if (cache.has(cacheKey)) {
      results = cache.get(cacheKey);
      status = results.length ? "ready" : "empty";
      render(state);
      return;
    }

    abortController?.abort();
    abortController = new AbortController();
    status = "loading";
    render(state);

    try {
      results = await searchWikipediaPages(trimmed, state.settings.wikipediaLanguage, abortController.signal);
      cache.set(cacheKey, results);
      status = results.length ? "ready" : "empty";
    } catch (error) {
      if (error.name === "AbortError") return;
      status = "error";
      results = [];
      snackbar.show(t(store.getState(), "searchFailed"));
    }
    render(store.getState());
  }

  function render(state) {
    panelTitle.textContent = t(state, "searchTitle");
    root.querySelector(".js-search-label").textContent = `${t(state, "searchPlaceholder")} (${state.settings.wikipediaLanguage}.wikipedia.org)`;
    searchInput.placeholder = t(state, "searchPlaceholder");
    closeButton.title = "Close";

    if (status === "idle") statusNode.textContent = t(state, "searchEmpty");
    if (status === "loading") statusNode.textContent = "Loading...";
    if (status === "empty") statusNode.textContent = t(state, "noResults");
    if (status === "error") statusNode.textContent = t(state, "searchFailed");
    if (status === "ready") statusNode.textContent = "";

    clear(resultsList);
    for (const item of results) {
      resultsList.append(createResultCard(item, state));
    }
  }

  function createResultCard(item, state) {
    const alreadyAdded = Boolean(state.items[item.id]);
    const thumb = item.thumbnailUrl
      ? el("img", {
          attrs: {
            src: item.thumbnailUrl,
            alt: "",
            loading: "lazy",
            crossorigin: "anonymous",
            referrerpolicy: "no-referrer",
          },
        })
      : el("span", { className: "thumb-fallback", text: "W" });

    const button = el("button", {
      className: alreadyAdded ? "tonal-button" : "filled-button",
      text: alreadyAdded ? t(state, "added") : t(state, "add"),
      attrs: { type: "button", disabled: alreadyAdded },
      on: {
        click: async () => {
          button.disabled = true;
          const itemForBoard = await enrichWikipediaItemImage(item).catch(() => item);
          const added = store.addItem(itemForBoard);
          snackbar.show(t(store.getState(), added ? "itemAdded" : "duplicateItem"));
        },
      },
    });

    return el("article", { className: "search-result" }, [
      el("div", { className: "result-thumb" }, [thumb]),
      el("div", { className: "result-copy" }, [
        el("strong", { text: item.title }),
        el("span", { text: item.description || item.excerpt || item.language }),
      ]),
      button,
    ]);
  }

  return { el: root, render, open, close };
}