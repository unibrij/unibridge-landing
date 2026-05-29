// connect-app/src/components/PayoutReviewOverlay.jsx

import { useState } from "react";

const RATINGS = [
  {
    value: "smooth",
    label: "Smooth"
  },
  {
    value: "okay",
    label: "Okay"
  },
  {
    value: "issue",
    label: "Had an issue"
  }
];

export default function PayoutReviewOverlay({
  settlementId,
  payoutIntentId,
  routeId,
  amount,
  asset,
  walletAddress,
  onClose
}) {
  const [selectedRating, setSelectedRating] = useState(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  function saveReview(rating) {
    const reviewKey =
      settlementId ||
      payoutIntentId ||
      `review_${Date.now()}`;

    const review = {
      settlement_id: settlementId || null,
      payout_intent_id: payoutIntentId || null,
      route_id: routeId || null,
      amount: amount || null,
      asset: asset || null,
      wallet_address: walletAddress || null,
      rating,
      note: note.trim(),
      created_at: new Date().toISOString()
    };

    try {
      const raw = window.localStorage.getItem("unibridge_payout_reviews");
      const current = JSON.parse(raw || "{}");

      window.localStorage.setItem(
        "unibridge_payout_reviews",
        JSON.stringify({
          ...current,
          [reviewKey]: review
        })
      );
    } catch {
      // ignore local review failures
    }

    setSaved(true);

    window.setTimeout(() => {
      onClose?.();
    }, 900);
  }

  if (saved) {
    return (
      <div className="review-overlay" role="dialog" aria-modal="true">
        <div className="review-card">
          <h2>Thanks — saved.</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="review-overlay" role="dialog" aria-modal="true">
      <div className="review-card">
        <h2>Payment completed</h2>

        <p>How was this payout?</p>

        <div className="review-actions">
          {RATINGS.map(item => (
            <button
              key={item.value}
              type="button"
              className={
                selectedRating === item.value
                  ? "review-option selected"
                  : "review-option"
              }
              onClick={() => {
                setSelectedRating(item.value);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {selectedRating ? (
          <>
            <textarea
              className="review-note"
              placeholder="Leave a short note"
              value={note}
              onChange={event => setNote(event.target.value)}
            />

            <button
              type="button"
              className="review-submit"
              onClick={() => saveReview(selectedRating)}
            >
              Submit review
            </button>
          </>
        ) : null}

        <button
          type="button"
          className="review-later"
          onClick={onClose}
        >
          Later
        </button>
      </div>
    </div>
  );
}
