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
         * Preserve the original Connect behavior.
         *
         * A successful Core response is authoritative,
         * even when it contains no usable routes.
         */
        setRoutes(
          normalized
        );

        /*
         * Preserve the originally requested route
         * whenever Core still exposes it.
         */
        if (
          hasRoute(
            normalized,
            initialSelectedRouteId
          )
        ) {
          return;
        }

        /*
         * Core responded successfully but the
         * originally requested route is unavailable.
         *
         * Selection may fall back to the bundled
         * catalog, but the authoritative route list
         * remains the normalized Core response.
         */
        const fallbackRoute =
          normalized[0] ||
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
         * A route-discovery failure does not prove
         * that the requested route disappeared.
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
