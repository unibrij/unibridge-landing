// connect-app/src/hooks/useConnectRoutes.js

import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  ROUTES,
  normalizeBackendRoutes
} from "../routes.js";

import {
  getConnectRoutes
} from "../api.js";

import {
  findReceiveRoute
} from "../receive/connectReceiveRoute.js";


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


function findSelectableRouteById(
  routes = [],
  routeId
) {
  const route =
    findRouteById(
      routes,
      routeId
    );

  return isSelectableRoute(
    route
  )
    ? route
    : null;
}


function findFirstSelectableRoute(
  routes = []
) {
  return (
    routes.find(
      route =>
        isSelectableRoute(
          route
        )
    ) ||
    null
  );
}


export default function useConnectRoutes({
  initialSelectedRouteId,
  onInitialRouteFallback,

  receiveBound = false,
  receiveDestinationCountry = null,
  receivePayoutRail = null
}) {
  /*
   * "Initial" really means initial.
   *
   * Never reapply this value merely because Receive
   * mode later changes.
   */
  const initialSelectedRouteIdRef =
    useRef(
      initialSelectedRouteId
    );

  /*
   * Bundled Receive resolution is only an immediate
   * optimization for first render.
   *
   * Receive remains fail-closed:
   * matching route or null.
   */
  const initialReceiveRoute =
    receiveBound
      ? findReceiveRoute(
          ROUTES,
          {
            destinationCountry:
              receiveDestinationCountry,

            payoutRail:
              receivePayoutRail
          }
        )
      : null;

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
    () => {
      /*
       * Receive must never temporarily fall through
       * to a generic/default route.
       *
       * If the matching route is not present in the
       * bundled catalog, stay null until Core route
       * discovery resolves it.
       */
      if (receiveBound) {
        return (
          getRouteId(
            initialReceiveRoute
          ) ||
          null
        );
      }

      return (
        initialSelectedRouteIdRef
          .current ||
        getRouteId(
          findFirstSelectableRoute(
            ROUTES
          )
        ) ||
        null
      );
    }
  );

  /*
   * Route catalog resolution:
   *
   * initial
   * → core
   * → bundled_fallback
   */
  const [
    catalogSource,
    setCatalogSource
  ] = useState(
    "initial"
  );

  /*
   * Receive does not have a pending generic initial
   * selection. Its route is owned by the Receive
   * country + rail binding from the beginning.
   *
   * This also prevents a Receive → New payout
   * transition that happens before Core discovery
   * finishes from later reapplying the default
   * initial route.
   */
  const initialSelectionResolvedRef =
    useRef(
      receiveBound
    );

  const previousReceiveBoundRef =
    useRef(
      receiveBound
    );

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

  /*
   * Exact selectable route resolution.
   *
   * No implicit fallback is hidden inside this
   * derived value.
   */
  const selectedRoute =
    useMemo(
      () =>
        findSelectableRouteById(
          routes,
          selectedRouteId
        ),
      [
        routes,
        selectedRouteId
      ]
    );

  /*
   * Discover the route catalog once for this mounted
   * Connect session.
   *
   * Selection policy is deliberately kept out of
   * this effect.
   */
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

        setRoutes(
          normalizeBackendRoutes(
            backendRoutes
          )
        );

        setCatalogSource(
          "core"
        );
      }
      catch {
        if (cancelled) {
          return;
        }

        /*
         * Discovery failure may use the bundled
         * catalog as the temporary fallback.
         */
        setRoutes(
          ROUTES
        );

        setCatalogSource(
          "bundled_fallback"
        );
      }
    }

    void loadRoutes();

    return () => {
      cancelled =
        true;
    };
  }, []);

  /*
   * Selection reconciliation is separate from
   * catalog discovery.
   *
   * Rules:
   *
   * - Receive owns the route while active.
   * - Initial route policy runs once after catalog
   *   resolution.
   * - Leaving Receive preserves the current route
   *   when it is still selectable.
   * - Initial route is never reapplied on Receive
   *   exit.
   */
  useEffect(() => {
    if (
      catalogSource ===
      "initial"
    ) {
      previousReceiveBoundRef.current =
        receiveBound;

      return;
    }

    const wasReceiveBound =
      previousReceiveBoundRef
        .current;

    previousReceiveBoundRef.current =
      receiveBound;

    /*
     * Active Receive always resolves from the
     * authoritative country + rail binding.
     *
     * No generic fallback is permitted.
     */
    if (receiveBound) {
      const receiveRoute =
        findReceiveRoute(
          routes,
          {
            destinationCountry:
              receiveDestinationCountry,

            payoutRail:
              receivePayoutRail
          }
        );

      setSelectedRouteId(
        getRouteId(
          receiveRoute
        ) ||
        null
      );

      initialSelectionResolvedRef.current =
        true;

      return;
    }

    /*
     * Receive → Standard transition.
     *
     * Preserve the route the user is currently
     * looking at if it remains selectable.
     *
     * Do not reapply initialSelectedRouteId.
     */
    if (wasReceiveBound) {
      const currentRoute =
        findSelectableRouteById(
          routes,
          selectedRouteId
        );

      if (currentRoute) {
        return;
      }

      const fallbackRoute =
        findFirstSelectableRoute(
          routes
        );

      setSelectedRouteId(
        getRouteId(
          fallbackRoute
        ) ||
        null
      );

      return;
    }

    /*
     * Normal initial reconciliation runs exactly
     * once after route discovery resolves.
     */
    if (
      !initialSelectionResolvedRef
        .current
    ) {
      initialSelectionResolvedRef.current =
        true;

      const requestedRoute =
        findSelectableRouteById(
          routes,
          initialSelectedRouteIdRef
            .current
        );

      if (requestedRoute) {
        setSelectedRouteId(
          getRouteId(
            requestedRoute
          )
        );

        return;
      }

      const fallbackRoute =
        findFirstSelectableRoute(
          routes
        );

      setSelectedRouteId(
        getRouteId(
          fallbackRoute
        ) ||
        null
      );

      /*
       * Preserve previous behavior:
       *
       * Only a successful Core catalog proving that
       * the requested route is unavailable triggers
       * the cross-subsystem fallback callback.
       */
      if (
        fallbackRoute &&
        catalogSource ===
          "core"
      ) {
        onInitialRouteFallbackRef
          .current?.(
            fallbackRoute
          );
      }

      return;
    }

    /*
     * Defensive reconciliation if the current route
     * becomes unavailable after initialization.
     */
    const currentRoute =
      findSelectableRouteById(
        routes,
        selectedRouteId
      );

    if (currentRoute) {
      return;
    }

    const fallbackRoute =
      findFirstSelectableRoute(
        routes
      );

    setSelectedRouteId(
      getRouteId(
        fallbackRoute
      ) ||
      null
    );
  }, [
    catalogSource,
    receiveBound,
    receiveDestinationCountry,
    receivePayoutRail,
    routes,
    selectedRouteId
  ]);

  return {
    routes,

    selectedRouteId,
    setSelectedRouteId,

    selectedRoute
  };
}
