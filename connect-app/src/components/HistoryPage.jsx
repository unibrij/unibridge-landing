// connect-app/src/components/HistoryPage.jsx

function readRouteHistory() {
  try {
    const raw = window.localStorage.getItem("unibridge_route_history");
    const parsed = JSON.parse(raw || "[]");

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function shortId(value = "") {
  const text = String(value || "").trim();

  if (!text) return "—";
  if (text.length <= 18) return text;

  return `${text.slice(0, 8)}...${text.slice(-6)}`;
}

export default function HistoryPage() {
  const history = readRouteHistory();

  return (
    <main className="connect-shell">
      <img
        src="/connect/icons/social/Ub.png"
        className="logo"
        alt="UniBridge"
      />

      <h1>Route history</h1>

      <section className="payout-form">
        {history.length === 0 ? (
          <p className="history-empty">
            No saved routes yet.
          </p>
        ) : (
          <div className="history-list">
            {history.map((item, index) => (
              <div className="history-card" key={item.id || index}>
                <div className="history-row">
                  <span>Route</span>
                  <strong>{shortId(item.route_id)}</strong>
                </div>

                <div className="history-row">
                  <span>Corridor</span>
                  <strong>{item.corridor || "—"}</strong>
                </div>

                <div className="history-row">
                  <span>Asset</span>
                  <strong>{item.asset || "—"}</strong>
                </div>

                <div className="history-row">
                  <span>Status</span>
                  <strong>{item.status || "—"}</strong>
                </div>
              </div>
            ))}
          </div>
        )}

        <a href="/connect/" className="route-action-link history-back-link">
          Back to route
        </a>
      </section>
    </main>
  );
}
