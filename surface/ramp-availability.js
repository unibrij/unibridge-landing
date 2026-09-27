// surface/ramp-availability.js

const ENDPOINT =
  "options/ramp-source-availability";

const UNAVAILABLE_MESSAGE =
  "Temporarily unavailable";


function normalizeCountry(
  value
) {
  return String(
    value ||
    ""
  )
    .trim()
    .toUpperCase();
}


function getSourceCountries() {
  const countries =
    window
      .UNIBRIDGE_COUNTRY_OPTIONS
      ?.source;

  return Array.isArray(
    countries
  )
    ? countries
    : [];
}


function getSourceCountry(
  countryCode
) {
  const normalized =
    normalizeCountry(
      countryCode
    );

  return (
    getSourceCountries()
      .find(
        country =>
          country.value ===
          normalized
      ) ||
    null
  );
}


function getCountryLabel(
  countryCode
) {
  const country =
    getSourceCountry(
      countryCode
    );

  if (!country) {
    return normalizeCountry(
      countryCode
    );
  }

  return `${country.flag} ${country.label}`;
}


function createUnavailableState(
  country,
  status =
    "unavailable"
) {
  return {
    country:
      normalizeCountry(
        country
      ),

    available:
      false,

    status,

    message:
      UNAVAILABLE_MESSAGE
  };
}


function normalizeAvailabilityResponse(
  country,
  response
) {
  const normalizedCountry =
    normalizeCountry(
      response?.country ||
      country
    );

  if (
    response?.ok ===
      true &&
    response?.available ===
      true
  ) {
    return {
      country:
        normalizedCountry,

      available:
        true,

      status:
        "available",

      message:
        null
    };
  }

  return createUnavailableState(
    normalizedCountry,
    response?.status ||
      "unavailable"
  );
}


export function createRampAvailability({
  apiGet,
  sourceSelect = null
} = {}) {
  if (
    typeof apiGet !==
    "function"
  ) {
    throw new Error(
      "ramp_availability_api_get_required"
    );
  }

  const states =
    new Map();

  const pending =
    new Map();


  function resolveSourceSelect() {
    return (
      sourceSelect ||
      document.getElementById(
        "source_country"
      ) ||
      document.querySelector(
        '[data-country-select="source"]'
      )
    );
  }


  function getState(
    country
  ) {
    const normalized =
      normalizeCountry(
        country
      );

    if (!normalized) {
      return null;
    }

    return (
      states.get(
        normalized
      ) ||
      null
    );
  }


  function isAvailable(
    country
  ) {
    return (
      getState(
        country
      )?.available ===
      true
    );
  }


  async function fetchCountry(
    country
  ) {
    const normalized =
      normalizeCountry(
        country
      );

    if (!normalized) {
      throw new Error(
        "source_country_required"
      );
    }

    if (
      pending.has(
        normalized
      )
    ) {
      return pending.get(
        normalized
      );
    }

    const request =
      (async () => {
        try {
          const response =
            await apiGet(
              ENDPOINT,
              {
                source_country:
                  normalized
              }
            );

          const state =
            normalizeAvailabilityResponse(
              normalized,
              response
            );

          states.set(
            normalized,
            state
          );

          return state;
        }
        catch (error) {
          /*
          --------------------------------------------------
          Fail closed.

          If availability cannot be established, Surface
          must not offer a ramp route optimistically.

          The underlying error remains internal and no
          provider identity is exposed to the customer.
          --------------------------------------------------
          */

          console.warn(
            "RAMP_SOURCE_AVAILABILITY_LOOKUP_FAILED",
            {
              country:
                normalized,

              message:
                error?.message ||
                null
            }
          );

          const state =
            createUnavailableState(
              normalized
            );

          states.set(
            normalized,
            state
          );

          return state;
        }
        finally {
          pending.delete(
            normalized
          );
        }
      })();

    pending.set(
      normalized,
      request
    );

    return request;
  }


  function applyCountryStateToUi(
    country
  ) {
    const select =
      resolveSourceSelect();

    if (!select) {
      return;
    }

    const normalized =
      normalizeCountry(
        country
      );

    const state =
      getState(
        normalized
      );

    if (!state) {
      return;
    }

    const unavailable =
      !state.available;

    const nativeOption =
      Array.from(
        select.options ||
        []
      )
        .find(
          option =>
            option.value ===
            normalized
        );

    if (nativeOption) {
      nativeOption.disabled =
        unavailable;

      nativeOption.dataset
        .rampAvailability =
        state.status;

      nativeOption.title =
        unavailable
          ? UNAVAILABLE_MESSAGE
          : "";
    }

    const shell =
      select.nextElementSibling;

    if (
      !shell ||
      !shell.classList.contains(
        "country-select-shell"
      )
    ) {
      return;
    }

    const optionButton =
      Array.from(
        shell.querySelectorAll(
          ".country-select-option"
        )
      )
        .find(
          node =>
            node.getAttribute(
              "data-value"
            ) ===
            normalized
        );

    if (optionButton) {
      optionButton.disabled =
        unavailable;

      optionButton.setAttribute(
        "aria-disabled",
        unavailable
          ? "true"
          : "false"
      );

      optionButton.classList.toggle(
        "is-unavailable",
        unavailable
      );

      optionButton.dataset
        .rampAvailability =
        state.status;

      optionButton.textContent =
        unavailable
          ? `${getCountryLabel(
              normalized
            )} · ${UNAVAILABLE_MESSAGE}`
          : getCountryLabel(
              normalized
            );
    }
  }


  function syncSelectedCountryUi() {
    const select =
      resolveSourceSelect();

    if (!select) {
      return;
    }

    const country =
      normalizeCountry(
        select.value
      );

    const state =
      getState(
        country
      );

    const shell =
      select.nextElementSibling;

    if (
      !shell ||
      !shell.classList.contains(
        "country-select-shell"
      )
    ) {
      return;
    }

    const unavailable =
      Boolean(
        state &&
        !state.available
      );

    shell.classList.toggle(
      "has-unavailable-selection",
      unavailable
    );

    const valueNode =
      shell.querySelector(
        ".country-select-value"
      );

    if (
      valueNode &&
      country
    ) {
      valueNode.textContent =
        unavailable
          ? `${getCountryLabel(
              country
            )} · ${UNAVAILABLE_MESSAGE}`
          : getCountryLabel(
              country
            );
    }
  }


  function applyUi() {
    for (
      const country of
      getSourceCountries()
    ) {
      applyCountryStateToUi(
        country.value
      );
    }

    syncSelectedCountryUi();
  }


  async function load() {
    const countries =
      getSourceCountries();

    await Promise.all(
      countries.map(
        country =>
          fetchCountry(
            country.value
          )
      )
    );

    applyUi();

    return states;
  }


  async function refresh() {
    states.clear();

    return load();
  }


  async function ensureAvailable(
    country
  ) {
    const normalized =
      normalizeCountry(
        country
      );

    if (!normalized) {
      throw new Error(
        "source_country_required"
      );
    }

    let state =
      getState(
        normalized
      );

    if (!state) {
      state =
        await fetchCountry(
          normalized
        );

      applyCountryStateToUi(
        normalized
      );

      syncSelectedCountryUi();
    }

    if (
      !state?.available
    ) {
      const error =
        new Error(
          UNAVAILABLE_MESSAGE
        );

      error.code =
        "ramp_temporarily_unavailable";

      throw error;
    }

    return state;
  }


  function bind() {
    const select =
      resolveSourceSelect();

    if (!select) {
      return;
    }

    if (
      select.dataset
        .rampAvailabilityBound ===
      "1"
    ) {
      return;
    }

    select.addEventListener(
      "change",
      () => {
        syncSelectedCountryUi();
      }
    );

    select.dataset
      .rampAvailabilityBound =
      "1";
  }


  return {
    load,
    refresh,
    bind,
    applyUi,

    getState,
    isAvailable,
    ensureAvailable
  };
}
