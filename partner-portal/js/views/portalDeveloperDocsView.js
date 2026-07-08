// partner-portal/js/views/portalDeveloperDocsView.js

import {
  renderIntegrationGuidePanel
} from "../partnerExecutionGuideView.js";

export function createPortalDeveloperDocsView({
  shared
} = {}) {
  if (!shared) {
    throw new Error(
      "Shared portal view dependency is required."
    );
  }

  const {
    renderCard,
    renderPageHeader,
    renderEmptyState
  } = shared;

  function hasApplication(state) {
    return Boolean(state.application);
  }

  function renderQuickLinks() {
    return renderCard({
      title: "Developer resources",
      description:
        "Everything required to integrate with the UniBridge Partner API.",
      className: "developer-docs-links-card",
      body: `
        <div class="portal-detail-list">

          <div>
            <span>Execution guide</span>
            <strong>Authentication, sessions, quotes, settlements, funding.</strong>
          </div>

          <div>
            <span>API examples</span>
            <strong>cURL requests and responses.</strong>
          </div>

          <div>
            <span>Error handling</span>
            <strong>Status codes and integration guidance.</strong>
          </div>

          <div>
            <span>Production checklist</span>
            <strong>Go-live readiness requirements.</strong>
          </div>

        </div>
      `
    });
  }

  function renderDeveloperDocs(state) {
    if (!hasApplication(state)) {
      return `
        <div class="portal-developer-docs-page">

          ${renderPageHeader({
            eyebrow: "Developer Docs",
            title: "Integration guide",
            description:
              "Create an application before accessing integration resources."
          })}

          ${renderEmptyState({
            title: "No application available",
            description:
              "Developer documentation becomes available after an application has been created."
          })}

        </div>
      `;
    }

    return `
      <div class="portal-developer-docs-page">

        ${renderPageHeader({
          eyebrow: "Developer Docs",
          title: "Integration guide",
          description:
            "Reference documentation for integrating with the UniBridge Partner API."
        })}

        ${renderQuickLinks()}

        ${renderIntegrationGuidePanel({
          state
        })}

      </div>
    `;
  }

  return {
    renderDeveloperDocs,
    renderQuickLinks
  };
}
