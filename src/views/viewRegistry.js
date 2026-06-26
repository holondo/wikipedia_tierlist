export const viewRegistry = {
  tierlist: {
    className: "board--tierlist",
    zoneName: "tier",
  },
  iceberg: {
    className: "board--iceberg",
    zoneName: "layer",
  },
};

export function getViewPresentation(view) {
  return viewRegistry[view?.type] || viewRegistry.tierlist;
}
