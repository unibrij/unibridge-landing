// connect-app/src/hooks/useReceivePayoutForm.js

import {
  useEffect,
  useRef
} from "react";

import {
  buildEmptyForm
} from "../flow/routes";


export default function useReceivePayoutForm({
  enabled,
  receiveProfileId,
  selectedRoute,
  setForm
}) {
  const initializedKeyRef =
    useRef(null);

  useEffect(() => {
    if (
      !enabled ||
      !receiveProfileId
    ) {
      initializedKeyRef.current =
        null;

      return;
    }

    if (!selectedRoute) {
      return;
    }

    const routeId =
      String(
        selectedRoute.id ||
        selectedRoute.route_id ||
        ""
      ).trim();

    if (!routeId) {
      return;
    }

    const initializationKey =
      `${receiveProfileId}:${routeId}`;

    if (
      initializedKeyRef.current ===
      initializationKey
    ) {
      return;
    }

    initializedKeyRef.current =
      initializationKey;

    setForm({
      ...buildEmptyForm(
        selectedRoute
      ),

      amount:
        ""
    });
  }, [
    enabled,
    receiveProfileId,
    selectedRoute,
    setForm
  ]);
}
