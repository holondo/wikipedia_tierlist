import { SHARE_HASH_PREFIX } from "../core/defaults.js";

export function documentToShareUrl(documentState) {
  const payload = encodeBase64Url(JSON.stringify(documentState));
  const url = new URL(location.href);
  url.hash = `${SHARE_HASH_PREFIX.slice(1)}${payload}`;
  return url.toString();
}

export function decodeDocumentFromHash(hash) {
  if (!hash.startsWith(SHARE_HASH_PREFIX)) return null;
  try {
    return JSON.parse(decodeBase64Url(hash.slice(SHARE_HASH_PREFIX.length)));
  } catch {
    return null;
  }
}

function encodeBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBase64Url(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
