import { STORAGE_KEY } from "./defaults.js";

export function getInitialDocument() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDocument(documentState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documentState));
  } catch {
    // Storage can fail in private browsing or full quota; the app still works in memory.
  }
}
