import { createId } from "./ids.js";

export const STORAGE_KEY = "wiki-tierlist.document.v2";
export const SHARE_HASH_PREFIX = "#doc=";
export const ICEBERG_BACKGROUND_URL = "./src/static/iceberg.webp";

export const VIEW_DEFINITIONS = {
  tierlist: {
    type: "tierlist",
    label: "Tier list",
    icon: "leaderboard",
    zones: [
      ["tier-s", "S", "#ff7478"],
      ["tier-a", "A", "#ffc27a"],
      ["tier-b", "B", "#ffe37d"],
      ["tier-c", "C", "#fdff7a"],
      ["tier-d", "D", "#b7ff7a"],
      ["tier-e", "E", "#73f779"],
      ["tier-f", "F", "#72eeee"],
    ],
  },
  iceberg: {
    type: "iceberg",
    label: "Iceberg",
    icon: "ac_unit",
    zones: [
      ["iceberg-sky", "Sky", "#1187e6"],
      ["iceberg-tip", "Tip", "#1c70ad"],
      ["iceberg-surface", "Surface", "#194778"],
      ["iceberg-shallow", "Shallow", "#0b344f"],
      ["iceberg-deep", "Deep", "#08273a"],
      ["iceberg-abyss", "Abyss", "#07141f"],
      ["iceberg-bottom", "Bottom", "#05080d"],
    ],
  },
};

export function createDefaultDocument() {
  return {
    schemaVersion: 1,
    title: "Untitled wiki ranking",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      uiLanguage: "en",
      wikipediaLanguage: "en",
    },
    activeViewId: "tierlist",
    items: {},
    itemOrder: [],
    views: {
      tierlist: createView("tierlist"),
      iceberg: createView("iceberg"),
    },
  };
}

export function createView(type, itemIds = []) {
  const definition = VIEW_DEFINITIONS[type] || VIEW_DEFINITIONS.tierlist;
  const zones = definition.zones.map(([id, label, color], index) => ({ id, label, color, rank: index }));
  return {
    id: definition.type,
    type: definition.type,
    title: definition.label,
    zones,
    placements: {
      unplaced: [...itemIds],
      ...Object.fromEntries(zones.map((zone) => [zone.id, []])),
    },
  };
}

export function getActiveView(documentState) {
  const viewId = documentState.activeViewId || "tierlist";
  return documentState.views[viewId] || documentState.views.tierlist;
}

export function normalizeDocument(input) {
  const fallback = createDefaultDocument();
  const doc = input && typeof input === "object" ? input : fallback;
  const itemOrder = Array.isArray(doc.itemOrder) ? doc.itemOrder.filter(Boolean) : Object.keys(doc.items || {});
  const items = {};

  for (const itemId of itemOrder) {
    if (doc.items?.[itemId]) items[itemId] = normalizeItem(doc.items[itemId]);
  }

  const normalized = {
    ...fallback,
    ...doc,
    settings: {
      ...fallback.settings,
      ...(doc.settings || {}),
    },
    items,
    itemOrder,
    views: {},
  };

  for (const type of Object.keys(VIEW_DEFINITIONS)) {
    normalized.views[type] = normalizeView(doc.views?.[type], type, itemOrder);
  }

  if (!normalized.views[normalized.activeViewId]) normalized.activeViewId = "tierlist";
  return normalized;
}

export function normalizeView(view, type, itemIds) {
  const base = createView(type, itemIds);
  if (!view || typeof view !== "object") return base;

  const zones = Array.isArray(view.zones) && view.zones.length
    ? view.zones.map((zone, index) => ({
        id: zone.id || createId("zone"),
        label: zone.label || `Zone ${index + 1}`,
        color: zone.color || base.zones[index]?.color || "#8ecae6",
        rank: Number.isFinite(zone.rank) ? zone.rank : index,
      }))
    : base.zones;

  const placements = { unplaced: [] };
  zones.forEach((zone) => {
    placements[zone.id] = [];
  });

  const seen = new Set();
  const sourcePlacements = view.placements || {};
  for (const listId of ["unplaced", ...zones.map((zone) => zone.id)]) {
    const ids = Array.isArray(sourcePlacements[listId]) ? sourcePlacements[listId] : [];
    for (const itemId of ids) {
      if (itemIds.includes(itemId) && !seen.has(itemId)) {
        placements[listId].push(itemId);
        seen.add(itemId);
      }
    }
  }

  for (const itemId of itemIds) {
    if (!seen.has(itemId)) placements.unplaced.push(itemId);
  }

  return {
    ...base,
    ...view,
    type,
    zones,
    placements,
  };
}

function normalizeItem(item) {
  return {
    id: item.id,
    pageId: item.pageId,
    title: item.title || "Untitled",
    description: item.description || "",
    excerpt: item.excerpt || "",
    thumbnailUrl: item.thumbnailUrl || "",
    bestImageUrl: item.bestImageUrl || item.originalImageUrl || "",
    pageUrl: item.pageUrl || "",
    source: item.source || "wikipedia",
    language: item.language || "en",
  };
}