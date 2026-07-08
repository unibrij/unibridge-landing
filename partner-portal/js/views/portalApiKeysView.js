// partner-portal/js/views/portalApiKeysView.js

import {
  PORTAL_ACTION
} from "../integrationPortalState.js";

export function createPortalApiKeysView({
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
    renderBadge,
    renderCard,
    renderPageHeader,
    renderEmptyState,
    renderTable,
    formatCount
  } = shared;

  function getCredentials(state) {
    return Array.isArray(state.credentials)
      ? state.credentials
      : [];
  }

  function renderSummary(state) {
    const credentials =
      getCredentials(state);

    const active =
      credentials.filter(credential =>
        (credential.status || "active") === "active"
      );

    return `
      <section class="api-keys-summary-grid">
        <div class="portal-metric-card">
          <span class="portal-metric-label">API keys</span>
          <strong>${text(formatCount(credentials.length))}</strong>
          <p>Total issued credentials.</p>
        </div>

        <div class="portal-metric-card">
          <span class="portal-metric-label">Active</span>
          <strong>${text(formatCount(active.length))}</strong>
          <p>Ready for authenticated requests.</p>
        </div>

        <div class="portal-metric-card">
          <span class="portal-metric-label">Secrets</span>
          <strong>Hidden</strong>
          <p>Secrets are only shown once when issued.</p>
        </div>
      </section>
    `;
  }

  function renderActions(state) {
    return renderCard({
      title: "Credential management",
      description:
        "Manage pilot API credentials without exposing secret values.",
      className: "api-key-actions-card",
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
            Create API key
          </button>
        </div>
      `
    });
  }

  function renderCredentialTable(state) {
    const credentials =
      getCredentials(state);

    const rows =
      credentials.map(credential => [
        text(
          credential.key_prefix ||
          credential.name ||
          credential.id ||
          "API key"
        ),

        renderBadge(
          credential.status || "active"
        ),

        text(
          credential.environment_id ||
          credential.environment ||
          "pilot"
        ),

        text(
          credential.created_at ||
          credential.issued_at ||
          "Not available"
        )
      ]);

    return renderCard({
      title: "Issued API keys",
      description:
        "Credential secrets are intentionally never displayed again.",
      className: "api-key-table-card",
      body: renderTable({
        columns: [
          "Key",
          "Status",
          "Environment",
          "Created"
        ],
        rows,
        emptyTitle: "No API keys",
        emptyDescription:
          "Issue your first pilot API key once onboarding requirements are complete."
      })
    });
  }

  function renderSecurityCard() {
    return renderCard({
      title: "Security",
      description:
        "Credential lifecycle follows UniBridge security practices.",
      className: "api-key-security-card",
      body: `
        <div class="portal-detail-list">
          <div>
            <span>Secrets</span>
            <strong>Displayed only once at creation.</strong>
          </div>

          <div>
            <span>Rotation</span>
            <strong>Handled through approved credential workflows.</strong>
          </div>

          <div>
            <span>Revocation</span>
            <strong>Handled through approved credential workflows.</strong>
          </div>
        </div>
      `
    });
  }

  function renderApiKeys(state) {
    if (!state.application) {
      return `
        <div class="portal-api-keys-page">
          ${renderPageHeader({
            eyebrow: "API Keys",
            title: "Credential management",
            description:
              "Create an application before managing API credentials."
          })}

          ${renderEmptyState({
            title: "No application available",
            description:
              "API keys become available after an application has been created."
          })}
        </div>
      `;
    }

    return `
      <div class="portal-api-keys-page">
        ${renderPageHeader({
          eyebrow: "API Keys",
          title: "Credential management",
          description:
            "Review issued credentials and manage secure API access."
        })}

        ${renderSummary(state)}

        <div class="portal-two-column-grid">
          ${renderActions(state)}
          ${renderSecurityCard()}
        </div>

        ${renderCredentialTable(state)}
      </div>
    `;
  }

  return {
    renderApiKeys,
    renderSummary,
    renderActions,
    renderCredentialTable,
    renderSecurityCard
  };
}
