(function () {
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
})();
