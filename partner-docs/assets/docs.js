(function () {
  /*
  --------------------------------------------------
  Active navigation + mobile sidebar
  --------------------------------------------------
  */

  function normalizePath(pathname) {
    let path = pathname.replace(/\/+$/, "");

    if (path.endsWith("/index.html")) {
      path = path.slice(0, -"/index.html".length);
    }

    return path || "/";
  }

  const currentPath = normalizePath(window.location.pathname);
  const links = document.querySelectorAll(".nav-link");

  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;

    const absolute = new URL(href, window.location.href);
    const linkPath = normalizePath(absolute.pathname);

    if (linkPath === currentPath) {
      link.classList.add("active");
    }
  });

  const menuButton = document.querySelector("[data-menu-button]");

  if (menuButton) {
    menuButton.setAttribute("aria-expanded", "false");

    menuButton.addEventListener("click", () => {
      const isOpen = document.body.classList.toggle("sidebar-open");
      menuButton.setAttribute("aria-expanded", String(isOpen));
    });
  }

  document.querySelectorAll(".docs-sidebar a").forEach((link) => {
    link.addEventListener("click", () => {
      document.body.classList.remove("sidebar-open");

      if (menuButton) {
        menuButton.setAttribute("aria-expanded", "false");
      }
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      document.body.classList.remove("sidebar-open");

      if (menuButton) {
        menuButton.setAttribute("aria-expanded", "false");
      }
    }
  });

  /*
  --------------------------------------------------
  Lightweight code highlighting
  --------------------------------------------------
  */

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function findCommentStart(line) {
    let inString = false;
    let escaped = false;

    for (let i = 0; i < line.length - 1; i += 1) {
      const char = line[i];
      const next = line[i + 1];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString && char === "/" && next === "/") {
        return i;
      }
    }

    return -1;
  }

  function isPlaceholder(value) {
    return /^(sess_|sett_|route_|fund_|exec_|tx_|quote_|0x[a-fA-F0-9]{8,}|recipient@example\.com|provider\.example\.com)/.test(
      value
    );
  }

  function highlightCodeSegment(segment) {
    let html = escapeHtml(segment);

    // Angle-bracket placeholders, e.g. <partner_id>, <computed_hmac_signature>
    html = html.replace(
      /(&lt;[a-zA-Z0-9_./:-]+&gt;)/g,
      '<span class="code-placeholder">$1</span>'
    );

    // HTTP methods
    html = html.replace(
      /\b(GET|POST|PUT|PATCH|DELETE)\b/g,
      '<span class="code-method">$1</span>'
    );

    // API paths
    html = html.replace(
      /(\/v[0-9]+\/[a-zA-Z0-9/_-]+)/g,
      '<span class="code-path">$1</span>'
    );

    // JSON keys
    html = html.replace(
      /"([^"\\]*(?:\\.[^"\\]*)*)"(\s*:)/g,
      '<span class="code-key">"$1"</span>$2'
    );

    // String values
    html = html.replace(
      /(:\s*)"([^"\\]*(?:\\.[^"\\]*)*)"/g,
      function (_, prefix, value) {
        if (/^https?:\/\//.test(value)) {
          return prefix + '<span class="code-url">"' + value + '"</span>';
        }

        if (isPlaceholder(value)) {
          return prefix + '<span class="code-placeholder">"' + value + '"</span>';
        }

        return prefix + '<span class="code-string">"' + value + '"</span>';
      }
    );

    // Numbers
    html = html.replace(
      /(:\s*)(-?\d+(\.\d+)?)/g,
      '$1<span class="code-number">$2</span>'
    );

    // null / booleans
    html = html.replace(
      /\b(null|true|false)\b/g,
      '<span class="code-null">$1</span>'
    );

    return html;
  }

  function highlightLine(line) {
    const commentStart = findCommentStart(line);

    if (commentStart === -1) {
      return highlightCodeSegment(line);
    }

    const beforeComment = line.slice(0, commentStart);
    const comment = line.slice(commentStart);

    return (
      highlightCodeSegment(beforeComment) +
      '<span class="code-comment">' +
      escapeHtml(comment) +
      "</span>"
    );
  }

  document.querySelectorAll("pre").forEach((pre) => {
    if (pre.dataset.highlighted === "true") return;

    const code = pre.querySelector("code");
    const target = code || pre;
    const raw = target.textContent || "";

    target.innerHTML = raw
      .split("\n")
      .map(highlightLine)
      .join("\n");

    pre.dataset.highlighted = "true";
  });
})();
