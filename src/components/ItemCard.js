import { el, icon } from "../core/dom.js";

export function createItemCard({ item, zones, currentListId, labels, onMove, onRemove }) {
  const imageUrl = item.bestImageUrl || item.thumbnailUrl;
  const thumb = imageUrl
    ? el("img", {
        attrs: {
          src: imageUrl,
          alt: "",
          loading: "lazy",
          crossorigin: "anonymous",
          referrerpolicy: "no-referrer",
        },
      })
    : el("span", { className: "thumb-fallback", text: initials(item.title) });

  const moveSelect = el("select", {
    className: "move-select",
    attrs: { "aria-label": labels.moveTo, title: labels.moveTo },
    on: {
      pointerdown: (event) => event.stopPropagation(),
      change: () => onMove(item.id, moveSelect.value, 9999),
    },
  }, [
    el("option", { text: labels.deck, attrs: { value: "unplaced" } }),
    ...zones.map((zone) => el("option", { text: zone.label, attrs: { value: zone.id } })),
  ]);
  moveSelect.value = currentListId;

  const controls = el("div", { className: "item-actions" }, [
    moveSelect,
    el("a", {
      className: "icon-button icon-button--small",
      attrs: {
        href: item.pageUrl,
        target: "_blank",
        rel: "noreferrer",
        title: labels.openArticle,
        "aria-label": labels.openArticle,
      },
    }, [icon("open_in_new")]),
    el("button", {
      className: "icon-button icon-button--small",
      attrs: { type: "button", title: labels.removeItem, "aria-label": labels.removeItem },
      on: { click: () => onRemove(item.id) },
    }, [icon("close")]),
  ]);

  return el("article", {
    className: "item-card",
    dataset: { itemId: item.id },
    attrs: { tabindex: "0", draggable: "true" },
  }, [
    el("span", {
      className: "item-drag-handle",
      attrs: { title: labels.dragItem, "aria-hidden": "true" },
    }, [icon("drag_indicator")]),
    el("div", { className: "item-thumb" }, [thumb]),
    el("div", { className: "item-copy" }, [
      el("strong", { text: item.title }),
      el("span", { text: item.description || item.excerpt || item.language }),
    ]),
    controls,
  ]);
}

function initials(value = "") {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "W";
}

