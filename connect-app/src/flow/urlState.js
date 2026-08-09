// connect-app/src/flow/urlState.js

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}

export function readConnectUrlState() {
  if (
    typeof window ===
    "undefined"
  ) {
    return {
      isHistoryPage:
        false,

      repeatSourcePayoutIntentId:
        null,

      repeatRouteId:
        null
    };
  }

  try {
    const searchParams =
      new URLSearchParams(
        window.location.search
      );

    return {
      isHistoryPage:
        searchParams.get(
          "view"
        ) ===
        "history",

      repeatSourcePayoutIntentId:
        normalizeString(
          searchParams.get(
            "repeat_source_payout_intent_id"
          )
        ) ||
        null,

      repeatRouteId:
        normalizeString(
          searchParams.get(
            "route_id"
          )
        ) ||
        null
    };
  }
  catch {
    return {
      isHistoryPage:
        false,

      repeatSourcePayoutIntentId:
        null,

      repeatRouteId:
        null
    };
  }
}

export function removeQueryParams(
  names = []
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  try {
    const url =
      new URL(
        window.location.href
      );

    let changed =
      false;

    for (
      const name
      of names
    ) {
      const normalizedName =
        normalizeString(
          name
        );

      if (
        !normalizedName ||
        !url.searchParams.has(
          normalizedName
        )
      ) {
        continue;
      }

      url.searchParams.delete(
        normalizedName
      );

      changed =
        true;
    }

    if (!changed) {
      return;
    }

    const nextUrl =
      `${url.pathname}${url.search}${url.hash}`;

    window.history.replaceState(
      window.history.state,
      "",
      nextUrl
    );
  }
  catch {
    /*
     * URL cleanup is non-critical.
     */
  }
}
