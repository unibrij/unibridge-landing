// connect-app/src/history/routeHistory.js

const ROUTE_HISTORY_KEY =
  "unibridge_route_history";

const MAX_ROUTE_HISTORY_ITEMS =
  20;

export function readRouteHistory() {
  try {
    const raw =
      window.localStorage.getItem(
        ROUTE_HISTORY_KEY
      );

    const parsed =
      JSON.parse(
        raw ||
        "[]"
      );

    return Array.isArray(
      parsed
    )
      ? parsed
      : [];
  }
  catch {
    return [];
  }
}

function toTime(
  value
) {
  if (!value) {
    return 0;
  }

  if (
    typeof value ===
      "string" ||
    typeof value ===
      "number"
  ) {
    const time =
      new Date(
        value
      ).getTime();

    return Number.isNaN(
      time
    )
      ? 0
      : time;
  }

  if (value?._seconds) {
    return (
      value._seconds *
      1000
    );
  }

  if (value?.seconds) {
    return (
      value.seconds *
      1000
    );
  }

  return 0;
}

function normalizeHistoryItem(
  item = {}
) {
  return {
    id:
      item.id ||
      null,

    route_id:
      item.route_id ||
      null,

    payout_intent_id:
      item.payout_intent_id ||
      null,

    settlement_id:
      item.settlement_id ||
      null,

    receipt_id:
      item.receipt_id ||
      null,

    public_reference:
      item.public_reference ||
      null,

    corridor:
      item.corridor ||
      null,

    amount:
      item.amount ??
      null,

    asset:
      item.asset ||
      null,

    status:
      item.status ||
      null,

    created_at:
      item.created_at ||
      null
  };
}

function historyItemKey(
  item = {}
) {
  return (
    item.payout_intent_id ||
    item.settlement_id ||
    item.receipt_id ||
    item.id ||
    item.route_id ||
    null
  );
}

export function writeRouteHistory(
  items
) {
  try {
    const list =
      Array.isArray(
        items
      )
        ? items.map(
            normalizeHistoryItem
          )
        : [];

    window.localStorage.setItem(
      ROUTE_HISTORY_KEY,

      JSON.stringify(
        list.slice(
          0,
          MAX_ROUTE_HISTORY_ITEMS
        )
      )
    );
  }
  catch {
    // ignore local history failures
  }
}

export function mergeRouteHistoryItems(
  items = []
) {
  try {
    const current =
      readRouteHistory();

    const merged =
      new Map();

    [
      ...items,
      ...current
    ].forEach(
      item => {
        const normalized =
          normalizeHistoryItem(
            item
          );

        const key =
          historyItemKey(
            normalized
          );

        if (!key) {
          return;
        }

        if (!merged.has(key)) {
          merged.set(
            key,
            normalized
          );

          return;
        }

        const existing =
          merged.get(
            key
          );

        merged.set(
          key,
          normalizeHistoryItem({
            ...existing,

            ...Object.fromEntries(
              Object.entries(
                normalized
              ).filter(
                ([, value]) =>
                  value !==
                    null &&
                  value !==
                    undefined &&
                  value !==
                    ""
              )
            )
          })
        );
      }
    );

    const next =
      Array.from(
        merged.values()
      )
        .sort(
          (
            a,
            b
          ) =>
            toTime(
              b.created_at
            ) -
            toTime(
              a.created_at
            )
        )
        .slice(
          0,
          MAX_ROUTE_HISTORY_ITEMS
        );

    writeRouteHistory(
      next
    );

    return next;
  }
  catch {
    return readRouteHistory();
  }
}

export function saveRouteHistoryItem(
  item
) {
  return mergeRouteHistoryItems([
    {
      ...item,

      created_at:
        item.created_at ||
        new Date()
          .toISOString()
    }
  ]);
}
