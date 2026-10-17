
 // shared/executor-availability/index.js

const ENDPOINT =
  "/api/proxy?endpoint=options/executor-availability";

const CACHE_TTL_MS =
  10000;

const STATUSES = new Set([
  "live",
  "testing",
  "paused"
]);

let cachedStates = null;
let cacheExpiresAt = 0;
let pendingRequest = null;


function normalizeExecutor(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}


function normalizeCountry(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}


function normalizeStatus(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}


function stateKey(executor_id, country) {
  return `${executor_id}:${country}`;
}


function normalizeStates(payload) {
  if (
    payload?.ok !== true ||
    !Array.isArray(payload.states)
  ) {
    throw new Error(
      "executor_availability_invalid_response"
    );
  }

  const states = new Map();

  for (const item of payload.states) {
    const executor_id =
      normalizeExecutor(item?.executor_id);

    const country =
      normalizeCountry(item?.country);

    const status =
      normalizeStatus(item?.status);

    if (
      !executor_id ||
      !country ||
      !STATUSES.has(status)
    ) {
      continue;
    }

    states.set(
      stateKey(executor_id, country),
      { executor_id, country, status }
    );
  }

  return states;
}


async function fetchStates() {
  const response = await fetch(ENDPOINT, {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      "executor_availability_request_failed"
    );
  }

  const payload = await response.json();

  return normalizeStates(payload);
}


export async function loadExecutorAvailability({
  force = false
} = {}) {
  if (pendingRequest) {
    return pendingRequest;
  }

  if (
    !force &&
    cachedStates &&
    Date.now() < cacheExpiresAt
  ) {
    return cachedStates;
  }

  pendingRequest = fetchStates();

  try {
    const states = await pendingRequest;

    cachedStates = states;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    return states;
  } catch (error) {
    cachedStates = null;
    cacheExpiresAt = 0;
    throw error;
  } finally {
    pendingRequest = null;
  }
}


export function describeExecutorAvailability(status) {
  switch (normalizeStatus(status)) {
    case "live":
      return {
        status: "live",
        available: true,
        label: null,
        message: null
      };

    case "testing":
      return {
        status: "testing",
        available: true,
        label: "Live testing",
        message:
          "This payout route is in live testing. Real transfers are supported, but they may be delayed or fail. UniBridge remains responsible for handling failed transfers."
      };

    case "paused":
      return {
        status: "paused",
        available: false,
        label: "Currently unavailable",
        message:
          "This payout route is temporarily unavailable for new transfers."
      };

    default:
      return {
        status: "unknown",
        available: null,
        label: "Availability not verified",
        message:
          "We couldn't verify this payout route right now. Please try again."
      };
  }
}


export async function getExecutorAvailability({
  executor_id,
  country,
  force = false
} = {}) {
  const normalizedExecutor =
    normalizeExecutor(executor_id);

  const normalizedCountry =
    normalizeCountry(country);

  const identity = {
    executor_id: normalizedExecutor,
    country: normalizedCountry
  };

  if (!normalizedExecutor || !normalizedCountry) {
    return {
      ...identity,
      ...describeExecutorAvailability("unknown")
    };
  }

  try {
    const states = await loadExecutorAvailability({
      force
    });

    const state = states.get(
      stateKey(normalizedExecutor, normalizedCountry)
    );

    return {
      ...identity,
      ...describeExecutorAvailability(state?.status)
    };
  } catch (error) {
    console.warn(
      "EXECUTOR_AVAILABILITY_LOOKUP_FAILED",
      error?.message ?? error
    );

    return {
      ...identity,
      ...describeExecutorAvailability("unknown")
    };
  }
}


export function clearExecutorAvailabilityCache() {
  cachedStates = null;
  cacheExpiresAt = 0;
}
