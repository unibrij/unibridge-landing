// connect-app/src/components/RouteActions.jsx

const SUPPORT_WHATSAPP_NUMBER = "5541996608113";

function hashWallet(address) {
  if (!address) return "not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getSettlementId(settlement) {
  return (
    settlement?.settlement_id ||
    settlement?.id ||
    settlement?.route_id ||
    "N/A"
  );
}

function formatStatus(status = "") {
  const value = String(status || "").trim();

  const labels = {
    created: "Route ready",
    waiting_ramp_payment: "Waiting for payment",
    funding_pending: "Funding pending",
    funding_confirmed: "Funding confirmed",
    wallet_submitted: "Wallet submitted",
    completed: "Completed",
    complete: "Completed",
    paid: "Completed",
    executed: "Completed",
    success: "Completed",
    succeeded: "Completed",
    payout_completed: "Completed"
  };

  return labels[value] || value || "—";
}

function formatPayoutAmount(form) {
  const amount = String(form?.amount || "").trim();
  const asset = String(form?.asset || "").trim();

  if (!amount) return "—";

  return `${amount}${asset ? ` ${asset}` : ""}`;
}

function buildSupportUrl({
  settlement,
  address,
  selectedRouteId,
  selectedRoute,
  form
}) {
  const message = `
Hi UniBridge Support,

I need help with this payout.

Reference ID: ${getSettlementId(settlement)}
Wallet: ${hashWallet(address)}
Payout: ${formatPayoutAmount(form)}
Route: ${selectedRoute?.label || selectedRouteId || "N/A"}
Status: ${formatStatus(settlement?.status || "created")}
`.trim();

  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    message
  )}`;
}

export default function RouteActions({
  settlement,
  address,
  selectedRouteId,
  selectedRoute,
  form,
  onUseAgain
}) {
  if (!settlement) return null;

  const supportUrl = buildSupportUrl({
    settlement,
    address,
    selectedRouteId,
    selectedRoute,
    form
  });

  return (
    <div className="route-actions">
      <button type="button" onClick={onUseAgain}>
        Start another payout
      </button>

      <a href="/connect/?view=history" className="route-action-link">
        View payout history
      </a>

      <a
        href={supportUrl}
        target="_blank"
        rel="noreferrer"
        className="route-action-link"
      >
        Contact support
      </a>
    </div>
  );
}
