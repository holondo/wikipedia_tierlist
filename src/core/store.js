import { createDefaultDocument, createView, getActiveView, normalizeDocument } from "./defaults.js";
import { createId } from "./ids.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

export function createStore(initialState) {
  let state = normalizeDocument(initialState);
  const listeners = new Set();

  function update(mutator) {
    const next = clone(state);
    mutator(next);
    next.updatedAt = new Date().toISOString();
    state = normalizeDocument(next);
    emit();
  }

  function emit() {
    listeners.forEach((listener) => listener(state));
  }

  const api = {
    getState: () => state,
    emit,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    resetDocument() {
      state = createDefaultDocument();
      emit();
    },
    loadDocument(documentState) {
      state = normalizeDocument(documentState);
      emit();
    },
    updateTitle(title) {
      update((doc) => {
        doc.title = title.trim() || "Untitled wiki ranking";
      });
    },
    setUiLanguage(language) {
      update((doc) => {
        doc.settings.uiLanguage = language;
      });
    },
    setWikipediaLanguage(language) {
      update((doc) => {
        doc.settings.wikipediaLanguage = language;
      });
    },
    setActiveView(viewId) {
      update((doc) => {
        if (!doc.views[viewId]) doc.views[viewId] = createView(viewId, doc.itemOrder);
        doc.activeViewId = viewId;
      });
    },
    addItem(item) {
      if (state.items[item.id]) return false;
      update((doc) => {
        doc.items[item.id] = item;
        doc.itemOrder.push(item.id);
        Object.values(doc.views).forEach((view) => {
          view.placements.unplaced.push(item.id);
        });
      });
      return true;
    },
    removeItem(itemId) {
      update((doc) => {
        delete doc.items[itemId];
        doc.itemOrder = doc.itemOrder.filter((id) => id !== itemId);
        Object.values(doc.views).forEach((view) => {
          Object.keys(view.placements).forEach((listId) => {
            view.placements[listId] = view.placements[listId].filter((id) => id !== itemId);
          });
        });
      });
    },
    updateItem(itemId, patch) {
      update((doc) => {
        if (doc.items[itemId]) Object.assign(doc.items[itemId], patch);
      });
    },
    moveItem(itemId, targetListId, index = 0) {
      update((doc) => {
        const view = getActiveView(doc);
        const destination = targetListId || "unplaced";
        if (!view.placements[destination]) view.placements[destination] = [];

        Object.keys(view.placements).forEach((listId) => {
          view.placements[listId] = view.placements[listId].filter((id) => id !== itemId);
        });

        const boundedIndex = Math.max(0, Math.min(index, view.placements[destination].length));
        view.placements[destination].splice(boundedIndex, 0, itemId);
      });
    },
    updateZone(zoneId, patch) {
      update((doc) => {
        const view = getActiveView(doc);
        const zone = view.zones.find((candidate) => candidate.id === zoneId);
        if (zone) Object.assign(zone, patch);
      });
    },
    addZone() {
      update((doc) => {
        const view = getActiveView(doc);
        const id = createId("zone");
        view.zones.push({ id, label: `Zone ${view.zones.length + 1}`, color: "#8ecae6", rank: view.zones.length });
        view.placements[id] = [];
      });
    },
    removeZone(zoneId) {
      update((doc) => {
        const view = getActiveView(doc);
        if (view.zones.length <= 1) return;
        const removedItems = view.placements[zoneId] || [];
        view.zones = view.zones.filter((zone) => zone.id !== zoneId);
        view.placements.unplaced.push(...removedItems);
        delete view.placements[zoneId];
      });
    },
    moveZone(zoneId, direction) {
      update((doc) => {
        const view = getActiveView(doc);
        const index = view.zones.findIndex((zone) => zone.id === zoneId);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= view.zones.length) return;
        const [zone] = view.zones.splice(index, 1);
        view.zones.splice(nextIndex, 0, zone);
        view.zones.forEach((candidate, rank) => {
          candidate.rank = rank;
        });
      });
    },
    resetActiveView() {
      update((doc) => {
        doc.views[doc.activeViewId] = createView(doc.activeViewId, doc.itemOrder);
      });
    },
  };

  return api;
}
