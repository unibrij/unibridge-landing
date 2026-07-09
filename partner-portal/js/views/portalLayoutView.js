// partner-portal/js/views/portalLayoutView.js

export function createPortalLayoutView({ shared } = {}) {
  if (!shared) {
    throw new Error("Shared portal view dependency is required.");
  }

  const {
    text,
    classToken,
    getOrganizationName,
    getApplicationName
  } = shared;

  const icon = {
    overview: `<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/><path d="M9 20v-6h6v6"/></svg>`,
    onboarding: `<svg viewBox="0 0 24 24"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>`,
    kyb: `<svg viewBox="0 0 24 24"><path d="M12 3 20 7v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4Z"/><path d="m9 12 2 2 4-4"/></svg>`,
    pilot: `<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-8 0v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    corridors: `<svg viewBox="0 0 24 24"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><circle cx="12" cy="6" r="2"/><path d="M8 17 11 8"/><path d="m13 8 3 9"/><path d="M8 18h8"/></svg>`,
    apiKeys: `<svg viewBox="0 0 24 24"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 9-9"/><path d="m16 4 4 4"/><path d="m14 6 4 4"/></svg>`,
    environments: `<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="5" rx="2"/><rect x="4" y="15" width="16" height="5" rx="2"/><path d="M8 9v6"/><path d="M16 9v6"/></svg>`,
    limits: `<svg viewBox="0 0 24 24"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20v-3"/><path d="M2 20h22"/></svg>`,
    audit: `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M9 15h6"/><path d="M9 18h4"/><circle cx="17" cy="17" r="2"/></svg>`,
    docs: `<svg viewBox="0 0 24 24"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg>`,
    support: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4"/><path d="M12 17h.01"/></svg>`,
    refresh: `<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>`,
    book: `<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/></svg>`,
    headset: `<svg viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h4v5H4z"/><path d="M16 14h4v5h-4z"/><path d="M16 19c0 1.5-1.5 2-4 2"/></svg>`
  };

  const NAV_ITEMS = [
    ["overview", "Overview", icon.overview],
    ["onboarding", "Onboarding", icon.onboarding],
    ["kyb", "KYB", icon.kyb],
    ["pilot", "Pilot Access", icon.pilot],
    ["corridors", "Corridors", icon.corridors],
    ["api-keys", "API Keys", icon.apiKeys],
    ["environments", "Environments", icon.environments],
    ["limits", "Limits", icon.limits],
    ["audit-log", "Audit Log", icon.audit],
    ["developer-docs", "Developer Docs", icon.docs],
    ["support", "Support", icon.support]
  ];

  function getInitials(value) {
    const words = String(value || "Partner")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return words.slice(0, 2).map(word => word[0]).join("").toUpperCase() || "P";
  }

  function safeSectionId(value, fallback = "overview") {
    return classToken(value, fallback) || fallback;
  }

  function renderTopbar(state) {
    const organizationName = getOrganizationName(state);
    const applicationName = getApplicationName(state);

    return `
      <header class="portal-topbar">
        <div class="portal-topbar-brand">
          <img
            class="portal-brand-logo"
            src="/icons/social/unibridge-orbit-lockup-white.png"
            alt="UniBridge"
          />

          <span class="portal-topbar-divider" aria-hidden="true"></span>

          <div class="portal-brand-text">
            <strong>Partner Portal</strong>
          </div>
        </div>

        <nav class="portal-topbar-nav" aria-label="Partner navigation">
          <a href="#developer-docs">
            <span class="portal-topbar-icon" aria-hidden="true">${icon.book}</span>
            Docs
          </a>
          <a href="#support">
            <span class="portal-topbar-icon" aria-hidden="true">${icon.headset}</span>
            Support
          </a>
        </nav>

        <div class="portal-topbar-actions">
          <button
            id="refresh-portal"
            class="portal-icon-button"
            type="button"
            title="Refresh portal"
            aria-label="Refresh portal"
          >
            ${icon.refresh}
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

  function renderSidebarItem([id, label, itemIcon], activeSection) {
    const sectionId = safeSectionId(id);
    const isActive = sectionId === safeSectionId(activeSection);

    return `
      <a
        class="portal-sidebar-item ${isActive ? "is-active" : ""}"
        href="#${sectionId}"
        data-portal-section-link="${sectionId}"
      >
        <span class="portal-sidebar-icon" aria-hidden="true">${itemIcon}</span>
        <span>${text(label)}</span>
      </a>
    `;
  }

  function renderSidebar({ activeSection = "overview" } = {}) {
    return `
      <aside class="portal-sidebar">
        <div class="portal-sidebar-section">
          <nav class="portal-sidebar-nav" aria-label="Partner portal sections">
            ${NAV_ITEMS.map(item => renderSidebarItem(item, activeSection)).join("")}
          </nav>
        </div>

        <div class="portal-sidebar-footer">
          <div class="portal-help-card">
            <strong>Need help?</strong>
            <p>Our support team is here for you.</p>
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
    const safeActiveSection = safeSectionId(activeSection);

    return `
      <div class="portal-console" data-active-section="${safeActiveSection}">
        ${renderTopbar(state)}

        <div class="portal-console-body">
          ${renderSidebar({ activeSection: safeActiveSection })}

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
