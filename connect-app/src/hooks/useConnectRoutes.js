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
    () =>
      getRouteId(
        initialReceiveRoute
      ) ||
      initialSelectedRouteId ||
      getRouteId(
        findFirstSelectableRoute(
          ROUTES
        )
      ) ||
      null
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
   * Exact, selectable route resolution.
   *
   * No implicit fallback happens here. If the current
   * route is unavailable, selectedRoute is null until
   * the discovery lifecycle selects another route.
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
         * Successful Core discovery is authoritative.
         */
        setRoutes(
          normalized
        );

        /*
         * Receive-specific matching stays delegated
         * to connectReceiveRoute.js.
         */
        if (receiveBound) {
          const receiveRoute =
            findReceiveRoute(
              normalized,
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

          return;
        }

        const requestedRoute =
          findSelectableRouteById(
            normalized,
            initialSelectedRouteId
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
            normalized
          );

        if (!fallbackRoute) {
          setSelectedRouteId(
            null
          );

          return;
        }

        setSelectedRouteId(
          getRouteId(
            fallbackRoute
          )
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
         * Only discovery failure may use the bundled
         * catalog as a temporary fallback.
         */
        setRoutes(
          ROUTES
        );

        if (receiveBound) {
          const receiveRoute =
            findReceiveRoute(
              ROUTES,
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

          return;
        }

        const requestedRoute =
          findSelectableRouteById(
            ROUTES,
            initialSelectedRouteId
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
            ROUTES
          );

        setSelectedRouteId(
          getRouteId(
            fallbackRoute
          ) ||
          null
        );
      }
    }

    void loadRoutes();

    return () => {
      cancelled =
        true;
    };
  }, [
    initialSelectedRouteId,
    receiveBound,
    receiveDestinationCountry,
    receivePayoutRail
  ]);

  return {
    routes,

    selectedRouteId,
    setSelectedRouteId,

    selectedRoute
  };
}
