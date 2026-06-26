import { VIEW_DEFINITIONS } from "../core/defaults.js";
import { UI_LANGUAGES, WIKI_LANGUAGES, t } from "../core/i18n.js";
import { el, icon } from "../core/dom.js";

export function createToolbar({ store, onReset }) {
  const viewSelect = createPillSelect({ iconName: "dashboard", label: "View" });
  const wikiLanguageSelect = createPillSelect({ iconName: "language", label: "Wikipedia" });
  const uiLanguageSelect = createPillSelect({ iconName: "translate", label: "UI" });

  viewSelect.select.addEventListener("change", () => store.setActiveView(viewSelect.select.value));
  wikiLanguageSelect.select.addEventListener("change", () => store.setWikipediaLanguage(wikiLanguageSelect.select.value));
  uiLanguageSelect.select.addEventListener("change", () => store.setUiLanguage(uiLanguageSelect.select.value));

  const resetButton = el("button", {
    className: "pill-button",
    attrs: { type: "button", title: "Reset" },
    on: { click: onReset },
  }, [icon("restart_alt"), el("span", { text: "Reset" })]);

  const root = el("header", { className: "top-pillbar" }, [
    el("div", { className: "compact-brand" }, [
      icon("dataset"),
      el("strong", { text: "Wiki Tierlist" }),
    ]),
    el("div", { className: "pillbar-controls" }, [
      viewSelect.el,
      wikiLanguageSelect.el,
      uiLanguageSelect.el,
      resetButton,
    ]),
  ]);

  for (const definition of Object.values(VIEW_DEFINITIONS)) {
    viewSelect.select.append(el("option", { text: definition.label, attrs: { value: definition.type } }));
  }

  for (const language of WIKI_LANGUAGES) {
    wikiLanguageSelect.select.append(el("option", { text: language.label, attrs: { value: language.code } }));
  }

  for (const language of UI_LANGUAGES) {
    uiLanguageSelect.select.append(el("option", { text: language.label, attrs: { value: language.code } }));
  }

  return {
    el: root,
    render(state) {
      viewSelect.label.textContent = t(state, "viewLabel");
      wikiLanguageSelect.label.textContent = t(state, "wikipediaLanguage");
      uiLanguageSelect.label.textContent = t(state, "appLanguage");
      resetButton.title = t(state, "resetAll");
      resetButton.setAttribute("aria-label", t(state, "resetAll"));
      resetButton.querySelector("span:last-child").textContent = t(state, "resetAll");

      viewSelect.select.value = state.activeViewId;
      wikiLanguageSelect.select.value = state.settings.wikipediaLanguage;
      uiLanguageSelect.select.value = state.settings.uiLanguage;
    },
  };
}

function createPillSelect({ iconName, label }) {
  const labelNode = el("span", { className: "pill-label", text: label });
  const select = el("select", { className: "pill-select", attrs: { "aria-label": label } });
  return {
    select,
    label: labelNode,
    el: el("label", { className: "select-pill" }, [icon(iconName), labelNode, select]),
  };
}