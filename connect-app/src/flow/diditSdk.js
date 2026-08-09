// connect-app/src/flow/diditSdk.js

import {
  DiditSdk
} from "@didit-protocol/sdk-web";

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}

export function startDiditVerification({
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

  DiditSdk.shared.onComplete =
    typeof onComplete ===
      "function"
      ? onComplete
      : () => {};

  DiditSdk.shared.onStateChange =
    typeof onStateChange ===
      "function"
      ? onStateChange
      : () => {};

  DiditSdk.shared.startVerification({
    url:
      normalizedUrl,

    configuration: {
      loggingEnabled:
        false,

      closeModalOnComplete:
        true,

      showCloseButton:
        true,

      showExitConfirmation:
        true,

      zIndex:
        99999
    }
  });
}
