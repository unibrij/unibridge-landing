// shared/corridors.js

const CORRIDORS_ENDPOINT =
  "/api/proxy?endpoint=options/corridors";


let cachedCorridors =
  null;

let loadPromise =
  null;


function normalizeString(
  value
) {
  return String(
    value ||
    ""
  ).trim();
}


function normalizeUpper(
  value
) {
  return normalizeString(
    value
  ).toUpperCase();
}


function normalizeRail(
  value
) {
  return normalizeString(
    value
  ).toLowerCase();
}


function normalizeCountryEntry(
  entry = {}
) {
  const country =
    normalizeUpper(
      entry.country
    );

  if (!country) {
    return null;
  }

  const rails =
    Array.isArray(
      entry.rails
    )
      ? entry.rails
          .map(
            normalizeRail
          )
          .filter(
            Boolean
          )
      : [];

  return {
    country,
    rails:
      Array.from(
        new Set(
          rails
        )
      )
  };
}


function normalizeCorridors(
  countries
) {
  if (
    !Array.isArray(
      countries
    )
  ) {
    return [];
  }

  return countries
    .map(
      normalizeCountryEntry
    )
    .filter(
      Boolean
    );
}


async function fetchCorridors() {
  const response =
    await fetch(
      CORRIDORS_ENDPOINT,
      {
        method:
          "GET",

        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );

  if (!response.ok) {
    throw new Error(
      "shared_corridors_request_failed"
    );
  }

  const data =
    await response.json();

  if (!data?.ok) {
    throw new Error(
      data?.error ||
      "shared_corridors_request_failed"
    );
  }

  return normalizeCorridors(
    data.countries
  );
}


export async function loadCorridors({
  force = false
} = {}) {
  if (
    !force &&
    cachedCorridors
  ) {
    return cachedCorridors;
  }

  if (
    !force &&
    loadPromise
  ) {
    return loadPromise;
  }

  loadPromise =
    fetchCorridors();

  try {
    cachedCorridors =
      await loadPromise;

    return cachedCorridors;
  }
  finally {
    loadPromise =
      null;
  }
}


export async function getDestinationCountries(
  options
) {
  const corridors =
    await loadCorridors(
      options
    );

  return corridors.map(
    corridor =>
      corridor.country
  );
}


export async function getCountryRails(
  country,
  options
) {
  const normalizedCountry =
    normalizeUpper(
      country
    );

  if (!normalizedCountry) {
    return [];
  }

  const corridors =
    await loadCorridors(
      options
    );

  const corridor =
    corridors.find(
      item =>
        item.country ===
        normalizedCountry
    );

  return corridor?.rails ||
    [];
}


export function clearCorridorsCache() {
  cachedCorridors =
    null;

  loadPromise =
    null;
}
