// partner-portal/js/views/portalCorridorsView.js

import {
  getApprovedPilotCorridors,
  getPilotEnvironment
} from "../integrationPortalState.js";

import {
  createPortalMetricSummaryView
} from "./portalMetricSummaryView.js";

export function createPortalCorridorsView({
  shared
} = {}) {
  if (!shared) {
    throw new Error(
      "Shared portal view dependency is required."
    );
  }

  const {
    text,
    humanize,
    renderBadge,
    renderCard,
    renderPageHeader,
    renderEmptyState,
    renderTable
  } = shared;

  const metricSummaryView =
    createPortalMetricSummaryView({
      shared,
      getApprovedPilotCorridors,
      getPilotEnvironment
    });

  function getRequestedCorridors(state) {
    return Array.isArray(state.organization?.requested_corridors)
      ? state.organization.requested_corridors
      : [];
  }

  function normalizeCorridorName(corridor) {
    return (
      corridor?.corridor ||
      corridor?.destination_country ||
      corridor?.receiver_country ||
      corridor?.country ||
      corridor?.id ||
      String(corridor || "Corridor")
    );
  }

  function getCorridorStatus(corridor, fallback = "requested") {
    return (
      corridor?.status ||
      corridor?.pilot_status ||
      corridor?.approval_status ||
      fallback
    );
  }

  function renderCorridorSummary(state) {
    return metricSummaryView.renderCorridorMetrics(state);
  }

  function renderApprovedCorridors(state) {
    const corridors =
      getApprovedPilotCorridors(state);

    return renderCard({
      title: "Approved pilot corridors",
      description:
        "These corridors may be used with pilot API keys.",
      className: "corridors-approved-card",
      body: corridors.length
        ? `
          <div class="corridors-grid">
            ${corridors.map(corridor => `
              <div class="corridor-card">
                <div>
                  <strong>${text(normalizeCorridorName(corridor))}</strong>
                  <p>${text(humanize(getCorridorStatus(corridor, "approved")))}</p>
                </div>
                ${renderBadge("approved")}
              </div>
            `).join("")}
          </div>
        `
        : renderEmptyState({
          title: "No approved corridors",
          description:
            "Approved pilot corridors will appear here after UniBridge review."
        })
    });
  }

  function renderRequestedCorridors(state) {
    const requested =
      getRequestedCorridors(state);

    const rows =
      requested.map(corridor => [
        text(normalizeCorridorName(corridor)),
        renderBadge(getCorridorStatus(corridor)),
        text(
          corridor?.requested_at ||
          corridor?.created_at ||
          "Not available"
        )
      ]);

    return renderCard({
      title: "Requested corridors",
      description:
        "Corridors submitted in your onboarding questionnaire.",
      className: "corridors-requested-card",
      body: renderTable({
        columns: ["Corridor", "Status", "Requested"],
        rows,
        emptyTitle: "No requested corridors",
        emptyDescription:
          "Requested corridors will appear after the onboarding questionnaire is submitted."
      })
    });
  }

  function renderCorridorGuidance() {
    return renderCard({
      title: "Corridor access",
      description:
        "Pilot and production access are reviewed separately.",
      className: "corridors-guidance-card",
      body: `
        <div class="portal-detail-list">
          <div>
            <span>Pilot</span>
            <strong>Requires onboarding review and corridor approval.</strong>
          </div>

          <div>
            <span>Production</span>
            <strong>Requires KYB approval, go-live review, and production corridor approval.</strong>
          </div>

          <div>
            <span>API usage</span>
            <strong>API keys may only use corridors approved for their environment.</strong>
          </div>
        </div>
      `
    });
  }

  function renderCorridors(state) {
    if (!state.organization) {
      return `
        <div class="portal-corridors-page">
          ${renderPageHeader({
            eyebrow: "Corridors",
            title: "Corridor access",
            description:
              "Create or continue an organization before viewing corridor access."
          })}

          ${renderEmptyState({
            title: "No organization selected",
            description:
              "Corridor access becomes available after the partner organization is created or loaded."
          })}
        </div>
      `;
    }

    return `
      <div class="portal-corridors-page">
        ${renderPageHeader({
          eyebrow: "Corridors",
          title: "Corridor access",
          description:
            "Review requested corridors, pilot approvals, and production readiness."
        })}

        ${renderCorridorSummary(state)}

        <div class="portal-two-column-grid">
          ${renderApprovedCorridors(state)}
          ${renderCorridorGuidance()}
        </div>

        ${renderRequestedCorridors(state)}
      </div>
    `;
  }

  return {
    renderCorridors,
    renderCorridorSummary,
    renderApprovedCorridors,
    renderRequestedCorridors,
    renderCorridorGuidance
  };
}
