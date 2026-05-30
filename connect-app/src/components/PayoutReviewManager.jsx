// connect-app/src/components/PayoutReviewManager.jsx

import { useEffect, useMemo, useState } from "react";

import PayoutReviewOverlay from "./PayoutReviewOverlay";

function normalizeStatus(status = "") {
  return String(status || "")
    .trim()
    .toLowerCase();
}

function isCompletedStatus(status = "") {
  return [
    "completed",
    "complete",
    "executed",
    "success",
    "succeeded",
    "payout_completed",
    "execution_completed"
  ].includes(normalizeStatus(status));
}

function hasSavedReview(reviewKey) {
  if (!reviewKey) {
    return false;
  }

  try {
    const raw =
      window.localStorage.getItem(
        "unibridge_payout_reviews"
      );

    const reviews =
      JSON.parse(raw || "{}");

    return Boolean(reviews?.[reviewKey]);
  } catch {
    return false;
  }
}

export default function PayoutReviewManager({
  settlement,
  payoutIntentId,
  routeId,
  amount,
  asset,
  walletAddress
}) {
  const [dismissed, setDismissed] =
    useState(false);

  const reviewKey = useMemo(
    () =>
      settlement?.settlement_id ||
      settlement?.id ||
      payoutIntentId ||
      null,
    [settlement, payoutIntentId]
  );

  const shouldShow = useMemo(() => {
    if (!reviewKey) {
      return false;
    }

    if (!isCompletedStatus(settlement?.status)) {
      return false;
    }

    if (dismissed) {
      return false;
    }

    if (hasSavedReview(reviewKey)) {
      return false;
    }

    return true;
  }, [
    dismissed,
    reviewKey,
    settlement?.status
  ]);

  useEffect(() => {
    setDismissed(false);
  }, [reviewKey]);

  if (!shouldShow) {
    return null;
  }

  return (
    <PayoutReviewOverlay
      settlementId={
        settlement?.settlement_id ||
        settlement?.id ||
        null
      }
      payoutIntentId={payoutIntentId}
      routeId={routeId}
      amount={amount}
      asset={asset}
      walletAddress={walletAddress}
      onClose={() => {
        setDismissed(true);
      }}
    />
  );
}
