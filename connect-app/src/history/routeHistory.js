// connect-app/src/history/routeHistory.js

export function saveRouteHistoryItem(item) {
  try {
    const raw = window.localStorage.getItem("unibridge_route_history");
    const current = JSON.parse(raw || "[]");
    const list = Array.isArray(current) ? current : [];

    const next = [
      {
        id: item.id,
        route_id: item.route_id,
        payout_intent_id: item.payout_intent_id || null,
        corridor: item.corridor,
        amount: item.amount,
        asset: item.asset,
        status: item.status,
        created_at: new Date().toISOString()
      },
      ...list.filter(existing => existing.id !== item.id)
    ].slice(0, 20);

    window.localStorage.setItem(
      "unibridge_route_history",
      JSON.stringify(next)
    );
  } catch {
    // ignore local history failures
  }
}
