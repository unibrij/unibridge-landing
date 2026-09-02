// connect-app/src/flow/payoutFlowContext.js

import {
  validateRouteForm
} from "../form";

import {
  buildTransferFingerprint
} from "./payoutAttempt";


const RECEIVE_PROFILE_ID_PATTERN =
  /^rcv_[A-Za-z0-9_-]+$/;


function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}


function requireBaseFlowContext({
  connectSessionId,
  selectedRoute,
  address
}) {
  if (!connectSessionId) {
    throw new Error(
      "connect_session_required"
    );
  }

  if (!selectedRoute) {
    throw new Error(
      "connect_route_required"
    );
  }

  if (!address) {
    throw new Error(
      "wallet_address_required"
    );
  }
}


function requireNormalAmount(
  form
) {
  const amount =
    Number(
      form?.amount
    );

  if (
    !Number.isFinite(
      amount
    ) ||
    amount <= 0
  ) {
    throw new Error(
      "amount_required"
    );
  }
}


export function normalizeAuthorizationStatus(
  value
) {
  return String(
    value ||
    ""
  )
    .trim()
    .toLowerCase();
}


export function requireNormalFlowContext({
  connectSessionId,
  selectedRoute,
  address,
  form
}) {
  requireBaseFlowContext({
    connectSessionId,
    selectedRoute,
    address
  });

  validateRouteForm({
    form,

    route:
      selectedRoute
  });
}


export function requireReceiveFlowContext({
  connectSessionId,
  selectedRoute,
  address,
  form,
  receiveProfileId
}) {
  requireBaseFlowContext({
    connectSessionId,
    selectedRoute,
    address
  });

  const normalizedReceiveProfileId =
    normalizeString(
      receiveProfileId
    );

  if (
    !RECEIVE_PROFILE_ID_PATTERN.test(
      normalizedReceiveProfileId
    )
  ) {
    throw new Error(
      "invalid_receive_profile_id"
    );
  }

  /*
   * Receive owns the beneficiary server-side.
   *
   * Therefore only validate the editable transfer
   * portion here. Do not run validateRouteForm(),
   * because that would require browser beneficiary
   * fields which intentionally do not exist in the
   * Receive flow.
   */
  requireNormalAmount(
    form
  );
}


export function requireRepeatFlowContext({
  connectSessionId,
  repeatSourcePayoutIntentId,
  address,
  form
}) {
  if (!connectSessionId) {
    throw new Error(
      "connect_session_required"
    );
  }

  if (
    !repeatSourcePayoutIntentId
  ) {
    throw new Error(
      "repeat_source_payout_intent_id_required"
    );
  }

  if (!address) {
    throw new Error(
      "wallet_address_required"
    );
  }

  const amount =
    Number(
      form?.amount
    );

  if (
    !Number.isFinite(
      amount
    ) ||
    amount <= 0
  ) {
    throw new Error(
      "invalid_amount"
    );
  }
}


export function buildCurrentTransferFingerprint({
  selectedRoute,
  form,
  repeatSourcePayoutIntentId,
  receiveProfileId
}) {
  const normalizedRepeatSourcePayoutIntentId =
    normalizeString(
      repeatSourcePayoutIntentId
    );

  const normalizedReceiveProfileId =
    normalizedRepeatSourcePayoutIntentId
      ? ""
      : normalizeString(
          receiveProfileId
        );

  /*
   * Standard / Repeat:
   * preserve the existing fingerprint exactly.
   *
   * Receive:
   * beneficiary is not browser-owned and therefore
   * must not participate in the fingerprint.
   * receive_profile_id is the authoritative
   * destination binding instead.
   */
  const fingerprintForm =
    normalizedReceiveProfileId
      ? {
          amount:
            form?.amount ??
            "",

          asset:
            form?.asset ??
            "",

          receive_profile_id:
            normalizedReceiveProfileId
        }
      : form;

  return buildTransferFingerprint({
    route:
      selectedRoute,

    form:
      fingerprintForm,

    repeatSourcePayoutIntentId:
      normalizedRepeatSourcePayoutIntentId ||
      null
  });
}
