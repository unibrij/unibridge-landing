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
    ["environments", "Environments", "▣"],
    ["limits", "Limits", "▤"],
    ["audit-log", "Audit Log", "≡"],
    ["developer-docs", "Developer Docs", "</>"],
    ["support", "Support", "?"]
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
    return classToken(value, fallback) || fallback;
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
            src="/public/icons/social/unibridge-orbit-lockup-white.png"
            alt="UniBridge"
          />

          <span class="portal-topbar-divider" aria-hidden="true"></span>

          <div class="portal-brand-text">
            <strong>Partner Portal</strong>
          </div>
        </div>

        <nav class="portal-topbar-nav" aria-label="Partner navigation">
          <a href="#developer-docs">▣ Docs</a>
          <a href="#support">♧ Support</a>
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
    activeSection = "overview"
  } = {}) {
    return `
      <aside class="portal-sidebar">
        <div class="portal-sidebar-section">
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
              Our support team is here for you.
            </p>
            <a href="#support">Contact Support</a>
          </div>

          <div class="portal-status-card">
            <span class="portal-status-dot"></span>
            <div>
              <strong>Portal status</strong>
              <small>All systems operational</small>
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
