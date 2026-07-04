// partner-portal/js/portalUtils.js

export function normalizeString(value) {
  return String(value || "").trim();
}

export function pickFirst(value) {
  return Array.isArray(value) && value.length
    ? value[0]
    : null;
}
