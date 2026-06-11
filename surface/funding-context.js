// unibridge-landing/surface/funding-context.js

/*
--------------------------------------------------
Funding context helpers
--------------------------------------------------
Frontend should not infer ramp routing from country.
It may only consume provider hints returned by backend.
--------------------------------------------------
*/

const KNOWN_PROVIDERS = new Set([
  "onramp",
  "transak",
  "guardarian",
  "wallet"
]);

export function normalizeProvider(value) {
  if (!value) {
    return null;
  }

  const normalized =
    String(value).toLowerCase().trim();

  if (!normalized) {
    return null;
  }

  return KNOWN_PROVIDERS.has(normalized)
    ? normalized
    : null;
}

export function getRouteSelectedProvider(route) {
  if (!route || typeof route !== "object") {
    return null;
  }

  return normalizeProvider(
    route.sender_id ||
    route.senderId ||
    route.provider ||
    route.ramp_provider ||
    route.funding_provider
  );
}

export function getFundingSelectedProvider(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return normalizeProvider(
    payload.sender_id ||
    payload.senderId ||
    payload.provider ||
    payload.ramp_provider ||
    payload.funding_provider ||
    payload?.funding_session?.sender_id ||
    payload?.funding_session?.provider ||
    payload?.funding_session?.ramp_provider ||
    payload?.funding_session?.funding_provider ||
    payload?.next_action?.provider ||
    payload?.next_action?.sender_id
  );
}
