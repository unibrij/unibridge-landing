// partner-portal/js/views/portalOverviewView.js

import {
  getApprovedPilotCorridors,
  getPortalStep,
  getPilotEnvironment
} from "../integrationPortalState.js";

export function createPortalOverviewView({
  shared
} = {}) {
  if (!shared) {
    throw new Error(
      "Shared portal view dependency is required."
    );
  }

  const {
    text,
    classToken,
    humanize,
    displayStatus,
    renderBadge,
    renderCard,
    renderMetricCard,
    renderPageHeader,
    renderTimelineItem,
    renderTable,
    getOrganizationName,
    formatCount
  } = shared;

  const JOURNEY_STEPS = [
    ["questionnaire", "Questionnaire"],
    ["kyb", "KYB"],
    ["pilot", "Pilot Access"],
    ["api_keys", "API Keys"],
    ["go_live", "Go Live"]
  ];

  function getKybStatus(state) {
    return (
      state.organization?.kyb_status ||
      state.kyb?.status ||
      "not_started"
    );
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

  function getCurrentStepCopy(step) {
    const normalized =
      String(step || "").toLowerCase();

    if (
      normalized.includes("production") ||
      normalized.includes("go")
    ) {
      return {
        title: "Go Live review",
        description:
          "Live access is reviewed after pilot validation and KYB approval.",
        cta: "Review pilot access",
        href: "#pilot"
      };
    }

    if (normalized.includes("api")) {
      return {
        title: "Issue pilot API key",
        description:
          "Create a pilot key once pilot access and corridors are approved.",
        cta: "Go to API keys",
        href: "#api-keys"
      };
    }

    if (normalized.includes("pilot")) {
      return {
        title: "Pilot access review",
        description:
          "UniBridge is reviewing pilot access, approved corridors, and limits.",
        cta: "View pilot access",
        href: "#pilot"
      };
    }

    if (normalized.includes("kyb")) {
      return {
        title: "KYB review",
        description:
          "Submit KYB to unlock pilot API key issuance and continue toward go-live.",
        cta: "Open KYB",
        href: "#kyb"
      };
    }

    return {
      title: "Complete onboarding",
      description:
        "Submit your onboarding questionnaire so UniBridge can review your use case and requested corridors.",
      cta: "Open onboarding",
      href: "#onboarding"
    };
  }

  function getStepState(index, currentIndex) {
    if (index < currentIndex) {
      return "completed";
    }

    if (index === currentIndex) {
      return "current";
    }

    return "locked";
  }

  function getCurrentJourneyIndex(step) {
    const normalized =
      String(step || "").toLowerCase();

    if (
      normalized.includes("production") ||
      normalized.includes("go")
    ) {
      return 4;
    }

    if (normalized.includes("api")) {
      return 3;
    }

    if (normalized.includes("pilot")) {
      return 2;
    }

    if (normalized.includes("kyb")) {
      return 1;
    }

    return 0;
  }

  function renderStepper(state) {
    const currentIndex =
      getCurrentJourneyIndex(getPortalStep(state));

    return `
      <section class="overview-stepper overview-progress-stepper" aria-label="Integration progress">
        ${JOURNEY_STEPS.map(([id, label], index) => {
          const stepState =
            getStepState(index, currentIndex);

          return `
            <div
              class="overview-step overview-step-${classToken(stepState)}"
              data-step-id="${classToken(id)}"
            >
              <div class="overview-step-marker">
                ${
                  stepState === "completed"
                    ? "✓"
                    : index + 1
                }
              </div>

              <div class="overview-step-copy">
                <strong>${text(label)}</strong>
                <span>${text(humanize(stepState))}</span>
              </div>
            </div>
          `;
        }).join("")}
      </section>
    `;
  }

  function renderHero(state) {
    const step =
      getPortalStep(state);

    const copy =
      getCurrentStepCopy(step);

    return `
      <section class="overview-hero-card">
        <div class="overview-hero-content">
          <span class="portal-eyebrow">Current step</span>
          <h2>${text(copy.title)}</h2>
          <p>${text(copy.description)}</p>

          <div class="overview-hero-actions">
            <a class="portal-primary-link" href="${text(copy.href)}">
              ${text(copy.cta)}
            </a>
            ${renderBadge(step)}
          </div>
        </div>

        <div class="overview-hero-visual" aria-hidden="true">
          <div class="overview-orbit-card">
            <span></span>
            <strong>Partner API</strong>
            <small>Pilot access · KYB · Corridors</small>
          </div>
        </div>
      </section>
    `;
  }

  function renderHelpCard() {
    return renderCard({
      title: "Need help?",
      description:
        "Use the developer docs for API examples and integration guidance.",
      className: "overview-help-card",
      body: `
        <div class="overview-help-actions">
          <a href="#developer-docs">Developer Docs</a>
        </div>
      `
    });
  }

  function renderMetrics(state) {
    const approvedCorridors =
      getApprovedPilotCorridors(state);

    const pilotEnvironment =
      getPilotEnvironment(state);

    return `
      <section class="overview-metric-grid">
        ${renderMetricCard({
          icon: "◇",
          label: "Pilot status",
          value: displayStatus(getPilotStatus(state)),
          detail: pilotEnvironment?.id || "Pilot environment pending",
          badge: renderBadge(getPilotStatus(state))
        })}

        ${renderMetricCard({
          icon: "⌁",
          label: "Approved corridors",
          value: formatCount(approvedCorridors.length),
          detail: approvedCorridors.length
            ? "Ready for pilot testing"
            : "Waiting for corridor approval"
        })}

        ${renderMetricCard({
          icon: "⚿",
          label: "API keys",
          value: formatCount(getCredentialCount(state)),
          detail: "Secrets are never shown again"
        })}

        ${renderMetricCard({
          icon: "▣",
          label: "Environments",
          value: formatCount(getEnvironmentCount(state)),
          detail: pilotEnvironment?.id || "No environment available yet"
        })}
      </section>
    `;
  }

  function renderJourneyTimeline(state) {
    const hasOrganization =
      Boolean(state.organization);

    const hasQuestionnaire =
      (
        state.organization?.onboarding_profile?.status ||
        state.organization?.onboarding_status
      ) === "submitted";

    const kybStatus =
      getKybStatus(state);

    const pilotStatus =
      getPilotStatus(state);

    const hasKeys =
      getCredentialCount(state) > 0;

    return renderCard({
      title: "Integration journey",
      description: "A high-level timeline of your partner setup.",
      className: "overview-journey-card",
      body: `
        <div class="portal-timeline">
          ${renderTimelineItem({
            title: "Organization created",
            description: hasOrganization
              ? getOrganizationName(state)
              : "Create your partner organization.",
            status: hasOrganization ? "completed" : "pending"
          })}

          ${renderTimelineItem({
            title: "Questionnaire submitted",
            description: hasQuestionnaire
              ? "Your onboarding questionnaire was submitted."
              : "Submit your use case and target corridors.",
            status: hasQuestionnaire ? "completed" : "pending"
          })}

          ${renderTimelineItem({
            title: "KYB submitted",
            description: `Current KYB status: ${displayStatus(kybStatus)}.`,
            status: kybStatus
          })}

          ${renderTimelineItem({
            title: "Pilot enabled",
            description: `Pilot status: ${displayStatus(pilotStatus)}.`,
            status: pilotStatus
          })}

          ${renderTimelineItem({
            title: "API key issued",
            description: hasKeys
              ? "At least one pilot API key exists."
              : "Issue a pilot API key after pilot access is ready.",
            status: hasKeys ? "completed" : "locked"
          })}
        </div>
      `
    });
  }

  function renderRecentActivity(state) {
    const auditEvents =
      Array.isArray(state.audit_events)
        ? state.audit_events.slice(0, 5)
        : [];

    if (!auditEvents.length) {
      return renderCard({
        title: "Recent activity",
        description: "Latest portal events and operational changes.",
        className: "overview-activity-card",
        body: `
          <div class="portal-empty-state compact">
            <div class="portal-empty-icon">≡</div>
            <h3>No recent activity</h3>
            <p>Activity will appear here once onboarding actions are recorded.</p>
          </div>
        `
      });
    }

    return renderCard({
      title: "Recent activity",
      description: "Latest portal events and operational changes.",
      className: "overview-activity-card",
      body: `
        <div class="overview-activity-list">
          ${auditEvents.map(event => `
            <div class="overview-activity-item">
              <div>
                <strong>
                  ${text(humanize(event.type || event.action || "Portal event"))}
                </strong>
                <p>
                  ${text(event.message || event.description || event.actor || "Partner portal activity")}
                </p>
              </div>
              <small>
                ${text(event.created_at || event.timestamp || "")}
              </small>
            </div>
          `).join("")}
        </div>
      `
    });
  }

  function renderActiveOperations(state) {
    const operations =
      Array.isArray(state.operations)
        ? state.operations.slice(0, 5)
        : [];

    const rows =
      operations.map(operation => [
        text(operation.id || operation.reference || "Operation"),
        text(humanize(operation.type || operation.kind || "Execution")),
        renderBadge(operation.status || "pending"),
        text(operation.created_at || operation.updated_at || "")
      ]);

    return renderCard({
      title: "Active operations",
      description: "A compact view of recent execution activity.",
      className: "overview-operations-card",
      body: renderTable({
        columns: ["Reference", "Type", "Status", "Updated"],
        rows,
        emptyTitle: "No active operations",
        emptyDescription:
          "Operations will appear here when partner execution activity starts."
      })
    });
  }

  function renderQuickStart() {
    return renderCard({
      title: "Quick start",
      description: "Core execution flow. Full examples live in Developer Docs.",
      className: "overview-quickstart-card",
      body: `
        <ol class="overview-quickstart-list">
          <li>
            <span>1</span>
            <div>
              <strong>Register session</strong>
              <p>Create an execution session for the end user.</p>
            </div>
          </li>

          <li>
            <span>2</span>
            <div>
              <strong>Quote</strong>
              <p>Request pricing and route availability.</p>
            </div>
          </li>

          <li>
            <span>3</span>
            <div>
              <strong>Settlement</strong>
              <p>Create the settlement instruction.</p>
            </div>
          </li>

          <li>
            <span>4</span>
            <div>
              <strong>Funding</strong>
              <p>Fund the transaction and track execution.</p>
            </div>
          </li>
        </ol>

        <a class="portal-primary-link" href="#developer-docs">
          Open Developer Docs →
        </a>
      `
    });
  }

  function renderOverview(state) {
    return `
      <div class="portal-overview-page">
        ${renderPageHeader({
          eyebrow: "Overview",
          title: `Welcome back, ${getOrganizationName(state)}`,
          description:
            "Track your onboarding, KYB, pilot access, corridors, and API readiness."
        })}

        ${renderStepper(state)}

        <div class="overview-top-grid overview-top-grid-single">
  ${renderHero(state)}
</div>

        ${renderMetrics(state)}

        <div class="overview-two-column-grid">
          ${renderJourneyTimeline(state)}
          ${renderRecentActivity(state)}
        </div>

        <div class="overview-bottom-bleed">
          <div class="overview-bottom-grid">
            ${renderActiveOperations(state)}
            ${renderQuickStart()}
          </div>
        </div>
      </div>
    `;
  }

  return {
    renderOverview
  };
}
