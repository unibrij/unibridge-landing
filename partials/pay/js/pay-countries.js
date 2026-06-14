window.UNIBRIDGE_COUNTRY_OPTIONS = {
  source: [
    { value: "US", label: "United States", flag: "🇺🇸" },
    { value: "EU", label: "Europe / SEPA", flag: "🇪🇺" },
    { value: "GB", label: "United Kingdom", flag: "🇬🇧" },
    { value: "AE", label: "United Arab Emirates", flag: "🇦🇪" }
  ],

  destination: [
    { value: "BR", label: "Brazil", flag: "🇧🇷" },
    { value: "PH", label: "Philippines", flag: "🇵🇭" }
  ]
};

window.populateUniBridgeCountrySelect = function populateUniBridgeCountrySelect(
  select,
  countries
) {
  if (!select || !Array.isArray(countries)) return;

  const currentValue = select.value;

  select.innerHTML = "";

  countries.forEach((country) => {
    const option = document.createElement("option");

    option.value = country.value;
    option.textContent = `${country.flag} ${country.label}`;

    select.appendChild(option);
  });

  if (
    currentValue &&
    countries.some((country) => country.value === currentValue)
  ) {
    select.value = currentValue;
  }
};

window.populateUniBridgeCountrySelects = function populateUniBridgeCountrySelects() {
  const sourceSelects = document.querySelectorAll(
    '[data-country-select="source"]'
  );

  const destinationSelects = document.querySelectorAll(
    '[data-country-select="destination"]'
  );

  sourceSelects.forEach((select) => {
    window.populateUniBridgeCountrySelect(
      select,
      window.UNIBRIDGE_COUNTRY_OPTIONS.source
    );
  });

  destinationSelects.forEach((select) => {
    window.populateUniBridgeCountrySelect(
      select,
      window.UNIBRIDGE_COUNTRY_OPTIONS.destination
    );
  });
};

window.populateUniBridgeCountrySelects();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.populateUniBridgeCountrySelects();
  });
}
