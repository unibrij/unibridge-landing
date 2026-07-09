// partner-portal/js/views/portalMetricSummaryView.js

export function createPortalMetricSummaryView({
  shared,
  getApprovedPilotCorridors,
  getPilotEnvironment
} = {}) {
  if (!shared) {
    throw new Error("Shared portal view dependency is required.");
  }

  const {
    text,
    displayStatus,
    formatCount
  } = shared;

  function getPilotStatus(state) {
    const pilotEnvironment =
      getPilotEnvironment(state);

    return (
      pilotEnvironment?.status ||
      state.pilot_access?.status ||
      "pending"
    );
  }

  function getCredentialCount(state) {
    return Array.isArray(state.credentials)
      ? state.credentials.length
      : 0;
  }

  function getEnvironmentCount(state) {
    return Array.isArray(state.environments)
      ? state.environments.length
      : state.application
        ? 1
        : 0;
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

    return `
      <article class="portal-metric-card">
        <span class="portal-metric-label">Approved corridors</span>
        <strong>${text(formatCount(approvedCorridors.length))}</strong>
        <p>
          ${text(
            approvedCorridors.length
              ? "Ready for pilot testing"
              : "Waiting for corridor approval"
          )}
        </p>
      </article>
    `;
  }

  function renderApiKeysCard(state) {
    return `
      <article class="portal-metric-card">
        <span class="portal-metric-label">API keys</span>
        <strong>${text(formatCount(getCredentialCount(state)))}</strong>
        <p>Secrets are never shown again</p>
      </article>
    `;
  }

  function renderEnvironmentsCard(state) {
    const pilotEnvironment =
      getPilotEnvironment(state);

    return `
      <article class="portal-metric-card">
        <span class="portal-metric-label">Environments</span>
        <strong>${text(formatCount(getEnvironmentCount(state)))}</strong>
        <p>${text(pilotEnvironment?.id || "No environment available yet")}</p>
      </article>
    `;
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

  return {
    renderOverviewMetrics,
    renderPilotMetrics,
    renderPilotStatusCard,
    renderApprovedCorridorsCard,
    renderApiKeysCard,
    renderEnvironmentsCard
  };
}
