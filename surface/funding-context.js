// unibridge-landing/surface/funding-context.js

/*
--------------------------------------------------
Funding context helpers
--------------------------------------------------
Frontend does not infer funding-provider routing.

The backend is the source of truth for the selected
funding sender/provider.

These helpers only normalize and consume provider
identity returned by backend payloads.
--------------------------------------------------
*/


export function normalizeProvider(
  value
) {
  if (!value) {
    return null;
  }

  const normalized =
    String(
      value
    )
      .toLowerCase()
      .trim();

  return (
    normalized ||
    null
  );
}


export function getRouteSelectedProvider(
  route
) {
  if (
    !route ||
    typeof route !== "object"
  ) {
    return null;
  }

  return normalizeProvider(
    route.sender_id ||
    route.senderId ||
    route.funding_provider ||
    route.ramp_provider ||
    route.provider
  );
}


export function getFundingSelectedProvider(
  payload
) {
  if (
    !payload ||
    typeof payload !== "object"
  ) {
    return null;
  }

  return normalizeProvider(
    payload.sender_id ||
    payload.senderId ||
    payload.funding_provider ||
    payload.ramp_provider ||
    payload.provider ||

    payload
      ?.funding_session
      ?.sender_id ||

    payload
      ?.funding_session
      ?.funding_provider ||

    payload
      ?.funding_session
      ?.ramp_provider ||

    payload
      ?.funding_session
      ?.provider ||

    payload
      ?.next_action
      ?.sender_id ||

    payload
      ?.next_action
      ?.provider
  );
}
