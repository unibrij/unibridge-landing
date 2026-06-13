// connect-app/src/history/routeHistory.js

const ROUTE_HISTORY_KEY = "unibridge_route_history";
const MAX_ROUTE_HISTORY_ITEMS = 20;

function canUseLocalStorage() {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

export function readRouteHistory() {
  try {
    if (!canUseLocalStorage()) {
      return [];
    }

    const raw = window.localStorage.getItem(ROUTE_HISTORY_KEY);
    const parsed = JSON.parse(raw || "[]");

    return Array.isArray(parsed)
      ? parsed.map(normalizeHistoryItem).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function toTime(value) {
  if (!value) {
    return 0;
  }

  if (typeof value === "string" || typeof value === "number") {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  if (value?._seconds) {
    return value._seconds * 1000;
  }

  if (value?.seconds) {
    return value.seconds * 1000;
  }

  return 0;
}

function normalizeHistoryItem(item = {}) {
  if (!item || typeof item !== "object") {
    return null;
  }

  return {
    id: item.id || null,
    route_id: item.route_id || null,
    payout_intent_id: item.payout_intent_id || null,
    settlement_id: item.settlement_id || null,
    corridor: item.corridor || null,
    amount: item.amount || null,
    asset: item.asset || null,
    status: item.status || null,
    created_at: item.created_at || new Date().toISOString()
  };
}

function historyItemKey(item = {}) {
  return (
    item.payout_intent_id ||
    item.settlement_id ||
    item.id ||
    null
  );
}

export function writeRouteHistory(items) {
  try {
    if (!canUseLocalStorage()) {
      return;
    }

    const list =
      Array.isArray(items)
        ? items.map(normalizeHistoryItem).filter(Boolean)
        : [];

    const sorted =
      list
        .sort((a, b) => (
          toTime(b.created_at) - toTime(a.created_at)
        ))
        .slice(0, MAX_ROUTE_HISTORY_ITEMS);

    window.localStorage.setItem(
      ROUTE_HISTORY_KEY,
      JSON.stringify(sorted)
    );
  } catch {
    // ignore local history failures
  }
}

export function mergeRouteHistoryItems(items = []) {
  try {
    const current = readRouteHistory();
    const merged = new Map();

    [...items, ...current].forEach(item => {
      const normalized = normalizeHistoryItem(item);

      if (!normalized) {
        return;
      }

      const key = historyItemKey(normalized);

      if (!key) {
        return;
      }

      if (!merged.has(key)) {
        merged.set(key, normalized);
      }
    });

    const next =
      Array.from(merged.values())
        .sort((a, b) => (
          toTime(b.created_at) - toTime(a.created_at)
        ))
        .slice(0, MAX_ROUTE_HISTORY_ITEMS);

    writeRouteHistory(next);

    return next;
  } catch {
    return readRouteHistory();
  }
}

export function saveRouteHistoryItem(item) {
  return mergeRouteHistoryItems([
    {
      ...item,
      created_at: item?.created_at || new Date().toISOString()
    }
  ]);
}
