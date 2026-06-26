import { el } from "../core/dom.js";

export function createSnackbar() {
  let timer;
  const message = el("span", { text: "" });
  const closeButton = el("button", {
    className: "text-button snackbar-action",
    text: "OK",
    attrs: { type: "button" },
  });
  const root = el("div", {
    className: "snackbar",
    attrs: { role: "status", "aria-live": "polite" },
  }, [message, closeButton]);

  function hide() {
    root.classList.remove("is-visible");
  }

  closeButton.addEventListener("click", hide);

  return {
    el: root,
    show(text) {
      message.textContent = text;
      root.classList.add("is-visible");
      clearTimeout(timer);
      timer = setTimeout(hide, 3200);
    },
  };
}
