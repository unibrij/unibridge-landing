window.UNIBRIDGE_COUNTRY_OPTIONS = {
  source: [
    { value: "US", label: "United States", flag: "🇺🇸", currency: "USD" },
    { value: "EU", label: "Europe / SEPA", flag: "🇪🇺", currency: "EUR" },
    { value: "GB", label: "United Kingdom", flag: "🇬🇧", currency: "GBP" },
    { value: "AE", label: "United Arab Emirates", flag: "🇦🇪", currency: "AED" }
  ],

  destination: [
    { value: "BR", label: "Brazil", flag: "🇧🇷", currency: "BRL" },
    { value: "PH", label: "Philippines", flag: "🇵🇭", currency: "PHP" }
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

window.getUniBridgeSourceCurrency = function getUniBridgeSourceCurrency() {
  const sourceSelect = document.querySelector(
    '[data-country-select="source"]'
  );

  if (!sourceSelect) return "USD";

  const country = window.UNIBRIDGE_COUNTRY_OPTIONS.source.find(
    (item) => item.value === sourceSelect.value
  );

  return country?.currency || "USD";
};

window.syncUniBridgeAmountCurrency = function syncUniBridgeAmountCurrency() {
  const currency = window.getUniBridgeSourceCurrency();

  const currencyNodes = document.querySelectorAll(
    "#amountCurrency, [data-amount-currency]"
  );

  currencyNodes.forEach((node) => {
    node.textContent = currency;
  });
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

  window.syncUniBridgeAmountCurrency();
};

document.addEventListener("change", (event) => {
  if (event.target?.matches?.('[data-country-select="source"]')) {
    window.syncUniBridgeAmountCurrency();
  }
});

window.populateUniBridgeCountrySelects();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.populateUniBridgeCountrySelects();
  });
}
