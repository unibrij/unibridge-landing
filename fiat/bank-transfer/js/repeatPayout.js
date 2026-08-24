// fiat/bank-transfer/js/repeatPayout.js

import {
  getRepeatSourceSettlementId,
  isRepeatPayoutEntry,
  loadRepeatPayoutSource as loadSharedRepeatPayoutSource
} from "/shared/pay/history/repeat.js";

import {
  restoreDestinationFieldValues
} from "./destinationFields.js";

import {
  selectBankTransferRoute
} from "./entryForm.js";


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

export async function applyRepeatRoutePrefill(
  source = {}
) {
  const routeId =
    normalizeString(
      source.route_id
    );


  if (!routeId) {
    throw new Error(
      "repeat_route_missing"
    );
  }


  const selected =
    await selectBankTransferRoute(
      routeId
    );


  if (!selected) {
    throw new Error(
      "repeat_route_not_available"
    );
  }


  await restoreDestinationFieldValues(
    source.beneficiary
  );
}
