// connect-app/src/hooks/useRepeatPayoutFlow.js

import {
  useEffect
} from "react";

import {
  getRouteById
} from "../routes";

import {
  getRepeatPayoutSource
} from "../api";

import {
  buildEmptyForm
} from "../flow/routes";


export default function useRepeatPayoutFlow({
  repeatInitializedRef,

  repeatSourceFromUrl,
  repeatRouteIdFromUrl,
  repeatAccessToken,

  routes,
  setSelectedRouteId,

  setRepeatSourcePayoutIntentId,

  payoutIntentIdStateRef,
  setPayoutIntentId,

  resetPayoutAttemptLifecycle,

  setSettlement,
  setFundingTxHash,
  setForm,
  setIsBusy,

  writeDebug
}) {
  useEffect(() => {
    if (
      repeatInitializedRef.current ||
      !repeatSourceFromUrl ||
      !repeatAccessToken
    ) {
      return;
    }

    let cancelled =
      false;

    async function initializeRepeat() {
      try {
        setIsBusy(
          true
        );

        writeDebug(
          "Preparing repeat payout..."
        );

        const source =
          await getRepeatPayoutSource({
            sourcePayoutIntentId:
              repeatSourceFromUrl,

            accessToken:
              repeatAccessToken
          });

        if (cancelled) {
          return;
        }

        const sourceRouteId =
          String(
            source?.route_id ||
            repeatRouteIdFromUrl ||
            ""
          ).trim();

        const repeatRoute =
          getRouteById(
            sourceRouteId,
            routes
          );

        /*
         * Route discovery may still be replacing the
         * bundled catalog.
         *
         * Leave initialization open so this effect
         * can run again when routes become available.
         */
        if (!repeatRoute) {
          writeDebug(
            "Repeat payout route is unavailable.",
            {
              route_id:
                sourceRouteId ||
                null
            }
          );

          return;
        }

        const emptyForm =
          buildEmptyForm(
            repeatRoute
          );

        repeatInitializedRef.current =
          true;

        setRepeatSourcePayoutIntentId(
          repeatSourceFromUrl
        );

        setSelectedRouteId(
          repeatRoute.id
        );

        payoutIntentIdStateRef.current =
          null;

        setPayoutIntentId(
          null
        );

        resetPayoutAttemptLifecycle();

        setSettlement(
          null
        );

        setFundingTxHash(
          null
        );

        setForm({
          ...emptyForm,

          amount:
            source?.amount !==
              undefined &&
            source?.amount !==
              null
              ? String(
                  source.amount
                )
              : "",

          asset:
            String(
              source?.asset ||
              emptyForm?.asset ||
              repeatRoute
                ?.assets
                ?.[0] ||
              "USDT"
            ).trim(),

          beneficiary: {
            ...(
              emptyForm
                ?.beneficiary ||
              {}
            ),

            ...(
              source
                ?.beneficiary &&
              typeof source
                .beneficiary ===
                "object" &&
              !Array.isArray(
                source
                  .beneficiary
              )
                ? source
                    .beneficiary
                : {}
            )
          }
        });

        writeDebug(
          "Repeat payout ready.",
          {
            source_payout_intent_id:
              repeatSourceFromUrl,

            route_id:
              repeatRoute.id
          }
        );
      }
      catch (
        err
      ) {
        if (cancelled) {
          return;
        }

        writeDebug(
          "Unable to prepare repeat payout.",
          {
            error:
              err?.message ||
              "get_repeat_payout_source_failed"
          }
        );
      }
      finally {
        if (!cancelled) {
          setIsBusy(
            false
          );
        }
      }
    }

    initializeRepeat();

    return () => {
      cancelled =
        true;
    };
  }, [
    payoutIntentIdStateRef,
    repeatAccessToken,
    repeatInitializedRef,
    repeatRouteIdFromUrl,
    repeatSourceFromUrl,
    resetPayoutAttemptLifecycle,
    routes,
    setFundingTxHash,
    setForm,
    setIsBusy,
    setPayoutIntentId,
    setRepeatSourcePayoutIntentId,
    setSelectedRouteId,
    setSettlement,
    writeDebug
  ]);
}
