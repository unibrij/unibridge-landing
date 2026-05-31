// connect-app/src/hooks/useReturnedPayoutIntent.js

import { useEffect } from "react";

import {
  getPayoutIntent
} from "../api";

import {
  getRouteById,
  ROUTES
} from "../routes";

import {
  resolveRouteIdFromIntent,
  buildFormFromIntent
} from "../flow/routes";

import {
  storeFlowSnapshot
} from "../flow/flowStorage";

export function useReturnedPayoutIntent({
  returnedPayoutIntentId,
  routes = ROUTES,
  setSelectedRouteId,
  setPayoutIntentId,
  setForm,
  setIsBusy,
  writeDebug
}) {
  useEffect(() => {
    if (!returnedPayoutIntentId) {
      return;
    }

    let cancelled = false;

    async function loadReturnedIntent() {
      try {
        setIsBusy(true);

        const intent =
          await getPayoutIntent({
            payoutIntentId: returnedPayoutIntentId
          });

        if (cancelled) {
          return;
        }

        const routeId =
          resolveRouteIdFromIntent(intent, routes);

        const route =
          getRouteById(routeId, routes);

        const rebuiltForm =
          buildFormFromIntent(intent, route);

        setSelectedRouteId(routeId);
        setPayoutIntentId(intent.payout_intent_id);
        setForm(rebuiltForm);

        storeFlowSnapshot({
          payout_intent_id: intent.payout_intent_id,
          route_id: routeId,
          form: rebuiltForm
        });

        writeDebug(
          "Verification complete. Ready to prepare funding.",
          intent
        );
      } catch (err) {
        if (cancelled) {
          return;
        }

        writeDebug("Load payout intent failed", {
          message: err.message
        });
      } finally {
        if (!cancelled) {
          setIsBusy(false);
        }
      }
    }

    loadReturnedIntent();

    return () => {
      cancelled = true;
    };
  }, [
    returnedPayoutIntentId,
    routes,
    setSelectedRouteId,
    setPayoutIntentId,
    setForm,
    setIsBusy,
    writeDebug
  ]);
}

export default useReturnedPayoutIntent;
