// connect-app/src/components/payout-form/RouteInfo.jsx

import PolygonIcon from "./PolygonIcon.jsx";

import {
  getNetworkDisplayName
} from "./routeUtils.js";

function shortId(value = "") {
  const text =
    String(value || "").trim();

  if (!text) return "—";
  if (text.length <= 20) return text;

  return `${text.slice(0, 10)}...${text.slice(-6)}`;
}

async function copyToClipboard(value) {
  const text =
    String(value || "").trim();

  if (!text) return;

  await navigator.clipboard.writeText(text);
}

function CopyableValue({
  value,
  label
}) {
  return (
    <span className="route-info-action">
      <span
        className="route-info-value"
        title={value}
      >
        {shortId(value)}
      </span>

      <button
        type="button"
        className="copy-button"
        onClick={() => copyToClipboard(value)}
        aria-label={label}
      >
        ⧉
      </button>
    </span>
  );
}

export default function RouteInfo({
  selectedNetwork,
  selectedAsset,
  payoutIntentId,
  fundingTxHash,
  displayStatus
}) {
  const isPolygonNetwork =
    String(selectedNetwork || "").toLowerCase() === "polygon";

  return (
    <>
      <div className="route-info-grid">
        <div className="route-info-card">
          <span className="route-info-label">
            Network
          </span>

          <span className="route-info-value network-value">
            {isPolygonNetwork ? <PolygonIcon /> : null}

            <span>
              {getNetworkDisplayName(selectedNetwork)} · {selectedAsset}
            </span>
          </span>
        </div>

        {payoutIntentId ? (
          <div className="route-info-card">
            <span className="route-info-label">
              Route reference
            </span>

            <CopyableValue
              value={payoutIntentId}
              label="Copy route reference"
            />
          </div>
        ) : null}

        <div className="route-info-card">
          <span className="route-info-label">
            Status
          </span>

          <span className="route-status-pill">
            {displayStatus}
          </span>
        </div>
      </div>

      {fundingTxHash ? (
        <div className="wallet-tx-card">
          <span className="route-info-label">
            Wallet transaction
          </span>

          <CopyableValue
            value={fundingTxHash}
            label="Copy wallet transaction"
          />
        </div>
      ) : null}
    </>
  );
}
