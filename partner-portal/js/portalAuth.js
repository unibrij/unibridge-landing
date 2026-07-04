// partner-portal/js/portalAuth.js

import {
  normalizeString,
  pickFirst
} from "./portalUtils.js";

import {
  readStoredOrganizationId,
  storeOrganizationId
} from "./portalStorage.js";

export function readPortalTokenFromUrl() {
  const params =
    new URLSearchParams(window.location.search);

  return normalizeString(
    params.get("portal_token")
  );
}

export function removePortalTokenFromUrl() {
  const url =
    new URL(window.location.href);

  if (!url.searchParams.has("portal_token")) {
    return;
  }

  url.searchParams.delete("portal_token");

  window.history.replaceState(
    {},
    document.title,
    `${url.pathname}${url.search}${url.hash}`
  );
}

export async function verifyPortalToken({
  api,
  onVerified
} = {}) {
  const portalToken =
    readPortalTokenFromUrl();

  if (!portalToken) {
    return false;
  }

  try {
    const result =
      await api.verifyPortalSession({
        portal_token: portalToken
      });

    const organization =
      pickFirst(result.organizations);

    if (!organization?.id) {
      throw new Error(
        "No organization was found for this portal link."
      );
    }

    storeOrganizationId(organization.id);

    if (typeof onVerified === "function") {
      await onVerified(organization);
    }

    return true;
  } finally {
    removePortalTokenFromUrl();
  }
}

export async function requestPortalLink({
  api,
  ownerEmail
} = {}) {
  return api.startPortalSession({
    owner_email: normalizeString(ownerEmail)
  });
}

export function getCurrentOrganizationId() {
  return readStoredOrganizationId();
}

export default {
  readPortalTokenFromUrl,
  removePortalTokenFromUrl,
  verifyPortalToken,
  requestPortalLink,
  getCurrentOrganizationId
};
