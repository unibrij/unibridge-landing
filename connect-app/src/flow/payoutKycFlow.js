// connect-app/src/flow/payoutKycFlow.js

import {
  startDiditVerification
} from "./diditSdk";

export function openPayoutKyc({
  url,
  connectSessionId,
  flowGeneration,

  isFlowCurrent,

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
          await continueAfterKyc(
            null,
            flowGeneration
          );
        }
        catch (err) {
          if (
            !isFlowCurrent(
              flowGeneration
            )
          ) {
            return;
          }

          setIsBusy(
            false
          );

          writeDebug(
            "Unable to continue after verification.",
            {
              connect_session_id:
                connectSessionId,

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
