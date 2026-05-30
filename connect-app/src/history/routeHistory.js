// connect-app/src/history/routeHistory.js

const ROUTE_HISTORY_KEY = "unibridge_route_history";
const MAX_ROUTE_HISTORY_ITEMS = 20;

export function readRouteHistory() {
  try {
    const raw = window.localStorage.getItem(ROUTE_HISTORY_KEY);
    const parsed = JSON.parse(raw || "[]");

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeHistoryItem(item = {}) {
  return {
    id: item.id,
    route_id: item.route_id,
    payout_intent_id: item.payout_intent_id || null,
    settlement_id: item.settlement_id || null,
    corridor: item.corridor,
    amount: item.amount,
    asset: item.asset,
    status: item.status,
    created_at: item.created_at || new Date().toISOString()
  };
}

function historyItemKey(item = {}) {
  return (
    item.payout_intent_id ||
    item.settlement_id ||
    item.id ||
    item.route_id ||
    null
  );
}

export function writeRouteHistory(items) {
  try {
    const list =
      Array.isArray(items)
        ? items.map(normalizeHistoryItem)
        : [];

    window.localStorage.setItem(
      ROUTE_HISTORY_KEY,
      JSON.stringify(list.slice(0, MAX_ROUTE_HISTORY_ITEMS))
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
        .sort((a, b) => {
          const aTime = new Date(a.created_at || 0).getTime();
          const bTime = new Date(b.created_at || 0).getTime();

          return bTime - aTime;
        })
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
      created_at: item.created_at || new Date().toISOString()
    }
  ]);
}
