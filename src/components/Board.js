import { ICEBERG_BACKGROUND_URL, getActiveView } from "../core/defaults.js";
import { clear, el, icon } from "../core/dom.js";
import { t } from "../core/i18n.js";
import { getViewPresentation } from "../views/viewRegistry.js";
import { enrichWikipediaItemImage } from "../services/wikipediaApi.js?v=images";
import { createItemCard } from "./ItemCard.js?v=images";

const imageLookupIds = new Set();
const TOUCH_DRAG_EDGE = 72;
const TOUCH_DRAG_MAX_SCROLL_STEP = 18;

export function createBoard({ store, snackbar, onAddItems }) {
  const root = el("section", { className: "board-panel" });
  let exportElement = null;
  let touchDrag = null;

  function render(state) {
    cancelTouchDrag();
    const view = getActiveView(state);
    const presentation = getViewPresentation(view);
    const labels = {
      deck: t(state, "deck"),
      moveTo: t(state, "moveTo"),
      openArticle: t(state, "openArticle"),
      removeItem: t(state, "removeItem"),
      dragItem: t(state, "dragItem"),
    };

    exportElement = el("section", {
      className: `canvas-surface board ${presentation.className}`,
      attrs: { "aria-label": t(state, "board") },
    }, [
      createBoardHeading(state, view),
      createZoneStack({ state, view, labels }),
      createAddZoneRow(state),
    ]);

    const deck = createDeck({ state, view, labels });

    clear(root);
    root.append(exportElement, deck);
    wireNativeDrag();
    wireTouchDrag();
    enrichVisibleItemImages(state);
  }

  function createBoardHeading(state, view) {
    const titleInput = el("input", {
      className: "board-title-input",
      attrs: { type: "text", value: state.title || t(state, "untitled"), "aria-label": t(state, "titleLabel") },
      on: {
        change: () => store.updateTitle(titleInput.value),
        keydown: (event) => {
          if (event.key === "Enter") titleInput.blur();
        },
      },
    });

    return el("div", { className: "board-heading" }, [
      el("div", { className: "board-title-block" }, [
        el("p", { className: "eyebrow", text: view.title }),
        titleInput,
      ]),
      el("span", { className: "view-chip", text: view.type }),
    ]);
  }

  function createZoneStack({ state, view, labels }) {
    const children = [];
    if (view.type === "iceberg") {
      children.push(el("img", {
        className: "iceberg-background",
        attrs: {
          src: ICEBERG_BACKGROUND_URL,
          alt: "",
          crossorigin: "anonymous",
          referrerpolicy: "no-referrer",
        },
      }));
    }

    children.push(...view.zones.map((zone, index) => createZone({
      zone,
      index,
      total: view.zones.length,
      itemIds: view.placements[zone.id] || [],
      state,
      view,
      labels,
    })));

    return el("div", { className: "zone-stack" }, children);
  }

  function createZone({ zone, index, total, itemIds, state, view, labels }) {
    return el("section", {
      className: "zone",
      attrs: { style: `--zone-color: ${zone.color}` },
    }, [
      createZoneLabel(zone, state),
      createItemList({
        listId: zone.id,
        itemIds,
        state,
        view,
        labels,
        emptyText: t(state, "emptyBoard"),
      }),
      createZoneTools(zone, index, total, state),
    ]);
  }

  function createZoneLabel(zone, state) {
    const labelInput = el("input", {
      className: "zone-label-input",
      attrs: { type: "text", value: zone.label, "aria-label": t(state, "zoneLabel") },
      on: {
        change: () => store.updateZone(zone.id, { label: labelInput.value.trim() || zone.label }),
        keydown: (event) => {
          if (event.key === "Enter") labelInput.blur();
        },
      },
    });

    return el("div", { className: "zone-label" }, [labelInput]);
  }

  function createZoneTools(zone, index, total, state) {
    const colorInput = el("input", {
      className: "zone-color-input",
      attrs: { type: "color", value: zone.color, "aria-label": t(state, "zoneColor"), title: t(state, "zoneColor") },
      on: { input: (event) => store.updateZone(zone.id, { color: event.target.value }) },
    });

    return el("div", { className: "zone-tools" }, [
      colorInput,
      toolButton("keyboard_arrow_up", "Move up", () => store.moveZone(zone.id, -1), index === 0),
      toolButton("keyboard_arrow_down", "Move down", () => store.moveZone(zone.id, 1), index === total - 1),
      toolButton("delete", t(state, "deleteZone"), () => store.removeZone(zone.id), total <= 1),
    ]);
  }

  function toolButton(iconName, label, handler, disabled = false) {
    return el("button", {
      className: "zone-tool-button",
      attrs: { type: "button", title: label, "aria-label": label, disabled },
      on: { click: handler },
    }, [icon(iconName)]);
  }

  function createAddZoneRow(state) {
    return el("div", { className: "zone-add-row" }, [
      el("button", {
        className: "tonal-button",
        attrs: { type: "button" },
        on: { click: () => store.addZone() },
      }, [icon("add"), el("span", { text: t(state, "addZone") })]),
    ]);
  }

  function createDeck({ state, view, labels }) {
    const itemIds = view.placements.unplaced || [];
    return el("section", { className: "deck-card" }, [
      el("div", { className: "deck-header" }, [
        el("div", {}, [
          el("p", { className: "eyebrow", text: "Wikipedia" }),
          el("h2", { text: t(state, "deck") }),
        ]),
        el("div", { className: "deck-actions" }, [
          el("span", { className: "deck-count", text: String(itemIds.length) }),
          el("button", {
            className: "filled-button",
            attrs: { type: "button" },
            on: { click: onAddItems },
          }, [icon("add"), el("span", { text: t(state, "addItems") })]),
        ]),
      ]),
      createItemList({
        listId: "unplaced",
        itemIds,
        state,
        view,
        labels,
        emptyText: t(state, "emptyDeck"),
      }),
    ]);
  }

  function createItemList({ listId, itemIds, state, view, labels, emptyText }) {
    const children = itemIds
      .map((itemId) => state.items[itemId])
      .filter(Boolean)
      .map((item) => createItemCard({
        item,
        zones: view.zones,
        currentListId: listId,
        labels,
        onMove: (itemId, targetListId, index) => store.moveItem(itemId, targetListId, index),
        onRemove: (itemId) => {
          store.removeItem(itemId);
          snackbar.show(t(store.getState(), "itemRemoved"));
        },
      }));

    if (!children.length) {
      children.push(el("div", { className: "empty-list", text: emptyText }));
    }

    return el("div", {
      className: "item-list js-sortable-list",
      dataset: { listId },
    }, children);
  }

  function enrichVisibleItemImages(state) {
    Object.values(state.items)
      .filter((item) => item.source === "wikipedia" && item.thumbnailUrl && !item.bestImageUrl && !imageLookupIds.has(item.id))
      .forEach((item) => {
        imageLookupIds.add(item.id);
        enrichWikipediaItemImage(item)
          .then((enriched) => {
            if (enriched.bestImageUrl && store.getState().items[item.id]) {
              store.updateItem(item.id, { bestImageUrl: enriched.bestImageUrl });
            }
          })
          .finally(() => imageLookupIds.delete(item.id));
      });
  }
  function wireNativeDrag() {
    root.querySelectorAll(".item-card").forEach((card) => {
      card.addEventListener("dragstart", (event) => {
        if (!event.dataTransfer) return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", card.dataset.itemId);
        card.classList.add("item-card--drag");
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("item-card--drag");
        clearNativeDropTargets();
      });
    });

    root.querySelectorAll(".js-sortable-list").forEach((list) => {
      list.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        list.classList.add("item-list--drop-target");
      });
      list.addEventListener("dragleave", (event) => {
        if (!list.contains(event.relatedTarget)) list.classList.remove("item-list--drop-target");
      });
      list.addEventListener("drop", (event) => {
        event.preventDefault();
        clearNativeDropTargets();
        const itemId = event.dataTransfer.getData("text/plain");
        const targetListId = list.dataset.listId;
        if (!itemId || !targetListId) return;
        store.moveItem(itemId, targetListId, getDropIndex(list, event.clientX, event.clientY));
      });
    });
  }

  function wireTouchDrag() {
    root.querySelectorAll(".item-drag-handle").forEach((handle) => {
      handle.addEventListener("pointerdown", startTouchDrag);
    });
  }

  function startTouchDrag(event) {
    if (event.pointerType === "mouse" || !event.isPrimary) return;

    const card = event.currentTarget.closest(".item-card");
    if (!card?.dataset.itemId) return;

    event.preventDefault();
    event.stopPropagation();
    cancelTouchDrag();

    const rect = card.getBoundingClientRect();
    const ghost = card.cloneNode(true);
    ghost.classList.remove("item-card--drag", "item-card--touch-source");
    ghost.classList.add("item-card--touch-ghost");
    ghost.setAttribute("aria-hidden", "true");
    ghost.removeAttribute("tabindex");
    ghost.removeAttribute("draggable");
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    document.body.append(ghost);

    touchDrag = {
      pointerId: event.pointerId,
      itemId: card.dataset.itemId,
      sourceCard: card,
      ghost,
      placeholder: el("div", { className: "item-drop-placeholder", attrs: { "aria-hidden": "true" } }),
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      targetList: null,
      targetIndex: 0,
    };

    card.classList.add("item-card--drag", "item-card--touch-source");
    document.body.classList.add("is-touch-dragging");

    try {
      card.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers do not allow capture after touch retargeting.
    }

    window.addEventListener("pointermove", handleTouchDragMove, { passive: false });
    window.addEventListener("pointerup", handleTouchDragEnd, { passive: false });
    window.addEventListener("pointercancel", cancelTouchDrag, { passive: false });
    window.addEventListener("blur", cancelTouchDrag);

    moveTouchGhost(event.clientX, event.clientY);
    updateTouchDropTarget(event.clientX, event.clientY);
  }

  function handleTouchDragMove(event) {
    if (!touchDrag || event.pointerId !== touchDrag.pointerId) return;

    event.preventDefault();
    moveTouchGhost(event.clientX, event.clientY);
    autoScrollForTouchDrag(event.clientX, event.clientY);
    updateTouchDropTarget(event.clientX, event.clientY);
  }

  function handleTouchDragEnd(event) {
    if (!touchDrag || event.pointerId !== touchDrag.pointerId) return;

    event.preventDefault();
    updateTouchDropTarget(event.clientX, event.clientY);

    const itemId = touchDrag.itemId;
    const targetList = touchDrag.targetList;
    const targetIndex = touchDrag.targetIndex;
    cleanupTouchDrag();

    if (targetList?.dataset.listId) {
      store.moveItem(itemId, targetList.dataset.listId, targetIndex);
    }
  }

  function cancelTouchDrag(event) {
    if (!touchDrag) return;
    if (event?.pointerId !== undefined && event.pointerId !== touchDrag.pointerId) return;
    cleanupTouchDrag();
  }

  function cleanupTouchDrag() {
    const drag = touchDrag;
    touchDrag = null;

    window.removeEventListener("pointermove", handleTouchDragMove);
    window.removeEventListener("pointerup", handleTouchDragEnd);
    window.removeEventListener("pointercancel", cancelTouchDrag);
    window.removeEventListener("blur", cancelTouchDrag);

    if (drag?.sourceCard?.isConnected) {
      drag.sourceCard.classList.remove("item-card--drag", "item-card--touch-source");
      try {
        if (drag.sourceCard.hasPointerCapture?.(drag.pointerId)) {
          drag.sourceCard.releasePointerCapture(drag.pointerId);
        }
      } catch {
        // The pointer may already be released after pointerup/cancel.
      }
    }

    drag?.ghost?.remove();
    drag?.placeholder?.remove();
    document.body.classList.remove("is-touch-dragging");
    clearTouchDropTarget();
  }

  function moveTouchGhost(clientX, clientY) {
    if (!touchDrag) return;
    const x = Math.round(clientX - touchDrag.offsetX);
    const y = Math.round(clientY - touchDrag.offsetY);
    touchDrag.ghost.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function updateTouchDropTarget(clientX, clientY) {
    if (!touchDrag) return;

    const list = findSortableListAtPoint(clientX, clientY);
    if (!list) {
      setTouchDropTarget(null, 0);
      return;
    }

    setTouchDropTarget(list, getDropIndex(list, clientX, clientY));
  }

  function setTouchDropTarget(list, index) {
    if (!touchDrag) return;

    if (touchDrag.targetList && touchDrag.targetList !== list) {
      touchDrag.targetList.classList.remove("item-list--drop-target", "item-list--has-placeholder");
    }

    if (!list) {
      touchDrag.placeholder.remove();
      touchDrag.targetList = null;
      touchDrag.targetIndex = 0;
      return;
    }

    list.classList.add("item-list--drop-target", "item-list--has-placeholder");
    const cards = [...list.querySelectorAll(".item-card:not(.item-card--drag)")];
    const before = cards[index] || null;
    if (before) list.insertBefore(touchDrag.placeholder, before);
    else list.append(touchDrag.placeholder);

    touchDrag.targetList = list;
    touchDrag.targetIndex = index;
  }

  function findSortableListAtPoint(clientX, clientY) {
    for (const node of document.elementsFromPoint(clientX, clientY)) {
      if (!(node instanceof Element)) continue;
      const list = node.closest(".js-sortable-list");
      if (list && root.contains(list)) return list;
    }
    return null;
  }

  function autoScrollForTouchDrag(clientX, clientY) {
    const verticalStep = getEdgeScrollStep(clientY, 0, window.innerHeight);
    if (verticalStep) window.scrollBy(0, verticalStep);

    if (root.scrollWidth <= root.clientWidth) return;
    const rect = root.getBoundingClientRect();
    const horizontalStep = getEdgeScrollStep(clientX, rect.left, rect.right);
    if (horizontalStep) root.scrollLeft += horizontalStep;
  }

  function getEdgeScrollStep(point, start, end) {
    const size = Math.max(1, end - start);
    const edge = Math.min(TOUCH_DRAG_EDGE, size / 3);
    const before = point - start;
    const after = end - point;

    if (before < edge) {
      const progress = Math.min(1, (edge - before) / edge);
      return -Math.ceil(progress * TOUCH_DRAG_MAX_SCROLL_STEP);
    }

    if (after < edge) {
      const progress = Math.min(1, (edge - after) / edge);
      return Math.ceil(progress * TOUCH_DRAG_MAX_SCROLL_STEP);
    }

    return 0;
  }

  function clearNativeDropTargets() {
    root.querySelectorAll(".item-list--drop-target").forEach((list) => {
      list.classList.remove("item-list--drop-target");
    });
  }

  function clearTouchDropTarget() {
    root.querySelectorAll(".item-list--drop-target, .item-list--has-placeholder").forEach((list) => {
      list.classList.remove("item-list--drop-target", "item-list--has-placeholder");
    });
  }

  function getDropIndex(list, x, y) {
    const cards = [...list.querySelectorAll(".item-card:not(.item-card--drag)")];
    if (!cards.length) return 0;

    let best = { distance: Number.POSITIVE_INFINITY, index: cards.length };
    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(x - centerX, y - centerY);
      if (distance < best.distance) {
        const after = y > centerY || (Math.abs(y - centerY) < rect.height * 0.4 && x > centerX);
        best = { distance, index: index + (after ? 1 : 0) };
      }
    });
    return best.index;
  }

  return {
    el: root,
    render,
    getExportElement: () => exportElement,
  };
}