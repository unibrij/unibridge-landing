// partner-portal/js/views/portalKybView.js

import {
  PORTAL_ACTION
} from "../integrationPortalState.js";

export function createPortalKybView({
  shared,
  can
} = {}) {
  if (!shared) {
    throw new Error(
      "Shared portal view dependency is required."
    );
  }

  if (typeof can !== "function") {
    throw new Error(
      "Permission checker dependency is required."
    );
  }

  const {
    text,
    humanize,
    renderBadge,
    renderCard,
    renderPageHeader,
    renderTimelineItem,
    renderEmptyState
  } = shared;

  function getKybStatus(state) {
    return (
      state.organization?.kyb_status ||
      state.kyb?.status ||
      "not_started"
    );
  }

  function getKybReference(state) {
    return (
      state.kyb?.reference ||
      state.kyb?.reference_id ||
      state.kyb?.id ||
      state.organization?.kyb_reference ||
      "not_available"
    );
  }

  function getKybProvider(state) {
    return (
      state.kyb?.provider ||
      state.organization?.kyb_provider ||
      "Didit"
    );
  }

  function getSubmittedAt(state) {
    return (
      state.kyb?.submitted_at ||
      state.organization?.kyb_submitted_at ||
      ""
    );
  }

  function getReviewedAt(state) {
    return (
      state.kyb?.approved_at ||
      state.kyb?.rejected_at ||
      state.kyb?.reviewed_at ||
      state.organization?.kyb_reviewed_at ||
      ""
    );
  }

  function normalizeStatus(status) {
    return String(status || "").toLowerCase();
  }

  function isSubmitted(status) {
    const normalized =
      normalizeStatus(status);

    return (
      normalized.includes("submitted") ||
      normalized.includes("pending") ||
      normalized.includes("review") ||
      normalized.includes("approved") ||
      normalized.includes("rejected") ||
      normalized.includes("failed") ||
      normalized === "passed"
    );
  }

  function isApproved(status) {
    const normalized =
      normalizeStatus(status);

    return (
      normalized.includes("approved") ||
      normalized === "passed"
    );
  }

  function isRejected(status) {
    const normalized =
      normalizeStatus(status);

    return (
      normalized.includes("rejected") ||
      normalized.includes("failed")
    );
  }

  function canStartKyb(status) {
    const normalized =
      normalizeStatus(status);

    return (
      !normalized ||
      normalized === "not_started" ||
      normalized === "required" ||
      normalized === "expired"
    );
  }

  function renderStartKybAction(state, status) {
    const disabled =
      state.loading ||
      !canStartKyb(status) ||
      !can(PORTAL_ACTION.start_didit_kyb);

    return `
      <div class="portal-form-actions">
        <button
          id="start-didit-kyb"
          class="portal-primary-button"
          type="button"
          ${disabled ? "disabled" : ""}
        >
          ${
            canStartKyb(status)
              ? "Start KYB"
              : "KYB already started"
          }
        </button>
      </div>
    `;
  }

  function renderKybSummary(state) {
    const status =
      getKybStatus(state);

    return renderCard({
      title: "KYB status",
      description:
        "KYB submission is required before pilot API keys can be issued. Full approval is required before production access.",
      className: "kyb-summary-card",
      actions: renderBadge(status),
      body: `
        <div class="kyb-summary-grid">
          <div>
            <span class="portal-field-label">Provider</span>
            <strong>${text(getKybProvider(state))}</strong>
          </div>

          <div>
            <span class="portal-field-label">Reference</span>
            <strong>${text(getKybReference(state))}</strong>
          </div>

          <div>
            <span class="portal-field-label">Submitted</span>
            <strong>${text(getSubmittedAt(state) || "Not submitted")}</strong>
          </div>

          <div>
            <span class="portal-field-label">Reviewed</span>
            <strong>${text(getReviewedAt(state) || "Not reviewed")}</strong>
          </div>
        </div>

        ${renderStartKybAction(state, status)}
      `
    });
  }

  function renderKybTimeline(state) {
    const status =
      getKybStatus(state);

    const submitted =
      isSubmitted(status);

    const approved =
      isApproved(status);

    const rejected =
      isRejected(status);

    return renderCard({
      title: "KYB timeline",
      description:
        "Track the verification lifecycle for this partner organization.",
      className: "kyb-timeline-card",
      body: `
        <div class="portal-timeline">
          ${renderTimelineItem({
            title: "KYB initialized",
            description: submitted
              ? "The KYB process has been started."
              : "The partner has not started KYB yet.",
            status: submitted ? "completed" : "current"
          })}

          ${renderTimelineItem({
            title: "KYB submitted",
            description: submitted
              ? "The KYB request has been submitted to the provider."
              : "Start KYB to submit company verification details.",
            status: submitted ? "completed" : "locked",
            meta: getSubmittedAt(state)
          })}

          ${renderTimelineItem({
            title: "Provider review",
            description: submitted
              ? `Current provider status: ${humanize(status)}.`
              : "Provider review starts after submission.",
            status: submitted && !approved && !rejected
              ? "pending"
              : submitted
                ? "completed"
                : "locked"
          })}

          ${renderTimelineItem({
            title: rejected ? "KYB rejected" : "KYB approved",
            description: rejected
              ? "The KYB review was rejected or failed."
              : approved
                ? "The organization passed KYB review."
                : "Approval is required for production access.",
            status: rejected
              ? "failed"
              : approved
                ? "completed"
                : "locked",
            meta: getReviewedAt(state)
          })}
        </div>
      `
    });
  }

  function renderKybReferenceCard(state) {
    return renderCard({
      title: "Reference details",
      description:
        "Use these details when contacting support about KYB review.",
      className: "kyb-reference-card",
      body: `
        <div class="portal-detail-list">
          <div>
            <span>Organization</span>
            <strong>
              ${text(state.organization?.name || state.organization?.id || "Not available")}
            </strong>
          </div>

          <div>
            <span>Provider</span>
            <strong>${text(getKybProvider(state))}</strong>
          </div>

          <div>
            <span>Reference</span>
            <strong>${text(getKybReference(state))}</strong>
          </div>

          <div>
            <span>Status</span>
            ${renderBadge(getKybStatus(state))}
          </div>
        </div>
      `
    });
  }

  function renderKyb(state) {
    if (!state.organization) {
      return `
        <div class="portal-kyb-page">
          ${renderPageHeader({
            eyebrow: "KYB",
            title: "Business verification",
            description:
              "Create or continue an organization before starting KYB."
          })}

          ${renderEmptyState({
            title: "No organization selected",
            description:
              "KYB becomes available after the partner organization is created or loaded."
          })}
        </div>
      `;
    }

    return `
      <div class="portal-kyb-page">
        ${renderPageHeader({
          eyebrow: "KYB",
          title: "Business verification",
          description:
            "Review the KYB status, provider reference, and verification timeline."
        })}

        <div class="kyb-top-grid">
          ${renderKybSummary(state)}
          ${renderKybReferenceCard(state)}
        </div>

        ${renderKybTimeline(state)}
      </div>
    `;
  }

  return {
    renderKyb,
    renderKybSummary,
    renderKybTimeline,
    renderKybReferenceCard
  };
}
