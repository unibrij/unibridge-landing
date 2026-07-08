// partner-portal/js/views/portalLayoutView.js

export function createPortalLayoutView({
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
    getOrganizationName,
    getApplicationName
  } = shared;

  const NAV_ITEMS = [
    ["overview", "Overview", "⌂"],
    ["onboarding", "Onboarding", "◫"],
    ["kyb", "KYB", "◉"],
    ["pilot", "Pilot Access", "◇"],
    ["corridors", "Corridors", "⌁"],
    ["api-keys", "API Keys", "⚿"],
    ["developer-docs", "Developer Docs", "</>"]
  ];

  function getInitials(value) {
    const words =
      String(value || "Partner")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    return words
      .slice(0, 2)
      .map(word => word[0])
      .join("")
      .toUpperCase() || "P";
  }

  function safeSectionId(value, fallback = "overview") {
    const normalized =
      classToken(value, fallback);

    return normalized || fallback;
  }

  function renderTopbar(state) {
    const organizationName =
      getOrganizationName(state);

    const applicationName =
      getApplicationName(state);

    return `
      <header class="portal-topbar">
        <div class="portal-topbar-brand">
          <img
            class="portal-brand-logo"
            src="/public/icons/social/unibridge-orbit-lockup-dark.png"
            alt="UniBridge"
          />

          <div class="portal-brand-text">
            <strong>Partner Portal</strong>
            <span>UniBridge</span>
          </div>
        </div>

        <nav class="portal-topbar-nav" aria-label="Partner navigation">
          <a href="#developer-docs">Developer Docs</a>
        </nav>

        <div class="portal-topbar-actions">
          <button
            id="refresh-portal"
            class="portal-icon-button"
            type="button"
            title="Refresh portal"
            aria-label="Refresh portal"
          >
            ↻
          </button>

          <div class="portal-org-switcher">
            <span>${text(organizationName)}</span>
            <small>${text(applicationName)}</small>
          </div>

          <div class="portal-avatar" aria-hidden="true">
            ${text(getInitials(organizationName))}
          </div>
        </div>
      </header>
    `;
  }

  function renderSidebarItem([
    id,
    label,
    icon
  ], activeSection) {
    const sectionId =
      safeSectionId(id);

    const isActive =
      sectionId === safeSectionId(activeSection);

    return `
      <a
        class="portal-sidebar-item ${isActive ? "is-active" : ""}"
        href="#${sectionId}"
        data-portal-section-link="${sectionId}"
      >
        <span class="portal-sidebar-icon">${text(icon)}</span>
        <span>${text(label)}</span>
      </a>
    `;
  }

  function renderSidebar({
    state,
    activeSection = "overview"
  }) {
    const organizationName =
      getOrganizationName(state);

    const organizationId =
      state.organization?.id || "not_created";

    return `
      <aside class="portal-sidebar">
        <div class="portal-sidebar-section">
          <span class="portal-sidebar-label">Console</span>

          <nav class="portal-sidebar-nav" aria-label="Partner portal sections">
            ${NAV_ITEMS
              .map(item => renderSidebarItem(item, activeSection))
              .join("")}
          </nav>
        </div>

        <div class="portal-sidebar-footer">
          <div class="portal-help-card">
            <strong>Need help?</strong>
            <p>
              Review the integration guide if your setup is blocked.
            </p>
            <a href="#developer-docs">Open docs</a>
          </div>

          <div class="portal-status-card">
            <span class="portal-status-dot"></span>
            <div>
              <strong>${text(organizationName)}</strong>
              <small>${text(organizationId)}</small>
            </div>
          </div>
        </div>
      </aside>
    `;
  }

  function renderShell({
    state,
    activeSection = "overview",
    content = ""
  }) {
    const safeActiveSection =
      safeSectionId(activeSection);

    return `
      <div class="portal-console" data-active-section="${safeActiveSection}">
        ${renderTopbar(state)}

        <div class="portal-console-body">
          ${renderSidebar({
            state,
            activeSection: safeActiveSection
          })}

          <main class="portal-main-content">
            ${content}
          </main>
        </div>
      </div>
    `;
  }

  return {
    renderShell,
    renderTopbar,
    renderSidebar
  };
}
