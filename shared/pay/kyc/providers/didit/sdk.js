// shared/pay/kyc/providers/didit/sdk.js

const DIDIT_SDK_VERSION =
  "0.2.1";

const DIDIT_SDK_SRC =
  `https://unpkg.com/@didit-protocol/sdk-web@${DIDIT_SDK_VERSION}/dist/didit-sdk.umd.min.js`;

const DIDIT_SDK_LOAD_TIMEOUT_MS =
  10000;

const DIDIT_SCRIPT_ATTRIBUTE =
  "data-unibridge-didit-sdk";

const DIDIT_CONFIGURATION =
  Object.freeze({
    loggingEnabled:
      false,

    closeModalOnComplete:
      false,

    showCloseButton:
      true,

    showExitConfirmation:
      true,

    zIndex:
      99999
  });

let diditSdkLoadingPromise =
  null;


function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}


function requireBrowserEnvironment() {
  if (
    typeof window ===
      "undefined" ||
    typeof document ===
      "undefined"
  ) {
    throw new Error(
      "didit_sdk_browser_required"
    );
  }
}


function getDiditSdk() {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  return (
    window.DiditSDK?.DiditSdk ||
    window.DiditSdk ||
    null
  );
}


function findExistingDiditScript() {
  return (
    document.querySelector(
      `script[${DIDIT_SCRIPT_ATTRIBUTE}="true"]`
    ) ||
    null
  );
}


function removeManagedDiditScript(
  script
) {
  if (
    !script ||
    typeof script.getAttribute !==
      "function"
  ) {
    return;
  }

  if (
    script.getAttribute(
      DIDIT_SCRIPT_ATTRIBUTE
    ) === "true"
  ) {
    script.remove();
  }
}


function waitForDiditSdk(
  script
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      let settled =
        false;

      let timeoutId =
        null;

      const cleanup =
        () => {
          if (timeoutId) {
            window.clearTimeout(
              timeoutId
            );

            timeoutId =
              null;
          }

          script.removeEventListener(
            "load",
            handleLoad
          );

          script.removeEventListener(
            "error",
            handleError
          );
        };

      const settle =
        (
          callback,
          value
        ) => {
          if (settled) {
            return;
          }

          settled =
            true;

          cleanup();
          callback(value);
        };

      const resolveWhenReady =
        () => {
          const sdk =
            getDiditSdk();

          if (!sdk) {
            return false;
          }

          settle(
            resolve,
            sdk
          );

          return true;
        };

      function handleLoad() {
        if (!resolveWhenReady()) {
          settle(
            reject,
            new Error(
              "didit_sdk_not_available"
            )
          );
        }
      }

      function handleError() {
        settle(
          reject,
          new Error(
            "didit_sdk_load_failed"
          )
        );
      }

      if (resolveWhenReady()) {
        return;
      }

      script.addEventListener(
        "load",
        handleLoad,
        { once: true }
      );

      script.addEventListener(
        "error",
        handleError,
        { once: true }
      );

      timeoutId =
        window.setTimeout(
          () => {
            if (!resolveWhenReady()) {
              settle(
                reject,
                new Error(
                  "didit_sdk_load_timeout"
                )
              );
            }
          },
          DIDIT_SDK_LOAD_TIMEOUT_MS
        );
    }
  );
}


export function loadDiditSdk() {
  requireBrowserEnvironment();

  const existing =
    getDiditSdk();

  if (existing) {
    return Promise.resolve(
      existing
    );
  }

  if (diditSdkLoadingPromise) {
    return diditSdkLoadingPromise;
  }

  const existingScript =
    findExistingDiditScript();

  const script =
    existingScript ||
    document.createElement(
      "script"
    );

  if (!existingScript) {
    script.src =
      DIDIT_SDK_SRC;

    script.async =
      true;

    script.setAttribute(
      DIDIT_SCRIPT_ATTRIBUTE,
      "true"
    );

    document.head.appendChild(
      script
    );
  }

  diditSdkLoadingPromise =
    waitForDiditSdk(
      script
    ).catch(
      (error) => {
        diditSdkLoadingPromise =
          null;

        removeManagedDiditScript(
          script
        );

        throw error;
      }
    );

  return diditSdkLoadingPromise;
}


export async function startDiditVerification({
  url,
  onComplete,
  onStateChange
} = {}) {
  const normalizedUrl =
    normalizeString(
      url
    );

  if (!normalizedUrl) {
    throw new Error(
      "missing_kyc_verification_url"
    );
  }

  const DiditSdk =
    await loadDiditSdk();

  const shared =
    DiditSdk?.shared;

  if (
    !shared ||
    typeof shared.startVerification !==
      "function"
  ) {
    throw new Error(
      "didit_sdk_not_available"
    );
  }

  shared.onComplete =
    typeof onComplete ===
      "function"
      ? onComplete
      : () => {};

  shared.onStateChange =
    typeof onStateChange ===
      "function"
      ? onStateChange
      : () => {};

  shared.startVerification({
    url:
      normalizedUrl,

    configuration: {
      ...DIDIT_CONFIGURATION
    }
  });

  return true;
}
