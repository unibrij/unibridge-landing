// connect-app/src/components/history/historyUtils.js

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


export function normalizeWalletAddress(
  value
) {
  return normalizeString(
    value
  ).toLowerCase();
}


export function formatStatus(
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
    labels[normalized]
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


export function formatAmount(
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


export function formatDate(
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


export function getRecipientLabel(
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


export function getRecipientDestination(
  item
) {
  return normalizeString(
    item
      ?.recipient_display
      ?.destination
  );
}


export function getMaskedIdentifier(
  item
) {
  return normalizeString(
    item
      ?.recipient_display
      ?.masked_identifier
  );
}


export function buildRecipientSummary(
  item
) {
  return [
    getRecipientDestination(
      item
    ),

    getMaskedIdentifier(
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


export function getRecipientInitials(
  item
) {
  const label =
    getRecipientLabel(
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
    words.length === 0
  ) {
    return "UB";
  }

  if (
    words.length === 1
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


export function buildRepeatUrl(
  item
) {
  const sourcePayoutIntentId =
    normalizeString(
      item
        ?.repeat_source_payout_intent_id ||
      item?.payout_intent_id
    );

  const routeId =
    normalizeString(
      item?.route_id
    );

  if (
    !sourcePayoutIntentId ||
    !routeId ||
    item?.repeat_available ===
      false
  ) {
    return null;
  }

  const params =
    new URLSearchParams({
      repeat_source_payout_intent_id:
        sourcePayoutIntentId,

      route_id:
        routeId
    });

  return `/connect/?${params.toString()}`;
}


export function triggerBlobDownload({
  blob,
  filename
}) {
  const objectUrl =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href =
    objectUrl;

  link.download =
    filename ||
    "unibridge-receipt.pdf";

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  globalThis.setTimeout(
    () => {
      URL.revokeObjectURL(
        objectUrl
      );
    },
    0
  );
}
