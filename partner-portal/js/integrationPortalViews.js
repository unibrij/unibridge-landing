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
    renderCard
  } = shared;

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

    "developer-docs": state =>
      developerDocsView.renderDeveloperDocs(state)
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
