// partner-portal/js/views/portalMetricSummaryView.js

export function createPortalMetricSummaryView({
  shared,
  getApprovedPilotCorridors,
  getPilotEnvironment
} = {}) {
  if (!shared) {
    throw new Error("Shared portal view dependency is required.");
  }

  if (typeof getApprovedPilotCorridors !== "function") {
    throw new Error("Approved pilot corridors selector dependency is required.");
  }

  if (typeof getPilotEnvironment !== "function") {
    throw new Error("Pilot environment selector dependency is required.");
  }

  const {
    text,
    displayStatus,
    formatCount
  } = shared;

  function getCredentialCount(state) {
    return Array.isArray(state.credentials)
      ? state.credentials.length
      : 0;
  }

  function getActiveCredentialCount(state) {
    return Array.isArray(state.credentials)
      ? state.credentials.filter(credential =>
          String(credential.status || "").toLowerCase() === "active"
        ).length
      : 0;
  }

  function getEnvironmentCount(state) {
    return Array.isArray(state.environments)
      ? state.environments.length
      : state.application
        ? 1
        : 0;
  }

  function getActiveEnvironmentCount(state) {
    return Array.isArray(state.environments)
      ? state.environments.filter(environment =>
          String(environment.status || "").toLowerCase() === "active"
        ).length
      : 0;
  }

  function getPilotStatus(state) {
    const pilotEnvironment =
      getPilotEnvironment(state);

    return (
      pilotEnvironment?.status ||
      state.pilot_access?.status ||
      "pending"
    );
  }

  function getRequestedCorridors(state) {
    const requested =
      state.organization?.requested_corridors ||
      state.organization?.onboarding_profile?.requested_corridors ||
      state.requested_corridors ||
      [];

    return Array.isArray(requested)
      ? requested
      : [];
  }

  function getProductionStatus(state) {
    return (
      state.organization?.production_status ||
      state.production_access?.status ||
      state.go_live?.status ||
      "not_enabled"
    );
  }

  function metricCard({
    label,
    value,
    detail = ""
  }) {
    return `
      <article class="portal-metric-card">
        <span class="portal-metric-label">${text(label)}</span>
        <strong>${text(value)}</strong>
        ${detail ? `<p>${text(detail)}</p>` : ""}
      </article>
    `;
  }

  function renderPilotStatusCard(state) {
    const pilotEnvironment =
      getPilotEnvironment(state);

    return `
      <article class="portal-metric-card">
        <span class="portal-metric-label">Pilot status</span>

        <div class="portal-metric-status-row">
          <span class="portal-badge portal-badge-success">
            ${text(displayStatus(getPilotStatus(state)))}
          </span>

          <p>${text(pilotEnvironment?.id || "Pilot environment pending")}</p>
        </div>
      </article>
    `;
  }

  function renderApprovedCorridorsCard(state) {
    const approvedCorridors =
      getApprovedPilotCorridors(state);

    return metricCard({
      label: "Approved corridors",
      value: formatCount(approvedCorridors.length),
      detail: approvedCorridors.length
        ? "Ready for pilot testing"
        : "Waiting for corridor approval"
    });
  }

  function renderApiKeysCard(state) {
    return metricCard({
      label: "API keys",
      value: formatCount(getCredentialCount(state)),
      detail: "Secrets are never shown again"
    });
  }

  function renderEnvironmentsCard(state) {
    const pilotEnvironment =
      getPilotEnvironment(state);

    return metricCard({
      label: "Environments",
      value: formatCount(getEnvironmentCount(state)),
      detail: pilotEnvironment?.id || "No environment available yet"
    });
  }

  function renderOverviewMetrics(state) {
    return `
      <section class="overview-metric-grid">
        ${renderPilotStatusCard(state)}
        ${renderApprovedCorridorsCard(state)}
        ${renderApiKeysCard(state)}
        ${renderEnvironmentsCard(state)}
      </section>
    `;
  }

  function renderPilotMetrics(state) {
    return `
      <section class="pilot-summary-grid">
        ${renderPilotStatusCard(state)}
        ${renderApprovedCorridorsCard(state)}
        ${renderEnvironmentsCard(state)}
      </section>
    `;
  }

  function renderCorridorMetrics(state) {
    const approvedCorridors =
      getApprovedPilotCorridors(state);

    const requestedCorridors =
      getRequestedCorridors(state);

    return `
      <section class="corridors-summary-grid">
        ${metricCard({
          label: "Approved for pilot",
          value: formatCount(approvedCorridors.length),
          detail: "Corridors available for pilot API keys"
        })}

        ${metricCard({
          label: "Requested corridors",
          value: formatCount(requestedCorridors.length),
          detail: "Corridors submitted through onboarding"
        })}

        ${metricCard({
          label: "Production access",
          value: displayStatus(getProductionStatus(state)),
          detail: "Production corridor access is reviewed during go-live"
        })}
      </section>
    `;
  }

  function renderApiKeyMetrics(state) {
    return `
      <section class="api-keys-summary-grid">
        ${metricCard({
          label: "API keys",
          value: formatCount(getCredentialCount(state)),
          detail: "Total issued credentials"
        })}

        ${metricCard({
          label: "Active",
          value: formatCount(getActiveCredentialCount(state)),
          detail: "Ready for authenticated requests"
        })}

        ${metricCard({
          label: "Secrets",
          value: "Hidden",
          detail: "Secrets are only shown once when issued"
        })}
      </section>
    `;
  }

  function renderEnvironmentMetrics(state) {
    return `
      <section class="api-keys-summary-grid">
        ${metricCard({
          label: "Environments",
          value: formatCount(getEnvironmentCount(state)),
          detail: "Total environments"
        })}

        ${metricCard({
          label: "Active",
          value: formatCount(getActiveEnvironmentCount(state)),
          detail: "Ready for testing"
        })}

        ${metricCard({
          label: "Default access",
          value: "Pilot",
          detail: "Production is reviewed separately"
        })}
      </section>
    `;
  }

  function renderLimitMetrics(state) {
    const limits =
      state.limits ||
      state.pilot_limits ||
      {};

    return `
      <section class="pilot-summary-grid">
        ${metricCard({
          label: "Daily transactions",
          value: limits.daily_transactions || "Not configured",
          detail: "Pilot limit"
        })}

        ${metricCard({
          label: "Monthly transactions",
          value: limits.monthly_transactions || "Not configured",
          detail: "Pilot limit"
        })}

        ${metricCard({
          label: "Monthly volume",
          value: limits.monthly_volume || "Not configured",
          detail: "Pilot limit"
        })}
      </section>
    `;
  }

  return {
    renderOverviewMetrics,
    renderPilotMetrics,
    renderCorridorMetrics,
    renderApiKeyMetrics,
    renderEnvironmentMetrics,
    renderLimitMetrics,
    renderPilotStatusCard,
    renderApprovedCorridorsCard,
    renderApiKeysCard,
    renderEnvironmentsCard
  };
}
