// surface/js/kyc/surfaceKycFlow.js

import {
  runKycFlow
} from "/shared/pay/kyc/kycFlow.js";

import {
  startDiditVerification
} from "/shared/pay/kyc/providers/didit/sdk.js";

import {
  normalizeDiditResult
} from "/shared/pay/kyc/providers/didit/result.js";

import {
  createSurfaceKycSession,
  reconcileSurfaceKycSession
} from "./surfaceKycApi.js";

function startSurfaceVerification({
  url,
  onComplete,
  onError
} = {}) {
  return startDiditVerification({
    url,

    onComplete,

    onStateChange:
      (state) => {
        const normalizedState =
          String(
            state ||
            ""
          )
            .trim()
            .toLowerCase();

        if (
          normalizedState ===
          "error"
        ) {
          onError?.(
            new Error(
              "didit_verification_error"
            )
          );
        }
      }
  });
}

export async function runSurfaceKycFlow() {
  return runKycFlow({
    createSession:
      createSurfaceKycSession,

    reconcileSession:
      reconcileSurfaceKycSession,

    startVerification:
      startSurfaceVerification,

    normalizeProviderResult:
      normalizeDiditResult
  });
}
