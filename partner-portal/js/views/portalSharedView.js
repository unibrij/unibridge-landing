// partner-portal/js/views/portalSharedView.js

export function createPortalSharedView({
  htmlEscape
} = {}) {
  if (typeof htmlEscape !== "function") {
    throw new Error(
      "htmlEscape shared view dependency is required."
    );
  }

  function text(value, fallback = "") {
    const normalized =
      value === null || value === undefined
        ? fallback
        : String(value);

    return htmlEscape(normalized);
  }

  function classToken(value, fallback = "neutral") {
    return String(value || fallback)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
  }

  function humanize(value, fallback = "Not available") {
    const normalized =
      String(value || "").trim();

    if (!normalized) {
      return fallback;
    }

    return normalized
      .replaceAll("_", " ")
      .replaceAll("-", " ")
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, character => character.toUpperCase());
  }

  function statusTone(status) {
    const normalized =
      String(status || "").toLowerCase();

    if (
      normalized.includes("approved") ||
      normalized.includes("enabled") ||
      normalized.includes("completed") ||
      normalized.includes("active") ||
      normalized.includes("submitted") ||
      normalized === "passed"
    ) {
      return "success";
    }

    if (
      normalized.includes("review") ||
      normalized.includes("pending") ||
      normalized.includes("started") ||
      normalized.includes("progress")
    ) {
      return "warning";
    }

    if (
      normalized.includes("rejected") ||
      normalized.includes("failed") ||
      normalized.includes("revoked") ||
      normalized.includes("suspended")
    ) {
      return "danger";
    }

    return "neutral";
  }

  function renderBadge(
    label,
    {
      tone,
      className = ""
    } = {}
  ) {
    const badgeTone =
      tone || statusTone(label);

    return `
      <span class="portal-badge portal-badge-${classToken(badgeTone)} ${classToken(className, "")}">
        ${text(humanize(label))}
      </span>
    `;
  }

  function renderIconBadge(icon, label, options = {}) {
    return `
      <span class="portal-icon-badge">
        <span class="portal-icon-badge-icon">${text(icon)}</span>
        ${renderBadge(label, options)}
      </span>
    `;
  }

  function renderEmptyState({
    title,
    description,
    action = ""
  }) {
    return `
      <div class="portal-empty-state">
        <div class="portal-empty-icon">○</div>
        <h3>${text(title)}</h3>
        <p>${text(description)}</p>
        ${action}
      </div>
    `;
  }

  function renderCard({
    title,
    eyebrow = "",
    description = "",
    className = "",
    actions = "",
    body = ""
  }) {
    return `
      <section class="portal-card ${classToken(className, "")}">
        ${
          eyebrow || title || description || actions
            ? `
              <div class="portal-card-header">
                <div>
                  ${
                    eyebrow
                      ? `<span class="portal-eyebrow">${text(eyebrow)}</span>`
                      : ""
                  }
                  ${
                    title
                      ? `<h2>${text(title)}</h2>`
                      : ""
                  }
                  ${
                    description
                      ? `<p>${text(description)}</p>`
                      : ""
                  }
                </div>
                ${
                  actions
                    ? `<div class="portal-card-actions">${actions}</div>`
                    : ""
                }
              </div>
            `
            : ""
        }
        ${body}
      </section>
    `;
  }

  function renderMetricCard({
    label,
    value,
    detail = "",
    badge = "",
    icon = "·"
  }) {
    return `
      <div class="portal-metric-card">
        <div class="portal-metric-top">
          <span class="portal-metric-icon">${text(icon)}</span>
          ${badge}
        </div>
        <span class="portal-metric-label">${text(label)}</span>
        <strong>${text(value)}</strong>
        ${
          detail
            ? `<p>${text(detail)}</p>`
            : ""
        }
      </div>
    `;
  }

  function renderSectionTitle({
    title,
    description = ""
  }) {
    return `
      <div class="portal-section-title">
        <h2>${text(title)}</h2>
        ${
          description
            ? `<p>${text(description)}</p>`
            : ""
        }
      </div>
    `;
  }

  function renderPageHeader({
    eyebrow = "",
    title,
    description = "",
    actions = ""
  }) {
    return `
      <div class="portal-page-header">
        <div>
          ${
            eyebrow
              ? `<span class="portal-eyebrow">${text(eyebrow)}</span>`
              : ""
          }
          <h1>${text(title)}</h1>
          ${
            description
              ? `<p>${text(description)}</p>`
              : ""
          }
        </div>
        ${
          actions
            ? `<div class="portal-page-actions">${actions}</div>`
            : ""
        }
      </div>
    `;
  }

  function renderTimelineItem({
    title,
    description = "",
    status = "",
    meta = ""
  }) {
    return `
      <div class="portal-timeline-item">
        <span class="portal-timeline-dot portal-timeline-${classToken(statusTone(status || title))}"></span>
        <div>
          <strong>${text(title)}</strong>
          ${
            description
              ? `<p>${text(description)}</p>`
              : ""
          }
          ${
            meta
              ? `<small>${text(meta)}</small>`
              : ""
          }
        </div>
      </div>
    `;
  }

  function renderTable({
    columns = [],
    rows = [],
    emptyTitle = "No records yet",
    emptyDescription = "Nothing to show here yet."
  }) {
    if (!rows.length) {
      return renderEmptyState({
        title: emptyTitle,
        description: emptyDescription
      });
    }

    return `
      <div class="portal-table-wrap">
        <table class="portal-table">
          <thead>
            <tr>
              ${columns.map(column => `
                <th>${text(column)}</th>
              `).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${row.map(cell => `
                  <td>${cell}</td>
                `).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderCodeBlock(code) {
    return `
      <pre class="portal-code-block"><code>${text(code)}</code></pre>
    `;
  }

  function getOrganizationName(state) {
    return (
      state.organization?.name ||
      state.organization?.legal_name ||
      state.organization?.id ||
      "Partner"
    );
  }

  function getApplicationName(state) {
    return (
      state.application?.name ||
      state.application?.id ||
      "Application"
    );
  }

  function formatCount(value) {
    const number =
      Number(value);

    if (!Number.isFinite(number)) {
      return "0";
    }

    return String(number);
  }

  return {
    text,
    classToken,
    humanize,
    statusTone,
    renderBadge,
    renderIconBadge,
    renderEmptyState,
    renderCard,
    renderMetricCard,
    renderSectionTitle,
    renderPageHeader,
    renderTimelineItem,
    renderTable,
    renderCodeBlock,
    getOrganizationName,
    getApplicationName,
    formatCount
  };
}
