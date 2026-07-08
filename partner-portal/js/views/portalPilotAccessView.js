// partner-portal/js/views/portalPilotAccessView.js

import {
  getApprovedPilotCorridors,
  getPilotEnvironment,
  PORTAL_ACTION
} from "../integrationPortalState.js";

export function createPortalPilotAccessView({
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
    renderMetricCard,
    renderPageHeader,
    renderEmptyState,
    formatCount
  } = shared;

  function getPilotStatus(state) {
    const environment =
      getPilotEnvironment(state);

    return (
      environment?.status ||
      state.pilot_access?.status ||
      "pending"
    );
  }

  function getPilotEnvironmentId(state) {
    const environment =
      getPilotEnvironment(state);

    return (
      environment?.id ||
      "not_available"
    );
  }

  function getPilotLimits(state) {
    return (
      state.pilot_access?.limits ||
      state.application?.pilot_limits ||
      state.organization?.pilot_limits ||
      {}
    );
  }

  function renderSummary(state) {
    const status =
      getPilotStatus(state);

    const corridors =
      getApprovedPilotCorridors(state);

    return `
      <section class="pilot-summary-grid">
        ${renderMetricCard({
          icon: "◇",
          label: "Pilot status",
          value: humanize(status),
          badge: renderBadge(status),
          detail: getPilotEnvironmentId(state)
        })}

        ${renderMetricCard({
          icon: "⌁",
          label: "Approved corridors",
          value: formatCount(corridors.length),
          detail: corridors.length
            ? "Ready for pilot testing"
            : "No approved corridors"
        })}

        ${renderMetricCard({
          icon: "▣",
          label: "Environment",
          value: getPilotEnvironmentId(state),
          detail: "Pilot environment"
        })}
      </section>
    `;
  }

  function renderEnvironmentCard(state) {
    const environment =
      getPilotEnvironment(state);

    return renderCard({
      title: "Pilot environment",
      description:
        "Environment assigned for pilot integrations.",
      className: "pilot-environment-card",
      actions: renderBadge(getPilotStatus(state)),
      body: `
        <div class="portal-detail-list">
          <div>
            <span>Environment ID</span>
            <strong>${text(environment?.id || "Not available")}</strong>
          </div>

          <div>
            <span>Status</span>
            ${renderBadge(environment?.status || "pending")}
          </div>

          <div>
            <span>Type</span>
            <strong>${text(environment?.type || "pilot")}</strong>
          </div>
        </div>
      `
    });
  }

  function renderCorridorName(corridor) {
    return text(
      corridor.corridor ||
      corridor.destination_country ||
      corridor.receiver_country ||
      corridor.country ||
      String(corridor)
    );
  }

  function renderCorridorsCard(state) {
    const corridors =
      getApprovedPilotCorridors(state);

    return renderCard({
      title: "Approved corridors",
      description:
        "Only approved pilot corridors may be used with pilot API keys.",
      className: "pilot-corridors-card",
      body: corridors.length
        ? `
          <div class="pilot-corridor-grid">
            ${corridors.map(corridor => `
              <div class="pilot-corridor-card">
                <strong>${renderCorridorName(corridor)}</strong>
                ${renderBadge("approved")}
              </div>
            `).join("")}
          </div>
        `
        : renderEmptyState({
          title: "No approved corridors",
          description:
            "Pilot corridors will appear here after review."
        })
    });
  }

  function renderLimitsCard(state) {
    const limits =
      getPilotLimits(state);

    return renderCard({
      title: "Pilot limits",
      description:
        "Current limits configured for your pilot environment.",
      className: "pilot-limits-card",
      body: `
        <div class="portal-detail-list">
          <div>
            <span>Daily transactions</span>
            <strong>
              ${text(limits.daily_transactions ?? "Not configured")}
            </strong>
          </div>

          <div>
            <span>Monthly transactions</span>
            <strong>
              ${text(limits.monthly_transactions ?? "Not configured")}
            </strong>
          </div>

          <div>
            <span>Daily volume</span>
            <strong>
              ${text(limits.daily_volume ?? "Not configured")}
            </strong>
          </div>

          <div>
            <span>Monthly volume</span>
            <strong>
              ${text(limits.monthly_volume ?? "Not configured")}
            </strong>
          </div>
        </div>
      `
    });
  }

  function renderIssueKeyCard(state) {
    return renderCard({
      title: "Pilot API key",
      description:
        "Issue a pilot API key after onboarding, KYB submission, pilot approval, and corridor approval.",
      className: "pilot-api-key-card",
      body: `
        <div class="portal-form-actions">
          <button
            id="issue-pilot-credential"
            class="portal-primary-button"
            type="button"
            ${
              state.loading ||
              !can(PORTAL_ACTION.issue_pilot_credential)
                ? "disabled"
                : ""
            }
          >
            Issue pilot API key
          </button>
        </div>
      `
    });
  }

  function renderPilotAccess(state) {
    if (!state.application) {
      return `
        <div class="portal-pilot-page">
          ${renderPageHeader({
            eyebrow: "Pilot Access",
            title: "Pilot environment",
            description:
              "Create an application before requesting pilot access."
          })}

          ${renderEmptyState({
            title: "No application available",
            description:
              "Pilot access becomes available after an application has been created."
          })}
        </div>
      `;
    }

    return `
      <div class="portal-pilot-page">
        ${renderPageHeader({
          eyebrow: "Pilot Access",
          title: "Pilot environment",
          description:
            "Review your pilot environment, approved corridors, limits, and API key eligibility."
        })}

        ${renderSummary(state)}

        <div class="portal-two-column-grid">
          ${renderEnvironmentCard(state)}
          ${renderLimitsCard(state)}
        </div>

        ${renderCorridorsCard(state)}

        ${renderIssueKeyCard(state)}
      </div>
    `;
  }

  return {
    renderPilotAccess,
    renderSummary,
    renderEnvironmentCard,
    renderCorridorsCard,
    renderLimitsCard,
    renderIssueKeyCard
  };
}
