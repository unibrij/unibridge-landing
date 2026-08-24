// fiat/bank-transfer/js/repeatPayout.js

import {
  getRepeatSourceSettlementId,
  isRepeatPayoutEntry,
  loadRepeatPayoutSource as loadSharedRepeatPayoutSource
} from "/shared/pay/history/repeat.js";


const PARTNER =
  "fiat_bank_transfer";


function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}


/*
--------------------------------------------------
Query
--------------------------------------------------
*/

export function readRepeatPayoutRequest() {
  return {
    sourceSettlementId:
      getRepeatSourceSettlementId()
  };
}


export function isRepeatPayoutView() {
  return isRepeatPayoutEntry();
}


/*
--------------------------------------------------
Source
--------------------------------------------------
*/

export async function loadRepeatPayoutSource() {
  const {
    sourceSettlementId
  } =
    readRepeatPayoutRequest();

  if (!sourceSettlementId) {
    return null;
  }

  const source =
    await loadSharedRepeatPayoutSource({
      partner:
        PARTNER
    });

  if (
    !source ||
    source.ok === false
  ) {
    throw new Error(
      source?.error ||
      "repeat_payout_source_unavailable"
    );
  }

  return {
    source_settlement_id:
      sourceSettlementId,

    route_id:
      normalizeString(
        source.route_id
      ) ||
      null,

    receiver_country:
      normalizeString(
        source.country
      ).toUpperCase() ||
      null,

    rail:
      normalizeString(
        source.rail
      ) ||
      null,

    network:
      normalizeString(
        source.network
      ) ||
      null,

    asset:
      normalizeString(
        source.asset
      ) ||
      null,

    amount:
      source.amount ??
      null,

    beneficiary:
      (
        source.beneficiary &&
        typeof source.beneficiary ===
          "object" &&
        !Array.isArray(
          source.beneficiary
        )
      )
        ? source.beneficiary
        : {}
  };
}


/*
--------------------------------------------------
Entry prefill
--------------------------------------------------
*/

function setFieldValue(
  id,
  value
) {
  const field =
    document.getElementById(
      id
    );

  if (
    !field ||
    value ===
      undefined ||
    value ===
      null ||
    value ===
      ""
  ) {
    return;
  }

  field.value =
    String(
      value
    );
}


export function applyRepeatEntryPrefill(
  source = {}
) {
  setFieldValue(
    "receiverCountry",
    source.receiver_country
  );

  setFieldValue(
    "amount",
    source.amount
  );

  document
    .getElementById(
      "receiverCountry"
    )
    ?.dispatchEvent(
      new Event(
        "change",
        {
          bubbles:
            true
        }
      )
    );

  document
    .getElementById(
      "amount"
    )
    ?.dispatchEvent(
      new Event(
        "input",
        {
          bubbles:
            true
        }
      )
    );
}


/*
--------------------------------------------------
Route + beneficiary prefill
--------------------------------------------------
*/

function applyGenericBeneficiary(
  beneficiary = {}
) {
  const container =
    document.getElementById(
      "destinationFields"
    );

  if (!container) {
    return;
  }

  Object
    .entries(
      beneficiary
    )
    .forEach(
      ([
        name,
        value
      ]) => {
        if (
          value ===
            undefined ||
          value ===
            null
        ) {
          return;
        }

        const field =
          container.querySelector(
            `[name="${CSS.escape(
              name
            )}"]`
          ) ||
          document.getElementById(
            `destination_${name}`
          );

        if (!field) {
          return;
        }

        field.value =
          String(
            value
          );

        field.dispatchEvent(
          new Event(
            "input",
            {
              bubbles:
                true
            }
          )
        );

        field.dispatchEvent(
          new Event(
            "change",
            {
              bubbles:
                true
            }
          )
        );
      }
    );
}


export function applyRepeatRoutePrefill(
  source = {}
) {
  const routeId =
    normalizeString(
      source.route_id
    );

  const routeSelect =
    document.getElementById(
      "routeId"
    );

  if (
    routeId &&
    routeSelect &&
    Array
      .from(
        routeSelect.options
      )
      .some(
        option =>
          option.value ===
          routeId &&
          !option.disabled
      )
  ) {
    routeSelect.value =
      routeId;

    routeSelect.dispatchEvent(
      new Event(
        "change",
        {
          bubbles:
            true
        }
      )
    );
  }

  applyGenericBeneficiary(
    source.beneficiary
  );
}
