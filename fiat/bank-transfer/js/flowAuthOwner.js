// fiat/bank-transfer/js/flowAuthOwner.js

import {
  getDefaultSourceRail
} from "./config.js";

import {
  ensureFiatClerkAuth,
  clearTransientCustomerProfile
} from "./clerkAuth.js";

import {
  isDifferentAuthSubject,
  writeAuthOwnerToState,
  resetFlowForDifferentUser
} from "./state.js";

const SENSITIVE_RETURN_QUERY_KEYS = [
  "settlement_id",
  "bank_customer_ref",
  "bank_verified_identity_ref",
  "tos_accepted"
];

function normalizeObject(value = {}) {
  return value && typeof value === "object"
    ? value
    : {};
}

export function replaceRuntimeState({
  state,
  nextState
} = {}) {
  const target =
    normalizeObject(state);

  Object.keys(target).forEach((key) => {
    delete target[key];
  });

  Object.assign(
    target,
    normalizeObject(nextState)
  );

  return target;
}

export function clearSensitiveReturnQueryParams({
  query
} = {}) {
  const url =
    new URL(
      window.location.href
    );

  const queryObject =
    normalizeObject(query);

  SENSITIVE_RETURN_QUERY_KEYS.forEach((key) => {
    url.searchParams.delete(
      key
    );

    if (
      Object.prototype.hasOwnProperty.call(
        queryObject,
        key
      )
    ) {
      queryObject[key] =
        "";
    }
  });

  window.history.replaceState(
    {},
    "",
    `${url.pathname}${url.search}${url.hash}`
  );
}

export async function syncAuthOwnerOrReset({
  state,
  query,
  defaults = {}
} = {}) {
  const auth =
    await ensureFiatClerkAuth();

  if (
    isDifferentAuthSubject({
      state,
      auth
    })
  ) {
    clearTransientCustomerProfile();

    const nextState =
      resetFlowForDifferentUser({
        auth,

        defaults: {
          source_rail:
            getDefaultSourceRail(),

          ...defaults
        }
      });

    replaceRuntimeState({
      state,
      nextState
    });

    clearSensitiveReturnQueryParams({
      query
    });

    return {
      auth,

      reset:
        true,

      nextState,

      reason:
        "different_clerk_user"
    };
  }

  const nextState =
    writeAuthOwnerToState({
      auth_subject_id:
        auth.auth_subject_id,

      user_id:
        auth.user_id,

      email:
        auth.email
    });

  Object.assign(
    state,
    nextState
  );

  return {
    auth,

    reset:
      false,

    nextState,

    reason:
      null
  };
}
