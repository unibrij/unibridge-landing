// surface/ramp-availability.js

const ENDPOINT =
  "options/ramp-source-availability";

const MAINTENANCE_LABEL =
  "Temporarily unavailable";

const UNAVAILABLE_LABEL =
  "Currently unavailable";

const MAINTENANCE_MESSAGE =
  "Service may be temporarily unavailable. You can still continue.";

const UNAVAILABLE_MESSAGE =
  "This payment route is currently unavailable.";


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


function normalizeStatus(
  value
) {
  return String(
    value ||
    ""
  )
    .trim()
    .toLowerCase();
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


function createMaintenanceState(
  country,
  message =
    MAINTENANCE_MESSAGE
) {
  return {
    country:
      normalizeCountry(
        country
      ),

    available:
      true,

    status:
      "maintenance",

    message:
      message ||
      MAINTENANCE_MESSAGE
  };
}


function createUnavailableState(
  country,
  message =
    UNAVAILABLE_MESSAGE
) {
  return {
    country:
      normalizeCountry(
        country
      ),

    available:
      false,

    status:
      "unavailable",

    message:
      message ||
      UNAVAILABLE_MESSAGE
  };
}


function createUnknownState(
  country
) {
  return {
    country:
      normalizeCountry(
        country
      ),

    available:
      null,

    status:
      "unknown",

    message:
      null
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

  const status =
    normalizeStatus(
      response?.status
    );

  /*
  --------------------------------------------------
  Maintenance

  Maintenance is still usable.

  Preserve it as an available state so it remains
  selectable and does not block quote creation.
  --------------------------------------------------
  */

  if (
    response?.ok ===
      true &&
    response?.available ===
      true &&
    status ===
      "maintenance"
  ) {
    return createMaintenanceState(
      normalizedCountry,
      response?.message ||
        MAINTENANCE_MESSAGE
    );
  }

  /*
  --------------------------------------------------
  Normal available route
  --------------------------------------------------
  */

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

  /*
  --------------------------------------------------
  Explicit unavailable route
  --------------------------------------------------
  */

  if (
    response?.ok ===
      true &&
    response?.available ===
      false
  ) {
    return createUnavailableState(
      normalizedCountry,
      response?.message ||
        UNAVAILABLE_MESSAGE
    );
  }

  return createUnknownState(
    normalizedCountry
  );
}


function getPresentationLabel(
  state
) {
  if (
    state?.status ===
      "maintenance"
  ) {
    return MAINTENANCE_LABEL;
  }

  if (
    state?.available ===
      false
  ) {
    return UNAVAILABLE_LABEL;
  }

  return null;
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
          Presentation fallback.

          Lookup failure means availability is unknown.

          Do not present an operational outage unless the
          backend explicitly reported it.

          Backend sender routing remains authoritative.
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
            createUnknownState(
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

    const warning =
      state.status ===
        "maintenance";

    const unavailable =
      state.available ===
        false;

    const highlighted =
      warning ||
      unavailable;

    const presentationLabel =
      getPresentationLabel(
        state
      );

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
      nativeOption.dataset
        .rampAvailability =
        state.status;

      nativeOption.title =
        highlighted
          ? state.message ||
            ""
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

    if (!optionButton) {
      return;
    }

    /*
    --------------------------------------------------
    Public presentation

    Do not expose internal operational terminology.

    maintenance:
      "Temporarily unavailable"
      still selectable / available
      warning styling only.

    unavailable:
      "Currently unavailable"
      red styling.

    Backend sender routing remains authoritative.
    --------------------------------------------------
    */

    optionButton.classList.toggle(
      "is-maintenance",
      warning
    );

    optionButton.classList.toggle(
      "is-unavailable",
      unavailable
    );

    optionButton.dataset
      .rampAvailability =
      state.status;

    optionButton.textContent =
      presentationLabel
        ? `${getCountryLabel(
            normalized
          )} · ${presentationLabel}`
        : getCountryLabel(
            normalized
          );

    optionButton.title =
      highlighted
        ? state.message ||
          ""
        : "";
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

    const warning =
      Boolean(
        state &&
        state.status ===
          "maintenance"
      );

    const unavailable =
      Boolean(
        state &&
        state.available ===
          false
      );

    const highlighted =
      warning ||
      unavailable;

    /*
    --------------------------------------------------
    Preserve the existing selected-field presentation.

    The route status is visible in the open dropdown,
    while the selected field keeps the normal country
    label and receives only the matching warning /
    unavailable styling.
    --------------------------------------------------
    */

    shell.classList.toggle(
      "has-maintenance-selection",
      warning
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
        getCountryLabel(
          country
        );

      valueNode.title =
        highlighted
          ? state?.message ||
            ""
          : "";
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
    isAvailable
  };
}
