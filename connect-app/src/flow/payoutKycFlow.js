// connect-app/src/flow/payoutKycFlow.js

import {
  startDiditVerification
} from "./diditSdk";

const DIDIT_BACKEND_PROPAGATION_DELAY_MS =
  1500;

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
         * SDK completion replaces the callback-navigation
         * boundary used by the old redirect flow.
         *
         * Keep this flag set until post-KYC continuation
         * succeeds. If the immediate continuation fails,
         * the next Continue must resume after KYC instead
         * of opening another verification session.
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

        /*
         * Preserve the small timing boundary that the
         * old redirect/navigation flow naturally had
         * before post-KYC continuation.
         */
        await wait(
          DIDIT_BACKEND_PROPAGATION_DELAY_MS
        );

        if (
          !isFlowCurrent(
            flowGeneration
          )
        ) {
          return;
        }

        try {
          await continueAfterKyc(
            null,
            flowGeneration
          );

          /*
           * Post-KYC continuation succeeded.
           *
           * The SDK flow no longer needs to emulate
           * the old returned-flow state.
           */
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
           * Intentionally keep
           * kycCompletionPendingRef.current === true.
           *
           * The next Continue will retry the post-KYC
           * path instead of calling startKyc() again.
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
