// partner-portal/js/integrationPortalViews.js

import {
  createPortalSharedView
} from "./views/portalSharedView.js";

import {
  createPortalLayoutView
} from "./views/portalLayoutView.js";

import {
  createPortalOverviewView
} from "./views/portalOverviewView.js";

import {
  createPortalOnboardingView
} from "./views/portalOnboardingView.js";

import {
  createPortalKybView
} from "./views/portalKybView.js";

import {
  createPortalPilotAccessView
} from "./views/portalPilotAccessView.js";

import {
  createPortalCorridorsView
} from "./views/portalCorridorsView.js";

import {
  createPortalApiKeysView
} from "./views/portalApiKeysView.js";

import {
  createPortalDeveloperDocsView
} from "./views/portalDeveloperDocsView.js";

export function createIntegrationPortalViews({
  htmlEscape,
  can
} = {}) {
  if (typeof htmlEscape !== "function") {
    throw new Error(
      "htmlEscape renderer dependency is required."
    );
  }

  if (typeof can !== "function") {
    throw new Error(
      "can renderer dependency is required."
    );
  }

  const shared =
    createPortalSharedView({
      htmlEscape
    });

  const layout =
    createPortalLayoutView({
      shared
    });

  const overviewView =
    createPortalOverviewView({
      shared
    });

  const onboardingView =
    createPortalOnboardingView({
      shared,
      can
    });

  const kybView =
    createPortalKybView({
      shared,
      can
    });

  const pilotAccessView =
    createPortalPilotAccessView({
      shared,
      can
    });

  const corridorsView =
    createPortalCorridorsView({
      shared
    });

  const apiKeysView =
    createPortalApiKeysView({
      shared,
      can
    });

  const developerDocsView =
    createPortalDeveloperDocsView({
      shared
    });

  const {
    text,
    humanize,
    renderBadge,
    renderCard,
    renderMetricCard,
    renderPageHeader,
    renderEmptyState,
    renderTable,
    formatCount
  } = shared;

  function getEnvironments(state) {
    return Array.isArray(state.environments)
      ? state.environments
      : [];
  }

  function getCredentials(state) {
    return Array.isArray(state.credentials)
      ? state.credentials
      : [];
  }

  function getAuditEvents(state) {
    return Array.isArray(state.audit_events)
      ? state.audit_events
      : [];
  }

  function renderEnvironments(state) {
    const environments =
      getEnvironments(state);

    const active =
      environments.filter(environment =>
        String(environment?.status || "active")
          .toLowerCase() === "active"
      );

    const rows =
      environments.map(environment => [
        text(environment.id || "Environment"),
        text(humanize(environment.type || "pilot")),
        renderBadge(environment.status || "active"),
        text(environment.created_at || "Not available")
      ]);

    return `
      <div class="portal-environments-page">
        ${renderPageHeader({
          eyebrow: "Environments",
          title: "Integration environments",
          description:
            "Review environments assigned to this application."
        })}

        <section class="api-keys-summary-grid">
          ${renderMetricCard({
            icon: "▣",
            label: "Environments",
            value: formatCount(environments.length),
            detail: "Total environments"
          })}

          ${renderMetricCard({
            icon: "◇",
            label: "Active",
            value: formatCount(active.length),
            detail: "Ready for testing"
          })}

          ${renderMetricCard({
            icon: "⌁",
            label: "Default access",
            value: "Pilot",
            detail: "Production is reviewed separately"
          })}
        </section>

        ${renderCard({
          title: "Environment list",
          description:
            "Environment records currently visible to the partner portal.",
          body: renderTable({
            columns: ["Environment ID", "Type", "Status", "Created"],
            rows,
            emptyTitle: "No environments",
            emptyDescription:
              "Environments will appear after an application is created."
          })
        })}
      </div>
    `;
  }

  function renderLimits(state) {
    const pilotLimits =
      state.pilot_access?.limits ||
      state.application?.pilot_limits ||
      state.organization?.pilot_limits ||
      {};

    return `
      <div class="portal-limits-page">
        ${renderPageHeader({
          eyebrow: "Limits",
          title: "Pilot limits",
          description:
            "Review the current limits configured for your pilot environment."
        })}

        <section class="api-keys-summary-grid">
          ${renderMetricCard({
            icon: "▤",
            label: "Daily transactions",
            value: pilotLimits.daily_transactions ?? "Not configured",
            detail: "Pilot limit"
          })}

          ${renderMetricCard({
            icon: "▤",
            label: "Monthly transactions",
            value: pilotLimits.monthly_transactions ?? "Not configured",
            detail: "Pilot limit"
          })}

          ${renderMetricCard({
            icon: "▤",
            label: "Monthly volume",
            value: pilotLimits.monthly_volume ?? "Not configured",
            detail: "Pilot limit"
          })}
        </section>

        ${renderCard({
          title: "Limit policy",
          description:
            "Pilot and production limits are reviewed separately.",
          body: `
            <div class="portal-detail-list">
              <div>
                <span>Pilot limits</span>
                <strong>Configured after onboarding review and corridor approval.</strong>
              </div>

              <div>
                <span>Production limits</span>
                <strong>Reviewed during go-live approval.</strong>
              </div>

              <div>
                <span>API enforcement</span>
                <strong>Requests must stay within the approved environment limits.</strong>
              </div>
            </div>
          `
        })}
      </div>
    `;
  }

  function renderAuditLog(state) {
    const auditEvents =
      getAuditEvents(state);

    const rows =
      auditEvents.map(event => [
        text(humanize(event.type || event.action || "Portal event")),
        renderBadge(event.status || "recorded"),
        text(event.actor || event.actor_email || "System"),
        text(event.created_at || event.timestamp || "Not available")
      ]);

    return `
      <div class="portal-audit-log-page">
        ${renderPageHeader({
          eyebrow: "Audit Log",
          title: "Recent activity",
          description:
            "Review recent portal events and operational changes."
        })}

        ${renderCard({
          title: "Audit events",
          description:
            "Sensitive actions and important portal changes appear here.",
          body: renderTable({
            columns: ["Event", "Status", "Actor", "Created"],
            rows,
            emptyTitle: "No audit events",
            emptyDescription:
              "Audit activity will appear after onboarding or credential actions are recorded."
          })
        })}
      </div>
    `;
  }

  function renderSupport() {
    return `
      <div class="portal-support-page">
        ${renderPageHeader({
          eyebrow: "Support",
          title: "Support",
          description:
            "Get help with onboarding, KYB, pilot access, API keys, or integration testing."
        })}

        <div class="portal-two-column-grid">
          ${renderCard({
            title: "Integration support",
            description:
              "Use this path if your API setup, environment, corridors, or credentials are blocked.",
            body: `
              <div class="portal-detail-list">
                <div>
                  <span>Best first step</span>
                  <strong>Open Developer Docs and confirm your current integration step.</strong>
                </div>

                <div>
                  <span>Include</span>
                  <strong>Organization, application, environment, and error details.</strong>
                </div>

                <div>
                  <span>Response</span>
                  <strong>UniBridge support will review blocked partner workflows.</strong>
                </div>
              </div>

              <div class="portal-form-actions">
                <a class="portal-primary-link" href="#developer-docs">
                  Open Developer Docs
                </a>
              </div>
            `
          })}

          ${renderCard({
            title: "Operational status",
            description:
              "Current portal status for partner onboarding and pilot workflows.",
            body: `
              <div class="portal-detail-list">
                <div>
                  <span>Portal</span>
                  <strong>Operational</strong>
                </div>

                <div>
                  <span>Pilot access</span>
                  <strong>Reviewed by UniBridge after onboarding submission.</strong>
                </div>

                <div>
                  <span>Production</span>
                  <strong>Requires KYB approval and go-live review.</strong>
                </div>
              </div>
            `
          })}
        </div>
      </div>
    `;
  }

  const SECTION_RENDERERS = {
    overview: state =>
      overviewView.renderOverview(state),

    onboarding: state =>
      onboardingView.renderOnboarding(state),

    kyb: state =>
      kybView.renderKyb(state),

    pilot: state =>
      pilotAccessView.renderPilotAccess(state),

    corridors: state =>
      corridorsView.renderCorridors(state),

    "api-keys": state =>
      apiKeysView.renderApiKeys(state),

    environments: state =>
      renderEnvironments(state),

    limits: state =>
      renderLimits(state),

    "audit-log": state =>
      renderAuditLog(state),

    "developer-docs": state =>
      developerDocsView.renderDeveloperDocs(state),

    support: () =>
      renderSupport()
  };

  function getActiveSection() {
    if (typeof window === "undefined") {
      return "overview";
    }

    const hash =
      String(window.location.hash || "")
        .replace(/^#/, "")
        .trim();

    return SECTION_RENDERERS[hash]
      ? hash
      : "overview";
  }

  function renderError(state) {
    if (!state.error) {
      return "";
    }

    return renderCard({
      title: "Error",
      className: "error-card",
      body: `
        <p>${text(state.error?.message || "Something went wrong.")}</p>
      `
    });
  }

  function renderNotice(portalNotice) {
    if (!portalNotice) {
      return "";
    }

    return renderCard({
      title: "Check your email",
      body: `
        <p>${text(portalNotice)}</p>
      `
    });
  }

  function renderSecret(state) {
    if (!state.one_time_secret) {
      return "";
    }

    return renderCard({
      title: "One-time API secret",
      description:
        "Copy this now. It will not be shown again.",
      className: "secret-box",
      body: `
        <code class="secret-code">${text(state.one_time_secret)}</code>

        <div class="portal-form-actions">
          <button
            id="copy-secret"
            class="portal-secondary-button"
            type="button"
          >
            Copy
          </button>

          <button
            id="clear-secret"
            class="portal-secondary-button"
            type="button"
          >
            Clear
          </button>
        </div>
      `
    });
  }

  function renderSystemMessages({
    state,
    portalNotice
  }) {
    return `
      ${renderError(state)}
      ${renderNotice(portalNotice)}
      ${renderSecret(state)}
    `;
  }

  function renderActiveContent({
    state,
    activeSection
  }) {
    const renderSection =
      SECTION_RENDERERS[activeSection] ||
      SECTION_RENDERERS.overview;

    return `
      <section
        id="${text(activeSection)}"
        class="portal-section-anchor"
      >
        ${renderSection(state)}
      </section>
    `;
  }

  function renderPortalContent({
    state,
    portalNotice,
    activeSection
  }) {
    return `
      ${renderSystemMessages({
        state,
        portalNotice
      })}

      ${renderActiveContent({
        state,
        activeSection
      })}
    `;
  }

  function renderPortal({
    state,
    portalNotice
  }) {
    const activeSection =
      getActiveSection();

    return layout.renderShell({
      state,
      activeSection,
      content: renderPortalContent({
        state,
        portalNotice,
        activeSection
      })
    });
  }

  return {
    renderPortal
  };
}
