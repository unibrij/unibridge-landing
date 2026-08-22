// connect-app/src/flow/payoutKycFlow.js

import {
  getKycStatus
} from "../api";

import {
  startDiditVerification
} from "./diditSdk";

const KYC_STATUS_POLL_INTERVAL_MS =
  1000;

const KYC_STATUS_POLL_MAX_ATTEMPTS =
  30;

function wait(
  milliseconds
) {
  return new Promise(
    resolve => {
      window.setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}

async function waitForBackendKycConfirmation({
  connectSessionId,
  flowGeneration,
  isFlowCurrent,
  writeDebug
}) {
  for (
    let attempt = 1;
    attempt <=
      KYC_STATUS_POLL_MAX_ATTEMPTS;
    attempt += 1
  ) {
    if (
      !isFlowCurrent(
        flowGeneration
      )
    ) {
      return null;
    }

    const result =
      await getKycStatus({
        connectSessionId
      });

    const kycStatus =
      String(
        result?.kyc_status ||
        ""
      )
        .trim()
        .toLowerCase();

    writeDebug(
      "Verification backend status checked.",
      {
        connect_session_id:
          connectSessionId,

        kyc_status:
          kycStatus ||
          null,

        attempt
      }
    );

    if (
      kycStatus ===
      "passed"
    ) {
      return result;
    }

    if (
      kycStatus ===
      "failed"
    ) {
      throw new Error(
        "kyc_verification_failed"
      );
    }

    if (
      attempt <
        KYC_STATUS_POLL_MAX_ATTEMPTS
    ) {
      await wait(
        KYC_STATUS_POLL_INTERVAL_MS
      );
    }
  }

  throw new Error(
    "kyc_verification_processing"
  );
}

export function openPayoutKyc({
  url,
  connectSessionId,
  flowGeneration,

  isFlowCurrent,

  kycCompletionPendingRef,

  setIsBusy,

  continueAfterKyc,

  writeDebug
}) {
  startDiditVerification({
    url,

    onStateChange:
      (state, error) => {
        if (
          !isFlowCurrent(
            flowGeneration
          )
        ) {
          return;
        }

        writeDebug(
          "Verification state changed.",
          {
            state:
              state ||
              null,

            error:
              error?.message ||
              error ||
              null
          }
        );

        if (
          state ===
          "error"
        ) {
          setIsBusy(
            false
          );
        }
      },

    onComplete:
      async result => {
        if (
          !isFlowCurrent(
            flowGeneration
          )
        ) {
          return;
        }

        if (
          result?.type ===
          "cancelled"
        ) {
          setIsBusy(
            false
          );

          writeDebug(
            "Verification cancelled.",
            {
              connect_session_id:
                connectSessionId,

              verification_session_id:
                result
                  ?.session
                  ?.sessionId ||
                null
            }
          );

          return;
        }

        if (
          result?.type ===
          "failed"
        ) {
          setIsBusy(
            false
          );

          writeDebug(
            "Verification failed.",
            {
              connect_session_id:
                connectSessionId,

              error_type:
                result
                  ?.error
                  ?.type ||
                null,

              error:
                result
                  ?.error
                  ?.message ||
                null
            }
          );

          return;
        }

        if (
          result?.type !==
          "completed"
        ) {
          setIsBusy(
            false
          );

          return;
        }

        /*
         * Didit SDK completion means the user finished
         * the verification UI.
         *
         * It does NOT guarantee that the backend has
         * already received and persisted the final
         * Didit webhook.
         */
        if (
          kycCompletionPendingRef
        ) {
          kycCompletionPendingRef.current =
            true;
        }

        writeDebug(
          "Verification completed.",
          {
            connect_session_id:
              connectSessionId,

            verification_session_id:
              result
                ?.session
                ?.sessionId ||
              null,

            verification_status:
              result
                ?.session
                ?.status ||
              null
          }
        );

        try {
          /*
           * Wait for server-side KYC confirmation.
           *
           * pending / not_started:
           * keep polling.
           *
           * passed:
           * continue payout flow.
           *
           * failed:
           * stop.
           */
          await waitForBackendKycConfirmation({
            connectSessionId,
            flowGeneration,
            isFlowCurrent,
            writeDebug
          });

          if (
            !isFlowCurrent(
              flowGeneration
            )
          ) {
            return;
          }

          await continueAfterKyc(
            null,
            flowGeneration
          );

          if (
            kycCompletionPendingRef
          ) {
            kycCompletionPendingRef.current =
              false;
          }
        }
        catch (err) {
          if (
            !isFlowCurrent(
              flowGeneration
            )
          ) {
            return;
          }

          /*
           * Keep the flag true.
           *
           * A later Continue retries the post-KYC path
           * instead of starting another Didit session.
           */
          setIsBusy(
            false
          );

          writeDebug(
            "Unable to continue after verification.",
            {
              connect_session_id:
                connectSessionId,

              verification_session_id:
                result
                  ?.session
                  ?.sessionId ||
                null,

              error:
                err?.message ||
                String(
                  err
                )
            }
          );
        }
      }
  });
}

export default openPayoutKyc;
