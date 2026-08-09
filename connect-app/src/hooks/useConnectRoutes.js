// connect-app/src/hooks/useConnectRoutes.js

import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  ROUTES,
  getRouteById,
  normalizeBackendRoutes
} from "../routes.js";

import {
  getConnectRoutes
} from "../api.js";

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}

function hasRoute(
  routes = [],
  routeId
) {
  const normalizedRouteId =
    normalizeString(
      routeId
    );

  if (!normalizedRouteId) {
    return false;
  }

  return routes.some(
    route =>
      normalizeString(
        route?.id
      ) ===
        normalizedRouteId ||
      normalizeString(
        route?.route_id
      ) ===
        normalizedRouteId
  );
}

export default function useConnectRoutes({
  initialSelectedRouteId,
  onInitialRouteFallback
}) {
  const [
    routes,
    setRoutes
  ] = useState(
    ROUTES
  );

  const [
    selectedRouteId,
    setSelectedRouteId
  ] = useState(
    initialSelectedRouteId ||
    ROUTES[0]?.id ||
    "br_pix"
  );

  /*
   * Keep callback updates from restarting route
   * discovery.
   *
   * Route discovery is an initialization concern,
   * not something that should rerun because the
   * parent component rendered a new callback.
   */
  const onInitialRouteFallbackRef =
    useRef(
      onInitialRouteFallback
    );

  useEffect(() => {
    onInitialRouteFallbackRef.current =
      onInitialRouteFallback;
  }, [
    onInitialRouteFallback
  ]);

  const selectedRoute =
    useMemo(
      () =>
        getRouteById(
          selectedRouteId,
          routes
        ),
      [
        routes,
        selectedRouteId
      ]
    );

  useEffect(() => {
    let cancelled =
      false;

    async function loadRoutes() {
      try {
        const backendRoutes =
          await getConnectRoutes();

        if (cancelled) {
          return;
        }

        const normalized =
          normalizeBackendRoutes(
            backendRoutes
          );

        /*
         * Keep the static catalog as a defensive
         * fallback if Core returns no usable routes.
         */
        const nextRoutes =
          normalized.length > 0
            ? normalized
            : ROUTES;

        setRoutes(
          nextRoutes
        );

        /*
         * Preserve the originally requested route
         * whenever Core still exposes it.
         */
        if (
          hasRoute(
            nextRoutes,
            initialSelectedRouteId
          )
        ) {
          return;
        }

        /*
         * Core responded successfully but the
         * originally requested route is no longer
         * available.
         *
         * Route ownership stops at selecting the
         * fallback. The parent decides what this
         * means for repeat/form/payout state.
         */
        const fallbackRoute =
          nextRoutes[0] ||
          ROUTES[0] ||
          null;

        if (!fallbackRoute) {
          return;
        }

        const fallbackRouteId =
          normalizeString(
            fallbackRoute.id ||
            fallbackRoute.route_id
          );

        if (!fallbackRouteId) {
          return;
        }

        setSelectedRouteId(
          fallbackRouteId
        );

        onInitialRouteFallbackRef
          .current?.(
            fallbackRoute
          );
      }
      catch {
        if (cancelled) {
          return;
        }

        /*
         * Preserve the original Connect behavior.
         *
         * A route-discovery failure proves only that
         * discovery failed. It does not prove that
         * the requested route disappeared.
         *
         * Fall back to the bundled catalog without
         * changing selected route or triggering any
         * parent-level fallback side effects.
         */
        setRoutes(
          ROUTES
        );
      }
    }

    void loadRoutes();

    return () => {
      cancelled =
        true;
    };
  }, [
    initialSelectedRouteId
  ]);

  return {
    routes,

    selectedRouteId,
    setSelectedRouteId,

    selectedRoute
  };
}
