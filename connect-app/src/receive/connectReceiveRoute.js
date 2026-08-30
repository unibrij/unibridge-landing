// connect-app/src/receive/connectReceiveRoute.js

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}


function normalizeCountry(
  value
) {
  return normalizeString(
    value
  ).toUpperCase();
}


function normalizeRail(
  value
) {
  return normalizeString(
    value
  ).toLowerCase();
}


function getRouteCountry(
  route
) {
  return normalizeCountry(
    route?.country ||
    route?.destination_country ||
    route?.receiver_country
  );
}


function getRouteRail(
  route
) {
  return normalizeRail(
    route?.rail ||
    route?.payout_rail
  );
}


export function isUsableReceiveRoute(
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


export function findReceiveRoute(
  routes = [],
  {
    destinationCountry,
    payoutRail
  } = {}
) {
  const normalizedCountry =
    normalizeCountry(
      destinationCountry
    );

  const normalizedRail =
    normalizeRail(
      payoutRail
    );

  if (
    !normalizedCountry ||
    !normalizedRail
  ) {
    return null;
  }

  return (
    routes.find(
      route =>
        isUsableReceiveRoute(
          route
        ) &&
        getRouteCountry(
          route
        ) ===
          normalizedCountry &&
        getRouteRail(
          route
        ) ===
          normalizedRail
    ) ||
    null
  );
}
