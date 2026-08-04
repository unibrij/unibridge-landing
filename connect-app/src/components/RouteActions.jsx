// connect-app/src/components/RouteActions.jsx

export default function RouteActions({
  settlement,
  onUseAgain
}) {
  if (!settlement) {
    return null;
  }

  return (
    <div className="route-actions">
      <button
        type="button"
        onClick={onUseAgain}
      >
        Start another payout
      </button>

      <a
        href="/connect/?view=history"
        className="route-action-link"
      >
        View payout history
      </a>
    </div>
  );
}
