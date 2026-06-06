// fiat/bank-transfer/js/diditSdk.js

const DIDIT_SDK_SRC =
  "https://unpkg.com/@didit-protocol/sdk-web/dist/didit-sdk.umd.min.js";

let diditSdkLoadingPromise = null;

function normalizeString(value) {
  return String(value || "").trim();
}

function getDiditSdk() {
  return (
    window.DiditSDK?.DiditSdk ||
    window.DiditSdk ||
    null
  );
}

export function loadDiditSdk() {
  const existing =
    getDiditSdk();

  if (existing) {
    return Promise.resolve(existing);
  }

  if (diditSdkLoadingPromise) {
    return diditSdkLoadingPromise;
  }

  diditSdkLoadingPromise =
    new Promise((resolve, reject) => {
      const resolveWhenReady =
        () => {
          const sdk =
            getDiditSdk();

          if (sdk) {
            resolve(sdk);
            return true;
          }

          return false;
        };

      const existingScript =
        document.querySelector(
          `script[src="${DIDIT_SDK_SRC}"]`
        );

      if (existingScript) {
        if (resolveWhenReady()) {
          return;
        }

        existingScript.addEventListener(
          "load",
          () => {
            if (!resolveWhenReady()) {
              reject(
                new Error("didit_sdk_not_available")
              );
            }
          },
          { once: true }
        );

        existingScript.addEventListener(
          "error",
          () => {
            reject(
              new Error("didit_sdk_load_failed")
            );
          },
          { once: true }
        );

        window.setTimeout(
          () => {
            if (!resolveWhenReady()) {
              reject(
                new Error("didit_sdk_not_available")
              );
            }
          },
          3000
        );

        return;
      }

      const script =
        document.createElement("script");

      script.src =
        DIDIT_SDK_SRC;

      script.async =
        true;

      script.onload =
        () => {
          if (!resolveWhenReady()) {
            reject(
              new Error("didit_sdk_not_available")
            );
          }
        };

      script.onerror =
        () => {
          reject(
            new Error("didit_sdk_load_failed")
          );
        };

      document.head.appendChild(
        script
      );
    });

  diditSdkLoadingPromise =
    diditSdkLoadingPromise.catch((err) => {
      diditSdkLoadingPromise =
        null;

      throw err;
    });

  return diditSdkLoadingPromise;
}

export async function startDiditVerification({
  url,
  onComplete,
  onStateChange
} = {}) {
  const normalized =
    normalizeString(url);

  if (!normalized) {
    throw new Error("missing_kyc_redirect_url");
  }

  const DiditSdk =
    await loadDiditSdk();

  DiditSdk.shared.onComplete =
    typeof onComplete === "function"
      ? onComplete
      : () => {};

  DiditSdk.shared.onStateChange =
    typeof onStateChange === "function"
      ? onStateChange
      : () => {};

  DiditSdk.shared.startVerification({
    url:
      normalized,

    configuration: {
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
    }
  });

  return true;
}
