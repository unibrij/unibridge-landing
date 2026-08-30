// connect-app/src/hooks/useConnectPayoutActions.js

import {
  useCallback
} from "react";

import {
  storeFlowSnapshot,
  clearStoredFlow
} from "../flow/flowStorage";

import {
  buildEmptyForm
} from "../flow/routes";

import {
  removeQueryParams
} from "../flow/urlState";


function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}


function getRouteId(
  route
) {
  return normalizeString(
    route?.id ||
    route?.route_id
  );
}


function isSelectableRoute(
  route
) {
  if (!route) {
    return false;
  }

  if (
    route?.disabled === true ||
    route?.comingSoon === true ||
    route?.coming_soon === true
  ) {
    return false;
  }

  const status =
    normalizeString(
      route?.status
    ).toLowerCase();

  return !(
    status ===
      "coming_soon" ||
    status ===
      "disabled" ||
    status ===
      "inactive"
  );
}


function findRouteById(
  routes = [],
  routeId
) {
  const normalizedRouteId =
    normalizeString(
      routeId
    );

  if (!normalizedRouteId) {
    return null;
  }

  return (
    routes.find(
      route =>
        getRouteId(
          route
        ) ===
        normalizedRouteId
    ) ||
    null
  );
}


export default function useConnectPayoutActions({
  isReceiveFlow,
  isRepeatFlow,
  isTransferLocked,

  payoutAttemptState,
  payoutIntentId,

  connectSessionId,

  routes,
  selectedRouteId,
  setSelectedRouteId,

  form,
  setForm,

  payoutIntentIdStateRef,
  repeatInitializedRef,

  setPayoutIntentId,
  setRepeatSourcePayoutIntentId,
  setReturnedFlowDismissed,

  setSettlement,
  setFundingTxHash,

  clearReceiveContext,

  resetRouteFlowRuntime,
  resetPayoutAttemptLifecycle,
  resetPricingPreview,
  resetRouteCreatedTracking,
  resetConnectSession,

  writeDebug
}) {
  /*
   * Explicit user action.
   *
   * Detach the frontend from the current payout
   * without mutating or cancelling the old backend
   * attempt.
   *
   * Starting a new payout always clears any stored
   * Receive binding, including a Receive flow that
   * may currently be represented as Returned after
   * KYC / authorization.
   */
  const handleNewPayout =
    useCallback(
      () => {
        clearReceiveContext();

        resetRouteFlowRuntime();

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

        setRepeatSourcePayoutIntentId(
          null
        );

        repeatInitializedRef.current =
          false;

        setReturnedFlowDismissed(
          true
        );

        resetPricingPreview();

        resetRouteCreatedTracking();

        /*
         * Preserve the currently visible route and
         * transfer values as the editable draft for
         * the next normal payout.
         *
         * Receive raw beneficiary data never exists
         * in this frontend flow.
         */
        storeFlowSnapshot({
          connect_session_id:
            connectSessionId,

          payout_intent_id:
            null,

          repeat_source_payout_intent_id:
            null,

          route_id:
            selectedRouteId ||
            null,

          transfer_fingerprint:
            null,

          form,

          pricing_preview:
            null
        });

        removeQueryParams([
          "payout_intent_id",
          "repeat_source_payout_intent_id",
          "route_id"
        ]);

        writeDebug(
          "Ready to start a new payout."
        );
      },
      [
        clearReceiveContext,
        connectSessionId,
        form,
        payoutIntentIdStateRef,
        repeatInitializedRef,
        resetPayoutAttemptLifecycle,
        resetPricingPreview,
        resetRouteCreatedTracking,
        resetRouteFlowRuntime,
        selectedRouteId,
        setFundingTxHash,
        setPayoutIntentId,
        setRepeatSourcePayoutIntentId,
        setReturnedFlowDismissed,
        setSettlement,
        writeDebug
      ]
    );

  /*
   * Guard transfer-spec mutation at the parent
   * boundary.
   */
  const setEditableForm =
    useCallback(
      nextValue => {
        if (
          isTransferLocked
        ) {
          return;
        }

        setForm(
          nextValue
        );
      },
      [
        isTransferLocked,
        setForm
      ]
    );

  /*
   * Browser beneficiary mutation is forbidden for
   * Repeat and Receive.
   *
   * Repeat beneficiary comes from Core.
   * Receive beneficiary is resolved server-side from
   * receive_profile_id.
   */
  const updateBeneficiaryField =
    useCallback(
      (
        name,
        value
      ) => {
        if (
          isReceiveFlow ||
          isRepeatFlow ||
          isTransferLocked
        ) {
          return;
        }

        setForm(
          current => ({
            ...current,

            beneficiary: {
              ...current
                .beneficiary,

              [name]:
                value
            }
          })
        );
      },
      [
        isReceiveFlow,
        isRepeatFlow,
        isTransferLocked,
        setForm
      ]
    );

  /*
   * Explicit route change starts a clean payout
   * draft.
   *
   * Receive route is fixed by the Receive profile.
   *
   * A route must exist and remain selectable before
   * any flow state is mutated.
   */
  const changeRoute =
    useCallback(
      routeId => {
        if (
          isReceiveFlow
        ) {
          writeDebug(
            "Destination is fixed by the Receive request."
          );

          return;
        }

        if (
          isTransferLocked
        ) {
          writeDebug(
            "This payout is locked. Start a new payout to change the route.",
            {
              payout_intent_id:
                payoutIntentId,

              payout_attempt_state:
                payoutAttemptState
            }
          );

          return;
        }

        const route =
          findRouteById(
            routes,
            routeId
          );

        if (
          !route ||
          !isSelectableRoute(
            route
          )
        ) {
          writeDebug(
            "Selected payout route is unavailable.",
            {
              route_id:
                routeId ||
                null
            }
          );

          return;
        }

        /*
         * A successful explicit route change belongs
         * to a normal payout flow.
         *
         * Clear any Receive context that may have
         * survived a previous Receive → Returned
         * transition.
         */
        clearReceiveContext();

        setRepeatSourcePayoutIntentId(
          null
        );

        repeatInitializedRef.current =
          false;

        setReturnedFlowDismissed(
          true
        );

        setSelectedRouteId(
          getRouteId(
            route
          )
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

        resetPricingPreview();

        resetRouteCreatedTracking();

        resetConnectSession();

        setForm(
          buildEmptyForm(
            route
          )
        );

        clearStoredFlow();

        removeQueryParams([
          "payout_intent_id",
          "repeat_source_payout_intent_id",
          "route_id"
        ]);

        writeDebug(
          "Ready to start a new payout."
        );
      },
      [
        clearReceiveContext,
        isReceiveFlow,
        isTransferLocked,
        payoutAttemptState,
        payoutIntentId,
        payoutIntentIdStateRef,
        repeatInitializedRef,
        resetConnectSession,
        resetPayoutAttemptLifecycle,
        resetPricingPreview,
        resetRouteCreatedTracking,
        routes,
        setForm,
        setFundingTxHash,
        setPayoutIntentId,
        setRepeatSourcePayoutIntentId,
        setReturnedFlowDismissed,
        setSelectedRouteId,
        setSettlement,
        writeDebug
      ]
    );

  return {
    handleNewPayout,
    setEditableForm,
    updateBeneficiaryField,
    changeRoute
  };
}
