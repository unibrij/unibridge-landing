// unibrij/unibridge-landing/surface/pwa-install.js

export function setupSurfacePwaInstall({
  setStatus,
  buttonId = "installPwaBtn"
} = {}) {
  const installPwaBtn =
    document.getElementById(buttonId);

  let installPrompt = null;
  let canInstallPwa = false;
  let isStandalonePwa = false;
  let installPwaUnlocked = false;

  function refreshInstallPwaButton() {
    if (!installPwaBtn) {
      return;
    }

    const shouldShow =
      installPwaUnlocked &&
      canInstallPwa &&
      !isStandalonePwa;

    installPwaBtn.classList.toggle(
      "hidden",
      !shouldShow
    );
  }

  function unlockInstallPwaButton() {
    installPwaUnlocked = true;
    refreshInstallPwaButton();
  }

  function registerRootServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const register = () => {
      navigator.serviceWorker
        .register("/service-worker.js", {
          scope: "/"
        })
        .catch(() => {});
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, {
        once: true
      });
    }
  }

  function setupInstallPrompt() {
    isStandalonePwa =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    refreshInstallPwaButton();

    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();

      installPrompt = event;
      canInstallPwa = true;

      refreshInstallPwaButton();
    });

    window.addEventListener("appinstalled", () => {
      installPrompt = null;
      canInstallPwa = false;
      isStandalonePwa = true;

      refreshInstallPwaButton();

      setStatus?.("UniBridge saved.", "info");
    });

    window.addEventListener("unibridge:quote", unlockInstallPwaButton);
    window.addEventListener("unibridge:payment", unlockInstallPwaButton);
    window.addEventListener("unibridge:done", unlockInstallPwaButton);

    installPwaBtn?.addEventListener("click", async () => {
      if (!installPrompt) {
        setStatus?.(
          "Use your browser menu and choose Add to Home Screen.",
          "info"
        );
        return;
      }

      installPrompt.prompt();

      const choice =
        await installPrompt.userChoice;

      installPrompt = null;
      canInstallPwa = false;

      refreshInstallPwaButton();

      setStatus?.(
        choice?.outcome === "accepted"
          ? "UniBridge saved."
          : "Install prompt closed.",
        "info"
      );
    });
  }

  registerRootServiceWorker();
  setupInstallPrompt();
}
