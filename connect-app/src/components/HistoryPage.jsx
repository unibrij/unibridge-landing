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

function formatStatus(status = "") {
  const value = String(status || "").trim();

  const labels = {
    created: "Route ready",
    waiting_ramp_payment: "Waiting for payment",
    funding_pending: "Funding pending",
    funding_confirmed: "Funding confirmed",
    wallet_submitted: "Wallet submitted"
  };

  return labels[value] || value || "—";
}

function formatAmount(item) {
  const amount = String(item?.amount || "").trim();
  const asset = String(item?.asset || "").trim();

  if (!amount) return "—";

  return `${amount}${asset ? ` ${asset}` : ""}`;
}

function formatDate(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    });
  } catch {
    return "—";
  }
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

      <h1>Payout history</h1>

      <section className="payout-form">
        {history.length === 0 ? (
          <p className="history-empty">
            No saved payouts yet.
          </p>
        ) : (
          <div className="history-list">
            {history.map((item, index) => (
              <div className="history-card" key={item.id || index}>
                <div className="history-row">
                  <span>Reference ID</span>
                  <strong>{shortId(item.route_id)}</strong>
                </div>

                <div className="history-row">
                  <span>Corridor</span>
                  <strong>{item.corridor || "—"}</strong>
                </div>

                <div className="history-row">
                  <span>Amount</span>
                  <strong>{formatAmount(item)}</strong>
                </div>

                <div className="history-row">
                  <span>Status</span>
                  <strong>{formatStatus(item.status)}</strong>
                </div>

                <div className="history-row">
                  <span>Date</span>
                  <strong>{formatDate(item.created_at)}</strong>
                </div>
              </div>
            ))}
          </div>
        )}

        <a href="/connect/" className="route-action-link history-back-link">
          Back to payout
        </a>
      </section>
    </main>
  );
}
