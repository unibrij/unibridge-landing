// shared/pay/history/history.js

const CORE_API_BASE =
  "https://unibridge-v2-vqia6yp7wq-uc.a.run.app/v2";

const PROXY_BASE =
  "/api/proxy";


/*
--------------------------------------------------
Normalization
--------------------------------------------------
*/

export function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}

export function normalizeStatus(
  status
) {
  return normalizeString(
    status
  ).toLowerCase();
}


/*
--------------------------------------------------
Formatting
--------------------------------------------------
*/

export function formatHistoryStatus(
  status
) {
  const normalized =
    normalizeStatus(
      status
    );

  const labels = {
    completed:
      "Completed",

    complete:
      "Completed",

    executed:
      "Completed",

    success:
      "Completed",

    succeeded:
      "Completed",

    payout_completed:
      "Completed",

    execution_completed:
      "Completed",

    processing:
      "Processing",

    pending:
      "Pending",

    failed:
      "Failed"
  };

  if (
    labels[
      normalized
    ]
  ) {
    return labels[
      normalized
    ];
  }

  if (!normalized) {
    return "—";
  }

  return normalized
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      character =>
        character.toUpperCase()
    );
}

export function formatHistoryAmount(
  item
) {
  const amount =
    normalizeString(
      item?.amount
    );

  const asset =
    normalizeString(
      item?.asset
    );

  if (!amount) {
    return "—";
  }

  return asset
    ? `${amount} ${asset}`
    : amount;
}

function resolveDate(
  value
) {
  if (!value) {
    return null;
  }

  if (
    typeof value ===
      "string" ||
    typeof value ===
      "number"
  ) {
    const date =
      new Date(
        value
      );

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  const seconds =
    value?._seconds ??
    value?.seconds;

  if (
    Number.isFinite(
      Number(
        seconds
      )
    )
  ) {
    const date =
      new Date(
        Number(
          seconds
        ) *
        1000
      );

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  return null;
}

export function formatHistoryDate(
  value
) {
  const date =
    resolveDate(
      value
    );

  if (!date) {
    return "—";
  }

  try {
    return date
      .toLocaleDateString(
        undefined,
        {
          year:
            "numeric",

          month:
            "short",

          day:
            "numeric"
        }
      );
  }
  catch {
    return "—";
  }
}


/*
--------------------------------------------------
Recipient projection
--------------------------------------------------
*/

export function getHistoryRecipientLabel(
  item
) {
  return (
    normalizeString(
      item
        ?.recipient_display
        ?.label
    ) ||
    "Recipient"
  );
}

export function getHistoryRecipientDestination(
  item
) {
  return normalizeString(
    item
      ?.recipient_display
      ?.destination
  );
}

export function getHistoryMaskedIdentifier(
  item
) {
  return normalizeString(
    item
      ?.recipient_display
      ?.masked_identifier
  );
}

export function buildHistoryRecipientSummary(
  item
) {
  return [
    getHistoryRecipientDestination(
      item
    ),

    getHistoryMaskedIdentifier(
      item
    )
  ]
    .filter(
      Boolean
    )
    .join(
      " · "
    ) ||
    "Saved payout recipient";
}

export function getHistoryRecipientInitials(
  item
) {
  const label =
    getHistoryRecipientLabel(
      item
    );

  const words =
    label
      .split(
        /\s+/
      )
      .filter(
        Boolean
      );

  if (
    words.length ===
      0
  ) {
    return "UB";
  }

  if (
    words.length ===
      1
  ) {
    return words[0]
      .slice(
        0,
        2
      )
      .toUpperCase();
  }

  return (
    words[0][0] +
    words[
      words.length -
      1
    ][0]
  ).toUpperCase();
}


/*
--------------------------------------------------
Repeat state

Fiat repeat is settlement-based.

The previous completed settlement is used only as
the source for prefilling the new payout flow.

A new quote and a new settlement are still required
for every repeated payout.
--------------------------------------------------
*/

export function buildRepeatParams(
  item
) {
  const sourceSettlementId =
    normalizeString(
      item
        ?.repeat_source_settlement_id ||
      item?.settlement_id
    );

  const routeId =
    normalizeString(
      item?.route_id
    );

  if (
    !sourceSettlementId ||
    !routeId ||
    item?.repeat_available ===
      false
  ) {
    return null;
  }

  return new URLSearchParams({
    repeat_source_settlement_id:
      sourceSettlementId,

    route_id:
      routeId
  });
}


/*
--------------------------------------------------
HTTP helpers
--------------------------------------------------
*/

function buildAuthHeaders(
  accessToken,
  {
    json = false
  } = {}
) {
  const normalizedAccessToken =
    normalizeString(
      accessToken
    );

  if (
    !normalizedAccessToken
  ) {
    throw new Error(
      "customer_access_token_required"
    );
  }

  const headers = {
    Authorization:
      `Bearer ${normalizedAccessToken}`
  };

  if (json) {
    headers.Accept =
      "application/json";

    headers[
      "Content-Type"
    ] =
      "application/json";
  }

  return headers;
}

async function parseJsonResponse(
  response,
  fallback
) {
  const data =
    await response
      .json()
      .catch(
        () => ({})
      );

  if (
    !response.ok ||
    data?.ok === false
  ) {
    const errorCode =
      typeof data?.error ===
        "string"
        ? data.error
        : data?.error?.code ||
          data?.error?.message ||
          fallback;

    const error =
      new Error(
        errorCode ||
        fallback
      );

    error.code =
      errorCode ||
      fallback;

    error.status =
      response.status;

    error.body =
      data;

    throw error;
  }

  return data;
}

function buildProxyUrl({
  partner,
  endpoint,
  query = {}
}) {
  const normalizedPartner =
    normalizeString(
      partner
    );

  const normalizedEndpoint =
    normalizeString(
      endpoint
    );

  if (!normalizedPartner) {
    throw new Error(
      "proxy_partner_required"
    );
  }

  if (!normalizedEndpoint) {
    throw new Error(
      "proxy_endpoint_required"
    );
  }

  const url =
    new URL(
      PROXY_BASE,
      window.location.origin
    );

  url.searchParams.set(
    "partner",
    normalizedPartner
  );

  url.searchParams.set(
    "endpoint",
    normalizedEndpoint
  );

  Object
    .entries(
      query ||
      {}
    )
    .forEach(
      ([
        key,
        value
      ]) => {
        if (
          value ===
            undefined ||
          value ===
            null ||
          value ===
            ""
        ) {
          return;
        }

        url.searchParams.set(
          key,
          String(
            value
          )
        );
      }
    );

  return url.toString();
}


/*
--------------------------------------------------
Fiat payout history
--------------------------------------------------
*/

export async function getPayoutHistory({
  partner,
  accessToken,
  limit = 20
}) {
  const parsedLimit =
    Number(
      limit
    );

  const normalizedLimit =
    Number.isFinite(
      parsedLimit
    ) &&
    parsedLimit > 0
      ? Math.min(
          50,
          Math.trunc(
            parsedLimit
          )
        )
      : 20;

  const response =
    await fetch(
      buildProxyUrl({
        partner,

        endpoint:
          "fiat/payout-history",

        query: {
          limit:
            normalizedLimit
        }
      }),
      {
        method:
          "GET",

        headers:
          buildAuthHeaders(
            accessToken,
            {
              json:
                true
            }
          )
      }
    );

  const data =
    await parseJsonResponse(
      response,
      "get_payout_history_failed"
    );

  return {
    recent_recipients:
      Array.isArray(
        data
          ?.recent_recipients
      )
        ? data
            .recent_recipients
        : [],

    recent_payouts:
      Array.isArray(
        data
          ?.recent_payouts
      )
        ? data
            .recent_payouts
        : []
  };
}


/*
--------------------------------------------------
Fiat repeat payout source

Repeat source is a completed settlement.

The endpoint only returns the previous payout data
required to prefill the normal Fiat flow.
--------------------------------------------------
*/

export async function getRepeatPayoutSource({
  partner,
  sourceSettlementId,
  accessToken
}) {
  const normalizedSourceSettlementId =
    normalizeString(
      sourceSettlementId
    );

  if (
    !normalizedSourceSettlementId
  ) {
    throw new Error(
      "source_settlement_id_required"
    );
  }

  const endpoint =
    `fiat/repeat-payout/${encodeURIComponent(
      normalizedSourceSettlementId
    )}`;

  const response =
    await fetch(
      buildProxyUrl({
        partner,
        endpoint
      }),
      {
        method:
          "GET",

        headers:
          buildAuthHeaders(
            accessToken,
            {
              json:
                true
            }
          )
      }
    );

  const data =
    await parseJsonResponse(
      response,
      "get_repeat_payout_source_failed"
    );

  if (
    !data?.route_id ||
    !data?.beneficiary
  ) {
    throw new Error(
      "repeat_payout_source_incomplete"
    );
  }

  return data;
}


/*
--------------------------------------------------
Receipt PDF

Receipt responses are binary, while the current
landing proxy is JSON-only.

Fetch directly from Core and pass customer auth.
--------------------------------------------------
*/

export async function downloadReceiptPdf({
  receiptId,
  accessToken
}) {
  const normalizedReceiptId =
    normalizeString(
      receiptId
    );

  if (
    !normalizedReceiptId
  ) {
    throw new Error(
      "receipt_id_required"
    );
  }

  const response =
    await fetch(
      `${CORE_API_BASE}/receipts/${encodeURIComponent(
        normalizedReceiptId
      )}/pdf`,
      {
        method:
          "GET",

        headers:
          buildAuthHeaders(
            accessToken
          )
      }
    );

  if (!response.ok) {
    let data = {};

    try {
      data =
        await response.json();
    }
    catch {
      data = {};
    }

    const errorCode =
      typeof data?.error ===
        "string"
        ? data.error
        : data?.error?.code ||
          data?.error?.message ||
          "receipt_download_failed";

    const error =
      new Error(
        errorCode
      );

    error.code =
      errorCode;

    error.status =
      response.status;

    throw error;
  }

  const contentType =
    normalizeString(
      response.headers.get(
        "content-type"
      )
    ).toLowerCase();

  if (
    !contentType.includes(
      "application/pdf"
    )
  ) {
    throw new Error(
      "receipt_pdf_response_invalid"
    );
  }

  const blob =
    await response.blob();

  if (!blob.size) {
    throw new Error(
      "receipt_pdf_empty"
    );
  }

  const contentDisposition =
    normalizeString(
      response.headers.get(
        "content-disposition"
      )
    );

  const filenameMatch =
    contentDisposition.match(
      /filename\*?=(?:UTF-8''|")?([^";]+)/i
    );

  let filename =
    `unibridge-receipt-${normalizedReceiptId}.pdf`;

  if (
    filenameMatch?.[1]
  ) {
    try {
      filename =
        decodeURIComponent(
          filenameMatch[1]
            .replace(
              /^"|"$/g,
              ""
            )
            .trim()
        );
    }
    catch {
      filename =
        filenameMatch[1]
          .replace(
            /^"|"$/g,
            ""
          )
          .trim() ||
        filename;
    }
  }

  return {
    blob,
    filename
  };
}
