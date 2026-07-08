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
    classToken
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

  function safeSectionId(value, fallback = "overview") {
    const normalized =
      classToken(value, fallback);

    return normalized || fallback;
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
    activeSection = "overview",
    content = ""
  }) {
    const safeActiveSection =
      safeSectionId(activeSection);

    return `
      <div class="portal-console" data-active-section="${safeActiveSection}">
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
    renderSidebar
  };
}
